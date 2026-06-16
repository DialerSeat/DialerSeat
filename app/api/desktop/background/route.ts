import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/desktop/background — per-user desktop background (follows across devices)
// =============================================================================
// The manager/admin desktop background was previously persisted to
// localStorage, so it was device-local and didn't follow the signed-in user
// to other devices. This route stores the choice on users.desktop_background
// (added in migration user_desktop_background), keyed by the Clerk user id, so
// it's authoritative per-user everywhere.
//
//   GET  → { background: string | null }   the current user's saved value
//   POST { background: string | null } → { success, background }
//
// "background" is an opaque string the desktop interprets: a color hex
// (e.g. "#101018"), a preset id (e.g. "preset:aurora"), or an image key.
// We don't validate its shape here beyond a length cap, so the desktop can
// evolve its background catalog without server changes.
//
// force-dynamic: per-user, must never be cached.
// =============================================================================

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MAX_LEN = 512

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('users')
      .select('desktop_background')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[desktop/background GET] error:', error)
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
    }

    return NextResponse.json({ background: data?.desktop_background ?? null })
  } catch (err) {
    console.error('[desktop/background GET] unexpected:', err)
    return NextResponse.json({ error: 'unexpected' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    let background: string | null = body?.background ?? null
    if (background !== null) {
      if (typeof background !== 'string') {
        return NextResponse.json({ error: 'invalid_background' }, { status: 400 })
      }
      background = background.trim()
      if (background.length === 0) {
        background = null
      } else if (background.length > MAX_LEN) {
        return NextResponse.json({ error: 'background_too_long' }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from('users')
      .update({ desktop_background: background })
      .eq('clerk_id', userId)

    if (error) {
      console.error('[desktop/background POST] error:', error)
      return NextResponse.json({ error: 'save_failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, background })
  } catch (err) {
    console.error('[desktop/background POST] unexpected:', err)
    return NextResponse.json({ error: 'unexpected' }, { status: 500 })
  }
}