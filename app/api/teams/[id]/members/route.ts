import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('teams/members')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/teams/[id]/members — one row per member, everything the floor needs
// =============================================================================
// The Teams rebuild renders every member twice: as a live agent card and as a
// roster row. Both need identity, live state, and today's numbers together.
//
// Built as ONE endpoint doing four bulk queries rather than per-member calls,
// because the obvious shape — fetch members, then loop — is N+1 and gets worse
// exactly when a floor gets big enough to care about.
// =============================================================================

/** Matches the dialer's own staleness rule: no beat in 15s and you are gone. */
const ONLINE_WINDOW_MS = 15_000

export type LiveState = 'on_call' | 'dialing' | 'ready' | 'wrapping' | 'offline'

export interface TeamMemberRow {
  memberId: string
  userId: string
  name: string
  email: string | null
  status: string
  seatSuspended: boolean
  billingOverride: string | null
  seatPriceCents: number | null
  live: LiveState
  dialerMode: string | null
  callsToday: number
  answeredToday: number
  connectRatePct: number | null
  talkSecondsToday: number
  /** Last 20 calls, newest last: 1 answered, 0 not. Drives the sparkline. */
  spark: number[]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireUser()
    if (!gate.ok) return gate.response
    const { id: teamId } = await params

    // Owner or member — same rule the rest of the team routes use. Without it
    // any signed-in user could read another team's floor by id.
    const { data: team } = await supabase
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .maybeSingle()
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }
    if (team.owner_id !== gate.userId) {
      const { data: membership } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', gate.userId)
        .eq('status', 'active')
        .maybeSingle()
      if (!membership) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: members, error: memErr } = await supabase
      .from('team_members')
      .select('id, user_id, status, billing_override, seat_price_override_cents, seat_suspended_at')
      .eq('team_id', teamId)
      .in('status', ['active', 'pending'])
    if (memErr) throw memErr

    const rows = members ?? []
    if (rows.length === 0) {
      return NextResponse.json({ success: true, members: [] })
    }

    const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))]

    // Midnight local-ish. Deliberately server-day rather than per-agent
    // timezone: a floor manager reads one clock, and mixing agent-local days
    // would make the column sum to something that matches nobody's day.
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const sinceIso = startOfDay.toISOString()
    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()

    const [usersRes, sessionsRes, callsRes] = await Promise.all([
      // Matched on BOTH keys deliberately. agent_sessions.user_id holds the
      // internal users.id while team_members.user_id holds the Clerk id —
      // the same column name meaning different things in two tables. This
      // already caused Live Ops to print raw uuids instead of names.
      supabase
        .from('users')
        .select('id, clerk_id, first_name, last_name, email, username')
        .or(
          `clerk_id.in.(${userIds.map(u => `"${u}"`).join(',')}),` +
          `id.in.(${userIds.map(u => `"${u}"`).join(',')})`
        ),

      supabase
        .from('agent_sessions')
        .select('user_id, state, dialer_mode, last_heartbeat')
        .eq('team_id', teamId)
        .gte('last_heartbeat', onlineSince),

      // call_control_id NOT NULL is load-bearing: 1,462 rows in this table are
      // disposition records written with no Telnyx call behind them. Counting
      // them as calls understates every connect rate on the page.
      supabase
        .from('calls')
        .select('user_id, answered_at, talk_seconds, created_at')
        .eq('team_id', teamId)
        .not('call_control_id', 'is', null)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(20000),
    ])

    // Keyed under both ids so a lookup hits whichever the row happens to hold.
    const userById = new Map<string, any>()
    for (const u of usersRes.data ?? []) {
      if (u.id) userById.set(String(u.id), u)
      if (u.clerk_id) userById.set(u.clerk_id, u)
    }

    const sessionByUser = new Map<string, any>()
    for (const s of sessionsRes.data ?? []) {
      if (s.user_id) sessionByUser.set(String(s.user_id), s)
    }

    const callsByUser = new Map<string, { answered: boolean; talk: number }[]>()
    for (const c of callsRes.data ?? []) {
      const key = String(c.user_id)
      const list = callsByUser.get(key) ?? []
      list.push({ answered: !!c.answered_at, talk: c.talk_seconds ?? 0 })
      callsByUser.set(key, list)
    }

    const out: TeamMemberRow[] = rows.map(m => {
      const u = userById.get(String(m.user_id))
      const internalId = u?.id ? String(u.id) : null
      // A session may be keyed by either id, so try both before concluding
      // the agent is offline.
      const session =
        sessionByUser.get(String(m.user_id)) ??
        (internalId ? sessionByUser.get(internalId) : undefined)

      const calls =
        callsByUser.get(String(m.user_id)) ??
        (internalId ? callsByUser.get(internalId) : undefined) ??
        []

      const answered = calls.filter(c => c.answered).length
      const full = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim()

      let live: LiveState = 'offline'
      if (session) {
        const s = String(session.state || '')
        live =
          s === 'on_call' ? 'on_call'
          : s === 'dialing' ? 'dialing'
          : s === 'wrapping' ? 'wrapping'
          : s === 'ready' ? 'ready'
          : 'offline'
      }

      return {
        memberId: m.id,
        userId: m.user_id,
        name: full || u?.username || u?.email || 'Unknown',
        email: u?.email ?? null,
        status: m.status,
        seatSuspended: !!m.seat_suspended_at,
        billingOverride: m.billing_override ?? null,
        seatPriceCents: m.seat_price_override_cents ?? null,
        live,
        dialerMode: session?.dialer_mode ?? null,
        callsToday: calls.length,
        answeredToday: answered,
        // Null rather than 0% on a tiny sample — a dash is honest where a
        // percentage would invent precision nobody has earned yet.
        connectRatePct: calls.length >= 5
          ? Math.round((answered / calls.length) * 100)
          : null,
        talkSecondsToday: calls.reduce((s, c) => s + c.talk, 0),
        spark: calls.slice(-20).map(c => (c.answered ? 1 : 0)),
      }
    })

    // On-call first, then the rest of the live states, offline last. The floor
    // should lead with whoever is actually working.
    const order: Record<LiveState, number> = {
      on_call: 0, dialing: 1, wrapping: 2, ready: 3, offline: 4,
    }
    out.sort((a, b) => order[a.live] - order[b.live] || a.name.localeCompare(b.name))

    return NextResponse.json({ success: true, members: out })
  } catch (err) {
    return apiError(err, { route: 'teams/[id]/members' })
  }
}
