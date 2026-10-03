import { organizationSchema, softwareApplicationSchema } from '@/lib/schema'

type TenantBranding = {
  brand_name?: string | null
  slug?: string | null
  logo_url?: string | null
  custom_domain?: string | null
} | null | undefined

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'

/** A standalone schema object minus its @context, for use as an @graph node. */
function withoutContext<T extends Record<string, unknown>>(o: T): Omit<T, '@context'> {
  const node: Record<string, unknown> = { ...o }
  delete node['@context']
  return node as Omit<T, '@context'>
}

function tenantBaseUrl(b: NonNullable<TenantBranding>): string | null {
  if (b.custom_domain) return `https://${b.custom_domain}`
  const slug = (b.slug || '').toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(slug)) return null
  return `https://${slug}.${ROOT_DOMAIN}`
}

export default function StructuredData({ branding }: { branding?: TenantBranding } = {}) {
  const BASE = `https://${ROOT_DOMAIN}`

  
  if (branding && branding.brand_name) {
    const base = tenantBaseUrl(branding)
    if (base) {
      const brand = String(branding.brand_name)
      const logo = branding.logo_url || `${BASE}/icons/android-chrome-512x512.png`

      const tenantGraph = [
        {
          '@type': 'Organization',
          '@id': `${base}/#organization`,
          name: brand,
          url: base,
          logo: { '@type': 'ImageObject', url: logo },
          description: `${brand}, outbound calling platform powered by DialerSeat.`,
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${base}/#software`,
          name: brand,
          applicationCategory: 'BusinessApplication',
          applicationSubCategory: 'OutboundDialer',
          operatingSystem: 'Web, iOS, Android',
          url: base,
          description: `${brand} is a professional outbound dialer with predictive, progressive, power, and preview modes, automatic voicemail detection, inbound reception, and unlimited numbers.`,
          // ── SAME TWO OFFERS AS lib/schema.ts ────────────────────────
          // Both files emit a SoftwareApplication for the same product, so
          // both have to say the same thing. They disagreeing about price is
          // a crawler learning our pricing is uncertain — the exact failure
          // canonicalFacts exists to prevent, reproduced one layer up.
          offers: [
            {
            '@type': 'Offer',
            price: '35.00',
            priceCurrency: 'USD',
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: '35.00',
              priceCurrency: 'USD',
              unitText: 'per seat per week',
              billingDuration: 'P7D',
            },
            availability: 'https://schema.org/InStock',
            url: `${base}/sign-up`,
            },
          ],
          publisher: { '@id': `${base}/#organization` },
          
        },
        {
          '@type': 'WebSite',
          '@id': `${base}/#website`,
          url: base,
          name: brand,
          publisher: { '@id': `${base}/#organization` },
        },
      ]

      const tenantLd = { '@context': 'https://schema.org', '@graph': tenantGraph }

      return (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(tenantLd) }}
        />
      )
    }
    
  }

  
  const graph = [
    
    // ── ONE DESCRIPTION OF THE COMPANY AND THE PRODUCT ───────────────────
    // These two nodes used to be written out here by hand, and the same two
    // @ids were emitted again by lib/schema.ts on every /vs and /faq page, with
    // different descriptions, different sameAs lists and P7D against P1W. Two
    // nodes sharing an @id are merged by a parser, so a crawler was being handed
    // one entity with two conflicting accounts of itself. Both now come from
    // lib/schema.ts, so there is one account to merge.
    withoutContext(organizationSchema()),
    withoutContext(softwareApplicationSchema()),

    
    
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: BASE,
      name: 'DialerSeat',
      description: 'Dial smarter. Close faster. $35/week.',
      publisher: {
        '@id': `${BASE}/#organization`,
      },
      // No SearchAction: the site has no search at /?q=, and Google retired
      // the sitelinks search box that read it on 2024-11-21. WebSite stays,
      // because Google still reads its name for the site name above results.
    },

    
    
    
    // ── NO SITEWIDE FAQ ──────────────────────────────────────────────────
    // An FAQPage with eleven questions used to sit here, so every page on the
    // site, from /pricing to a country's calling rules, claimed to carry Q&As
    // it never showed. Google's structured-data rules require markup to match
    // the visible page, and FAQ rich results were retired in May 2026, so it
    // could only cost: some answers had also drifted from lib/competitors and
    // lib/canonicalFacts. Pages that show questions carry their own FAQPage.
  ]

  const ld = {
    '@context': 'https://schema.org',
    '@graph': graph,
  }

  return (
    <script
      type="application/ld+json"
      
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  )
}