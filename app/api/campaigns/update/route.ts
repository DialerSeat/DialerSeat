import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
const VALID_STATUSES = ['active', 'inactive'] as const

// ── PREDICTIVE IS RESTORED. THE WITHDRAWAL WAS BASED ON A BAD QUERY ───────
// It was withdrawn on this finding: "138 fan-out calls, 35 answered, 7 of them
// human, ZERO bridged — by our own bridged_at and by Telnyx's call.bridged
// webhook alike. Every one of those humans answered and heard silence."
//
// The first half was true and the second half was not. `bridged_at` really was
// never written for fan-out. But the check for Telnyx's own webhook only
// looked at call_events.event_type, and this route files an unrecognised event
// under event_type 'unhandled' with the REAL Telnyx type in `status`. Every
// call.bridged for a fan-out leg was sitting in that column, invisible to the
// query that declared them missing.
//
// Read from the right column, over 30 days of fan-out:
//
//     answered fan-out calls                       137
//     with a Telnyx call.bridged                   136
//     with an agent leg attached                   136
//     talk seconds, median / mean / max        11 / 12.1 / 69
//     answered with zero talk time                   0
//
// Nobody heard nineteen seconds of silence. The bridge worked; only our record
// of it was missing. §1m again — a column we populate is not the carrier's
// state — except this time the mistake ran the other way and withdrew a
// working feature for a week.
//
// ── WHAT IS ACTUALLY WRONG WITH PREDICTIVE IS THE COST, NOT THE AUDIO ────
// Every fan-out line places its OWN agent leg: 525 lines over 30 days produced
// 525 distinct agent legs. The agent leg bills on two connections, so a
// predictive connect costs about double an agent-attended one, and N lines
// means N agent legs rather than one the agent already holds.
//
// That is the next fix and it is a real one, but it is a cost problem on a
// working feature, not a reason to keep the menu item hidden. See
// docs/COST-FINDINGS.md §1ae.
const WITHDRAWN_MODES = new Set<string>([])

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
  // 16 CFR 310.4(b)(4)(iii). Without BOTH of these a campaign cannot lawfully
  // run more than one predictive line, and lib/predictiveController holds it
  // at one. They are per campaign because the rule names "the seller on whose
  // behalf the call was placed", and DialerSeat is not the seller.
  'tsr_seller_name',
  'tsr_callback_number',
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
        case 'tsr_seller_name': {
          if (v !== null && typeof v !== 'string') continue
          updates.tsr_seller_name = (v || '').trim() || null
          break
        }
        case 'tsr_callback_number': {
          if (v !== null && typeof v !== 'string') continue
          // Stored as typed. buildTsrAbandonMessage does the normalising and
          // REFUSES anything short of ten digits, so a half-entered number
          // holds the campaign at one line rather than being silently
          // rounded into something that announces the wrong callback.
          updates.tsr_callback_number = (v || '').trim() || null
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