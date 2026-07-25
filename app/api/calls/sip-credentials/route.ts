import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// =============================================================================
// SIP CREDENTIALS — authenticated delivery of the browser SIP registration
// =============================================================================
// SECURITY (carried over unchanged from the SignalWire version — this fix
// is provider-agnostic and still applies exactly as much under Telnyx):
//   The dialer used to read a NEXT_PUBLIC_*_SIP_PASSWORD directly from the
//   client bundle. Anything NEXT_PUBLIC_* is inlined into the JavaScript
//   served to EVERY visitor, so the SIP trunk password could be harvested
//   from the public bundle with no login at all — and then used to place
//   calls on our account.
//
//   This route serves the credentials, but ONLY to a signed-in user, over
//   an authenticated request. The values live in SERVER-side env vars (no
//   NEXT_PUBLIC_ prefix), so they are never baked into the bundle.
//
//   This is defense-in-depth, not a perfect fix: an authenticated user can
//   still see the response in their network tab. The proper long-term fix
//   is the Telnyx WebRTC Voice SDK, which can authenticate via short-lived
//   token instead of a static password — see /api/calls/token, which is
//   the beginning of that path. Until fully migrated to it, this route
//   closes the unauthenticated-harvest hole, which was the sharp edge.
//
// ENV REQUIRED (server-side, NO NEXT_PUBLIC_ prefix):
//   TELNYX_SIP_USERNAME
//   TELNYX_SIP_PASSWORD
//   TELNYX_SIP_DOMAIN
// (Same values used by lib/placeOutboundCall.ts for the agent leg's `to`
// SIP URI on outbound calls.)
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const sipUsername = process.env.TELNYX_SIP_USERNAME
  const sipPassword = process.env.TELNYX_SIP_PASSWORD
  const sipDomain = process.env.TELNYX_SIP_DOMAIN

  if (!sipUsername || !sipPassword || !sipDomain) {
    return NextResponse.json(
      { success: false, error: 'SIP credentials not configured on server' },
      { status: 500 }
    )
  }

  // ── ICE SERVERS (the audio-path fix) ──────────────────────────────────────
  // Without STUN/TURN the browser only offers host candidates (its private LAN
  // IP). Across NAT that gives Telnyx no reachable media path, so after the
  // lead picks up there is multi-second dead air (or silence the whole call)
  // while ICE flails. STUN lets the browser discover its public IP for a direct
  // path (fixes the common case, ~70% of connections per Telnyx's own network
  // docs). TURN relays media when a direct path is impossible (symmetric NAT /
  // corporate firewalls, the remaining ~30%) — required for a true
  // "pickup = hear, no exceptions" guarantee.
  //
  // stun.telnyx.com:3478 is Telnyx's own public STUN endpoint (confirmed via
  // Telnyx's network-configuration docs) — used unconditionally, no
  // credentials required for STUN. TURN requires credentials Telnyx issues on
  // request (contact Telnyx support), so it's added ONLY if its env vars are
  // present, same conditional pattern the SignalWire version used, so this
  // endpoint stays valid before TURN is provisioned.
  //   TELNYX_TURN_URLS      (comma-separated, e.g. "turn:turn.telnyx.com:3478?transport=udp")
  //   TELNYX_TURN_USERNAME
  //   TELNYX_TURN_CREDENTIAL
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: ['stun:stun.telnyx.com:3478', 'stun:stun.l.google.com:19302'] },
  ]

  const turnUrls = process.env.TELNYX_TURN_URLS
  const turnUsername = process.env.TELNYX_TURN_USERNAME
  const turnCredential = process.env.TELNYX_TURN_CREDENTIAL
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
