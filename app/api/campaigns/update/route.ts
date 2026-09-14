import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
const VALID_STATUSES = ['active', 'inactive'] as const

// ── PREDICTIVE IS WITHDRAWN UNTIL IT BRIDGES ─────────────────────────────
// Predictive does not connect anybody. A fan-out line is placed with nobody
// attached, and the only code that would bridge an agent onto it —
// bridgeAgentOntoLead, called from the AMD verdict in app/api/calls/events —
// sits inside `if (!callRow.dial_group_id)`. A fan-out call is DEFINED by
// having a dial_group_id, so that branch excludes every call that needs it.
//
// Measured 14 Sept: 138 fan-out calls, 35 answered, 7 of them human, ZERO
// bridged — by our own bridged_at and by Telnyx's call.bridged webhook alike,
// against 80 of 80 for agent-attended dials. Every one of those humans
// answered and heard silence for about nineteen seconds. An operator
// independently reported the same thing as "goes silent on pickup".
//
// That is an abandoned call in the sense the FTC means it, it burns the lead,
// and it is the fastest way to get a number marked as spam — which costs
// answer rate on every other number in the pool.
//
// Blocked here rather than in the dialer because this is where it gets
// chosen. A subscriber selected it nine minutes after signing up, was moved
// off it, and selected it again thirty-five seconds later; no amount of
// changing the data holds while the menu still offers it.
//
// DELETE THIS AND RESTORE THE MODE once the bridge is fixed and a fan-out
// call has been observed reaching call.bridged.
const WITHDRAWN_MODES = new Set(['predictive'])

const ALLOWED_FIELDS = [
  'name',
  'status',
  'dialer_mode',
  'amd_enabled',
  'recording_enabled',
  'predictive_lines_per_agent',
  'dial_repeat_count',
  'voicemail_drop_url',
  'enable_appointments_sub',
  'enable_not_interested_sub',
  'enable_voicemail_sub',
  // A vendor handing a list to closers they do not employ needs the numbers to
  // stay put. Owner-settable per campaign; enforced on every read path.
  'mask_lead_numbers',
  // Workflow only — the stored dialer_mode still governs the call path.
  'agent_picks_mode',
  'conversion_dispositions',
] as const

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, ...rest } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: 'Campaign id required' }, { status: 400 })
    }

    if (id.includes(':')) {
      return NextResponse.json(
        { success: false, error: 'Cannot update a virtual sub-campaign. Update the parent instead.' },
        { status: 400 }
      )
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, any> = {}

    for (const field of ALLOWED_FIELDS) {
      if (!(field in rest)) continue
      const v = rest[field]

      switch (field) {
        case 'name': {
          if (typeof v !== 'string' || !v.trim()) continue
          updates.name = v.trim()
          break
        }
        case 'status': {
          if (!VALID_STATUSES.includes(v)) continue
          updates.status = v
          break
        }
        case 'dialer_mode': {
          if (!VALID_MODES.includes(v)) continue
          // A withdrawn mode is downgraded rather than ignored. Skipping the
          // field would leave a campaign already on predictive sitting there,
          // which is the exact state this exists to end.
          updates.dialer_mode = WITHDRAWN_MODES.has(v) ? 'progressive' : v
          break
        }
        case 'amd_enabled': {
          if (typeof v !== 'boolean') continue
          updates.amd_enabled = v
          break
        }
        case 'recording_enabled': {
          if (typeof v !== 'boolean') continue
          updates.recording_enabled = v
          break
        }
        case 'predictive_lines_per_agent': {
          if (typeof v !== 'number') continue
          // Whole lines only, capped at the same 5 the claim RPC enforces.
          // See lib/predictiveController.ts for why a fraction here meant
          // predictive quietly ran at one line.
          updates.predictive_lines_per_agent = Math.max(1, Math.min(5, Math.round(v)))
          break
        }
        case 'dial_repeat_count': {
          if (typeof v !== 'number') continue
          updates.dial_repeat_count = Math.max(1, Math.min(3, Math.round(v)))
          break
        }
        case 'voicemail_drop_url': {
          if (v !== null && typeof v !== 'string') continue
          updates.voicemail_drop_url = v || null
          break
        }
        case 'enable_appointments_sub': {
          if (typeof v !== 'boolean') continue
          updates.enable_appointments_sub = v
          break
        }
        case 'enable_not_interested_sub': {
          if (typeof v !== 'boolean') continue
          updates.enable_not_interested_sub = v
          break
        }
        case 'enable_voicemail_sub': {
          if (typeof v !== 'boolean') continue
          updates.enable_voicemail_sub = v
          break
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }


    let { data, error } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    // Same defensive fallback as campaigns/create — see the migrations in
    // db/migrations for the real fixes. Extract whichever column name the
    // error actually names and retry once without just that field, so an
    // edit that happens to touch a not-yet-migrated column doesn't fail
    // the WHOLE update (including any other real field changes bundled in
    // the same request).
    let updateRetryAttempts = 0
    let updatesForRetry = updates
    while (error && (error as any).code === 'PGRST204' && updateRetryAttempts < 3) {
      const missingColMatch = /Could not find the '([^']+)' column/.exec(error.message || '')
      const missingCol = missingColMatch?.[1]
      if (!missingCol || !(missingCol in updatesForRetry)) break
      console.error(`[campaigns/update] '${missingCol}' column missing, retrying update without it. Run the matching migration in db/migrations to fix permanently.`)
      const { [missingCol]: _omit, ...fallbackUpdates } = updatesForRetry
      updatesForRetry = fallbackUpdates
      if (Object.keys(updatesForRetry).length === 0) break
      const retry = await supabaseAdmin
        .from('campaigns')
        .update(updatesForRetry)
        .eq('id', id)
        .select()
        .single()
      data = retry.data
      error = retry.error
      updateRetryAttempts++
    }

    if (error) throw error

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    return apiError(error, { route: 'campaigns/update' })
  }
}