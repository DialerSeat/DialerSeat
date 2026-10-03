import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getT } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /sign-in — its own title, and out of the index on the main domain
// =============================================================================
// The page is a client component, so its metadata lives here. Without it,
// /sign-in inherited the homepage's title, and Bing had indexed it as one of
// the ten dialerseat.com pages it knew: a login form taking a place a
// comparison page should have. Nobody searches their way to a login form;
// "dialerseat login" finds the homepage, whose header links here.
//
// White-label tenants use this same route on their own subdomain. Their pages
// keep whatever they had: no DialerSeat title, no robots change.
// =============================================================================

const APEX_HOSTS = new Set(['dialerseat.com', 'www.dialerseat.com'])

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const host = (h.get('host') || '').split(':')[0].toLowerCase()
  if (h.get('x-tenant-slug') || !APEX_HOSTS.has(host)) return {}

  const tm = await getT()
  return {
    title: tm(msg('Sign In to DialerSeat')),
    robots: { index: false, follow: true },
  }
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
