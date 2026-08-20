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

// Business events (money in/out) and OPERATIONAL events (the product is
// broken). Until the operational ones existed, every alert this system could
// send was about revenue — nothing told an admin the dialer had stopped
// working. Each operational type below maps to a failure that already happened
// silently and was found by a human noticing something felt off:
//   agent_leg_refused  Telnyx refusing the agent leg -> calls with no audio
//   pool_capacity      caller-ID pool about to exhaust -> every dial fails
//   webhook_silence    no call_events while calls exist -> all metrics read 0
export type NotifEventType =
  | 'signup'
  | 'account_deleted'
  | 'new_sub'
  | 'resub'
  | 'renewal'
  | 'cancel'
  | 'sub_paused'
  | 'sub_resumed'
  | 'agent_online'
  | 'payment_failed'
  | 'team_join'
  | 'agent_leg_refused'
  | 'pool_capacity'
  | 'webhook_silence'

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
  // Distinct tags so a pause and a later resume from the same person don't
  // collapse into one another in the notification tray.
  sub_paused:      { title: 'Subscription Paused', tag: 'ds-sub-paused' },
  sub_resumed:     { title: 'Subscription Resumed', tag: 'ds-sub-resumed' },
  // Someone started dialing. Not an alert — it is the one event that says the
  // product is being used right now, which is what you actually want to know
  // while there are few enough customers to care about each one individually.
  agent_online:    { title: 'Agent Online',       tag: 'ds-agent-online' },
  // A declined card was completely silent until now. The subscription goes
  // past_due, the customer keeps using the product, and the first anyone knew
  // was a cancellation weeks later — or an email from a customer who thought
  // they had been cut off. This is the one revenue event you can still act on.
  payment_failed:  { title: 'Payment Failed',     tag: 'ds-payment-failed' },
  // Somebody joined through a partner's code rather than finding the site.
  // Distinct from signup on purpose: a self-serve signup tells you marketing is
  // working, and this tells you a PARTNERSHIP is — which is the number that
  // decides whether to chase more of them.
  team_join:       { title: 'Joined With A Code', tag: 'ds-team-join' },
  // Operational alerts get a marker in the title so they are distinguishable
  // from revenue notifications at a glance on a lock screen — these mean
  // "go look now", not "nice, money".
  agent_leg_refused: { title: '⚠ Calls Have No Audio', tag: 'ds-agent-leg-refused' },
  pool_capacity:     { title: '⚠ Number Pool Filling', tag: 'ds-pool-capacity' },
  webhook_silence:   { title: '⚠ Call Webhooks Silent', tag: 'ds-webhook-silence' },
}

interface AdminNotificationPrefs {
  master_enabled: boolean
  signup: boolean
  account_deleted: boolean
  new_sub: boolean
  resub: boolean
  renewal: boolean
  cancel: boolean
  sub_paused: boolean
  sub_resumed: boolean
  agent_online: boolean
  payment_failed: boolean
  team_join: boolean
  agent_leg_refused: boolean
  pool_capacity: boolean
  webhook_silence: boolean
}

async function getPrefs(): Promise<AdminNotificationPrefs> {
  const supabase = getServiceClient('pushNotify:getPrefs')
  const { data, error } = await supabase
    .from('admin_notification_prefs')
    .select('master_enabled, signup, account_deleted, new_sub, resub, renewal, cancel, sub_paused, sub_resumed, agent_online, payment_failed, agent_leg_refused, pool_capacity, webhook_silence')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    console.error('[pushNotify] failed to read admin_notification_prefs:', error)
    // A genuine query error (bad connection, RLS issue, etc.) — don't
    // guess, just don't send. Distinct from the "no row" case below,
    // which is a setup gap, not a real signal to suppress everything.
    return { master_enabled: false, signup: false, account_deleted: false, new_sub: false, resub: false, renewal: false, cancel: false, sub_paused: false, sub_resumed: false, agent_online: false, payment_failed: false, team_join: false, agent_leg_refused: false, pool_capacity: false, webhook_silence: false }
  }
  if (!data) {
    // The seed row (migrations/PUSH_NOTIFICATIONS_2026-07-17.sql) never
    // ran, or was somehow deleted. This is NOT the same thing as an admin
    // deliberately turning notifications off — treating a missing row as
    // "everything off" (the old behavior here) meant every single
    // sendAdminPush() call returned immediately with nothing sent, for
    // every event type, with no error anywhere to explain why. Default
    // to everything ON instead, matching the table's own column defaults
    // (see the CREATE TABLE — every boolean defaults to true), and let
    // the admin explicitly turn things off if they actually want that.
    console.warn('[pushNotify] admin_notification_prefs has no row with id=1 — defaulting to all notifications ON.')
    return { master_enabled: true, signup: true, account_deleted: true, new_sub: true, resub: true, renewal: true, cancel: true, sub_paused: true, sub_resumed: true, agent_online: true, payment_failed: true, team_join: true, agent_leg_refused: true, pool_capacity: true, webhook_silence: true }
  }
  return data as AdminNotificationPrefs
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
  const supabase = getServiceClient('pushNotify:send')
  const copyForLog = EVENT_COPY[eventType]
  const title = opts?.title || copyForLog.title
  const url = opts?.url || '/dashboard/admin/desktop'

  // ── LOG BEFORE SENDING, ALWAYS ──────────────────────────────────────────
  // A push notification is an interruption, not a record. The OS shows a
  // banner, you tap it, and every trace of it is gone — which means a signup
  // that arrived overnight, or a capacity warning dismissed on a phone, left
  // nothing behind anywhere.
  //
  // Writing the row FIRST is deliberate. It means the history survives a
  // muted preference, a missing VAPID key, and a delivery that fails at every
  // endpoint. The thing happened; the record should exist regardless of
  // whether a browser was told about it.
  let notificationId: string | null = null
  try {
    const { data: logged, error: logErr } = await supabase
      .from('admin_notifications')
      .insert({ event_type: eventType, title, body, url })
      .select('id')
      .maybeSingle()
    if (logErr) {
      console.error('[pushNotify] failed to log notification:', logErr)
    } else {
      notificationId = logged?.id ?? null
    }
  } catch (logErr) {
    console.error('[pushNotify] unexpected error logging notification:', logErr)
  }

  try {
    const prefs = await getPrefs()
    // Muted: the row above still exists, so it shows up in the Notifications
    // app without ever having buzzed a device. That is the point of the split.
    if (!prefs.master_enabled) return
    if (!prefs[eventType]) return

    ensureVapidConfigured()
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
    if (error) {
      console.error('[pushNotify] failed to read push_subscriptions:', error)
      return
    }
    if (!subs || subs.length === 0) return

    const payload = JSON.stringify({
      title,
      body,
      tag: copyForLog.tag,
      url,
    })

    let delivered = 0
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
          delivered++
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

    // Record what actually reached a device. delivered_to = 0 alongside
    // pushed = true is the signature of "we tried and every endpoint failed",
    // which is a different problem from "we never tried".
    if (notificationId) {
      await supabase
        .from('admin_notifications')
        .update({ pushed: true, delivered_to: delivered })
        .eq('id', notificationId)
    }
  } catch (err) {
    console.error('[pushNotify] unexpected error in sendAdminPush:', err)
  }
}
