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
      priority: 0.8,
    },
    // Future: /terms, /privacy, /vs/readymode, /pricing
    // {
    //   url: `${BASE}/terms`,
    //   lastModified: now,
    //   changeFrequency: 'yearly',
    //   priority: 0.4,
    // },
  ]
}