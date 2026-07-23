import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

const supabase = getServiceClient('admin/user-tracker')

const DAY = 86400000
const CALLS_ROW_CAP = 200_000
const EVENTS_ROW_CAP = 200_000
const SERIES_DAYS = 30

interface BucketStats {
  calls: number
  dialSeconds: number
  connectedCalls: number
  connectedSeconds: number
  skippedCalls: number
  wastedSeconds: number
}

function emptyBucket(): BucketStats {
  return { calls: 0, dialSeconds: 0, connectedCalls: 0, connectedSeconds: 0, skippedCalls: 0, wastedSeconds: 0 }
}

function addBucket(
  target: BucketStats,
  calls: number,
  dialSeconds: number,
  connected: boolean,
  connectedSeconds: number,
  isSkippedOrNoAnswer: boolean,
  wastedSeconds: number
) {
  target.calls += calls
  target.dialSeconds += dialSeconds
  if (connected) {
    target.connectedCalls += 1
    target.connectedSeconds += connectedSeconds
  }
  if (isSkippedOrNoAnswer) {
    target.skippedCalls += 1
    target.wastedSeconds += wastedSeconds
  }
}

interface UserStatsRow {
  today: BucketStats
  week: BucketStats
  month30: BucketStats
  all: BucketStats
}

function emptyUserStats(): UserStatsRow {
  return { today: emptyBucket(), week: emptyBucket(), month30: emptyBucket(), all: emptyBucket() }
}

const CONNECTED_DISPOSITIONS = new Set(['completed'])
const DISCONNECTED_DISPOSITIONS = new Set([
  'busy', 'canceled', 'failed', 'no_answer',
  // Real disposition values confirmed via direct production query
  // (2026-07-21) that were previously falling through to the catch-all
  // "duration > 0 and not explicitly disconnected" condition below and
  // getting wrongly counted as connected calls:
  'SKIPPED',        // the dialer bypassed this call entirely — it never
                     // happened, let alone connected. 52 of 364 SKIPPED
                     // rows had duration > 0 and were being miscounted.
  'NO_ANSWER',
  'NO_ANSWER_AMD',  // answering machine detected — not a human conversation.
                     // All 3 rows with this disposition had duration > 0
                     // and were being miscounted.
  'TCPA_BLOCKED',
])

// Which of the above should ALSO be pulled out of dialSeconds/"time
// dialed" and surfaced as its own separate "skipped/no answer" metric
// instead. Confirmed via direct query (2026-07-21): 52 SKIPPED rows carry
// ~45 minutes of leftover duration even though a skip means the call was
// never actually placed — that time was silently inflating "time dialed"
// totals. Rather than just subtract and hide it, it gets its own visible
// number so nothing about real usage is obscured either way.
const SKIPPED_OR_NO_ANSWER_DISPOSITIONS = new Set(['SKIPPED', 'NO_ANSWER', 'NO_ANSWER_AMD'])

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const now = Date.now()

  const todayStart = (() => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()

  const weekStart = (() => {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()

  const month30Start = now - 30 * DAY

  // ---- users -----------------------------------------------------------
  const { data: usersRaw, error: usersErr } = await supabase
    .from('users')
    .select('clerk_id, email, first_name, last_name, created_at, last_seen_at, is_admin, exclude_from_analytics')

  if (usersErr) {
    return NextResponse.json({ success: false, error: usersErr.message }, { status: 500 })
  }

  const excluded = new Set<string>()
  const userMeta = new Map<string, any>()
  for (const u of usersRaw || []) {
    if (u.is_admin || u.exclude_from_analytics) {
      excluded.add(u.clerk_id)
      continue
    }
    userMeta.set(u.clerk_id, u)
  }

  // ---- calls (source of truth for count + total dial time) -------------
  const { data: callsRaw, error: callsErr } = await supabase
    .from('calls')
    .select('id, user_id, duration, created_at, disposition')
    .order('created_at', { ascending: false })
    .limit(CALLS_ROW_CAP)

  if (callsErr) {
    return NextResponse.json({ success: false, error: callsErr.message }, { status: 500 })
  }

  const calls = (callsRaw || []).filter(c => !excluded.has(c.user_id))
  const callIds = calls.map(c => c.id)

  // ---- call_events (source of truth for connected/talk time) -----------
  // call_events only exists going back to 2026-06-28, so coverage may be
  // partial for older calls — that's fine, we only use it to *supplement*
  // connected-seconds; call counts and dial time always come from `calls`.
  const connectedSecondsByCall = new Map<string, number>()
  const hasAnsweredEvent = new Set<string>()

  if (callIds.length > 0) {
    // chunk the .in() filter to stay well under URL/param limits
    const CHUNK = 500
    const answeredAt = new Map<string, number>()
    const completedAt = new Map<string, number>()

    for (let i = 0; i < callIds.length; i += CHUNK) {
      const chunk = callIds.slice(i, i + CHUNK)
      const { data: events } = await supabase
        .from('call_events')
        .select('call_id, event_type, created_at')
        .in('call_id', chunk)
        .in('event_type', ['answered', 'completed', 'bridged'])
        .limit(EVENTS_ROW_CAP)

      for (const e of events || []) {
        if (!e.call_id) continue
        const t = new Date(e.created_at).getTime()
        if (e.event_type === 'answered' || e.event_type === 'bridged') {
          hasAnsweredEvent.add(e.call_id)
          const existing = answeredAt.get(e.call_id)
          if (existing === undefined || t < existing) answeredAt.set(e.call_id, t)
        } else if (e.event_type === 'completed') {
          completedAt.set(e.call_id, t)
        }
      }
    }

    for (const id of callIds) {
      const a = answeredAt.get(id)
      const c = completedAt.get(id)
      if (a !== undefined && c !== undefined && c > a) {
        connectedSecondsByCall.set(id, Math.round((c - a) / 1000))
      }
    }
  }

  // ---- per-user aggregation ---------------------------------------------
  const statsByUser = new Map<string, UserStatsRow>()
  const seriesMap = new Map<string, { calls: number; dialSeconds: number; connectedSeconds: number; wastedSeconds: number; activeUsers: Set<string> }>()

  for (let i = SERIES_DAYS - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY)
    d.setHours(0, 0, 0, 0)
    seriesMap.set(d.toISOString().slice(0, 10), { calls: 0, dialSeconds: 0, connectedSeconds: 0, wastedSeconds: 0, activeUsers: new Set() })
  }

  for (const c of calls) {
    const uid = c.user_id
    if (!userMeta.has(uid)) continue // orphaned/deleted user, skip
    let s = statsByUser.get(uid)
    if (!s) { s = emptyUserStats(); statsByUser.set(uid, s) }

    const t = new Date(c.created_at).getTime()
    const rawSeconds = c.duration || 0
    const isSkippedOrNoAnswer = SKIPPED_OR_NO_ANSWER_DISPOSITIONS.has(c.disposition || '')
    // Real dial time excludes skipped/no-answer duration — that leftover
    // time was never an actual placed-and-worked call, so it shouldn't
    // inflate "time dialed." It's tracked separately below instead of
    // just being dropped.
    const dialSeconds = isSkippedOrNoAnswer ? 0 : rawSeconds
    const wastedSeconds = isSkippedOrNoAnswer ? rawSeconds : 0
    const connSeconds = connectedSecondsByCall.get(c.id) ?? 0
    const isConnected = !isSkippedOrNoAnswer && (
      hasAnsweredEvent.has(c.id)
      || CONNECTED_DISPOSITIONS.has(c.disposition || '')
      || (rawSeconds > 0 && !DISCONNECTED_DISPOSITIONS.has(c.disposition || ''))
    )

    addBucket(s.all, 1, dialSeconds, isConnected, connSeconds, isSkippedOrNoAnswer, wastedSeconds)
    if (t >= month30Start) addBucket(s.month30, 1, dialSeconds, isConnected, connSeconds, isSkippedOrNoAnswer, wastedSeconds)
    if (t >= weekStart) addBucket(s.week, 1, dialSeconds, isConnected, connSeconds, isSkippedOrNoAnswer, wastedSeconds)
    if (t >= todayStart) addBucket(s.today, 1, dialSeconds, isConnected, connSeconds, isSkippedOrNoAnswer, wastedSeconds)

    const dayKey = new Date(t).toISOString().slice(0, 10)
    const bucket = seriesMap.get(dayKey)
    if (bucket) {
      bucket.calls += 1
      bucket.dialSeconds += dialSeconds
      bucket.connectedSeconds += connSeconds
      bucket.wastedSeconds += wastedSeconds
      bucket.activeUsers.add(uid)
    }
  }

  // ---- shape user rows ----------------------------------------------------
  const users = Array.from(userMeta.values()).map(u => {
    const s = statsByUser.get(u.clerk_id) || emptyUserStats()
    return {
      clerk_id: u.clerk_id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      created_at: u.created_at,
      last_seen_at: u.last_seen_at,
      stats: s,
    }
  })

  users.sort((a, b) => b.stats.all.calls - a.stats.all.calls)

  // ---- platform overview ---------------------------------------------------
  function sumBucket(pick: (s: UserStatsRow) => BucketStats): BucketStats {
    const out = emptyBucket()
    for (const s of statsByUser.values()) {
      const b = pick(s)
      out.calls += b.calls
      out.dialSeconds += b.dialSeconds
      out.connectedCalls += b.connectedCalls
      out.connectedSeconds += b.connectedSeconds
      out.skippedCalls += b.skippedCalls
      out.wastedSeconds += b.wastedSeconds
    }
    return out
  }

  function activeUserCount(pick: (s: UserStatsRow) => BucketStats): number {
    let n = 0
    for (const s of statsByUser.values()) if (pick(s).calls > 0) n++
    return n
  }

  const totalUserCount = userMeta.size

  function overviewFor(pick: (s: UserStatsRow) => BucketStats) {
    const totals = sumBucket(pick)
    const activeUsers = activeUserCount(pick)
    return {
      totals,
      activeUsers,
      totalUsers: totalUserCount,
      avgCallsPerActiveUser: activeUsers > 0 ? Math.round((totals.calls / activeUsers) * 10) / 10 : 0,
      avgDialSecondsPerActiveUser: activeUsers > 0 ? Math.round(totals.dialSeconds / activeUsers) : 0,
      avgConnectedSecondsPerActiveUser: activeUsers > 0 ? Math.round(totals.connectedSeconds / activeUsers) : 0,
    }
  }

  const series = Array.from(seriesMap.entries()).map(([date, v]) => ({
    date,
    calls: v.calls,
    dialSeconds: v.dialSeconds,
    connectedSeconds: v.connectedSeconds,
    wastedSeconds: v.wastedSeconds,
    activeUsers: v.activeUsers.size,
    avgCallsPerActiveUser: v.activeUsers.size > 0 ? Math.round((v.calls / v.activeUsers.size) * 10) / 10 : 0,
  }))

  return NextResponse.json({
    success: true,
    generatedAt: new Date(now).toISOString(),
    overview: {
      today: overviewFor(s => s.today),
      week: overviewFor(s => s.week),
      month30: overviewFor(s => s.month30),
      all: overviewFor(s => s.all),
      series,
    },
    users,
    callsRowsCapped: (callsRaw || []).length >= CALLS_ROW_CAP,
  })
}
