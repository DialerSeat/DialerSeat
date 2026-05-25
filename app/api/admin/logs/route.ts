import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/requireAdmin'

// =============================================================================
// /api/admin/logs
// =============================================================================
// Unified purchase/renewal/cancel timeline across all customers.
//
// SOURCES (merged by date desc):
//   1. Stripe paid invoices (last 90 days)
//        - First invoice on a subscription → 'signup'
//        - Subsequent invoices on a subscription → 'renewal'
//        - retention_weeks = (invoice.created - subscription.created) / 1 week
//   2. Stripe canceled subscriptions (last 90 days, by ended_at)
//        - One 'cancel' event per canceled sub
//   3. Supabase team_seat_charges (last 90 days, status='paid')
//        - Deduped against Stripe by stripe_invoice_id when present
//        - Provides a fallback for invoices that pre-date Stripe access or
//          where Stripe sync was disabled (defensive — should be rare)
//
// STRIPE API NOTE:
//   In Stripe API 2025+, `invoice.subscription` was removed. The subscription
//   ID now lives on each line item: `invoice.lines.data[0].subscription`.
//   We expand `data.lines.data.subscription` so each invoice ships with its
//   full subscription object inline.
//
// NAME LOOKUP:
//   Stripe customers have email/name. We try Stripe first, then look up
//   users.full_name by email if Stripe name is missing. Falls back to email
//   prefix, then '(unknown)'.
//
// PERFORMANCE NOTE:
//   This route hits Stripe ~2 times in parallel. For a v1 admin tool with
//   <100 customers it's fine; cap at 90 days and 100 results per source.
//   If this gets slow we can move to a cron that materializes a logs table.
// =============================================================================

// Let Stripe pick its default API version — matches whatever the rest of the
// codebase uses (e.g. webhook routes). Pinning `apiVersion` here would force
// a string-literal type match, and the type changes between SDK versions.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60

interface LogEntry {
  id: string                    // stable id for React keys; e.g. `stripe_inv:in_xxx`
  event_type: 'signup' | 'renewal' | 'cancel'
  user_name: string
  user_email: string | null
  amount_cents: number          // negative for refunds (not handled yet); 0 for cancels
  date_iso: string              // ISO timestamp for sort + display
  retention_weeks: number | null // null for cancels-without-known-start
  source: 'stripe_invoice' | 'stripe_cancel' | 'team_seat_charge'
}

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }

  const cutoffUnix = Math.floor(Date.now() / 1000) - NINETY_DAYS_SECONDS

  try {
    // ── PARALLEL FETCH: Stripe invoices, Stripe canceled subs, Supabase charges
    const [invoicesResp, canceledSubsResp, supabaseChargesResp] = await Promise.all([
      stripe.invoices.list({
        status: 'paid',
        created: { gte: cutoffUnix },
        limit: 100,
        // Stripe API 2025+: subscription lives on the line items, not the
        // invoice itself. Expand the line items' subscription so we don't
        // need a second round trip per invoice.
        expand: ['data.lines.data.subscription', 'data.customer'],
      }),
      stripe.subscriptions.list({
        status: 'canceled',
        limit: 100,
        expand: ['data.customer'],
      }),
      fetchSupabaseCharges(cutoffUnix),
    ])

    // ── STRIPE INVOICES → entries
    const stripeInvoiceEntries: LogEntry[] = []
    const seenStripeInvoiceIds = new Set<string>()

    for (const inv of invoicesResp.data) {
      if (!inv.created || inv.created < cutoffUnix) continue
      if (inv.id) seenStripeInvoiceIds.add(inv.id)

      // Pull subscription from the first line item. `firstLine` is typed
      // as `any` because the SDK's `InvoiceLineItem.subscription` field
      // appears as `string | undefined` in some SDK versions and as
      // `string | Stripe.Subscription | null` in others. Both shapes are
      // handled by `expandedAsSubscription`.
      const firstLine: any = inv.lines?.data?.[0]
      const sub = firstLine ? expandedAsSubscription(firstLine.subscription) : null
      const customer = expandedAsCustomer(inv.customer)

      // Classify signup vs renewal:
      //   If the invoice's created timestamp is within ~1 day of the
      //   subscription.created timestamp, it's the first invoice → signup.
      //   Otherwise → renewal.
      // Edge case: one-off invoices (no subscription) are classified as signup.
      let eventType: 'signup' | 'renewal' = 'signup'
      let retentionWeeks: number | null = null

      if (sub && sub.created) {
        const ageSeconds = inv.created - sub.created
        const ONE_DAY = 24 * 60 * 60
        eventType = ageSeconds < ONE_DAY ? 'signup' : 'renewal'
        retentionWeeks = Math.max(0, Math.round(ageSeconds / (7 * ONE_DAY)))
      }

      const { name, email } = extractCustomerIdentity(customer, sub)

      stripeInvoiceEntries.push({
        id: `stripe_inv:${inv.id}`,
        event_type: eventType,
        user_name: name,
        user_email: email,
        amount_cents: inv.amount_paid ?? 0,
        date_iso: new Date(inv.created * 1000).toISOString(),
        retention_weeks: retentionWeeks,
        source: 'stripe_invoice',
      })
    }

    // ── STRIPE CANCELED SUBS → entries
    const cancelEntries: LogEntry[] = []
    for (const sub of canceledSubsResp.data) {
      const endedAt = sub.ended_at ?? sub.canceled_at
      if (!endedAt || endedAt < cutoffUnix) continue

      const customer = expandedAsCustomer(sub.customer)
      const { name, email } = extractCustomerIdentity(customer, sub)

      // How long did they stick around before canceling?
      let retentionWeeks: number | null = null
      if (sub.created && endedAt > sub.created) {
        retentionWeeks = Math.max(0, Math.round((endedAt - sub.created) / (7 * 24 * 60 * 60)))
      }

      cancelEntries.push({
        id: `stripe_cancel:${sub.id}`,
        event_type: 'cancel',
        user_name: name,
        user_email: email,
        amount_cents: 0,
        date_iso: new Date(endedAt * 1000).toISOString(),
        retention_weeks: retentionWeeks,
        source: 'stripe_cancel',
      })
    }

    // ── SUPABASE CHARGES → entries (deduped)
    const supabaseEntries: LogEntry[] = supabaseChargesResp
      .filter(c => !c.stripe_invoice_id || !seenStripeInvoiceIds.has(c.stripe_invoice_id))
      .map(c => ({
        id: `supabase_chg:${c.id}`,
        event_type: c.event_type,
        user_name: c.user_name || c.user_email || '(unknown)',
        user_email: c.user_email,
        amount_cents: c.amount_cents,
        date_iso: c.date_iso,
        retention_weeks: c.retention_weeks,
        source: 'team_seat_charge',
      }))

    // ── MERGE + SORT
    const merged = [...stripeInvoiceEntries, ...cancelEntries, ...supabaseEntries]
      .sort((a, b) => b.date_iso.localeCompare(a.date_iso))
      .slice(0, 200) // cap response size

    return NextResponse.json({
      entries: merged,
      counts: {
        signups: merged.filter(e => e.event_type === 'signup').length,
        renewals: merged.filter(e => e.event_type === 'renewal').length,
        cancels: merged.filter(e => e.event_type === 'cancel').length,
      },
      window_days: 90,
    })
  } catch (err: any) {
    console.error('[/api/admin/logs] error:', err)
    return NextResponse.json(
      { error: 'Failed to load logs', detail: err?.message || String(err) },
      { status: 500 }
    )
  }
}

// =============================================================================
// HELPERS
// =============================================================================

interface SupabaseChargeRow {
  id: string
  event_type: 'signup' | 'renewal'
  user_name: string | null
  user_email: string | null
  amount_cents: number
  date_iso: string
  retention_weeks: number | null
  stripe_invoice_id: string | null
}

/**
 * Pulls team_seat_charges rows in window, joining users for name/email.
 * Returns [] on error rather than throwing — Stripe is the primary source.
 */
async function fetchSupabaseCharges(cutoffUnix: number): Promise<SupabaseChargeRow[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const cutoffIso = new Date(cutoffUnix * 1000).toISOString()

    // team_seat_charges columns we rely on (verify against your schema):
    //   id, user_id (clerk text), amount_cents, status, stripe_invoice_id,
    //   stripe_subscription_item_id, created_at
    //
    // If your column names differ, adjust the .select() and downstream
    // mapping. We do NOT try to classify signup-vs-renewal here because
    // Stripe is the source of truth for that — Supabase rows are only
    // surfaced when their stripe_invoice_id isn't already represented.
    const { data: charges, error } = await supabase
      .from('team_seat_charges')
      .select('id, user_id, amount_cents, status, stripe_invoice_id, created_at')
      .eq('status', 'paid')
      .gte('created_at', cutoffIso)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error || !charges) {
      console.warn('[/api/admin/logs] team_seat_charges fetch failed:', error?.message)
      return []
    }

    // Look up user names by clerk_id
    const clerkIds = [...new Set(charges.map(c => c.user_id).filter(Boolean))]
    const userMap = new Map<string, { name: string | null; email: string | null }>()
    if (clerkIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('clerk_id, full_name, email')
        .in('clerk_id', clerkIds)
      if (users) {
        for (const u of users) {
          userMap.set(u.clerk_id, { name: u.full_name, email: u.email })
        }
      }
    }

    return charges.map((c: any): SupabaseChargeRow => {
      const u = userMap.get(c.user_id) || { name: null, email: null }
      return {
        id: c.id,
        event_type: 'renewal', // conservative — Stripe-side classification wins via dedup
        user_name: u.name,
        user_email: u.email,
        amount_cents: c.amount_cents ?? 0,
        date_iso: c.created_at,
        retention_weeks: null,
        stripe_invoice_id: c.stripe_invoice_id ?? null,
      }
    })
  } catch (err) {
    console.warn('[/api/admin/logs] supabase fetch threw:', err)
    return []
  }
}

/**
 * Returns the customer name + email from an expanded Stripe customer object.
 * Some customers may be deleted or anonymous; we handle gracefully.
 */
function extractCustomerIdentity(
  customer: Stripe.Customer | null,
  sub: Stripe.Subscription | null
): { name: string; email: string | null } {
  const email = customer?.email ?? null

  let name = ''
  if (customer?.name) name = customer.name
  if (!name && customer?.metadata?.full_name) name = customer.metadata.full_name
  if (!name && sub?.metadata?.full_name) name = sub.metadata.full_name
  if (!name && email) name = email.split('@')[0]
  if (!name) name = '(unknown)'

  return { name, email }
}

function expandedAsSubscription(
  value: string | Stripe.Subscription | null | undefined
): Stripe.Subscription | null {
  if (!value || typeof value === 'string') return null
  if ('deleted' in value && value.deleted) return null
  return value as Stripe.Subscription
}

function expandedAsCustomer(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): Stripe.Customer | null {
  if (!value || typeof value === 'string') return null
  if ('deleted' in value && value.deleted) return null
  return value as Stripe.Customer
}