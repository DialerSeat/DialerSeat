import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// THERE WAS NO WAY TO CHANGE A CARD
//
// Not a missing nicety — a dead end that the product kept pointing people at.
// A failed seat charge told an owner to update their payment method in
// Billing. Resuming a paused subscription after a decline said the same. The
// billing page itself only ever collected a card for a NEW subscription, so
// there was nothing behind either instruction: no card list, no way to add a
// second one, no way to replace an expired one short of cancelling and
// starting again.
//
// Stripe's billing portal rather than a card form of our own. That decision is
// about liability as much as effort: a hosted portal means no card number ever
// reaches this application, so the PCI surface stays where Stripe already
// carries it. It also brings invoice history and cancellation for free, which
// are the other two things people come to a billing page for.
//
// Requires the portal to be configured once in the Stripe dashboard
// (Settings → Billing → Customer portal). Until then Stripe returns a specific
// error, which is passed through rather than flattened into "something went
// wrong" — the person reading it is the one who can fix it.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!user?.stripe_customer_id) {
      // Nothing to manage yet. Said plainly, because "no customer record" is
      // Stripe's phrasing for "you have never paid us", which is not an error
      // and should not read like one.
      return NextResponse.json({
        success: false,
        error: 'You do not have a payment method on file yet.',
        detail: 'Start a subscription first — the card you use becomes the one you can manage here.',
        noCustomer: true,
      }, { status: 400 })
    }

    const origin =
      req.headers.get('origin') ||
      `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'}`

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${origin}/dashboard/settings`,
    })

    return NextResponse.json({ success: true, url: session.url })
  } catch (err: any) {
    const message = err?.message || 'Could not open the billing portal.'
    console.error('[stripe/portal]', message)

    // The one failure worth naming exactly. Stripe says the portal has no
    // configuration until somebody saves it once in the dashboard, and that
    // sentence is the entire fix — flattening it into a generic error would
    // hide the instruction inside it.
    const needsConfiguration = /configuration/i.test(message)

    return NextResponse.json({
      success: false,
      error: needsConfiguration
        ? 'The Stripe billing portal has not been set up on this account yet.'
        : 'Could not open the billing portal.',
      detail: needsConfiguration
        ? 'In Stripe: Settings → Billing → Customer portal, save the configuration once. ' +
          'It then works for every customer.'
        : message,
    }, { status: 500 })
  }
}
