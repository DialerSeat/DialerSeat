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
  /** Days a failed seat charge keeps being retried. The seat is suspended the
   *  moment it fails, so this is only about recovery — not free access. */
  seat_retry_days: number
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
   * Place the agent's leg WHEN THE LEAD ANSWERS rather than alongside the dial.
   *
   * Both legs normally go out together so Telnyx can bridge them at pickup,
   * which is what makes an answered call open without dead air. The price is an
   * agent leg live for the whole time the lead's phone rings — on every dial,
   * including the roughly two thirds nobody answers. Measured on the clean
   * evening of 14 Sept: 317 such legs, 176 billed minutes, 17% of that
   * session's entire carrier spend, buying nothing.
   *
   * IT MOVES WHERE FAILURE LANDS, which is why it is a switch. Today a dead
   * agent socket fails before the lead's phone rings and nobody is disturbed.
   * With this on, the lead answers first and the agent is discovered
   * unreachable afterwards — an abandoned call in the sense the FTC means it.
   * Turn it off the moment abandoned calls move.
   */
  dial_agent_on_answer: boolean
  /** Spoken to the lead while the agent leg comes up. Empty plays nothing. */
  connecting_message: string
  /**
   * Refuse to dial an exchange whose observed rate meets or exceeds this.
   *
   * Not every US number costs the same. Measured 15 Sept from Telnyx's own
   * call.cost records: 71.5% of spend at the $0.002 base rate, 23.7% at
   * $0.005, and 4.1% at $0.07 — two exchanges, five calls, thirty-five times
   * base. Rural high-cost termination, passed through legitimately.
   *
   * $0.01 sits deliberately clear of the $0.005 tier: blocking that would
   * refuse a quarter of the list to save 2.5× on calls still costing fractions
   * of a cent. 0 disables the guard with no deploy.
   */
  max_destination_rate: number
  /** Times an exchange must be seen at a high rate before it is refused. */
  max_rate_min_samples: number
  /**
   * Consecutive machine-answered dials after which a number is retired.
   *
   * Every answered call bills a 60-second minimum on both halves plus AMD,
   * whoever picks up. 54% of everything that answers here is a machine, so
   * about a quarter of carrier spend buys voicemail greetings, and the floor
   * fires at answer — nothing afterwards reduces it.
   *
   * The threshold is configuration rather than a constant on purpose. Early
   * data (205/82/54 samples) puts the chance of another machine at 66%, 71%,
   * 70% — it plateaus, and a ±12% band on the last figure is far too loose to
   * hardcode. Tune from real volume. 0 disables.
   */
  voicemail_streak_limit: number
  /**
   * Consecutive AGENT_LEG_FAILED dials after which an agent is told to reload.
   *
   * A dead browser socket does not stop dialing on its own — 14 Sept had one
   * agent make 41 failed dials in an hour at 1.4s each while a healthy agent
   * in the same window failed 2.7%. Each one rings a lead for a second and is
   * an abandoned call for surcharge purposes. See lib/agentSocketBreaker.ts.
   *
   * Values below 3 are ignored as too twitchy; 0 disables. This is the only
   * guard on the dial path that refuses rather than delays, which is why the
   * off switch is configuration rather than a deploy.
   */
  agent_leg_failure_limit: number
  /**
   * Alert when ONE agent's carrier spend crosses this in a single day, USD.
   *
   * Not a cost control — it stops nothing. It is a smoke alarm, and the number
   * is arithmetic rather than caution: at the rates this account should be on a
   * dial is about $0.003 (docs/COST-FINDINGS.md §0), so $3 from one agent in one
   * day is roughly a thousand calls. Nobody dials a thousand times in a day, so
   * reaching it almost certainly means a fault.
   *
   * Every fault this platform has had looked like this before anyone noticed:
   * the parked agent leg at $8.17/agent-hour for weeks, 4,341 dials in ten hours
   * against a blocked account, 41 failed dials in an hour from one dead socket.
   *
   * Re-alerts at 2x, 4x and 8x, because the failure mode is that it keeps going.
   * 0 disables.
   */
  daily_spend_alert_usd: number
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

  // ── LEG WATCHDOG (cron/leg-watchdog) ──────────────────────────────────
  /**
   * Gates the HANGUP, not the observation. False still records sightings and
   * still computes verdicts, so a dry run produces real evidence.
   */
  leg_watchdog_enabled: boolean
  /** Absolute ceiling past which any live leg is ended, whatever its row says. */
  leg_watchdog_runaway_seconds: number
  /** How long a leg with no calls row must be observed before it is ended. */
  leg_watchdog_untracked_seconds: number
  /** Grace after our row says the call ended, before ending its still-live leg. */
  leg_watchdog_finished_seconds: number

  // ── POOL SELECTION EXPERIMENT (lib/poolStrategy.ts) ────────────────
  /** Percent of dials routed to pool_experiment_arm. 0 disables it entirely. */
  pool_experiment_pct: number
  /** Strategy the experiment slice uses: rotate | balanced | locality. */
  pool_experiment_arm: string
  /** Strategy every other dial uses. 'locality' is what has always run here. */
  pool_default_strategy: string

  /**
   * Set to now() to ask every live dialer to reload its own code.
   *
   * The dialer is a long-lived page, so a client-side fix does not reach an
   * agent who is already on shift. This is how one gets pushed. Null means
   * nothing has ever been requested.
   */
  client_reload_at: string | null
}

export const PLATFORM_CONFIG_DEFAULTS: PlatformConfig = {
  amd_enabled_global: true,
  recording_enabled_global: true,
  number_buying_frozen: false,
  predictive_line_ceiling: 5,
  // Matches the constants these replaced, so an unreadable config table
  // behaves exactly as the hardcoded version did.
  seat_retry_days: 7,
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
  // FALSE is the fail-safe here, and the direction matters. If the config table
  // cannot be read, the dialer falls back to placing both legs together —
  // the behaviour that has never abandoned anybody. An unreadable settings row
  // must not be able to change who hears silence.
  dial_agent_on_answer: false,
  connecting_message: 'One moment, connecting you now.',
  // Matches the column defaults. If the config table cannot be read the guard
  // still works from these — it is built on observed facts, not on settings,
  // so a settings outage should not hand back the $0.07 exchanges.
  max_destination_rate: 0.01,
  max_rate_min_samples: 2,
  // One below the 6-dial attempt cap: an always-machine number gives up two
  // dials early while still getting a fourth chance. Set 3 for more, 0 for off.
  voicemail_streak_limit: 4,
  // Five. At the healthy 2.7% failure rate that is 1 in 700 million; at the
  // broken 70% rate it fires on the fifth dial instead of the forty-first.
  agent_leg_failure_limit: 5,
  // $3. His number, and the arithmetic supports it: ~1,000 dials at $0.003.
  daily_spend_alert_usd: 3.0,
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
  // a few seconds of a line nobody is on. Defaulting to the value the platform
  // actually runs means a config blip can no longer quietly switch compliance
  // off. Setting it to 0 in platform_config still disables the feature — this
  // changes only what happens when the setting cannot be read.
  //
  // EIGHT, not nine, from 17 Sept — owner's call. With HOLD_SPREAD_SECONDS at
  // 2.5 the hold lands on 8, 9 or 10 and never 11. It saves nothing: 60/60 PSTN
  // billing charges a full minute for any of them. It shortens how long a pool
  // number and a concurrency slot are tied up, and it keeps two seconds of
  // margin over the six-second short-duration threshold, which is the only
  // number in here that costs money if it is crossed.
  amd_hold_seconds_after_machine: 8,
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

  // ── SHIPS OFF, AND THE FALLBACK IS ALSO OFF ───────────────────────────
  // The opposite direction to amd_hold_seconds_after_machine, deliberately.
  // A failed config read there meant compliance silently stopped; a failed
  // config read HERE would mean something starts hanging up phone calls with
  // nobody having asked it to. Fail toward doing nothing.
  leg_watchdog_enabled: false,
  // 90 minutes. The longest genuinely real call on this account is 63 minutes,
  // carrier-confirmed, so this clears reality by half an hour. It is a
  // backstop for runaways, not a policy on call length.
  leg_watchdog_runaway_seconds: 5400,
  // 10 minutes with no calls row anywhere in a 12-hour window. Nothing on our
  // side can disposition it, no agent screen is pointed at it.
  leg_watchdog_untracked_seconds: 600,
  // 2 minutes after our own row says the call is over. Absorbs webhook
  // ordering without letting a stranded leg bill for long.
  leg_watchdog_finished_seconds: 120,

  // ── OFF, AND THE FALLBACK IS ALSO OFF ─────────────────────────
  // A failed config read must not silently start running an experiment on live
  // dials, so 0 here means an unreadable settings table produces exactly the
  // caller-ID selection that has always run.
  pool_experiment_pct: 0,
  pool_experiment_arm: 'rotate',
  pool_default_strategy: 'locality',
  // Null, not a date. A fallback with a timestamp in it would ask every dialer
  // on the platform to reload the moment a config read failed.
  client_reload_at: null,
}

const CONFIG_COLUMNS =
  'amd_enabled_global, recording_enabled_global, number_buying_frozen, ' +
  'predictive_line_ceiling, seat_retry_days, seat_takeover_enabled, ' +
  'poll_interval_ms, hangup_poll_interval_ms, ' +
  'pool_capacity_alert_pct, webhook_silence_minutes, agent_leg_refusal_alert_count, ' +
  'concurrency_budget, amd_detector, amd_tuning_enabled, ' +
  'amd_total_analysis_ms, amd_after_greeting_silence_ms, ' +
  'amd_in_preview, amd_hangup_when_bridged, amd_max_seconds_after_answer, ' +
  'amd_greeting_duration_ms, amd_max_words, amd_initial_silence_ms, ' +
  'amd_hold_seconds_after_machine, dial_agent_on_answer, connecting_message, ' +
  'max_destination_rate, max_rate_min_samples, voicemail_streak_limit, ' +
  'agent_leg_failure_limit, daily_spend_alert_usd, ' +
  'leg_watchdog_enabled, leg_watchdog_runaway_seconds, ' +
  'leg_watchdog_untracked_seconds, leg_watchdog_finished_seconds, ' +
  'pool_experiment_pct, pool_experiment_arm, pool_default_strategy, ' +
  'client_reload_at'

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
