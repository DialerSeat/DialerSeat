import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Streams, so it holds one page in memory rather than the whole export. The
// duration still matters because a very large export is many round trips.
// Vercel's documented default and Hobby maximum is 300s with fluid compute
// (Pro can go to 800s). An earlier revision of this file set 60 here on the
// mistaken belief that the default was ten seconds — that LOWERED the ceiling.
// 300 is the platform maximum on the current plan; do not reduce it without a
// reason, and raise it if the plan changes.
export const maxDuration = 300

// SECURITY (was IDOR): this route exported up to 50,000 lead rows (PII) scoped
// ONLY by a client-supplied ?user_id, with no auth check. Any signed-in user
// could export anyone's leads. We now derive identity from the Clerk session
// and ignore the query param entirely.

// ─────────────────────────────────────────────────────────────────────────
// THE EXPORT HAS NO ROW CEILING
//
// This used to select up to 50,000 rows, build the entire CSV as one string in
// memory, and return it — reporting success either way. A user with more leads
// than that got a truncated file with nothing to indicate it was short.
//
// That was unreachable while campaigns were capped at 10,000 leads. Removing
// that cap made it reachable, which is the kind of consequence worth stating
// plainly: lifting one limit turns the next one downstream from theory into a
// live defect.
//
// It matters more here than in most places because of what this route IS. This
// is the path a customer uses to leave with their data, and "your data, always
// yours" is a promise the marketing page makes explicitly. Handing back a
// silently-short file on that path is worse than refusing outright.
//
// TWO CHANGES MAKE IT UNBOUNDED:
//
//   It streams. Rows are encoded and pushed a page at a time, so memory is
//   flat regardless of size. Building one big string is what forced a ceiling
//   to exist in the first place.
//
//   It pages ASCENDING by created_at. Not a stylistic choice — with descending
//   order, rows inserted while the export runs (a lead drip is doing exactly
//   that) land at the TOP and shift every later page down, so offset paging
//   would emit duplicates. Ascending puts new arrivals past the cursor, where
//   they are either reached or not yet reached. Neither outcome corrupts the
//   file. The id tiebreaker matters too: a bulk upload inserts every row inside
//   one transaction, so those rows share an identical created_at and ordering
//   on that column alone is not deterministic.
// ─────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const HEADERS = [
  'first_name',
  'last_name',
  'phone',
  'email',
  'state',
  'disposition',
  'dial_attempts',
  'last_called_at',
  'notes',
  'created_at',
]

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''

  // Rebuilt per page — a PostgREST query builder is not reusable once awaited.
  const pageQuery = (from: number) => {
    let q = supabaseAdmin
      .from('leads')
      .select(HEADERS.join(','))
      .eq('user_id', userId)

    if (campaignId !== 'all') q = q.eq('campaign_id', campaignId)
    if (disposition !== 'all') {
      if (disposition === 'uncalled') q = q.is('disposition', null)
      else q = q.eq('disposition', disposition)
    }
    if (search) {
      const safe = search.replace(/[%,()]/g, '')
      q = q.or(
        `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`
      )
    }

    return q
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
  }

  const encoder = new TextEncoder()
  let from = 0
  let done = false

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(HEADERS.join(',') + '\n'))
    },
    async pull(controller) {
      if (done) return

      const { data, error } = await pageQuery(from)

      if (error) {
        // The response has already begun, so the status line is long gone and
        // there is no way to turn this into a 500. Erroring the stream is what
        // makes the download FAIL in the browser rather than completing as a
        // silently-short file — which is the whole point of this route.
        console.error('[leads/export] page failed', error)
        controller.error(new Error('Lead export failed partway through.'))
        return
      }

      const rows = (data || []) as any[]
      if (rows.length > 0) {
        const chunk = rows
          .map(r => HEADERS.map(h => escapeCSV(r[h])).join(','))
          .join('\n')
        controller.enqueue(encoder.encode(chunk + '\n'))
      }

      if (rows.length < PAGE_SIZE) {
        done = true
        controller.close()
        return
      }
      from += PAGE_SIZE
    },
  })

  // ── NAME THE FILE AFTER WHAT IS IN IT ──────────────────────────────────
  // Every export used to download as dialerseat-leads-<date>.csv, so exporting
  // three campaigns on one day produced three files with the same name, which
  // the browser then silently numbered (1), (2), (3). Nothing in the download
  // said which campaign was which, and the only way to find out was to open
  // them. Now that a campaign can be exported straight from its own settings
  // panel, that stops being a nuisance and starts being the normal case.
  //
  // The lookup is scoped to this user, so an id belonging to somebody else
  // yields no name rather than leaking one.
  let namePart = 'leads'
  if (campaignId !== 'all') {
    const { data: c } = await supabaseAdmin
      .from('campaigns')
      .select('name')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .maybeSingle()
    if (c?.name) {
      const slug = c.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
      if (slug) namePart = slug
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dialerseat-${namePart}-${date}.csv"`,
      // Nothing may buffer this into one body on the way out; that would
      // reintroduce the memory profile the streaming exists to avoid.
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
