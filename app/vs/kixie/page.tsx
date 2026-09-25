import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import VsCompetitorView from '@/components/vs-competitor-view'
import JsonLd from '@/components/json-ld'
import { competitorBySlug } from '@/lib/competitors'
import { prosConsKeywords, prosConsFaqs } from '@/lib/vsSeo'
import {
  organizationSchema,
  softwareApplicationSchema,
  faqPageSchema,
  breadcrumbSchema,
} from '@/lib/schema'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

const SLUG = 'kixie'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'DialerSeat vs Kixie: Every Dialer Mode, One Price',
  description:
    'Kixie PowerCall is well-reviewed but tiers dialing power by price, multi-line dialing runs $95+/seat/month. DialerSeat includes predictive, power, progressive, and preview dialing at $35/seat/week, billed weekly, no tier to climb.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/kixie',
  },
  openGraph: {
    title: 'DialerSeat vs Kixie',
    description:
      'Predictive, power, progressive, and preview dialing at one flat $35/week per seat, not gated behind a $95+/month multi-line tier.',
    url: 'https://dialerseat.com/vs/kixie',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Kixie',
    description: 'Predictive, power, progressive, and preview dialing at one flat $35/week per seat, not gated behind a $95+/month multi-line tier.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How does DialerSeat compare to Kixie on price?"),
    answer:
      msg("DialerSeat is $35 per seat per week, billed weekly, with every dialer mode included. Kixie's entry Integrated tier starts around $35/user/month but is single-line only, the Multi-Line PowerDialer tier comparable to DialerSeat's included capability runs roughly $95-$185/user/month depending on the source, and AI Human Voice Detection is a further $30/month add-on. Independent reviewers estimate real all-in Kixie cost lands 30-60% above the advertised entry price."),
  },
  {
    question: msg("Does Kixie offer predictive dialing?"),
    answer:
      msg("No. Kixie's own content frames this as an intentional choice, Multi-line PowerDialer is positioned as an alternative that avoids the abandoned-call risk associated with predictive dialing. It's a legitimate, compliance-minded design decision, not an oversight. DialerSeat includes predictive dialing alongside power, progressive, and preview modes for teams that want it."),
  },
  {
    question: msg("Does DialerSeat offer whitelabel like Kixie?"),
    answer:
      msg("Yes, Manager+ is $75/month flat and includes full whitelabel. We found no whitelabel or reseller program anywhere on Kixie’s site. Kixie’s team and coaching tools also require a tier upgrade above the entry Integrated plan."),
  },
  {
    question: msg("Does DialerSeat work on mobile like Kixie?"),
    answer:
      msg("Yes: the full dialer experience, not a companion app. DialerSeat installs as a Progressive Web App on iPhone, iPad, Android, macOS, and Windows with the same dialer modes as desktop. Kixie does have a native mobile app for iOS and Android, but its Android release is rated 2.05 out of 5 stars with limited recent download volume, suggesting most Kixie usage stays desktop-side."),
  },
  {
    question: msg("Is Kixie a good dialer?"),
    answer:
      msg("By review data, yes, Kixie holds a strong 4.8/5 rating on G2 across 800+ reviews, and its local presence dialing and native HubSpot/Salesforce integration are genuine strengths for CRM-embedded teams. The tradeoff is pricing structure: dialing power is tiered, so the features most outbound teams actually want, multi-line dialing, AI voice detection, cost more than the advertised entry price."),
  },
]

export default function Page() {
  const competitor = competitorBySlug(SLUG)
  if (!competitor) notFound()

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqPageSchema([...FAQS, ...prosConsFaqs(SLUG)])} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Comparisons"), url: '/vs' },
          { name: msg("DialerSeat vs Kixie"), url: '/vs/kixie' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
