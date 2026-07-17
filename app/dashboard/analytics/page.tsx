'use client'
import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'






















const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const DISPOSITION_COLORS: Record<string, string> = {
  'CLOSED': T.green,
  'APPOINTMENT': T.accent,
  'NOT INTERESTED': T.amber,
  'DO NOT CALL': T.red,
  'SKIPPED': '#888',
  'NO ANSWER': '#bbb',
  'NO_ANSWER': '#bbb',
}

// Renders disposition-pie labels without letting them collide.
// Recharts' built-in `label` fn places every label at the same fixed
// radius using only that slice's own angle, so slices that are close
// together (lots of thin slivers) end up with overlapping text. This
// groups labels by which side of the pie they're on, spaces them out
// vertically so they never overlap, and draws a short leader line back
// to the slice so it's still clear which label belongs to which wedge.
function renderDispositionLabels(props: {
  cx: number
  cy: number
  outerRadius: number
  index: number
  data: { disposition: string; count: number }[]
  chartHeight: number
}) {
  const { cx, cy, outerRadius, index, data, chartHeight } = props
  // Recharts invokes `label` once per slice. We only want to compute
  // and draw the *entire* label set a single time (on the first slice)
  // so labels don't get stacked on top of themselves N times.
  if (index !== 0) return null
  const total = data.reduce((sum, d) => sum + (d.count || 0), 0)
  if (total <= 0) return null

  const RADIAN = Math.PI / 180
  const labelRadius = outerRadius + 22
  const lineInnerRadius = outerRadius + 4
  const lineBendRadius = outerRadius + 16
  const lineHeight = 12 // min vertical spacing between stacked labels
  const fontSize = 11
  const chartMargin = 10 // keep labels this far from the chart's top/bottom edge

  // Compute each slice's midpoint angle (in the same coordinate system
  // Recharts uses: 0deg = 3 o'clock, increasing counter-clockwise) and
  // its natural (unclamped) label position.
  let cumulative = 0
  const items = data.map((d) => {
    const value = d.count || 0
    const fraction = value / total
    const startAngle = 90 - (cumulative / total) * 360
    cumulative += value
    const endAngle = 90 - (cumulative / total) * 360
    const midAngle = (startAngle + endAngle) / 2
    const angleRad = -midAngle * RADIAN
    const x = cx + labelRadius * Math.cos(angleRad)
    const y = cy + labelRadius * Math.sin(angleRad)
    const anchorX = cx + lineInnerRadius * Math.cos(angleRad)
    const anchorY = cy + lineInnerRadius * Math.sin(angleRad)
    const bendX = cx + lineBendRadius * Math.cos(angleRad)
    return {
      name: d.disposition,
      value,
      fraction,
      side: Math.cos(angleRad) >= 0 ? 'right' : 'left',
      x,
      y,
      anchorX,
      anchorY,
      bendX,
    }
  }).filter((it) => it.value > 0)

  // Resolve vertical overlaps independently on each side of the pie,
  // since labels on the left never collide with labels on the right.
  const sides: Array<typeof items> = [
    items.filter((it) => it.side === 'right').sort((a, b) => a.y - b.y),
    items.filter((it) => it.side === 'left').sort((a, b) => a.y - b.y),
  ]

  sides.forEach((group) => {
    if (group.length === 0) return
    // Capture each label's natural (pre-collision) y and their average —
    // this is the vertical center we want the final stack to sit on.
    const idealMid = group.reduce((s, it) => s + it.y, 0) / group.length

    // Push labels down if they're too close to the one above them.
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]
      const cur = group[i]
      if (cur.y - prev.y < lineHeight) {
        cur.y = prev.y + lineHeight
      }
    }

    // If every disposition has a label, a long stack can end up taller
    // than the chart itself. Rather than let it run off the top/bottom,
    // compress the spacing just enough for the whole stack to fit,
    // while still keeping strict top-to-bottom ordering (never re-overlaps).
    const availableHeight = chartHeight - 2 * chartMargin
    const stackHeight = group[group.length - 1].y - group[0].y
    if (stackHeight > availableHeight && group.length > 1) {
      const scale = availableHeight / stackHeight
      const base = group[0].y
      group.forEach((it) => { it.y = base + (it.y - base) * scale })
    }

    // Re-center the resulting stack on that original midpoint so it
    // doesn't drift toward the bottom of the chart.
    const first = group[0]
    const last = group[group.length - 1]
    const naturalMid = (first.y + last.y) / 2
    const shift = idealMid - naturalMid
    group.forEach((it) => { it.y += shift })

    // Final safety clamp: keep the whole stack within the chart bounds
    // even after re-centering, sliding it up/down as one unit.
    const top = group[0].y
    const bottom = group[group.length - 1].y
    if (top < chartMargin) {
      const nudge = chartMargin - top
      group.forEach((it) => { it.y += nudge })
    } else if (bottom > chartHeight - chartMargin) {
      const nudge = bottom - (chartHeight - chartMargin)
      group.forEach((it) => { it.y -= nudge })
    }
  })

  return (
    <g>
      {items.map((it, i) => {
        const textAnchor = it.side === 'right' ? 'start' : 'end'
        const labelX = it.side === 'right' ? it.x + 4 : it.x - 4
        return (
          <g key={i}>
            <polyline
              points={`${it.anchorX},${it.anchorY} ${it.bendX},${it.y} ${it.x},${it.y}`}
              fill="none"
              stroke={T.muted}
              strokeWidth={1}
            />
            <text
              x={labelX}
              y={it.y}
              dy={4}
              textAnchor={textAnchor}
              fontSize={fontSize}
              fill={T.text}
            >
              {it.name}
            </text>
          </g>
        )
      })}
    </g>
  )
}

type Range = 'today' | 'week' | 'month' | 'all' | 'custom'

function getRangeBounds(range: Range, customStart?: string, customEnd?: string): { start: string | null; end: string | null } {
  if (range === 'all') return { start: null, end: null }
  const now = new Date()

  if (range === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }
  if (range === 'week') {
    
    
    
    const start = new Date(now)
    start.setDate(start.getDate() - start.getDay())
    start.setHours(0, 0, 0, 0)
    return { start: start.toISOString(), end: now.toISOString() }
  }
  if (range === 'month') {
    
    
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return { start: start.toISOString(), end: now.toISOString() }
  }
  if (range === 'custom') {
    if (!customStart || !customEnd) return { start: null, end: null }
    const start = new Date(customStart); start.setHours(0, 0, 0, 0)
    const end = new Date(customEnd); end.setHours(23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }
  return { start: null, end: null }
}

function todayBounds() {
  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(now); end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}




function weekBounds() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - start.getDay())
  start.setHours(0, 0, 0, 0)
  return { start: start.toISOString(), end: now.toISOString() }
}

function formatDuration(seconds: number) {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatHours(seconds: number) {
  const hours = seconds / 3600
  if (hours >= 10) return `${Math.round(hours)}h`
  if (hours >= 1) return `${hours.toFixed(1)}h`
  if (hours > 0) {
    const m = Math.round(seconds / 60)
    return `${m}m`
  }
  return '0h'
}

function buildEmptySeries(range: Range): any[] {
  const points = range === 'today' ? 12 : 14
  const out: any[] = []
  for (let i = 0; i < points; i++) {
    out.push({
      label: range === 'today' ? `${i * 2}:00` : `D${i + 1}`,
      calls: 0,
      conversionRate: 0,
    })
  }
  return out
}

const EMPTY_DISPOSITIONS = [
  { disposition: 'NO DATA', count: 1 },
]

const EMPTY_CAMPAIGNS = [
  { name: '—', total: 0, contacted: 0, converted: 0 },
]

export default function AnalyticsPage() {
  const { user } = useUser()
  const router = useRouter()
  const [adminChecked, setAdminChecked] = useState(false)
  const [range, setRange] = useState<Range>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [secondarySummary, setSecondarySummary] = useState<any>(null)
  const [series, setSeries] = useState<any[]>([])
  const [dispositions, setDispositions] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  
  useEffect(() => {
    if (!user) return
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => {
        if (d.isAdmin) {
          router.replace('/dashboard/admin/analytics')
        } else {
          setAdminChecked(true)
        }
      })
      .catch(() => setAdminChecked(true))
  }, [user, router])

  const bounds = useMemo(() => getRangeBounds(range, customStart, customEnd), [range, customStart, customEnd])

  
  
  const secondaryBounds = useMemo(() => {
    return range === 'today' ? weekBounds() : todayBounds()
  }, [range])

  const secondaryLabel = range === 'today' ? 'This week' : 'Today'

  useEffect(() => {
    if (!user || !adminChecked) return
    if (range === 'custom' && (!customStart || !customEnd)) return

    const params = new URLSearchParams({ user_id: user.id })
    if (bounds.start) params.append('start', bounds.start)
    if (bounds.end) params.append('end', bounds.end)

    const tsParams = new URLSearchParams(params)
    tsParams.append('bucket', range === 'today' ? 'hour' : 'day')

    const secondaryParams = new URLSearchParams({
      user_id: user.id,
      start: secondaryBounds.start,
      end: secondaryBounds.end,
    })

    setLoading(true)
    Promise.all([
      fetch(`/api/analytics/summary?${params}`).then(r => r.json()),
      fetch(`/api/analytics/timeseries?${tsParams}`).then(r => r.json()),
      fetch(`/api/analytics/dispositions?${params}`).then(r => r.json()),
      fetch(`/api/analytics/campaigns?${params}`).then(r => r.json()),
      fetch(`/api/analytics/summary?${secondaryParams}`).then(r => r.json()),
    ]).then(([s, ts, d, c, sec]) => {
      if (s.success) setSummary(s.summary)
      if (ts.success) setSeries(ts.series)
      if (d.success) setDispositions(d.breakdown)
      if (c.success) setCampaigns(c.breakdown)
      if (sec.success) setSecondarySummary(sec.summary)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user, adminChecked, range, customStart, customEnd, bounds.start, bounds.end, secondaryBounds.start, secondaryBounds.end])

  const ranges: { key: Range; label: string }[] = [
    { key: 'today', label: 'TODAY' },
    { key: 'week', label: 'WEEK' },
    { key: 'month', label: 'MONTH' },
    { key: 'all', label: 'ALL TIME' },
    { key: 'custom', label: 'CUSTOM' },
  ]

  const s = summary || {
    totalCalls: 0,
    contactsReached: 0,
    contactRate: 0,
    conversions: 0,
    conversionRate: 0,
    closed: 0,
    appointments: 0,
    totalDuration: 0,
    avgCallLength: 0,
    bestCampaign: null,
    bestCampaignRate: 0,
  }

  const sec = secondarySummary || {
    totalCalls: 0,
    totalDuration: 0,
    conversions: 0,
    closed: 0,
  }

  const hasData = !!summary && summary.totalCalls > 0
  const seriesToRender = series.length > 0 ? series : buildEmptySeries(range)
  const dispositionsToRender = dispositions.length > 0 ? dispositions : EMPTY_DISPOSITIONS
  const campaignsToRender = campaigns.length > 0 ? campaigns : EMPTY_CAMPAIGNS

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ').toUpperCase()
    : ''

  if (!adminChecked) {
    return (
      <div style={{
        flex: 1, background: 'var(--brand-page-bg)',
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, letterSpacing: 3, color: 'var(--brand-muted-text)',
      }}>LOADING...</div>
    )
  }

  return (
    <div className="analytics-root" style={{
      flex: 1,
      background: 'var(--brand-page-bg)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }}>
      <style>{`
        .analytics-root * { box-sizing: border-box; }

        /* ── DESKTOP HEADER (default) ──────────────────────────────────── */
        /* Flex row — title, range tabs, spacer pushing the LANDING button  */
        /* to the far right. Original behavior preserved.                   */
        .analytics-header {
          background: var(--brand-header-bg);
          padding: 12px 20px;
          border-bottom: 2px solid var(--brand-header-top-accent);
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .analytics-header-title-row { display: contents; }
        .analytics-header-spacer { flex: 1 1 auto; }

        .landing-page-btn {
          padding: 6px 14px;
          background: var(--brand-primary-soft);
          border: 1px solid var(--brand-primary);
          border-radius: 4px;
          font-size: 10px;
          letter-spacing: 2px;
          color: var(--brand-primary);
          cursor: pointer;
          font-family: 'Futura PT', Futura, sans-serif;
          font-weight: bold;
          text-decoration: none;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .landing-page-btn:hover {
          background: color-mix(in srgb, var(--brand-primary) 18%, transparent);
        }

        .welcome-row {
          background: var(--brand-page-bg);
          padding: 18px 20px 4px;
        }
        .welcome-line {
          font-size: 18px;
          font-weight: bold;
          color: var(--brand-on-page-bg);
          letter-spacing: 2px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .range-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
        .range-tab {
          padding: 6px 14px;
          background: transparent;
          border: 1px solid var(--brand-sidebar-active-bg);
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 2px;
          color: var(--brand-on-header-muted);
          cursor: pointer;
          font-family: 'Futura PT', Futura, sans-serif;
          font-weight: bold;
        }
        .range-tab.active {
          background: var(--brand-primary);
          border-color: var(--brand-primary);
          color: var(--brand-on-primary);
        }
        .custom-range { display: flex; gap: 6px; align-items: center; }
        .custom-range input {
          padding: 4px 8px;
          background: var(--brand-sidebar-active-bg);
          border: 1px solid var(--brand-sidebar-active-bg);
          border-radius: 3px;
          color: var(--brand-on-header);
          font-size: 11px;
          font-family: monospace;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          padding: 16px;
        }
        .stat-card {
          padding: 12px 14px;
          background: var(--brand-card-surface);
          border: 1px solid var(--brand-card-border);
          border-radius: 4px;
          border-top: 3px solid var(--brand-primary);
          position: relative;
        }
        .stat-card.empty { opacity: 0.55; }
        .stat-label {
          font-size: 9px;
          letter-spacing: 2px;
          color: var(--brand-muted-text);
          margin-bottom: 6px;
          font-weight: bold;
        }
        .stat-value {
          font-size: 22px;
          font-weight: bold;
          font-family: monospace;
          color: var(--brand-on-page-bg);
          letter-spacing: -0.5px;
        }
        .stat-sub {
          font-size: 10px;
          color: var(--brand-muted-text);
          margin-top: 4px;
          font-family: monospace;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 0 16px 16px;
        }
        .chart-card {
          background: var(--brand-card-surface);
          border: 1px solid var(--brand-card-border);
          border-radius: 4px;
          padding: 14px;
          position: relative;
        }
        .chart-title {
          font-size: 10px;
          letter-spacing: 3px;
          color: var(--brand-muted-text);
          margin-bottom: 12px;
          font-weight: bold;
        }
        .chart-empty-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 2;
        }
        .chart-empty-pill {
          background: #363647;
          color: #ffffff;
          font-size: 10px;
          letter-spacing: 3px;
          font-weight: bold;
          padding: 8px 18px;
          border-radius: 4px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .chart-faded { opacity: 0.35; }
        .empty-state {
          padding: 60px 20px;
          text-align: center;
          font-size: 11px;
          letter-spacing: 3px;
          color: var(--brand-muted-text);
        }

        /* ── MOBILE HEADER (≤ 768px) ───────────────────────────────────── */
        /* Two-row layout:                                                  */
        /*   Row 1: ANALYTICS OVERVIEW [left] · LANDING PAGE → [right]      */
        /*   Row 2: range tabs spanning full width                          */
        /* This puts the LANDING button at the same vertical level as the   */
        /* page title, which is what you asked for.                         */
        @media (max-width: 768px) {
          .analytics-header {
            padding: 10px 12px;
            display: grid;
            grid-template-columns: 1fr auto;
            grid-template-areas:
              "title  landing"
              "tabs   tabs";
            gap: 10px 12px;
            align-items: center;
          }
          .analytics-header-title { grid-area: title; }
          .landing-page-btn {
            grid-area: landing;
            padding: 5px 10px;
            font-size: 9px;
            letter-spacing: 1.5px;
          }
          .range-tabs {
            grid-area: tabs;
            width: 100%;
            justify-content: flex-start;
          }
          .analytics-header-spacer { display: none; }

          .welcome-row { padding: 14px 12px 4px; }
          .welcome-line { font-size: 15px; letter-spacing: 1px; }
          .range-tab { padding: 6px 10px; font-size: 9px; letter-spacing: 1px; }
          .stat-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 12px;
            gap: 8px;
          }
          .stat-card { padding: 10px; }
          .stat-value { font-size: 18px; }
          .charts-grid {
            grid-template-columns: 1fr !important;
            padding: 0 12px 12px;
          }
          .custom-range { flex-wrap: wrap; grid-column: 1 / -1; }
        }
      `}</style>

      <div className="analytics-header">
        <span className="analytics-header-title" style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: 'var(--brand-primary)' }}>
          ANALYTICS OVERVIEW
        </span>
        <div className="range-tabs">
          {ranges.map(r => (
            <button
              key={r.key}
              className={`range-tab ${range === r.key ? 'active' : ''}`}
              onClick={() => setRange(r.key)}
            >{r.label}</button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="custom-range">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
            />
            <span style={{ color: 'var(--brand-on-header-muted)', fontSize: 10 }}>→</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
            />
          </div>
        )}

        {/* Spacer — pushes LANDING button right on desktop. Hidden on mobile
            (replaced by grid placement). */}
        <div className="analytics-header-spacer" />

        {/*
          LANDING PAGE button — links to landing with ?view=landing param.
          Without that param, app/page.tsx would redirect us right back to
          /dashboard because logged-in users normally get sent there.
          The param tells page.tsx "render the landing for this visit".
        */}
        <Link href="/?view=landing" className="landing-page-btn">
          LANDING PAGE →
        </Link>
      </div>

      <div className="welcome-row">
        <div className="welcome-line">
          WELCOME BACK{fullName ? `, ${fullName}` : ''}.
        </div>
      </div>

      {loading ? (
        <div className="empty-state">LOADING ANALYTICS...</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className={`stat-card ${!hasData ? 'empty' : ''}`}>
              <div className="stat-label">TOTAL CALLS</div>
              <div className="stat-value">{(s.totalCalls || 0).toLocaleString()}</div>
              <div className="stat-sub">{secondaryLabel} {(sec.totalCalls || 0).toLocaleString()}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.accent }}>
              <div className="stat-label">HOURS DIALED</div>
              <div className="stat-value" style={{ color: T.accent }}>{formatHours(s.totalDuration || 0)}</div>
              <div className="stat-sub">{secondaryLabel} {formatHours(sec.totalDuration || 0)}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.green }}>
              <div className="stat-label">CONVERSIONS</div>
              <div className="stat-value" style={{ color: T.green }}>{(s.conversions || 0).toLocaleString()}</div>
              <div className="stat-sub">{secondaryLabel} {(sec.conversions || 0).toLocaleString()}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.green }}>
              <div className="stat-label">CLOSED</div>
              <div className="stat-value" style={{ color: T.green }}>{(s.closed || 0).toLocaleString()}</div>
              <div className="stat-sub">{secondaryLabel} {(sec.closed || 0).toLocaleString()}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`}>
              <div className="stat-label">TALK TIME</div>
              <div className="stat-value">{formatDuration(s.totalDuration || 0)}</div>
              <div className="stat-sub">avg {formatDuration(s.avgCallLength || 0)}/call</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.amber }}>
              <div className="stat-label">BEST CAMPAIGN</div>
              <div className="stat-value" style={{ fontSize: s.bestCampaign ? 13 : 22, color: T.amber }}>
                {s.bestCampaign || '—'}
              </div>
              <div className="stat-sub">{s.bestCampaign ? `${s.bestCampaignRate}% conv` : 'need 5+ calls'}</div>
            </div>
          </div>

          <div className="charts-grid">

            <div className="chart-card">
              <div className="chart-title">▸ CALL VOLUME OVER TIME</div>
              <div className={series.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={seriesToRender}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="label" stroke={T.muted} fontSize={10} />
                    <YAxis stroke={T.muted} fontSize={10} allowDecimals={false} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ background: 'var(--brand-sidebar-bg)', border: '1px solid var(--brand-card-border)', color: 'var(--brand-on-sidebar)', fontSize: 11 }} />
                    <Line type="monotone" dataKey="calls" stroke={T.blue} strokeWidth={2} dot={{ fill: T.blue, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {series.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">▸ CONVERSION RATE OVER TIME</div>
              <div className={series.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={seriesToRender}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="label" stroke={T.muted} fontSize={10} />
                    <YAxis stroke={T.muted} fontSize={10} unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: 'var(--brand-sidebar-bg)', border: '1px solid var(--brand-card-border)', color: 'var(--brand-on-sidebar)', fontSize: 11 }}
                      formatter={(v: any) => `${v}%`}
                    />
                    <Line type="monotone" dataKey="conversionRate" stroke={T.green} strokeWidth={2} dot={{ fill: T.green, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {series.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">▸ DISPOSITION BREAKDOWN</div>
              <div className={dispositions.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={dispositionsToRender}
                      dataKey="count"
                      nameKey="disposition"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={(props: any) => renderDispositionLabels({ ...props, data: dispositionsToRender, chartHeight: 240 })}
                      labelLine={false}
                    >
                      {dispositionsToRender.map((d, i) => (
                        <Cell key={i} fill={DISPOSITION_COLORS[d.disposition] || '#bbb'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--brand-sidebar-bg)', border: '1px solid var(--brand-card-border)', color: 'var(--brand-on-sidebar)', fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {dispositions.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">▸ CAMPAIGN PERFORMANCE</div>
              <div className={campaigns.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={campaignsToRender} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="name" stroke={T.muted} fontSize={9} />
                    <YAxis stroke={T.muted} fontSize={10} allowDecimals={false} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ background: 'var(--brand-sidebar-bg)', border: '1px solid var(--brand-card-border)', color: 'var(--brand-on-sidebar)', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="total" fill={T.blue} name="Total" />
                    <Bar dataKey="contacted" fill={T.accent} name="Contacted" />
                    <Bar dataKey="converted" fill={T.green} name="Converted" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {campaigns.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}