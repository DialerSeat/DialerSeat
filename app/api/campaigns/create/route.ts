import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
type DialerMode = typeof VALID_MODES[number]

export async function POST(req: Request) {
  try {
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, dialer_mode, amd_enabled, recording_enabled, predictive_lines_per_agent, dial_repeat_count, voicemail_drop_url } = body

    // ── A CAMPAIGN MUST BE NAMED ─────────────────────────────────────────
    // This used to invent one: Untitled, then Untitled (1), (2), and so on.
    // It meant nobody was ever stopped, and the platform filled up with
    // campaigns nobody could tell apart -- three of the busiest lists here are
    // called "Untitled", including one with 4,363 leads in it. Every screen
    // that groups by campaign, every analytics comparison, and every
    // conversation about which list is worth dialing got harder because of a
    // default that existed to avoid one moment of friction at creation.
    //
    // Refused rather than defaulted. The caller knows what this list is; the
    // server never will.
    const finalName = (typeof name === 'string' ? name.trim() : '')
    if (!finalName) {
      return NextResponse.json(
        { success: false, error: 'Name your campaign before saving it.' },
        { status: 400 }
      )
    }
    // "Untitled" is refused explicitly too. Otherwise the old default simply
    // becomes something people type to get past the check, and the problem
    // returns wearing the same word.
    if (/^untitled(\s*\(\d+\))?$/i.test(finalName)) {
      return NextResponse.json(
        { success: false, error: 'Give the campaign a real name, not "Untitled".' },
        { status: 400 }
      )
    }
    if (finalName.length > 120) {
      return NextResponse.json(
        { success: false, error: 'Campaign name is too long (120 characters max).' },
        { status: 400 }
      )
    }

    // Progressive is the house default for a new campaign, and the column
    // default in db/schema.sql now matches it. It is what almost every
    // subscriber actually runs: 13 of the 16 campaigns on the platform are
    // progressive, against two power and one predictive.
    //
    // The comment here used to describe this as a sandbox-only divergence
    // from a production route that defaulted to 'power'. There is no such
    // second route -- this is the only campaign insert path in the codebase.
    // ── PREDICTIVE IS WITHDRAWN UNTIL IT BRIDGES ──────────────────────────
    // Predictive does not connect anybody. A fan-out line is placed with
    // nobody attached, and the only code that would bridge an agent onto it —
    // bridgeAgentOntoLead, called from the AMD verdict in
    // app/api/calls/events — sits inside `if (!callRow.dial_group_id)`. A
    // fan-out call is DEFINED by having a dial_group_id, so that branch
    // excludes every call that needs it.
    //
    // Measured 14 Sept: 138 fan-out calls, 35 answered, 7 of them human, ZERO
    // bridged — by our bridged_at and by Telnyx's call.bridged webhook alike,
    // against 80 of 80 for agent-attended dials. Those humans answered and
    // heard silence for about nineteen seconds each. An operator independently
    // reported it as "goes silent on pickup".
    //
    // Requests for it are downgraded here rather than rejected: a new
    // subscriber picking it from a menu should get a working dialer, not an
    // error. The mode is still in VALID_MODES so nothing else has to change
    // when it comes back.
    //
    // DELETE THIS once the bridge is fixed and a fan-out call has been seen
    // reaching call.bridged.
    // ── THE PREDICTIVE DOWNGRADE IS GONE ──────────────────────────────────
    // This rewrote every request for 'predictive' into 'progressive', on the
    // evidence recorded here: measured 14 Sept, 138 fan-out calls, 35
    // answered, ZERO bridged -- prospects answering to silence.
    //
    // That zero was a measurement artifact. The same 138 calls on the same day
    // now read 35 of 35 answered calls bridged, and the days either side show
    // 64 of 65 and 37 of 37. bridged_at simply was not being written when that
    // check was run, so the query found nothing and the conclusion followed.
    //
    // The effect while it stood: nobody on the platform could create a
    // predictive campaign. They asked for one, got progressive, and nothing
    // told them. Removed from BOTH create paths in the same change, because
    // two routes disagreeing about what 'predictive' means is its own bug.
    const mode: DialerMode = dialer_mode && VALID_MODES.includes(dialer_mode)
      ? dialer_mode
      : 'progressive'

    // Was `progressive || predictive`. Predictive can no longer reach here,
    // so the second test is dead — restore it with the mode.
    const amdDefault = mode === 'progressive'
    const amdEnabled = typeof amd_enabled === 'boolean' ? amd_enabled : amdDefault
    // ── RECORDING DEFAULTS ON ─────────────────────────────────────────────
    // It was opt-in, and in practice that meant off: 17 of 21 campaigns on the
    // platform had never turned it on, so a team owner who wanted to hear how
    // an agent sounded had nothing to listen to. A recording that was not made
    // cannot be made later, which is what makes this the wrong default to
    // leave to a checkbox nobody finds.
    //
    // Explicit false still wins, and the platform-wide kill switch
    // (platform_config.recording_enabled_global) still overrides everything —
    // resolveWithGlobal only ever turns things OFF, so that switch remains the
    // way to stop recording everywhere in seconds without touching a campaign.
    //
    // WHAT THIS COSTS, since it is not only the recording line. AMD is what
    // decides whether to record, so enabling recording on a campaign also runs
    // detection on every dial from it (see amdOnDial in placeOutboundCall).
    // Detection is billed per leg answered or not, and it is the cost that
    // scales with dialing rather than with talk time.
    //
    // TWO-PARTY CONSENT is a real exposure and does not go away because the
    // default changed. It now rests on the disclosure the agent gives and on
    // the compliance surface, not on most campaigns happening to be off.
    const recordingEnabled = typeof recording_enabled === 'boolean' ? recording_enabled : true

    // Whole lines only — see lib/predictiveController.ts. A fractional value
    // gets floored downstream, so 1.5 was silently one line and predictive
    // dialed at progressive's rate. 3 is the default an agent would expect
    // from a mode whose entire purpose is dialing more than one at a time.
    let lines = 3
    if (typeof predictive_lines_per_agent === 'number') {
      lines = Math.max(1, Math.min(5, Math.round(predictive_lines_per_agent)))
    }

    // How many times a lead should be dialed in a row before being set
    // aside, 1x/2x/3x — hard-capped at 3 regardless of what's sent, since
    // that's a firm rule regardless of client input.
    let dialRepeatCount = 1
    if (typeof dial_repeat_count === 'number') {
      dialRepeatCount = Math.max(1, Math.min(3, Math.round(dial_repeat_count)))
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      name: finalName,
      status: 'active', // new campaigns are active by default
      dialer_mode: mode,
      amd_enabled: amdEnabled,
      recording_enabled: recordingEnabled,
      predictive_lines_per_agent: lines,
      dial_repeat_count: dialRepeatCount,
      voicemail_drop_url: voicemail_drop_url || null,
    }

    let { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert(insertPayload)
      .select()
      .single()

    // Defensive fallback: PGRST204 ("Could not find the '<col>' column ...
    // in the schema cache") means the DB is missing a column the code
    // expects — confirmed happening for recording_enabled in production
    // (see db/migrations/2026-08-02-add-campaigns-recording-enabled.sql)
    // and the same class of gap applies to dial_repeat_count (see
    // db/migrations/2026-08-03-add-campaigns-dial-repeat-count.sql) if that
    // migration hasn't been run yet either. Rather than hardcode a
    // separate check per column (which just means writing this same block
    // again for the next new column), extract whichever column name
    // Telnyx's error actually names and retry once without just that
    // field — campaigns can still be created either way, the affected
    // preference just won't persist until its migration runs.
    let retryAttempts = 0
    let payloadForRetry = insertPayload
    while (error && (error as any).code === 'PGRST204' && retryAttempts < 3) {
      const missingColMatch = /Could not find the '([^']+)' column/.exec(error.message || '')
      const missingCol = missingColMatch?.[1]
      if (!missingCol || !(missingCol in payloadForRetry)) break
      console.error(`[campaigns/create] '${missingCol}' column missing, retrying insert without it. Run the matching migration in db/migrations to fix permanently.`)
      const { [missingCol]: _omit, ...fallbackPayload } = payloadForRetry
      payloadForRetry = fallbackPayload
      const retry = await supabaseAdmin
        .from('campaigns')
        .insert(payloadForRetry)
        .select()
        .single()
      data = retry.data
      error = retry.error
      retryAttempts++
    }

    if (error) throw error

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    return apiError(error, { route: 'campaigns/create' })
  }
}