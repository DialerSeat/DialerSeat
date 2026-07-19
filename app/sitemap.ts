import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

























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


function apexSitemap(now: Date): MetadataRoute.Sitemap {
  const e = (
    path: string,
    priority: number,
    changeFrequency: 'weekly' | 'monthly' | 'yearly',
  ) => ({ url: `${APEX}${path}`, lastModified: now, changeFrequency, priority })

  return [
    e('/', 1.0, 'weekly'),
    
    e('/dialing-modes', 0.9, 'monthly'),
    e('/dialing-modes/preview', 0.8, 'monthly'),
    e('/dialing-modes/power', 0.8, 'monthly'),
    e('/dialing-modes/progressive', 0.8, 'monthly'),
    e('/dialing-modes/predictive', 0.8, 'monthly'),
    
    e('/vs', 0.9, 'monthly'),
    e('/vs/everyone', 0.9, 'monthly'),
    e('/vs/readymode', 0.8, 'monthly'),
    e('/vs/mojo', 0.8, 'monthly'),
    e('/vs/phoneburner', 0.8, 'monthly'),
    e('/vs/five9', 0.8, 'monthly'),
    e('/vs/wavv', 0.8, 'monthly'),
    e('/vs/3cx', 0.8, 'monthly'),
    e('/vs/hookedcrm', 0.8, 'monthly'),
    e('/vs/convoso', 0.8, 'monthly'),
    e('/vs/kixie', 0.8, 'monthly'),
    e('/vs/justcall', 0.8, 'monthly'),
    e('/vs/cloudtalk', 0.8, 'monthly'),
    e('/vs/aircall', 0.8, 'monthly'),
    e('/vs/dialpad', 0.8, 'monthly'),
    
    e('/faq', 0.8, 'monthly'),
    e('/faq/why-dialerseat', 0.85, 'monthly'),
    e('/faq/what-is-a-preview-dialer', 0.7, 'monthly'),
    e('/faq/what-is-a-power-dialer', 0.7, 'monthly'),
    e('/faq/what-is-a-progressive-dialer', 0.7, 'monthly'),
    e('/faq/what-is-a-predictive-dialer', 0.7, 'monthly'),
    e('/faq/why-is-compliance-important', 0.8, 'monthly'),
    e('/faq/how-we-keep-compliance', 0.85, 'monthly'),
    e('/faq/how-does-amd-work', 0.7, 'monthly'),
    
    e('/managers', 0.7, 'monthly'),
    e('/white-label', 0.7, 'monthly'),
    
    e('/terms', 0.3, 'yearly'),
    e('/privacy', 0.3, 'yearly'),
    e('/sign-up', 0.5, 'yearly'),
    e('/sign-in', 0.3, 'yearly'),
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

  
  return slug ? subdomainSitemap(slug, now) : apexSitemap(now)
}