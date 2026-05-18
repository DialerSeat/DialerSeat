import type { MetadataRoute } from 'next'

const SITE_URL = 'https://dialerseat.com'

// Next.js auto-serves this at /robots.txt
// Allow Google, AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)
// Block aggressive SEO scrapers that don't add value (Semrush, Ahrefs, etc.)
// Sitemap reference helps crawlers discover every public URL.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: allow all crawlers, but lock down auth + API + admin paths
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/sign-in/',
          '/sign-up/',
          '/sso-callback',
        ],
      },
      // Explicitly welcome major AI crawlers (already allowed by default, but
      // some bots check for a specific user-agent block before crawling)
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      { userAgent: 'PerplexityBot', allow: '/' },
      { userAgent: 'Google-Extended', allow: '/' },
      { userAgent: 'CCBot', allow: '/' },
      { userAgent: 'Applebot-Extended', allow: '/' },
      // Block aggressive SEO scrapers — they extract competitor intel without
      // ever sending traffic back. No upside to letting them crawl.
      { userAgent: 'SemrushBot', disallow: '/' },
      { userAgent: 'AhrefsBot', disallow: '/' },
      { userAgent: 'MJ12bot', disallow: '/' },
      { userAgent: 'DotBot', disallow: '/' },
      { userAgent: 'PetalBot', disallow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}