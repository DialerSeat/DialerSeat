import { getServiceClient } from '@/lib/supabase'
import { sendAdminPush } from '@/lib/pushNotify'

// =============================================================================
// TELL SOMEBODY THE MOMENT DIALING IS IMPOSSIBLE
// =============================================================================
// On 11 September the Telnyx account was blocked and the number pool was empty.
// Both conditions fail EVERY dial for EVERY agent. The dialer retried anyway:
// 4,341 attempts over ten hours, not one reaching Telnyx, one lead attempted 41
// times in a single hour, agents at their desks the whole time.
//
// Nothing said anything.
//
// WHY THE EXISTING MONITOR DID NOT CATCH IT. app/api/cron/ops-health already
// watches pool capacity and pushes an admin alert. But Vercel Hobby cannot run
// sub-daily crons — the deploy fails — so that check runs at most once a day,
// and its own header says it plainly: "a webhook outage found 20 hours later is
// not an alert". It also has no check for a blocked account at all.
//
// The dial path already knows, in real time, at the moment of failure. So say
// so from here instead of waiting for a schedule that cannot run often enough.
//
// ── WHY THIS CANNOT BREAK A DIAL ────────────────────────────────────────────
// It is called with `void` and never awaited, it swallows every error, and it
// returns nothing the caller reads. It cannot delay a call, cannot fail one,
// and cannot refuse one. `docs/CARRIER-ENGINEERING.md` §10 is about guards that
// can say no; this one has no opinion about the call at all.
//
// The BACKOFF half of the design in docs/COST-FINDINGS.md §1n — growing delays
// after repeated platform failures — is deliberately NOT here. It touches dial
// timing, and it wants a session where it is the only thing moving. The alert
// is the part that would have saved 11 September; the backoff would only have
// saved function invocations.

const supabase = getServiceClient('dialOutageAlert')

/**
 * Cooldown. Shorter than ops-health's 60 minutes because this fires on a total
 * outage rather than a threshold — when every dial is failing, being told twice
 * an hour is not noise.
 */
const COOLDOWN_MINUTES = 15

/**
 * Separate from the cron's `pool_capacity` key on purpose. If they shared one,
 * a daily cron alert would silence the real-time one for an hour, and the whole
 * point of this is that the cron is too slow.
 */
const ALERT_KEY = 'dial_outage_realtime'

/**
 * A dial failed for a reason that has nothing to do with the lead.
 *
 * Call with `failureKind === 'capacity'` — the taxonomy in placeOutboundCall
 * already means exactly this: *"Nothing to do with this lead: the account has
 * no number to dial from... The next lead in the same tick will fail
 * identically."*
 *
 * Fire and forget. Never await this.
 */
export function noteDialOutage(reason: string, context: { source?: string; userId?: string }): void {
  void (async () => {
    try {
      const since = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString()

      // Cross-instance dedupe. An in-memory guard would be per-lambda and every
      // cold start would re-alert on the same ongoing outage — which, at 7
      // failed dials a minute, is a notification storm.
      const { data: recent, error } = await supabase
        .from('ops_alert_log')
        .select('id')
        .eq('alert_key', ALERT_KEY)
        .gte('created_at', since)
        .limit(1)

      if (error) {
        // Cannot tell whether we already alerted. Prefer alerting: a duplicate
        // notification is annoying, a silent ten-hour outage is what this
        // exists to prevent. Same call ops-health makes.
        console.error('[dialOutageAlert] cooldown check failed, alerting anyway:', error.message)
      } else if (recent && recent.length > 0) {
        return
      }

      const body =
        `DIALING IS DOWN: ${reason} ` +
        `Every agent's next dial will fail the same way until this is fixed.` +
        (context.source ? ` (first seen on ${context.source})` : '')

      await sendAdminPush('pool_capacity', body, {
        title: 'Dialing is down',
        url: '/dashboard/admin/desktop',
      })
      await supabase.from('ops_alert_log').insert({ alert_key: ALERT_KEY, detail: body })
    } catch (err) {
      // Telemetry must never be able to disturb a live dial path.
      console.warn('[dialOutageAlert] alert failed', err)
    }
  })()
}
