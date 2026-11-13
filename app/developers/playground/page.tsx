import type { Metadata } from 'next'
import { DevFooter, DevTopNav } from '@/components/developers/MarketingChrome'
import { Playground } from '@/components/developers/Playground'

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Try the DialerSeat dialer API in your browser: a test key, a seat, a session and the embedded dialer, with every request shown.',
  alternates: { canonical: 'https://dev.dialerseat.com/playground' },
}

/** A test CRM page built on the public API, open to anyone with a test key. */
export default function PlaygroundPage() {
  return (
    <div className="dv-app">
      <DevTopNav themeToggle />
      <main style={{ maxWidth: 1360, margin: '0 auto', padding: '32px 20px 56px' }}>
        <div style={{ marginBottom: 24, maxWidth: 760 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--dv-accent)', marginBottom: 8 }}>Playground</div>
          <h1 className="dv-h1" style={{ fontSize: 28 }}>Try the dialer API</h1>
          <p className="dv-sub">This page does what your CRM would: checks a key, creates a seat, opens a session and embeds the dialer with a lead list. Every request and every event is shown, with the code that makes it. Test keys only; nothing dials for real.</p>
        </div>
        <Playground />
      </main>
      <DevFooter />
    </div>
  )
}
