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
  | 'cancel'
  | 'account_deleted'

interface BillingEventInput {
  event_type: BillingEventType
  clerk_id: string
  user_name: string
  user_email?: string | null
  plan?: 'pro' | 'wl' | null
  amount_cents?: number
  retention_weeks?: number | null
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
      amount_cents: input.amount_cents ?? 0,
      retention_weeks: input.retention_weeks ?? null,
      stripe_subscription_id: input.stripe_subscription_id ?? null,
    })
    if (error) {
      console.error('[billingEvents] insert failed:', error, input)
    }
  } catch (err) {
    console.error('[billingEvents] unexpected error:', err, input)
  }
}
