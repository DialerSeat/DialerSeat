import { getServiceClient } from '@/lib/supabase'
import { sendAdminPush } from '@/lib/pushNotify'
import { getPlatformConfig } from '@/lib/platformConfig'

// =============================================================================
// ONE AGENT, ONE DAY, THREE DOLLARS — STOP AND LOOK
// =============================================================================
// Every other guard in this codebase protects a call. This one protects the
// account, and it exists because of a sentence rather than a metric:
//
//   "$3 is a huge day per agent. if we break $3 from one agent there should be
//    a huge alert saying something is wrong."
//
// That is correct arithmetic, not caution. At the rates this account should be
// on, a dial is about $0.003 (docs/COST-FINDINGS.md §0), so $3 in one day from
// ONE agent is roughly a thousand dials. Nobody dials a thousand times in a
// day. If the number is reached, the overwhelmingly likely explanation is a
// fault — and every fault this platform has had looked exactly like this
// before anybody noticed:
//
//   the parked agent leg      $8.17 per agent-hour, for weeks
//   the blocked-account loop  4,341 dials in ten hours, nothing said
//   the dead browser socket   41 failed dials in one hour, one agent
//
// In every case the money was gone before a person looked at a number. So this
// does not wait for a cron, a dashboard or a month-end invoice.
//
// ── IT DOES NOT STOP ANYTHING ───────────────────────────────────────────────
// It alerts. It has no opinion about the call it is triggered by and cannot
// refuse, delay or alter one. A spend alarm that could halt dialing would be a
// far more expensive failure than the one it guards against.

const supabase = getServiceClient('dailySpendAlarm')

/** Alert once per agent per day per threshold. Keyed so each tier fires once. */
function alertKey(userId: string, day: string, tier: number): string {
  return `daily_spend:${userId}:${day}:${tier}`
}

/**
 * Tiers, as multiples of the configured threshold.
 *
 * One alert at $3 and silence afterwards would be the wrong shape: the whole
 * point is that a runaway keeps running. $3 says look; $6 says it did not stop;
 * $12 says it is still going and nobody has intervened.
 */
const TIER_MULTIPLES = [1, 2, 4, 8]

/** ET day string, because that is the day an operator means by "today". */
function etDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
}

/**
 * Check one agent's spend so far today and alert if it has crossed a tier.
 *
 * Fire and forget from the cost webhook. Never awaited, never throws.
 */
export function checkDailySpend(userId: string | null | undefined): void {
  if (!userId) return

  void (async () => {
    try {
      const cfg = await getPlatformConfig()
      const threshold = cfg.daily_spend_alert_usd ?? 0
      if (!Number.isFinite(threshold) || threshold <= 0) return

      const day = etDay(new Date())
      // Midnight ET today, expressed as an instant.
      const since = new Date(`${day}T00:00:00-04:00`).toISOString()

      // telnyx_cost is the CARRIER's own figure, written by this same webhook.
      // Deliberately not our cost model: the alarm must fire on what was
      // actually billed, not on what we predicted would be.
      const { data, error } = await supabase
        .from('calls')
        .select('telnyx_cost')
        .eq('user_id', userId)
        .gte('created_at', since)
        .not('telnyx_cost', 'is', null)
        .limit(20000)

      if (error || !data) return

      // The lead leg's cost row is the one that carries telnyx_cost. The agent
      // leg and its twin are billed separately and are NOT in this sum, so the
      // real figure is higher than what is compared here — which makes this
      // alarm conservative. It will never cry wolf on a number that is smaller
      // than it looks.
      const spent = data.reduce((n, r) => n + Number(r.telnyx_cost ?? 0), 0)

      const tier = [...TIER_MULTIPLES].reverse().find(m => spent >= threshold * m)
      if (!tier) return

      const key = alertKey(userId, day, tier)
      const { data: already } = await supabase
        .from('ops_alert_log')
        .select('id').eq('alert_key', key).limit(1)
      if (already && already.length > 0) return

      const body =
        `ONE AGENT HAS SPENT $${spent.toFixed(2)} TODAY` +
        (tier > 1 ? ` — ${tier}x the $${threshold.toFixed(2)} alert line` : '') +
        `. At ~$0.003 a dial that is roughly ${Math.round(spent / 0.003)} calls, ` +
        `and the lead-leg figure here EXCLUDES the agent leg, so the true total is higher. ` +
        `Check Admin → Numbers → SURCHARGE and the Balance app before dialing continues.`

      await sendAdminPush('pool_capacity', body, {
        title: tier > 1 ? `Spend alarm — ${tier}x threshold` : 'Daily spend alarm',
        url: '/dashboard/admin/desktop',
      })
      await supabase.from('ops_alert_log').insert({ alert_key: key, detail: body })

      console.warn(`[dailySpendAlarm] ${userId} at $${spent.toFixed(2)} (tier ${tier}x)`)
    } catch (err) {
      // An alarm that can throw into the cost webhook would be worse than no
      // alarm: it would take the handler that records what we were charged.
      console.warn('[dailySpendAlarm] check failed', err)
    }
  })()
}
