import type { MetadataRoute } from 'next'

const BASE_URL = 'https://dialerseat.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/billing',
          '/onboarding',
          '/api/',
          '/sign-in',
          '/sign-up',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}