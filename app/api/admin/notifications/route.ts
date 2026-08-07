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

    let q = supabase
      .from('admin_notifications')
      .select('id, event_type, title, body, url, pushed, delivered_to, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

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
