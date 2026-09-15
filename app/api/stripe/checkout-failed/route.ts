import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('stripe/checkout-failed')

// =============================================================================
// WHY A SIGNUP DID NOT CONVERT
// =============================================================================
// Reported by the browser when stripe.confirmPayment / confirmSetup comes back
// with an error, because that is the only place the reason exists. Stripe hands
// the client a precise code -- card_declined, insufficient_funds,
// authentication_failure, expired_card -- and until now app/billing/page.tsx
// rendered it to the user and dropped it.
//
// What that cost: 19 of 34 users have tried to subscribe and never succeeded,
// across 27 attempts, and not one of those failures left a record. The
// difference between "their banks keep declining" and "our 3-D Secure step is
// broken" is invisible, and those have opposite fixes -- one is nothing to do
// with us, the other is losing every signup.
//
// ── THIS IS A DIAGNOSTIC AND NOTHING ELSE ──────────────────────────────────
// It grants nothing, bills nothing and gates nothing. The failure it records
// already happened, on Stripe's side, and Stripe remains the authority on
// whether anyone was charged. A client could post a fabricated reason and the
// worst outcome is one misleading row in a table nobody bills from.

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, error: 'Body required' }, { status: 400 })
    }

    // Trimmed hard. These are attacker-controllable strings heading into a log
    // somebody will read, and a decline code is never long.
    const str = (v: unknown, max = 300): string | null =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

    // Name and email come from Clerk, not the request, so a row can always be
    // traced to a real person even if the client sends nothing useful.
    let name = userId
    let email: string | null = null
    try {
      const u = await currentUser()
      if (u) {
        const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
        email = u.emailAddresses?.[0]?.emailAddress ?? null
        name = full || email || userId
      }
    } catch {
      // Never fail the diagnostic over a profile lookup.
    }

    const { error } = await supabase.from('billing_events').insert({
      clerk_id: userId,
      event_type: 'checkout_failed',
      plan: str(body.plan, 40),
      // NOT NULL on this table, and no money moved.
      amount_cents: 0,
      stripe_subscription_id: null,
      user_name: name,
      user_email: email,
      detail: {
        // Stripe's own vocabulary, kept verbatim -- these are the fields that
        // separate a declined card from a failed authentication step.
        code: str(body.code, 80),
        decline_code: str(body.decline_code, 80),
        type: str(body.type, 80),
        message: str(body.message, 500),
        payment_intent_status: str(body.payment_intent_status, 80),
        // 'payment' is a first charge; 'setup' is a card being saved for a
        // team seat. Different flows with different failure modes.
        confirm_mode: str(body.confirm_mode, 20),
        team_member_id: str(body.team_member_id, 60),
        at: new Date().toISOString(),
      },
    })

    if (error) {
      console.error('[stripe/checkout-failed] insert failed:', error.message)
      return NextResponse.json({ success: false }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, { route: 'stripe/checkout-failed' })
  }
}
