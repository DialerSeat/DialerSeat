import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { sendAdminPush } from '@/lib/pushNotify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// SOMEBODY REACHED THE CARD FORM AND LEFT
// =============================================================================
// Between 20 Aug and 24 Sept 2026 every real person who made an account and
// never paid got as far as the billing page and stopped there. Stripe does not
// say anything about that: the subscription sits 'incomplete' for 23 hours
// and quietly expires, and 38 had expired that way by the time this was
// written. A declined card already pushes (see the Stripe webhook). This
// covers the case with no error at all, the one that looked like nothing.
//
// create-subscription writes checkout_started the moment Stripe hands back a
// payable invoice. Thirty minutes later, if nothing has happened since, this
// sends one push with the person's name and email, so the owner can write to
// them the same day.
//
// Something "happening since" is any of: a payment (initial_sub, resub), a
// decline (checkout_failed, payment_failed: that already pushed, a second
// buzz for the same person would be noise), or an earlier stall alert. A new
// visit to the billing page writes a fresh checkout_started and starts the
// clock again. The checkout_stalled row is written BEFORE the push and the
// push is skipped if it fails: without the row this would buzz every ten
// minutes for the next day.
// =============================================================================

const STALL_AFTER_MIN = 30
// Stripe expires the unpaid first invoice at 23 hours. Past that there is no
// checkout left to finish, so there is nothing to prompt.
const LOOK_BACK_HOURS = 24
// A ceiling, not an expectation. If something upstream ever misfires, ten
// buzzes is a signal and fifty is a silenced phone.
const MAX_ALERTS_PER_RUN = 10

type Row = {
  clerk_id: string | null
  event_type: string
  plan: string | null
  amount_cents: number | null
  stripe_subscription_id: string | null
  created_at: string
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getServiceClient('cron/checkout-stalls')
    const now = Date.now()
    const since = new Date(now - LOOK_BACK_HOURS * 3600_000).toISOString()
    const stallBefore = now - STALL_AFTER_MIN * 60_000

    const { data, error } = await db
      .from('billing_events')
      .select('clerk_id, event_type, plan, amount_cents, stripe_subscription_id, created_at')
      .in('event_type', [
        'checkout_started', 'checkout_stalled', 'checkout_failed',
        'payment_failed', 'initial_sub', 'resub',
      ])
      .gte('created_at', since)
      .order('created_at', { ascending: true })
    if (error) throw error

    // Per person, their LATEST checkout and whether anything has closed it.
    const open = new Map<string, Row>()
    for (const row of (data || []) as Row[]) {
      if (!row.clerk_id) continue
      if (row.event_type === 'checkout_started') open.set(row.clerk_id, row)
      else open.delete(row.clerk_id)
    }

    const stalled = [...open.values()].filter(r => Date.parse(r.created_at) <= stallBefore)
    if (stalled.length === 0) {
      return NextResponse.json({ success: true, open: open.size, alerted: 0 })
    }

    const ids = stalled.map(r => r.clerk_id as string)
    const [{ data: users }, { data: paid }] = await Promise.all([
      db.from('users')
        .select('clerk_id, first_name, last_name, email, is_admin, exclude_from_analytics')
        .in('clerk_id', ids),
      // The ledger can miss a row; the subscription is the source of truth.
      db.from('subscriptions')
        .select('user_id')
        .in('user_id', ids)
        .in('status', ['active', 'trialing']),
    ])
    const paidIds = new Set((paid || []).map(p => p.user_id as string))
    const userById = new Map((users || []).map(u => [u.clerk_id as string, u]))

    let alerted = 0
    for (const checkout of stalled) {
      if (alerted >= MAX_ALERTS_PER_RUN) break
      const id = checkout.clerk_id as string
      const user = userById.get(id)
      // Test and internal accounts never alert, by the same rule the Logs app
      // and the ops map use.
      if (!user || user.is_admin || user.exclude_from_analytics) continue
      if (paidIds.has(id)) continue

      const email: string | null = user.email ?? null
      const name =
        [user.first_name, user.last_name].filter(Boolean).join(' ').trim() ||
        (email ? email.split('@')[0] : 'Someone')
      const minutes = Math.round((now - Date.parse(checkout.created_at)) / 60_000)
      const planLabel = checkout.plan === 'wl' ? 'Manager+' : 'Pro'
      const amount = typeof checkout.amount_cents === 'number'
        ? ` at $${(checkout.amount_cents / 100).toFixed(2)}`
        : ''

      const { error: insertErr } = await db.from('billing_events').insert({
        clerk_id: id,
        event_type: 'checkout_stalled',
        user_name: name,
        user_email: email,
        plan: checkout.plan === 'wl' ? 'wl' : 'pro',
        amount_cents: checkout.amount_cents,
        stripe_subscription_id: checkout.stripe_subscription_id,
        detail: { checkout_started_at: checkout.created_at, minutes },
      })
      if (insertErr) {
        console.error('[cron/checkout-stalls] could not record stall, not alerting:', insertErr.message)
        continue
      }

      await sendAdminPush(
        'checkout_stalled',
        `${name}${email ? ` (${email})` : ''} opened checkout for ${planLabel}${amount} ` +
        `${minutes} minutes ago and hasn't paid.`,
        { title: 'Stalled At Checkout' }
      )
      alerted++
    }

    return NextResponse.json({ success: true, open: open.size, stalled: stalled.length, alerted })
  } catch (err) {
    return apiError(err, { route: 'cron/checkout-stalls' })
  }
}
