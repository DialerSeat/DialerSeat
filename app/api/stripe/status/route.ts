import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, trial_end, cancel_at_period_end')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub) {
      return NextResponse.json({
        hasSubscription: false,
        status: null,
      })
    }

    const isActive = ['trialing', 'active', 'past_due'].includes(sub.status)

    return NextResponse.json({
      hasSubscription: true,
      isActive,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      trialEnd: sub.trial_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
  } catch (err: any) {
    console.error('status error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}