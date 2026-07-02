






import { NextResponse } from 'next/server'
import { requireAuth, buildAuthUrl, GmailAuthError } from '@/lib/gmail'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const clerkId = await requireAuth()
    
    
    const state = `${clerkId}.${randomBytes(16).toString('hex')}`
    const url = buildAuthUrl(state)

    const res = NextResponse.redirect(url, 302)
    
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