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

    let finalName = (typeof name === 'string' ? name.trim() : '')
    if (!finalName) {
      const { data: existing } = await supabaseAdmin
        .from('campaigns')
        .select('name')
        .eq('user_id', userId)
        .ilike('name', 'Untitled%')
      const taken = new Set((existing || []).map(c => (c.name || '').trim()))
      if (!taken.has('Untitled')) {
        finalName = 'Untitled'
      } else {
        let n = 1
        while (taken.has(`Untitled (${n})`)) n++
        finalName = `Untitled (${n})`
      }
    }

    // SANDBOX DEFAULT: progressive (per build instruction). Production's
    // equivalent route still defaults to 'power' — this divergence is
    // intentional and sandbox-only, matching most current subscribers'
    // actual mode, so Telnyx validation happens against the mode that
    // matters most first.
    const mode: DialerMode = dialer_mode && VALID_MODES.includes(dialer_mode)
      ? dialer_mode
      : 'progressive'

    const amdDefault = mode === 'progressive' || mode === 'predictive'
    const amdEnabled = typeof amd_enabled === 'boolean' ? amd_enabled : amdDefault
    // Recording defaults ON regardless of mode — matches how this app
    // always behaved before the toggle existed. Only an explicit false
    // turns it off.
    const recordingEnabled = typeof recording_enabled === 'boolean' ? recording_enabled : true

    let lines = 1.5
    if (typeof predictive_lines_per_agent === 'number') {
      lines = Math.max(1.0, Math.min(3.0, predictive_lines_per_agent))
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
      console.error(`[campaigns/create] '${missingCol}' column missing — retrying insert without it. Run the matching migration in db/migrations to fix permanently.`)
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