import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { isCallableNow } from '@/lib/callingWindow'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// LEADS NEXT-BATCH — atomic multi-lead claim
// =============================================================================
// HTTP wrapper around the SQL function claim_next_leads_for_campaign().
//
// The controller calls the SQL function directly (faster). This endpoint
// exists for two reasons:
//   1. Debugging — you can curl it to see if claim logic is working
//   2. Future features — anything that needs "give me N leads, no double-dial"
//      can hit this instead of duplicating the controller's logic
//
// Request:
//   POST /api/leads/next-batch
//   Body: { campaign_id: uuid, count: 1-5, session_id?: uuid }
//
// Response:
//   { leads: [...], claimed_count, skipped_tcpa: number }
//
// Behavior:
//   - Atomically claims up to `count` leads via the SQL function
//   - Filters out leads outside TCPA window (releases their claim)
//   - Returns the callable leads
//
// SECURITY:
//   - Caller must own the campaign (campaigns.user_id = clerk_id)
//     OR be a member of a team that has access to it
//   - For solo testing, owning the campaign is enough
// =============================================================================

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

    // Verify caller has access to this campaign.
    // Solo agent case: they own it (campaigns.user_id = clerk_id).
    // Team case: they're a member of a team that owns it. (For Part B we
    // only support solo + owner. Team-member access can come later.)
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, user_id, dialer_mode')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ error: 'campaign not found' }, { status: 404 })
    }

    if (campaign.user_id !== clerkId) {
      // TODO: extend with team-member check when we ship multi-agent teams
      return NextResponse.json(
        { error: 'not authorized for this campaign' },
        { status: 403 }
      )
    }

    // ── Claim leads atomically via the SQL function ────────────────────
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

    // ── Filter by TCPA window ──────────────────────────────────────────
    // The SQL function doesn't run JS callingWindow logic, so we filter
    // here. Leads outside their local 8am-9pm window get their claim
    // released so they're available for next-window callers.
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

    // Release blocked leads in parallel
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