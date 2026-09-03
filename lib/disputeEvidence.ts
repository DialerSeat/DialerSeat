import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { getServiceClient } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────
// DISPUTES WERE BEING LOST BY DEFAULT
//
// Nothing in this codebase listened for charge.dispute.created. A dispute
// arrived as an email from Stripe, and if nobody assembled evidence before the
// deadline it was lost — not on the merits, on silence. That is the worst way
// to lose one, because the evidence that would have won it already exists.
//
// WHAT MAKES THIS PRODUCT UNUSUALLY DEFENSIBLE: call records. The common
// dispute reason is "services not rendered" or "unrecognized", and most
// software can only answer with "they logged in". DialerSeat can answer with
// "this account placed 1,240 calls totalling 31 hours across nine days, ending
// two days before the dispute was filed". That is difficult to argue with.
//
// WHY THIS SAVES BUT DOES NOT SUBMIT. Stripe accepts evidence once. After
// submission it cannot be amended, and the dispute is decided on whatever was
// sent. A script submitting unreviewed evidence in the middle of the night
// trades a recoverable situation for an unrecoverable one to save a few
// minutes. So this assembles everything, saves it to Stripe as a draft,
// records it, and raises a notification carrying the deadline. A person
// submits, having read it.
//
// The deadline is the thing that actually matters, and it is now stored in a
// table and pushed to a phone rather than sitting in an inbox.
// ─────────────────────────────────────────────────────────────────────────

const supabase = getServiceClient('disputeEvidence')

/** Shown to Stripe as the policy the customer accepted. Keep this in step with
 *  what /terms actually says — evidence that contradicts the public page is
 *  worse than no evidence. */
const REFUND_POLICY_TEXT =
  'DialerSeat seats are billed weekly in advance. Refunds are available on ' +
  'request within 24 hours of a charge. Access continues through the end of ' +
  'any period already paid for, and a seat can be cancelled at any time from ' +
  'the billing page, which stops all future charges.'

export interface DisputeEvidenceSummary {
  clerkId: string | null
  email: string | null
  name: string | null
  accountCreatedAt: string | null
  subscriptionStartedAt: string | null
  callsInWindow: number
  callTalkSeconds: number
  firstCallAt: string | null
  lastCallAt: string | null
  windowStart: string | null
  windowEnd: string | null
}

/** Resolve a Stripe customer to our Clerk id. Two tables carry the mapping and
 *  either may be the one populated, depending on how the account was created. */
async function resolveUser(customerId: string | null): Promise<{
  clerkId: string | null
  email: string | null
  name: string | null
  accountCreatedAt: string | null
}> {
  const empty = { clerkId: null, email: null, name: null, accountCreatedAt: null }
  if (!customerId) return empty

  const { data: userRow } = await supabase
    .from('users')
    .select('clerk_id, email, first_name, last_name, created_at')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (userRow?.clerk_id) {
    const name = [userRow.first_name, userRow.last_name].filter(Boolean).join(' ').trim()
    return {
      clerkId: userRow.clerk_id,
      email: userRow.email ?? null,
      name: name || null,
      accountCreatedAt: userRow.created_at ?? null,
    }
  }

  // Fall back to the subscription, which carries the same customer id.
  const { data: subRow } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!subRow?.user_id) return empty

  const { data: byClerk } = await supabase
    .from('users')
    .select('clerk_id, email, first_name, last_name, created_at')
    .eq('clerk_id', subRow.user_id)
    .maybeSingle()

  if (!byClerk?.clerk_id) return { ...empty, clerkId: subRow.user_id }

  const name = [byClerk.first_name, byClerk.last_name].filter(Boolean).join(' ').trim()
  return {
    clerkId: byClerk.clerk_id,
    email: byClerk.email ?? null,
    name: name || null,
    accountCreatedAt: byClerk.created_at ?? null,
  }
}

/** Usage is the evidence. Counted over the period the disputed charge paid for,
 *  widened to the whole account history when the window cannot be determined —
 *  an over-broad count is still true, and a missing one proves nothing. */
async function gatherUsage(clerkId: string | null, windowStart: string | null, windowEnd: string | null) {
  if (!clerkId) {
    return { callsInWindow: 0, callTalkSeconds: 0, firstCallAt: null, lastCallAt: null }
  }

  let q = supabase
    .from('calls')
    .select('created_at, duration')
    .eq('user_id', clerkId)
    .order('created_at', { ascending: true })

  if (windowStart) q = q.gte('created_at', windowStart)
  if (windowEnd) q = q.lte('created_at', windowEnd)

  const { data, error } = await q
  if (error || !data) {
    return { callsInWindow: 0, callTalkSeconds: 0, firstCallAt: null, lastCallAt: null }
  }

  const talk = data.reduce((n, r: any) => n + (Number(r.duration) || 0), 0)
  return {
    callsInWindow: data.length,
    callTalkSeconds: talk,
    firstCallAt: data.length > 0 ? (data[0] as any).created_at : null,
    lastCallAt: data.length > 0 ? (data[data.length - 1] as any).created_at : null,
  }
}

function hours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/**
 * Assemble evidence for a dispute, save it to Stripe as an unsubmitted draft,
 * and record it. Returns a short human summary for the notification.
 *
 * Never throws: this runs inside the Stripe webhook, where an exception would
 * make Stripe retry the whole event and re-run every handler before it.
 */
export async function assembleAndSaveDisputeEvidence(
  dispute: Stripe.Dispute
): Promise<{ ok: boolean; summary: string; clerkId: string | null }> {
  let clerkId: string | null = null

  try {
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null
    const piId =
      typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : dispute.payment_intent?.id ?? null

    // The charge carries the customer and the date the service period began.
    let customerId: string | null = null
    let chargeCreated: number | null = null
    if (chargeId) {
      try {
        const charge = await stripe.charges.retrieve(chargeId)
        customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? null
        chargeCreated = charge.created
      } catch (e) {
        console.error('[disputeEvidence] charge retrieve failed', e)
      }
    }

    const user = await resolveUser(customerId)
    clerkId = user.clerkId

    // The window the disputed charge paid for. Weekly billing, so the charge
    // date plus seven days is the period in question.
    const windowStart = chargeCreated ? new Date(chargeCreated * 1000).toISOString() : null
    const windowEnd = chargeCreated
      ? new Date((chargeCreated + 7 * 24 * 3600) * 1000).toISOString()
      : null

    const usage = await gatherUsage(clerkId, windowStart, windowEnd)

    const { data: subRow } = clerkId
      ? await supabase
          .from('subscriptions')
          .select('created_at')
          .eq('user_id', clerkId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null as any }

    const summary: DisputeEvidenceSummary = {
      clerkId,
      email: user.email,
      name: user.name,
      accountCreatedAt: user.accountCreatedAt,
      subscriptionStartedAt: subRow?.created_at ?? null,
      ...usage,
      windowStart,
      windowEnd,
    }

    // ── THE NARRATIVE ────────────────────────────────────────────────────
    // Stripe's reviewers read uncategorized_text. Leading with usage is
    // deliberate: it is the fact that decides "services not rendered", and it
    // is specific enough to be checkable.
    const activity =
      usage.callsInWindow > 0
        ? `The account placed ${usage.callsInWindow.toLocaleString()} calls ` +
          `totalling ${hours(usage.callTalkSeconds)} of connected talk time ` +
          `during the period this charge covers` +
          (usage.firstCallAt && usage.lastCallAt
            ? ` (first call ${usage.firstCallAt.slice(0, 10)}, last call ${usage.lastCallAt.slice(0, 10)}).`
            : '.')
        : 'No calls were placed during the period this charge covers.'

    const narrative = [
      `DialerSeat is a cloud dialing platform billed weekly in advance for each agent seat.`,
      activity,
      user.email ? `The account is registered to ${user.email}.` : '',
      summary.subscriptionStartedAt
        ? `The subscription was created on ${summary.subscriptionStartedAt.slice(0, 10)} through a checkout that required explicit acceptance of the recurring weekly charge.`
        : '',
      `Cancellation is self-service and available at any time from the billing page; no cancellation request was received for this period.`,
    ].filter(Boolean).join(' ')

    const evidence: Stripe.DisputeUpdateParams.Evidence = {
      product_description:
        'DialerSeat, cloud predictive/progressive dialer. One agent seat, billed weekly in advance.',
      refund_policy_disclosure: REFUND_POLICY_TEXT,
      uncategorized_text: narrative,
    }
    if (user.email) evidence.customer_email_address = user.email
    if (user.name) evidence.customer_name = user.name
    if (windowStart) evidence.service_date = windowStart.slice(0, 10)

    // Saved, NOT submitted. `submit` defaults to false; being explicit is the
    // point — this line is the difference between a reviewable draft and an
    // irreversible filing.
    let saveError: string | null = null
    try {
      await stripe.disputes.update(dispute.id, { evidence, submit: false })
    } catch (e: any) {
      saveError = e?.message || 'unknown Stripe error'
      console.error('[disputeEvidence] evidence save failed', e)
    }

    await supabase.from('billing_disputes').upsert(
      {
        stripe_dispute_id: dispute.id,
        stripe_charge_id: chargeId,
        stripe_payment_intent_id: piId,
        stripe_customer_id: customerId,
        user_id: clerkId,
        amount_cents: dispute.amount ?? 0,
        currency: dispute.currency ?? 'usd',
        reason: dispute.reason ?? null,
        status: dispute.status ?? null,
        evidence_due_by: dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toISOString()
          : null,
        evidence_saved_at: saveError ? null : new Date().toISOString(),
        evidence_error: saveError,
        evidence_summary: summary as any,
      },
      { onConflict: 'stripe_dispute_id' }
    )

    const who = user.name || user.email || clerkId || 'an unknown customer'
    const amount = ((dispute.amount ?? 0) / 100).toFixed(2)
    const due = dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toISOString().slice(0, 10)
      : 'unknown'

    return {
      ok: !saveError,
      clerkId,
      summary:
        `$${amount} disputed by ${who} (${dispute.reason || 'no reason given'}). ` +
        (usage.callsInWindow > 0
          ? `They placed ${usage.callsInWindow.toLocaleString()} calls in the period charged. `
          : `No calls in the period charged. `) +
        (saveError
          ? `Evidence could NOT be saved: ${saveError}. `
          : `Evidence drafted and saved to Stripe. `) +
        `Review and submit before ${due}.`,
    }
  } catch (err: any) {
    console.error('[disputeEvidence] assembly failed', err)
    return {
      ok: false,
      clerkId,
      summary:
        `A dispute was opened but evidence could not be assembled automatically ` +
        `(${err?.message || 'unknown error'}). Open it in Stripe and respond by hand.`,
    }
  }
}

/** Record the outcome when Stripe closes a dispute. Won or lost, it belongs in
 *  the same row so the dispute rate is answerable from our own data rather than
 *  from memory. */
export async function recordDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
  try {
    await supabase
      .from('billing_disputes')
      .update({
        status: dispute.status ?? null,
        outcome: dispute.status === 'won' ? 'won' : dispute.status === 'lost' ? 'lost' : dispute.status ?? null,
        closed_at: new Date().toISOString(),
      })
      .eq('stripe_dispute_id', dispute.id)
  } catch (e) {
    console.error('[disputeEvidence] close record failed', e)
  }
}
