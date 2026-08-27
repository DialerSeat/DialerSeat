import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/campaigns/dialer-mode')

// Kept in step with app/api/campaigns/update/route.ts. Four modes, and the
// call path reads this column directly, so an unrecognised value here does
// not degrade — it breaks dialing for that campaign.
const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
type DialerMode = (typeof VALID_MODES)[number]

// ─────────────────────────────────────────────────────────────────────────
// CHANGING SOMEBODY ELSE'S DIALER MODE
//
// The Data Explorer could already SEE every campaign belonging to any user;
// this lets support fix the single setting that most often explains "the
// dialer is behaving strangely" without asking the customer to go and find a
// dropdown while their floor is standing idle.
//
// Deliberately narrow. It takes a campaign id and a mode and touches nothing
// else — not status, not AMD, not line counts. A general-purpose "admin can
// PATCH any column on anyone's campaign" endpoint is a much larger thing to
// own, and nothing has asked for one.
//
// It also does NOT resolve the owner from the session, which is the whole
// point and the whole risk: the campaign is looked up by id and edited on
// whoever's behalf owns it. That makes requireAdmin() the only thing standing
// between this and every campaign on the platform.
//
// A running campaign is not blocked from switching. Mode is read per call
// rather than latched at start, so a change lands on the next dial — which is
// exactly the behaviour that makes this useful mid-session.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Same shape as the sibling GET: lib/admin's requireAdmin throws a Response
  // rather than returning a gate object.
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const campaignId = String(body?.campaignId ?? '').trim()
    const dialerMode = String(body?.dialerMode ?? '').trim() as DialerMode

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }
    if (!VALID_MODES.includes(dialerMode)) {
      return NextResponse.json(
        { error: `dialerMode must be one of: ${VALID_MODES.join(', ')}` },
        { status: 400 }
      )
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, user_id, dialer_mode')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.dialer_mode === dialerMode) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        dialerMode,
      })
    }

    const { error } = await supabase
      .from('campaigns')
      .update({ dialer_mode: dialerMode, updated_at: new Date().toISOString() })
      .eq('id', campaignId)

    if (error) throw error

    // Loud on purpose. Somebody's dialer behaviour changed and they did not
    // do it — if they ask why later, this line is the answer.
    console.warn(
      `[admin/dialer-mode] ${campaign.name} (${campaignId}) owned by ${campaign.user_id}: ` +
      `${campaign.dialer_mode} -> ${dialerMode}, changed by admin`
    )

    return NextResponse.json({
      success: true,
      dialerMode,
      previousMode: campaign.dialer_mode,
    })
  } catch (err: any) {
    return apiError(err, { route: 'admin/user-data/campaigns/dialer-mode' })
  }
}
