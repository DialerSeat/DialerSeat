import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createHash, randomBytes } from 'crypto'

// First-party, ours, and readable only by us. Two years so a returning reader
// is still recognisable next quarter; there is nothing sensitive in the value,
// it is a random number we issued.
const VISITOR_COOKIE = 'ds_vid'
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 730
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

    // ── A STABLE ID FOR THE BROWSER, NEXT TO THE DAILY ONE ────────────────
    // visitorHash above rotates every day by design, so somebody reading the
    // site three days running counts as three visitors and a signup cannot be
    // joined to the visit that produced it. That made "did this customer come
    // from ChatGPT?" answerable only by lining up timestamps by eye.
    //
    // This is a random first-party id in our own cookie. Nothing is derived
    // from the device — no fingerprint, no IP in the value — so it identifies
    // a BROWSER we handed an id to, and clearing cookies genuinely resets it.
    //
    // Set on the response further down rather than here, because a beacon
    // must never fail the page it is measuring.
    const existingVid = req.cookies.get(VISITOR_COOKIE)?.value || ''
    const visitorId = /^[0-9a-f]{32}$/.test(existingVid)
      ? existingVid
      : randomBytes(16).toString('hex')
    const isNewVisitor = visitorId !== existingVid

    // ── DWELL COMES BACK LATER ────────────────────────────────────────
    // A second beacon fires when the page is left, carrying how long it was
    // open. It updates the row the first beacon wrote rather than inserting a
    // new one — two rows per view would double every count on the page.
    if (body?.dwellMs && body?.viewId) {
      const ms = Math.min(Math.max(0, Math.round(Number(body.dwellMs))), 6 * 60 * 60 * 1000)
      if (Number.isFinite(ms) && ms > 0) {
        await supabase
          .from('page_views')
          .update({ dwell_ms: ms })
          .eq('id', body.viewId)
      }
      return new NextResponse(null, { status: 204 })
    }

    // ── WHERE FROM, WITHOUT FOLLOWING ANYBODY ─────────────────────────
    // Vercel's edge adds these on every request at no cost and with no extra
    // tracking. Country and region only: city and postcode narrow a person far
    // more than a traffic graph ever needs, and collecting them would mean
    // holding data we have no use for.
    const country = req.headers.get('x-vercel-ip-country')?.slice(0, 4) || null
    const region = req.headers.get('x-vercel-ip-country-region')?.slice(0, 8) || null

    // The standard campaign trio, extracted by name rather than keeping the
    // query string. A raw query carries search terms, tokens and ids — none of
    // which belong in an analytics table, and all of which would end up here.
    const utm = (k: string): string | null => {
      const v = body?.[k]
      if (typeof v !== 'string' || !v.trim()) return null
      return v.trim().slice(0, 120)
    }

    // Never throws on a public route — it returns a null userId for a
    // signed-out visitor, which is exactly the distinction being recorded.
    let isAuthed = false
    let isAdmin = false
    let clerkId: string | null = null
    try {
      const { userId } = await auth()
      isAuthed = !!userId
      clerkId = userId || null

      // ── OUR OWN VISITS ARE NOT TRAFFIC ────────────────────────────────
      // The owner is on this site constantly, and at current volume that is
      // not noise at the margin — it is most of the table. Flagged at write
      // time rather than filtered at read time, because the report should
      // not have to know who the owner is, and a later change of admin must
      // not silently rewrite the history of who visited.
      //
      // A boolean, never a clerk_id. The report only needs "is this us"; an
      // analytics table is the wrong place to build a record of who read
      // what.
      if (userId) {
        const { data: row } = await supabase
          .from('users')
          .select('is_admin')
          .eq('clerk_id', userId)
          .maybeSingle()
        isAdmin = !!row?.is_admin
      }
    } catch {
      // A beacon must never fail the page it is measuring. Unknown counts as
      // anonymous, which is the safer direction: it under-reports signed-in
      // traffic rather than inventing it.
    }

    const { data: inserted } = await supabase
      .from('page_views')
      .insert({
        path,
        referrer_host: referrerHost,
        is_admin: isAdmin,
        visitor_id: visitorId,
        // Only ever set from a real server-side session. This says "this
        // account did this"; it never claims to have worked out who an
        // anonymous visitor is.
        clerk_id: clerkId,
        // ── THE SERVER KNOWS, THE BROWSER GUESSES ────────────────────
        // This trusted body.authed, which the tracker computed as
        // `document.cookie.includes('__session')`. That produced 337 views
        // with is_authed true and NOT ONE anonymous view in the table —
        // including three views of /sign-in, which nobody already signed in
        // has any reason to load. A signed-out visitor was being counted as
        // a logged-in one every time, so the anonymous half of the traffic
        // report never existed.
        //
        // The browser cannot answer this. It can only see the cookies it is
        // allowed to see, on the host it happens to be on, and a stale one
        // looks exactly like a live session. This request carries the
        // session anyway, so auth() answers it properly — and cannot be
        // fooled by a client that simply says it is signed in.
        is_authed: isAuthed,
        visitor_hash: visitorHash,
        device: deviceFrom(ua),
        country,
        region,
        utm_source: utm('utm_source'),
        utm_medium: utm('utm_medium'),
        utm_campaign: utm('utm_campaign'),
      })
      .select('id')
      .single()

    // The id goes back so the exit beacon can find its own row. Returned as
    // JSON rather than 204 only on the insert path — the dwell path above stays
    // empty because nothing needs to come back from it.
    const res = NextResponse.json({ id: inserted?.id ?? null })

    // Only written when it is actually new, so a returning visitor's expiry is
    // not pushed forward on every single page load.
    if (isNewVisitor) {
      res.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: VISITOR_COOKIE_MAX_AGE,
      })
    }

    return res
  } catch {
    // Deliberately silent. A tally mark is not worth an error in anybody's
    // console, and certainly not worth a failed request on a marketing page.
    return new NextResponse(null, { status: 204 })
  }
}
