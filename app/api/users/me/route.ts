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

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ is_admin: false }, { status: 200 })
    }
    const { data } = await supabase
      .from('users')
      .select('is_admin, demo_phone_mask')
      .eq('clerk_id', userId)
      .maybeSingle()
    return NextResponse.json({
      is_admin: data?.is_admin === true,
      // Display-only phone mask for filming on a demo account. See
      // components/DemoPhoneMask.
      demo_phone_mask: data?.demo_phone_mask === true,
    }, { status: 200 })
  } catch {
    return NextResponse.json({ is_admin: false }, { status: 200 })
  }
}
