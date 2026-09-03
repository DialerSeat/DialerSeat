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

/** Deterministic, so the same coupon is reused forever rather than recreated.
 *
 *  The dot in a fractional percent is replaced rather than passed through:
 *  57.14 becomes dialerseat-seat-57-14pct. Stripe ids are not the place to
 *  find out which punctuation an API accepts, and the id only has to be
 *  stable and unique. */
function couponIdFor(percentOff: number): string {
  return `dialerseat-seat-${String(percentOff).replace('.', '-')}pct`
}

export async function ensureSeatCoupon(percentOff: number): Promise<string | null> {
  if (!percentOff || percentOff <= 0) return null
  // Two decimals, because that is what the column stores and what Stripe
  // accepts. Passing 57.142857 through would mint a different coupon every
  // time the same rate was resolved from a slightly different float.
  percentOff = Math.round(percentOff * 100) / 100
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
      name: `DialerSeat seat ${percentOff}% off`,
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
// The fix does not need coupons to be combined. When the comp is already the
// better deal, the answer is simply to apply NOTHING at subscription level
// and let the inheritance stand.
//
// ── WHERE THE OWNER'S DISCOUNT CAN LIVE, AND WHICH ONES TRAVEL ──────────
// A discount on the owner's Stripe CUSTOMER reaches their seats by itself,
// because seats are subscriptions on that customer with no discount of their
// own. A discount on the owner's OWN PLAN does not reach anything else: it is
// a subscription-level coupon, and a coupon on one subscription has never
// applied to another. Both look like "100% off" in the Stripe dashboard, on
// different objects, and nothing in the product distinguishes them — which is
// exactly how an owner ends up certain their comp covers their team while
// every seat quietly bills at full price.
//
// The owner's rate is now read from BOTH and the seats get whichever is best,
// including the volume tier. When the winner is the plan-level one it has to
// be copied onto each seat, because inheritance will not do it.
//
// An earlier revision refused to copy, on the grounds that reproducing a
// comp's duration and expiry incorrectly turns a "once" comp into a permanent
// one. That objection is answered by the nightly reconcile rather than by
// getting the duration right: syncOwnerSeatDiscounts re-derives this decision
// for every owner every night and REMOVES a coupon that is no longer earned.
// So the copy is deliberately a plain forever coupon and never outlives the
// original by more than a day — and seats invoice weekly, so in practice the
// correction lands several days before the next charge.
// ─────────────────────────────────────────────────────────────────────────

export interface SeatDiscountDecision {
  /** The volume tier this owner has earned, ignoring any comp. */
  volumePercentOff: number
  /** Percent off sitting on the owner's Stripe CUSTOMER, if readable. Null
   *  when they have none, or when it is a fixed amount rather than a
   *  percentage (which cannot be compared without knowing the seat price).
   *  This one reaches seats on its own. */
  compPercentOff: number | null
  /** Percent off on the owner's own live plan subscription. This one does NOT
   *  reach seats on its own and has to be copied onto them. */
  ownerPlanPercentOff: number | null
  /** A rate an admin agreed by hand, from the Incentives app. */
  overridePercentOff: number | null
  /** What the seat ends up discounted by, however it gets there — inherited
   *  from the customer or applied as a coupon. This is the number that
   *  decides whether a seat is free. */
  effectivePercentOff: number
  /** Apply this coupon at subscription level. Zero means apply nothing, which
   *  is either "no discount" or "the customer-level one already covers it". */
  applyPercentOff: number
  /** Where effectivePercentOff came from. */
  compSource: 'customer' | 'owner_plan' | 'volume' | 'override' | 'exempt' | null
  /** The winning comp's Stripe duration - 'forever', 'once' or 'repeating'.
   *  Informational: a comp that expires makes a LATER invoice billable, which
   *  the nightly reconcile and the enforcement job handle, and is not a reason
   *  to refuse the seat today. */
  compDuration: string | null
  ownerPaidSeats: number
  reason: 'volume' | 'comp_is_better' | 'owner_plan' | 'override' | 'exempt' | 'none'
}

/**
 * Will this seat invoice at zero?
 *
 * Asked before requiring a card, and it asks about the EFFECTIVE rate rather
 * than about any one coupon: 100% off is 100% off whether it was inherited
 * from the owner's customer or copied from their plan onto the seat. There is
 * no charge either way, so there is nothing a card would do.
 */
export function seatIsFullyComped(decision: SeatDiscountDecision): boolean {
  return decision.effectivePercentOff === 100
}

export async function resolveSeatDiscount(ownerId: string): Promise<SeatDiscountDecision> {
  const { percentOff: volumePercentOff, ownerPaidSeats } = await ownerSeatDiscount(ownerId)

  let compPercentOff: number | null = null
  let compDuration: string | null = null
  let ownerPlanPercentOff: number | null = null
  let planDuration: string | null = null
  let exempt = false
  let overridePercentOff: number | null = null

  try {
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, seat_billing_exempt, seat_discount_override_pct')
      .eq('clerk_id', ownerId)
      .maybeSingle()

    exempt = owner?.seat_billing_exempt === true
    const pct = owner?.seat_discount_override_pct
    overridePercentOff = typeof pct === 'number' ? pct : null

    if (owner?.stripe_customer_id) {
      const customer = await stripe.customers.retrieve(owner.stripe_customer_id)
      if (!(customer as any).deleted) {
        const coupon = (customer as any).discount?.coupon
        const pct = coupon?.percent_off
        compPercentOff = typeof pct === 'number' ? pct : null
        compDuration = coupon?.duration ?? null
      }

      // ── THE OWNER'S OWN PLAN ────────────────────────────────────────────
      // Only LIVE subscriptions count. A coupon on a canceled subscription is
      // a discount that has ended, and reading it as current would comp an
      // owner's seats off a plan they no longer hold — which is easy to do by
      // accident, because the canceled row keeps the coupon on it forever.
      //
      // Seats are skipped: they are subscriptions on this same customer, and
      // a seat already carrying last night's copied coupon would otherwise be
      // read back as evidence of a comp and keep itself alive.
      const subs = await stripe.subscriptions.list({
        customer: owner.stripe_customer_id,
        status: 'all',
        limit: 100,
      })
      const LIVE = new Set(['active', 'past_due'])
      for (const sub of subs.data) {
        if (!LIVE.has(sub.status)) continue
        if ((sub.metadata as any)?.sub_kind === 'team_seat') continue
        const d = ((sub as any).discounts && (sub as any).discounts[0]) || (sub as any).discount
        const coupon = d && typeof d !== 'string' ? d.coupon : null
        const pct = coupon?.percent_off
        if (typeof pct !== 'number') continue
        if (ownerPlanPercentOff === null || pct > ownerPlanPercentOff) {
          ownerPlanPercentOff = pct
          planDuration = coupon?.duration ?? null
        }
      }
    }
  } catch (err: any) {
    // Never fatal. Failing to read a comp must not stop a seat opening; the
    // worst case is the volume coupon applies, which is the old behaviour.
    console.error('[seatDiscount] could not read owner comp:', err?.message || err)
  }

  const customerComp = compPercentOff ?? 0
  const planComp = ownerPlanPercentOff ?? 0
  const manual = overridePercentOff ?? 0
  const best = Math.max(volumePercentOff, customerComp, planComp, manual)

  const base = {
    volumePercentOff, compPercentOff, ownerPlanPercentOff, overridePercentOff, ownerPaidSeats,
  }

  // ── AN EXEMPT OWNER'S SEATS ARE ALWAYS FREE ───────────────────────────
  // users.seat_billing_exempt, off for everybody by default. It exists so the
  // seat flow can be exercised end to end without moving money.
  //
  // Deliberately expressed as 100% off rather than as a branch that skips
  // Stripe. The whole path still runs — subscription created, invoice
  // settled at $0.00, charge marked paid, seat opened — so what is being
  // tested is what a real owner hits, which is the entire point of testing
  // it. A bypass would exercise the bypass.
  //
  // Checked before the comps because it is not a discount anybody earned or
  // negotiated; it outranks whatever else is on the account.
  if (exempt) {
    return {
      ...base,
      effectivePercentOff: 100,
      applyPercentOff: 100,
      compSource: 'exempt',
      compDuration: 'forever',
      reason: 'exempt',
    }
  }

  // ── A RATE SOMEBODY AGREED BEATS ONE THAT WAS CALCULATED ──────────────
  // Checked before the automatic sources so that when an admin has agreed a
  // number by hand, that is the number — the whole point of the partner tier
  // being negotiated rather than printed.
  //
  // It still only wins if it is the BEST rate. Applying a manually agreed 20%
  // to an owner whose volume already earned them 25% would use the word
  // "override" to make somebody worse off than the published rate, which is
  // not a thing anybody should be able to do by typing a number into a box.
  if (manual > 0 && manual === best) {
    return {
      ...base,
      effectivePercentOff: manual,
      applyPercentOff: manual,
      compSource: 'override',
      compDuration: 'forever',
      reason: 'override',
    }
  }

  // Customer-level wins ties. It arrives at the same number without a coupon
  // of ours, so there is nothing to attach, nothing to keep in sync, and
  // nothing to remove later.
  if (customerComp > 0 && customerComp === best) {
    return {
      ...base,
      effectivePercentOff: customerComp,
      applyPercentOff: 0,
      compSource: 'customer',
      compDuration,
      reason: 'comp_is_better',
    }
  }

  // The owner's plan discount, copied onto the seat. Inheritance does not
  // cross between subscriptions, so this is the only way it reaches them.
  if (planComp > 0 && planComp === best) {
    return {
      ...base,
      effectivePercentOff: planComp,
      applyPercentOff: planComp,
      compSource: 'owner_plan',
      compDuration: planDuration,
      reason: 'owner_plan',
    }
  }

  return {
    ...base,
    effectivePercentOff: volumePercentOff,
    applyPercentOff: volumePercentOff,
    compSource: volumePercentOff > 0 ? 'volume' : null,
    compDuration,
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
      `[seatDiscount] owner ${ownerId} on ${percentOff}% (${ownerPaidSeats} funded seats), ` +
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
export async function syncIfTierChanged(
  ownerId: string,
  opts: { removed?: boolean } = {}
): Promise<boolean> {
  try {
    const { ownerPaidSeats } = await ownerSeatDiscount(ownerId)

    // ── LOSING A TIER IS AS IMMEDIATE AS EARNING ONE ────────────────────
    // This only ever compared N against N-1, which is the question a seat
    // being OPENED asks. On a seat ending, the boundary that matters is
    // between N and N+1, so a floor dropping from ten seats to nine did not
    // trigger anything and kept its 5% until the nightly pass — a day of a
    // discount nobody was earning.
    //
    // Still only on an actual boundary. Re-syncing on every departure would
    // mean reading every one of a two-hundred-seat floor's subscriptions from
    // Stripe because one person left, which is what the nightly batch exists
    // to avoid.
    const before = opts.removed
      ? tierForSeats(ownerPaidSeats + 1)
      : tierForSeats(Math.max(0, ownerPaidSeats - 1))
    const now = tierForSeats(ownerPaidSeats)

    if (!opts.removed && ownerPaidSeats <= 0) return false
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
