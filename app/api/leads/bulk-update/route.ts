import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabaseAdmin = getServiceClient('leads/bulk-update')

const EDITABLE_FIELDS = new Set([
  'first_name', 'last_name', 'phone', 'email',
  'state', 'city', 'notes', 'extra_data',
])

const MAX_BATCH = 500

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: sub } = await supabaseAdmin
      .from('users')
      .select('subscription_status')
      .eq('clerk_id', userId)
      .single()

    if (!sub || sub.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'subscription_required', detail: 'Resubscribe to edit leads.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const updates = Array.isArray(body?.updates) ? body.updates : null
    if (!updates || updates.length === 0) {
      return NextResponse.json({ error: 'no_updates' }, { status: 400 })
    }
    if (updates.length > MAX_BATCH) {
      return NextResponse.json(
        { error: 'batch_too_large', detail: `Max ${MAX_BATCH} per request.` },
        { status: 400 }
      )
    }

    const leadIds = updates.map((u: any) => u.lead_id).filter(Boolean)
    if (leadIds.length !== updates.length) {
      return NextResponse.json({ error: 'malformed_updates' }, { status: 400 })
    }

    const { data: ownedLeads, error: ownErr } = await supabaseAdmin
      .from('leads')
      .select('id, user_id')
      .in('id', leadIds)

    if (ownErr) {
      console.error('bulk-update ownership query failed:', ownErr)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    const ownedSet = new Set(
      (ownedLeads || []).filter(l => l.user_id === userId).map(l => l.id)
    )

    for (const u of updates) {
      if (!ownedSet.has(u.lead_id)) {
        return NextResponse.json(
          { error: 'forbidden_lead', lead_id: u.lead_id },
          { status: 403 }
        )
      }
    }

    const results = await Promise.all(updates.map(async (u: any) => {
      const fields: Record<string, any> = {}
      for (const [k, v] of Object.entries(u.fields || {})) {
        if (EDITABLE_FIELDS.has(k)) fields[k] = v
      }
      if (Object.keys(fields).length === 0) {
        return { lead_id: u.lead_id, skipped: true }
      }
      const { error } = await supabaseAdmin
        .from('leads')
        .update(fields)
        .eq('id', u.lead_id)
        .eq('user_id', userId)
      return { lead_id: u.lead_id, error: error?.message || null }
    }))

    const failures = results.filter(r => r.error)
    if (failures.length > 0) {
      console.error('bulk-update partial failure:', failures)
      return NextResponse.json({
        success: false,
        updated: results.length - failures.length,
        failed: failures.length,
        errors: failures,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      updated: results.filter(r => !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
    })
  } catch (err: any) {
    console.error('bulk-update unhandled:', err)
    return NextResponse.json({ error: 'server_error', detail: err.message }, { status: 500 })
  }
}