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
  'FacebookBot',
  'cohere-ai',
  'Diffbot',
  'YouBot',
  'Amazonbot',
  'MistralAI-User',
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
      
      ...SEARCH_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
      
      
      
      { userAgent: 'CCBot', disallow: '/' },
      
      { userAgent: '*', allow: '/', disallow: DISALLOW_PRIVATE },
    ],
    sitemap,
    host: base,
  }
}