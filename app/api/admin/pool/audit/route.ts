import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { resolveTelnyxConfigOrLog } from '@/lib/telnyxConfig'
import { auditTelnyxNumbers, setCnamListing } from '@/lib/telnyxNumberAudit'

// =============================================================================
// NUMBER AUDIT — the per-number charges that are invisible from our database
// =============================================================================
// GET  reports what each owned number costs and which free settings are unset.
// POST turns on outbound CNAM across every number missing it.
//
// WHY. Two per-number fees live on Telnyx's side and nothing in this codebase
// sets either, so no amount of reading our own tables can answer them:
//
//   E911   $1.50/month/number. Thirteen numbers is $19.50/month — more than
//          the $13 of rental and half the entire $28.29 usage bill. Often
//          switched on at provisioning, and it appears on the invoice as
//          "emergency services" under MRC, which nobody had read.
//   CNAM   Outbound caller ID name. FREE, and unset on every number, so all
//          thirteen display as a bare number.
//
// The alternative to this route is thirteen separate pages in Mission Control,
// re-checked every time a number is bought. See docs/COST-FINDINGS.md §1o/§1t.
//
// NOTHING HERE DISABLES E911. It reports it. Turning off emergency service on a
// line is a safety decision, not a cost lever, and it is not one an admin button
// should make quietly.

export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    const config = resolveTelnyxConfigOrLog('admin/pool/audit')
    if (!config) {
      return NextResponse.json({ error: 'Telnyx is not configured' }, { status: 500 })
    }

    const result = await auditTelnyxNumbers(config.apiKey)
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Audit failed' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      totals: result.totals,
      numbers: result.numbers,
      // Plain-language readings, so the answer is on the screen rather than
      // needing the price list to interpret it.
      notes: [
        result.totals.e911_enabled > 0
          ? `E911 is ON for ${result.totals.e911_enabled} number(s): $${result.totals.e911_monthly_usd}/month. ` +
            `This is the line that was unaccounted for.`
          : 'E911 is OFF on every number. Nothing owed for it.',
        `Number rental: $${result.totals.rental_monthly_usd}/month.`,
        `Fixed monthly cost before a single call: $${result.totals.fixed_monthly_usd}.`,
        result.totals.cnam_missing > 0
          ? `${result.totals.cnam_missing} number(s) have no outbound CNAM. It is free to set — ` +
            `but wireless carriers generally do not display it, so expect it to reach landlines only.`
          : 'Outbound CNAM is set on every number.',
        result.totals.deletion_unlocked > 0
          ? `${result.totals.deletion_unlocked} number(s) have no deletion lock.`
          : 'Every number has a deletion lock.',
        // Telnyx: "This feature has an additional per-number monthly cost."
        result.totals.call_screening_enabled > 0
          ? `${result.totals.call_screening_enabled} number(s) have inbound call screening on, ` +
            `which Telnyx charges extra per number per month for.`
          : 'Inbound call screening is off everywhere (it carries a per-number monthly cost).',
        // Says so rather than letting a missing flag read as "off" -- that
        // exact confusion is the bug this route shipped with and had fixed.
        result.numbers.some(n => n.settings_unknown)
          ? `WARNING: voice settings could not be read for ` +
            `${result.numbers.filter(n => n.settings_unknown).length} number(s). Their E911 and ` +
            `CNAM state is UNKNOWN, not off — re-run before trusting the totals.`
          : 'Voice settings were read for every number.',
      ],
    })
  } catch (err) {
    console.error('[admin/pool/audit] GET threw', err)
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}

/**
 * Enable outbound CNAM on every number that does not have it.
 *
 * Body: { "name": "ACME INS" } — 15 characters, trimmed rather than rejected.
 *
 * Free, per Telnyx. Live in 12-72 hours once the industry databases pick it up.
 * Temper the expectation: it reaches the landline share of a list and nothing
 * else, because wireless carriers generally do not dip CNAM.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json(
        { error: 'A CNAM name is required (max 15 characters).' },
        { status: 400 }
      )
    }

    const config = resolveTelnyxConfigOrLog('admin/pool/audit')
    if (!config) {
      return NextResponse.json({ error: 'Telnyx is not configured' }, { status: 500 })
    }

    const audit = await auditTelnyxNumbers(config.apiKey)
    if (!audit.ok) {
      return NextResponse.json({ error: audit.error || 'Could not list numbers' }, { status: 502 })
    }

    // Only the ones we can SEE are missing it. Two exclusions, and the second
    // matters more than it looks:
    //
    //   already set        re-PATCHing is harmless but it is pointless writes
    //                      against a rate limit, and it makes the result read
    //                      as though work happened.
    //   settings_unknown   a number whose voice settings could not be read has
    //                      cnam_enabled:false by DEFAULT, not by observation.
    //                      Writing to it would silently overwrite a listing
    //                      nobody ever saw. Unknown is not empty.
    const targets = audit.numbers.filter(
      n => !n.cnam_enabled && !n.settings_unknown && n.telnyx_id
    )
    const skippedUnknown = audit.numbers.filter(n => n.settings_unknown).length

    const updated: string[] = []
    const failed: { phone_number: string; error: string }[] = []

    // Sequential on purpose. Thirteen numbers is a couple of seconds, and a
    // parallel burst against the numbers API is how a management call starts
    // competing with the dial path for rate limit.
    for (const n of targets) {
      const res = await setCnamListing(config.apiKey, n.telnyx_id as string, name)
      if (res.ok) updated.push(n.phone_number)
      else failed.push({ phone_number: n.phone_number, error: res.error || 'unknown' })
    }

    return NextResponse.json({
      success: true,
      name_applied: name.slice(0, 15),
      already_set: audit.numbers.length - targets.length,
      updated: updated.length,
      updated_numbers: updated,
      failed,
      skipped_unreadable: skippedUnknown,
      note:
        'Live in 12-72 hours once the industry databases pick it up. Wireless ' +
        'carriers generally do not display CNAM, so this reaches landlines only.' +
        (skippedUnknown > 0
          ? ` ${skippedUnknown} number(s) were SKIPPED because their voice settings could not ` +
            `be read — they may already carry a listing.`
          : ''),
    })
  } catch (err) {
    console.error('[admin/pool/audit] POST threw', err)
    return NextResponse.json({ error: 'CNAM update failed' }, { status: 500 })
  }
}
