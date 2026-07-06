import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// =============================================================================
// SIP CREDENTIALS — authenticated delivery of the browser SIP registration
// =============================================================================
// SECURITY (Path A fix for Step 2):
//   The dialer used to read NEXT_PUBLIC_SIGNALWIRE_SIP_PASSWORD directly from
//   the client bundle. Anything NEXT_PUBLIC_* is inlined into the JavaScript
//   served to EVERY visitor, so the SIP trunk password could be harvested from
//   the public bundle with no login at all — and then used to place calls on
//   our account.
//
//   This route serves the SAME credentials, but ONLY to a signed-in user, over
//   an authenticated request. The values now live in SERVER-side env vars
//   (no NEXT_PUBLIC_ prefix), so they are never baked into the bundle.
//
//   This is defense-in-depth, not a perfect fix: an authenticated user can
//   still see the response in their network tab. The proper long-term fix
//   (Path B) is to switch the browser to the SignalWire JS SDK consuming the
//   short-lived JWT from /api/calls/token, so the password never reaches the
//   browser in any form. Until then, this closes the unauthenticated-harvest
//   hole, which is the sharp edge.
//
// ENV REQUIRED (server-side, NO NEXT_PUBLIC_ prefix):
//   SIGNALWIRE_SIP_USERNAME
//   SIGNALWIRE_SIP_PASSWORD
//   SIGNALWIRE_SIP_DOMAIN
// (You already have these — they're used by lib/placeOutboundCall.ts etc.)
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
  const sipPassword = process.env.SIGNALWIRE_SIP_PASSWORD
  const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN

  if (!sipUsername || !sipPassword || !sipDomain) {
    return NextResponse.json(
      { success: false, error: 'SIP credentials not configured on server' },
      { status: 500 }
    )
  }

  // ── ICE SERVERS (the audio-path fix) ──────────────────────────────────────
  // Without STUN/TURN the browser only offers host candidates (its private LAN
  // IP). Across NAT that gives SignalWire no reachable media path, so after the
  // lead picks up there is multi-second dead air (or silence the whole call)
  // while ICE flails. STUN lets the browser discover its public IP for a direct
  // path (fixes the common case). TURN relays media when a direct path is
  // impossible (symmetric NAT / corporate firewalls) — required for a true
  // "pickup = hear, no exceptions" guarantee.
  //
  // TURN is added ONLY if its env vars are present, so this endpoint stays valid
  // before TURN is provisioned. To enable TURN later, set:
  //   SIGNALWIRE_TURN_URLS      (comma-separated, e.g. "turn:turn.signalwire.com:3478?transport=udp")
  //   SIGNALWIRE_TURN_USERNAME
  //   SIGNALWIRE_TURN_CREDENTIAL
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: ['stun:stun.signalwire.com:3478', 'stun:stun.l.google.com:19302'] },
  ]

  const turnUrls = process.env.SIGNALWIRE_TURN_URLS
  const turnUsername = process.env.SIGNALWIRE_TURN_USERNAME
  const turnCredential = process.env.SIGNALWIRE_TURN_CREDENTIAL
  if (turnUrls && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls.split(',').map(u => u.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    })
  }

  // no-store so the credentials are never cached by the browser or any proxy.
  return NextResponse.json(
    { success: true, sipUsername, sipPassword, sipDomain, iceServers },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
  )
}