import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const VALID_ACCESS_MODES = ['owner_pays', 'agent_pays', 'public', 'free'] as const

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status })

    const body = await req.json().catch(() => ({}))
    const { teamId, campaignId, accessMode } = body

    if (!teamId || typeof teamId !== 'string' || !campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ success: false, error: 'teamId and campaignId required' }, { status: 400 })
    }
    const mode = accessMode && VALID_ACCESS_MODES.includes(accessMode) ? accessMode : 'owner_pays'

    const [{ data: team }, { data: campaign }] = await Promise.all([
      supabaseAdmin.from('teams').select('id').eq('id', teamId).maybeSingle(),
      supabaseAdmin.from('campaigns').select('id').eq('id', campaignId).maybeSingle(),
    ])
    if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })

    const { data: existing } = await supabaseAdmin
      .from('team_campaigns')
      .select('team_id')
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: false, error: 'Campaign is already attached to this team' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
      .from('team_campaigns')
      .insert({ team_id: teamId, campaign_id: campaignId, access_mode: mode })
      .select('team_id, campaign_id, access_mode, created_at')
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, teamCampaign: data })
  } catch (error: any) {
    return apiError(error, { route: 'admin/campaigns/assign-team' })
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status })

    const body = await req.json().catch(() => ({}))
    const { teamId, campaignId } = body

    if (!teamId || typeof teamId !== 'string' || !campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ success: false, error: 'teamId and campaignId required' }, { status: 400 })
    }

    // Mirror the cleanup teams/campaigns/detach performs: revoke any member
    // access granted through this attachment and drop join codes tied to it,
    // so a re-attach later doesn't inherit stale access.
    await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)
      .eq('is_active', true)

    await supabaseAdmin
      .from('team_codes')
      .delete()
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)

    const { error } = await supabaseAdmin
      .from('team_campaigns')
      .delete()
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(error, { route: 'admin/campaigns/assign-team' })
  }
}
