import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import { applySubscriptionAction, type SubscriptionAction } from '@/lib/subscriptionControl'

// Pause, resume, cancel or renew a customer's plan from the Overview, so a
// support request ("I paused and was still charged") is handled in one click
// instead of a trip through the Stripe dashboard that leaves our records
// behind. Every result carries what Stripe holds afterwards, read back.
const ACTIONS: readonly SubscriptionAction[] = ['pause', 'resume', 'cancel', 'renew']

export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }
  try {
    const body = await req.json().catch(() => null) as { clerkId?: string; action?: string } | null
    const clerkId = body?.clerkId
    const action = body?.action as SubscriptionAction | undefined
    if (!clerkId || !action || !ACTIONS.includes(action)) {
      return NextResponse.json({ success: false, error: 'clerkId and a valid action are required' }, { status: 400 })
    }
    const results = await applySubscriptionAction(clerkId, action, 'admin')
    if (results.length === 0) {
      return NextResponse.json({ success: false, error: 'No live subscription to change' }, { status: 404 })
    }
    return NextResponse.json({ success: results.every(r => r.ok), results })
  } catch (err: unknown) {
    return apiError(err, { route: 'admin/users/subscription' })
  }
}
