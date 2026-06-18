import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/support/submit — create a support / bug / exit submission
// =============================================================================
// Any signed-in user can submit. The submission feeds the admin support desktop
// app's unified feed (support_submissions). Identity is SNAPSHOTTED server-side
// from the users table — we never trust client-supplied name/email — so the row
// still shows who submitted it after the account is deleted.
//
// Body: { type, disposition?, subject?, body }
//   type        — 'support' | 'bug' | 'exit'
//   disposition — free-form category chosen in the app (e.g. exit reason,
//                 bug severity). Validated only as a bounded string here so the
//                 app can evolve its categories without a server change.
//   subject     — optional short title
//   body        — the message (required, non-empty)
//
// force-dynamic: per-user, never cached.
// =============================================================================

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const VALID_TYPES = ['support', 'bug', 'exit'] as const
type SubmissionType = (typeof VALID_TYPES)[number]

const MAX_BODY = 8000
const MAX_SUBJECT = 200
const MAX_DISPOSITION = 80

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }

    let payload: any
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 })
    }

    const type = payload?.type
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ success: false, error: 'invalid_type' }, { status: 400 })
    }

    const body = typeof payload?.body === 'string' ? payload.body.trim() : ''
    if (!body) {
      return NextResponse.json({ success: false, error: 'empty_body' }, { status: 400 })
    }
    if (body.length > MAX_BODY) {
      return NextResponse.json({ success: false, error: 'body_too_long' }, { status: 400 })
    }

    const subject =
      typeof payload?.subject === 'string' ? payload.subject.trim().slice(0, MAX_SUBJECT) : null
    const disposition =
      typeof payload?.disposition === 'string'
        ? payload.disposition.trim().slice(0, MAX_DISPOSITION)
        : null

    // Snapshot identity server-side from the users table (never trust the client).
    const { data: u } = await supabase
      .from('users')
      .select('first_name, last_name, username, email, active_tenant_id')
      .eq('clerk_id', userId)
      .maybeSingle()

    const snapName =
      [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || null

    const { error: insertError } = await supabase.from('support_submissions').insert({
      type: type as SubmissionType,
      clerk_id: userId,
      snap_name: snapName,
      snap_username: u?.username ?? null,
      snap_email: u?.email ?? null,
      tenant_id: u?.active_tenant_id ?? null,
      disposition,
      subject,
      body,
      status: 'new',
    })

    if (insertError) {
      console.error('[support/submit] insert failed:', insertError)
      return NextResponse.json({ success: false, error: 'save_failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[support/submit] unexpected:', err)
    return NextResponse.json({ success: false, error: 'unexpected' }, { status: 500 })
  }
}