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
  /** Telnyx detector. 'detect' and 'greeting_end' are standard; 'premium' costs ~2.5x. */
  amd_detector: string
  /** Send answering_machine_detection_config with the dial. */
  amd_tuning_enabled: boolean
  /** Max listen time before returning not_sure (which does not hang up). */
  amd_total_analysis_ms: number
  /** Silence after speech before the greeting counts as ended. */
  amd_after_greeting_silence_ms: number
  /** Run AMD on preview dials at all. Off by default. */
  amd_in_preview: boolean
  /** Whether a machine verdict ends a call the agent is already bridged into. */
  amd_hangup_when_bridged: boolean
  /**
   * How long after answer a machine verdict is still believed, in seconds.
   *
   * The call is bridged at pickup, so a late verdict is describing a live
   * conversation rather than the greeting that opened it. 0 disables the
   * window and every verdict is acted on.
   */
  amd_max_seconds_after_answer: number
  /** Telnyx greeting_duration_millis — a greeting longer than this is a machine. */
  amd_greeting_duration_ms: number
  /** Telnyx maximum_number_of_words — more words than this is a machine. */
  amd_max_words: number
  /** Telnyx initial_silence_millis — silence before speech longer than this is a machine. */
  amd_initial_silence_ms: number
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
  // 'detect' classifies from the initial answer pattern and reports as fast as
  // it can. That is what a detector running ALONGSIDE a bridged call has to
  // do — it has to decide while the lead's greeting is still the only audio on
  // the line. 'greeting_end' waits for silence to mark the end of a greeting,
  // which on a connected call is a description of two people talking.
  // Premium is 2.5x the per-leg cost and is not in use.
  amd_detector: 'detect',
  amd_tuning_enabled: true,
  // No longer gates the bridge, so this is purely an accuracy/cost dial now.
  amd_total_analysis_ms: 3500,
  amd_after_greeting_silence_ms: 800,
  // Preview is the one mode where the agent deliberately chose this lead and
  // is watching it answer. A wrong verdict there costs more than it saves.
  amd_in_preview: false,
  // Voicemail skipping is why AMD exists; keep it, now that preview is out.
  amd_hangup_when_bridged: true,
  // Five seconds covers every machine verdict actually observed in production
  // (1.76s to 3.95s across thirteen real voicemails) with room to spare, while
  // still refusing to hang up on a call that has been live long enough for
  // someone to be mid-sentence.
  amd_max_seconds_after_answer: 5,
  // Telnyx defaults are 3500 / 5 / 3500, and the first two are what produced
  // a 100% false-positive rate: five words is fewer than most people say when
  // they answer, and 3.5s is shorter than a normal sentence. A real voicemail
  // greeting runs 8-15s and 25+ words, so these still separate the two.
  amd_greeting_duration_ms: 7000,
  amd_max_words: 15,
  amd_initial_silence_ms: 4000,
}

const CONFIG_COLUMNS =
  'amd_enabled_global, recording_enabled_global, number_buying_frozen, ' +
  'predictive_line_ceiling, poll_interval_ms, hangup_poll_interval_ms, ' +
  'pool_capacity_alert_pct, webhook_silence_minutes, agent_leg_refusal_alert_count, ' +
  'concurrency_budget, amd_detector, amd_tuning_enabled, ' +
  'amd_total_analysis_ms, amd_after_greeting_silence_ms, ' +
  'amd_in_preview, amd_hangup_when_bridged, amd_max_seconds_after_answer, ' +
  'amd_greeting_duration_ms, amd_max_words, amd_initial_silence_ms'

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
