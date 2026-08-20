import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/notifications')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/notifications — the history a push notification does not keep
// =============================================================================
// Web push is an interruption, not a record. The OS draws a banner, you tap
// it, and there is no trace of it anywhere afterwards. A signup that landed at
// 3am, or a pool-capacity warning dismissed one-handed on a phone, was simply
// gone.
//
// Every call to sendAdminPush now writes a row before it attempts delivery
// (see lib/pushNotify.ts), so this reads back the same events the phone
// showed — plus the ones it did not, because a muted preference or a failed
// delivery should not erase the fact that something happened.
// =============================================================================

const PAGE_SIZE = 100

export async function GET(req: Request) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const url = new URL(req.url)
    const unreadOnly = url.searchParams.get('unread') === '1'
    const limit = Math.min(Number(url.searchParams.get('limit')) || PAGE_SIZE, 300)

    // ── PAGES BACKWARDS FOREVER ───────────────────────────────────────────
    // This was a plain limit, which is not pagination — it is "the newest 100,
    // and nothing else exists". At ten thousand agents that is one morning of
    // history, with every notification before lunch unreachable.
    //
    // A keyset cursor rather than an offset: paging by timestamp reads the same
    // number of rows on page four thousand as on page one, where an offset
    // makes the database walk and discard everything before it. The index
    // admin_notifications_page_idx is what makes that constant-time.
    const before = url.searchParams.get('before')

    let q = supabase
      .from('admin_notifications')
      .select('id, event_type, title, body, url, pushed, delivered_to, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) q = q.lt('created_at', before)
    if (unreadOnly) q = q.is('read_at', null)

    const [listRes, unreadRes] = await Promise.all([
      q,
      supabase
        .from('admin_notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null),
    ])

    if (listRes.error) throw listRes.error

    return NextResponse.json({
      success: true,
      // The cursor for the next page, or null when the end has been reached.
      // Null rather than absent so a caller can tell "no more" apart from
      // "the field was not sent".
      nextBefore: (listRes.data && listRes.data.length === limit)
        ? listRes.data[listRes.data.length - 1].created_at
        : null,
      notifications: listRes.data ?? [],
      unreadCount: unreadRes.count ?? 0,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/notifications' })
  }
}

/**
 * Mark notifications read, or clear the log.
 *
 *   { action: 'read',     ids: [...] }  mark specific rows
 *   { action: 'read_all' }              mark everything read
 *   { action: 'delete',   ids: [...] }  remove specific rows
 *   { action: 'clear_read' }            remove everything already read
 *
 * Deliberately no "delete everything" — clearing unread notifications you have
 * not looked at is the one destructive option nobody means to pick, and the
 * two-step of reading then clearing costs nothing.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = body?.action
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    const now = new Date().toISOString()

    if (action === 'read') {
      if (ids.length === 0) {
        return NextResponse.json({ success: false, error: 'No ids given' }, { status: 400 })
      }
      const { error } = await supabase
        .from('admin_notifications')
        .update({ read_at: now })
        .in('id', ids)
        .is('read_at', null)
      if (error) throw error
    } else if (action === 'read_all') {
      const { error } = await supabase
        .from('admin_notifications')
        .update({ read_at: now })
        .is('read_at', null)
      if (error) throw error
    } else if (action === 'delete') {
      if (ids.length === 0) {
        return NextResponse.json({ success: false, error: 'No ids given' }, { status: 400 })
      }
      const { error } = await supabase.from('admin_notifications').delete().in('id', ids)
      if (error) throw error
    } else if (action === 'clear_read') {
      const { error } = await supabase
        .from('admin_notifications')
        .delete()
        .not('read_at', 'is', null)
      if (error) throw error
    } else {
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
    }

    const { count } = await supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)

    return NextResponse.json({ success: true, unreadCount: count ?? 0 })
  } catch (err) {
    return apiError(err, { route: 'admin/notifications:POST' })
  }
}
