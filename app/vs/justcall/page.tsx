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

const SLUG = 'justcall'

const baseMetadata: Metadata = {
  keywords: prosConsKeywords(SLUG),
  title: 'JustCall Alternative: Dialer Pricing Without the Pro-Tier Upsell | DialerSeat',
  description:
    'JustCall advertises $29/user/month, but the power and predictive dialer sit behind the $49+/month Pro tier, with a 2-seat minimum on every standard plan. DialerSeat includes every dialer mode at $35/seat/week, billed weekly, one seat minimum.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/justcall',
  },
  openGraph: {
    title: 'DialerSeat vs JustCall',
    description:
      'Predictive and power dialing included at $35/week per seat, not gated behind a Pro-tier upgrade or a 2-seat minimum.',
    url: 'https://dialerseat.com/vs/justcall',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs JustCall',
    description: 'Predictive and power dialing included at $35/week per seat, not gated behind a Pro-tier upgrade or a 2-seat minimum.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("How does DialerSeat compare to JustCall on price?"),
    answer:
      msg("DialerSeat is $35 per seat per week, billed weekly, one seat minimum. JustCall's Team plan is genuinely $29/user/month, but every standard plan (Team through Pro Plus) carries a 2-seat minimum, putting the real floor closer to $58/month. The power and predictive dialer aren't included until the Pro tier, $49/user/month and up."),
  },
  {
    question: msg("Does JustCall’s $29 plan include the sales dialer?"),
    answer:
      msg("No. JustCall's entry Team plan covers unlimited calling, SMS, and CRM integrations, but the power dialer and predictive dialer require the Pro tier ($49/user/month) or higher. JustCall also runs its Sales Dialer as a separate mobile app from its general calling app, their own help center notes the two apps aren't interchangeable. DialerSeat includes all dialer modes in one app at $35/week per seat."),
  },
  {
    question: msg("Does DialerSeat offer whitelabel like JustCall?"),
    answer:
      msg("Yes: Manager+ is $75/week flat and includes full whitelabel, with no seat minimum. We found no whitelabel or reseller program anywhere on JustCall’s site. JustCall’s Business tier, which includes HIPAA compliance, requires a 10-seat minimum."),
  },
  {
    question: msg("Does DialerSeat work on mobile like JustCall?"),
    answer:
      msg("Yes, and it’s one app for the full dialer experience. JustCall does have real, well-built iOS and Android apps, but runs the Sales Dialer as a separate app from its general JustCall calling app, reps need to know which one to use for which task. DialerSeat installs as a single Progressive Web App with the same dialer modes as desktop."),
  },
  {
    question: msg("Is JustCall’s unlimited calling really unlimited?"),
    answer:
      "JustCall's plans advertise unlimited calling and AI transcription, but these are subject to an unpublished Fair Usage Policy. High-volume dialing patterns, the kind a power or predictive dialer produces, can trigger per-minute overage billing faster than normal call patterns. DialerSeat's $35/week covers your calling with no separate usage policy to account for.",
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
          { name: msg("DialerSeat vs JustCall"), url: '/vs/justcall' },
        ])}
      />
      <VsCompetitorView c={competitor} />
    </>
  )
}
