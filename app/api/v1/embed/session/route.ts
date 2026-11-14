import { NextResponse, type NextRequest } from 'next/server'
import { embedError, exchangeSession, frameConfig } from '@/lib/developers/embed'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function selfOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')
  return `${proto}://${host}`.toLowerCase()
}

/**
 * Called by the miniplayer frame, once, with the session token it was opened
 * with. Returns the frame token and everything the frame needs to draw itself.
 */
export async function POST(req: NextRequest) {
  let b: { token?: unknown; parent_origin?: unknown; campaign?: unknown } = {}
  try { b = await req.json() } catch { return embedError(400, 'invalid_json', 'Bad request.') }
  const parent = typeof b.parent_origin === 'string' && b.parent_origin ? b.parent_origin.toLowerCase() : null
  const r = await exchangeSession(String(b.token || ''), parent, selfOrigin(req))
  if (!r.ok) return embedError(r.status, r.code, r.message)
  const campaign = typeof b.campaign === 'string' && b.campaign.trim() ? b.campaign.trim().slice(0, 120) : r.campaign
  const config = await frameConfig(r.ctx, campaign)
  return NextResponse.json({ frame_token: r.frameToken, config, leads: r.leads, campaign }, { headers: { 'Cache-Control': 'no-store' } })
}
