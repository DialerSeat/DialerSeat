import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { resolveAnalyticsScope } from '@/lib/analyticsScope'
import { canonical, labelFor } from '@/lib/dispositions'

const NO_DISPOSITION = 'NO_DISPOSITION'

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
    const key = c.disposition ? (canonical(c.disposition) as string) : NO_DISPOSITION
    counts[key] = (counts[key] || 0) + 1
  }

  const breakdown = Object.entries(counts)
    .map(([disposition, count]) => ({
      disposition,
      // The label travels with it so every screen prints the same words and
      // none of them has to know that NO_ANSWER is spelled with an underscore.
      label: disposition === NO_DISPOSITION ? 'No disposition' : labelFor(disposition),
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({ success: true, breakdown })
}