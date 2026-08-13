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
  'voicemail_message_id',
  'enable_appointments_sub',
  'enable_not_interested_sub',
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
          updates.predictive_lines_per_agent = Math.max(1.0, Math.min(3.0, v))
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
        // Which saved voicemail message this campaign drops. null turns the
        // feature off for the campaign, which is the default state.
        //
        // Ownership is enforced below rather than here: a user must not be
        // able to point their campaign at someone else's recording.
        case 'voicemail_message_id': {
          if (v !== null && typeof v !== 'string') continue
          updates.voicemail_message_id = v || null
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

    // ── A CAMPAIGN MAY ONLY DROP ITS OWNER'S OWN RECORDING ────────────────
    // Without this an id from another account could be pasted in and that
    // person's voice would be left on this account's leads. The id is opaque
    // and comes from the client, so it has to be proved rather than trusted.
    if (typeof updates.voicemail_message_id === 'string') {
      const { data: owned } = await supabaseAdmin
        .from('voicemail_messages')
        .select('id')
        .eq('id', updates.voicemail_message_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (!owned) {
        return NextResponse.json(
          { success: false, error: 'That voicemail message does not exist on your account.' },
          { status: 403 }
        )
      }
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