import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/campaigns/recording')

// ─────────────────────────────────────────────────────────────────────────
// TURNING RECORDING ON FOR SOMEBODY ELSE'S CAMPAIGN
//
// Same shape and same reasoning as the dialer-mode sibling next door: the
// Data Explorer could already SEE every campaign on the platform, and this
// lets support fix one setting from the screen they are already looking at
// rather than talking a customer through finding a checkbox.
//
// Recording is the setting most worth reaching, because it is the only one
// where being wrong is UNRECOVERABLE. A dialer mode set badly can be changed
// and the next call is fine; a call that was not recorded cannot be recorded
// afterwards. When an owner asks to hear how an agent sounded and the answer
// is "that campaign had it off", there is nothing to do about the calls
// already made.
//
// ── WHAT TURNING THIS ON ALSO TURNS ON ─────────────────────────────────
// AMD decides whether a call is worth recording, so enabling recording on a
// campaign also runs answering-machine detection on every dial from it (see
// amdOnDial in lib/placeOutboundCall). Detection is billed per leg whether it
// answers or not, which makes it the cost that scales with DIAL VOLUME rather
// than with talk time. That is the real price of this switch and it is not
// obvious from the word "recording", so it is stated in the response.
//
// ── TWO THINGS THIS DOES NOT OVERRIDE ──────────────────────────────────
// platform_config.recording_enabled_global still wins. resolveWithGlobal only
// ever turns things OFF, so the platform kill switch remains the way to stop
// recording everywhere in seconds, and this endpoint cannot defeat it.
//
// And consent is not a database column. Two-party-consent states need the
// disclosure the agent actually gives; flipping this on for a customer does
// not make their calls lawful to record, it only makes them recorded. Support
// turning this on for somebody should know which of those it did.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // lib/admin's requireAdmin throws a Response rather than returning a gate.
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const campaignId = String(body?.campaignId ?? '').trim()
    const recordingEnabled = body?.recordingEnabled

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
    }
    // Strictly boolean. A missing or coerced value here would silently pick a
    // side on a setting whose wrong side loses evidence permanently.
    if (typeof recordingEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'recordingEnabled must be true or false' },
        { status: 400 }
      )
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, user_id, recording_enabled, amd_enabled')
      .eq('id', campaignId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.recording_enabled === recordingEnabled) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        recordingEnabled,
      })
    }

    const { error } = await supabase
      .from('campaigns')
      .update({ recording_enabled: recordingEnabled, updated_at: new Date().toISOString() })
      .eq('id', campaignId)

    if (error) throw error

    // Loud on purpose, exactly like the dialer-mode route. Somebody's calls
    // started or stopped being recorded and they did not do it — if they ask
    // later, this line is the answer.
    console.warn(
      `[admin/recording] ${campaign.name} (${campaignId}) owned by ${campaign.user_id}: ` +
      `recording ${campaign.recording_enabled} -> ${recordingEnabled}, changed by admin`
    )

    return NextResponse.json({
      success: true,
      recordingEnabled,
      previous: campaign.recording_enabled,
      // Surfaced so the UI can say it rather than the operator discovering it
      // on the next invoice.
      note: recordingEnabled
        ? 'Recording also runs AMD on every dial from this campaign, which is billed per leg answered or not.'
        : 'Calls already recorded are unaffected. Calls from here on will not be recorded.',
    })
  } catch (err: unknown) {
    return apiError(err, { route: 'admin/user-data/campaigns/recording' })
  }
}
