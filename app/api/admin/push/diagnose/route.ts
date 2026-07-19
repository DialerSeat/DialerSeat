import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/push/diagnose')

// ─────────────────────────────────────────────────────────────────────────
// GET  /api/admin/push/diagnose         — checks every real failure point
//                                          in the push pipeline, in order,
//                                          without sending anything.
// POST /api/admin/push/diagnose         — same checks, then actually
//                                          attempts to send one real test
//                                          notification to every saved
//                                          subscription, and reports
//                                          exactly what happened for each.
//
// Built because sendAdminPush() is deliberately designed to never throw —
// failures are caught and console.error'd so a notification miss can never
// break a live Stripe webhook. That's the right call for the webhook, but
// it means a misconfigured VAPID key (or any other setup gap) fails
// completely silently from the admin's point of view — nothing surfaces
// anywhere they'd actually see it. This endpoint surfaces it directly.
// ─────────────────────────────────────────────────────────────────────────

interface DiagnosticResult {
  step: string
  ok: boolean
  detail: string
}

async function runChecks(): Promise<{ results: DiagnosticResult[]; subs: any[] | null }> {
  const results: DiagnosticResult[] = []

  // 1. VAPID keys present at all
  const publicKey = process.env.VAPID_PUBLIC_KEY || ''
  const privateKey = process.env.VAPID_PRIVATE_KEY || ''
  const clientKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

  if (!publicKey || !privateKey) {
    results.push({
      step: 'VAPID keys configured',
      ok: false,
      detail: 'VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY are not set on the server. ' +
        'This is very likely THE cause if nothing is arriving — every send fails at this exact ' +
        'check before it ever reaches the push service, and (by design, so a bad key never breaks ' +
        'a live Stripe webhook) that failure is only ever logged server-side, never surfaced to you. ' +
        'Run `npx web-push generate-vapid-keys` and set both, plus NEXT_PUBLIC_VAPID_PUBLIC_KEY (same public key).',
    })
  } else {
    results.push({ step: 'VAPID keys configured', ok: true, detail: 'Both VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set.' })
  }

  if (publicKey && clientKey && publicKey !== clientKey) {
    results.push({
      step: 'VAPID public key matches client key',
      ok: false,
      detail: 'VAPID_PUBLIC_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY are both set but DIFFERENT. ' +
        'They must be the exact same value — one is used server-side to sign, the other ' +
        'client-side to build the subscription. A mismatch here means devices subscribe with a ' +
        'public key the server\u2019s private key doesn\u2019t actually correspond to, and every send ' +
        'will fail with an authentication error from the push service.',
    })
  } else if (publicKey && clientKey) {
    results.push({ step: 'VAPID public key matches client key', ok: true, detail: 'Server and client public keys match.' })
  } else if (publicKey && !clientKey) {
    results.push({
      step: 'VAPID public key matches client key',
      ok: false,
      detail: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set. Devices can\u2019t subscribe without it — ' +
        'the "Enable" button in Settings > Notifications will fail with a configuration error.',
    })
  }

  // 2. Does the admin_notification_prefs row exist and is master enabled
  const { data: prefs, error: prefsError } = await supabase
    .from('admin_notification_prefs')
    .select('master_enabled, signup, account_deleted, new_sub, resub, renewal, cancel')
    .eq('id', 1)
    .maybeSingle()

  if (prefsError) {
    results.push({
      step: 'Notification preferences readable',
      ok: false,
      detail: `Failed to read admin_notification_prefs: ${prefsError.message}. If this says the table or ` +
        `column doesn't exist, a required migration hasn't been run.`,
    })
  } else if (!prefs) {
    results.push({
      step: 'Notification preferences readable',
      ok: false,
      detail: 'admin_notification_prefs has no row with id=1. The seed row from the original migration ' +
        'never ran (or was deleted). This is now self-healing — sendAdminPush() will default to ' +
        'everything ON rather than silently sending nothing, and the row gets created automatically ' +
        'the next time any toggle is saved in Settings. Still worth running the seed migration ' +
        'properly so this doesn\u2019t rely on the fallback.',
    })
  } else {
    results.push({
      step: 'Notification preferences readable',
      ok: true,
      detail: `master_enabled=${prefs.master_enabled}. Per-event: signup=${prefs.signup}, ` +
        `account_deleted=${prefs.account_deleted}, new_sub=${prefs.new_sub}, resub=${prefs.resub}, ` +
        `renewal=${prefs.renewal}, cancel=${prefs.cancel}.`,
    })
    if (!prefs.master_enabled) {
      results.push({
        step: 'Master notifications toggle',
        ok: false,
        detail: 'The master "Allow Notifications" toggle in Settings is OFF. Every event type is ' +
          'silenced regardless of its own individual toggle.',
      })
    }
  }

  // 3. Any saved subscriptions at all
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, user_agent, created_at, last_used_at')

  if (subsError) {
    results.push({
      step: 'Saved device subscriptions readable',
      ok: false,
      detail: `Failed to read push_subscriptions: ${subsError.message}.`,
    })
  } else if (!subs || subs.length === 0) {
    results.push({
      step: 'Saved device subscriptions',
      ok: false,
      detail: 'No devices are subscribed at all (push_subscriptions is empty). Open Settings > ' +
        'Notifications > This Device and tap Enable — this is expected right after that GET result ' +
        'shows \'stale\' or \'not_subscribed\', or if a previous send ever got a 404/410 and the ' +
        'subscription was cleaned up automatically.',
    })
  } else {
    results.push({
      step: 'Saved device subscriptions',
      ok: true,
      detail: `${subs.length} device(s) subscribed: ` +
        subs.map(s => `${s.user_agent || 'unknown device'} (last used: ${s.last_used_at || 'never'})`).join('; '),
    })
  }

  return { results, subs: subs ?? null }
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { results } = await runChecks()
  return NextResponse.json({ results })
}

export async function POST() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { results, subs } = await runChecks()

  const vapidOk = results.find(r => r.step === 'VAPID keys configured')?.ok
  if (!vapidOk || !subs || subs.length === 0) {
    // No point attempting a real send if the prerequisites already failed —
    // report the checks as-is rather than throw a confusing secondary error.
    return NextResponse.json({ results, sendResults: [] })
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@dialerseat.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const { data: fullSubs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')

  const sendResults = await Promise.all(
    (fullSubs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'DialerSeat Test',
            body: 'If you can see this, push notifications are working correctly.',
            tag: 'ds-diagnostic-test',
            url: '/dashboard/admin/desktop',
          })
        )
        return { subscriptionId: sub.id, ok: true, detail: 'Sent successfully.' }
      } catch (err: any) {
        const statusCode = err?.statusCode
        let detail = err?.message || String(err)
        if (statusCode === 404 || statusCode === 410) {
          detail = 'Push service rejected this subscription as expired/revoked (404/410). ' +
            'It would normally be auto-deleted by a real send — re-enable push on that device.'
        } else if (statusCode === 401 || statusCode === 403) {
          detail = 'Push service rejected the request as unauthorized — almost certainly a VAPID ' +
            'key mismatch (see "VAPID public key matches client key" check above).'
        }
        return { subscriptionId: sub.id, ok: false, statusCode, detail }
      }
    })
  )

  return NextResponse.json({ results, sendResults })
}
