'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// Compliance — what Telnyx expects vs where we are, this month only
// =============================================================================
// Scoped to the calendar month and resetting on the 1st, because that is how
// the rule is assessed. A rolling window would show a number nobody is being
// judged on.
//
// Every threshold shown is Telnyx's own, from their correspondence. Nothing
// here is a target we invented, and the app says so — an admin looking at a red
// number needs to know whose line it is.
// =============================================================================

const FONT = 'Futura PT, Futura, sans-serif'

interface Check {
  key: string
  label: string
  expects: string
  detail: string
  value: number | null
  unit: string
  threshold: number | null
  direction: 'above' | 'below'
  passing: boolean | null
  sample: number | null
}

interface DayPoint {
  day: string
  measured: number
  short: number
  shortPct: number | null
  avgBilled: number | null
}

interface Payload {
  byDay?: DayPoint[]
  period: {
    label: string
    resetsOn: string
    daysElapsed: number
    daysRemaining: number
  }
  checks: Check[]
  shortCalls: {
    count: number
    allowed: number
    excess: number
    byCause: { machine: number; noVerdict: number; human: number; other: number }
  }
  volume: { placed: number; connected: number; measured: number }
}

const GREEN = '#1a6a1a'
const RED = '#8a1a1a'
const AMBER = '#8a6a1a'

export default function Compliance() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/compliance')
      const json = await res.json()
      if (json.success) { setData(json); setError(null) }
      else setError(json.error || 'Could not load compliance data.')
    } catch {
      setError('Could not load compliance data.')
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (error) return <Msg>{error}</Msg>
  if (!data) return <Msg>LOADING…</Msg>

  const { period, checks, shortCalls, volume, byDay } = data
  const headline = checks.find(c => c.key === 'short_calls')

  return (
    <div className="cmp-report" style={{
      height: '100%', overflowY: 'auto', padding: 20,
      background: 'var(--brand-page-bg)', color: 'var(--brand-on-page-bg)',
      fontFamily: FONT, fontVariantNumeric: 'tabular-nums',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: 'var(--brand-primary)' }}>
          TELNYX COMPLIANCE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'var(--brand-muted-text)' }}>
            {period.label.toUpperCase()} · RESETS IN {period.daysRemaining} DAY{period.daysRemaining === 1 ? '' : 'S'}
          </div>
          {/* Print-to-PDF rather than a generated file. The report is already
              laid out; asking the browser to print it produces a real PDF on
              every platform with no dependency, no server round trip, and no
              second copy of the layout to keep in sync with this one. */}
          <button
            className="cmp-noprint"
            onClick={() => window.print()}
            style={{
              padding: '5px 12px', background: 'transparent',
              border: '1px solid var(--brand-primary)', borderRadius: 3,
              color: 'var(--brand-primary)', fontSize: 9.5, letterSpacing: 1.8,
              fontWeight: 'bold', cursor: 'pointer', fontFamily: FONT,
            }}
          >DOWNLOAD PDF</button>
        </div>
      </div>

      <style>{`
        /* The month is stamped into the printed copy because a saved report
           with no period on it is worthless six weeks later — and these are
           kept precisely to show what a given month looked like. */
        @media print {
          .cmp-noprint { display: none !important; }
          .cmp-print-only { display: block !important; }
          body * { visibility: hidden; }
          .cmp-report, .cmp-report * { visibility: visible; }
          .cmp-report {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0; overflow: visible; height: auto;
            background: #fff; color: #111;
          }
          /* Never split a check across a page break — a threshold on one page
             and its value on the next is worse than a shorter page. */
          .cmp-check { break-inside: avoid; page-break-inside: avoid; }
        }
        .cmp-print-only { display: none; }
      `}</style>

      <div className="cmp-print-only" style={{ fontSize: 11, marginTop: 6 }}>
        DialerSeat — Telnyx compliance report · {period.label} · generated{' '}
        {new Date().toLocaleString('en-US')}
      </div>

      {/* The headline number, because one of these four decides whether you get
          billed and the other three do not. */}
      {headline && (
        <div style={{
          marginTop: 18, padding: 18, borderRadius: 12,
          background: 'var(--brand-card-surface)',
          border: `1px solid ${headline.passing === false ? RED : 'var(--brand-card-border)'}`,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 1.6, color: 'var(--brand-muted-text)' }}>
            SHORT-DURATION CALLS THIS MONTH
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
            <span style={{
              fontSize: 40, fontWeight: 600, lineHeight: 1,
              color: headline.passing === false ? RED : GREEN,
            }}>
              {headline.value === null ? '—' : `${headline.value.toFixed(1)}%`}
            </span>
            <span style={{ fontSize: 12, color: 'var(--brand-muted-text)' }}>
              Telnyx allows {headline.threshold}%
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--brand-muted-text)', marginTop: 8, lineHeight: 1.6 }}>
            {shortCalls.count} of {volume.measured} connected calls came in at 6 seconds or less.
            {shortCalls.excess > 0
              ? ` ${shortCalls.excess} more than their limit allows.`
              : ' Within their limit.'}
          </div>
        </div>
      )}

      {/* Cause breakdown — the ratio alone does not tell you what to change. */}
      {shortCalls.count > 0 && (
        <div style={{ marginTop: 14, display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <Cause n={shortCalls.byCause.machine} label="VOICEMAIL DETECTED" />
          <Cause n={shortCalls.byCause.noVerdict} label="NO AMD (PREVIEW)" />
          <Cause n={shortCalls.byCause.human} label="HUMAN HUNG UP" />
          {shortCalls.byCause.other > 0 && <Cause n={shortCalls.byCause.other} label="OTHER" />}
        </div>
      )}

      {/* ── THE MONTH HIDES THE FIX ───────────────────────────────────────
          Telnyx assess per calendar month, so the headline number is the one
          that matters to them — and the one that cannot show whether anything
          changed. A heavy week early in the month keeps the ratio high long
          after the behaviour causing it stopped, and from a single percentage
          there is no way to tell an improving account from a worsening one. */}
      {byDay && byDay.length > 1 && (
        <>
          <div style={{
            fontSize: 9.5, letterSpacing: 1.6, fontWeight: 700,
            color: 'var(--brand-muted-text)', margin: '26px 0 10px',
          }}>SHORT-CALL RATIO BY DAY</div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 3, height: 84,
            border: '1px solid var(--brand-card-border)', borderRadius: 10,
            background: 'var(--brand-card-surface)', padding: '10px 12px',
            overflowX: 'auto',
          }}>
            {byDay.map(d => {
              const pct = d.shortPct ?? 0
              // Bars are scaled against the threshold rather than the tallest
              // day, so the 15% line sits in the same place every time and a
              // good day cannot be made to look bad by a worse one beside it.
              const h = Math.max(2, Math.min(100, (pct / 40) * 100))
              const over = pct > 15
              return (
                <div key={d.day} title={`${d.day} · ${pct.toFixed(1)}% short of ${d.measured} · avg ${d.avgBilled?.toFixed(1) ?? '—'}s`}
                     style={{ flex: '1 0 10px', display: 'flex', flexDirection: 'column',
                              justifyContent: 'flex-end', height: '100%', minWidth: 10 }}>
                  <div style={{
                    height: `${h}%`, borderRadius: 2,
                    background: over ? RED : GREEN, opacity: 0.85,
                  }} />
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: 'var(--brand-muted-text)', marginTop: 6 }}>
            Each bar is one day, scaled to 40%. Red is above the 15% line.
            Hover for the count and average billed length.
          </div>
        </>
      )}

      <div style={{
        fontSize: 9.5, letterSpacing: 1.6, fontWeight: 700,
        color: 'var(--brand-muted-text)', margin: '26px 0 10px',
      }}>WHAT TELNYX EXPECTS</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {checks.map(c => (
          <div key={c.key} className="cmp-check" style={{
            border: '1px solid var(--brand-card-border)', borderRadius: 10,
            background: 'var(--brand-card-surface)', padding: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.label}</span>
              <span style={{
                fontSize: 18, fontWeight: 600,
                color: c.passing === false ? RED : c.passing === true ? GREEN : AMBER,
              }}>
                {c.value === null ? '—' : `${c.unit === 's' ? c.value.toFixed(1) : c.value.toFixed(c.unit === '%' ? 1 : 0)}${c.unit}`}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--brand-muted-text)', marginTop: 4 }}>
              Expects: {c.expects}
            </div>
            <div style={{ fontSize: 11, color: 'var(--brand-muted-text)', marginTop: 6, lineHeight: 1.6 }}>
              {c.detail}
            </div>
            {c.sample !== null && (
              <div style={{ fontSize: 10, color: 'var(--brand-muted-text)', marginTop: 6 }}>
                from {c.sample.toLocaleString()} call{c.sample === 1 ? '' : 's'} this month
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 18, fontSize: 10.5, color: 'var(--brand-muted-text)', lineHeight: 1.7,
      }}>
        Talk time is measured from answer to hangup — ring time is excluded, which is
        how Telnyx bills. Calls placed before answer tracking existed are left out
        rather than counted as zero: unknown talk time is not the same as a short call.
        Disposition rows carrying no Telnyx call are excluded from every figure here.
      </div>
    </div>
  )
}

function Cause({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{n}</div>
      <div style={{ fontSize: 9, letterSpacing: 1.2, color: 'var(--brand-muted-text)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

function Msg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 30, fontSize: 11, letterSpacing: 2,
      color: 'var(--brand-muted-text)', fontFamily: FONT,
    }}>{children}</div>
  )
}
