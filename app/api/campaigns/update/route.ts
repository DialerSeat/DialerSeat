import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
const VALID_STATUSES = ['active', 'inactive'] as const

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
          updates.dialer_mode = v
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
      console.error(`[campaigns/update] '${missingCol}' column missing — retrying update without it. Run the matching migration in db/migrations to fix permanently.`)
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