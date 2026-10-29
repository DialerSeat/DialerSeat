import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { sendAdminPush } from '@/lib/pushNotify'
import { COST_PER_AMD_LEG_USD, TAX_RATE } from '@/lib/telephonyCosts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// AGENT DAILY SPEND — tell Joshua when one agent's day passes the threshold
// =============================================================================
// Joshua, 28 Oct 2026: no agent should run past $3 of carrier cost in a day,
// and when one does he wants to KNOW, not have their dialing stopped. So this
// warns, once per agent per day, and changes nothing about the dialer.
//
// The figure is Telnyx's own itemised cost for every leg that agent caused
// (lead, agent leg, predictive seat, and each one's credential-connection
// twin), plus detection and tax: agent_spend_for_day in
// db/migrations/2026-10-28-agent-daily-spend-alert.sql. On 28 Oct it put Frank
// at $4.99 for 519 dials, matching a leg-by-leg count.
//
// The day is the US Eastern calendar day. call.cost arrives when a leg ends,
// so the figure trails the live spend by a call or two, never ahead of it.
// =============================================================================

/** Today's date in US Eastern time, as YYYY-MM-DD. */
function easternDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = getServiceClient('cron/agent-spend')
    const day = easternDay()

    const { data: cfg } = await db
      .from('platform_config')
      .select('agent_daily_spend_alert_usd')
      .limit(1)
      .maybeSingle()
    const threshold = Number(cfg?.agent_daily_spend_alert_usd ?? 3)
    // Zero or unset switches the warning off without a deploy.
    if (!Number.isFinite(threshold) || threshold <= 0) {
      return NextResponse.json({ success: true, skipped: 'threshold off', day })
    }

    const { data: rows, error } = await db.rpc('agent_spend_for_day', {
      p_day: day, p_amd_usd: COST_PER_AMD_LEG_USD, p_tax_rate: TAX_RATE,
    })
    if (error) throw error

    const over = ((rows || []) as Array<{ user_id: string; dials: number; spend_usd: number }>)
      .filter(r => Number(r.spend_usd) >= threshold)

    let alerted = 0
    for (const r of over) {
      // The insert is the once-a-day lock: a second run that day conflicts
      // and sends nothing.
      const { data: claimed } = await db
        .from('agent_spend_alerts')
        .upsert(
          { user_id: r.user_id, day, spend_usd: r.spend_usd, dials: r.dials },
          { onConflict: 'user_id,day', ignoreDuplicates: true },
        )
        .select('user_id')
      if (!claimed || claimed.length === 0) continue

      const { data: u } = await db
        .from('users')
        .select('first_name, last_name, email')
        .eq('clerk_id', r.user_id)
        .maybeSingle()
      const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || u?.email || 'An agent'
      const spend = Number(r.spend_usd)
      const dials = Number(r.dials) || 0
      const perDial = dials > 0 ? ` ($${(spend / dials).toFixed(4)} a dial)` : ''
      await sendAdminPush(
        'agent_spend',
        `${name} is at $${spend.toFixed(2)} today on ${dials} dials${perDial}, past the $${threshold.toFixed(2)} threshold. Dialing continues.`,
      )
      alerted++
    }

    return NextResponse.json({ success: true, day, threshold, agents: (rows || []).length, over: over.length, alerted })
  } catch (err) {
    return apiError(err, { route: 'cron/agent-spend' })
  }
}
