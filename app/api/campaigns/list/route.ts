import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

const SUB_DISPOSITIONS = {
  appointments: 'APPOINTMENT',
  not_interested: 'NOT_INTERESTED',
} as const

type SubType = keyof typeof SUB_DISPOSITIONS

const SUB_LABELS: Record<SubType, string> = {
  appointments: 'Appointments',
  not_interested: 'Not Interested',
}

export async function GET(req: Request) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response
    const user_id = gate.userId

    const { searchParams } = new URL(req.url)
    const includeVirtual = searchParams.get('include_virtual') === '1'

    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*, script')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (campaigns && campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id)
      const { data: links } = await supabaseAdmin
        .from('campaign_script_links')
        .select('campaign_id, script_id, sort_order, scripts(id, name, body)')
        .in('campaign_id', campaignIds)
        .order('sort_order', { ascending: true })
      const byCampaign: Record<string, any[]> = {}
      for (const l of links || []) {
        const sc = (l as any).scripts
        if (!sc) continue
        ;(byCampaign[l.campaign_id] ||= []).push({ id: sc.id, name: sc.name, body: sc.body })
      }
      for (const c of campaigns) {
        ;(c as any).scripts = byCampaign[c.id] || []
      }
    }

    if (!includeVirtual || !campaigns || campaigns.length === 0) {
      return NextResponse.json({ success: true, campaigns: campaigns || [] })
    }

    const virtualPlans: Array<{ parent: any; subType: SubType; disposition: string }> = []
    for (const c of campaigns) {
      if (c.enable_appointments_sub) {
        virtualPlans.push({
          parent: c,
          subType: 'appointments',
          disposition: SUB_DISPOSITIONS.appointments,
        })
      }
      if (c.enable_not_interested_sub) {
        virtualPlans.push({
          parent: c,
          subType: 'not_interested',
          disposition: SUB_DISPOSITIONS.not_interested,
        })
      }
    }

    if (virtualPlans.length === 0) {
      return NextResponse.json({ success: true, campaigns })
    }

    const countMap = new Map<string, number>()
    await Promise.all(virtualPlans.map(async (plan) => {
      const { count } = await supabaseAdmin
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('campaign_id', plan.parent.id)
        .eq('disposition', plan.disposition)
      countMap.set(`${plan.parent.id}:${plan.disposition}`, count || 0)
    }))

    const expanded: any[] = []
    for (const c of campaigns) {
      expanded.push(c)
      const subsForParent = virtualPlans.filter(p => p.parent.id === c.id)
      for (const plan of subsForParent) {
        const count = countMap.get(`${c.id}:${plan.disposition}`) || 0
        expanded.push({
          ...c,
          id: `${c.id}:${plan.subType}`,
          name: `${c.name} ${SUB_LABELS[plan.subType]}`,
          total_leads: count,
          called_leads: count,
          virtual_parent_id: c.id,
          sub_type: plan.subType,

          enable_appointments_sub: false,
          enable_not_interested_sub: false,
        })
      }
    }

    return NextResponse.json({ success: true, campaigns: expanded })
  } catch (error: any) {
    return apiError(error, { route: 'campaigns/list' })
  }
}