import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

// =============================================================================
// TOKEN — short-lived JWT for SIP/WebRTC registration (Telnyx)
// =============================================================================
// SECURITY FIX: the SignalWire version of this route had NO auth check at
// all — anyone who found the URL could POST to it and mint a live JWT for
// our SIP resource, no login required. That's exactly the kind of
// unauthenticated-mint hole flagged in the original migration brief. Fixed
// here the same way sip-credentials/route.ts was fixed: require a signed-in
// Clerk session before issuing anything.
//
// MECHANISM CHANGE FROM SIGNALWIRE:
//   SignalWire: POST https://{space}/api/relay/rest/jwt, Basic auth
//   (project:token), body { expires_in, resource: sipUsername }, returns
//   { jwt_token }.
//
//   Telnyx: POST https://api.telnyx.com/v2/telephony_credentials/{id}/token,
//   Bearer auth (TELNYX_API_KEY), empty body, returns the raw JWT string as
//   the response body (not wrapped in JSON — see Telnyx's own JWT auth
//   docs). Valid 24h by default, tied to a pre-created Telephony Credential
//   resource (TELNYX_TELEPHONY_CREDENTIAL_ID) rather than an arbitrary
//   "resource" string — the credential itself, not this route, is what
//   scopes what the resulting JWT can do.
//
// This is the beginning of the proper long-term fix referenced in
// sip-credentials/route.ts's comments: once the browser softphone
// authenticates via this token instead of the static SIP username/password,
// the password never needs to reach the browser in any form. That SDK
// migration (sip.js currently registers with username+password) is tracked
// separately — this route just makes sure the token itself is safe to
// issue today.
// =============================================================================

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.TELNYX_API_KEY
    const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID

    if (!apiKey || !credentialId) {
      return NextResponse.json(
        { success: false, error: 'Telnyx telephony credential not configured on server' },
        { status: 500 }
      )
    }

    const response = await fetch(
      `https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error(`[calls/token] Telnyx token request failed (${response.status}): ${text}`)
      return NextResponse.json({ success: false, error: 'Token request failed' }, { status: 500 })
    }

    // Telnyx returns the JWT as a raw string body, not wrapped in JSON —
    // confirmed against Telnyx's own JWT auth docs (unlike SignalWire's
    // { jwt_token: "..." } shape). Guard for either shape defensively in
    // case that ever changes, rather than assuming one blindly.
    const contentType = response.headers.get('content-type') || ''
    let token: string | null = null
    if (contentType.includes('application/json')) {
      const data = await response.json()
      token = data?.token || data?.jwt_token || (typeof data === 'string' ? data : null)
    } else {
      token = (await response.text()).trim()
    }

    if (!token) {
      return NextResponse.json({ success: false, error: 'No token returned' }, { status: 500 })
    }

    return NextResponse.json({ success: true, token })
  } catch (error: any) {
    return apiError(error, { route: 'calls/token' })
  }
}
