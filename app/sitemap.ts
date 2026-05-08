import type { MetadataRoute } from 'next'

const BASE_URL = 'https://dialerseat.com'

/**
 * Sitemap for Google Search Console.
 * Only includes public, indexable routes — no /dashboard/*, /billing,
 * /onboarding, or auth pages, since those require login and shouldn't
 * appear in search results.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Add these as you build them out:
    // {
    //   url: `${BASE_URL}/terms`,
    //   lastModified,
    //   changeFrequency: 'yearly',
    //   priority: 0.3,
    // },
    // {
    //   url: `${BASE_URL}/privacy`,
    //   lastModified,
    //   changeFrequency: 'yearly',
    //   priority: 0.3,
    // },
    // {
    //   url: `${BASE_URL}/vs/readymode`,
    //   lastModified,
    //   changeFrequency: 'monthly',
    //   priority: 0.7,
    // },
  ]
}