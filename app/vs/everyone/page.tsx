import type { Metadata } from 'next'
import JsonLd from '@/components/json-ld'
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
} from '@/lib/schema'
import VsEveryoneView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// The five tools this page's tables name, in the forms people search. Each
// one also has its own /vs page carrying the full pros-and-cons treatment
// (lib/vsSeo); this page is the industry-wide view, so it claims the
// category-level phrases as well.
const COMPARED = ['ReadyMode', 'Mojo Dialer', 'PhoneBurner', 'Five9', 'Convoso']

const baseMetadata: Metadata = {
  keywords: [
    'dialer pros and cons',
    'predictive dialer pros and cons',
    'cons of legacy dialers',
    'best dialer comparison',
    ...COMPARED.flatMap((n) => [`${n} pros and cons`, `cons of ${n}`]),
  ],
  title: 'DialerSeat vs Every Legacy Dialer: ReadyMode, Mojo, PhoneBurner, Five9, and More',
  description:
    'Every legacy dialer shares the same flaws: opaque pricing, annual contracts, dated UI, add-on stacking, desktop-only, compliance shortcuts. DialerSeat fixes every one at $35/week per seat, cancel anytime. Solo or team. Every industry. Every device.',
  alternates: {
    canonical: 'https://dialerseat.com/vs/everyone',
  },
  openGraph: {
    title: 'DialerSeat vs Every Legacy Dialer',
    description:
      'Side-by-side feature matrix vs ReadyMode, Mojo, PhoneBurner, and Five9, plus a look at Convoso and the wider industry. $35/week per seat, cancel anytime. No annual contract. Modern UI. Every device.',
    url: 'https://dialerseat.com/vs/everyone',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Every Legacy Dialer',
    description: 'Side-by-side feature matrix vs ReadyMode, Mojo, PhoneBurner, and Five9, plus a look at Convoso and the wider industry. $35/week per seat, cancel anytime. No annual contract. Modern UI. Every device.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function Page() {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Comparisons"), url: '/vs' },
          { name: msg("DialerSeat vs Every Legacy Dialer"), url: '/vs/everyone' },
        ])}
      />
      <VsEveryoneView />
    </>
  )
}