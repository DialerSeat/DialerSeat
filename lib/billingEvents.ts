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
