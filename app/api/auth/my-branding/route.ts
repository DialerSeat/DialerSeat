import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getActiveTenantForUser } from '@/lib/tenant'

// =============================================================================
// /api/auth/my-branding — the signed-in user's OWN active-tenant branding
// =============================================================================
// Used by the sign-in page to fix a post-login splash bug: the sign-in page is
// rendered server-side with HOSTNAME branding (so a signed-out visitor to
// demo.dialerseat.com correctly sees demo's login). After a user authenticates
// CLIENT-SIDE, the page lingers for a beat before the redirect resolves — and
// during that window it still shows the stale hostname (demo) branding, even
// for an account that has nothing to do with demo (e.g. a default DialerSeat
// account, or a different tenant's owner).
//
// This endpoint returns the branding that SHOULD apply to the account itself —
// getActiveTenantForUser(userId), the exact same authority the root layout uses
// for signed-in users (null = standard DialerSeat). The sign-in page calls this
// once isSignedIn flips true and re-renders the co-brand mark with the result,
// so the splash matches the ACCOUNT, not the URL:
//   - joshua (no tenant)      → null → default DialerSeat logo
//   - a demo owner            → demo branding → demo logo (even on another sub)
//
// Returns { branding: TenantBranding | null }. force-dynamic + no-store: this is
// per-user and must never be cached.
// =============================================================================

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    // Not signed in → no account branding to report. The caller keeps showing
    // whatever the server gave it (hostname branding), which is correct for a
    // signed-out visitor.
    return NextResponse.json({ branding: null }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  // Authoritative per-account branding. null = standard DialerSeat.
  const branding = await getActiveTenantForUser(userId)
  return NextResponse.json({ branding: branding ?? null }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}