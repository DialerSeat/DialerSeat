import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { syncNumberPoolWithTelnyx } from '@/lib/telnyxNumberSync'

const supabase = getServiceClient('admin/pool/sync')

// =============================================================================
// POOL SYNC (Telnyx) — bulk reconcile Telnyx's owned numbers against our pool
// =============================================================================
// Admin button for the same reconciliation the dial path runs automatically
// when it hits Telnyx's D51 ("unverified origination number") — see
// lib/telnyxNumberSync.ts.
//
// THIS ROUTE USED TO HAVE ITS OWN COPY OF THAT LOGIC, and the copy was
// subtly weaker in the way that actually mattered: it *detected* orphans
// (numbers in our pool that Telnyx doesn't own) and reported them in the
// response, but left every one of them status='active'. So the admin could
// run a sync, be told "10 orphaned", and the dialer would go right on
// picking those numbers as caller ID and failing every call with D51. The
// tool named the problem and left it in place.
//
// Delegating to the shared module means the button and the automatic
// self-heal cannot diverge again, and orphans are actually retired rather
// than merely counted. The response keeps its original shape so the admin
// desktop's Numbers app keeps working, with the retirement surfaced
// alongside.
// =============================================================================

export async function POST() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    const result = await syncNumberPoolWithTelnyx()

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Sync failed' }, { status: 500 })
    }

    const { count: poolTotal } = await supabase
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      summary: {
        telnyx_total: result.ownedCount,
        pool_total: poolTotal ?? 0,
        imported: result.imported.length,
        // Everything Telnyx owns that we didn't have to import was already
        // tracked (possibly after being reactivated, counted separately).
        already_in_pool: Math.max(0, result.ownedCount - result.imported.length),
        reactivated: result.reactivated.length,
        // Retained under the original key so the Numbers app keeps reading
        // it, but these are no longer merely *found* — they are retired.
        orphans: result.retired.length,
        orphan_numbers: result.retired,
        retired: result.retired.length,
        failed: 0,
      },
      // Telnyx answered but owns nothing — the sync deliberately changes
      // nothing in that case rather than retiring the entire pool and
      // leaving zero caller IDs. Pass the explanation through.
      note: result.error || undefined,
      imported_numbers: result.imported,
      reactivated_numbers: result.reactivated,
    })
  } catch (err) {
    console.error('[pool/sync] error:', err)
    return apiError(err, { route: 'admin/pool/sync' })
  }
}
