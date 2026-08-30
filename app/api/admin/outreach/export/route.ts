import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'
import { unsubscribeUrl } from '@/lib/outreach'

const supabase = getServiceClient('admin/outreach/export')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// The sendable batch
// =============================================================================
// A CSV for whatever tool actually does the sending. Every row carries its own
// unsubscribe URL, which is the whole point: the link points back here, so the
// opt-out lands in this database rather than inside a vendor. Change sending
// tools and every link already in someone's inbox still works.
//
// The sending tool needs to put that column in BOTH places:
//   List-Unsubscribe: <{{unsubscribe_url}}>
//   List-Unsubscribe-Post: List-Unsubscribe=One-Click
// and as the visible footer link. The header is what Gmail and Yahoo require;
// the footer is what stops a human reaching for "report spam" instead.
// =============================================================================

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const url = new URL(req.url)
    // Default is the useful case: people who have never been mailed. 'all'
    // re-exports everyone still mailable, for a follow-up sequence.
    const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'new'
    const limit = Math.min(50000, Math.max(1, Number(url.searchParams.get('limit')) || 50000))
    const origin = url.origin.includes('localhost') ? 'https://dialerseat.com' : url.origin

    const { data: rows, error } = await supabase
      .from('outreach_contacts')
      .select('email, name, company, source, unsubscribe_token, status')
      // Never export an opt-out or a hard bounce. This is the guarantee the
      // whole table exists to make, so it is enforced in the query rather than
      // left to whoever calls it.
      .in('status', scope === 'all' ? ['new', 'sent'] : ['new'])
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw error

    // Second pass against suppression by address. Redundant with the status
    // filter above by design — status is maintained by a trigger, and a
    // guarantee this important should not rest on a trigger having fired.
    const emails = (rows ?? []).map(r => r.email)
    const suppressed = new Set<string>()
    for (let i = 0; i < emails.length; i += 500) {
      const { data } = await supabase
        .from('outreach_suppression')
        .select('email')
        .in('email', emails.slice(i, i + 500))
      for (const r of data ?? []) suppressed.add(r.email)
    }

    const sendable = (rows ?? []).filter(r => !suppressed.has(r.email))

    const header = ['email', 'name', 'company', 'source', 'unsubscribe_url']
    const body = sendable.map(r => [
      r.email,
      r.name ?? '',
      r.company ?? '',
      r.source ?? '',
      unsubscribeUrl(r.unsubscribe_token, origin),
    ].map(csvCell).join(','))

    const csv = [header.join(','), ...body].join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="outreach-${scope}-${stamp}.csv"`,
        'X-Row-Count': String(sendable.length),
        'X-Suppressed-Held-Back': String(suppressed.size),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return apiError(err, { route: 'admin/outreach/export' })
  }
}
