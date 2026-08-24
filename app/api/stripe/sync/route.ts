import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { persistableStatus } from '@/lib/trialCard'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('stripe/sync')

// ─────────────────────────────────────────────────────────────────────────
// PULL THE TRUTH FROM STRIPE, RIGHT NOW
//
// The other half of lib/trialCard.ts. That file stops a trial from counting
// as access until a card is confirmed; this one makes sure the access appears
// the moment it IS confirmed, rather than whenever the webhook happens to
// land.
//
// Without it the fix trades a security hole for a support ticket: somebody
// finishes checkout, gets bounced to /billing because our row still says
// incomplete, and reasonably concludes the payment failed. The success page
// calls this before it redirects, so by the time the dashboard loads the row
// already reflects the card.
//
// Deliberately NOT trusted to grant anything by itself — it re-reads the
// subscription from Stripe and runs the same persistableStatus() the webhook
// runs. The client can ask us to look again; it cannot tell us what to write.
// ─────────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: row } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!row?.stripe_subscription_id) {
      return NextResponse.json({ synced: false, reason: 'no_subscription' })
    }

    const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
    const status = await persistableStatus(stripe, subscription)

    if (status !== row.status) {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', row.stripe_subscription_id)

      if (error) throw error
      console.log(
        `[stripe/sync] ${row.stripe_subscription_id} ${row.status} -> ${status} for ${userId}`
      )
    }

    return NextResponse.json({ synced: true, status })
  } catch (err: any) {
    return apiError(err, { route: 'stripe/sync' })
  }
}
