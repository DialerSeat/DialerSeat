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
    // Dialing modes hub — methodology + compliance + cross-links into deep dives
    {
      url: `${SITE_URL}/dialing-modes`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Per-mode deep-dive pages — history, mechanics, use cases
    {
      url: `${SITE_URL}/dialing-modes/preview`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/dialing-modes/power`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/dialing-modes/progressive`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/dialing-modes/predictive`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // /vs index — landing page that links to every competitor comparison
    {
      url: `${SITE_URL}/vs`,
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
    // FAQ index — now has real content (was placeholder)
    {
      url: `${SITE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Why DialerSeat? — founder-voice deep dive linked from /faq
    {
      url: `${SITE_URL}/faq/why-dialerseat`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    // /faq/* explainer pages — plain-English answers to common queries
    {
      url: `${SITE_URL}/faq/what-is-a-preview-dialer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/faq/what-is-a-power-dialer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/faq/what-is-a-progressive-dialer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/faq/what-is-a-predictive-dialer`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/faq/why-is-compliance-important`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/faq/how-we-keep-compliance`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/faq/how-does-amd-work`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
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