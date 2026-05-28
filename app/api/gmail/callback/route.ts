// app/api/gmail/callback/route.ts
// =============================================================================
// Google redirects here after the user accepts/declines consent.
// Query params:
//   ?code=...&state=...        on success
//   ?error=access_denied&...   on user decline
// We exchange the code for tokens, store them, then bounce back to
// /dashboard/admin/desktop?gmail=connected (or =error/=denied).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, exchangeCodeForTokens, upsertTokens, GmailAuthError } from '@/lib/gmail'

export const runtime = 'nodejs'

function bounceBack(status: 'connected' | 'error' | 'denied', detail?: string) {
  const url = new URL('/dashboard/admin/desktop', process.env.NEXT_PUBLIC_APP_URL!)
  url.searchParams.set('gmail', status)
  if (detail) url.searchParams.set('detail', detail.slice(0, 200))
  return NextResponse.redirect(url.toString(), 302)
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // User clicked "Cancel" on Google consent page.
  if (error) {
    return bounceBack('denied', error)
  }

  if (!code || !state) {
    return bounceBack('error', 'missing_code_or_state')
  }

  // Verify state matches what we set in the auth route.
  const cookieState = req.cookies.get('gmail_oauth_state')?.value
  if (!cookieState || cookieState !== state) {
    return bounceBack('error', 'state_mismatch')
  }

  try {
    const clerkId = await requireAuth()

    // Defensive check: state prefix should also match the user (in case
    // someone hijacked an auth URL from another logged-in user).
    const expectedPrefix = `${clerkId}.`
    if (!state.startsWith(expectedPrefix)) {
      return bounceBack('error', 'state_user_mismatch')
    }

    const tokens = await exchangeCodeForTokens(code)
    await upsertTokens({
      clerkId,
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSec: tokens.expiresInSec,
      scopes: tokens.scopes,
    })

    const res = bounceBack('connected')
    // Clean up the state cookie.
    res.cookies.delete('gmail_oauth_state')
    return res
  } catch (err) {
    if (err instanceof GmailAuthError && err.reason === 'not_signed_in') {
      return bounceBack('error', 'not_signed_in')
    }
    console.error('[gmail/callback] error', err)
    const detail = err instanceof Error ? err.message : 'unknown'
    return bounceBack('error', detail)
  }
}