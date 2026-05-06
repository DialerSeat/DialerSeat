import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 })

  await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('clerk_id', userId)

  return NextResponse.json({ ok: true })
}