import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/pool/analytics')

// =============================================================================
// POOL ANALYTICS — lead demand vs number supply by state (v1, NEW)
// =============================================================================
// GET /api/admin/pool/analytics →
// {
//   success, generated_at,
//   summary: { totalLeads, leadsWithState, unknownStateLeads, statesWithLeads,
//              statesCovered, uncoveredLeads, poolTotal, poolActive },
//   states: [{ code, name, leads, leadsPct, poolNumbers, activeNumbers,
//              dailyCapacity, callsToday, leadsPerNumber, capacityPct,
//              gap, verdict }],   // sorted by gap desc (worst shortage first)
// }
//
// HOW STATES ARE RESOLVED (leads.state is messy — "FL" and "FLORIDA" coexist):
//   1. Normalize leads.state: trim/upper; accept 2-letter codes; map full
//      state names ("FLORIDA" → FL).
//   2. If still unresolved, derive from the lead's phone area code via the
//      NANP area-code → state map (area codes never cross state lines).
//   3. Anything left lands in unknownStateLeads.
// Pool numbers resolve the same way: state column first, area_code fallback.
//
// GAP SCORE: leadsShare − capacityShare, in percentage points.
//   leadsShare    = state's % of all resolvable leads
//   capacityShare = state's % of total pool daily capacity (active numbers)
//   Positive gap  = demand outweighs supply there → buy numbers.
// VERDICTS:
//   NEED      — leads exist, ZERO active numbers
//   NEED MORE — gap ≥ +2.0pp
//   STRETCHED — gap > 0
//   BALANCED  — −2.0pp < gap ≤ 0
//   SURPLUS   — gap ≤ −2.0pp, or numbers exist with zero leads
// =============================================================================

// Keep in sync with STATE_AREA_CODES in components/admin-desktop/apps/Numbers.tsx
const STATE_AREA_CODES: Array<{ state: string; name: string; areaCodes: string[] }> = [
  { state: 'AL', name: 'Alabama', areaCodes: ['205', '251', '256', '334', '938'] },
  { state: 'AK', name: 'Alaska', areaCodes: ['907'] },
  { state: 'AZ', name: 'Arizona', areaCodes: ['480', '520', '602', '623', '928'] },
  { state: 'AR', name: 'Arkansas', areaCodes: ['479', '501', '870'] },
  { state: 'CA', name: 'California', areaCodes: ['209', '213', '279', '310', '323', '341', '408', '415', '424', '442', '510', '530', '559', '562', '619', '626', '628', '650', '657', '661', '669', '707', '714', '747', '760', '805', '818', '820', '831', '840', '858', '909', '916', '925', '949', '951'] },
  { state: 'CO', name: 'Colorado', areaCodes: ['303', '719', '720', '970', '983'] },
  { state: 'CT', name: 'Connecticut', areaCodes: ['203', '475', '860', '959'] },
  { state: 'DE', name: 'Delaware', areaCodes: ['302'] },
  { state: 'DC', name: 'Washington DC', areaCodes: ['202', '771'] },
  { state: 'FL', name: 'Florida', areaCodes: ['239', '305', '321', '352', '386', '407', '448', '561', '656', '689', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'] },
  { state: 'GA', name: 'Georgia', areaCodes: ['229', '404', '470', '478', '678', '706', '762', '770', '912', '943'] },
  { state: 'HI', name: 'Hawaii', areaCodes: ['808'] },
  { state: 'ID', name: 'Idaho', areaCodes: ['208', '986'] },
  { state: 'IL', name: 'Illinois', areaCodes: ['217', '224', '309', '312', '331', '447', '464', '618', '630', '708', '730', '773', '779', '815', '847', '861', '872'] },
  { state: 'IN', name: 'Indiana', areaCodes: ['219', '260', '317', '463', '574', '765', '812', '930'] },
  { state: 'IA', name: 'Iowa', areaCodes: ['319', '515', '563', '641', '712'] },
  { state: 'KS', name: 'Kansas', areaCodes: ['316', '620', '785', '913'] },
  { state: 'KY', name: 'Kentucky', areaCodes: ['270', '364', '502', '606', '859'] },
  { state: 'LA', name: 'Louisiana', areaCodes: ['225', '318', '337', '504', '985'] },
  { state: 'ME', name: 'Maine', areaCodes: ['207'] },
  { state: 'MD', name: 'Maryland', areaCodes: ['240', '301', '410', '443', '667'] },
  { state: 'MA', name: 'Massachusetts', areaCodes: ['339', '351', '413', '508', '617', '774', '781', '857', '978'] },
  { state: 'MI', name: 'Michigan', areaCodes: ['231', '248', '269', '313', '517', '586', '616', '679', '734', '810', '906', '947', '989'] },
  { state: 'MN', name: 'Minnesota', areaCodes: ['218', '320', '507', '612', '651', '763', '952'] },
  { state: 'MS', name: 'Mississippi', areaCodes: ['228', '601', '662', '769'] },
  { state: 'MO', name: 'Missouri', areaCodes: ['314', '417', '557', '573', '636', '660', '816', '975'] },
  { state: 'MT', name: 'Montana', areaCodes: ['406'] },
  { state: 'NE', name: 'Nebraska', areaCodes: ['308', '402', '531'] },
  { state: 'NV', name: 'Nevada', areaCodes: ['702', '725', '775'] },
  { state: 'NH', name: 'New Hampshire', areaCodes: ['603'] },
  { state: 'NJ', name: 'New Jersey', areaCodes: ['201', '551', '609', '640', '732', '848', '856', '862', '908', '973'] },
  { state: 'NM', name: 'New Mexico', areaCodes: ['505', '575'] },
  { state: 'NY', name: 'New York', areaCodes: ['212', '315', '329', '332', '347', '363', '516', '518', '585', '607', '624', '631', '646', '680', '716', '718', '838', '845', '914', '917', '929', '934'] },
  { state: 'NC', name: 'North Carolina', areaCodes: ['252', '336', '472', '704', '743', '828', '910', '919', '980', '984'] },
  { state: 'ND', name: 'North Dakota', areaCodes: ['701'] },
  { state: 'OH', name: 'Ohio', areaCodes: ['216', '220', '234', '283', '326', '330', '380', '419', '436', '440', '513', '567', '614', '740', '937'] },
  { state: 'OK', name: 'Oklahoma', areaCodes: ['405', '539', '572', '580', '918'] },
  { state: 'OR', name: 'Oregon', areaCodes: ['458', '503', '541', '971'] },
  { state: 'PA', name: 'Pennsylvania', areaCodes: ['215', '223', '267', '272', '412', '445', '484', '570', '582', '610', '717', '724', '814', '835', '878'] },
  { state: 'RI', name: 'Rhode Island', areaCodes: ['401'] },
  { state: 'SC', name: 'South Carolina', areaCodes: ['803', '821', '839', '843', '854', '864'] },
  { state: 'SD', name: 'South Dakota', areaCodes: ['605'] },
  { state: 'TN', name: 'Tennessee', areaCodes: ['423', '615', '629', '731', '865', '901', '931'] },
  { state: 'TX', name: 'Texas', areaCodes: ['210', '214', '254', '281', '325', '346', '361', '409', '430', '432', '469', '512', '621', '682', '713', '726', '737', '806', '817', '830', '832', '903', '915', '936', '940', '945', '956', '972', '979'] },
  { state: 'UT', name: 'Utah', areaCodes: ['385', '435', '801'] },
  { state: 'VT', name: 'Vermont', areaCodes: ['802'] },
  { state: 'VA', name: 'Virginia', areaCodes: ['276', '434', '540', '571', '686', '703', '757', '804', '826', '948'] },
  { state: 'WA', name: 'Washington', areaCodes: ['206', '253', '360', '425', '509', '564'] },
  { state: 'WV', name: 'West Virginia', areaCodes: ['304', '681'] },
  { state: 'WI', name: 'Wisconsin', areaCodes: ['262', '274', '414', '534', '608', '715', '920'] },
  { state: 'WY', name: 'Wyoming', areaCodes: ['307'] },
]

const CODE_TO_NAME = new Map(STATE_AREA_CODES.map(s => [s.state, s.name]))
const NAME_TO_CODE = new Map(STATE_AREA_CODES.map(s => [s.name.toUpperCase(), s.state]))
const AREA_TO_STATE = new Map<string, string>()
for (const s of STATE_AREA_CODES) {
  for (const ac of s.areaCodes) AREA_TO_STATE.set(ac, s.state)
}

function resolveState(rawState: string | null, phone: string | null): string | null {
  if (rawState) {
    const v = rawState.trim().toUpperCase()
    if (v.length === 2 && CODE_TO_NAME.has(v)) return v
    const byName = NAME_TO_CODE.get(v)
    if (byName) return byName
  }
  if (phone) {
    const digits = phone.replace(/\D/g, '')
    const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
    if (ten.length === 10) {
      const byArea = AREA_TO_STATE.get(ten.slice(0, 3))
      if (byArea) return byArea
    }
  }
  return null
}

const PAGE = 1000
const MAX_PAGES = 100 // 100k leads ceiling

export async function GET() {
  try {
    await requireAdmin()

    // ── leads (paginated — Supabase caps at 1000/req) ────────────────────
    const leadCounts = new Map<string, number>()
    let totalLeads = 0
    let leadsWithState = 0
    let unknownStateLeads = 0

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data: rows, error } = await supabase
        .from('leads')
        .select('state, phone')
        .range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw error
      if (!rows || rows.length === 0) break

      for (const r of rows) {
        totalLeads++
        if (r.state && r.state.trim()) leadsWithState++
        const code = resolveState(r.state, r.phone)
        if (code) leadCounts.set(code, (leadCounts.get(code) ?? 0) + 1)
        else unknownStateLeads++
      }
      if (rows.length < PAGE) break
    }

    // ── pool numbers (everything not released) ───────────────────────────
    const { data: numbers, error: poolErr } = await supabase
      .from('phone_numbers')
      .select('state, area_code, status, daily_cap, daily_call_count')
      .neq('status', 'released')
    if (poolErr) throw poolErr

    interface PoolAgg { total: number; active: number; capacity: number; callsToday: number }
    const poolByState = new Map<string, PoolAgg>()
    let poolTotal = 0
    let poolActive = 0

    for (const n of numbers ?? []) {
      const code = resolveState(n.state, null) ?? AREA_TO_STATE.get(String(n.area_code)) ?? null
      poolTotal++
      const isActive = n.status === 'active'
      if (isActive) poolActive++
      if (!code) continue
      const agg = poolByState.get(code) ?? { total: 0, active: 0, capacity: 0, callsToday: 0 }
      agg.total++
      if (isActive) {
        agg.active++
        agg.capacity += n.daily_cap ?? 0
        agg.callsToday += n.daily_call_count ?? 0
      }
      poolByState.set(code, agg)
    }

    // ── merge + score ────────────────────────────────────────────────────
    const resolvableLeads = totalLeads - unknownStateLeads
    const totalCapacity = Array.from(poolByState.values()).reduce((s, a) => s + a.capacity, 0)

    const allCodes = new Set<string>([...leadCounts.keys(), ...poolByState.keys()])
    let uncoveredLeads = 0
    let statesCovered = 0

    const states = Array.from(allCodes).map(code => {
      const leads = leadCounts.get(code) ?? 0
      const pool = poolByState.get(code) ?? { total: 0, active: 0, capacity: 0, callsToday: 0 }
      const leadsShare = resolvableLeads > 0 ? (leads / resolvableLeads) * 100 : 0
      const capacityShare = totalCapacity > 0 ? (pool.capacity / totalCapacity) * 100 : 0
      const gap = leadsShare - capacityShare

      let verdict: string
      if (leads > 0 && pool.active === 0) {
        verdict = 'NEED'
        uncoveredLeads += leads
      } else if (leads === 0 && pool.total > 0) {
        verdict = 'SURPLUS'
      } else if (gap >= 2) {
        verdict = 'NEED MORE'
      } else if (gap > 0) {
        verdict = 'STRETCHED'
      } else if (gap > -2) {
        verdict = 'BALANCED'
      } else {
        verdict = 'SURPLUS'
      }
      if (leads > 0 && pool.active > 0) statesCovered++

      return {
        code,
        name: CODE_TO_NAME.get(code) ?? code,
        leads,
        leadsPct: Math.round(leadsShare * 10) / 10,
        poolNumbers: pool.total,
        activeNumbers: pool.active,
        dailyCapacity: pool.capacity,
        callsToday: pool.callsToday,
        leadsPerNumber: pool.active > 0 ? Math.round((leads / pool.active) * 10) / 10 : null,
        capacityPct: Math.round(capacityShare * 10) / 10,
        gap: Math.round(gap * 10) / 10,
        verdict,
      }
    }).sort((a, b) => b.gap - a.gap || b.leads - a.leads)

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      summary: {
        totalLeads,
        leadsWithState,
        unknownStateLeads,
        statesWithLeads: leadCounts.size,
        statesCovered,
        uncoveredLeads,
        poolTotal,
        poolActive,
      },
      states,
    })
  } catch (err: any) {
    console.error('[admin/pool/analytics] failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to compute pool analytics' },
      { status }
    )
  }
}