import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/registration/export')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// THE FREE REGISTRATION PATH, AS A FILE
// =============================================================================
// Free Caller Registry is a web form, not an API. There is no endpoint to POST
// to, no webhook to receive, and no acknowledgement when a submission lands.
// The only thing software can usefully do is produce the list of numbers to
// paste or upload, and then remember that it did.
//
// That is worth automating anyway, because the list is the part that goes
// stale: pool automation buys numbers on its own schedule, so "which of my
// numbers have never been filed" is a question whose answer changes without
// anyone touching the admin app.
//
// THIS IS NOT THEIR TEMPLATE. The portal's exact column layout was not
// verified against the portal itself, so this exports a clean source list --
// E.164, area code, state, acquisition date -- rather than pretending to be a
// drop-in upload. Reshape to whatever the form asks for. The value here is the
// SELECTION, not the formatting.
// =============================================================================

/** Every engine Free Caller Registry fans a submission out to. */
const FCR_PROVIDERS = ['first_orion', 'hiya', 'tns'] as const

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  // Quote when the value could otherwise break the row apart. A leading + on
  // an E.164 number is left alone deliberately: quoting it is what stops
  // spreadsheets reading it as a formula or truncating the country code.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const url = new URL(req.url)
    // Default is the useful case: only what has never been filed. ?scope=all
    // re-exports the whole pool, for a fresh submission or a re-file.
    const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'pending'

    const { data: numbers, error } = await supabase
      .from('phone_numbers')
      .select('id, phone_number, area_code, state, region, status, acquired_at')
      .neq('status', 'released')
      .order('acquired_at', { ascending: true })
    if (error) throw error

    const { data: regs, error: regError } = await supabase
      .from('number_registrations')
      .select('number_id, provider, status')
    if (regError) throw regError

    // A number counts as pending when ANY of the three engines still has no
    // filing. FCR submits to all three at once, so a partial number belongs in
    // the batch just as much as an untouched one.
    const filed = new Map<string, Set<string>>()
    for (const r of regs ?? []) {
      if (r.status !== 'submitted' && r.status !== 'confirmed') continue
      const set = filed.get(r.number_id) ?? new Set<string>()
      set.add(r.provider)
      filed.set(r.number_id, set)
    }

    const rows = (numbers ?? []).filter(n => {
      if (scope === 'all') return true
      const set = filed.get(n.id)
      return !set || FCR_PROVIDERS.some(p => !set.has(p))
    })

    const header = ['phone_number', 'area_code', 'state', 'region', 'status', 'acquired_at']
    const body = rows.map(n => [
      n.phone_number, n.area_code, n.state, n.region, n.status,
      n.acquired_at ? new Date(n.acquired_at).toISOString().slice(0, 10) : '',
    ].map(csvCell).join(','))

    const csv = [header.join(','), ...body].join('\r\n')
    const stamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="fcr-${scope}-${stamp}.csv"`,
        'X-Row-Count': String(rows.length),
      },
    })
  } catch (err) {
    return apiError(err, { route: 'admin/pool/registration/export' })
  }
}
