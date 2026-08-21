import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// THE JOIN CODE NEEDS TO SURVIVE CLERK, AND ?redirect_url DOES NOT
//
// Swapping forceRedirectUrl for fallbackRedirectUrl got the code as far as
// the Clerk URL, which was progress but not enough: sign-in can happen on
// Clerk's HOSTED account portal, which has its own configured after-sign-in
// destination, and a user with no billing is then routed to /welcome and on to
// /billing by our own post-signin logic. Any one of those hops can drop a
// query parameter, and the one that matters is dropped silently.
//
// A cookie survives all of it. It is set before the user ever leaves for
// Clerk, and it is still there when they land back on our side no matter which
// route they took to get there.
//
// SHORT-LIVED ON PURPOSE. Ten minutes covers signing up and coming straight
// back. It deliberately does not cover "signed up, wandered off, came back
// tomorrow" — a stale code silently re-applying itself weeks later, joining
// someone to a team they had forgotten about, is worse than making them click
// the link again.
//
// httpOnly because nothing client-side needs to read it: /welcome reads it on
// the server and puts it in the URL it hands to billing.
// ─────────────────────────────────────────────────────────────────────────

export const JOIN_CODE_COOKIE = 'ds_join_code'
const TEN_MINUTES = 60 * 10

// ── IT HAS TO SURVIVE A WHITELABEL SUBDOMAIN ─────────────────────────────
// A whitelabel agent's invite arrives on their brand's host
// (brand.dialerseat.com/join/CODE), but the hops afterwards do not all stay
// there: Clerk lives on its own host, and post-signin routes people between
// the apex and a tenant subdomain depending on which brand they belong to.
// A cookie scoped to the host that set it is dropped at the first of those
// boundaries, which would resurrect exactly the bug this cookie exists to
// fix — and only for whitelabel agents, which is the worst kind of bug to
// have, because it works perfectly everywhere it gets tested.
//
// Scoping it to the root domain makes it readable from the apex and from
// every tenant subdomain. Left undefined in development, where the host is
// localhost and a domain attribute would stop the cookie being set at all.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const COOKIE_DOMAIN =
  process.env.NODE_ENV === 'production' ? `.${ROOT_DOMAIN}` : undefined

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('code') || ''
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32)

  // No usable code: send them to sign-up empty-handed rather than setting a
  // cookie containing whatever arrived in the query string.
  const dest = code
    ? `/sign-up?redirect_url=${encodeURIComponent(`/join/${code}`)}`
    : '/sign-up'

  const res = NextResponse.redirect(new URL(dest, req.url), 302)

  if (code) {
    res.cookies.set(JOIN_CODE_COOKIE, code, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: TEN_MINUTES,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    })
  }

  return res
}
