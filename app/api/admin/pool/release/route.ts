import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { releasePoolNumber } from '@/lib/numberPool'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/release')

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

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
    return apiError(err, { route: 'admin/pool/release' })
  }
}