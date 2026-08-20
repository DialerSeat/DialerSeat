import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'





















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

    // ── IT WAS NEVER ON `users` ────────────────────────────────────────
    // desktop_prefs.background_id is where a chosen background actually lives.
    // Selecting a column users does not have made PostgREST reject the query,
    // so this returned null every time and everybody got the default background
    // no matter what they picked — a setting that saved and never came back.
    const { data, error } = await supabase
      .from('desktop_prefs')
      .select('background_id')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[desktop/background GET] error:', error)
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
    }

    return NextResponse.json({ background: data?.background_id ?? null })
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