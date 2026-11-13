import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { BillingControls } from '@/components/developers/console/BillingControls'
import { consoleContext, signedInEmail } from '@/lib/developers/server'
import { TIERS } from '@/lib/developers/catalog'

export const metadata: Metadata = { title: 'Billing' }
export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const { platform } = await consoleContext()
  const email = await signedInEmail()
  return (
    <>
      <PageHead title="Billing" sub="Building is free. You pay when calls are real. Rates for platforms are negotiated on volume and leverage, and are subject to change." />
      <BillingControls
        platform={{
          id: platform.id, name: platform.name, website: platform.website, tier: platform.tier,
          live_status: platform.live_status, live_requested_at: platform.live_requested_at, live_activated_at: platform.live_activated_at,
          billing_model: platform.billing_model,
          rate_seat_week: platform.rate_seat_week, rate_included_dials: platform.rate_included_dials,
          rate_per_dial: platform.rate_per_dial, revenue_share_pct: platform.revenue_share_pct,
        }}
        email={email}
        tiers={TIERS}
      />
    </>
  )
}
