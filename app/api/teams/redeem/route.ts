import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Agent submits a code to redeem.
 *
 * Body:
 *   code: string (required) — case-insensitive lookup
 *
 * Behavior depends on the code's (code_type × payer) combination:
 *
 *   recruit + owner → member.status='pending', no campaign access yet
 *   recruit + agent → member.status='active', no campaign access (agent pays $35 to dial)
 *   seat + owner    → member.status='pending', team_campaign_access pre-staged inactive
 *   seat + agent    → member.status='active', team_campaign_access active immediately
 *                     (gated downstream — agent must still pay $35 to dial)
 *
 * Idempotency:
 *   - Same agent redeeming a code that grants access they already have → no-op
 *   - Already pending on this team → return existing pending state
 *   - Already active → grant any new campaign access the code unlocks
 *
 * Returns the member row + which access rows were created (or already existed).
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { code: rawCode } = body

    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      return NextResponse.json(
        { success: false, error: 'Code required' },
        { status: 400 }
      )
    }

    const code = rawCode.trim().toUpperCase().replace(/\s+/g, '')

    // Look up the code
    const { data: codeRow } = await supabaseAdmin
      .from('team_codes')
      .select('id, team_id, code_type, campaign_id, payer, is_active')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (!codeRow) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired code' },
        { status: 404 }
      )
    }

    // Block: owners can't redeem codes for their own team
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id, name')
      .eq('id', codeRow.team_id)
      .maybeSingle()

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    if (team.owner_id === userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot redeem a code for your own team' },
        { status: 400 }
      )
    }

    // Determine target member status based on payer
    // owner-pays → pending (awaits owner Accept which triggers Stripe)
    // agent-pays → active immediately (agent will be gated by their own sub for dialing)
    const targetStatus = codeRow.payer === 'owner' ? 'pending' : 'active'

    // Look for existing membership row for this user+team
    const { data: existingActive } = await supabaseAdmin
      .from('team_members')
      .select('id, status, joined_via_code')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    const { data: existingPending } = await supabaseAdmin
      .from('team_members')
      .select('id, status, joined_via_code')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    // Resolve member row (create if needed, reuse if already exists)
    let memberRow: any
    if (existingActive) {
      memberRow = existingActive
    } else if (existingPending) {
      // Already pending — return existing pending state, don't duplicate
      memberRow = existingPending
    } else {
      const { data: newMember, error: memErr } = await supabaseAdmin
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: userId,
          status: targetStatus,
          joined_via_code: code,
          accepted_at: targetStatus === 'active' ? new Date().toISOString() : null,
        })
        .select()
        .single()

      if (memErr) throw memErr
      memberRow = newMember
    }

    // Determine which campaigns this code unlocks
    let campaignsToGrant: string[] = []

    if (codeRow.code_type === 'seat') {
      if (codeRow.campaign_id) {
        // Specific campaign
        campaignsToGrant = [codeRow.campaign_id]
      } else {
        // Blanket — snapshot all current team campaigns at redemption time
        const { data: tcs } = await supabaseAdmin
          .from('team_campaigns')
          .select('campaign_id')
          .eq('team_id', team.id)

        campaignsToGrant = (tcs || []).map((r: any) => r.campaign_id)
      }
    }
    // recruit codes: campaignsToGrant stays empty — recruit puts them on roster only

    // Stage team_campaign_access rows
    // For pending members (owner-pays), rows are created with is_active=false.
    // The accept route flips them to is_active=true and fires Stripe.
    // For active members (agent-pays), rows go in active immediately.
    const accessIsActive = memberRow.status === 'active'
    const newAccessGrants: any[] = []
    const alreadyHeld: any[] = []

    for (const campaignId of campaignsToGrant) {
      // Check if already has active access
      const { data: existingAccess } = await supabaseAdmin
        .from('team_campaign_access')
        .select('id, is_active')
        .eq('team_member_id', memberRow.id)
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .maybeSingle()

      if (existingAccess) {
        alreadyHeld.push(campaignId)
        continue
      }

      // Insert new access row
      const { data: granted, error: grantErr } = await supabaseAdmin
        .from('team_campaign_access')
        .insert({
          team_id: team.id,
          team_member_id: memberRow.id,
          campaign_id: campaignId,
          access_source: 'code',
          granted_via_code_id: codeRow.id,
          payer: codeRow.payer,
          is_active: accessIsActive,
        })
        .select()
        .single()

      if (grantErr) {
        // 23505 = unique violation (active access already exists, race condition)
        if (grantErr.code === '23505') {
          alreadyHeld.push(campaignId)
          continue
        }
        throw grantErr
      }
      newAccessGrants.push(granted)
    }

    // For owner-pays codes, stage a pending team_seat_charges row.
    // Batch 4 wires actual Stripe creation; for now we just log the intent.
    if (codeRow.payer === 'owner' && memberRow.status === 'pending') {
      await supabaseAdmin.from('team_seat_charges').insert({
        team_id: team.id,
        owner_id: team.owner_id,
        agent_id: userId,
        team_member_id: memberRow.id,
        amount_cents: 3500,
        status: 'pending',
        period_start: new Date().toISOString(),
        // 7-day weekly cycle; gets adjusted to real Stripe period in Batch 4
        period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      team: { id: team.id, name: team.name },
      member: memberRow,
      code: {
        type: codeRow.code_type,
        payer: codeRow.payer,
      },
      newAccessGrants: newAccessGrants.length,
      alreadyHeldAccess: alreadyHeld.length,
      // Hint for the UI on what to show next
      nextStep:
        codeRow.payer === 'agent'
          ? 'redirect_to_billing'
          : memberRow.status === 'pending'
          ? 'awaiting_owner_approval'
          : 'redirect_to_team',
    })
  } catch (error: any) {
    console.error('Redeem error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}