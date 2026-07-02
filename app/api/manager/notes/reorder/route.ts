import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabaseAdmin = () =>
  getServiceClient('manager/notes/reorder')

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const orderedIds: string[] = Array.isArray(body?.orderedIds) ? body.orderedIds : []
  if (orderedIds.length === 0) {
    return NextResponse.json({ success: true })
  }

  const supabase = supabaseAdmin()

  await Promise.all(
    orderedIds.map((id, idx) =>
      supabase
        .from('admin_notes')
        .update({ pin_order: idx })
        .eq('id', id)
        .eq('owner_clerk_id', userId)
    )
  )

  return NextResponse.json({ success: true })
}