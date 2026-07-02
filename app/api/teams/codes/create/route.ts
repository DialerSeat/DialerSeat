import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ownerCanBeCharged } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'

const CODE_PATTERN = /^[A-Z0-9_-]{4,32}$/

function generateRandomCode(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      teamId,
      code: rawCode,
      codeType,
      campaignId,
      payer,
      singleUse,
      maxUses,
      seatPriceOverrideCents,
    } = body

    if (!teamId) {
      return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 })
    }

    if (!codeType || !['seat', 'recruit'].includes(codeType)) {
      return NextResponse.json(
        { success: false, error: 'codeType must be "seat" or "recruit"' },
        { status: 400 }
      )
    }

    if (!payer || !['owner', 'agent'].includes(payer)) {
      return NextResponse.json(
        { success: false, error: 'payer must be "owner" or "agent"' },
        { status: 400 }
      )
    }

    if (codeType === 'recruit' && campaignId) {
      return NextResponse.json(
        { success: false, error: 'Recruit codes cannot have a campaignId' },
        { status: 400 }
      )
    }

    let resolvedMaxUses: number | null = null
    if (typeof maxUses === 'number' && maxUses > 0) {
      resolvedMaxUses = Math.floor(maxUses)
    } else if (singleUse === true) {
      resolvedMaxUses = 1
    }

    let resolvedPriceOverride: number | null = null
    if (seatPriceOverrideCents !== undefined && seatPriceOverrideCents !== null) {
      const n = Number(seatPriceOverrideCents)
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
        return NextResponse.json(
          { success: false, error: 'seatPriceOverrideCents must be 0–1000000' },
          { status: 400 }
        )
      }
      resolvedPriceOverride = Math.round(n)
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    if (team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can create codes' },
        { status: 403 }
      )
    }

    if (codeType === 'seat' && campaignId) {
      const { data: campaign } = await supabaseAdmin
        .from('campaigns')
        .select('id, user_id')
        .eq('id', campaignId)
        .maybeSingle()

      if (!campaign) {
        return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
      }
      if (campaign.user_id !== userId) {
        return NextResponse.json({ success: false, error: 'You do not own this campaign' }, { status: 403 })
      }

      const { data: tc } = await supabaseAdmin
        .from('team_campaigns')
        .select('team_id')
        .eq('team_id', teamId)
        .eq('campaign_id', campaignId)
        .maybeSingle()

      if (!tc) {
        return NextResponse.json(
          { success: false, error: 'Campaign is not attached to this team — attach it first' },
          { status: 400 }
        )
      }
    }

    if (resolvedMaxUses === 1 && codeType === 'seat' && payer === 'owner') {
      const billable = await ownerCanBeCharged(userId)
      if (!billable.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Add a payment method before creating a single-use owner-paid link. ' +
              'These links charge your card automatically when an agent joins, so a ' +
              'card must be on file first.',
            code: billable.code,
          },
          { status: 402 }
        )
      }
    }

    let code: string
    if (rawCode && typeof rawCode === 'string' && rawCode.trim()) {
      code = rawCode.trim().toUpperCase().replace(/\s+/g, '')
      if (!CODE_PATTERN.test(code)) {
        return NextResponse.json(
          { success: false, error: 'Code must be 4–32 chars, letters/numbers/dash/underscore only' },
          { status: 400 }
        )
      }
    } else {
      let attempts = 0
      do {
        code = generateRandomCode(8)
        const { data: existing } = await supabaseAdmin
          .from('team_codes')
          .select('id')
          .eq('code', code)
          .maybeSingle()
        if (!existing) break
        attempts++
      } while (attempts < 10)

      if (attempts >= 10) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate unique code, try again' },
          { status: 500 }
        )
      }
    }

    const { data, error } = await supabaseAdmin
      .from('team_codes')
      .insert({
        team_id: teamId,
        code,
        code_type: codeType,
        campaign_id: codeType === 'seat' ? campaignId : null,
        payer,
        is_active: true,
        max_uses: resolvedMaxUses,
        use_count: 0,
        seat_price_override_cents: resolvedPriceOverride,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: `Code "${code}" is already taken — pick another` },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, code: data })
  } catch (error: any) {
    console.error('Code create error:', error)
    return apiError(error, { route: 'teams/codes/create' })
  }
}