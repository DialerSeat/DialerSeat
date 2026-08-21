import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// AN AGENT'S OWN SCRIPTS, ON ONE CAMPAIGN
//
// Agents write their own openers, rebuttals and reminders. Until now the only
// place to keep one was outside the product, which means it is not in front of
// them when the call connects.
//
// PRIVATE BY CONSTRUCTION, not by a filter. Every read and write here is
// scoped to `user_id = the caller` with no parameter that could widen it —
// there is no campaign owner path through this route at all, so there is
// nothing to get wrong later. The owner's library queries exclude
// campaign_id-bearing rows for the same reason.
//
// The campaign is verified to be one the caller can actually reach before a
// script is attached to it. Not because a stray script would leak anything —
// only its author can ever read it — but because a script pinned to a campaign
// they have no relationship with is a row nobody will ever see again.
// ─────────────────────────────────────────────────────────────────────────

const MAX_NAME = 100
const MAX_BODY = 20000

/** Is this campaign one the caller owns, or is on a team with? */
async function canReachCampaign(clerkId: string, campaignId: string): Promise<boolean> {
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign) return false
  if (campaign.user_id === clerkId) return true

  const { data: attach } = await supabaseAdmin
    .from('team_campaigns')
    .select('team_id')
    .eq('campaign_id', campaignId)

  const teamIds = (attach || []).map((a: any) => a.team_id).filter(Boolean)
  if (teamIds.length === 0) return false

  const { data: membership } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('user_id', clerkId)
    .eq('status', 'active')
    .in('team_id', teamIds)
    .limit(1)
    .maybeSingle()

  return !!membership
}

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  try {
    const campaignId = req.nextUrl.searchParams.get('campaign_id') || ''
    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaign_id required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('scripts')
      .select('id, name, body, created_at, updated_at')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ success: true, scripts: data || [] })
  } catch (error: any) {
    return apiError(error, { route: 'scripts/personal:GET' })
  }
}

export async function POST(req: Request) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  try {
    const body = await req.json().catch(() => ({}))
    const campaignId = String(body?.campaignId || '')
    const name = String(body?.name || '').trim()
    const text = String(body?.body || '')

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ success: false, error: 'Give the script a name' }, { status: 400 })
    }
    if (name.length > MAX_NAME) {
      return NextResponse.json({ success: false, error: 'Name is too long' }, { status: 400 })
    }
    if (text.length > MAX_BODY) {
      return NextResponse.json({ success: false, error: 'Script is too long' }, { status: 400 })
    }

    if (!(await canReachCampaign(userId, campaignId))) {
      return NextResponse.json({ success: false, error: 'Not your campaign' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('scripts')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        // Left null deliberately. A team_id would put this row inside the
        // owner's team-scripts query, which is exactly what must not happen.
        team_id: null,
        name,
        body: text,
      })
      .select('id, name, body, created_at, updated_at')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, script: data })
  } catch (error: any) {
    return apiError(error, { route: 'scripts/personal:POST' })
  }
}

export async function PATCH(req: Request) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  try {
    const body = await req.json().catch(() => ({}))
    const id = String(body?.id || '')
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (body?.name !== undefined) {
      const name = String(body.name).trim()
      if (!name) return NextResponse.json({ success: false, error: 'Give the script a name' }, { status: 400 })
      if (name.length > MAX_NAME) return NextResponse.json({ success: false, error: 'Name is too long' }, { status: 400 })
      updates.name = name
    }
    if (body?.body !== undefined) {
      const text = String(body.body)
      if (text.length > MAX_BODY) return NextResponse.json({ success: false, error: 'Script is too long' }, { status: 400 })
      updates.body = text
    }

    // user_id AND campaign_id both constrain the update: it can only ever
    // touch a personal script belonging to the caller. There is no id-only
    // path through this route.
    const { data, error } = await supabaseAdmin
      .from('scripts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .not('campaign_id', 'is', null)
      .select('id, name, body, created_at, updated_at')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, script: data })
  } catch (error: any) {
    return apiError(error, { route: 'scripts/personal:PATCH' })
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  try {
    const id = req.nextUrl.searchParams.get('id') || ''
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('scripts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .not('campaign_id', 'is', null)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ success: false, error: 'Script not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(error, { route: 'scripts/personal:DELETE' })
  }
}
