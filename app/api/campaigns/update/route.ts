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
  'voicemail_drop_url',
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

    // Same defensive fallback as campaigns/create — see
    // db/migrations/2026-08-02-add-campaigns-recording-enabled.sql for the
    // real fix. Retry without recording_enabled specifically so an edit
    // that happens to touch that field doesn't fail the WHOLE update
    // (including any other real field changes bundled in the same request)
    // just because that one column isn't there yet.
    if (error && (error as any).code === 'PGRST204' && /recording_enabled/i.test(error.message || '') && 'recording_enabled' in updates) {
      console.error('[campaigns/update] recording_enabled column missing — retrying update without it. Run db/migrations/2026-08-02-add-campaigns-recording-enabled.sql to fix permanently.')
      const { recording_enabled: _omit, ...fallbackUpdates } = updates
      if (Object.keys(fallbackUpdates).length > 0) {
        const retry = await supabaseAdmin
          .from('campaigns')
          .update(fallbackUpdates)
          .eq('id', id)
          .select()
          .single()
        data = retry.data
        error = retry.error
      }
    }

    if (error) throw error

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    return apiError(error, { route: 'campaigns/update' })
  }
}