import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { clerkClient } from '@clerk/nextjs/server'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'
import { apiError } from '@/lib/apiError'

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
    team_members: number
    teams: number
    campaign_scripts: number
    calls: number
    leads: number
    campaigns: number
    subscriptions: number
    data_preserved_users: number
    users: number
    errors: string[]
  }
}

async function safeCount(
  table: string,
  match: Record<string, string>,
  errors: string[]
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .match(match)
    .select('*')
  if (error) {
    errors.push(`${table}: ${error.message}`)
    return 0
  }
  return data?.length || 0
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
      team_members: 0,
      teams: 0,
      campaign_scripts: 0,
      calls: 0,
      leads: 0,
      campaigns: 0,
      subscriptions: 0,
      data_preserved_users: 0,
      users: 0,
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

  const errs = summary.supabase.errors

  summary.supabase.team_members += await safeCount(
    'team_members',
    { user_id: clerkId },
    errs
  )

  summary.supabase.teams = await safeCount('teams', { owner_id: clerkId }, errs)

  {
    const { data: camps, error: campErr } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', clerkId)
    if (campErr) {
      errs.push(`campaigns lookup: ${campErr.message}`)
    } else if (camps && camps.length > 0) {
      const ids = camps.map(c => c.id)
      const { data: scripts, error: scriptErr } = await supabase
        .from('campaign_scripts')
        .delete()
        .in('campaign_id', ids)
        .select('id')
      if (scriptErr) errs.push(`campaign_scripts: ${scriptErr.message}`)
      else summary.supabase.campaign_scripts = scripts?.length || 0
    }
  }

  summary.supabase.calls = await safeCount('calls', { user_id: clerkId }, errs)
  summary.supabase.leads = await safeCount('leads', { user_id: clerkId }, errs)
  summary.supabase.campaigns = await safeCount('campaigns', { user_id: clerkId }, errs)
  summary.supabase.subscriptions = await safeCount(
    'subscriptions',
    { user_id: clerkId },
    errs
  )
  summary.supabase.data_preserved_users = await safeCount(
    'data_preserved_users',
    { clerk_id: clerkId },
    errs
  )
  summary.supabase.users = await safeCount('users', { clerk_id: clerkId }, errs)

  return NextResponse.json({ success: true, summary })
}