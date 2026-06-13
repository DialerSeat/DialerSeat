import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// =============================================================================
// WL BILLING (v1, NEW)
// =============================================================================
//   GET /api/admin/billing
//     → { success, portfolio, tenants } — list mode, all tenants
//   GET /api/admin/billing?tenant_id=<uuid>
//     → { success, tenant } — detail mode, one tenant with live Stripe state
//       + recent invoices
//
// LIST MODE (analytical roll-up):
//   portfolio: {
//     tenantCount, billedCount, activeCount, pastDueCount, canceledCount,
//     mrrCents, arrCents, currency
//   }
//   tenants: [{ id, slug, brand_name, status (tenant row status),
//     stripe_customer_id, stripe_subscription_id,
//     billing: { state, planNickname, amountCents, interval,
//       currentPeriodEnd, cancelAtPeriodEnd, mrrCents } | null,
//     billingError? }]
//
// MRR normalization: any Stripe interval (day/week/month/year) is converted to
// a monthly-equivalent cents figure so the portfolio total is apples-to-apples.
// DialerSeat bills weekly, so weekly × 52 / 12 dominates here.
//
// Per-tenant Stripe calls are made in parallel with Promise.allSettled so one
// bad/canceled subscription can't blank the whole table — failures surface as
// billingError on that row and the rest still render.
// =============================================================================

const MONTHS_PER = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 } as const

function monthlyCents(amountCents: number, interval: string, intervalCount: number): number {
  const per = (MONTHS_PER as Record<string, number>)[interval] ?? 1
  // amount is charged every `intervalCount` intervals
  return Math.round((amountCents * per) / Math.max(1, intervalCount))
}

interface BillingState {
  state: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'none'
  planNickname: string | null
  amountCents: number
  currency: string
  interval: string
  intervalCount: number
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  mrrCents: number
}

async function fetchSubscriptionState(subId: string): Promise<BillingState> {
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
  const item = sub.items.data[0]
  const price = item?.price
  const amount = price?.unit_amount ?? 0
  const interval = price?.recurring?.interval ?? 'month'
  const intervalCount = price?.recurring?.interval_count ?? 1
  const qty = item?.quantity ?? 1
  const lineCents = amount * qty
  const live = sub.status === 'active' || sub.status === 'trialing'

  // current_period_end moved from the top-level Subscription onto the
  // subscription item in recent Stripe API versions. Read the item first,
  // fall back to the legacy top-level field for older API versions.
  const periodEndUnix =
    (item as any)?.current_period_end ??
    (sub as any).current_period_end ??
    null

  return {
    state: sub.status as BillingState['state'],
    planNickname: price?.nickname ?? null,
    amountCents: lineCents,
    currency: (price?.currency ?? 'usd').toUpperCase(),
    interval,
    intervalCount,
    currentPeriodEnd: periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    mrrCents: live ? monthlyCents(lineCents, interval, intervalCount) : 0,
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const tenantId = req.nextUrl.searchParams.get('tenant_id')

    // ── DETAIL MODE ───────────────────────────────────────────────────────
    if (tenantId) {
      const { data: tenant, error } = await supabase
        .from('white_label_tenants')
        .select('id, slug, brand_name, status, is_active, stripe_customer_id, stripe_subscription_id, created_at')
        .eq('id', tenantId)
        .maybeSingle()
      if (error) throw error
      if (!tenant) {
        return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 })
      }

      let billing: BillingState | null = null
      let billingError: string | null = null
      let invoices: Array<{
        id: string; amountCents: number; currency: string; status: string | null
        created: string; reason: string | null; hostedUrl: string | null; pdfUrl: string | null
      }> = []

      if (tenant.stripe_subscription_id) {
        try {
          billing = await fetchSubscriptionState(tenant.stripe_subscription_id)
        } catch (e: any) {
          billingError = e?.message || 'Failed to load subscription from Stripe'
        }
      }

      if (tenant.stripe_customer_id) {
        try {
          const list = await stripe.invoices.list({ customer: tenant.stripe_customer_id, limit: 12 })
          invoices = list.data.map(inv => ({
            id: inv.id,
            amountCents: inv.amount_paid ?? inv.amount_due ?? 0,
            currency: (inv.currency ?? 'usd').toUpperCase(),
            status: inv.status,
            created: new Date((inv.created as number) * 1000).toISOString(),
            reason: inv.billing_reason ?? null,
            hostedUrl: inv.hosted_invoice_url ?? null,
            pdfUrl: inv.invoice_pdf ?? null,
          }))
        } catch (e: any) {
          if (!billingError) billingError = e?.message || 'Failed to load invoices from Stripe'
        }
      }

      return NextResponse.json({
        success: true,
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          brand_name: tenant.brand_name,
          status: tenant.status,
          stripe_customer_id: tenant.stripe_customer_id,
          stripe_subscription_id: tenant.stripe_subscription_id,
          billing,
          billingError,
          invoices,
        },
      })
    }

    // ── LIST MODE ─────────────────────────────────────────────────────────
    const { data: tenants, error } = await supabase
      .from('white_label_tenants')
      .select('id, slug, brand_name, status, is_active, stripe_customer_id, stripe_subscription_id, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error

    const rows = await Promise.allSettled(
      (tenants ?? []).map(async t => {
        let billing: BillingState | null = null
        let billingError: string | null = null
        if (t.stripe_subscription_id) {
          try {
            billing = await fetchSubscriptionState(t.stripe_subscription_id)
          } catch (e: any) {
            billingError = e?.message || 'Stripe lookup failed'
          }
        }
        return { ...t, billing, billingError }
      })
    )

    const resolved = rows.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { ...(tenants ?? [])[i], billing: null, billingError: 'Lookup failed' }
    )

    let mrrCents = 0
    let billedCount = 0
    let activeCount = 0
    let pastDueCount = 0
    let canceledCount = 0
    let currency = 'USD'

    for (const t of resolved) {
      if (t.stripe_subscription_id) billedCount++
      if (t.billing) {
        currency = t.billing.currency || currency
        mrrCents += t.billing.mrrCents
        if (t.billing.state === 'active' || t.billing.state === 'trialing') activeCount++
        else if (t.billing.state === 'past_due' || t.billing.state === 'unpaid') pastDueCount++
        else if (t.billing.state === 'canceled' || t.billing.state === 'incomplete_expired') canceledCount++
      }
    }

    return NextResponse.json({
      success: true,
      portfolio: {
        tenantCount: resolved.length,
        billedCount,
        activeCount,
        pastDueCount,
        canceledCount,
        mrrCents,
        arrCents: mrrCents * 12,
        currency,
      },
      tenants: resolved,
    })
  } catch (err: any) {
    console.error('[admin/billing] failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load billing' },
      { status }
    )
  }
}