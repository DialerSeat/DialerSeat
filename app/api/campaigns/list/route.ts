import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// =============================================================================
// CAMPAIGNS LIST — with optional virtual sub-campaign expansion
// =============================================================================
// Behavior:
//   GET /api/campaigns/list?user_id=xxx
//     → returns ONLY real campaigns (default — preserves prior behavior for
//       the campaigns dashboard, team attach modal, analytics, etc.)
//
//   GET /api/campaigns/list?user_id=xxx&include_virtual=1
//     → returns real campaigns PLUS virtual children for any parent with
//       enable_appointments_sub or enable_not_interested_sub set true.
//       The dialer page should use this flag so the sub-campaigns appear
//       in its campaign selector.
//
// Virtual child shape:
//   - id:                 `${parentId}:appointments` or `${parentId}:not_interested`
//   - name:               `${parentName} Appointments` / `${parentName} Not Interested`
//   - total_leads:        actual count of leads in parent with matching disposition
//   - called_leads:       same as total_leads (by definition, all are dispositioned)
//   - virtual_parent_id:  parent campaign id (frontend gate for settings/delete)
//   - sub_type:           'appointments' | 'not_interested'
//   - all other fields:   copied from parent (status, dialer_mode, amd_enabled, etc.)
//                         so the dialer treats them as normal campaigns
//
// IMPORTANT — disposition string constants below must match exactly what the
// dialer writes to leads.disposition. If your dialer uses different strings,
// update SUB_DISPOSITIONS here AND the matching constant in
// /api/leads/list/route.ts. Both must agree.
// =============================================================================

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
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const includeVirtual = searchParams.get('include_virtual') === '1'

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'No user_id' }, { status: 400 })
    }

    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*, script')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fast path: no virtual expansion requested or no campaigns to expand.
    if (!includeVirtual || !campaigns || campaigns.length === 0) {
      return NextResponse.json({ success: true, campaigns: campaigns || [] })
    }

    // Build the list of (parent, subType) pairs that need virtual children.
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

    // Count leads per (parent, disposition) pair. One head:true query per pair,
    // run in parallel. Acceptable for typical campaign counts; if a user has
    // 50+ campaigns with both subs on, consider promoting to a single GROUP BY
    // RPC function.
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

    // Inline each virtual child directly after its parent in the response so
    // the dialer's selector groups them visually (parent → sub → sub → next parent).
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
          // Don't let virtual children spawn their own grandchildren.
          enable_appointments_sub: false,
          enable_not_interested_sub: false,
        })
      }
    }

    return NextResponse.json({ success: true, campaigns: expanded })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}