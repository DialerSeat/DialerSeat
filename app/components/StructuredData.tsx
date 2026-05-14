/**
 * JSON-LD structured data for DialerSeat.
 *
 * Renders a single <script type="application/ld+json"> with a @graph
 * containing Organization, SoftwareApplication, WebSite, and FAQPage
 * schemas. Google, Bing, and most AI crawlers consume this for rich
 * snippets, entity recognition, and citation grounding.
 *
 * To add a new schema: append an object to the `graph` array below.
 * Validate any changes at https://search.google.com/test/rich-results
 */
export default function StructuredData() {
  const BASE = 'https://dialerseat.com'

  const graph = [
    // ─── Organization ──────────────────────────────────────────────
    {
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: 'DialerSeat',
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
        // Add social profiles here as you create them:
        // 'https://twitter.com/dialerseat',
        // 'https://linkedin.com/company/dialerseat',
        // 'https://www.facebook.com/dialerseat',
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