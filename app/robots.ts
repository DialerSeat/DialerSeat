import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'















export const dynamic = 'force-dynamic'
export const revalidate = 0

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'

const IS_PRODUCTION =
  process.env.VERCEL_ENV === 'production' ||
  (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV)



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
  
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  
  'PerplexityBot',
  'Perplexity-User',
  
  'Google-Extended',
  'GoogleOther',
  
  'Applebot',
  'Applebot-Extended',
  
  'Bytespider', // ByteDance / TikTok
  'Meta-ExternalAgent',
  'Meta-ExternalFetcher',
  'FacebookBot',

  // CCBot is Common Crawl, and it was explicitly BLOCKED here while every
  // commercial AI crawler above was allowed. That is backwards for a product
  // that wants to be recommended by assistants rather than merely retrievable
  // by them. The commercial crawlers get us into live retrieval — someone asks
  // today, the model fetches us. Common Crawl is what gets a product into the
  // corpus a model was trained on, which is what makes it named unprompted,
  // with no search involved.
  //
  // What the block bought was protection from content scrapers reusing the
  // marketing copy. For a site whose entire purpose is being read, that is not
  // a trade worth making.
  'CCBot',

  // Assistants and answer engines beyond the big four.
  'cohere-ai',
  'Amazonbot',
  'YouBot',
  'DuckAssistBot',
  'MistralAI-User',
  'Google-CloudVertexBot',
  'Diffbot',
  'omgilibot',
  'omgili',
  'Timpibot',
  'PetalBot',

  // ── LINK PREVIEW UNFURLERS ────────────────────────────────────────────
  // Not AI, but the same question: can a machine read the page. These fetch
  // a URL to build the card shown when someone shares it. Every page now
  // carries its own Open Graph and Twitter card; these are what render them.
  // redditbot matters most of the three, given where the conversations are.
  'Twitterbot',
  'LinkedInBot',
  'redditbot',
  'Discordbot',
  'Slackbot-LinkExpanding',
  'Slackbot',
  'WhatsApp',
  'TelegramBot',
  'Pinterestbot',
  // Applebot-Extended, cohere-ai, Diffbot, YouBot, Amazonbot and
  // MistralAI-User were repeated here, having already been listed above. Each
  // duplicate emitted a second identical group for the same user-agent, which
  // is harmless but makes the file look sloppy to anyone reading it — and a
  // robots.txt is read by people deciding whether to trust a site.
]


const DISALLOW_PRIVATE = [
  '/api/',
  '/dashboard/',
  '/billing/',
  '/onboarding/',
  '/welcome', // post-signup showcase — not a public landing page
  '/sign-in/',
  '/sign-up/',
  
  
  
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

  
  if (!IS_PRODUCTION) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      host: base,
    }
  }

  
  
  const sitemap = slug
    ? [`${base}/sitemap.xml`]
    : [`${apex}/sitemap.xml`, `${apex}/sitemap-index.xml`]

  return {
    rules: [
      // ── EVERY NAMED GROUP CARRIES THE DISALLOW LIST ─────────────────────
      // These used to be `allow: '/'` and nothing else, which quietly undid
      // DISALLOW_PRIVATE for exactly the crawlers it mattered for.
      //
      // A robots.txt group is not additive. A bot that finds a group matching
      // its own name obeys THAT GROUP ONLY and ignores the `*` group
      // completely. So Googlebot, Bingbot, GPTBot, ClaudeBot and the rest were
      // each reading a group that said "allow everything" with no exclusions,
      // and the private list below was protecting only the anonymous crawlers
      // nobody was worried about.
      //
      // The named groups exist to be explicit about who is welcome, not to
      // hand them the dashboard, the API and the sign-in pages.
      ...SEARCH_BOTS.map((userAgent) => ({
        userAgent, allow: '/', disallow: DISALLOW_PRIVATE,
      })),
      ...AI_BOTS.map((userAgent) => ({
        userAgent, allow: '/', disallow: DISALLOW_PRIVATE,
      })),

      { userAgent: '*', allow: '/', disallow: DISALLOW_PRIVATE },
    ],
    sitemap,
    host: base,
  }
}