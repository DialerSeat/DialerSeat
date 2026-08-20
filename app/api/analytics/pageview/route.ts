import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = getServiceClient('analytics/pageview')

// ─────────────────────────────────────────────────────────────────────────
// COUNTING VISITS WITHOUT WATCHING PEOPLE
//
// The question is "how many views is the site getting", not "who came". So
// nothing identifying is stored: no IP, no user agent, no user id. The visitor
// hash is IP + user agent + the date + a server secret, which counts a person
// once per day and becomes meaningless at midnight when the date rolls. It
// cannot be reversed, and two visits on different days are not linkable even
// by us — which is the point.
//
// Never blocks the page. A view that fails to record is a missing tally mark;
// a view that fails LOUDLY is a broken site. Everything below swallows its
// errors and always answers 204.
// ─────────────────────────────────────────────────────────────────────────

// Obvious crawlers. Not exhaustive and not meant to be — the goal is that a
// traffic graph reflects people rather than uptime monitors, and the long tail
// of unknown bots matters far less than Googlebot hitting every page nightly.
const BOT = /bot|crawler|spider|crawling|slurp|bingpreview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|postman|monitor|preview/i

function deviceFrom(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile'
  return 'desktop'
}

/** Path only — query strings carry search terms, tokens and ids, none of which
 *  belong in an analytics table. Trailing slash normalised so /pricing and
 *  /pricing/ are one row rather than two. */
function cleanPath(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  let p = raw.split('?')[0].split('#')[0].trim()
  if (!p.startsWith('/')) return null
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  if (p.length > 300) return null
  return p || '/'
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') || ''
    if (BOT.test(ua)) return new NextResponse(null, { status: 204 })

    const body = await req.json().catch(() => ({}))
    const path = cleanPath(body?.path)
    if (!path) return new NextResponse(null, { status: 204 })

    // Only the referrer's HOST. The full URL of the page somebody came from can
    // itself be sensitive, and "where does my traffic come from" is answered by
    // the domain alone.
    let referrerHost: string | null = null
    if (typeof body?.referrer === 'string' && body.referrer) {
      try {
        const h = new URL(body.referrer).hostname
        referrerHost = h && h !== req.nextUrl.hostname ? h.slice(0, 120) : null
      } catch { /* a malformed referrer is simply not recorded */ }
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      ''

    const day = new Date().toISOString().slice(0, 10)
    const visitorHash = createHash('sha256')
      .update(`${ip}|${ua}|${day}|${process.env.CRON_SECRET || 'ds'}`)
      .digest('hex')
      .slice(0, 32)

    await supabase.from('page_views').insert({
      path,
      referrer_host: referrerHost,
      is_authed: !!body?.authed,
      visitor_hash: visitorHash,
      device: deviceFrom(ua),
    })

    return new NextResponse(null, { status: 204 })
  } catch {
    // Deliberately silent. A tally mark is not worth an error in anybody's
    // console, and certainly not worth a failed request on a marketing page.
    return new NextResponse(null, { status: 204 })
  }
}
