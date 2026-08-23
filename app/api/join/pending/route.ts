import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { JOIN_CODE_COOKIE } from '@/app/api/join/start/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// THE INVITE THEY ARRIVED WITH, ASKED FOR AT THE LAST STOP
//
// The join code survives Clerk in a cookie, and two places read it: the
// post-signin router, and /welcome, which appends it to the billing URL. Both
// are HOPS. If Clerk takes a route that misses them — and it can, because a
// force redirect configured in the Clerk dashboard overrides both
// ?redirect_url and the fallbackRedirectUrl prop this app sets — the cookie is
// still sitting there and nobody ever looks at it. The agent lands on billing
// with an empty promo box and no way to know an invite was ever attached.
//
// That is exactly what happened to a real signup: cookie set, code live, no
// membership created, straight to /billing.
//
// So the DESTINATION asks, rather than relying on every hop to carry it. The
// billing page is where the code finally matters, and a page that fetches what
// it needs cannot be broken by the route somebody took to reach it.
//
// The cookie is httpOnly, which is why this endpoint exists at all — the
// client cannot read it directly, and should not be able to.
//
// Reading does not clear it. /api/teams/redeem clears the cookie when the code
// is actually used, because until then the person may still reload, navigate,
// or come back through a different door.
// ─────────────────────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, code: null }, { status: 401 })
  }

  try {
    const jar = await cookies()
    const raw = jar.get(JOIN_CODE_COOKIE)?.value || ''
    // Same shape constraint as everywhere else this value is handled. It is
    // only ever a code, never a path, so a tampered cookie has nowhere to go.
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32)

    return NextResponse.json({ success: true, code: code || null })
  } catch (err) {
    // Never fatal. Worst case is the box being empty, which is the behaviour
    // this endpoint exists to improve on rather than depend upon.
    console.error('[join/pending] cookie read failed', err)
    return NextResponse.json({ success: true, code: null })
  }
}
