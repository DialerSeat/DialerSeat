import { NextResponse } from 'next/server'

// sendBeacon target fired on tab close. Formerly closed a dialer_sessions row;
// that table is no longer written (presence lives in agent_sessions). Kept as a
// no-op so the client's beacon has a valid endpoint and never errors.
export async function POST() {
  return NextResponse.json({ ok: true })
}
