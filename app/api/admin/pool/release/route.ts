import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { releasePoolNumber } from '@/lib/numberPool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Admin manual release. Body: { numberId: string, confirm: 'release' }
 * Requires explicit 'release' confirmation string to prevent fat-finger mistakes.
 * Releases the number from SignalWire (stops billing) and marks as 'released' in DB.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: u } = await supabase
    .from('users').select('is_admin').eq('clerk_id', userId).single()
  if (!u?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const numberId = String(body?.numberId ?? '').trim()
  const confirm = String(body?.confirm ?? '').trim()

  if (!numberId) return NextResponse.json({ error: 'numberId required' }, { status: 400 })
  if (confirm !== 'release') {
    return NextResponse.json({
      error: 'Confirmation required: send { numberId, confirm: "release" }',
    }, { status: 400 })
  }

  try {
    await releasePoolNumber(numberId)
    return NextResponse.json({ success: true, numberId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}