// app/api/gmail/disconnect/route.ts
// =============================================================================
// User clicks "Disconnect Gmail" in the app. We revoke the refresh_token
// with Google (best-effort — even if Google's call fails we still delete
// the row locally) and remove our DB row.
// =============================================================================

import { NextResponse } from 'next/server'
import { requireAuth, getStoredTokens, deleteStoredTokens, GmailAuthError } from '@/lib/gmail'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const clerkId = await requireAuth()
    const row = await getStoredTokens(clerkId)
    if (!row) {
      return NextResponse.json({ ok: true, already_disconnected: true })
    }

    // Best-effort revoke. Google's revoke endpoint accepts either access
    // or refresh token; the refresh is more durable.
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, {
        method: 'POST',
      })
    } catch (e) {
      // Swallow — we still want to delete our local row.
      console.warn('[gmail/disconnect] revoke call failed (continuing)', e)
    }

    await deleteStoredTokens(clerkId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof GmailAuthError && err.reason === 'not_signed_in') {
      return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
    }
    console.error('[gmail/disconnect] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}