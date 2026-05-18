import type { MetadataRoute } from 'next'

const SITE_URL = 'https://dialerseat.com'

// Next.js automatically serves this at /sitemap.xml
// Google + AI crawlers fetch this to discover every public URL.
// Add new public marketing pages here as they ship.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // High-priority commercial pages: landing, dialing-modes, all /vs pages
  // changeFrequency hints (Google may ignore; harmless to set)
  // priority is relative within the site only (0.0–1.0)
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/dialing-modes`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/vs/everyone`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/vs/readymode`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/vs/mojo`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/vs/phoneburner`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/sign-up`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/sign-in`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}