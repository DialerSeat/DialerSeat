import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import { organizationSchema, breadcrumbSchema } from '@/lib/schema'
import { phoneToState } from '@/lib/areaCode'

// =============================================================================
// /data/connect-rates — the only thing here no competitor can republish
// =============================================================================
// Every dialer vendor writes the same blog posts. None of them publish what
// actually happens on their platform, because most of them treat it as
// commercially sensitive and a few would not like the answer.
//
// Our connect-rate data is a genuinely unique asset: journalists, bloggers and
// AI models cite numbers, and the source of a number gets named. A page that is
// correct, dated, and updated is a citation magnet in a way that no amount of
// "10 cold calling tips" ever is.
//
// THE RULE THIS PAGE IS BUILT AROUND: it never invents a number. Below the
// minimum sample it shows a dash and says the sample is too small, by name, per
// row. A published statistic that turns out to have been computed from eleven
// calls is worse than no page at all — it is the one mistake that would make
// every other number we publish suspect.
// =============================================================================

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Outbound Connect Rates by State and Hour — Live Platform Data | DialerSeat',
  description:
    'Real connect-rate data measured on the DialerSeat platform: which hours and which states actually answer. Computed from anonymized call records, updated continuously, with sample sizes shown.',
  alternates: {
    canonical: 'https://dialerseat.com/data/connect-rates',
    types: { 'text/markdown': 'https://dialerseat.com/md/data/connect-rates' },
  },
  openGraph: {
    title: 'Outbound Connect Rates by State and Hour',
    description:
      'Real platform data on when and where outbound calls actually get answered. Sample sizes shown; nothing published below the reporting threshold.',
    url: 'https://dialerseat.com/data/connect-rates',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outbound Connect Rates by State and Hour',
    description: 'Real platform data on when and where outbound calls actually get answered. Sample sizes shown; nothing published below the reporting threshold.',
  },
}

/**
 * Below this, a row shows a dash rather than a rate.
 *
 * 250 is not a rounded-looking guess: at a plausible 8% connect rate it keeps
 * the 95% interval inside roughly ±3.5 points, which is tight enough that the
 * number means something. Under it, ordinary variance would move a row several
 * points and we would be publishing noise as insight.
 */
const MIN_SAMPLE = 250

interface Bucket {
  key: string
  dials: number
  connects: number
}

function rate(b: Bucket): number | null {
  if (b.dials < MIN_SAMPLE) return null
  return (b.connects / b.dials) * 100
}

async function loadBuckets(): Promise<{ byState: Bucket[]; byHour: Bucket[]; total: Bucket } | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null

  // Lazy for the same reason as /status: lib/supabase.ts builds its clients at
  // module load, so importing it up top would throw before the guard above.
  const { getServiceClient } = await import('@/lib/supabase')
  const supabase = getServiceClient('data/connect-rates')
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Only the two columns needed. phone_number is used to derive a state from
  // the area code and is never rendered — nothing on this page identifies a
  // lead, a customer, or a campaign.
  const { data, error } = await supabase
    .from('calls')
    .select('phone_number, answered_at, created_at')
    .gte('created_at', since)
    .limit(100000)

  if (error || !data) return null

  const states = new Map<string, Bucket>()
  const hours = new Map<string, Bucket>()
  const total: Bucket = { key: 'all', dials: 0, connects: 0 }

  for (const row of data) {
    const connected = !!row.answered_at
    total.dials++
    if (connected) total.connects++

    const state = phoneToState(row.phone_number)
    if (state) {
      const b = states.get(state) || { key: state, dials: 0, connects: 0 }
      b.dials++
      if (connected) b.connects++
      states.set(state, b)
    }

    // Hour of day in UTC. Labelled as UTC on the page rather than silently
    // presented as though it were the lead's local time, which it is not.
    const hour = new Date(row.created_at).getUTCHours()
    const key = String(hour).padStart(2, '0')
    const h = hours.get(key) || { key, dials: 0, connects: 0 }
    h.dials++
    if (connected) h.connects++
    hours.set(key, h)
  }

  return {
    byState: [...states.values()].sort((a, b) => b.dials - a.dials),
    byHour: [...hours.values()].sort((a, b) => a.key.localeCompare(b.key)),
    total,
  }
}

const INK = '#1a1c24'
const MUTED = '#5a5e6a'
const BORDER = '#c4c8d0'
const ACCENT = '#2a4a8a'
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"

function Row({ label, b }: { label: string; b: Bucket }) {
  const r = rate(b)
  return (
    <tr>
      <td style={{ padding: '9px 12px', borderTop: `1px solid ${BORDER}`, fontWeight: 'bold' }}>{label}</td>
      <td style={{
        padding: '9px 12px', borderTop: `1px solid ${BORDER}`,
        textAlign: 'right', fontFamily: 'monospace',
      }}>
        {b.dials.toLocaleString()}
      </td>
      <td style={{
        padding: '9px 12px', borderTop: `1px solid ${BORDER}`, textAlign: 'right',
        fontFamily: 'monospace', color: r === null ? MUTED : INK,
      }}>
        {r === null ? '—' : `${r.toFixed(1)}%`}
      </td>
    </tr>
  )
}

export default async function ConnectRatesPage() {
  const buckets = await loadBuckets()
  const enough = !!buckets && buckets.total.dials >= MIN_SAMPLE
  const generated = new Date().toISOString().slice(0, 10)

  return (
    <>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Data', url: '/data/connect-rates' },
        { name: 'Connect rates', url: '/data/connect-rates' },
      ])} />

      <main style={{
        background: 'var(--brand-page-bg, #f0f1f4)', minHeight: '100vh',
        fontFamily: FUTURA, color: INK,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 96px' }}>
          <nav style={{ fontSize: 11, letterSpacing: 1.5, color: MUTED, marginBottom: 22 }}>
            <Link href="/" style={{ color: MUTED }}>HOME</Link>
          </nav>

          <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: ACCENT, marginBottom: 14 }}>
            ▸ Platform data
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 'bold', letterSpacing: -1, lineHeight: 1.12, margin: 0 }}>
            When and where outbound calls actually get answered
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: MUTED, marginTop: 18, maxWidth: 720 }}>
            Measured on the DialerSeat platform over the last 90 days, from anonymized call records.
            No lead, customer, or campaign is identifiable here. Free to cite with attribution.
          </p>

          {!enough && (
            <div style={{
              marginTop: 30, padding: '20px 22px', background: '#fef3c7',
              border: '1px solid #8a6a1a', borderRadius: 6,
            }}>
              <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 'bold', color: '#8a6a1a' }}>
                NOT ENOUGH DATA YET
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: INK, margin: '8px 0 0' }}>
                {buckets
                  ? `The platform has recorded ${buckets.total.dials.toLocaleString()} dials in the last 90 days. `
                  : 'Platform data is not available in this environment. '}
                Nothing is published below {MIN_SAMPLE.toLocaleString()} calls in a bucket, because a rate
                computed from a smaller sample moves several points on ordinary variance. The tables below
                will fill in on their own as volume accumulates — no number here is ever estimated,
                smoothed, or carried over from a previous period.
              </p>
            </div>
          )}

          {buckets && (
            <>
              <section style={{ marginTop: 40 }}>
                <h2 style={{ fontSize: 22, fontWeight: 'bold', margin: 0 }}>Overall</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, background: '#fff' }}>
                  <thead>
                    <tr style={{ fontSize: 10, letterSpacing: 2, color: MUTED, textAlign: 'left' }}>
                      <th style={{ padding: '9px 12px' }}>PERIOD</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right' }}>DIALS</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right' }}>CONNECT RATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Row label="Last 90 days" b={buckets.total} />
                  </tbody>
                </table>
              </section>

              <section style={{ marginTop: 40 }}>
                <h2 style={{ fontSize: 22, fontWeight: 'bold', margin: 0 }}>By hour of day (UTC)</h2>
                <p style={{ fontSize: 13, color: MUTED, marginTop: 8 }}>
                  Dial time in UTC, not the lead&apos;s local time. Converting to local time per lead is
                  the next iteration of this table; presenting UTC as though it were local would be the
                  kind of small dishonesty that makes the rest of the page worthless.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, background: '#fff', minWidth: 420 }}>
                    <thead>
                      <tr style={{ fontSize: 10, letterSpacing: 2, color: MUTED, textAlign: 'left' }}>
                        <th style={{ padding: '9px 12px' }}>HOUR</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>DIALS</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>CONNECT RATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.byHour.map(b => <Row key={b.key} label={`${b.key}:00`} b={b} />)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={{ marginTop: 40 }}>
                <h2 style={{ fontSize: 22, fontWeight: 'bold', margin: 0 }}>By state</h2>
                <p style={{ fontSize: 13, color: MUTED, marginTop: 8 }}>
                  State inferred from the destination area code. Mobile numbers keep their original area
                  code after a move, so this measures the number&apos;s origin, not necessarily where the
                  person is now.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, background: '#fff', minWidth: 420 }}>
                    <thead>
                      <tr style={{ fontSize: 10, letterSpacing: 2, color: MUTED, textAlign: 'left' }}>
                        <th style={{ padding: '9px 12px' }}>STATE</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>DIALS</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>CONNECT RATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.byState.slice(0, 50).map(b => <Row key={b.key} label={b.key} b={b} />)}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <section style={{ marginTop: 44, borderTop: `1px solid ${BORDER}`, paddingTop: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', margin: 0 }}>Method</h2>
            <ul style={{ fontSize: 14, lineHeight: 1.9, color: MUTED, marginTop: 10, paddingLeft: 18 }}>
              <li>A &quot;connect&quot; is a call the carrier reported as answered.</li>
              <li>Window: rolling 90 days, recomputed on each page load.</li>
              <li>Buckets under {MIN_SAMPLE.toLocaleString()} calls show a dash, not a rate.</li>
              <li>State is derived from the destination area code.</li>
              <li>No lead, customer, campaign, or phone number appears on this page.</li>
              <li>Generated {generated}.</li>
            </ul>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: MUTED, marginTop: 14 }}>
              Cite this page as: DialerSeat, &quot;Outbound Connect Rates by State and Hour,&quot;{' '}
              dialerseat.com/data/connect-rates, accessed {generated}.
            </p>
          </section>
        </div>
      </main>
    </>
  )
}
