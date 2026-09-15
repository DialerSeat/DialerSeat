import { getServiceClient } from '@/lib/supabase'
import { getPlatformConfig } from '@/lib/platformConfig'

const supabase = getServiceClient('destinationRates')

// =============================================================================
// DESTINATION RATES — not every US number costs the same to call
// =============================================================================
// Nothing in this platform knew that until 15 Sept. Measured from Telnyx's own
// call.cost webhooks: 71.5% of spend at the $0.002 base rate, 23.7% at $0.005,
// and 4.1% at $0.07 — thirty-five times base. Two exchanges accounted for that
// last slice across five calls, and one voicemail cost fourteen cents.
//
// This is rural high-cost termination. Certain US carriers levy inflated access
// fees, the carrier passes them through, and it is entirely legitimate. It is
// also entirely avoidable in aggregate, by not dialing those exchanges twice.
//
// ── LEARNED, NOT CONFIGURED ───────────────────────────────────────────────
// There is no rate deck to load and no vendor file to keep current. Every
// call.cost webhook carries the rate that call was billed at, so the table
// builds itself out of traffic that already happened. The consequence is that
// it can never protect the FIRST call to an exchange — only the second. That is
// the correct trade: a guess that refuses a dial is worse than a fact that
// arrives one call late.
//
// ── IT MUST FAIL OPEN, LIKE EVERYTHING ELSE ON THIS PATH ─────────────────
// lib/concurrency.ts is the cautionary tale: a guard that could refuse, built
// on a sentinel that meant something else, and within five minutes of a session
// it was refusing every dial while the carrier still had capacity. "A guard
// that is wrong in the restrictive direction is worse than no guard."
//
// So: any error, any missing config, any unparseable number — dial. The guard
// only ever fires on a positive, corroborated finding about a specific
// exchange, and the operator can disable it entirely by setting
// max_destination_rate to 0 without a deploy.
// =============================================================================

/** NPA-NXX, or null if this is not a dialable North American number. */
export function npanxxOf(phone: string | null | undefined): string | null {
  const d = (phone ?? '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) return d.slice(1, 7)
  if (d.length === 10) return d.slice(0, 6)
  return null
}

export interface RateVerdict {
  /** True only when we are confident this exchange is expensive. */
  tooExpensive: boolean
  npanxx: string | null
  observedRate?: number
  ceiling?: number
  samples?: number
}

/**
 * Should this number be dialed, on cost grounds?
 *
 * Returns tooExpensive only when ALL of these hold: the guard is enabled, the
 * number parses, the exchange is already known, its worst observed rate meets
 * the ceiling, and it has been seen at least the configured number of times.
 * Every other outcome — including every failure — permits the dial.
 */
export async function checkDestinationRate(phone: string): Promise<RateVerdict> {
  const npanxx = npanxxOf(phone)
  if (!npanxx) return { tooExpensive: false, npanxx: null }

  try {
    const cfg = await getPlatformConfig()
    const ceiling = Number(cfg.max_destination_rate)
    // Zero, negative or unset disables the guard outright. Deliberately checked
    // before the query so a disabled guard costs nothing per dial.
    if (!Number.isFinite(ceiling) || ceiling <= 0) {
      return { tooExpensive: false, npanxx }
    }
    const minSamples = Math.max(1, Number(cfg.max_rate_min_samples) || 2)

    const { data, error } = await supabase
      .from('destination_rates')
      .select('max_rate, samples')
      .eq('npanxx', npanxx)
      .maybeSingle()

    if (error || !data) return { tooExpensive: false, npanxx }

    const rate = Number(data.max_rate)
    const samples = Number(data.samples) || 0
    const tooExpensive =
      Number.isFinite(rate) && rate >= ceiling && samples >= minSamples

    return { tooExpensive, npanxx, observedRate: rate, ceiling, samples }
  } catch (err) {
    console.warn('[rates] lookup failed, permitting dial:', err)
    return { tooExpensive: false, npanxx }
  }
}

/**
 * Remember what a destination cost. Called from the call.cost webhook.
 *
 * Records the WORST rate ever seen for an exchange rather than an average: an
 * exchange that charged $0.07 once will do it again, and averaging it against a
 * cheap majority would bury exactly what this exists to surface. Never throws.
 */
export async function recordDestinationRate(
  phone: string | null | undefined,
  rate: number | null | undefined,
  cost: number | null | undefined
): Promise<void> {
  if (!phone || !rate || !(rate > 0)) return
  try {
    await supabase.rpc('record_destination_rate', {
      p_phone: phone,
      p_rate: rate,
      p_cost: cost ?? 0,
    })
  } catch (err) {
    console.warn('[rates] could not record destination rate:', err)
  }
}
