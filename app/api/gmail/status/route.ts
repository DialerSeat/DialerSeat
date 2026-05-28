// app/api/gmail/status/route.ts
// =============================================================================
// Lightweight check the Gmail app uses on mount: am I connected?
// Returns { connected: false } for either "not signed in" or "no tokens"
// (the UI shows a Connect button in both cases — the redirect flow handles
// the signed-in state implicitly).
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getStoredTokens } from '@/lib/gmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ connected: false })
    }
    const row = await getStoredTokens(userId)
    if (!row) {
      return NextResponse.json({ connected: false })
    }
    return NextResponse.json({
      connected: true,
      email: row.email,
      scopes: row.scopes,
      connected_at: row.created_at,
    })
  } catch (err) {
    console.error('[gmail/status] error', err)
    return NextResponse.json({ connected: false, error: 'internal' }, { status: 500 })
  }
}