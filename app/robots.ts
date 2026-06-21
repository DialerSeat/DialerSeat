import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

// =============================================================================
// app/robots.ts — HOST-AWARE robots (v2)
// =============================================================================
// Same careful bot allow/deny policy as before, but now host-aware so each
// hostname advertises ITS OWN sitemap + the master sitemap index:
//   - dialerseat.com/robots.txt        → sitemap: dialerseat.com/sitemap.xml
//                                         sitemap: dialerseat.com/sitemap-index.xml
//   - water.dialerseat.com/robots.txt   → sitemap: water.dialerseat.com/sitemap.xml
//
// The OLD version hardcoded https://dialerseat.com as host + sitemap, so every
// subdomain's robots pointed crawlers back at the apex and never advertised the
// subdomain's own sitemap. Now each host self-references.
// =============================================================================

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'

const IS_PRODUCTION =
  process.env.VERCEL_ENV === 'production' ||
  (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV)

// Bots we explicitly invite. Each gets its own rule block so we read as a
// positive signal (some bots only honor explicit naming).
const SEARCH_BOTS = [
  'Googlebot',
  'Googlebot-Image',
  'Bingbot',
  'DuckDuckBot',
  'Slurp', // Yahoo
  'Yandex',
  'Baiduspider',
]

const AI_BOTS = [
  // OpenAI
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  // Anthropic
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  // Perplexity
  'PerplexityBot',
  'Perplexity-User',
  // Google AI (Gemini training + retrieval)
  'Google-Extended',
  'GoogleOther',
  // Apple Intelligence
  'Applebot',
  'Applebot-Extended',
  // Other major
  'Bytespider', // ByteDance / TikTok
  'Meta-ExternalAgent',
  'FacebookBot',
  'cohere-ai',
  'Diffbot',
  'YouBot',
  'Amazonbot',
  'MistralAI-User',
]

// Authed routes — never indexed.
const DISALLOW_PRIVATE = [
  '/api/',
  '/dashboard/',
  '/billing/',
  '/onboarding/',
  '/welcome', // post-signup showcase — not a public landing page
  '/sign-in/',
  '/sign-up/',
  // Icon / asset ROUTES that Next generates and Google can mistakenly index as
  // pages (this is why "dialerseat.com/apple-icon" showed up as a search
  // result). These are images, not pages — keep them out of the index.
  '/apple-icon',
  '/apple-icon/',
  '/icon',
  '/icon/',
  '/opengraph-image',
  '/twitter-image',
  '/manifest.webmanifest',
]

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

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const host = (h.get('host') || ROOT_DOMAIN).split(':')[0].toLowerCase()
  const slug = extractTenantSlug(host)
  const base = `https://${host}`
  const apex = `https://${ROOT_DOMAIN}`

  // Non-production (Vercel previews, local dev): block everything.
  if (!IS_PRODUCTION) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      host: base,
    }
  }

  // Each host advertises its OWN sitemap. The apex additionally advertises the
  // master sitemap index so crawlers discover every subdomain from one file.
  const sitemap = slug
    ? [`${base}/sitemap.xml`]
    : [`${apex}/sitemap.xml`, `${apex}/sitemap-index.xml`]

  return {
    rules: [
      // Explicit allow for every named search engine + AI crawler.
      ...SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
      // Block Common Crawl — the dataset most rogue training scrapers pull
      // from. Blocking CCBot is the biggest opt-out signal you can send without
      // blocking the AI assistants themselves.
      { userAgent: 'CCBot', disallow: '/' },
      // Default catch-all.
      { userAgent: '*', allow: '/', disallow: DISALLOW_PRIVATE },
    ],
    sitemap,
    host: base,
  }
}