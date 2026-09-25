import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logCallEvent } from '@/lib/callEvents'

// =============================================================================
// WHO ENDED THE AGENT'S LEG
// =============================================================================
// Posted by the dialer (sendBeacon) each time the agent's browser ends its leg
// or sees it ended, naming the code path: 'voicemail, next lead', 'hang up
// (skip)', 'went offline', 'ended by the far end' and so on. Recorded against
// the lead's call so an AGENT_LEG_FAILED call can be traced to what dropped it.
//
// 0.8% of dials on 15-18 Sept were a browser dropping a leg it had answered
// with no request to, and nothing on the server could say which path did it.
// This is the evidence for that fix. A record only: it changes no call.
// =============================================================================

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  const text = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null

  void logCallEvent({
    event_type: 'agent_leg_released',
    call_control_id: text(body.leadSid, 200),
    user_id: userId,
    source: 'dialer',
    status: text(body.why, 80) ?? 'unlabelled',
    detail: {
      by_us: body.byUs === true,
      immediate: body.immediate === true,
      held_ms: num(body.heldMs),
      sip_call_id: text(body.sipCallId, 200),
    },
  })

  return NextResponse.json({ success: true })
}
