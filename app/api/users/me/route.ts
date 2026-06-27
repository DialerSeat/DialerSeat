import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// =============================================================================
// /api/users/me — minimal "who am I" for the signed-in user
// =============================================================================
// Returns just what the client UI needs (currently is_admin). The lookup runs
// SERVER-SIDE with the service-role key, so the browser never queries the
// `users` table directly with the anon key. This lets us lock down the `users`
// table's RLS (previously wide-open via an "Allow all operations" policy) while
// keeping the admin-aware header working.
//
// Returns is_admin:false for signed-out or not-found users (fail closed — a
// failed lookup must never grant admin).
// =============================================================================
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ is_admin: false }, { status: 200 })
    }
    const { data } = await supabase
      .from('users')
      .select('is_admin')
      .eq('clerk_id', userId)
      .maybeSingle()
    return NextResponse.json({ is_admin: data?.is_admin === true }, { status: 200 })
  } catch {
    return NextResponse.json({ is_admin: false }, { status: 200 })
  }
}
