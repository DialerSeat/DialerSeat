import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const VALID_STATUSES = ['active', 'inactive'] as const

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status })

    const body = await req.json().catch(() => ({}))
    const { campaignId, status } = body

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
    }
    if (campaignId.includes(':')) {
      return NextResponse.json(
        { success: false, error: 'Cannot update a virtual sub-campaign. Update the parent instead.' },
        { status: 400 }
      )
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'status must be active or inactive' }, { status: 400 })
    }

    const { data: existing } = await supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .update({ status })
      .eq('id', campaignId)
      .select('id, name, status')
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    return apiError(error, { route: 'admin/campaigns/status' })
  }
}
