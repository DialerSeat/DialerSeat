import type { Metadata } from 'next'
import { Miniplayer } from '@/components/developers/embed/Miniplayer'

export const metadata: Metadata = { title: 'DialerSeat dialer', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/**
 * The frame the loader mounts. Public (no DialerSeat sign-in inside a CRM):
 * the session token in the URL fragment is the credential, and proxy.ts sends
 * frame-ancestors so only the platform's own pages can hold it.
 */
export default async function DialerFrame({ searchParams }: { searchParams: Promise<{ theme?: string; campaign?: string }> }) {
  const sp = await searchParams
  return <Miniplayer theme={sp.theme === 'light' ? 'light' : 'dark'} campaign={sp.campaign?.slice(0, 120) || null} />
}
