import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import { syncOwnerSeatDiscounts, resolveSeatDiscount } from '@/lib/seatDiscount'
import { summariseSeatTier } from '@/lib/seatTiers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// ─────────────────────────────────────────────────────────────────────────
// THE RATE SOMEBODY AGREED, TYPED IN
//
// Above fifty seats the tier is negotiated rather than printed — deliberately,
// so a number is never promised that sales has not agreed. The gap was that
// nothing could then HONOUR the agreed number: sales says 30%, and billing has
// no idea, so the owner is charged the published rate and somebody has to
// remember to fix it in the Stripe dashboard by hand.
//
// This is that lever, with a name and a date against it.
//
// APPLIED IMMEDIATELY. Setting a rate re-syncs every one of that owner's live
// seat subscriptions rather than waiting for the nightly pass, because
// somebody typing a number here is on a call with the customer.
// ─────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    // Every owner: anybody with a team. A discount is per owner, so the list
    // is the set of people who can have one.
    const { data: teams } = await supabaseAdmin.from('teams').select('owner_id, name')
    const ownerIds = Array.from(new Set((teams || []).map(t => t.owner_id).filter(Boolean)))

    if (ownerIds.length === 0) return NextResponse.json({ success: true, owners: [] })

    const { data: users } = await supabaseAdmin
      .from('users')
      // One string literal, not a concatenation. Supabase infers the row type
      // from the select at compile time and a concatenated expression is
      // opaque to it, so the rows come back typed as GenericStringError and
      // every field access fails to compile.
      .select('clerk_id, email, first_name, last_name, seat_discount_override_pct, seat_discount_override_note, seat_discount_override_set_at, seat_discount_override_set_by, seat_billing_exempt')
      .in('clerk_id', ownerIds)

    // Seats funded, per owner, so the tier they have earned is visible beside
    // the rate being typed — the two are the same conversation.
    const { data: funded } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, billing_override, joined_via_code')
      .eq('status', 'active')
      .is('seat_suspended_at', null)

    const { data: teamRows } = await supabaseAdmin.from('teams').select('id, owner_id')
    const ownerOfTeam = new Map((teamRows || []).map(t => [t.id, t.owner_id]))

    const seatsByOwner = new Map<string, number>()
    for (const m of funded || []) {
      const owner = ownerOfTeam.get(m.team_id)
      if (!owner) continue
      if (m.billing_override === 'free' || m.billing_override === 'agent') continue
      seatsByOwner.set(owner, (seatsByOwner.get(owner) || 0) + 1)
    }

    const owners = (users || []).map(u => {
      const seats = seatsByOwner.get(u.clerk_id) || 0
      const tier = summariseSeatTier(seats, seats)
      return {
        clerkId: u.clerk_id,
        email: u.email,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email,
        fundedSeats: seats,
        earnedPercentOff: tier.percentOff,
        tierLabel: tier.tier.label,
        overridePct: u.seat_discount_override_pct,
        note: u.seat_discount_override_note,
        setAt: u.seat_discount_override_set_at,
        setBy: u.seat_discount_override_set_by,
        exempt: !!u.seat_billing_exempt,
      }
    })

    owners.sort((a, b) => b.fundedSeats - a.fundedSeats)

    return NextResponse.json({ success: true, owners })
  } catch (error: any) {
    return apiError(error, { route: 'admin/seat-discount' })
  }
}

export async function POST(req: NextRequest) {
  let admin: { userId: string }
  try {
    admin = await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const clerkId = typeof body?.clerkId === 'string' ? body.clerkId.trim() : ''
    const note = typeof body?.note === 'string' ? body.note.slice(0, 300) : null

    // null clears it. Explicitly distinct from 0, which is a real decision
    // meaning "no discount" and would be pointless but is not the same
    // instruction as "stop overriding".
    const raw = body?.percentOff
    // Two decimals, not whole percents. A round per-seat PRICE is the thing
    // people agree on, and $35 less 57% is $15.05 — the number nobody meant.
    const percentOff =
      raw === null || raw === undefined || raw === ''
        ? null
        : Math.round(Number(raw) * 100) / 100

    if (!clerkId) {
      return NextResponse.json({ success: false, error: 'clerkId required' }, { status: 400 })
    }
    if (percentOff !== null && (!Number.isFinite(percentOff) || percentOff < 0 || percentOff > 100)) {
      return NextResponse.json(
        { success: false, error: 'percentOff must be between 0 and 100, or null to clear' },
        { status: 400 }
      )
    }

    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('clerk_id, email')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    if (!owner) {
      return NextResponse.json({ success: false, error: 'No such user' }, { status: 404 })
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        seat_discount_override_pct: percentOff,
        seat_discount_override_note: percentOff === null ? null : note,
        seat_discount_override_set_at: percentOff === null ? null : new Date().toISOString(),
        seat_discount_override_set_by: percentOff === null ? null : admin.userId,
      })
      .eq('clerk_id', clerkId)

    if (error) throw error

    // What the seats will actually bill at now, and pushed to Stripe straight
    // away. Reporting the decision back matters as much as making it: an
    // override of 20% on an owner who already earned 25% changes nothing, and
    // the person typing it should see that rather than assume it applied.
    const decision = await resolveSeatDiscount(clerkId)
    const sync = await syncOwnerSeatDiscounts(clerkId)

    return NextResponse.json({
      success: true,
      clerkId,
      email: owner.email,
      appliedPercentOff: decision.effectivePercentOff,
      source: decision.compSource,
      subscriptionsUpdated: sync.updated,
      subscriptionsChecked: sync.subscriptionsChecked,
      note:
        percentOff !== null && decision.effectivePercentOff > percentOff
          ? `Saved, but their seats bill at ${decision.effectivePercentOff}% because ` +
            `they already earn that from ${decision.compSource}. The best rate wins.`
          : percentOff === null
            ? 'Override cleared. Their seats fall back to whatever they earn.'
            : `Their seats now bill at ${decision.effectivePercentOff}% off.`,
    })
  } catch (error: any) {
    return apiError(error, { route: 'admin/seat-discount' })
  }
}
