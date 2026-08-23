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
  /** Days an unpaid seat keeps working before it suspends. */
  seat_grace_days: number
  /** Owner automatically picks up a seat when the agent stops self-funding. */
  seat_takeover_enabled: boolean
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
   * Seconds the LEAD's leg stays up after a call would otherwise end early —
   * an AMD machine verdict, or an agent skipping under the threshold — once
   * the agent has already advanced to the next lead.
   *
   * Exists because Telnyx surcharges connected calls of 6s or less above 15%
   * of connected calls, and a machine verdict lands at ~3.8s, so being fast
   * is what puts nearly every voicemail under their line.
   *
   * Must stay well under a typical 15-25s greeting: overrunning the beep
   * records silence and leaves a blank voicemail on every lead. 0 disables.
   * Full rule in AMD.md.
   */
  amd_hold_seconds_after_machine: number
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
  // Matches the constants these replaced, so an unreadable config table
  // behaves exactly as the hardcoded version did.
  seat_grace_days: 7,
  seat_takeover_enabled: true,
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
  // No longer gates the bridge, so this is purely an accuracy dial — but it is
  // also the CEILING on every other threshold below. A rule that triggers later
  // than this never fires at all, because analysis has already stopped.
  //
  // 6000 rather than something longer because 6000 is proven against this
  // Telnyx account; the documented maximum is not published, and an
  // out-of-range value in this block makes Telnyx reject the entire dial
  // request, which fails every call rather than merely mistuning one.
  amd_total_analysis_ms: 6000,
  amd_after_greeting_silence_ms: 800,
  // Preview is the one mode where the agent deliberately chose this lead and
  // is watching it answer. A wrong verdict there costs more than it saves.
  amd_in_preview: false,
  // Voicemail skipping is why AMD exists; keep it, now that preview is out.
  amd_hangup_when_bridged: true,
  // ── FAILS TOWARD COMPLIANCE, NOT AWAY FROM IT ────────────────────────────
  // This was 0, on the reasoning that a fallback which silently held live calls
  // open would be the worst possible default. That reasoning was backwards for
  // this particular value, and the traffic showed it.
  //
  // getPlatformConfig is cached and falls back to these shipped defaults
  // whenever the read fails. Every time that happened, holdSeconds came back 0,
  // the `if (holdSeconds > 0)` guard skipped the hold entirely, and the lead's
  // leg was torn down the instant the verdict landed — producing calls that end
  // at exactly amd_total_analysis_ms. Machine calls came back in two clean
  // buckets, 6s and 9-10s, with nothing in between: the hold either ran or was
  // silently disabled by a failed config read.
  //
  // The two failure modes are not symmetric. A missed hold is a short-duration
  // call billed against the carrier ratio at $0.01 each. An unwanted hold is
  // nine seconds of a line nobody is on. Defaulting to the value the platform
  // actually runs means a config blip can no longer quietly switch compliance
  // off. Setting it to 0 in platform_config still disables the feature — this
  // changes only what happens when the setting cannot be read.
  amd_hold_seconds_after_machine: 9,
  // A floor, not the final value: handleAmdResult raises this to at least
  // total_analysis_time + 3s so a verdict is never thrown away for arriving
  // exactly when the detector was told to produce it.
  amd_max_seconds_after_answer: 10,
  // ── THE THREE RULES THAT CONCLUDE 'MACHINE' ─────────────────────────────
  // All three must stay UNDER amd_total_analysis_ms or they never fire and the
  // detector can only ever answer human/not_sure. placeOutboundCall clamps them
  // if they drift above it; these values are chosen to sit below it honestly.
  //
  // They must also sit WELL clear of the ceiling, not merely under it. At 4000
  // against a 6000 ceiling, machine verdicts landed at 5.01s — the agent heard
  // five seconds of voicemail before the skip — and any greeting that was not
  // cleanly continuous ran past 6000 and came back 'not_sure', which never
  // hangs up. One such call sat open for 65 seconds. Both symptoms, one cause:
  // the trip threshold was too close to the ceiling to conclude in time.
  //
  //   greeting_duration_millis  A greeting longer than this is a machine.
  //                             Someone answering their own phone says "hello"
  //                             or "hello, this is Josh" — under two seconds. A
  //                             voicemail greeting is still going at three, and
  //                             concluding there leaves 3s of headroom under
  //                             the ceiling instead of 1s.
  //
  //   maximum_number_of_words   More words than this is a machine. Telnyx's
  //                             default of 5 is fewer than most people say when
  //                             they answer, which is what produced a 100%
  //                             false-positive rate. Eight still clears a human
  //                             sentence — "hi this is Josh how can I help you"
  //                             is nine — while a voicemail greeting passes it
  //                             inside three seconds.
  //
  //   initial_silence_millis    Silence before any speech this long is a
  //                             machine.
  amd_greeting_duration_ms: 3000,
  amd_max_words: 8,
  amd_initial_silence_ms: 3000,
}

const CONFIG_COLUMNS =
  'amd_enabled_global, recording_enabled_global, number_buying_frozen, ' +
  'predictive_line_ceiling, seat_grace_days, seat_takeover_enabled, ' +
  'poll_interval_ms, hangup_poll_interval_ms, ' +
  'pool_capacity_alert_pct, webhook_silence_minutes, agent_leg_refusal_alert_count, ' +
  'concurrency_budget, amd_detector, amd_tuning_enabled, ' +
  'amd_total_analysis_ms, amd_after_greeting_silence_ms, ' +
  'amd_in_preview, amd_hangup_when_bridged, amd_max_seconds_after_answer, ' +
  'amd_greeting_duration_ms, amd_max_words, amd_initial_silence_ms, ' +
  'amd_hold_seconds_after_machine'

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
