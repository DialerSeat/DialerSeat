import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'
import { isCallableNow } from '@/lib/callingWindow'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Vercel's documented default and Hobby maximum with fluid compute. A large
// upload is many round trips — dedupe lookups, then chunked inserts — and the
// bound that matters is time, not rows.
export const maxDuration = 300

// ── THE REQUEST BODY IS CAPPED BY THE PLATFORM, NOT BY US ──────────────────
// Vercel rejects any request body over 4.5MB with a 413 before this handler is
// ever entered, so no amount of server code makes a single enormous upload
// work. At roughly 250 bytes of JSON per lead that is somewhere around 15,000
// rows, and it varies with how much extra_data each row carries — which means a
// row-count limit here would be a guess that is sometimes wrong in both
// directions.
//
// The client therefore splits large files and posts them in sequence
// (lib/uploadLeadsInChunks.ts). This handler stays a single-batch endpoint and
// is safe to call repeatedly: dedupe runs per call against what is already in
// the campaign, so a chunk that overlaps a previous one rejects the duplicates
// rather than doubling them.

/**
 * Parses optional consent fields from a lead row. Returns the four columns
 * if they're present and parseable, all null otherwise.
 *
 * Accepted CSV header names (case-insensitive, punctuation-stripped):
 *   consent_date, consent date, consentdate
 *   consent_source, consent source
 *   consent_description, consent text, consent_text
 *   consent_proof_url, consent_proof, proof_url
 *
 * This is per the FCC's January 2025 one-to-one consent rule under TCPA.
 */
function parseConsent(row: Record<string, any>) {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && v !== undefined && String(v).trim()) {
      lower[k.toLowerCase().replace(/[^a-z]/g, '')] = String(v).trim()
    }
  }

  const dateRaw = lower['consentdate']
  const source = lower['consentsource']
  const description = lower['consentdescription'] || lower['consenttext']
  const proofUrl = lower['consentproofurl'] || lower['consentproof'] || lower['proofurl']

  let consentDate: string | null = null
  if (dateRaw) {
    const parsed = new Date(dateRaw)
    if (!isNaN(parsed.getTime())) consentDate = parsed.toISOString()
  }

  return {
    consent_date: consentDate,
    consent_source: source || null,
    consent_description: description || null,
    consent_proof_url: proofUrl || null,
  }
}

// ── DUPLICATE-CHECK EXEMPTION, FOR TESTING ONLY ─────────────────────────────
// A test list is deliberately the same number repeated forty times, because
// that is how you get a predictable queue to watch pacing, rotation and line
// counts against. Deduping it leaves one lead and nothing to observe.
//
// Keyed on the account rather than a flag on the request, on purpose. A
// customer must not be able to switch this off for themselves — deduping a
// real list stops the same person being called twice, which is a protection
// nobody should be able to waive by accident or by crafting a request.
//
// is_admin was the obvious hook and is the wrong one twice over: the admin
// account is an overseer that does not dial, and the account this is actually
// needed for is not flagged admin at all. Keying on the flag would have looked
// correct and silently done nothing.
//
// One id, the product-test account. Not a role, not a tier — adding anyone
// else here should require deciding to.
const DEDUPE_EXEMPT_CLERK_IDS = new Set([
  'user_3DJJGeuXcG0KuKWBMX8KuR85X4M', // joshuacribbffl@gmail.com — product testing
])

export async function POST(req: Request) {
  try {
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const skipDedupe = DEDUPE_EXEMPT_CLERK_IDS.has(userId)

    const body = await req.json()
    const { campaign_id, leads } = body

    if (!campaign_id) {
      return NextResponse.json(
        { success: false, error: 'Missing campaign_id' },
        { status: 400 }
      )
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No leads provided' },
        { status: 400 }
      )
    }

    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, user_id, total_leads')
      .eq('id', campaign_id)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // ── PHONES ALREADY IN THIS CAMPAIGN ───────────────────────────────────
    // Dedupe only ran within the uploaded file, so re-uploading a list — the
    // single most common thing a user does after adding a few rows — silently
    // doubled every lead. The agent then dials the same person twice, which is
    // both a wasted call and a compliance problem.
    //
    // ASKS ABOUT THE UPLOAD, NOT ABOUT THE CAMPAIGN. This used to select every
    // phone in the campaign and hold them in a Set, which is why a 10,000-lead
    // ceiling existed at all: the dedupe, not the dialer, was what could not
    // scale. Reading a million-lead campaign into memory on every upload is the
    // real limit, and it is removed by inverting the question — instead of
    // "what is already here", ask "which of THESE numbers are already here".
    //
    // Cost is now proportional to what is being uploaded and completely
    // independent of how large the campaign already is. A campaign may hold any
    // number of leads.
    //
    // The pre-pass is deliberately over-inclusive: it takes every value in every
    // row that could be a US phone number, rather than duplicating the column
    // detection that runs in the validation loop below. Over-inclusion is free
    // here — the set is only ever consulted with an exact `digits` value that
    // the loop itself produced, so extra candidates can add rows to the query
    // but can never change an answer.
    const existingPhones = new Set<string>()
    if (!skipDedupe) {
      const candidates = new Set<string>()
      for (const lead of leads) {
        if (!lead || typeof lead !== 'object') continue
        for (const v of Object.values(lead as Record<string, unknown>)) {
          if (v === null || v === undefined) continue
          const d = String(v).replace(/\D/g, '')
          if (d.length === 10 || (d.length === 11 && d.startsWith('1'))) {
            candidates.add(d)
          }
        }
      }

      // Chunked because PostgREST puts .in() values in the URL, and a long
      // enough list is rejected outright rather than merely being slow.
      const CANDIDATE_CHUNK = 1000
      const all = [...candidates]
      for (let i = 0; i < all.length; i += CANDIDATE_CHUNK) {
        const chunk = all.slice(i, i + CANDIDATE_CHUNK)
        const { data: priorLeads, error: dedupeErr } = await supabaseAdmin
          .from('leads')
          .select('phone')
          .eq('campaign_id', campaign_id)
          .in('phone', chunk)
        if (dedupeErr) {
          // Failing the upload beats silently importing duplicates: a double
          // entry means the same person is dialed twice, which is the
          // compliance problem this check exists to prevent.
          console.error('[leads/upload] dedupe lookup failed', dedupeErr)
          return NextResponse.json({
            success: false,
            error: 'Could not check this campaign for duplicate numbers, so the upload was stopped.',
            detail: 'Nothing was imported. Try again in a moment.',
          }, { status: 503 })
        }
        for (const row of priorLeads ?? []) {
          const d = String(row.phone ?? '').replace(/\D/g, '')
          if (d) existingPhones.add(d)
        }
      }
    }

    // ── ROW-BY-ROW VALIDATION WITH REASONS ────────────────────────────────
    // This used to be a .map().filter() that silently dropped anything without
    // a 10-digit phone, and only reported a problem when EVERY row failed. A
    // user uploading 1,000 rows of which 900 were unusable was told the upload
    // succeeded — the single worst outcome, because the list looks fine and the
    // shortfall is discovered days later while dialing.
    //
    // Every rejection is now categorised and counted, with a few real examples
    // per category so the user can see the actual offending value rather than
    // being told to go and check their file.
    type RejectReason =
      | 'no_phone_column'
      | 'phone_too_short'
      | 'phone_too_long'
      | 'duplicate_in_file'
      | 'already_in_campaign'
      | 'malformed_row'

    const REJECT_LABELS: Record<RejectReason, string> = {
      no_phone_column:   'No phone number found in the row',
      phone_too_short:   'Phone number has fewer than 10 digits',
      phone_too_long:    'Phone number has more digits than a valid US number',
      duplicate_in_file: 'Duplicate phone number within this file',
      already_in_campaign: 'This number is already a lead in this campaign',
      malformed_row:     'Row could not be read (not a record or a list of values)',
    }

    const rejects: Record<RejectReason, { count: number; examples: string[] }> = {
      no_phone_column:   { count: 0, examples: [] },
      phone_too_short:   { count: 0, examples: [] },
      phone_too_long:    { count: 0, examples: [] },
      duplicate_in_file: { count: 0, examples: [] },
      already_in_campaign: { count: 0, examples: [] },
      malformed_row:     { count: 0, examples: [] },
    }

    const EXAMPLES_PER_REASON = 3
    const reject = (reason: RejectReason, rowNumber: number, sample: string) => {
      const bucket = rejects[reason]
      bucket.count++
      if (bucket.examples.length < EXAMPLES_PER_REASON) {
        // Row number is 1-based and offset by the header row, so it matches
        // what the user sees in their spreadsheet.
        bucket.examples.push(`row ${rowNumber + 2}: ${sample || '(empty)'}`)
      }
    }

    const seenPhones = new Set<string>()
    /** A row that passed validation and is ready to insert. */
    type LeadRow = Record<string, unknown> & { phone: string }
    const leadsToInsert: LeadRow[] = []

    leads.forEach((lead: any, i: number) => {
      let phone = ''
      let built: LeadRow | null = null

      if (typeof lead === 'object' && lead !== null && !Array.isArray(lead)) {
        // Only match recognized header name variants — no positional
        // fallback to keys[0]/keys[1]. A positional fallback silently
        // assigns whatever happens to be in the first/second column to
        // first_name/last_name even when that column is something else
        // entirely (e.g. a duplicated phone number, a notes field) — which
        // is exactly what produced rows where last_name showed a raw phone
        // number. Leaving these blank when no recognized header matches is
        // more honest than guessing from column position.
        const first_name = lead['first_name'] || lead['First Name'] ||
          lead['firstname'] || lead['FirstName'] ||
          lead['first'] || lead['First'] ||
          lead['name'] || lead['Name'] || ''

        const last_name = lead['last_name'] || lead['Last Name'] ||
          lead['lastname'] || lead['LastName'] ||
          lead['last'] || lead['Last'] || ''

        phone = lead['phone'] || lead['Phone'] || lead['phone_number'] ||
          lead['Phone Number'] || lead['PHONE'] || lead['mobile'] ||
          lead['Mobile'] || lead['cell'] || lead['Cell'] ||
          Object.values(lead).find((v: any) =>
            typeof v === 'string' && v.replace(/\D/g, '').length >= 10
          ) as string || ''

        built = {
          campaign_id,
          user_id: userId,
          first_name,
          last_name,
          phone: String(phone).replace(/\D/g, ''),
          email: lead['email'] || lead['Email'] || lead['EMAIL'] || '',
          state: lead['state'] || lead['State'] || lead['STATE'] || '',
          status: 'uncalled',
          extra_data: lead,
          ...parseConsent(lead),
        }
      } else if (Array.isArray(lead)) {
        phone = lead.find((v: any) =>
          typeof v === 'string' && v.replace(/\D/g, '').length >= 10
        ) || ''

        // Array-format rows genuinely have no header names to match against
        // at all, so a positional guess is the only option here. Flagged in
        // extra_data.raw so a bad guess is traceable to the original row.
        built = {
          campaign_id,
          user_id: userId,
          first_name: lead[0] || '',
          last_name: lead[1] || '',
          phone: String(phone).replace(/\D/g, ''),
          status: 'uncalled',
          extra_data: { raw: lead },
          consent_date: null,
          consent_source: null,
          consent_description: null,
          consent_proof_url: null,
        }
      } else {
        reject('malformed_row', i, typeof lead)
        return
      }

      const digits: string = built.phone
      const raw = String(phone || '').slice(0, 40)

      if (digits.length === 0) {
        reject('no_phone_column', i, raw)
        return
      }
      if (digits.length < 10) {
        reject('phone_too_short', i, `${raw} (${digits.length} digits)`)
        return
      }
      // 11 is fine when it is a US country code; anything longer is not a
      // number we can dial and would fail at the carrier instead.
      if (digits.length > 11 || (digits.length === 11 && !digits.startsWith('1'))) {
        reject('phone_too_long', i, `${raw} (${digits.length} digits)`)
        return
      }
      // Both dedupe checks are skipped wholesale for the testing accounts —
      // see DEDUPE_EXEMPT_CLERK_IDS. existingPhones is already empty in that
      // case; seenPhones still fills below so nothing downstream changes.
      if (!skipDedupe) {
        if (seenPhones.has(digits)) {
          reject('duplicate_in_file', i, raw)
          return
        }
        if (existingPhones.has(digits)) {
          reject('already_in_campaign', i, raw)
          return
        }
      }

      seenPhones.add(digits)
      leadsToInsert.push(built)
    })

    // ── WARNINGS: IMPORTED, BUT NOT DIALABLE ──────────────────────────────
    // A row can pass every check above and still never ring a phone. The
    // calling window is enforced per lead, and a lead whose state cannot be
    // established fails CLOSED — so a well-formed 10-digit number with an area
    // code we do not recognise imports cleanly, sits in the queue, and is
    // skipped forever. From the user's side the upload succeeded and the
    // dialer just says there is nothing to call.
    //
    // These are warnings, not rejections: the data is real and the fix (adding
    // a state column) is theirs to make, so the leads still import.
    type WarnReason =
      | 'undialable_no_state'
      | 'impossible_number'
      | 'sunday_state'
      | 'international'

    const WARN_LABELS: Record<WarnReason, string> = {
      undialable_no_state:
        'Area code not recognised and no state given — these will never be dialed until a state is added',
      impossible_number:
        'Not routable US numbers — the right number of digits, but an area code or exchange no carrier can route',
      sunday_state:
        'In states that prohibit Sunday calls — these are skipped on Sundays only',
      international:
        'Not US numbers — dialed under their own country\'s rules',
    }

    const warns: Record<WarnReason, { count: number; examples: string[] }> = {
      undialable_no_state: { count: 0, examples: [] },
      impossible_number:   { count: 0, examples: [] },
      sunday_state:        { count: 0, examples: [] },
      international:       { count: 0, examples: [] },
    }

    for (const l of leadsToInsert) {
      const verdict = isCallableNow({ phone: l.phone, state: String(l.state ?? '') })
      if (verdict.allowed) continue
      let bucket: WarnReason | null = null
      // Time-of-day refusals are not warnings — those leads dial fine tomorrow
      // morning. Only permanent conditions belong here.
      if (verdict.code === 'impossible_number') {
        bucket = 'impossible_number'
      } else if (verdict.code === 'unknown_area' || verdict.code === 'invalid_number') {
        bucket = 'undialable_no_state'
      } else if (verdict.code === 'sunday') {
        bucket = 'sunday_state'
      } else if (verdict.code === 'international') {
        bucket = 'international'
      }
      if (!bucket) continue
      const w = warns[bucket]
      w.count++
      if (w.examples.length < EXAMPLES_PER_REASON) w.examples.push(l.phone)
    }

    const warnSummary = (Object.keys(warns) as WarnReason[])
      .filter(k => warns[k].count > 0)
      .map(k => ({
        reason: k,
        label: WARN_LABELS[k],
        count: warns[k].count,
        examples: warns[k].examples,
      }))

    // A human-readable summary, built once and reused for both the failure
    // response and the partial-success one.
    const rejectSummary = (Object.keys(rejects) as RejectReason[])
      .filter(k => rejects[k].count > 0)
      .map(k => ({
        reason: k,
        label: REJECT_LABELS[k],
        count: rejects[k].count,
        examples: rejects[k].examples,
      }))

    const rejectedTotal = rejectSummary.reduce((n, r) => n + r.count, 0)

    if (leadsToInsert.length === 0) {
      // Say WHICH problem, with examples. "No valid leads found" on its own
      // gives the user nothing to act on and generates a support ticket.
      const detail = rejectSummary
        .map(r => `${r.label} (${r.count}): ${r.examples.join('; ')}`)
        .join(' | ')

      return NextResponse.json({
        success: false,
        error: rejectSummary.length === 1
          ? `No leads could be imported — every row was rejected: ${rejectSummary[0].label.toLowerCase()}.`
          : `No leads could be imported. All ${rejectedTotal} rows were rejected.`,
        detail: detail || 'The file contained no readable rows.',
        rejected: rejectedTotal,
        rejections: rejectSummary,
      }, { status: 400 })
    }

    // ── INSERTED IN CHUNKS, AND A FAILURE SAYS WHAT LANDED ────────────────
    // This was one insert() of every row. A single statement carrying tens of
    // thousands of rows is a different thing from a few hundred: it can exceed
    // the statement timeout, and when it fails it fails ENTIRELY, so a user who
    // waited two minutes is told only "upload failed" with nothing to say
    // whether any of it took.
    //
    // Chunked, so each statement stays small and predictable. Partial success
    // is reported honestly rather than being converted into a total failure —
    // the rows that landed are really there, and telling somebody otherwise
    // would have them upload again and rely on dedupe to sort it out.
    const INSERT_CHUNK = 1000
    let inserted = 0
    let insertFailedAt: string | null = null

    for (let i = 0; i < leadsToInsert.length; i += INSERT_CHUNK) {
      const slice = leadsToInsert.slice(i, i + INSERT_CHUNK)
      const { error: insertError } = await supabaseAdmin
        .from('leads')
        .insert(slice)

      if (insertError) {
        // The first chunk failing means nothing landed, which is a plain
        // failure and should read as one.
        if (inserted === 0) throw insertError
        console.error('[leads/upload] insert failed after', inserted, 'rows', insertError)
        insertFailedAt = insertError.message
        break
      }
      inserted += slice.length
    }

    const { count: actualCount } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign_id)

    await supabaseAdmin
      .from('campaigns')
      .update({ total_leads: actualCount ?? 0 })
      .eq('id', campaign_id)

    // Count how many leads in this batch actually carried consent metadata.
    // Useful for showing "uploaded 1,000 leads (823 with consent)" in the UI.
    const consentCount = leadsToInsert
      .slice(0, inserted)
      .filter((l: any) => l && l.consent_date).length

    // A partial insert is not a success. Saying so, with the real number and
    // the way forward, is the difference between a user who knows what to do
    // and one who has to guess whether re-uploading will duplicate everything.
    if (insertFailedAt) {
      return NextResponse.json({
        success: false,
        error:
          `Saved ${inserted.toLocaleString()} of ${leadsToInsert.length.toLocaleString()} leads, ` +
          `then the upload stopped.`,
        detail:
          'Upload the same file again — the leads already saved will be detected as ' +
          'duplicates and skipped, so nothing will be added twice.',
        count: inserted,
        attempted: leadsToInsert.length,
        partial: true,
      }, { status: 207 })
    }

    return NextResponse.json({
      success: true,
      count: inserted,
      total: actualCount,
      withConsent: consentCount,
      // A PARTIAL import is still a problem the user needs to know about.
      // Reporting only the success count is how someone uploads 1,000 rows,
      // imports 100, and finds out days later while dialing.
      rejected: rejectedTotal,
      rejections: rejectSummary,
      // Imported, but will not dial. Separate from rejections because the rows
      // ARE in the campaign — the user needs to fix them, not re-upload them.
      warnings: warnSummary,
    })
  } catch (error: any) {
    return apiError(error, { route: 'leads/upload' })
  }
}