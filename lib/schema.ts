import { currentLocale, t } from '@/lib/i18n/server'
import { isLocalizablePath, localizedPath } from '@/lib/i18n/locales'

const SITE_URL = 'https://dialerseat.com'



export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'DialerSeat',
    url: SITE_URL,
    // /logo.png never existed (404), so Google had no usable logo for the
    // entity. Organization logos must be crawlable and at least 112x112; the
    // 512x512 app icon is both.
    logo: `${SITE_URL}/icons/android-chrome-512x512.png`,
    description:
      'The modern dialer for sales teams and solo agents. Multi-line predictive dialing with per-campaign mode configuration, multiple scripts per campaign, server-side TCPA enforcement, and carrier-level STIR/SHAKEN A-attestation where supported. A flat $35/week per seat, no annual contracts.',
    // The subjects the site publishes on. Part of the same entity signal as
    // sameAs below: it tells a knowledge graph what this organization is an
    // authority about, which is the basis for being named when those topics
    // come up.
    knowsAbout: [
      'Auto dialer', 'Predictive dialer', 'Power dialer', 'Outbound calling',
      'Telemarketing compliance', 'TCPA', 'Do Not Call registry', 'Call abandonment rate',
      'Local presence dialing', 'Answering machine detection', 'Call center software',
    ],
    // sameAs is how a search engine stops treating dialerseat.com as a website
    // and starts treating DialerSeat as an ENTITY — one thing with profiles in
    // several places rather than several unconnected mentions. It is the input
    // to a knowledge panel, and to an assistant being confident enough to name
    // us rather than hedge.
    //
    // Company profiles only. The site names no person, by the owner's choice,
    // so a personal profile (linkedin.com/in/...) does not belong here. Add
    // each company profile as it exists: LinkedIn /company/, G2, Capterra,
    // Crunchbase, YouTube.
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      // support@, not hello@. Every other page on the site publishes support@,
      // and an entity that lists two different contact addresses is an entity a
      // model has to hedge about.
      email: 'support@dialerseat.com',
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
      'Multi-line predictive dialer for sales teams and solo agents. Per-campaign dialer mode, multiple scripts with live mid-call switching, server-side TCPA compliance, carrier-level STIR/SHAKEN A-attestation where supported, and an inbound lead webhook per campaign that takes leads from any CRM, Zapier or Make. Works on phone, tablet, and desktop. $35/week per seat with no annual contract.',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Sales Dialer',
    operatingSystem: 'Web (works on iOS, Android, macOS, Windows via browser or installable PWA)',
    url: SITE_URL,
    softwareVersion: '1.0',
    // ── ONE OFFER ─────────────────────────────────────────────────────────
    // This carried a second $0.00 Offer describing the free week. The trial is
    // gone, and a $0.00 offer left in markup would keep telling crawlers about
    // a price nobody can get — the exact drift that makes structured data
    // worth less than no structured data.
    offers: [
      {
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
    ],
    featureList: [
      'Multi-line predictive dialer',
      'Preview, Power, Progressive, and Predictive dialer modes',
      'Per-campaign dialer mode configuration',
      'AMD voicemail detection drops in 1.8 seconds',
      'Multiple scripts per campaign with live mid-call switching',
      // Was "Public API and webhooks". There are no customer API keys; what
      // exists is lead drip, one inbound webhook per campaign. See 3ce19770.
      'Inbound lead webhook per campaign (any CRM, Zapier, Make)',
      'Inbound team numbers',
      'TCPA windows enforced server-side per lead state',
      'STIR/SHAKEN A-attestation',
      'All outbound numbers carrier-registered (CNAM, FCR)',
      'Local presence dialing',
      'Calendar-aligned analytics (Sunday + 1st-of-month resets)',
      'Lapsed-user data preservation',
      'Installable as Progressive Web App on phones, tablets, and desktops',
      'A flat $35/week per seat: no annual contract, no setup fee',
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
    // In the page's language. These were English on every translated page,
    // so /es/vs/mojo showed Spanish questions and described English ones to
    // crawlers; Google requires markup to match the visible content. t() is
    // English when nothing primed a language (llms files, mirrors).
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: t(faq.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(faq.answer),
      },
    })),
  }
}



export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    // Names in the page's language, and each step pointing at that language's
    // address where one exists, so /es/faq/x lists /es/faq, not /faq.
    itemListElement: items.map((item, i) => {
      const locale = currentLocale()
      const path = item.url.startsWith('http') ? null : item.url
      const url = path === null ? item.url
        : `${SITE_URL}${locale !== 'en' && isLocalizablePath(path) ? localizedPath(locale, path) : path}`
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: t(item.name),
        item: url,
      }
    }),
  }
}
