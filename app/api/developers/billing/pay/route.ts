import { NextResponse, type NextRequest } from 'next/server'
import { balanceFor } from '@/lib/developers/billing'
import { devBase, jsonError, requirePlatform, signedInEmail } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Pay the live balance: a one-off Stripe Checkout on DialerSeat's account for
 * exactly what is owed. The console records the payment when Checkout sends
 * the owner back (app/developers/console/billing, ?paid=). Tagged
 * product=developers so dialerseat.com's own billing never counts it.
 */
export async function POST(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { platform } = r.ctx
  const { balance } = await balanceFor(platform, 'live')
  if (balance.due_cents < 50) return jsonError(400, 'nothing_due', 'There is nothing to pay right now.')

  const { stripe } = await import('@/lib/stripe')
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`
  const base = await devBase()
  const meta = { product: 'developers', dev_platform_id: platform.id }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: (await signedInEmail()) || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: balance.currency,
        unit_amount: balance.due_cents,
        product_data: { name: `DialerSeat for Developers: ${platform.name}`, description: 'Balance for seats your users paid for' },
      },
    }],
    metadata: meta,
    payment_intent_data: { metadata: meta },
    success_url: `${origin}${base}/console/billing?paid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${base}/console/billing`,
  })
  return NextResponse.json({ url: session.url })
}
