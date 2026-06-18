import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { requireAdmin } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/admin/support — admin support feed (read + update)
// =============================================================================
// Backs the admin support desktop app. Admin-only (requireAdmin, same guard as
// the other admin routes — it throws a Response on failure).
//
// GET  ?type=support|bug|exit  ?status=new|open|responded|resolved|closed
//      ?limit=  → { success, submissions: [...] }
//      Both filters optional; omitting them returns the whole feed (most recent
//      first). The app uses ?type to drive its three tabs.
//
// PATCH { id, status?, disposition?, response_body?, response_channel? }
//      → { success, submission }
//      Updates workflow fields. When response_body is provided we stamp
//      responded_at / responded_by (the admin's clerk_id) and, unless an
//      explicit status is passed, move the row to 'responded'.
//
// force-dynamic: admin data, never cached.
// =============================================================================

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const VALID_TYPES = ['support', 'bug', 'exit']
const VALID_STATUS = ['new', 'open', 'responded', 'resolved', 'closed']
const MAX_RESPONSE = 8000

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const limitRaw = parseInt(searchParams.get('limit') || '200', 10)
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 500)

  let query = supabase
    .from('support_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type && VALID_TYPES.includes(type)) query = query.eq('type', type)
  if (status && VALID_STATUS.includes(status)) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('[admin/support] GET failed:', error)
    return NextResponse.json({ success: false, error: 'lookup_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, submissions: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { userId } = await auth()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 })
  }

  const id = body?.id
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ success: false, error: 'missing_id' }, { status: 400 })
  }

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }

  if (typeof body.disposition === 'string') {
    patch.disposition = body.disposition.trim().slice(0, 80)
  }

  if (typeof body.response_body === 'string' && body.response_body.trim()) {
    patch.response_body = body.response_body.trim().slice(0, MAX_RESPONSE)
    patch.responded_at = new Date().toISOString()
    patch.responded_by = userId ?? null
    if (typeof body.response_channel === 'string' && body.response_channel.trim()) {
      patch.response_channel = body.response_channel.trim().slice(0, 40)
    }
  }

  if (typeof body.status === 'string' && VALID_STATUS.includes(body.status)) {
    patch.status = body.status
  } else if (patch.response_body) {
    // Responded but no explicit status → mark as responded.
    patch.status = 'responded'
  }

  const { data, error } = await supabase
    .from('support_submissions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[admin/support] PATCH failed:', error)
    return NextResponse.json({ success: false, error: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true, submission: data })
}