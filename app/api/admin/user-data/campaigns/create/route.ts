import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/campaigns/create')

// Kept in step with app/api/campaigns/create. The call path reads dialer_mode
// directly, so an unrecognised value does not degrade — it breaks dialing.
const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
type DialerMode = (typeof VALID_MODES)[number]

// ─────────────────────────────────────────────────────────────────────────
// CREATING A CAMPAIGN ON SOMEBODY ELSE'S ACCOUNT
//
// The third of the Data Explorer's write endpoints, alongside dialer-mode and
// recording. Those two fix a campaign that exists; this one exists for the
// case where the customer has none, which is the worst moment to be told to
// go and build one themselves — a new subscriber with an empty dialer is the
// likeliest person on the platform to give up.
//
// ── IT MIRRORS THE USER-FACING ROUTE ON PURPOSE ────────────────────────
// Every rule in app/api/campaigns/create is repeated here rather than relaxed,
// because a campaign made by support must behave identically to one the
// customer made. Two creation paths that disagree is how "it works for me"
// starts.
//
// That includes the naming rules, and they are not bureaucracy: the platform
// already carries three lists called "Untitled", one of them holding 4,363
// leads, from back when the server invented names. Every screen that groups by
// campaign got worse because of it. Support is not exempt.
//
// ── ONE RULE MIRRORED UNDER PROTEST, AND SAID OUT LOUD ─────────────────
// The user-facing route silently rewrites a request for 'predictive' into
// 'progressive'. Its comment explains why: measured 14 Sept, 138 fan-out calls,
// 35 answered, ZERO bridged — prospects answering to silence.
//
// That is no longer what the data says. The same 138 calls on the same day now
// show 35 of 35 answered calls bridged, and the two days either side show 64
// of 65 and 37 of 37. The zero was a measurement artifact, not a broken
// bridge.
//
// It is mirrored anyway, because two create paths that disagree about what
// 'predictive' means is a worse bug than one stale downgrade, and removing it
// belongs in a change that removes it from BOTH. What is not mirrored is the
// silence: this returns `downgradedFrom` so the caller can say what happened
// instead of the operator discovering later that their predictive campaign is
// progressive.
//
// ── WHAT GATES THIS ────────────────────────────────────────────────────
// It takes an arbitrary user_id and writes to their account. requireAdmin() is
// the only thing between it and every account on the platform, exactly as with
// its two siblings. The owner is looked up first so a typo cannot create an
// orphan campaign belonging to a clerk id that does not exist.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const userId = String(body?.userId ?? '').trim()
    const name = String(body?.name ?? '').trim()
    const requestedMode = String(body?.dialerMode ?? '').trim()
    const recordingEnabled = typeof body?.recordingEnabled === 'boolean'
      ? body.recordingEnabled
      : true // Same default as the user-facing route: a recording not made cannot be made later.

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Naming rules, verbatim from the user-facing route.
    if (!name) {
      return NextResponse.json(
        { error: 'Name the campaign before saving it.' },
        { status: 400 }
      )
    }
    if (/^untitled(\s*\(\d+\))?$/i.test(name)) {
      return NextResponse.json(
        { error: 'Give the campaign a real name, not "Untitled".' },
        { status: 400 }
      )
    }
    if (name.length > 120) {
      return NextResponse.json(
        { error: 'Campaign name is too long (120 characters max).' },
        { status: 400 }
      )
    }

    // The owner must exist. Without this a mistyped id creates a campaign
    // nobody owns, which is invisible everywhere except a raw table.
    const { data: owner } = await supabase
      .from('users')
      .select('clerk_id, email')
      .eq('clerk_id', userId)
      .maybeSingle()

    if (!owner) {
      return NextResponse.json(
        { error: 'No account with that id. Pick the user from the list rather than typing an id.' },
        { status: 404 }
      )
    }

    const requested: DialerMode = VALID_MODES.includes(requestedMode as DialerMode)
      ? (requestedMode as DialerMode)
      : 'progressive'
    // See the header: mirrored from the user-facing route, reported rather
    // than hidden.
    const mode: DialerMode = requested === 'predictive' ? 'progressive' : requested
    const downgradedFrom = requested !== mode ? requested : null

    // AMD default follows the mode, as it does in the user-facing route.
    const amdEnabled = mode === 'progressive'

    const { data: created, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name,
        dialer_mode: mode,
        amd_enabled: amdEnabled,
        recording_enabled: recordingEnabled,
        status: 'inactive',
      })
      .select('id, name, status, total_leads, called_leads, created_at, dialer_mode, amd_enabled, recording_enabled, predictive_lines_per_agent, enable_appointments_sub, enable_not_interested_sub')
      .single()

    if (error) throw error

    // Loud, like its siblings. A campaign appeared on somebody's account and
    // they did not create it.
    console.warn(
      `[admin/campaign-create] "${name}" (${created.id}) created on ${userId} ` +
      `(${owner.email ?? 'no email'}) by admin: mode=${mode}, recording=${recordingEnabled}` +
      (downgradedFrom ? `, downgraded from ${downgradedFrom}` : '')
    )

    return NextResponse.json({
      success: true,
      // Shaped like a row from the campaigns list route so the UI can drop it
      // straight into the list it already has, with an empty preview.
      campaign: { ...created, preview_leads: [] },
      downgradedFrom,
    })
  } catch (err: unknown) {
    return apiError(err, { route: 'admin/user-data/campaigns/create' })
  }
}
