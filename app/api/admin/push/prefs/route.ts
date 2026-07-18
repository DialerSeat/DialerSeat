import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/push/prefs')

interface Prefs {
  master_enabled: boolean
  signup: boolean
  new_sub: boolean
  resub: boolean
  renewal: boolean
  cancel: boolean
}

const DEFAULT_PREFS: Prefs = {
  master_enabled: true,
  signup: true,
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
    .select('master_enabled, signup, new_sub, resub, renewal, cancel')
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
  const boolKeys: (keyof Prefs)[] = ['master_enabled', 'signup', 'new_sub', 'resub', 'renewal', 'cancel']
  for (const key of boolKeys) {
    if (typeof body[key] === 'boolean') patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields in body' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('admin_notification_prefs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('master_enabled, signup, new_sub, resub, renewal, cancel')
    .maybeSingle()

  if (error) {
    console.error('[admin/push/prefs] POST failed:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }

  return NextResponse.json({ prefs: (data as Prefs) || DEFAULT_PREFS })
}
