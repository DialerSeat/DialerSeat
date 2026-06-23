// app/api/leads/bulk-update/route.ts
// =============================================================================
// BULK UPDATE LEADS
// =============================================================================
// Used by the Sheets-style editor in /dashboard/campaigns to commit multiple
// cell edits at once. Accepts an array of updates and applies them in a
// single batch. Returns counts on success.
//
// Body:
//   {
//     updates: [
//       { lead_id: 'uuid', fields: { first_name?: string, last_name?: string,
//                                    phone?: string, email?: string,
//                                    state?: string, city?: string,
//                                    extra_data?: {...} } },
//       ...
//     ]
//   }
//
// Editable fields are intentionally restricted to user-data fields. Server-
// managed fields (id, campaign_id, user_id, created_at, dial_attempts,
// last_called_at, disposition, etc.) are NOT updatable via this endpoint.
// To change a disposition use /api/leads/update; to change a campaign you
// can't (move leads is a separate operation).
//
// Auth: requires active subscription. Lapsed users get 403.
// Ownership: every lead_id in `updates` is verified to belong to the caller.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EDITABLE_FIELDS = new Set([
  'first_name', 'last_name', 'phone', 'email',
  'state', 'city', 'notes', 'extra_data',
])

const MAX_BATCH = 500

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    // ─── Active subscription gate ──────────────────────────────────────────
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

    // ─── Verify ownership of every lead in one query ──────────────────────
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

    // Reject the whole batch if ANY lead isn't owned by the caller. This is
    // intentional — partial success on a batch operation is confusing UX.
    for (const u of updates) {
      if (!ownedSet.has(u.lead_id)) {
        return NextResponse.json(
          { error: 'forbidden_lead', lead_id: u.lead_id },
          { status: 403 }
        )
      }
    }

    // ─── Apply updates one at a time ──────────────────────────────────────
    // Supabase doesn't have a true bulk-update with different fields per row,
    // so we run them in parallel. For 500 rows this is fine; if it ever
    // becomes a bottleneck we can switch to a SQL CASE-WHEN update or RPC.
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