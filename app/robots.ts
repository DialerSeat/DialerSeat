import type { MetadataRoute } from 'next'

const BASE = 'https://dialerseat.com'

// Vercel previews shouldn't be indexed.
const IS_PRODUCTION =
  process.env.VERCEL_ENV === 'production' ||
  process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV

// Bots we explicitly invite. Each gets its own rule block so we read
// as a positive signal (some bots only honor explicit naming).
const SEARCH_BOTS = [
  'Googlebot',
  'Googlebot-Image',
  'Bingbot',
  'DuckDuckBot',
  'Slurp',          // Yahoo
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
  'Bytespider',           // ByteDance / TikTok
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
  '/sign-in/',
  '/sign-up/',
]

export default function robots(): MetadataRoute.Robots {
  // Non-production environments (Vercel previews, local dev): block all.
  if (!IS_PRODUCTION) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      host: BASE,
    }
  }

  return {
    rules: [
      // Explicit allow for every named search engine + AI crawler.
      ...SEARCH_BOTS.map(userAgent => ({
        userAgent,
        allow: '/',
      })),
      ...AI_BOTS.map(userAgent => ({
        userAgent,
        allow: '/',
      })),
      // Block Common Crawl. They're the dataset most rogue training
      // scrapers pull from, and blocking CCBot is the biggest opt-out
      // signal you can send without blocking the AI assistants
      // themselves.
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      // Default catch-all.
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW_PRIVATE,
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}