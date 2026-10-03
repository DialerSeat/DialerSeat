import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { COMPETITORS, crossShoppedPairs, matchupSlug } from '@/lib/competitors'
import { pageDate } from '@/lib/pageDates'
import { VERTICALS } from '@/lib/verticals'
import { COUNTRY_RULES } from '@/lib/countryRules'
import { ENABLED_LOCALES, isLocalizablePath, localizedPath } from '@/lib/i18n/locales'

























export const dynamic = 'force-dynamic' // per-host, must not be statically cached
export const revalidate = 0

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const APEX = `https://${ROOT_DOMAIN}`


const RESERVED = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'static', 'cdn', 'assets',
  'mail', 'email', 'smtp', 'imap', 'pop', 'docs', 'blog', 'help',
  'support', 'status',
])

function extractTenantSlug(host: string): string | null {
  const h = (host || '').split(':')[0].toLowerCase()
  if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}` || h === 'localhost') return null
  if (!h.endsWith(`.${ROOT_DOMAIN}`)) return null
  const sub = h.slice(0, -1 - ROOT_DOMAIN.length)
  if (sub.includes('.')) return null
  if (RESERVED.has(sub)) return null
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(sub)) return null
  return sub
}


function apexSitemap(): MetadataRoute.Sitemap {
  // ── lastModified IS THE DAY THE PAGE CHANGED, NOT THE DAY OF THE REQUEST ──
  // It was `now` for every URL, so all of them claimed to change on every
  // fetch, and Google ignores lastmod on a site where it is not accurate.
  // lib/pageDates.ts holds the real dates, read from git by
  // scripts/gen-page-dates.mjs.
  const e = (
    path: string,
    priority: number,
    changeFrequency: 'weekly' | 'monthly' | 'yearly',
  ) => ({ url: `${APEX}${path}`, lastModified: pageDate(path), changeFrequency, priority })

  return [
    e('/', 1.0, 'weekly'),
    e('/pricing', 0.95, 'monthly'),
    e('/features', 0.9, 'monthly'),

    // Data, tools and the hub that lists them: the pages built to be cited.
    e('/resources', 0.85, 'monthly'),
    e('/data/dialer-pricing', 0.9, 'monthly'),
    e('/data/calling-rules-by-country', 0.9, 'monthly'),
    ...COUNTRY_RULES.map(c => e(`/data/calling-rules-by-country/${c.code.toLowerCase()}`, 0.75, 'monthly')),
    e('/about', 0.6, 'monthly'),
    e('/tools/dialer-cost-calculator', 0.85, 'monthly'),
    e('/tools/abandon-rate-calculator', 0.8, 'monthly'),
    
    e('/dialing-modes', 0.9, 'monthly'),
    e('/dialing-modes/preview', 0.8, 'monthly'),
    e('/dialing-modes/power', 0.8, 'monthly'),
    e('/dialing-modes/progressive', 0.8, 'monthly'),
    e('/dialing-modes/predictive', 0.8, 'monthly'),
    
    e('/vs', 0.9, 'monthly'),
    e('/vs/everyone', 0.9, 'monthly'),

    // ── COMPETITOR PAGES, FROM THE REGISTRY ─────────────────────────────
    // These were hand-listed, and the list had gone stale exactly the way
    // hand-maintained lists do: five of the sixteen published competitor pages
    // were in here. The other eleven existed, rendered, and were absent from
    // the sitemap — pages doing no work at all.
    //
    // The head-to-head block below was already generated from the registry for
    // this reason. The individual pages now are too, so adding a competitor
    // cannot silently produce an unindexed page.
    //
    // hookedcrm used to be hand-listed here on the grounds that it "has a page
    // but is not in the registry". It has neither. There is no page.tsx under
    // app/vs/hookedcrm — only an orphaned view.tsx nothing imports — so the
    // route 404s, and the sitemap was submitting it to crawlers at priority
    // 0.8. That is the exact failure the paragraph above describes, arriving
    // from the other direction: the generated list cannot go stale, and the
    // one entry kept out of it did.
    //
    // If the page comes back, it comes back through COMPETITORS like every
    // other one, and the sitemap picks it up with no edit here.
    ...COMPETITORS.map(c => e(`/vs/${c.slug}`, 0.8, 'monthly')),
    // Not a competitor, so not in the registry: its opponent is a phone and a
    // spreadsheet. Listed by hand for that reason alone.
    e('/vs/manual-dialing', 0.8, 'monthly'),

    e('/faq', 0.8, 'monthly'),
    e('/faq/why-dialerseat', 0.85, 'monthly'),
    e('/faq/dialer-modes', 0.75, 'monthly'),
    // The four /faq/what-is-a-*-dialer pages are left out: each declares its
    // /dialing-modes twin as canonical, and a sitemap should list only
    // canonical URLs. They still render and still pass links.
    e('/faq/what-is-an-auto-dialer', 0.9, 'monthly'),
    e('/faq/why-is-compliance-important', 0.8, 'monthly'),
    e('/faq/how-we-keep-compliance', 0.85, 'monthly'),
    e('/faq/how-does-amd-work', 0.7, 'monthly'),
    e('/faq/why-we-charge', 0.8, 'monthly'),
    e('/faq/dialerseat-teams', 0.8, 'monthly'),
    e('/faq/manager-plus', 0.8, 'monthly'),
    e('/faq/white-label-mobile', 0.7, 'monthly'),
    e('/faq/mobile', 0.75, 'monthly'),
    e('/faq/numbers', 0.75, 'monthly'),
    e('/faq/leads', 0.75, 'monthly'),
    e('/faq/scripts', 0.7, 'monthly'),
    e('/faq/campaigns', 0.75, 'monthly'),
    e('/faq/compliance-export', 0.75, 'monthly'),
    e('/faq/billing', 0.75, 'monthly'),
    e('/faq/data-and-recordings', 0.7, 'monthly'),
    e('/faq/calling-hours', 0.85, 'monthly'),
    e('/faq/10dlc-and-outbound-calling', 0.75, 'monthly'),
    e('/faq/how-many-numbers-do-i-need', 0.75, 'monthly'),
    // Spam-free numbers. The Spam Likely page is weighted highest of the three
    // because it answers the question people actually search; the other two
    // explain what we do about it once they are here.
    e('/faq/why-calls-show-spam-likely', 0.85, 'monthly'),
    e('/faq/how-we-keep-numbers-clean', 0.8, 'monthly'),
    e('/faq/why-we-dont-rest-flagged-numbers', 0.75, 'monthly'),


    // Compliance questions people search before they search for a product.
    // "is a predictive dialer legal" is the highest-intent question in the
    // category: nobody asks it who is not about to buy one.
    e('/faq/is-a-predictive-dialer-legal', 0.85, 'monthly'),
    e('/faq/how-to-scrub-the-do-not-call-registry', 0.8, 'monthly'),

    e('/faq/local-presence-dialing', 0.8, 'monthly'),
    e('/faq/send-leads-from-your-crm', 0.8, 'monthly'),
    e('/faq/how-we-measure-answer-rate', 0.7, 'monthly'),
    e('/faq/dialer-glossary', 0.7, 'monthly'),
    e('/faq/dialer-for-insurance-agents', 0.85, 'monthly'),
    e('/faq/dialer-for-real-estate', 0.85, 'monthly'),
    e('/faq/dialer-for-call-centers', 0.85, 'monthly'),
    // One page per industry, generated from lib/verticals so a new trade
    // cannot ship unindexed.
    ...VERTICALS.map(v => e(`/faq/dialer-for-${v.slug}`, 0.8, 'monthly')),
    e('/faq/managers', 0.7, 'monthly'),
    e('/faq/white-label', 0.7, 'monthly'),
    
    // Head-to-head pages, generated from the same registry the pages render
    // from — a hand-maintained list here would go stale the first time a
    // competitor is added and the new pages would sit unindexed.
    ...crossShoppedPairs().map(([a, b]) =>
      e(`/vs/${matchupSlug(a, b)}`, 0.7, 'monthly')),

    // Teams is the highest-intent cluster on the site — a manager comparing
    // seat economics is closer to buying than anyone reading a feature page.
    e('/vs/teams', 0.9, 'monthly'),
    e('/faq/teams-how-it-works', 0.85, 'monthly'),
    e('/faq/dialer-for-offshore-agents', 0.85, 'monthly'),

    e('/status', 0.5, 'weekly'),
    e('/data/connect-rates', 0.7, 'weekly'),

    e('/terms', 0.3, 'yearly'),
    e('/privacy', 0.3, 'yearly'),
    e('/sign-up', 0.5, 'yearly'),
  ]
}


function subdomainSitemap(slug: string, now: Date): MetadataRoute.Sitemap {
  const base = `https://${slug}.${ROOT_DOMAIN}`
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/sign-in`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/sign-up`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const h = await headers()
  const host = h.get('host') || ROOT_DOMAIN
  const slug = extractTenantSlug(host)

  
  return slug ? subdomainSitemap(slug, now) : withLanguages(apexSitemap())
}

// ── LANGUAGE VERSIONS ────────────────────────────────────────────────
// Once a second language is live, every public page is listed with its
// hreflang alternates, and each language address is listed as a page of its
// own, so crawlers find /es/faq as readily as /faq. With English alone this
// returns the list unchanged.
function withLanguages(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  if (ENABLED_LOCALES.length < 2) return entries
  const out: MetadataRoute.Sitemap = []
  for (const entry of entries) {
    const path = entry.url.startsWith(APEX) ? entry.url.slice(APEX.length) || '/' : null
    if (!path) { out.push(entry); continue }
    if (!isLocalizablePath(path)) { out.push(entry); continue }
    const languages: Record<string, string> = {}
    for (const l of ENABLED_LOCALES) languages[l] = `${APEX}${localizedPath(l, path)}`
    out.push({ ...entry, alternates: { languages } })
    for (const l of ENABLED_LOCALES) {
      if (l === 'en') continue
      out.push({ ...entry, url: `${APEX}${localizedPath(l, path)}`, alternates: { languages } })
    }
  }
  return out
}