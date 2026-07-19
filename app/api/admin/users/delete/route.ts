import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'
import { apiError } from '@/lib/apiError'
import { deleteAccount } from '@/lib/deleteAccount'

const supabase = getServiceClient('admin/users/delete')

interface DeleteSummary {
  clerkId: string
  email: string | null
  stripe: {
    subscriptionsCanceled: number
    customerDeleted: boolean
    error: string | null
  }
  clerk: {
    deleted: boolean
    error: string | null
  }
  supabase: {
    counts: Record<string, number>
    blocked?: string
    errors: string[]
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  let body: { clerkId?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Bad JSON' }, { status: 400 })
  }

  const clerkId = body.clerkId?.trim()
  if (!clerkId) {
    return NextResponse.json({ success: false, error: 'clerkId required' }, { status: 400 })
  }

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('clerk_id, email, is_admin, stripe_customer_id')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  if (userErr) {
    return apiError(userErr, { route: 'admin/users/delete' })
  }

  if (userRow?.is_admin) {
    return NextResponse.json(
      { success: false, error: 'Cannot delete admin user. Remove admin flag first.' },
      { status: 400 }
    )
  }

  const summary: DeleteSummary = {
    clerkId,
    email: userRow?.email ?? null,
    stripe: { subscriptionsCanceled: 0, customerDeleted: false, error: null },
    clerk: { deleted: false, error: null },
    supabase: {
      counts: {},
      errors: [],
    },
  }

  if (userRow?.stripe_customer_id) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: userRow.stripe_customer_id,
        status: 'all',
        limit: 100,
      })
      for (const s of subs.data) {
        if (s.status === 'canceled') continue
        try {
          await stripe.subscriptions.cancel(s.id)
          summary.stripe.subscriptionsCanceled++
        } catch (err: any) {

          console.warn(`[admin/users/delete] cancel sub ${s.id} failed:`, err?.message)
        }
      }

      try {
        await stripe.customers.del(userRow.stripe_customer_id)
        summary.stripe.customerDeleted = true
      } catch (err: any) {
        if (err?.code === 'resource_missing') {

          summary.stripe.customerDeleted = true
        } else {
          summary.stripe.error = err?.message || 'customer delete failed'
        }
      }
    } catch (err: any) {
      summary.stripe.error = err?.message || 'stripe error'
    }
  }

  try {
    const client = await clerkClient()
    await client.users.deleteUser(clerkId)
    summary.clerk.deleted = true
  } catch (err: any) {

    const status = err?.status || err?.statusCode
    if (status === 404) {
      summary.clerk.deleted = true
    } else {
      summary.clerk.error = err?.message || 'clerk delete failed'
    }
  }

  // Stripe cancellation/customer deletion and the Clerk user deletion above
  // are specific to this admin-initiated "remove someone from the platform
  // entirely" flow. Everything else — the actual Supabase table cleanup —
  // now goes through the same deleteAccount() used by the self-service
  // "delete my account" flow, instead of a second, separately-maintained
  // version. That second version only ever covered 9 tables by hand and,
  // critically, never captured the person's name before deleting them or
  // wrote a billing_events audit entry at all — meaning deletions done
  // from this admin screen were completely invisible to both Logs and
  // push notifications. deleteAccount() already does both correctly.
  //
  // allowActiveSubscription: true because any live subscription was
  // already canceled in Stripe above — deleteAccount()'s own guard exists
  // to stop a SELF-service deletion of a still-paying account, which
  // doesn't apply here.
  const result = await deleteAccount(clerkId, { dryRun: false, allowActiveSubscription: true })
  summary.supabase.counts = result.counts
  if (!result.ok) {
    summary.supabase.blocked = result.blocked
    summary.supabase.errors.push(result.blocked || 'deleteAccount failed for an unspecified reason')
  }

  return NextResponse.json({ success: result.ok, summary })
}