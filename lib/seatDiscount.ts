import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { summariseSeatTier, tierForSeats } from '@/lib/seatTiers'

// ─────────────────────────────────────────────────────────────────────────
// MAKING THE VOLUME DISCOUNT REACH THE CARD
//
// The tier was computed and printed on the Teams page and applied to nothing.
// An owner with fifteen funded seats was told "5% off your weekly seat cost"
// and charged full price every week — a quoted discount the billing did not
// honour, which is worse than never offering one.
//
// HOW IT WORKS. Each seat is its own Stripe subscription, so the discount is a
// percent-off coupon attached to each of them. Coupons are created once with a
// deterministic id (retrieve first, create on 404) so we never accumulate a new
// coupon per owner per week.
//
// WHEN IT IS EVALUATED. At seat creation, so a new seat is correct immediately,
// AND on the daily reconcile, which is what carries an owner across a tier
// boundary. Crossing 10 seats has to discount the nine they already had —
// otherwise the tier means "every seat you buy AFTER the tenth", which is not
// what the page says and not what anybody would expect.
//
// The counting rule lives in seatTiers and is shared with the page, so the
// number quoted and the number charged come from one place. Two implementations
// of "how many seats do they pay for" is exactly how a discount and an invoice
// end up disagreeing.
// ─────────────────────────────────────────────────────────────────────────

/** Deterministic, so the same coupon is reused forever rather than recreated. */
function couponIdFor(percentOff: number): string {
  return `dialerseat-seat-${percentOff}pct`
}

export async function ensureSeatCoupon(percentOff: number): Promise<string | null> {
  if (!percentOff || percentOff <= 0) return null
  const id = couponIdFor(percentOff)
  try {
    const existing = await stripe.coupons.retrieve(id)
    if (existing && !(existing as any).deleted) return existing.id
  } catch {
    // Not found is the normal first-run path, not a failure.
  }
  try {
    const created = await stripe.coupons.create({
      id,
      percent_off: percentOff,
      duration: 'forever',
      name: `DialerSeat volume ${percentOff}%`,
    })
    return created.id
  } catch (err: any) {
    // A race with another request creating the same id lands here; the coupon
    // exists either way, which is all the caller needs.
    if (err?.code === 'resource_already_exists') return id
    console.error('[seatDiscount] coupon create failed', err?.message || err)
    return null
  }
}

/**
 * How many seats is this owner actually billed for, and what does that earn?
 *
 * Same rule as the Teams page: an active, unsuspended membership whose billing
 * is the owner's — either by explicit override or by the payer on the code the
 * agent joined with. Agent-funded seats are excluded because a discount reduces
 * what the OWNER spends, and those cost them nothing to begin with.
 */
export async function ownerSeatDiscount(ownerId: string): Promise<{
  percentOff: number
  ownerPaidSeats: number
  totalSeats: number
}> {
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('owner_id', ownerId)

  const teamIds = (teams || []).map((t: any) => t.id)
  if (teamIds.length === 0) return { percentOff: 0, ownerPaidSeats: 0, totalSeats: 0 }

  const { count: totalSeats } = await supabaseAdmin
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .in('team_id', teamIds)
    .eq('status', 'active')
    .is('seat_suspended_at', null)

  const { count: overrideOwner } = await supabaseAdmin
    .from('team_members')
    .select('id', { count: 'exact', head: true })
    .in('team_id', teamIds)
    .eq('status', 'active')
    .is('seat_suspended_at', null)
    .eq('billing_override', 'owner')

  const { data: ownerCodes } = await supabaseAdmin
    .from('team_codes')
    .select('code')
    .in('team_id', teamIds)
    .eq('payer', 'owner')
    .limit(500)

  let viaCode = 0
  const codes = (ownerCodes || []).map((c: any) => c.code).filter(Boolean)
  if (codes.length > 0) {
    const { count } = await supabaseAdmin
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)
      .eq('status', 'active')
      .is('seat_suspended_at', null)
      .is('billing_override', null)
      .in('joined_via_code', codes)
    viaCode = count || 0
  }

  const total = totalSeats || 0
  const ownerPaid = Math.min((overrideOwner || 0) + viaCode, total)
  const summary = summariseSeatTier(ownerPaid, total)

  return {
    percentOff: summary.percentOff,
    ownerPaidSeats: ownerPaid,
    totalSeats: total,
  }
}

export interface DiscountSyncResult {
  percentOff: number
  ownerPaidSeats: number
  subscriptionsChecked: number
  updated: number
  failed: number
}

/**
 * Bring every one of this owner's live seat subscriptions onto the right
 * discount — including removing one they no longer qualify for.
 *
 * Removal matters as much as application. An owner who drops from twelve seats
 * to six has stopped earning the tier, and leaving the coupon attached would
 * quietly keep discounting them forever. That is not generosity, it is a
 * billing system that has lost track of what it charges.
 */
export async function syncOwnerSeatDiscounts(ownerId: string): Promise<DiscountSyncResult> {
  const { percentOff, ownerPaidSeats } = await ownerSeatDiscount(ownerId)
  const result: DiscountSyncResult = {
    percentOff,
    ownerPaidSeats,
    subscriptionsChecked: 0,
    updated: 0,
    failed: 0,
  }

  // Live seat subscriptions, from our own records — the id column is named
  // stripe_subscription_item_id but holds a SUBSCRIPTION id.
  const { data: charges } = await supabaseAdmin
    .from('team_seat_charges')
    .select('id, stripe_subscription_item_id')
    .eq('owner_id', ownerId)
    .eq('status', 'paid')
    .not('stripe_subscription_item_id', 'is', null)
    .limit(2000)

  const subIds = Array.from(
    new Set((charges || []).map((c: any) => c.stripe_subscription_item_id).filter(Boolean))
  )
  if (subIds.length === 0) return result

  const couponId = percentOff > 0 ? await ensureSeatCoupon(percentOff) : null

  for (const subId of subIds) {
    result.subscriptionsChecked++
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      if (sub.status === 'canceled' || sub.status === 'incomplete_expired') continue

      const current = (sub as any).discounts?.[0]?.coupon?.id
        ?? (sub as any).discount?.coupon?.id
        ?? null

      // Already right. Skipping is not just an optimisation — every update
      // writes to Stripe and shows in the customer's event history, and an
      // owner does not need a daily entry saying nothing changed.
      if (current === couponId) continue
      if (!couponId && !current) continue

      await stripe.subscriptions.update(subId, {
        discounts: couponId ? [{ coupon: couponId }] : [],
      } as any)
      result.updated++
    } catch (err: any) {
      result.failed++
      console.error(`[seatDiscount] could not sync ${subId}: ${err?.message || err}`)
    }
  }

  if (result.updated > 0) {
    console.log(
      `[seatDiscount] owner ${ownerId} on ${percentOff}% (${ownerPaidSeats} funded seats) — ` +
      `${result.updated} subscription(s) updated`
    )
  }
  return result
}

/**
 * Sync only when a seat has just moved the owner across a tier boundary.
 *
 * Called after a seat is opened. Onboarding fifteen agents in an afternoon
 * would otherwise re-sync every subscription fifteen times — 225 Stripe calls
 * to change something on three of them. Comparing the tier at N seats against
 * N-1 isolates the moment it actually matters, which happens exactly three
 * times in an account'''s life: at ten, at twenty-five, and at fifty.
 *
 * The new seat already carries the right coupon from creation. This is for the
 * ones opened BEFORE the threshold was reached, which are the whole reason a
 * volume tier is not just "cheaper from now on".
 */
export async function syncIfTierChanged(ownerId: string): Promise<boolean> {
  try {
    const { ownerPaidSeats } = await ownerSeatDiscount(ownerId)
    if (ownerPaidSeats <= 0) return false

    const now = tierForSeats(ownerPaidSeats)
    const before = tierForSeats(ownerPaidSeats - 1)
    if (now.key === before.key) return false

    await syncOwnerSeatDiscounts(ownerId)
    return true
  } catch (err: any) {
    // Never fatal. A discount that lands a day late on the daily reconcile is a
    // far better outcome than a seat that failed to open.
    console.error('[seatDiscount] tier-change sync failed', err?.message || err)
    return false
  }
}
