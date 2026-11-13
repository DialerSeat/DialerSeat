import type { Metadata } from 'next'
import { DevBaseProvider } from '@/components/developers/base'
import { DEV_CSS } from '@/components/developers/styles'
import { devBase } from '@/lib/developers/server'

// =============================================================================
// dev.dialerseat.com — its own product, dark, on the same login
// =============================================================================
// Served at the root of dev.dialerseat.com (proxy.ts rewrites to here) and at
// /developers on localhost. The main site's chrome, gates and theme never
// render here, and nothing here renders on dialerseat.com.
// =============================================================================

export const metadata: Metadata = {
  metadataBase: new URL('https://dev.dialerseat.com'),
  title: {
    default: 'DialerSeat for Developers: the dialer API for CRMs and platforms',
    template: '%s · DialerSeat for Developers',
  },
  description: 'Put a predictive, power and progressive dialer inside your CRM with one script tag and a REST API. Your campaigns, your dispositions, results by webhook. Free to build.',
  openGraph: {
    title: 'DialerSeat for Developers',
    description: 'The dialer API for CRMs and platforms. Embed the DialerSeat dialer, keep your own campaigns and dispositions, get every result by webhook.',
    url: 'https://dev.dialerseat.com',
    siteName: 'DialerSeat for Developers',
    type: 'website',
  },
  alternates: { canonical: 'https://dev.dialerseat.com' },
}

export default async function DevelopersLayout({ children }: { children: React.ReactNode }) {
  const base = await devBase()
  return (
    <div className="dv">
      <style>{DEV_CSS + 'html, body { background: #07070d; }'}</style>
      <DevBaseProvider base={base}>{children}</DevBaseProvider>
    </div>
  )
}
