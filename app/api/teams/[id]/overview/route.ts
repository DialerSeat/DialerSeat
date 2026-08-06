import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'

// =============================================================================
// TEAM OVERVIEW — the numbers behind the command-center strip
// =============================================================================
// One round trip for everything the Teams overview shows, so the panel doesn't
// fan out four fetches and render in pieces.
//
// EVERY FIGURE HERE COMES FROM A TABLE THE APP ACTUALLY WRITES.
//
// That is a deliberate constraint, not a description. `team_analytics` looks
// like the natural source for this endpoint and is not usable: all 504 of its
// rows were inserted in a single instant (identical created_at down to the
// microsecond, exactly 168 hourly rows per team across exactly 7 days), and it
// claims ~49,800 calls when the `calls` table holds 2,401 rows in total. It is
// seed data. An owner deciding whether to add a seat would be reading fiction.
//
// So: live agent state and spend come from view_team_realtime_health (which
// reads agent_sessions / calls / team_seat_charges directly), and call outcomes
// are counted off `calls` itself. Where there is no data, this returns null and
// the UI shows a dash — never a plausible-looking number.
// =============================================================================

/** Window for the connect-rate figure. */
const CALL_LOOKBACK_DAYS = 7

interface OverviewLive {
  online: number
  dialing: number
  onCall: number
  ready: number
  callsLastHour: number
}

interface OverviewSpend {
  /** Sum of seats whose paid period covers right now. */
  weeklyCents: number
  seatCount: number
  lifetimePaidCents: number
}

interface OverviewSeats {
  active: number
  pending: number
}

interface OverviewCalls {
  total: number
  answered: number
  /** null when there were no calls — the UI must show a dash, not 0%. */
  connectRatePct: number | null
  talkMinutes: number
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId } = await params

    // Owner-only. This exposes billing totals, so membership is not enough.
    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (teamErr) throw teamErr
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }
    if (team.owner_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const since = new Date(Date.now() - CALL_LOOKBACK_DAYS * 24 * 60 * 60_000).toISOString()
    const nowIso = new Date().toISOString()

    const [
      { data: health },
      { data: charges },
      { data: members },
      { data: calls },
    ] = await Promise.all([
      supabaseAdmin
        .from('view_team_realtime_health')
        .select('agents_online, agents_dialing, agents_on_call, agents_ready, calls_last_hour, total_lifetime_spend_cents')
        .eq('team_id', teamId)
        .maybeSingle(),

      // Seats currently paid for in a period that covers now. Summed rather
      // than counted x a flat price: seat_price_override_cents means seats
      // genuinely differ, which is the whole point of reselling at a markup.
      supabaseAdmin
        .from('team_seat_charges')
        .select('amount_cents')
        .eq('team_id', teamId)
        .eq('status', 'paid')
        .gt('period_end', nowIso),

      supabaseAdmin
        .from('team_members')
        .select('status')
        .eq('team_id', teamId)
        .in('status', ['active', 'pending']),

      supabaseAdmin
        .from('calls')
        .select('answered_at, duration')
        .eq('team_id', teamId)
        .gte('created_at', since)
        .limit(20000),
    ])

    const live: OverviewLive = {
      online: Number(health?.agents_online ?? 0),
      dialing: Number(health?.agents_dialing ?? 0),
      onCall: Number(health?.agents_on_call ?? 0),
      ready: Number(health?.agents_ready ?? 0),
      callsLastHour: Number(health?.calls_last_hour ?? 0),
    }

    const chargeRows = charges || []
    const spend: OverviewSpend = {
      weeklyCents: chargeRows.reduce((s, c) => s + (c.amount_cents ?? 0), 0),
      seatCount: chargeRows.length,
      lifetimePaidCents: Number(health?.total_lifetime_spend_cents ?? 0),
    }

    const memberRows = members || []
    const seats: OverviewSeats = {
      active: memberRows.filter(m => m.status === 'active').length,
      pending: memberRows.filter(m => m.status === 'pending').length,
    }

    const callRows = calls || []
    const answered = callRows.filter(c => c.answered_at !== null).length
    const callStats: OverviewCalls = {
      total: callRows.length,
      answered,
      connectRatePct: callRows.length > 0
        ? Math.round((answered / callRows.length) * 100)
        : null,
      talkMinutes: Math.round(
        callRows.reduce((s, c) => s + (c.duration ?? 0), 0) / 60
      ),
    }

    return NextResponse.json({
      success: true,
      overview: { live, spend, seats, calls: callStats, lookbackDays: CALL_LOOKBACK_DAYS },
    })
  } catch (err) {
    return apiError(err, { route: 'teams/[id]/overview' })
  }
}
