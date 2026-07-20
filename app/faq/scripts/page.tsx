import type { Metadata } from 'next'
import ScriptsFaqView from './view'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Call Scripts — Write, Attach, Reorder | DialerSeat',
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
    title: 'Call Scripts — DialerSeat',
    description:
      'Write once, attach to any campaign, reorder any time. The script an agent sees mid-call, without leaving the dialer.',
    url: 'https://dialerseat.com/faq/scripts',
    type: 'article',
  },
}

export default function ScriptsFaqPage() {
  return <ScriptsFaqView />
}
