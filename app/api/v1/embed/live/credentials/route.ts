import { NextResponse, type NextRequest } from 'next/server'
import { authFrame, embedError, frameConfig } from '@/lib/developers/embed'
import { seatRegistration } from '@/lib/developers/live/engine'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The seat's browser-phone login, for a live frame that is allowed to dial.
 * Handed only to the frame signed in as that seat, and never cached.
 */
export async function POST(req: NextRequest) {
  const a = await authFrame(req); if ('res' in a) return a.res
  const config = await frameConfig(a.ctx, null)
  if (config.can_dial !== 'live') return embedError(403, 'cannot_dial', 'This seat cannot place live calls.')
  const r = await seatRegistration(a.ctx.seat)
  if (!r.ok) return embedError(503, 'line_unavailable', r.error)
  return NextResponse.json(r.registration, { headers: { 'Cache-Control': 'no-store' } })
}
