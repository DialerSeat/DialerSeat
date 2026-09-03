import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { extractLeads, normaliseLead } from '@/lib/leadIngest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = getServiceClient('ingest/leads')

// ─────────────────────────────────────────────────────────────────────────
// LEAD DRIP — ONE URL, ANY SENDER
//
// A webhook is the only integration surface every CRM, every lead vendor and
// every automation tool already speaks. Building a GoHighLevel connector, then
// a HubSpot connector, then a Salesforce connector is three integrations that
// each break on somebody else's release schedule; a URL that accepts JSON is
// one thing that works with all of them, and with a Google Sheet through Apps
// Script, and with Zapier, and with a script somebody wrote themselves.
//
// LANDING MID-SESSION. Leads insert straight into the leads table, so the
// existing claim path picks them up on its very next claim with no change to
// it whatsoever — that logic is load-bearing and fragile, and drip does not go
// anywhere near it. What a RUNNING queue panel needs is only to be told
// something arrived, and campaigns.last_lead_added_at does that: the heartbeat
// already runs every few seconds, so it carries the timestamp and the dialer
// refreshes its list when it moves.
//
// ALWAYS ANSWERS WITH DETAIL. A sender who gets a bare 400 has no idea whether
// their field names were wrong, their phone numbers were unusable, or the
// campaign was paused. Every response says exactly what happened to every lead,
// and every request is written to lead_ingest_events so it can be read back
// later from the campaign page.
// ─────────────────────────────────────────────────────────────────────────

const MAX_BATCH = 500

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  let campaignId: string | null = null

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null

  const record = async (
    ok: boolean,
    counts: { received: number; accepted: number; duplicates: number; rejected: number },
    message: string
  ) => {
    if (!campaignId) return
    try {
      await supabase.from('lead_ingest_events').insert({
        campaign_id: campaignId,
        ok,
        received: counts.received,
        accepted: counts.accepted,
        duplicates: counts.duplicates,
        rejected: counts.rejected,
        message,
        source_ip: ip,
      })
    } catch { /* a receipt failing must never fail the delivery */ }
  }

  try {
    if (!token || token.length < 20) {
      return NextResponse.json({ ok: false, error: 'Invalid ingest URL' }, { status: 404 })
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, user_id, name, status, ingest_enabled')
      .eq('ingest_token', token)
      .maybeSingle()

    if (!campaign) {
      // Deliberately identical to a disabled campaign's 404: a token that is
      // wrong and a token that was revoked should not be distinguishable to
      // somebody probing.
      return NextResponse.json({ ok: false, error: 'Invalid ingest URL' }, { status: 404 })
    }
    campaignId = campaign.id

    if (!campaign.ingest_enabled) {
      await record(false, { received: 0, accepted: 0, duplicates: 0, rejected: 0 },
        'Rejected, lead drip is switched off for this campaign')
      return NextResponse.json(
        { ok: false, error: 'Lead drip is switched off for this campaign' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    if (body === null) {
      await record(false, { received: 0, accepted: 0, duplicates: 0, rejected: 0 },
        'Rejected, body was not valid JSON')
      return NextResponse.json(
        { ok: false, error: 'Body must be valid JSON. Set Content-Type: application/json.' },
        { status: 400 }
      )
    }

    const raw = extractLeads(body)
    if (raw.length === 0) {
      await record(false, { received: 0, accepted: 0, duplicates: 0, rejected: 0 },
        'Rejected, no leads found in payload')
      return NextResponse.json(
        {
          ok: false,
          error: 'No leads found. Send one object, an array, or {"leads":[...]}.',
        },
        { status: 400 }
      )
    }
    if (raw.length > MAX_BATCH) {
      await record(false, { received: raw.length, accepted: 0, duplicates: 0, rejected: raw.length },
        `Rejected, ${raw.length} leads in one request, limit is ${MAX_BATCH}`)
      return NextResponse.json(
        { ok: false, error: `Too many leads in one request. Send at most ${MAX_BATCH}.` },
        { status: 413 }
      )
    }

    const normalised: any[] = []
    const rejected: Array<{ index: number; reason: string }> = []
    raw.forEach((item, i) => {
      const lead = normaliseLead(item)
      if (!lead) {
        rejected.push({ index: i, reason: 'No usable US phone number found' })
        return
      }
      normalised.push(lead)
    })

    if (normalised.length === 0) {
      await record(false, { received: raw.length, accepted: 0, duplicates: 0, rejected: raw.length },
        'Rejected, no usable phone numbers')
      return NextResponse.json(
        {
          ok: false,
          error: 'No usable phone numbers. Each lead needs a 10-digit US number.',
          rejected,
        },
        { status: 400 }
      )
    }

    // ── DUPLICATES ────────────────────────────────────────────────────────
    // Drip sources resend constantly: a CRM automation fires twice, a sheet
    // re-syncs, somebody replays a failed batch. Without this the same person
    // ends up in the queue three times and gets called three times, which is
    // both a bad experience and real TCPA exposure.
    const phones = Array.from(new Set(normalised.map(l => l.phone)))
    const { data: existing } = await supabase
      .from('leads')
      .select('phone')
      .eq('campaign_id', campaign.id)
      .in('phone', phones)

    const already = new Set((existing || []).map((r: any) => r.phone))

    const seen = new Set<string>()
    const toInsert = normalised.filter(l => {
      if (already.has(l.phone)) return false
      // Duplicates inside a single payload too.
      if (seen.has(l.phone)) return false
      seen.add(l.phone)
      return true
    })

    const duplicates = normalised.length - toInsert.length

    if (toInsert.length === 0) {
      await record(true, {
        received: raw.length, accepted: 0, duplicates, rejected: rejected.length,
      }, 'Accepted, every lead was already on this campaign')
      return NextResponse.json({
        ok: true,
        accepted: 0,
        duplicates,
        rejected: rejected.length,
        message: 'Every lead was already on this campaign.',
      })
    }

    const now = new Date().toISOString()
    const { error: insertErr } = await supabase.from('leads').insert(
      toInsert.map(l => ({
        campaign_id: campaign.id,
        // The lead belongs to whoever owns the campaign, never to the sender.
        // This is what keeps a dripped lead inside the owner's data and out of
        // everybody else's.
        user_id: campaign.user_id,
        phone: l.phone,
        first_name: l.first_name,
        last_name: l.last_name,
        email: l.email,
        address: l.address,
        city: l.city,
        state: l.state,
        zip: l.zip,
        notes: l.notes || '',
        status: 'uncalled',
        // Consent travels with the lead when the sender provides it. A dripped
        // lead with no consent record is still dialable, but the record is
        // worth keeping when it exists — it is the sender's evidence, not ours
        // to invent.
        consent_date: l.consent_date,
        consent_source: l.consent_source || 'lead_drip',
        consent_description: l.consent_description,
        extra_data: l.extra_data,
      }))
    )

    if (insertErr) throw insertErr

    // ── TELL THE RUNNING QUEUE ────────────────────────────────────────────
    // One timestamp is the whole mid-session mechanism. The heartbeat carries
    // it, the dialer notices it moved, and the panel refreshes — without this
    // route knowing anything about sessions, claims or who is dialing.
    // total_leads is maintained by whoever inserts, not by a trigger — the
    // upload path recounts after every import for exactly this reason. Skipping
    // it here would leave the campaign page, the team view and the dialer's own
    // dropdown all quoting a lead count that stopped being true the moment the
    // first drip landed. Recounted rather than incremented so a concurrent
    // delivery cannot leave the figure drifting.
    const { count: actualCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)

    await supabase
      .from('campaigns')
      .update({ last_lead_added_at: now, total_leads: actualCount ?? 0 })
      .eq('id', campaign.id)

    await record(true, {
      received: raw.length,
      accepted: toInsert.length,
      duplicates,
      rejected: rejected.length,
    }, `Accepted ${toInsert.length}`)

    return NextResponse.json({
      ok: true,
      accepted: toInsert.length,
      duplicates,
      rejected: rejected.length,
      rejectedDetail: rejected.length > 0 ? rejected.slice(0, 20) : undefined,
      campaign: campaign.name,
      // Said explicitly, because a sender testing their integration wants to
      // know the lead is live and not merely stored.
      note: campaign.status === 'active'
        ? 'Live, agents on this campaign will reach these without restarting.'
        : 'Stored. This campaign is paused, so nothing will be dialed until it is active.',
    })
  } catch (error: any) {
    console.error('[ingest/leads] failed', error)
    await record(false, { received: 0, accepted: 0, duplicates: 0, rejected: 0 },
      `Failed, ${error?.message || 'unknown error'}`)
    return NextResponse.json(
      { ok: false, error: 'Could not accept those leads. Try again.' },
      { status: 500 }
    )
  }
}

// A GET on the ingest URL is somebody checking it in a browser. Answering with
// a usable hint beats a 405 that reads like the URL is broken.
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'This endpoint accepts POST with a JSON body.',
    example: { phone: '5551234567', first_name: 'Jane', last_name: 'Doe', state: 'TX' },
  }, { status: 405 })
}
