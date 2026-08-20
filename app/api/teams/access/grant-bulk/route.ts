import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// ─────────────────────────────────────────────────────────────────────────
// ADD PEOPLE TO A CAMPAIGN — NO NEW CHARGE, EITHER SIDE
//
// The billable unit is the SEAT, not the campaign. Once somebody holds an
// active seat on a team — whether the owner is paying for it or the agent is
// paying for their own — they have already been paid for, and putting them on
// another of that team's campaigns costs nobody anything extra. Charging again
// for it would be billing twice for one seat.
//
// So this grants access and creates no seat charge and makes no Stripe call at
// all. The single-member /access/grant still exists for the case where a grant
// genuinely IS what opens a new seat; this is the other case, and it is the
// common one: an owner moving a floor of agents onto a new list.
//
// Bulk, because the alternative is an owner clicking through fifty agents one
// at a time. Idempotent and partial-failure tolerant: anyone who already has
// access is reported as such rather than erroring the batch, so a double-click
// or a re-run is harmless.
// ─────────────────────────────────────────────────────────────────────────

const MAX_PER_CALL = 500

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { campaignId, memberIds } = body as {
      campaignId?: string
      memberIds?: string[]
    }

    if (!campaignId || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'campaignId and memberIds required' },
        { status: 400 }
      )
    }

    if (memberIds.length > MAX_PER_CALL) {
      return NextResponse.json(
        { success: false, error: 'Too many members in one request (max ' + MAX_PER_CALL + ')' },
        { status: 400 }
      )
    }

    const uniqueIds = Array.from(new Set(memberIds.filter(Boolean)))

    // Every member must belong to a team THIS user owns, and that team must
    // actually have the campaign attached. Both are checked against the data
    // rather than trusted from the request — a memberId is guessable, and this
    // endpoint hands out access to somebody's lead list.
    const { data: members, error: memErr } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, seat_suspended_at')
      .in('id', uniqueIds)

    if (memErr) throw memErr

    const found = members || []
    if (found.length === 0) {
      return NextResponse.json({ success: false, error: 'No such members' }, { status: 404 })
    }

    const teamIds = Array.from(new Set(found.map(m => m.team_id)))
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id, name')
      .in('id', teamIds)

    const ownedTeamIds = new Set(
      (teams || []).filter((t: any) => t.owner_id === userId).map((t: any) => t.id)
    )
    if (ownedTeamIds.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can add members to a campaign' },
        { status: 403 }
      )
    }

    const { data: attachedRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('team_id')
      .eq('campaign_id', campaignId)
      .in('team_id', Array.from(ownedTeamIds))

    const attachedTeamIds = new Set((attachedRows || []).map((r: any) => r.team_id))
    if (attachedTeamIds.size === 0) {
      return NextResponse.json(
        { success: false, error: 'That campaign is not attached to this team' },
        { status: 400 }
      )
    }

    const grantedIds: string[] = []
    const alreadyHad: string[] = []
    const skipped: Array<{ memberId: string; reason: string }> = []

    // Read the existing grants once rather than per member — an owner adding a
    // whole floor should not cost one round trip per person.
    const { data: existingRows } = await supabaseAdmin
      .from('team_campaign_access')
      .select('id, team_member_id, is_active')
      .eq('campaign_id', campaignId)
      .in('team_member_id', uniqueIds)

    const existingByMember = new Map<string, any>()
    for (const r of existingRows || []) existingByMember.set(r.team_member_id, r)

    const toInsert: any[] = []
    const toReactivate: string[] = []

    for (const m of found) {
      if (!attachedTeamIds.has(m.team_id)) {
        skipped.push({ memberId: m.id, reason: 'not_on_this_team' })
        continue
      }
      if (m.status !== 'active') {
        skipped.push({ memberId: m.id, reason: 'seat_not_active' })
        continue
      }
      if (m.seat_suspended_at) {
        // A suspended seat is not a seat. Granting a campaign to somebody the
        // owner has already cut off would quietly undo that decision.
        skipped.push({ memberId: m.id, reason: 'seat_suspended' })
        continue
      }

      const existing = existingByMember.get(m.id)
      if (existing?.is_active) {
        alreadyHad.push(m.id)
        continue
      }
      if (existing) {
        toReactivate.push(existing.id)
        grantedIds.push(m.id)
        continue
      }

      toInsert.push({
        team_id: m.team_id,
        team_member_id: m.id,
        campaign_id: campaignId,
        access_source: 'manual',
        granted_via_code_id: null,
        // 'free' is the honest label: this grant creates no charge, because the
        // seat it rides on is already paid for by somebody.
        payer: 'free',
        is_active: true,
      })
      grantedIds.push(m.id)
    }

    if (toReactivate.length > 0) {
      const { error } = await supabaseAdmin
        .from('team_campaign_access')
        .update({ is_active: true })
        .in('id', toReactivate)
      if (error) throw error
    }

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('team_campaign_access')
        .insert(toInsert)
      if (error) {
        // A unique violation here means somebody else granted the same access
        // between the read above and this write. That is the outcome we wanted
        // anyway, so it is not worth failing the batch over.
        if (error.code !== '23505') throw error
      }
    }

    return NextResponse.json({
      success: true,
      granted: grantedIds.length,
      alreadyHad: alreadyHad.length,
      skipped,
      charged: false,
    })
  } catch (error: any) {
    console.error('Bulk access grant error:', error)
    return apiError(error, { route: 'teams/access/grant-bulk' })
  }
}
