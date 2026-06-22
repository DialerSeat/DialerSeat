import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { placeOutboundCall } from '@/lib/placeOutboundCall'

// =============================================================================
// OUTBOUND CALL — user-initiated dial
// =============================================================================
// This route handles dials initiated by the dialer page UI (user clicks
// "INITIATE DIAL SEQUENCE" or types in the manual keypad).
//
// As of Deploy 3 Part B, this is a THIN WRAPPER around lib/placeOutboundCall.
// All the actual logic (TCPA, AMD config, number pool, two-leg dial) lives
// in the library so the predictive controller can share it.
//
// BEHAVIOR PRESERVED:
//   - Subscription gate (requireActive) — same
//   - Clerk auth check — same
//   - Body shape: { to, leadId, campaignId, teamId } — same
//   - Response shape: { success, callSid, agentCallSid, roomName, ... } — same
//   - HTTP status codes: 200 success, 403 no-sub, 451 TCPA, 500 error — same
//   - AMD config (1800ms threshold etc) — same, lives in placeOutboundCall
//   - Manual dial bypass (no leadId+campaignId skips TCPA) — same
//
// THE ONE FUNCTIONAL DIFFERENCE:
//   Calls source='user_dial' which places BOTH the lead leg AND the agent
//   leg into the conference (same as before — the controller is what uses
//   source='controller_fanout' which is single-leg).
//
// PHONE NUMBER NORMALIZATION (added):
//   normalizeToE164() handles any real-world lead sheet format before the
//   number ever reaches SignalWire/Twilio. See inline docs below.
// =============================================================================

// -----------------------------------------------------------------------------
// normalizeToE164
// -----------------------------------------------------------------------------
// Converts any realistic phone number string into strict E.164 format
// (e.g. "+15044580577") so SignalWire/Twilio never sees a malformed number.
//
// Handles all of these input shapes (and more):
//
//   Raw digits, 11-digit with leading 1:  15044580577      → +15044580577
//   Raw digits, 10-digit US:              5044580577       → +15044580577
//   Raw digits, 10-digit, no country:     3128978232       → +13128978232
//   Already E.164:                        +15044580577     → +15044580577
//   Formatted US:                         (504) 458-0577   → +15044580577
//   Dashes / dots:                        504-458-0577     → +15044580577
//                                         504.458.0577     → +15044580577
//   With country code prefix:             1-504-458-0577   → +15044580577
//   International (non-US):              +44 20 7946 0958  → +442079460958
//   Spreadsheet scientific notation:      5.04458e+09      → best-effort parse
//   Null / empty / garbage:               ""  "N/A"  "—"   → null (skip)
//
// Returns null for anything that cannot be salvaged — callers should skip
// those rows rather than forwarding a bad number to the carrier.
// -----------------------------------------------------------------------------
function normalizeToE164(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null

  // Coerce to string — handles numbers stored as JS number/float in parsed JSON
  let str = String(raw).trim()

  // Reject obvious non-numbers immediately
  if (!str || str === 'null' || str === 'undefined') return null

  // Strip common "not a number" sentinel strings from lead sheets
  const JUNK = /^(n\/?a|none|—|–|-|na|null|undefined|bad\s*#|do\s*not\s*call|dnc)$/i
  if (JUNK.test(str)) return null

  // Handle scientific notation that Excel/Sheets sometimes serializes (e.g. 5.04458e9)
  if (/e[+-]?\d+$/i.test(str)) {
    const parsed = Number(str)
    if (!isNaN(parsed)) str = Math.round(parsed).toString()
  }

  // Strip everything that isn't a digit or a leading +
  // Keep the leading + so we preserve explicit country code intent
  const hasLeadingPlus = str.startsWith('+')
  const digits = str.replace(/\D/g, '')

  // Need at least 7 digits to be a plausible phone number
  if (digits.length < 7) return null

  // More than 15 digits is invalid per ITU E.164 spec
  if (digits.length > 15) return null

  // --- US / Canada (NANP) normalization ---
  if (digits.length === 10) {
    // Pure 10-digit US number, e.g. "5044580577" or "(504) 458-0577"
    return `+1${digits}`
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    // 11-digit with leading 1, e.g. "15044580577" — the most common lead-sheet format
    return `+${digits}`
  }

  // --- Already has a + prefix (explicit international or E.164) ---
  if (hasLeadingPlus) {
    // Trust the explicit country code; just re-prefix the cleaned digits
    return `+${digits}`
  }

  // --- Ambiguous length (7-9 digits) — local number, no country code ---
  // Too risky to assume country; return null and let the caller skip it.
  if (digits.length < 10) return null

  // --- Everything else: 12-15 digits without a leading + ---
  // Treat as international with country code already embedded.
  return `+${digits}`
}

// -----------------------------------------------------------------------------
// POST /api/calls/outbound
// -----------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    // Subscription gate — returns 403 if no active sub
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { to, leadId, campaignId, teamId } = body

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Missing destination' },
        { status: 400 }
      )
    }

    // --- Normalize the destination number before anything else touches it ---
    // This is the single choke-point: every dial path goes through here so
    // no raw lead-sheet string ever reaches SignalWire/Twilio unformatted.
    const normalizedTo = normalizeToE164(to)

    if (!normalizedTo) {
      // Log the bad value so you can audit your sheet later
      console.warn(`[outbound] Rejected un-normalizable number: "${to}" (leadId=${leadId ?? 'none'})`)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid phone number',
          detail: `"${to}" could not be converted to a valid E.164 number. ` +
                  `Check the lead sheet for formatting issues (missing country code, ` +
                  `too few digits, placeholder text, etc.).`,
          rawInput: to,
        },
        { status: 422 } // 422 Unprocessable Entity — bad data, not a server fault
      )
    }

    // Decide the dial source EXPLICITLY here, where we know the intent:
    //   - manual keypad dial = a number typed in directly, no lead/campaign
    //     context → source 'manual' (TCPA window bypass, the user chose this number)
    //   - campaign dial (lead and/or campaign present) → source 'user_dial'
    //     (full TCPA enforcement — these are regulated outbound calls)
    // This replaces the old behavior where the library INFERRED manual-vs-
    // campaign from absent IDs. Being explicit prevents an accidental bypass.
    const isManualKeypadDial = !leadId && !campaignId
    const dialSource = isManualKeypadDial ? 'manual' : 'user_dial'

    // Delegate everything else to the shared library.
    // source='user_dial'/'manual' both trigger the two-leg behavior:
    // place lead call AND agent call, both join conference room.
    const result = await placeOutboundCall({
      to: normalizedTo,   // ← always E.164 from here on
      userId,
      leadId,
      campaignId,
      teamId,
      source: dialSource,
    })

    // Library returns either a success or a failure with httpStatus hint.
    if (!result.success) {
      const status = result.httpStatus || 500
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          detail: result.detail,
          leadState: result.leadState,
          leadLocalTime: result.leadLocalTime,
          retryAfter: result.retryAfter,
        },
        { status }
      )
    }

    // Success — return the same shape the dialer page already expects
    return NextResponse.json({
      success: true,
      callSid: result.callSid,
      agentCallSid: result.agentCallSid,
      roomName: result.roomName,
      fromNumber: result.fromNumber,
      status: result.status,
      amdEnabled: result.amdEnabled,
      dialerMode: result.dialerMode,
      ringTimeout: result.ringTimeout,
    })
  } catch (error: any) {
    console.error('Call error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}