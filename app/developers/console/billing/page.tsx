import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { BillingControls } from '@/components/developers/console/BillingControls'
import { consoleContext, consoleEnv, signedInEmail } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'
import { balanceFor } from '@/lib/developers/billing'
import { API_BASE, TIERS } from '@/lib/developers/catalog'

export const metadata: Metadata = { title: 'Billing' }
export const dynamic = 'force-dynamic'

/**
 * A Stripe Checkout for the balance came back paid: record it once. The
 * session is read back from Stripe, never trusted from the URL.
 */
async function recordCheckout(platformId: string, sessionId: string): Promise<'paid' | 'not_paid' | null> {
  if (!/^cs_(test|live)_[0-9A-Za-z]+$/.test(sessionId)) return null
  try {
    const { stripe } = await import('@/lib/stripe')
    const s = await stripe.checkout.sessions.retrieve(sessionId)
    if (s.metadata?.product !== 'developers' || s.metadata?.dev_platform_id !== platformId) return null
    if (s.payment_status !== 'paid' || !s.amount_total) return 'not_paid'
    await devStore().insertLedger({
      platform_id: platformId, env: 'live', kind: 'owner_payment', seat_id: null, external_user_id: null, external_subscription_id: null,
      customer_amount_cents: null, fee_cents: -s.amount_total, currency: s.currency || 'usd', period_start: null, period_end: null,
      source: 'checkout', idempotency_key: `checkout:${s.id}`, note: 'Paid by card through Stripe Checkout',
    })
    return 'paid'
  } catch {
    return null
  }
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const { platform } = await consoleContext()
  const env = await consoleEnv()
  const sp = await searchParams
  const checkout = sp.paid ? await recordCheckout(platform.id, sp.paid) : null
  const [email, { balance, rows }, source] = await Promise.all([
    signedInEmail(), balanceFor(platform, env), devStore().getBillingSource(platform.id, env),
  ])
  return (
    <>
      <PageHead title="Billing" sub="Your users pay you. You tell DialerSeat when they do, their seat dials for the period they paid for, and DialerSeat's cut goes on your balance. Building in test mode is free." />
      <BillingControls
        env={env}
        apiBase={API_BASE}
        checkout={checkout}
        platform={{
          id: platform.id, name: platform.name, website: platform.website, tier: platform.tier,
          live_status: platform.live_status, live_requested_at: platform.live_requested_at, live_activated_at: platform.live_activated_at,
          billing_model: platform.billing_model, cut_model: platform.cut_model,
          rate_seat_week: platform.rate_seat_week, rate_included_dials: platform.rate_included_dials,
          rate_per_dial: platform.rate_per_dial, revenue_share_pct: platform.revenue_share_pct,
        }}
        balance={balance}
        rows={rows.slice(0, 50).map(r => ({
          id: r.id, kind: r.kind, external_user_id: r.external_user_id, customer_amount_cents: r.customer_amount_cents,
          fee_cents: r.fee_cents, currency: r.currency, period_start: r.period_start, period_end: r.period_end, source: r.source, created_at: r.created_at,
        }))}
        stripe={source ? { token: source.token, has_secret: !!source.signing_secret, last_event_at: source.last_event_at } : null}
        email={email}
        tiers={TIERS}
      />
    </>
  )
}
