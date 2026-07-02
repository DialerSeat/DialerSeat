const SITE_URL = 'https://dialerseat.com'



export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'DialerSeat',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      'The modern dialer for sales teams and solo agents. Multi-line predictive dialing with per-campaign mode configuration, multiple scripts per campaign, server-side TCPA enforcement, and full STIR/SHAKEN compliance at flat $35/week per seat. No annual contracts.',
    foundingDate: '2025',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'hello@dialerseat.com',
      availableLanguage: ['English'],
    },
  }
}




export function softwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#software`,
    name: 'DialerSeat',
    description:
      'Multi-line predictive dialer for sales teams and solo agents. Per-campaign dialer mode, multiple scripts with live mid-call switching, server-side TCPA compliance, full STIR/SHAKEN A-attestation, and a public API that works with any CRM. Works on phone, tablet, and desktop. $35/week per seat with no annual contract.',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Sales Dialer',
    operatingSystem: 'Web (works on iOS, Android, macOS, Windows via browser or installable PWA)',
    url: SITE_URL,
    softwareVersion: '1.0',
    offers: {
      '@type': 'Offer',
      price: '35.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: `${SITE_URL}/sign-up`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '35.00',
        priceCurrency: 'USD',
        billingDuration: 'P1W',
        unitText: 'per seat per week',
      },
    },
    featureList: [
      'Multi-line predictive dialer',
      'Preview, Power, Progressive, and Predictive dialer modes',
      'Per-campaign dialer mode configuration',
      'AMD voicemail detection drops in 1.8 seconds',
      'Multiple scripts per campaign with live mid-call switching',
      'Public API and webhooks (works with any CRM)',
      'Inbound team numbers',
      'TCPA windows enforced server-side per lead state',
      'STIR/SHAKEN A-attestation',
      'All outbound numbers carrier-registered (CNAM, FCR)',
      'Local presence dialing',
      'Calendar-aligned analytics (Sunday + 1st-of-month resets)',
      'Lapsed-user data preservation',
      'Installable as Progressive Web App on phones, tablets, and desktops',
      'Flat $35/week per seat — no annual contract, no setup fee',
    ],
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
  }
}



export function faqPageSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}



export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  }
}



export const DIALING_MODES_FAQS = [
  {
    question: 'What is preview dialing?',
    answer:
      "Preview dialing lets the agent review a lead's information before clicking to dial. The agent controls the pace. Best for high-value leads, appointment setting, or any outreach where context matters before the call.",
  },
  {
    question: 'What is power dialing?',
    answer:
      'Power dialing is click-to-dial — one call at a time, with the system automatically advancing to the next lead after disposition. Faster than manual dialing. The agent still handles every voicemail.',
  },
  {
    question: 'What is progressive dialing?',
    answer:
      'Progressive dialing auto-advances to the next lead after each disposition, with AMD (Answering Machine Detection) skipping voicemails automatically. The agent only hears live answers. Optimal for solo agents and small teams.',
  },
  {
    question: 'What is predictive dialing?',
    answer:
      'Predictive dialing uses a pacing algorithm to call multiple numbers simultaneously across a team, predicting when agents will become available based on average call durations. Maximizes agent talk time. Designed for teams of 8+ concurrent agents. Includes a legal 3% abandon rate cap to stay TCPA-compliant.',
  },
  {
    question: 'Which dialer mode should I use?',
    answer:
      'Solo agent doing high-value follow-up: Preview. Solo agent or small team running general outbound: Progressive. Team of 4-7 reps: Power or Progressive. Team of 8+ reps doing high-volume outbound: Predictive. DialerSeat lets you configure dialer mode per campaign, so you can mix modes across different lead lists.',
  },
  {
    question: 'Is predictive dialing legal?',
    answer:
      'Yes — predictive dialing is legal under TCPA when the abandon rate stays under 3% over a 30-day period and proper disclosure is provided. DialerSeat enforces this cap automatically and includes server-side TCPA window enforcement and full STIR/SHAKEN A-attestation.',
  },
  {
    question: 'What is AMD (Answering Machine Detection)?',
    answer:
      'AMD analyzes the audio when a call connects to detect whether a human or voicemail picked up. DialerSeat drops voicemail calls in approximately 1.8 seconds before any agent hears a beep, so reps only spend time on live conversations. AMD is hardcoded server-side and always on.',
  },
]