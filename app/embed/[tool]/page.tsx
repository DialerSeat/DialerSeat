import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DialerCostCalculator from '@/components/tools/DialerCostCalculator'
import AbandonRateCalculator from '@/components/tools/AbandonRateCalculator'

// =============================================================================
// /embed/<tool> — the calculators, framed on somebody else's page
// =============================================================================
// No site header, no rail, no footer: just the tool and one credit line that
// links back to the full page. The embed code on each tool page puts a second
// credit link in the host page's own HTML, under the iframe, and that one is
// the backlink; a link inside a frame counts for the frame, not the host.
//
// noindex, because this is the same tool as /tools/<tool> without the words
// around it, and the full page is the one that should rank. next.config.ts
// lets /embed/* be framed by any site; every other route stays SAMEORIGIN.
// =============================================================================

const TOOLS = {
  'dialer-cost-calculator': { title: 'Dialer cost calculator', Tool: DialerCostCalculator },
  'abandon-rate-calculator': { title: 'Abandon rate calculator', Tool: AbandonRateCalculator },
} as const

type ToolSlug = keyof typeof TOOLS

export function generateStaticParams() {
  return Object.keys(TOOLS).map((tool) => ({ tool }))
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool } = await params
  const t = TOOLS[tool as ToolSlug]
  return {
    title: t ? `${t.title} | DialerSeat` : 'DialerSeat',
    robots: { index: false, follow: true },
    alternates: t ? { canonical: `https://dialerseat.com/tools/${tool}` } : undefined,
  }
}

export default async function EmbedPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = TOOLS[tool as ToolSlug]
  if (!t) notFound()
  const { Tool } = t

  return (
    <main style={{ background: '#fff', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <Tool />
      <p style={{ marginTop: 14, fontSize: 12, color: '#6b7182' }}>
        {t.title} by{' '}
        <a href={`https://dialerseat.com/tools/${tool}`} target="_blank" rel="noopener" style={{ color: '#2a6eff', fontWeight: 600 }}>
          DialerSeat
        </a>
      </p>
    </main>
  )
}
