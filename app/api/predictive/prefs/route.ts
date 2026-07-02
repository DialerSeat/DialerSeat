import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('predictive/prefs')

const HARD_LINE_CAP = 5

interface CampaignConfig {
  id: string
  user_id: string                  // Clerk ID of campaign owner
  predictive_lines_per_agent: number
  predictive_lines_min: number
  predictive_lines_max: number
}

async function getCampaignConfig(campaignId: string): Promise<CampaignConfig | null> {
  const { data } = await supabase
    .from('campaigns')
    .select('id, user_id, predictive_lines_per_agent, predictive_lines_min, predictive_lines_max')
    .eq('id', campaignId)
    .maybeSingle()
  return data || null
}

async function resolveInternalUserId(clerkId: string): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  return data?.id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaign_id')
    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaign_id query param required' },
        { status: 400 }
      )
    }

    const internalUserId = await resolveInternalUserId(clerkId)
    if (!internalUserId) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    const campaign = await getCampaignConfig(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'campaign not found' }, { status: 404 })
    }

    const { data: pref } = await supabase
      .from('agent_predictive_prefs')
      .select('preferred_lines, set_by_owner, updated_at')
      .eq('user_id', internalUserId)
      .eq('campaign_id', campaignId)
      .maybeSingle()

    const campaignMax = Math.min(campaign.predictive_lines_max || 5, HARD_LINE_CAP)
    const campaignMin = Math.max(campaign.predictive_lines_min || 1, 1)
    const campaignDefault = campaign.predictive_lines_per_agent || 3

    let effective = pref?.preferred_lines ?? campaignDefault
    effective = Math.max(campaignMin, Math.min(effective, campaignMax))

    return NextResponse.json({
      campaign_id: campaignId,
      effective_lines: effective,
      preferred_lines: pref?.preferred_lines ?? null,    // null = using default
      set_by_owner: pref?.set_by_owner ?? false,
      updated_at: pref?.updated_at ?? null,
      campaign_default: campaignDefault,
      campaign_min: campaignMin,
      campaign_max: campaignMax,
      hard_cap: HARD_LINE_CAP,
    })
  } catch (err) {
    console.error('[predictive/prefs:GET] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }

    const campaignId = body.campaign_id
    const requestedLines = body.preferred_lines
    const targetUserId: string | undefined = body.target_user_id

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }
    if (typeof requestedLines !== 'number' || !Number.isInteger(requestedLines)) {
      return NextResponse.json({ error: 'preferred_lines must be integer' }, { status: 400 })
    }

    const campaign = await getCampaignConfig(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'campaign not found' }, { status: 404 })
    }

    const campaignMax = Math.min(campaign.predictive_lines_max || 5, HARD_LINE_CAP)
    const campaignMin = Math.max(campaign.predictive_lines_min || 1, 1)
    const clamped = Math.max(campaignMin, Math.min(requestedLines, campaignMax))

    const callerInternalId = await resolveInternalUserId(clerkId)
    if (!callerInternalId) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    let writeForUserId = callerInternalId
    let setByOwner = false

    if (targetUserId && targetUserId !== callerInternalId) {

      if (campaign.user_id !== clerkId) {
        return NextResponse.json(
          { error: 'only the campaign owner can set preferences for other agents' },
          { status: 403 }
        )
      }
      writeForUserId = targetUserId
      setByOwner = true
    }

    const now = new Date().toISOString()
    const { data: written, error: upsertErr } = await supabase
      .from('agent_predictive_prefs')
      .upsert(
        {
          user_id: writeForUserId,
          campaign_id: campaignId,
          preferred_lines: clamped,
          set_by_owner: setByOwner,
          updated_at: now,
        },
        { onConflict: 'user_id,campaign_id' }
      )
      .select('preferred_lines, set_by_owner, updated_at')
      .single()

    if (upsertErr) {
      console.error('[predictive/prefs:POST] upsert failed', upsertErr)
      return NextResponse.json({ error: 'write failed' }, { status: 500 })
    }

    return NextResponse.json({
      campaign_id: campaignId,
      effective_lines: written.preferred_lines,
      preferred_lines: written.preferred_lines,
      set_by_owner: written.set_by_owner,
      updated_at: written.updated_at,
      requested_lines: requestedLines,
      clamped: clamped !== requestedLines,
      campaign_default: campaign.predictive_lines_per_agent || 3,
      campaign_min: campaignMin,
      campaign_max: campaignMax,
      hard_cap: HARD_LINE_CAP,
    })
  } catch (err) {
    console.error('[predictive/prefs:POST] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}