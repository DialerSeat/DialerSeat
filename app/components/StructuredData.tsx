/**
 * JSON-LD structured data for DialerSeat — HOST-AWARE (v2).
 *
 * Two modes:
 *   • APEX / default (no branding prop): the full @graph — Organization,
 *     SoftwareApplication, WebSite (+sitelinks search), and the big FAQPage.
 *     This is the canonical entity data Google/Bing/AI ground on. Unchanged
 *     from v1 except for being gated behind the "no branding" case.
 *
 *   • TENANT subdomain (branding prop provided): a LEAN, tenant-specific graph —
 *     that brand's Organization + a SoftwareApplication scoped to its own
 *     subdomain URL. We intentionally OMIT the FAQPage here: those FAQs are
 *     DialerSeat-specific and repeating them on every white-label subdomain
 *     would be duplicate structured data. Each tenant's schema self-references
 *     its own host so Google treats it as a distinct brand entity (which also
 *     reinforces the per-subdomain self-canonical strategy).
 *
 * USAGE (in app/layout.tsx):
 *   Render ALWAYS, passing the resolved branding (null on apex):
 *       <StructuredData branding={branding} />
 *   (Previously this was `{!branding && <StructuredData />}` — apex only.
 *    Switch to always-render so subdomains get their own tenant schema.)
 *
 * The branding prop is read defensively (optional chaining) so it tolerates
 * whatever shape getTenantBranding/getActiveTenantForUser returns, as long as
 * it carries a brand_name and slug (and optionally logo_url).
 *
 * Validate changes at https://search.google.com/test/rich-results
 */

type TenantBranding = {
  brand_name?: string | null
  slug?: string | null
  logo_url?: string | null
  custom_domain?: string | null
} | null | undefined

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'

function tenantBaseUrl(b: NonNullable<TenantBranding>): string | null {
  if (b.custom_domain) return `https://${b.custom_domain}`
  const slug = (b.slug || '').toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(slug)) return null
  return `https://${slug}.${ROOT_DOMAIN}`
}

export default function StructuredData({ branding }: { branding?: TenantBranding } = {}) {
  const BASE = `https://${ROOT_DOMAIN}`

  // ── TENANT MODE: lean, brand-specific graph on the subdomain ──────────────
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
          description: `${brand} — outbound calling platform powered by DialerSeat.`,
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
          offers: {
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
          publisher: { '@id': `${base}/#organization` },
          // aggregateRating intentionally omitted (no faked ratings).
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
    // If we couldn't derive a clean base URL, fall through to apex schema.
  }

  // ── APEX / DEFAULT MODE: the full canonical graph (unchanged) ─────────────
  const graph = [
    // ─── Organization ──────────────────────────────────────────────
    {
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: 'DialerSeat',
      // Explicit one-word entity declaration. Listing the brand string as an
      // alternateName (and keeping it identical to `name`) is a direct signal to
      // Google that "DialerSeat" is a proper noun / single token — which is what
      // erodes the "did you mean: dialer seat" spelling correction over time.
      alternateName: 'DialerSeat',
      url: BASE,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE}/icons/android-chrome-512x512.png`,
        width: 512,
        height: 512,
      },
      description:
        'Professional outbound dialer SaaS for solo agents up through larger teams. $35/week per seat. No contracts. Cancel anytime.',
      foundingDate: '2025',
      sameAs: [
        // ENTITY GRAPH: add each real profile URL here as you create it. Every
        // URL declares "this is the same DialerSeat entity," which strengthens
        // Knowledge-Graph recognition and further kills the spelling correction.
        // Fill these in (see footprint-claim-list.md) and redeploy:
        // 'https://www.linkedin.com/company/dialerseat',
        // 'https://www.crunchbase.com/organization/dialerseat',
        // 'https://www.wikidata.org/wiki/QXXXXXXX',
        // 'https://twitter.com/dialerseat',
        // 'https://www.youtube.com/@dialerseat',
        // 'https://www.facebook.com/dialerseat',
        // 'https://www.g2.com/products/dialerseat',
        // 'https://www.trustpilot.com/review/dialerseat.com',
      ],
    },

    // ─── SoftwareApplication ───────────────────────────────────────
    // This is what makes you eligible for the price badge and the
    // "App" rich result in Google SERPs.
    {
      '@type': 'SoftwareApplication',
      '@id': `${BASE}/#software`,
      name: 'DialerSeat',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'OutboundDialer',
      operatingSystem: 'Web, iOS, Android',
      url: BASE,
      description:
        'Browser-based outbound dialer with predictive, progressive, power, and preview modes; automatic voicemail detection; inbound call reception; unlimited numbers; team workflow; TCPA compliance. Built for solo agents up through larger teams.',
      offers: {
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
        url: `${BASE}/sign-up`,
      },
      featureList: [
        'Predictive dialing',
        'Progressive dialing',
        'Power dialing',
        'Preview dialing',
        'Automatic voicemail detection',
        'Inbound call reception',
        'Unlimited phone numbers',
        'Unlimited campaigns',
        'Unlimited lead uploads',
        'Multi-script support',
        'Team workflow with per-seat billing',
        'TCPA calling-window enforcement',
        'State-specific compliance rules',
        'FCC abandon-rate enforcement',
        'Call recording',
        'Deep analytics and reporting',
        'Mobile and desktop support',
        'Global dialing',
        'No contracts',
        'Cancel anytime',
      ],
      publisher: {
        '@id': `${BASE}/#organization`,
      },
      // aggregateRating intentionally omitted until you have real
      // reviews from a verified source. Faked ratings are a manual-
      // action risk in Google Search Console.
    },

    // ─── WebSite + SiteLinks Search ────────────────────────────────
    // Lets Google show a search box directly under your SERP listing.
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: BASE,
      name: 'DialerSeat',
      description: 'Dial smarter. Close faster. $35/week.',
      publisher: {
        '@id': `${BASE}/#organization`,
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },

    // ─── FAQPage ────────────────────────────────────────────────────
    // Google may render these as expand-collapse accordions directly
    // in the SERP. High-CTR feature when granted.
    {
      '@type': 'FAQPage',
      '@id': `${BASE}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How much does DialerSeat cost?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'DialerSeat is $35 USD per seat per week, billed every 7 days. There are no contracts, no setup fees, no per-minute charges, and no annual commitments. Cancel any time.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does DialerSeat compare to ReadyMode?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'ReadyMode charges $199 or more per seat per month and typically requires an annual contract and onboarding. DialerSeat is $35 per week with no contract and no onboarding call. DialerSeat also works on mobile (iOS Safari and Android Chrome), includes unlimited phone numbers, deeper analytics, and simple team management at the same flat price.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does DialerSeat compare to Mojo Dialer and PhoneBurner?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Mojo Dialer\'s lower tiers exclude predictive dialing. PhoneBurner is power-dial only on most tiers. DialerSeat includes all four dialer modes (Preview, Power, Progressive, Predictive) at $35 per week, plus unlimited numbers, team workflow, and compliance enforcement bundled into the same price.',
          },
        },
        {
          '@type': 'Question',
          name: 'What dialer modes does DialerSeat support?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'DialerSeat supports four selectable dialer modes per campaign: Preview (review lead before dialing), Power (one-click manual dial), Progressive (auto-advance one line per agent), and Predictive (multi-line simultaneous dialing with FCC abandon-rate enforcement).',
          },
        },
        {
          '@type': 'Question',
          name: 'Does DialerSeat detect voicemail automatically?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. DialerSeat uses SignalWire\'s answering machine detection (AMD) engine to analyze call audio at pickup and classify whether a human, voicemail, fax, or machine answered. When a non-human answer is detected, the call is hung up before the agent is connected, and the recording is automatically deleted on both the local database and the SignalWire side.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does DialerSeat support inbound calls?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Inbound calls from ad campaigns, mailers, billboards, or website CTAs route to whichever DialerSeat agent is marked live and online, through the same dialer interface used for outbound calls.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does DialerSeat work on mobile?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. DialerSeat works in iOS Safari, Android Chrome, and every modern desktop browser. No headset software, no native app install, no PBX hardware. Just sign in and dial.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does DialerSeat sell customer data?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. DialerSeat does not sell, broker, lease, or share customer data, lead lists, or call recordings with any third party. Customer data is never used to train AI models.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I cancel any time?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Cancel from Settings at any time. The subscription does not auto-renew once canceled. Service continues until the end of the paid 7-day period. Lead data, recordings, and account history are retained.',
          },
        },
        {
          '@type': 'Question',
          name: 'What happens to my data if my subscription lapses?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Your account remains accessible in read-only mode. Leads, recordings, campaigns, and history are retained indefinitely. Dialing is paused until you resubscribe, at which point everything resumes immediately with no data loss.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does DialerSeat work for solo agents or only teams?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Both. DialerSeat is built to serve the full range from solo agents up through larger teams. The same $35/week price applies per seat, whether you\'re one person or fifty.',
          },
        },
      ],
    },
  ]

  const ld = {
    '@context': 'https://schema.org',
    '@graph': graph,
  }

  return (
    <script
      type="application/ld+json"
      // Server-rendered, deterministic. Safe.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
    />
  )
}