import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getT } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /sign-up — its own title on the main domain
// =============================================================================
// The page is a client component, so its metadata lives here. It inherited the
// homepage's title; Google asks for distinct titles per page, and a searcher
// who lands here should see what they are signing up for. Unlike /sign-in it
// stays indexable: "dialerseat sign up" is a search worth answering.
//
// White-label tenants use this route on their own subdomain and keep what
// they had.
// =============================================================================

const APEX_HOSTS = new Set(['dialerseat.com', 'www.dialerseat.com'])

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const host = (h.get('host') || '').split(':')[0].toLowerCase()
  if (h.get('x-tenant-slug') || !APEX_HOSTS.has(host)) return {}

  const tm = await getT()
  return {
    title: tm(msg('Sign Up for DialerSeat: $35 a Week, No Contract')),
    description: tm(msg('Create your DialerSeat account: every dialing mode for $35 per seat per week, billed weekly. No contract, no setup fee.')),
  }
}

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children
}
