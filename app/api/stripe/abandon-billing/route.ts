import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

const supabase = getServiceClient('stripe/abandon-billing')

const PROTECTED_STATUSES = ['active', 'past_due', 'trialing']

const CLEANUP_STATUSES = ['incomplete']

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const log: string[] = []
  const step = (msg: string) => {
    console.log(`[abandon-billing ${userId}] ${msg}`)
    log.push(msg)
  }

  try {
    step('start')

    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('clerk_id', userId)
      .maybeSingle()

    const customerId = userRow?.stripe_customer_id

    if (!customerId) {
      step('no stripe customer — nothing to clean')
      return NextResponse.json({
        success: true,
        action: 'noop_no_customer',
        log,
      })
    }

    let allSubs: { id: string; status: string }[] = []
    try {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
      })
      allSubs = list.data.map((s) => ({ id: s.id, status: s.status }))
      step(`stripe: ${allSubs.length} sub(s) found`)
    } catch (err: any) {
      step(`stripe list failed: ${err.message}`)

    }

    const hasProtected = allSubs.some((s) =>
      PROTECTED_STATUSES.includes(s.status)
    )

    if (hasProtected) {
      step('protected sub exists — no-op (paying customer)')
      return NextResponse.json({
        success: true,
        action: 'noop_protected',
        log,
      })
    }

    const incomplete = allSubs.filter((s) =>
      CLEANUP_STATUSES.includes(s.status)
    )

    for (const sub of incomplete) {
      try {
        await stripe.subscriptions.cancel(sub.id)
        step(`canceled stripe sub ${sub.id}`)
      } catch (err: any) {

        step(`skip cancel ${sub.id}: ${err.message}`)
      }
    }

    const { error: delErr, count } = await supabase
      .from('subscriptions')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .in('status', CLEANUP_STATUSES)

    if (delErr) {
      step(`supabase delete error: ${delErr.message}`)
    } else {
      step(`deleted ${count ?? 0} incomplete supabase row(s)`)
    }

    step('done')

    return NextResponse.json({
      success: true,
      action: 'cleaned',
      log,
    })
  } catch (err: any) {

    console.error('[abandon-billing] error:', err)
    return NextResponse.json({
      success: false,
      action: 'error',
      error: err.message || 'Unknown error',
      log,
    })
  }
}