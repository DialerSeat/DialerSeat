import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'
import { BUILD_SHA } from '@/lib/buildId'

const supabase = getServiceClient('admin/build-adoption')

// How recently a tab must have beaten to count as somebody currently dialing.
// Matches the window Live Ops uses for "online" -- a longer one counts people
// who closed their laptop, and the question here is only about tabs that are
// open right now and could act on a reload.
const ONLINE_WINDOW_MS = 90_000

// ─────────────────────────────────────────────────────────────────────────
// DID THE RELOAD LAND?
//
// "Reload all dialers" was pressed for the first time on 17 Sept and there was
// no way to answer that question. Nothing recorded which build a tab was
// running, and agent_sessions.last_heartbeat is a last-value column, so there
// was no history to reconstruct from either. The button was pressed hopefully
// and confirmed never.
//
// This is the read that closes that loop. It compares what each live tab says
// it is running against what this deployment is serving.
//
// ── THE THREE STATES ARE NOT TWO ───────────────────────────────────────
// current  the tab reported this build. It has the fix, whatever the fix was.
//
// stale    the tab reported a DIFFERENT sha. It is behind -- but it is running
//          code that reports its build, which means it is also running the
//          reload handler, so pressing the button WILL reach it.
//
// silent   the tab reported nothing. It predates build reporting entirely,
//          which means it also predates the reload handler, so the button
//          cannot reach it and never will. Only the agent reloading by hand,
//          or going home and coming back, clears this one.
//
// That last distinction is the entire reason this endpoint exists. Collapsing
// silent into stale would say "9 agents behind, press the button" when the
// truth is "6 you can reach, 3 you cannot".
// ─────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()

    const { data, error } = await supabase
      .from('agent_sessions')
      .select('id, user_id, client_build, last_heartbeat')
      .gte('last_heartbeat', since)
      .limit(500)

    if (error) throw error

    const rows = data || []
    const current = rows.filter(r => r.client_build === BUILD_SHA)
    const silent = rows.filter(r => !r.client_build)
    const stale = rows.filter(r => r.client_build && r.client_build !== BUILD_SHA)

    // Which old builds are actually out there, commonest first. Turns "3 are
    // behind" into "3 are on a2f91c4", which is the difference between knowing
    // something is wrong and knowing what to do about it.
    const byBuild = new Map<string, number>()
    for (const r of stale) {
      const k = r.client_build as string
      byBuild.set(k, (byBuild.get(k) ?? 0) + 1)
    }

    return NextResponse.json({
      serving: BUILD_SHA,
      online: rows.length,
      current: current.length,
      stale: stale.length,
      // Named for what it means operationally, not for the null it comes from.
      unreachable: silent.length,
      staleBuilds: [...byBuild.entries()]
        .map(([build, count]) => ({ build, count }))
        .sort((a, b) => b.count - a.count),
    })
  } catch (err: unknown) {
    return apiError(err, { route: 'admin/build-adoption' })
  }
}
