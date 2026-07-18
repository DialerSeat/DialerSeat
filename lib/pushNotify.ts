import webpush from 'web-push'
import { getServiceClient } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────
// sendAdminPush — the single choke point every notification-triggering
// event should call through. It checks the saved Settings > Notifications
// preference for the given event type FIRST, and only sends if that
// specific toggle (and the master toggle) is on.
//
// Wired in, at their confirmed-live trigger points:
//   signup           -> app/api/webhooks/clerk/route.ts, 'user.created'
//   account_deleted  -> lib/deleteAccount.ts (the real, in-app deletion path —
//                       hard-deletes the users row, so name/email are captured
//                       BEFORE that happens) and, separately,
//                       app/api/webhooks/clerk/route.ts, 'user.deleted' (only
//                       fires if an account is deleted directly through Clerk,
//                       bypassing DialerSeat's own UI)
//   new_sub / resub  -> app/api/stripe/webhook/route.ts, 'customer.subscription.created'
//   renewal          -> app/api/stripe/webhook/route.ts, 'invoice.payment_succeeded'
//   cancel           -> app/api/stripe/webhook/route.ts, 'customer.subscription.deleted'
//
// All six event types are wired end to end. Every one of these call sites
// also calls lib/billingEvents.ts's logBillingEvent() with the same event
// data, which is what the admin Logs page reads — so a notification and
// its corresponding Logs entry can never say something different from
// each other, since they're written from the same call site in one pass.
// ─────────────────────────────────────────────────────────────────────────

export type NotifEventType = 'signup' | 'account_deleted' | 'new_sub' | 'resub' | 'renewal' | 'cancel'

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@dialerseat.com'
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''

let vapidConfigured = false
function ensureVapidConfigured() {
  if (vapidConfigured) return
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      '[pushNotify] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set. ' +
      'Generate a pair with `npx web-push generate-vapid-keys` and set both, ' +
      'plus NEXT_PUBLIC_VAPID_PUBLIC_KEY (same public key) for the client subscribe step.'
    )
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
}

// Default copy per event type, used when a caller doesn't pass a custom
// title/body. Keeps call sites at the webhook terse.
const EVENT_COPY: Record<NotifEventType, { title: string; tag: string }> = {
  signup:          { title: 'New Sign-Up',        tag: 'ds-signup' },
  account_deleted: { title: 'Account Deleted',    tag: 'ds-account-deleted' },
  new_sub:         { title: 'New Subscription',   tag: 'ds-new-sub' },
  resub:           { title: 'Resubscription',     tag: 'ds-resub' },
  renewal:         { title: 'Renewal',            tag: 'ds-renewal' },
  cancel:          { title: 'Cancellation',       tag: 'ds-cancel' },
}

interface AdminNotificationPrefs {
  master_enabled: boolean
  signup: boolean
  account_deleted: boolean
  new_sub: boolean
  resub: boolean
  renewal: boolean
  cancel: boolean
}

async function getPrefs(): Promise<AdminNotificationPrefs | null> {
  const supabase = getServiceClient('pushNotify:getPrefs')
  const { data, error } = await supabase
    .from('admin_notification_prefs')
    .select('master_enabled, signup, account_deleted, new_sub, resub, renewal, cancel')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    console.error('[pushNotify] failed to read admin_notification_prefs:', error)
    return null
  }
  return data as AdminNotificationPrefs | null
}

/**
 * Sends a push notification for the given event type to every subscribed
 * device, but only if the master toggle and that event's specific toggle
 * are both on in Settings > Notifications. Never throws — failures are
 * logged and swallowed, since a notification miss should never break the
 * caller's actual business logic (e.g. a Stripe webhook).
 */
export async function sendAdminPush(
  eventType: NotifEventType,
  body: string,
  opts?: { title?: string; url?: string }
): Promise<void> {
  try {
    const prefs = await getPrefs()
    if (!prefs) return
    if (!prefs.master_enabled) return
    if (!prefs[eventType]) return

    ensureVapidConfigured()

    const supabase = getServiceClient('pushNotify:send')
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
    if (error) {
      console.error('[pushNotify] failed to read push_subscriptions:', error)
      return
    }
    if (!subs || subs.length === 0) return

    const copy = EVENT_COPY[eventType]
    const payload = JSON.stringify({
      title: opts?.title || copy.title,
      body,
      tag: copy.tag,
      url: opts?.url || '/dashboard/admin/desktop',
    })

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id)
        } catch (sendErr: any) {
          // 404/410 means the browser or user revoked this subscription —
          // clean it up so we stop trying it on every future event.
          if (sendErr?.statusCode === 404 || sendErr?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            console.error('[pushNotify] send failed for subscription', sub.id, sendErr)
          }
        }
      })
    )
  } catch (err) {
    console.error('[pushNotify] unexpected error in sendAdminPush:', err)
  }
}
