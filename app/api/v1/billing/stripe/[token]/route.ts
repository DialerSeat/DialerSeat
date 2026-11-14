import { NextResponse, type NextRequest } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { cancelSubscription, recordSubscription, subscriptionFromInvoice, verifyStripeSignature } from '@/lib/developers/billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// A PLATFORM'S OWN STRIPE, FORWARDED TO US
// =============================================================================
// The platform adds this URL as a webhook endpoint in its own Stripe account
// (Snapshot payload; events invoice.paid and customer.subscription.deleted)
// and pastes the endpoint's whsec_ secret into the console. Then every paid
// invoice for a subscription activates or renews that user's seat, with no
// code on the platform's side. Put dialerseat_user_id in the subscription's
// metadata to use your own user id; otherwise the Stripe customer id is used.
//
// This is the platform's Stripe, not DialerSeat's: nothing here touches
// DialerSeat's own Stripe account or app/api/stripe/webhook.
// =============================================================================

const ok = (body: Record<string, unknown>) => NextResponse.json({ received: true, ...body })

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^dsbs_(test|live)_[0-9A-Za-z]{32}$/.test(token)) return NextResponse.json({ error: 'Unknown endpoint.' }, { status: 404 })
  const store = devStore()
  const source = await store.findBillingSourceByToken(token)
  if (!source) return NextResponse.json({ error: 'Unknown endpoint.' }, { status: 404 })
  if (!source.signing_secret) return NextResponse.json({ error: 'Paste this endpoint\'s Stripe signing secret into the DialerSeat console first.' }, { status: 400 })

  const raw = await req.text()
  if (!verifyStripeSignature(raw, req.headers.get('stripe-signature'), source.signing_secret)) {
    return NextResponse.json({ error: 'Signature did not verify. Check the signing secret in the DialerSeat console matches this endpoint in Stripe.' }, { status: 400 })
  }
  let event: { id?: string; type?: string; livemode?: boolean; data?: { object?: Record<string, unknown> } }
  try { event = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Body is not JSON.' }, { status: 400 }) }

  const platform = await store.getPlatform(source.platform_id)
  if (!platform) return NextResponse.json({ error: 'Unknown endpoint.' }, { status: 404 })
  await store.touchBillingSource(source.id)
  const env = source.env
  const o = event.data?.object || {}

  // Live Stripe events only reach a live endpoint, test only a test one.
  if (typeof event.livemode === 'boolean' && event.livemode !== (env === 'live')) {
    return ok({ ignored: `This is the ${env} endpoint; that event is ${event.livemode ? 'live' : 'test'} mode.` })
  }

  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    const sub = subscriptionFromInvoice(o)
    if (!sub) return ok({ ignored: 'Not a paid subscription invoice.' })
    // Keyed on the invoice, so invoice.paid and invoice.payment_succeeded for the same invoice count once.
    const r = await recordSubscription(platform, env, sub, 'stripe', `stripe_invoice:${sub.invoice_id}`)
    return ok({ seat: r.seat.id, kind: r.kind, duplicate: r.duplicate })
  }
  if (event.type === 'customer.subscription.deleted') {
    const id = typeof o.id === 'string' ? o.id : null
    if (!id) return ok({ ignored: 'No subscription id.' })
    const seat = await cancelSubscription(platform, env, { external_subscription_id: id }, false)
    return ok({ seat: seat?.id ?? null })
  }
  return ok({ ignored: `DialerSeat does not act on ${event.type || 'that event'}.` })
}
