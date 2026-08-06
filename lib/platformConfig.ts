import { getServiceClient } from '@/lib/supabase'

// =============================================================================
// PLATFORM CONFIG — one place for operational levers
// =============================================================================
// Every operational knob in this app used to live somewhere different: a module
// constant (HARD_LINE_CAP, DEFAULT_DAILY_CAP), an env var, a per-campaign
// column, or nowhere at all. That scattering is not a tidiness problem, it is
// the direct cause of failures that stayed invisible:
//
//   - Recording ran enabled on every campaign because the default was a
//     literal duplicated across three insert paths.
//   - AMD suppressed 91% of machine detections because its threshold was a
//     constant buried in a webhook handler, with nothing surfacing the effect.
//   - Pool capacity was a per-number column with no aggregate view, so
//     "every user is about to get 'no numbers available'" was unobservable.
//
// One row, one accessor, no deploy needed to change a lever.
//
// FAIL-SAFE DEFAULTS: if this table cannot be read, callers get the same
// defaults the code shipped with rather than an exception. A settings lookup
// failing must never take the dialer down — that would make the reliability
// layer the least reliable thing in the system.
// =============================================================================

export interface PlatformConfig {
  /** Global override. false = AMD off everywhere regardless of campaign. */
  amd_enabled_global: boolean
  /** Global override. false = recording off everywhere regardless of campaign. */
  recording_enabled_global: boolean
  /** true = ratio automation and manual buys refuse to purchase. */
  number_buying_frozen: boolean
  /** Ceiling applied on top of each campaign's predictive_lines_per_agent. */
  predictive_line_ceiling: number
  /** Dialer call-status poll cadence, ms. */
  poll_interval_ms: number
  /** Dialer hangup-detection poll cadence, ms. */
  hangup_poll_interval_ms: number
  /** Pool utilisation % that counts as "about to run out of caller IDs". */
  pool_capacity_alert_pct: number
  /** Minutes without call_events (while calls exist) before alerting. */
  webhook_silence_minutes: number
  /** Agent-leg refusals in the window before alerting. */
  agent_leg_refusal_alert_count: number
  /**
   * The carrier's account-level concurrent call limit, mirrored for DISPLAY.
   *
   * Nothing enforces this — see lib/concurrency.ts for why the enforcement was
   * removed. It exists so the Live Ops gauge has a ceiling to draw against,
   * and should be updated to match whatever Telnyx actually allows.
   */
  concurrency_budget: number

  // ── ANSWERING MACHINE DETECTION ─────────────────────────────────────────
  // Detector choice and tuning live here rather than in code because both
  // change the carrier bill, and that is an account-owner decision.
  /** Telnyx detector. 'greeting_end' is standard; 'premium' costs ~2.5x. */
  amd_detector: string
  /** Send answering_machine_detection_config with the dial. */
  amd_tuning_enabled: boolean
  /** Max listen time before returning not_sure (which does not hang up). */
  amd_total_analysis_ms: number
  /** Silence after speech before the greeting counts as ended. */
  amd_after_greeting_silence_ms: number
}

export const PLATFORM_CONFIG_DEFAULTS: PlatformConfig = {
  amd_enabled_global: true,
  recording_enabled_global: true,
  number_buying_frozen: false,
  predictive_line_ceiling: 5,
  poll_interval_ms: 1500,
  hangup_poll_interval_ms: 2000,
  pool_capacity_alert_pct: 80,
  webhook_silence_minutes: 20,
  agent_leg_refusal_alert_count: 1,
  // The Telnyx account-level outbound concurrent call limit. Display only.
  concurrency_budget: 10,
  // Standard detector, tuned. Premium is 2.5x the per-leg cost and the
  // failure it fixes is fixable here for nothing.
  amd_detector: 'greeting_end',
  amd_tuning_enabled: true,
  amd_total_analysis_ms: 6000,
  amd_after_greeting_silence_ms: 1600,
}

const CONFIG_COLUMNS =
  'amd_enabled_global, recording_enabled_global, number_buying_frozen, ' +
  'predictive_line_ceiling, poll_interval_ms, hangup_poll_interval_ms, ' +
  'pool_capacity_alert_pct, webhook_silence_minutes, agent_leg_refusal_alert_count, ' +
  'concurrency_budget, amd_detector, amd_tuning_enabled, ' +
  'amd_total_analysis_ms, amd_after_greeting_silence_ms'

// Cached per process. These are read on hot paths (every dial consults the AMD
// and recording overrides), and the values change by human action at most a few
// times a day — so a short TTL is plenty and keeps the dial path from adding a
// query per call.
let cached: { value: PlatformConfig; at: number } | null = null
const CACHE_TTL_MS = 30_000

export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  try {
    const supabase = getServiceClient('platformConfig')
    const { data, error } = await supabase
      .from('platform_config')
      .select(CONFIG_COLUMNS)
      .eq('id', 1)
      .maybeSingle()

    if (error || !data) {
      // Missing row or unreadable table — ship defaults rather than throwing.
      // A settings lookup must not be able to stop calls being placed.
      if (error) console.error('[platformConfig] read failed, using defaults:', error.message)
      cached = { value: PLATFORM_CONFIG_DEFAULTS, at: Date.now() }
      return PLATFORM_CONFIG_DEFAULTS
    }

    const value: PlatformConfig = {
      ...PLATFORM_CONFIG_DEFAULTS,
      ...(data as Partial<PlatformConfig>),
    }
    cached = { value, at: Date.now() }
    return value
  } catch (err) {
    console.error('[platformConfig] read threw, using defaults:', err)
    return PLATFORM_CONFIG_DEFAULTS
  }
}

/** Drop the cache so the next read is fresh. Call after a settings write. */
export function invalidatePlatformConfig(): void {
  cached = null
}

/**
 * Resolve a campaign-level boolean against its global override.
 *
 * The globals are OVERRIDES, not defaults: true means "respect the campaign",
 * false means "off everywhere". Expressed this way so flipping a switch during
 * an incident cannot silently rewrite what each tenant chose — turn it back on
 * and every campaign returns to its own setting, untouched.
 */
export function resolveWithGlobal(campaignValue: boolean, globalEnabled: boolean): boolean {
  return globalEnabled && campaignValue
}
