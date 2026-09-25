import { breadcrumbSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import ScriptsFaqView from './view'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const baseMetadata: Metadata = {
  title: 'Call Scripts: Write, Attach, Reorder | DialerSeat',
  description:
    'How call scripts work in DialerSeat: personal and team-shared scripts, attaching multiple scripts to one campaign, reordering which one shows first, and what agents actually see mid-call.',
  alternates: {
    canonical: 'https://dialerseat.com/faq/scripts',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'Call Scripts: DialerSeat',
    description:
      'Write once, attach to any campaign, reorder any time. The script an agent sees mid-call, without leaving the dialer.',
    url: 'https://dialerseat.com/faq/scripts',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Call Scripts: DialerSeat',
    description: 'Write once, attach to any campaign, reorder any time. The script an agent sees mid-call, without leaving the dialer.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

export default function ScriptsFaqPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: msg("Home"), url: '/' },
        { name: msg("Faq"), url: '/faq' },
        { name: msg("Call Scripts"), url: '/faq/scripts' },
      ])} />
      <ScriptsFaqView />
    </>
  )
}
