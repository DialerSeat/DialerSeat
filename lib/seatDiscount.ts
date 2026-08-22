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

// ── NOTHING HERE MAY BE TRUNCATED ──────────────────────────────────────────
// Every read in this file feeds a billing decision, so a row that goes missing
// does not degrade the answer — it produces a different, wrong price. Three
// separate reads below could truncate: an unbounded select (Supabase stops at
// 1,000 and reports success), .limit(500) on codes, and .limit(2000) on
// charges. All three fail in the same direction, under-counting seats and so
// under-applying the discount the owner earned, and all three only begin to
// misbehave at exactly the scale the discount tiers exist to reward.
//
// Pages until the source is exhausted. There is no ceiling.
async function readAll<T>(
  build: (from: number, to: number) => any,
  label: string,
): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      // Louder than returning what we have: a partial read here silently
      // changes what the customer is charged.
      throw new Error(`[seatDiscount] ${label} read failed: ${error.message}`)
    }
    const rows = (data || []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
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
  const teams = await readAll<{ id: string }>(
    (from, to) => supabaseAdmin
      .from('teams')
      .select('id')
      .eq('owner_id', ownerId)
      .range(from, to),
    'teams',
  )

  const teamIds = teams.map((t: any) => t.id)
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

  const ownerCodes = await readAll<{ code: string }>(
    (from, to) => supabaseAdmin
      .from('team_codes')
      .select('code')
      .in('team_id', teamIds)
      .eq('payer', 'owner')
      .range(from, to),
    'owner-pays codes',
  )

  let viaCode = 0
  const codes = ownerCodes.map((c: any) => c.code).filter(Boolean)
  // Chunked because .in() travels in the URL: a long enough list is rejected
  // outright rather than merely being slow. Summing counts across chunks is
  // exact — a member joined with one code, so no member is counted twice.
  const CODE_CHUNK = 200
  for (let i = 0; i < codes.length; i += CODE_CHUNK) {
    const { count, error } = await supabaseAdmin
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .in('team_id', teamIds)
      .eq('status', 'active')
      .is('seat_suspended_at', null)
      .is('billing_override', null)
      .in('joined_via_code', codes.slice(i, i + CODE_CHUNK))
    if (error) throw new Error(`[seatDiscount] code seat count failed: ${error.message}`)
    viaCode += count || 0
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
// ─────────────────────────────────────────────────────────────────────────
// EARNING A DISCOUNT MUST NEVER COST MORE THAN NOT EARNING ONE
//
// Two discounts can reach a seat and Stripe lets exactly one of them win:
// a subscription-level coupon (our volume tier) always beats a customer-level
// one (an account comp), because "when a subscription has no discounts, the
// customer-level discount, if any, applies to invoices".
//
// Applied naively that inverts the incentive. A comped owner pays nothing per
// seat until they reach ten, at which point the 5% volume coupon lands on the
// subscription, DISPLACES the comp, and their seats jump from $0.00 to $33.25.
// Crossing the threshold the tier exists to reward makes them worse off.
//
// The fix does not need coupons to be combined or copied. When the comp is
// already the better deal, the answer is simply to apply NOTHING at
// subscription level and let the inheritance stand — which is the behaviour
// already running in production. Copying the comp onto the subscription would
// mean reproducing its duration, its redemption limits and its expiry, and
// getting any of those wrong turns a "once" comp into a permanent one.
//
// So the rule is: apply the volume coupon only when volume actually beats the
// comp. The seat then always receives the better of the two, and no owner is
// ever punished for growing.
// ─────────────────────────────────────────────────────────────────────────

export interface SeatDiscountDecision {
  /** The volume tier this owner has earned, ignoring any comp. */
  volumePercentOff: number
  /** Percent off already sitting on the owner's Stripe CUSTOMER, if readable.
   *  Null when they have none, or when it is a fixed amount rather than a
   *  percentage (which cannot be compared without knowing the seat price). */
  compPercentOff: number | null
  /** Apply this coupon at subscription level, or null to leave the customer
   *  discount to apply on its own. */
  applyPercentOff: number
  /** The comp's Stripe duration - 'forever', 'once' or 'repeating'. Null when
   *  there is no readable comp. Only informational: a comp that expires makes
   *  a LATER invoice billable, and that is the enforcement job's problem, not
   *  a reason to refuse the seat today. */
  compDuration: string | null
  ownerPaidSeats: number
  reason: 'volume' | 'comp_is_better' | 'none'
}

/**
 * Will this seat invoice at zero on the owner's comp alone?
 *
 * Asked before requiring a card. A 100%-off discount sitting on the owner's
 * Stripe CUSTOMER reaches every subscription created on that customer that has
 * no discount of its own - which is exactly what a comped owner's seats are,
 * because resolveSeatDiscount deliberately applies nothing when the comp beats
 * the volume tier. There is no charge, so there is nothing a card would do.
 */
export function seatIsFullyComped(decision: SeatDiscountDecision): boolean {
  return decision.compPercentOff === 100 && decision.applyPercentOff === 0
}

export async function resolveSeatDiscount(ownerId: string): Promise<SeatDiscountDecision> {
  const { percentOff: volumePercentOff, ownerPaidSeats } = await ownerSeatDiscount(ownerId)

  let compPercentOff: number | null = null
  let compDuration: string | null = null
  try {
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('clerk_id', ownerId)
      .maybeSingle()

    if (owner?.stripe_customer_id) {
      const customer = await stripe.customers.retrieve(owner.stripe_customer_id)
      if (!(customer as any).deleted) {
        const pct = (customer as any).discount?.coupon?.percent_off
        compPercentOff = typeof pct === 'number' ? pct : null
        compDuration = (customer as any).discount?.coupon?.duration ?? null
      }
    }
  } catch (err: any) {
    // Never fatal. Failing to read a comp must not stop a seat opening; the
    // worst case is the volume coupon applies, which is the old behaviour.
    console.error('[seatDiscount] could not read owner comp:', err?.message || err)
  }

  if (compPercentOff !== null && compPercentOff >= volumePercentOff) {
    return {
      volumePercentOff,
      compPercentOff,
      applyPercentOff: 0,
      compDuration,
      ownerPaidSeats,
      reason: 'comp_is_better',
    }
  }

  return {
    volumePercentOff,
    compPercentOff,
    applyPercentOff: volumePercentOff,
    compDuration,
    ownerPaidSeats,
    reason: volumePercentOff > 0 ? 'volume' : 'none',
  }
}

export async function syncOwnerSeatDiscounts(ownerId: string): Promise<DiscountSyncResult> {
  // Same decision the seat was opened with, or the nightly pass would put the
  // volume coupon back on a comped owner's seats and undo it every night.
  const decision = await resolveSeatDiscount(ownerId)
  const percentOff = decision.applyPercentOff
  const ownerPaidSeats = decision.ownerPaidSeats
  const result: DiscountSyncResult = {
    percentOff,
    ownerPaidSeats,
    subscriptionsChecked: 0,
    updated: 0,
    failed: 0,
  }

  // Live seat subscriptions, from our own records — the id column is named
  // stripe_subscription_item_id but holds a SUBSCRIPTION id.
  const charges = await readAll<{ id: string; stripe_subscription_item_id: string }>(
    (from, to) => supabaseAdmin
      .from('team_seat_charges')
      .select('id, stripe_subscription_item_id')
      .eq('owner_id', ownerId)
      .eq('status', 'paid')
      .not('stripe_subscription_item_id', 'is', null)
      .range(from, to),
    'seat charges',
  )

  const subIds = Array.from(
    new Set(charges.map((c: any) => c.stripe_subscription_item_id).filter(Boolean))
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
