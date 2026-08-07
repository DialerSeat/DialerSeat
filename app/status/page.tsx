import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import { organizationSchema, breadcrumbSchema } from '@/lib/schema'

// =============================================================================
// /status — a real, public health page
// =============================================================================
// Infrastructure buyers look for one, and its absence reads as hobbyist. But a
// status page that always says "all systems operational" because it is a static
// image is worse than none: the first time it lies during a real outage, it has
// spent the credibility it was built to earn.
//
// So every indicator here is an actual live check performed at request time.
// If a check cannot be performed, it says UNKNOWN. It never guesses, and there
// is no hardcoded green.
// =============================================================================

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'System Status — DialerSeat',
  description:
    'Live status of the DialerSeat platform: application, database, and carrier connectivity. Every indicator is checked at page load, not published from a static file.',
  alternates: {
    canonical: 'https://dialerseat.com/status',
    types: { 'text/markdown': 'https://dialerseat.com/md/status' },
  },
  openGraph: {
    title: 'System Status — DialerSeat',
    description:
      'Live status of the DialerSeat platform. Every indicator is checked at page load rather than published from a static file.',
    url: 'https://dialerseat.com/status',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'System Status — DialerSeat',
    description:
      'Live status of the DialerSeat platform. Every indicator is checked at page load rather than published from a static file.',
  },
  robots: { index: true, follow: true },
}

type State = 'operational' | 'degraded' | 'down' | 'unknown'

interface Check {
  name: string
  detail: string
  state: State
  ms: number | null
}

const TIMEOUT_MS = 4000

async function timed<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<{ ok: boolean; ms: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const started = Date.now()
  try {
    await fn(controller.signal)
    return { ok: true, ms: Date.now() - started }
  } catch {
    return { ok: false, ms: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

async function checkDatabase(): Promise<Check> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { name: 'Database', detail: 'Not configured in this environment', state: 'unknown', ms: null }
  }
  // Imported here, not at module scope. lib/supabase.ts calls createClient
  // when the MODULE loads, so a plain top-level import throws "supabaseUrl is
  // required" before the env guard above ever runs — which would take this
  // page down in any environment missing the vars, including a build.
  const { getServiceClient } = await import('@/lib/supabase')
  const supabase = getServiceClient('status')
  const { ok, ms } = await timed(async () => {
    // Cheapest possible round trip that still proves the connection works:
    // a head count on an indexed table, bounded to zero rows.
    const { error } = await supabase.from('platform_config').select('id', { count: 'exact', head: true })
    if (error) throw error
  })
  return {
    name: 'Database',
    detail: ok ? 'Reachable and accepting queries' : 'Not responding within 4s',
    state: ok ? (ms > 1500 ? 'degraded' : 'operational') : 'down',
    ms,
  }
}

async function checkCarrier(): Promise<Check> {
  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    return { name: 'Carrier (voice)', detail: 'Not configured in this environment', state: 'unknown', ms: null }
  }
  const { ok, ms } = await timed(async (signal) => {
    // A tiny authenticated read. Proves both that Telnyx is up and that our
    // credentials are still valid — the second is the failure mode that has
    // actually bitten, and an unauthenticated ping would miss it entirely.
    const res = await fetch('https://api.telnyx.com/v2/phone_numbers?page[size]=1', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(String(res.status))
  })
  return {
    name: 'Carrier (voice)',
    detail: ok ? 'API reachable, credentials valid' : 'Not responding, or credentials rejected',
    state: ok ? (ms > 2000 ? 'degraded' : 'operational') : 'down',
    ms,
  }
}

const COLORS: Record<State, { fg: string; bg: string; label: string }> = {
  operational: { fg: '#16a34a', bg: '#dcfce7', label: 'OPERATIONAL' },
  degraded: { fg: '#8a6a1a', bg: '#fef3c7', label: 'DEGRADED' },
  down: { fg: '#dc2626', bg: '#fee2e2', label: 'DOWN' },
  unknown: { fg: '#5a5e6a', bg: '#f1f5f9', label: 'UNKNOWN' },
}

const INK = '#1a1c24'
const MUTED = '#5a5e6a'
const BORDER = '#c4c8d0'
const ACCENT = '#2a4a8a'
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"

export default async function StatusPage() {
  const checks: Check[] = [
    // The application answered this request, so it is up by construction. Said
    // plainly rather than dressed up as a measurement.
    {
      name: 'Application',
      detail: 'Serving this page',
      state: 'operational',
      ms: null,
    },
    ...(await Promise.all([checkDatabase(), checkCarrier()])),
  ]

  const worst: State =
    checks.some(c => c.state === 'down') ? 'down'
    : checks.some(c => c.state === 'degraded') ? 'degraded'
    : checks.every(c => c.state === 'operational') ? 'operational'
    : 'unknown'

  const headline =
    worst === 'operational' ? 'All systems operational'
    : worst === 'degraded' ? 'Degraded performance'
    : worst === 'down' ? 'Active incident'
    : 'Status partially unavailable'

  const checkedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Status', url: '/status' },
      ])} />

      <main style={{
        background: 'var(--brand-page-bg, #f0f1f4)', minHeight: '100vh',
        fontFamily: FUTURA, color: INK,
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '80px 24px 96px' }}>
          <nav style={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 22 }}>
            <Link href="/" style={{ color: MUTED }}>HOME</Link>
          </nav>

          <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: ACCENT, marginBottom: 14 }}>
            ▸ System status
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: COLORS[worst].fg, flexShrink: 0,
            }} />
            <h1 style={{ fontSize: 38, fontWeight: 'bold', letterSpacing: -1, margin: 0 }}>
              {headline}
            </h1>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.8, color: MUTED, marginTop: 14, maxWidth: 640 }}>
            Every indicator below is checked live when this page loads. Nothing here is published from
            a static file, so it can report a problem before we have noticed one.
          </p>

          <div style={{ marginTop: 34, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
            {checks.map((c, i) => (
              <div key={c.name} style={{
                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                padding: '18px 20px', background: '#ffffff',
                borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 15, fontWeight: 'bold' }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{c.detail}</div>
                </div>
                <div style={{ fontSize: 12, color: MUTED, fontFamily: 'monospace', minWidth: 64, textAlign: 'right' }}>
                  {/* A dash, never a plausible-looking number. */}
                  {c.ms === null ? '—' : `${c.ms} ms`}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5,
                  padding: '5px 10px', borderRadius: 3,
                  color: COLORS[c.state].fg, background: COLORS[c.state].bg,
                  border: `1px solid ${COLORS[c.state].fg}`,
                }}>
                  {COLORS[c.state].label}
                </span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: MUTED, marginTop: 16, fontFamily: 'monospace' }}>
            CHECKED {checkedAt}
          </p>

          <section style={{ marginTop: 44 }}>
            <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>What we do not show</h2>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: MUTED, marginTop: 10, maxWidth: 660 }}>
              There is no uptime percentage on this page. We have not been operating long enough for one
              to mean anything, and a figure computed over a short window would imply a track record we
              do not yet have. It will appear here when there is a year of measurement behind it.
            </p>
          </section>
        </div>
      </main>
    </>
  )
}
