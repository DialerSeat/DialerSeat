import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEFAULT_SEAT_CENTS = 3500

// Mirrors the validation rules in /api/teams/redeem exactly, but never
// writes anything — this only answers "what would happen if I redeemed
// this", so the confirmation card can show real information (team name,
// campaign(s), cost, who pays) before the user commits to anything.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rawCode = req.nextUrl.searchParams.get('code') || ''
    if (!rawCode.trim()) {
      return NextResponse.json({ success: false, error: 'Code required' }, { status: 400 })
    }
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, '')

    const { data: codeRow } = await supabaseAdmin
      .from('team_codes')
      .select('id, team_id, code_type, campaign_id, payer, is_active, max_uses, use_count, seat_price_override_cents')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (!codeRow) {
      return NextResponse.json({ success: false, error: 'This invite link is invalid or has expired' }, { status: 404 })
    }

    if (codeRow.max_uses !== null && codeRow.use_count >= codeRow.max_uses) {
      return NextResponse.json({ success: false, error: 'This invite link has already been used' }, { status: 410 })
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id, name')
      .eq('id', codeRow.team_id)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    if (team.owner_id === userId) {
      return NextResponse.json({
        success: true,
        isOwnTeam: true,
        team: { id: team.id, name: team.name },
      })
    }

    const { data: existingMember } = await supabaseAdmin
      .from('team_members')
      .select('id, status')
      .eq('team_id', team.id)
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        memberStatus: existingMember.status,
        team: { id: team.id, name: team.name },
      })
    }

    // Which campaign(s) this specific code grants — same rule as the real
    // redeem: a code tied to one campaign grants just that one, otherwise
    // it grants every campaign currently attached to the team.
    let campaignNames: string[] = []
    if (codeRow.code_type === 'seat') {
      if (codeRow.campaign_id) {
        const { data: c } = await supabaseAdmin
          .from('campaigns')
          .select('name')
          .eq('id', codeRow.campaign_id)
          .maybeSingle()
        campaignNames = c ? [c.name] : []
      } else {
        const { data: tcs } = await supabaseAdmin
          .from('team_campaigns')
          .select('campaigns(name)')
          .eq('team_id', team.id)
        campaignNames = (tcs || [])
          .map((r: any) => r.campaigns?.name)
          .filter(Boolean)
      }
    }

    const isSingleUsePartnerSeat =
      codeRow.max_uses === 1 && codeRow.code_type === 'seat' && codeRow.payer === 'owner'

    const seatCents =
      typeof codeRow.seat_price_override_cents === 'number'
        ? codeRow.seat_price_override_cents
        : DEFAULT_SEAT_CENTS

    // Whitelabel branding, if the owner runs one — shown on the
    // confirmation card so the invite looks like it's coming from the
    // actual brand the agent will end up seeing, not generic DialerSeat.
    const { data: ownerTenant } = await supabaseAdmin
      .from('white_label_tenants')
      .select('brand_name, logo_url')
      .eq('owner_clerk_id', team.owner_id)
      .eq('status', 'active')
      .eq('is_active', true)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      team: { id: team.id, name: team.name },
      brand: ownerTenant ? { name: ownerTenant.brand_name, logoUrl: ownerTenant.logo_url } : null,
      codeType: codeRow.code_type,
      payer: codeRow.payer,
      campaignNames,
      instant: isSingleUsePartnerSeat,
      requiresApproval: codeRow.payer === 'owner' && !isSingleUsePartnerSeat,
      requiresPayment: codeRow.payer === 'agent',
      seatCents: codeRow.payer === 'agent' ? seatCents : null,
    })
  } catch (error: any) {
    console.error('Redeem preview error:', error)
    return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 })
  }
}
