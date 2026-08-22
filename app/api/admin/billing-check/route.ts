import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireAdmin } from '@/lib/admin'
import { resolveSeatDiscount, seatIsFullyComped } from '@/lib/seatDiscount'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// WHERE IS THIS OWNER'S DISCOUNT ACTUALLY ATTACHED?
//
// "I thought a 100% coupon meant no card was needed" has two possible
// answers and they look identical from the outside:
//
//   The coupon is on the Stripe CUSTOMER — it reaches the seats, because
//   Stripe applies a customer discount to any subscription with none of its
//   own, and a comped owner's seats deliberately have none of their own.
//
//   The coupon is on the owner's PERSONAL SUBSCRIPTION — it does not reach
//   the seats at all. Seats are separate subscriptions; a discount on one
//   subscription has never applied to another. The owner is comped on their
//   own plan and pays full price per seat.
//
// Both show as "100% off" in the Stripe dashboard, on different objects, and
// nothing in the product distinguishes them. This prints both, plus whether a
// card is on file and what the seat pricing logic concludes — so the question
// is answered by looking rather than by guessing.
//
// Read-only. Nothing here changes a coupon, a card, or a subscription. Admin
// only, and it exposes one owner's billing shape to somebody who can already
// read every user in the admin app.
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const clerkId = req.nextUrl.searchParams.get('clerk_id') || ''
  const email = req.nextUrl.searchParams.get('email') || ''

  if (!clerkId && !email) {
    return NextResponse.json(
      { success: false, error: 'Pass clerk_id or email' },
      { status: 400 }
    )
  }

  let query = supabaseAdmin.from('users').select('clerk_id, email, stripe_customer_id')
  query = clerkId ? query.eq('clerk_id', clerkId) : query.eq('email', email)

  const { data: row } = await query.maybeSingle()
  if (!row) {
    return NextResponse.json({ success: false, error: 'No users row for that' }, { status: 404 })
  }
  if (!row.stripe_customer_id) {
    return NextResponse.json({
      success: true,
      owner: { clerkId: row.clerk_id, email: row.email },
      verdict: 'No Stripe customer at all. They have never checked out, so there is nothing to bill a seat to.',
    })
  }

  const customer = await stripe.customers.retrieve(row.stripe_customer_id)
  if ((customer as any).deleted) {
    return NextResponse.json({
      success: true,
      owner: { clerkId: row.clerk_id, email: row.email },
      verdict: 'Their Stripe customer was deleted. Seats cannot be created against it.',
    })
  }

  const c = customer as any

  const customerDiscount = c.discount?.coupon
    ? {
        couponId: c.discount.coupon.id,
        percentOff: c.discount.coupon.percent_off,
        amountOff: c.discount.coupon.amount_off,
        duration: c.discount.coupon.duration,
      }
    : null

  const defaultPm = c.invoice_settings?.default_payment_method
  const defaultPmId = typeof defaultPm === 'string' ? defaultPm : defaultPm?.id ?? null

  const cards = await stripe.paymentMethods.list({
    customer: c.id,
    type: 'card',
    limit: 10,
  })

  const subs = await stripe.subscriptions.list({
    customer: c.id,
    status: 'all',
    limit: 50,
  })

  const subscriptions = subs.data.map(s => {
    const d = ((s as any).discounts && (s as any).discounts[0]) || (s as any).discount
    const coupon = d && typeof d !== 'string' ? d.coupon : null
    return {
      id: s.id,
      status: s.status,
      kind: (s.metadata as any)?.sub_kind || 'personal',
      agentEmail: (s.metadata as any)?.agent_email || null,
      discount: coupon
        ? { couponId: coupon.id, percentOff: coupon.percent_off, amountOff: coupon.amount_off, duration: coupon.duration }
        : null,
      defaultPaymentMethod: (s as any).default_payment_method || null,
    }
  })

  // The exact decision a new seat would be opened with.
  let decision: any = null
  let decisionError: string | null = null
  try {
    decision = await resolveSeatDiscount(row.clerk_id)
  } catch (err: any) {
    decisionError = err?.message || String(err)
  }

  const hasCard = !!(defaultPmId || cards.data.length)
  const comped = decision ? seatIsFullyComped(decision) : false

  const verdict = hasCard
    ? 'A card is on file, so seats can be billed either way.'
    : comped
      ? 'No card, but the customer-level comp covers seats entirely — seats will open and invoice $0.'
      : customerDiscount
        ? 'No card. There IS a customer-level discount but it does not zero the seat, so a seat still needs a card.'
        : subscriptions.some(s => s.kind === 'personal' && s.discount)
          ? 'No card, and the only discount is on their PERSONAL subscription. That never reaches seats — ' +
            'a discount on one subscription does not apply to another. Move the coupon onto the CUSTOMER ' +
            'to comp their seats too, or add a card.'
          : 'No card and no discount anywhere. Seats cannot be billed until a card is added.'

  return NextResponse.json({
    success: true,
    owner: { clerkId: row.clerk_id, email: row.email, customerId: c.id },
    customerDiscount,
    cards: {
      defaultPaymentMethod: defaultPmId,
      attached: cards.data.map(p => ({
        id: p.id,
        brand: p.card?.brand,
        last4: p.card?.last4,
        expires: p.card ? `${p.card.exp_month}/${p.card.exp_year}` : null,
      })),
    },
    subscriptions,
    seatDecision: decision,
    seatWouldBeFree: comped,
    decisionError,
    verdict,
  })
}
