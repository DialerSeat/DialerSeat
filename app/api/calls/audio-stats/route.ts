import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logCallEvent } from '@/lib/callEvents'
import { describeAudioProblem, type CallAudioStats } from '@/lib/webrtcStats'
import { apiError } from '@/lib/apiError'

// =============================================================================
// WHAT THE CALL SOUNDED LIKE, RECORDED
// =============================================================================
// Reported by the browser at the end of an agent leg, because the browser is
// the only thing that can see it — getStats() lives on the RTCPeerConnection
// and nothing server-side has a view of packet loss, jitter or the negotiated
// codec.
//
// Written into call_events alongside everything else about the call, so audio
// quality can be joined to disposition, agent, campaign and hour rather than
// living in a separate place nobody looks.
//
// ── WHY THIS ROUTE TRUSTS ALMOST NOTHING ───────────────────────────────────
// It is called from the client, so the numbers are self-reported and could be
// anything. That is fine for a diagnostic and would not be fine for anything
// else: nothing here bills, gates, or decides. The call_control_id is matched
// against the caller's own session only insofar as auth is required — a wrong
// id produces a mislabelled diagnostic row, which is the worst it can do.

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const callControlId: unknown = body?.call_control_id
    const stats: CallAudioStats | undefined = body?.stats

    if (typeof callControlId !== 'string' || !callControlId || !stats) {
      return NextResponse.json({ success: false, error: 'call_control_id and stats required' }, { status: 400 })
    }

    const problem = describeAudioProblem(stats)

    // status carries the headline so the row is readable without opening
    // detail: 'ok' or the first problem found. Everything else is in detail.
    void logCallEvent({
      event_type: 'audio_stats',
      call_control_id: callControlId,
      status: problem ? 'degraded' : 'ok',
      source: 'dialer',
      detail: { ...stats, problem, user_id: userId },
    })

    return NextResponse.json({ success: true, degraded: !!problem })
  } catch (err) {
    return apiError(err, { route: 'calls/audio-stats' })
  }
}
