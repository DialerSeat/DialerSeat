import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/register')

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  let body: { numberId?: string; registerAll?: boolean; registered?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Bad JSON' }, { status: 400 })
  }

  const registered = body.registered !== false // default true if omitted

  // Bulk: flip all currently-unregistered (or all if marking unregistered)
  if (body.registerAll) {
    const { data, error } = await supabase
      .from('phone_numbers')
      .update({ is_registered: registered })
      .eq('is_registered', !registered)
      .select('id')

    if (error) {
      return apiError(error, { route: 'admin/pool/register' })
    }
    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      registered,
    })
  }

  // Single: flip one specific number
  const id = body.numberId?.trim()
  if (!id) {
    return NextResponse.json(
      { success: false, error: 'numberId or registerAll required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('phone_numbers')
    .update({ is_registered: registered })
    .eq('id', id)
    .select('id, phone_number, is_registered')
    .maybeSingle()

  if (error) {
    return apiError(error, { route: 'admin/pool/register' })
  }
  if (!data) {
    return NextResponse.json({ success: false, error: 'Number not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, number: data })
}