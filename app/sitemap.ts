import type { MetadataRoute } from 'next'

const BASE = 'https://dialerseat.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE}/dialing-modes`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Hash-anchored landing sections — Google surfaces these as
    // direct-jump SERP sub-links ("Jump to Pricing →")
    {
      url: `${BASE}/#features`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE}/#pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE}/#compare`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Future: /privacy, /vs/readymode, /vs/mojo, /vs/phoneburner
  ]
}