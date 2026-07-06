import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Session presence is tracked entirely by agent_sessions (the heartbeat route),
// which is what predictive pacing reads. This route formerly maintained a
// parallel dialer_sessions history table that NOTHING consumed — every
// start/heartbeat/end was a write nobody read. Those writes are removed.
//
// The endpoints are kept as no-ops returning the same shape the dialer client
// expects, so the client contract is unchanged (it passes the returned id back
// to end the "session" — now a harmless round-trip). Safe to delete the client
// calls later; until then this stops the dead writes with zero client changes.

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  // Synthetic id so the client's start→end loop still closes cleanly.
  return NextResponse.json({ success: true, sessionId: `noop-${userId}`, action: 'noop' })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ success: true })
}
