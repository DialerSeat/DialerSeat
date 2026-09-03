'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const BG = '#1e1f22'
const PANEL = '#232428'
const HAIRLINE = '#1a1b1e'
const TEXT = '#f2f3f5'
const MUTED = '#949ba4'
const DIM = '#80848e'
const ACCENT = '#2563eb'

function quarterLabel(period: string): string {
  const [y, q] = period.split('-Q')
  const names = ['Jan: Mar', 'Apr: Jun', 'Jul: Sep', 'Oct, Dec']
  return `Q${q} ${y} · ${names[Number(q) - 1]}`
}

function halfLabel(period: string): string {
  const [y, h] = period.split('-H')
  return h === '1' ? `First half ${y} · Jan, Jun` : `Second half ${y} · Jul, Dec`
}

function monthLabel(period: string): string {
  const [y, m] = period.split('-')
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1))
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default function ReportsPage() {
  const [months, setMonths] = useState<string[]>([])
  const [quarters, setQuarters] = useState<string[]>([])
  const [halves, setHalves] = useState<string[]>([])
  const [years, setYears] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/seat-report')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setMonths(d.months || [])
          setQuarters(d.quarters || [])
          setHalves(d.halves || [])
          setYears(d.years || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const Card = ({ href, title, sub }: { href: string; title: string; sub: string }) => (
    // Every statement opens in a new tab. It is a document, and a document that
    // replaces the page you were working on is a document that costs you your
    // place — you open one to check a number and go back to what you were doing.
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
        padding: '14px 16px', textDecoration: 'none', color: TEXT,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ color: MUTED, fontSize: 12 }}>Open ↗</span>
    </a>
  )

  return (
    <div style={{ background: BG, color: TEXT, minHeight: '100vh', padding: '28px 30px 60px' }}>
      <div style={{ maxWidth: 780 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <Link
            href="/dashboard/teams"
            style={{
              background: 'transparent', border: `1px solid ${HAIRLINE}`,
              color: MUTED, borderRadius: 3, padding: '6px 12px',
              fontSize: 12, textDecoration: 'none',
            }}
          >← Teams</Link>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Seat Reports</h1>
        </div>
        <div style={{ fontSize: 13, color: DIM, marginBottom: 26 }}>
          Billing statements for the seats you pay for.
        </div>

        {/* ── WHAT THESE ARE ────────────────────────────────────────────────
            Written before the list, because somebody who has never filed a
            software expense does not know what they are looking at — and the
            useful part is not "here are your numbers", it is understanding that
            these numbers are worth keeping. */}
        <section style={{
          background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
          padding: '18px 20px', marginBottom: 28,
        }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 600 }}>
            What are seat reports?
          </h2>
          <div style={{ fontSize: 13, color: DIM, lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 11px' }}>
              Every seat you pay for is a business expense. You are buying software
              so that somebody can work: the same as a desk, a headset, or a phone
              line, and in most cases that is deductible against what your business
              earns. What it needs is a record: who was billed, for what, when, and
              proof the money actually moved.
            </p>
            <p style={{ margin: '0 0 11px' }}>
              That is what these are. Each statement names both parties, your
              business and DialerSeat, lists every seat charge with the agent it
              covered and the period it paid for, and totals{' '}
              <strong style={{ color: MUTED }}>only what actually settled</strong>. A
              charge that failed is shown but never counted, because money that did
              not leave your account is not an expense and treating it as one is how
              an honest deduction becomes a wrong one.
            </p>
            <p style={{ margin: '0 0 11px' }}>
              Where we can, we re-check each figure against the payment processor
              before printing it. Where we cannot, the statement says so on the line
              itself rather than presenting an unverified number with the same
              confidence as a verified one. Discounts are shown as discounts, list
              price, what you actually paid, and the difference, so anyone reading
              it can check the arithmetic instead of taking it on trust.
            </p>
            <p style={{ margin: '0 0 11px' }}>
              <strong style={{ color: MUTED }}>We would rather be accurate than
              flattering.</strong> It would be easy to print a bigger number, or to
              quietly include pending charges, or to round in your favour. We do not,
              because a statement that overstates an expense is not a favour, it is
              a problem handed to you with our logo on it, and it would arrive years
              later when it is expensive to fix.
            </p>
            <p style={{ margin: 0 }}>
              Statements are records, not advice. Whether an amount is deductible and
              how it should be treated depends on your entity and where you operate 
              that is a question for your accountant, and these documents exist to
              give them something solid to work from. If a figure looks wrong, tell
              us and we will correct it and reissue. Never edit one yourself:
              altering a document used to support a tax position is a federal crime,
              and there is no version of that trade that is worth it.
            </p>
          </div>
        </section>

        <h2 style={{
          fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
          color: MUTED, fontWeight: 700, margin: '0 0 10px',
        }}>This year</h2>
        <div style={{ display: 'grid', gap: 8, marginBottom: 26 }}>
          {years.map(y => (
            <Card
              key={y}
              href={`/dashboard/reports/${y}`}
              title={y}
              sub="Full calendar year: every seat charge, with growth against the year before"
            />
          ))}
        </div>

        {/* ── QUARTERLY AND HALF-YEAR ──────────────────────────────────────
            Here because that is how tax actually happens: estimated payments are
            quarterly, and an accountant asking "what did you spend in Q2" should
            get a Q2 statement rather than three monthly ones to add up. Adding
            them by hand is exactly where a transcription error gets into a
            return. Offered whether or not a quarter has charges in it — an
            explicit "nothing" is easier to file than an absence. */}
        <h2 style={{
          fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
          color: MUTED, fontWeight: 700, margin: '0 0 10px',
        }}>Quarterly</h2>
        <div style={{ display: 'grid', gap: 8, marginBottom: 26 }}>
          {quarters.map(q => (
            <Card
              key={q}
              href={`/dashboard/reports/${q}`}
              title={quarterLabel(q)}
              sub="Three months of seat charges, compared against the previous quarter"
            />
          ))}
        </div>

        <h2 style={{
          fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
          color: MUTED, fontWeight: 700, margin: '0 0 10px',
        }}>Half year</h2>
        <div style={{ display: 'grid', gap: 8, marginBottom: 26 }}>
          {halves.map(h => (
            <Card
              key={h}
              href={`/dashboard/reports/${h}`}
              title={halfLabel(h)}
              sub="Six months of seat charges, compared against the previous half"
            />
          ))}
        </div>

        <h2 style={{
          fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
          color: MUTED, fontWeight: 700, margin: '0 0 10px',
        }}>Monthly</h2>
        {loading ? (
          <div style={{ fontSize: 13, color: DIM }}>Loading…</div>
        ) : months.length === 0 ? (
          // Honest rather than empty. A month appears once a seat has actually
          // been billed in it; inventing blank statements for months somebody
          // was not trading invites them to file paper that means nothing.
          <div style={{ fontSize: 13, color: DIM, lineHeight: 1.8 }}>
            No monthly statements yet. One appears here for each month in which a
            seat was billed, the first will show up once your first seat charge
            settles.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {months.map(m => (
              <Card
                key={m}
                href={`/dashboard/reports/${m}`}
                title={monthLabel(m)}
                sub="Seat charges, payment method, and growth against the previous month"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
