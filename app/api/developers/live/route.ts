import { NextResponse } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Ask for live dialing. Rates are negotiated, so activation goes through
 * sales: this records the request on the platform (the admin view lists
 * requests) and the console opens an email to sales with the details filled
 * in. Only DialerSeat sets live_status to 'active'.
 */
export async function POST() {
  const r = await requirePlatform(); if ('res' in r) return r.res
  const { platform } = r.ctx
  if (platform.live_status === 'active') return jsonError(409, 'already_active', 'Live dialing is already active.')
  const updated = await devStore().updatePlatform(platform.id, {
    live_status: platform.live_status === 'not_activated' ? 'requested' : platform.live_status,
    live_requested_at: platform.live_requested_at || new Date().toISOString(),
  })
  return NextResponse.json({ live_status: updated.live_status, live_requested_at: updated.live_requested_at })
}
