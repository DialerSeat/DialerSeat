import { NextResponse } from 'next/server'
import { apiError } from '@/lib/apiError'
import { reconcilePausedSubscriptions } from '@/lib/subscriptionControl'
import { sendAdminPush } from '@/lib/pushNotify'
import { lookupUserIdentity } from '@/lib/userDisplayName'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// ── EVERY HOUR, PAUSED HERE MEANS PAUSED IN STRIPE ───────────────────────
// A pause that never took in Stripe, or was lifted there, produces no event
// we can react to until the renewal has already been paid. Hussein was
// charged twice that way (23 and 30 Sept). Weekly billing gives an hourly
// check plenty of room to put the pause back before the next renewal.
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const fixed = await reconcilePausedSubscriptions()
    for (const f of fixed.filter(x => x.repaused)) {
      try {
        const { name } = await lookupUserIdentity(f.clerkId)
        await sendAdminPush(
          'sub_paused',
          `${name} is paused here but Stripe was still set to bill them. Pause re-applied in Stripe.`
        )
      } catch { /* the fix stands without the notice */ }
    }
    return NextResponse.json({
      success: true,
      repaused: fixed.filter(x => x.repaused).length,
      failed: fixed.filter(x => !x.repaused),
    })
  } catch (err: unknown) {
    return apiError(err, { route: 'cron/pause-reconcile' })
  }
}
