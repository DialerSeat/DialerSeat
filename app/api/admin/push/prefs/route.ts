import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/push/prefs')

interface Prefs {
  master_enabled: boolean
  signup: boolean
  account_deleted: boolean
  new_sub: boolean
  resub: boolean
  renewal: boolean
  cancel: boolean
}

const DEFAULT_PREFS: Prefs = {
  master_enabled: true,
  signup: true,
  account_deleted: true,
  new_sub: true,
  resub: true,
  renewal: true,
  cancel: true,
}

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { data, error } = await supabase
    .from('admin_notification_prefs')
    .select('master_enabled, signup, account_deleted, new_sub, resub, renewal, cancel')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    console.error('[admin/push/prefs] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 })
  }

  // Row is seeded by the migration, but fall back to defaults defensively
  // in case it's ever missing (e.g. migration not yet run in this env).
  return NextResponse.json({ prefs: (data as Prefs) || DEFAULT_PREFS })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  let body: Partial<Prefs>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patch: Partial<Prefs> = {}
  const boolKeys: (keyof Prefs)[] = ['master_enabled', 'signup', 'account_deleted', 'new_sub', 'resub', 'renewal', 'cancel']
  for (const key of boolKeys) {
    if (typeof body[key] === 'boolean') patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields in body' }, { status: 400 })
  }

  // upsert, NOT update — if the seed row (migrations/PUSH_NOTIFICATIONS_
  // 2026-07-17.sql, ON CONFLICT DO NOTHING) never actually ran against
  // this database, update() would match zero rows and silently succeed
  // with data: null. That null then fell through to DEFAULT_PREFS below —
  // which is all-true — meaning every toggle would appear to save
  // successfully (200 OK, no error) while actually persisting nothing,
  // and the very next read would show everything back on. upsert() with
  // an explicit id: 1 self-heals by creating the row the first time this
  // is ever hit, instead of failing this way forever.
  const { data, error } = await supabase
    .from('admin_notification_prefs')
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select('master_enabled, signup, account_deleted, new_sub, resub, renewal, cancel')
    .maybeSingle()

  if (error) {
    console.error('[admin/push/prefs] POST failed:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }

  return NextResponse.json({ prefs: (data as Prefs) || DEFAULT_PREFS })
}
