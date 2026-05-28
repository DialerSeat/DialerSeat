// app/api/gmail/auth/route.ts
// =============================================================================
// Kicks off the Google OAuth flow.
// User clicks "Connect Gmail" in the app → GET /api/gmail/auth → redirected
// to Google's consent screen → Google redirects back to /api/gmail/callback.
// =============================================================================

import { NextResponse } from 'next/server'
import { requireAuth, buildAuthUrl, GmailAuthError } from '@/lib/gmail'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const clerkId = await requireAuth()
    // State binds the OAuth response to this user — Google echoes it back
    // and the callback verifies it matches the cookie we set here.
    const state = `${clerkId}.${randomBytes(16).toString('hex')}`
    const url = buildAuthUrl(state)

    const res = NextResponse.redirect(url, 302)
    // Short-lived state cookie (5 min) — httpOnly so JS can't read it.
    res.cookies.set('gmail_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    })
    return res
  } catch (err) {
    if (err instanceof GmailAuthError && err.reason === 'not_signed_in') {
      return NextResponse.json({ error: 'not_signed_in' }, { status: 401 })
    }
    console.error('[gmail/auth] error', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}