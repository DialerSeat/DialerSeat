import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { resolveAnalyticsScope } from '@/lib/analyticsScope'
import {
  canonical, labelFor, DISPOSITIONS,
  BREAKDOWN_FORMS, LEGACY_STATUS_VALUES,
} from '@/lib/dispositions'


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Own data by default; an admin may request another user's by id.
  const scoped = await resolveAnalyticsScope(searchParams.get('user_id'))
  if (!scoped.ok) {
    return NextResponse.json({ success: false, error: scoped.error }, { status: scoped.status })
  }
  const userId = scoped.scope.userId
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  let query = supabaseAdmin.from('calls').select('disposition').eq('user_id', userId)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  if (error) {
    return apiError(error, { route: 'analytics/dispositions' })
  }

  // ── COUNT WHAT HAPPENED, NOT WHAT WOULD TIDY UP ───────────────────────
  // Three things were wrong here and each one flattered the data:
  //
  //   `c.disposition || 'NO ANSWER'` turned every UNDISPOSITIONED call into a
  //   no-answer. That is not a gap being reported, it is an outcome being
  //   invented — and with the machine path writing nothing, it was inventing
  //   it for most of the traffic.
  //
  //   NO_ANSWER_AMD was folded into NO ANSWER, discarding the difference
  //   between "nobody picked up" and "a machine did". Those want opposite
  //   responses from whoever reads the report.
  //
  //   Anything not on a hardcoded allow-list was dropped silently, so
  //   TCPA_BLOCKED and ABANDONED calls vanished from a breakdown that still
  //   presented itself as complete.
  //
  // Now: legacy spellings are folded onto their canonical value, nothing is
  // dropped, and calls with no disposition are reported as exactly that.
  const counts: Record<string, number> = {}
  for (const c of data || []) {
    // ── WHAT THIS CHART IS ABOUT ────────────────────────────────────────
    // Three things are left out, each for a stated reason rather than by an
    // allow-list that quietly swallowed whole categories:
    //
    //   no disposition — a call that never reached an outcome. Real, and
    //   worth knowing, but it is an absence and it dominated the chart.
    //
    //   SKIPPED — the dialer moving on. The largest bucket by far and it
    //   says nothing about how a conversation went.
    //
    //   'completed' / 'failed' — call STATUSES that leaked into this column
    //   in the SignalWire era. Nothing writes them now.
    //
    // Everything else stays, including the ones an allow-list used to drop.
    if (!c.disposition) continue
    if (LEGACY_STATUS_VALUES.has(c.disposition)) continue
    if (!BREAKDOWN_FORMS.has(c.disposition)) continue

    const key = canonical(c.disposition) as string
    counts[key] = (counts[key] || 0) + 1
  }

  // ── OUTCOMES FIRST, MACHINERY SECOND ──────────────────────────────────
  // Removing the old allow-list was right — it was silently dropping whole
  // categories — but it left every bucket competing on volume alone. On real
  // traffic the system ones win by an order of magnitude: skips, voicemails
  // and no-answers bury the nine calls that actually closed, which are the
  // only rows anybody opens this chart to read.
  //
  // So they are grouped rather than filtered. Nothing is hidden, the counts
  // are unchanged, and what somebody decided about a call sorts above what
  // happened to it.
  const AGENT = new Set(DISPOSITIONS.filter(d => d.agentChosen).map(d => d.value))

  const breakdown = Object.entries(counts)
    .map(([disposition, count]) => ({
      disposition,
      // The label travels with it so every screen prints the same words and
      // none of them has to know that NO_ANSWER is spelled with an underscore.
      label: labelFor(disposition),
      group: AGENT.has(disposition) ? 'outcome' : 'system',
      count,
    }))
    .sort((a, b) =>
      a.group === b.group ? b.count - a.count : a.group === 'outcome' ? -1 : 1
    )

  return NextResponse.json({ success: true, breakdown })
}