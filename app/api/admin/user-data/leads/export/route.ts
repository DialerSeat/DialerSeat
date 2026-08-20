import { NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Vercel's documented default and Hobby maximum is 300s with fluid compute
// (Pro can go to 800s). An earlier revision of this file set 60 here on the
// mistaken belief that the default was ten seconds — that LOWERED the ceiling.
// 300 is the platform maximum on the current plan; do not reduce it without a
// reason, and raise it if the plan changes.
export const maxDuration = 300

// Same shape, and the same reasoning, as app/api/leads/export — see the long
// note there. This selected 50,000 rows, built one CSV string in memory and
// returned it as a success whatever the campaign's real size. Support uses this
// to answer "what does this customer actually have", so a silently short answer
// is worse than none: it produces confident wrong statements to a customer.
//
// Streams a page at a time, ordered ASCENDING so rows arriving mid-export (a
// lead drip does exactly that) land past the cursor instead of shifting every
// later page and duplicating rows. The id tiebreaker is required because a bulk
// upload writes every row in one transaction and they share a created_at.

const PAGE_SIZE = 1000

const HEADERS = [
  'first_name', 'last_name', 'phone', 'email', 'address', 'city', 'state', 'zip',
  'disposition', 'dial_attempts', 'last_called_at', 'notes',
  'consent_date', 'consent_source', 'created_at',
]

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const supabase = getServiceClient('admin/user-data/leads-export')
  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  if (!campaignId) {
    return new Response('Missing campaign_id', { status: 400 })
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign) {
    return new Response('Campaign not found', { status: 404 })
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

      const { data, error } = await supabase
        .from('leads')
        .select(HEADERS.join(','))
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        // The body is already going out, so this cannot become a 500. Erroring
        // the stream makes the download fail visibly rather than completing as
        // a short file that looks complete.
        console.error('[admin/leads-export] page failed', error)
        controller.error(new Error('Lead export failed partway through.'))
        return
      }

      const rows = (data || []) as any[]
      if (rows.length > 0) {
        controller.enqueue(encoder.encode(
          rows.map(r => HEADERS.map(h => escapeCSV(r[h])).join(',')).join('\n') + '\n'
        ))
      }

      if (rows.length < PAGE_SIZE) {
        done = true
        controller.close()
        return
      }
      from += PAGE_SIZE
    },
  })

  const safeName = (campaign.name || 'leads').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName || 'leads'}-${date}.csv"`,
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
