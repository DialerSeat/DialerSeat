import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAgentRegistration } from '@/lib/agentSipCredentials'

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
//   TELNYX_SIP_DOMAIN   (OPTIONAL — defaults to sip.telnyx.com; set only to
//                        select a non-US Telnyx region)
// Username and domain are resolved through lib/telnyxConfig.ts, the same
// resolver lib/placeOutboundCall.ts uses to build the agent leg's `to` SIP
// URI — so the identity the browser registers as and the URI the server
// dials are guaranteed to be the same string.
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // ── THIS AGENT'S OWN SIP IDENTITY ────────────────────────────────────────
  // Provisions a per-agent Telnyx credential on first use (see
  // lib/agentSipCredentials.ts for why a single shared SIP user is unsafe
  // the moment two people dial at once). The password is fetched live from
  // Telnyx and never stored by us.
  //
  // The username and domain returned here come from the same resolver the
  // server-side dial paths use, which matters more than it looks: the
  // browser registers as sip:<username>@<domain>, and the server dials
  // sip:<username>@<domain> to reach it. If those two are built separately,
  // the browser registers fine, the dial "succeeds", and nobody can explain
  // why the agent's phone never rings.
  const { registration, error } = await getAgentRegistration(userId)

  if (!registration) {
    console.error(`[calls/sip-credentials] no registration for ${userId}: ${error}`)
    return NextResponse.json(
      {
        success: false,
        error: 'SIP credentials not configured on server',
        detail: `${error || 'unknown'}, see GET /api/calls/diagnostics for the full checklist.`,
      },
      { status: 500 }
    )
  }

  const { sipUsername, sipPassword, sipDomain, sipWssUrl, isSharedFallback } = registration

  if (isSharedFallback) {
    console.warn(
      `[calls/sip-credentials] ${userId} is registering with the SHARED SIP user. ` +
      `If a second agent dials at the same time, Telnyx will ring both browsers for ` +
      `the same call. See lib/agentSipCredentials.ts.`
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
    // sipWssUrl is sent explicitly rather than letting the client rebuild
    // `wss://${sipDomain}:7443` itself — the port is a Telnyx transport
    // detail, and the client had it hardcoded in a comment-laden constant
    // that would silently go stale if Telnyx ever changed it or a
    // non-US region needed something different.
    { success: true, sipUsername, sipPassword, sipDomain, sipWssUrl, isSharedFallback, iceServers },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
  )
}
