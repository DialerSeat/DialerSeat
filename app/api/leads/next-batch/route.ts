import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { isCallableNow } from '@/lib/callingWindow'

const supabase = getServiceClient('leads/next-batch')

interface ClaimedLead {
  id: string
  campaign_id: string
  user_id: string
  phone: string
  state: string | null
  first_name: string
  last_name: string
  city: string | null
  status: string
  dial_attempts: number
  extra_data: any
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
    const requestedCount = body.count
    const sessionId = body.session_id

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }
    if (typeof requestedCount !== 'number' || !Number.isInteger(requestedCount)) {
      return NextResponse.json({ error: 'count must be integer' }, { status: 400 })
    }
    if (requestedCount < 1 || requestedCount > 5) {
      return NextResponse.json({ error: 'count must be 1-5' }, { status: 400 })
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, user_id, dialer_mode')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ error: 'campaign not found' }, { status: 404 })
    }

    if (campaign.user_id !== clerkId) {

      return NextResponse.json(
        { error: 'not authorized for this campaign' },
        { status: 403 }
      )
    }

    const { data: claimed, error: claimErr } = await supabase.rpc(
      'claim_next_leads_for_campaign',
      {
        p_campaign_id: campaignId,
        p_session_id: sessionId || null,
        p_count: requestedCount,
      }
    )

    if (claimErr) {
      console.error('[next-batch] claim failed', claimErr)
      return NextResponse.json(
        { error: 'claim failed', detail: claimErr.message },
        { status: 500 }
      )
    }

    const claimedLeads = (claimed || []) as ClaimedLead[]

    const callable: ClaimedLead[] = []
    const blocked: string[] = []

    for (const lead of claimedLeads) {
      const check = isCallableNow({
        phone: lead.phone,
        state: lead.state,
      })
      if (check.allowed) {
        callable.push(lead)
      } else {
        blocked.push(lead.id)
      }
    }

    if (blocked.length > 0) {
      await Promise.allSettled(
        blocked.map(leadId =>
          supabase.rpc('release_lead_claim', { p_lead_id: leadId })
        )
      )
    }

    return NextResponse.json({
      leads: callable,
      claimed_count: callable.length,
      requested_count: requestedCount,
      skipped_tcpa: blocked.length,
      campaign_id: campaignId,
    })
  } catch (err: unknown) {
    console.error('[next-batch] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}