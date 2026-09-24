import { getServiceClient } from '@/lib/supabase'

// Append-only billing/account lifecycle event logger. Same philosophy as
// lib/callEvents.ts: this is a forensic/audit trail, not a control path —
// it must NEVER throw or block the caller. A failed write here should
// never take down a live Stripe webhook or a user's own account-deletion
// request; it's swallowed and logged instead.
//
// This is also the SINGLE place that decides what a billing/account event
// "means" in human terms (user_name, plan label) — both the admin Logs
// page and push notifications (lib/pushNotify.ts) should read data that
// ultimately came from calling this, so the two surfaces can never drift
// out of sync with each other again the way they did before.
//
// See migrations/BILLING_EVENTS_AUDIT_LOG_2026-07-18.sql for the schema
// and the full reasoning: this table has no foreign key to `users`, is
// written once at the moment each event happens with a denormalized
// name/email snapshot, and is append-only even against service_role — so
// deleting an account (lib/deleteAccount.ts) can never cascade into
// deleting its own history.

export type BillingEventType =
  | 'account_created'
  | 'initial_sub'
  | 'resub'
  | 'renewal'
  // Somebody pressed cancel. Logged when they DO it, not when the
  // subscription finally lapses — the gap between the two is the only window
  // in which anything can be done about it.
  | 'cancel_scheduled'
  | 'cancel'
  // A card was declined. This was being written straight to the table by the
  // webhook, bypassing this type, and nested inside an optional lookup — so
  // in two months not one decline was recorded. See the webhook.
  | 'payment_failed'
  | 'account_deleted'
  // Checkout bookkeeping. checkout_started is written when the card form
  // loads (create-subscription), checkout_failed when Stripe declines at
  // checkout, checkout_stalled by the checkout-stalls cron when somebody
  // reached the form and left. None of the three were landing until 24 Sept
  // 2026: the table's check constraint only allowed the six original types.
  | 'checkout_started'
  | 'checkout_failed'
  | 'checkout_stalled'

// ── WHAT THE LOG FEEDS SHOW ─────────────────────────────────────────────────
// Two of the checkout types exist for the stalled-checkout alert, not for a
// person to read: one checkout_started per billing-page visit would bury the
// feed. The alert itself reaches the Notifications history through
// sendAdminPush like every other push.
//
// A decline at checkout is the opposite: it IS something to read, and it
// arrives up to three times within seconds (invoice.payment_failed as
// payment_failed, payment_intent.payment_failed and the browser's own report
// as checkout_failed). So the feeds show each one once, as the card-declined
// entry the Logs app already knows how to draw.
const HIDDEN_FROM_FEEDS = new Set(['checkout_started', 'checkout_stalled'])
const SAME_DECLINE_MS = 10 * 60 * 1000

export function normaliseBillingFeed<
  T extends { clerk_id: string | null; event_type: string | null; created_at: string }
>(rows: T[]): T[] {
  const out: T[] = []
  const lastDecline = new Map<string, number>()
  // Oldest first, so the FIRST report of a decline is the one kept.
  const ordered = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const row of ordered) {
    if (row.event_type && HIDDEN_FROM_FEEDS.has(row.event_type)) continue
    if (row.event_type === 'payment_failed' || row.event_type === 'checkout_failed') {
      const at = Date.parse(row.created_at)
      const key = row.clerk_id || ''
      // Measured from the last decline SHOWN, so a second attempt twenty
      // minutes later still appears as its own entry.
      const prev = lastDecline.get(key)
      if (key && prev !== undefined && at - prev < SAME_DECLINE_MS) continue
      lastDecline.set(key, at)
      out.push({ ...row, event_type: 'payment_failed' } as T)
      continue
    }
    out.push(row)
  }
  // Back to the newest-first order both feeds render in.
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

interface BillingEventInput {
  event_type: BillingEventType
  clerk_id: string
  user_name: string
  user_email?: string | null
  plan?: 'pro' | 'wl' | null
  /**
   * The real amount from the Stripe invoice, in cents.
   *
   * Omit it when there is no invoice to read. It is recorded as NULL and the
   * log shows a dash — never a plan's list price standing in for a figure
   * nobody checked.
   */
  amount_cents?: number | null
  retention_weeks?: number | null
  /**
   * Structured context for events where "what happened" needs a why —
   * a decline code, the seller message. Stored as jsonb.
   */
  detail?: Record<string, unknown> | null
  stripe_subscription_id?: string | null
}

export async function logBillingEvent(input: BillingEventInput): Promise<void> {
  try {
    const db = getServiceClient('billing-events')
    const { error } = await db.from('billing_events').insert({
      event_type: input.event_type,
      clerk_id: input.clerk_id,
      user_name: input.user_name,
      user_email: input.user_email ?? null,
      plan: input.plan ?? null,
      // `?? null`, not `?? 0`. Zero is a real amount — a fully discounted
      // cycle is worth telling apart from an unknown one.
      amount_cents: input.amount_cents ?? null,
      retention_weeks: input.retention_weeks ?? null,
      stripe_subscription_id: input.stripe_subscription_id ?? null,
      detail: input.detail ?? null,
    })
    if (error) {
      console.error('[billingEvents] insert failed:', error, input)
    }
  } catch (err) {
    console.error('[billingEvents] unexpected error:', err, input)
  }
}
