import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { isSubscriptionTrulyActive } from '@/lib/subscriptionStatus'
import Stripe from 'stripe'

const supabase = getServiceClient('admin/billing')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const MONTHS_PER = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 } as const

function monthlyCents(amountCents: number, interval: string, intervalCount: number): number {
  const per = (MONTHS_PER as Record<string, number>)[interval] ?? 1

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
  // MRR should reflect money that's actually recurring right now — a
  // trialing subscription hasn't been charged yet, and one that's
  // cancel_at_period_end won't renew, so neither should count toward
  // forward-looking revenue. Same definition used for the admin active
  // label; only the revenue figure is affected — `state` below still
  // reports the literal Stripe status regardless.
  const live = isSubscriptionTrulyActive({ status: sub.status, cancel_at_period_end: sub.cancel_at_period_end })

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

    if (tenantId) {
      const { data: tenant, error } = await supabase
        .from('white_label_tenants')
        .select('id, slug, brand_name, status, is_active, is_demo, stripe_customer_id, stripe_subscription_id, created_at')
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
          is_demo: !!tenant.is_demo,
          stripe_customer_id: tenant.stripe_customer_id,
          stripe_subscription_id: tenant.stripe_subscription_id,
          billing,
          billingError,
          invoices,
        },
      })
    }

    const { data: tenants, error } = await supabase
      .from('white_label_tenants')
      .select('id, slug, brand_name, status, is_active, is_demo, stripe_customer_id, stripe_subscription_id, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error

    const rows = await Promise.allSettled(
      (tenants ?? []).map(async t => {
        let billing: BillingState | null = null
        let billingError: string | null = null
        if (t.stripe_subscription_id && !t.is_demo) {
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
    let demoCount = 0
    let currency = 'USD'

    const finalRows = resolved.map(t => {
      if (t.is_demo) {
        demoCount++
        // Demo tenants are internal test accounts — never counted toward
        // billed/active/past-due/canceled totals or MRR, and their Stripe
        // state (if any real subscription happens to be attached) is
        // deliberately not surfaced as "active"/revenue on this row so it
        // can't be mistaken for a paying customer.
        return { ...t, billing: null, billingError: null }
      }
      if (t.stripe_subscription_id) billedCount++
      if (t.billing) {
        currency = t.billing.currency || currency
        mrrCents += t.billing.mrrCents
        if (t.billing.state === 'active' || t.billing.state === 'trialing') activeCount++
        else if (t.billing.state === 'past_due' || t.billing.state === 'unpaid') pastDueCount++
        else if (t.billing.state === 'canceled' || t.billing.state === 'incomplete_expired') canceledCount++
      }
      return t
    })

    return NextResponse.json({
      success: true,
      portfolio: {
        tenantCount: resolved.length,
        billedCount,
        activeCount,
        pastDueCount,
        canceledCount,
        demoCount,
        mrrCents,
        arrCents: mrrCents * 12,
        currency,
      },
      tenants: finalRows,
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