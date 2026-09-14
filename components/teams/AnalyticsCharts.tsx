'use client'

import { useId, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { DISPOSITION_COLORS, renderDispositionLabels } from '@/components/analytics/dispositionPie'

// ── COLOURS COME FROM THE TENANT, VIA STYLE NOT ATTRIBUTES ───────────────
// The rest of the teams area reads --brand-* variables. These charts could
// not, because their colours were handed to SVG PRESENTATION ATTRIBUTES
// (stroke=, fill=) — and var() is a CSS value, not an attribute value, so
// stroke="var(--x)" is simply an invalid colour in most browsers. The chart
// would have rendered black, or not at all.
//
// The same declarations work fine as CSS, so the ones carrying brand colours
// moved into style objects. `color` stays an attribute: it is a real hex the
// caller passes in, and an attribute is the simpler form where it works.
//
// Fallbacks are the previous hex values, so an install with no tenant
// branding draws exactly the chart it drew before.
const PANEL = 'var(--teams-panel, #232428)'
const HAIRLINE = 'var(--teams-border, #1a1b1e)'
const TEXT = 'var(--teams-text, #f2f3f5)'
const MUTED = 'var(--teams-muted, #949ba4)'
const DIM = 'var(--teams-muted, #80848e)'

// ── PALETTE ──────────────────────────────────────────────────────────────
// Categorical hues assigned in fixed order and never cycled, so a series keeps
// its colour when a filter changes the number of series. Colour follows the
// entity, never its rank — a chart where the survivors get repainted after a
// filter is a chart nobody can compare against the one they saw a second ago.
const SERIES = ['#4a9eff', '#32c48d', '#c4884a', '#a37bd8', '#d86a8a', '#4ac0c4']
const GRID = 'var(--teams-border, #2a2c31)'

/** One tooltip style for both charts, matching the rest of the teams area. */
const TOOLTIP = {
  background: 'var(--teams-panel, #232428)',
  border: '1px solid var(--teams-border, #1a1b1e)',
  color: 'var(--teams-text, #f2f3f5)',
  fontSize: 11,
} as const

export interface Point { label: string; value: number }
export interface CampaignPoint extends Point { conversions: number }

function Card({ title, subtitle, children }: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
      padding: '12px 14px 16px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
        color: MUTED, marginBottom: subtitle ? 2 : 12,
      }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: DIM, marginBottom: 10 }}>{subtitle}</div>
      )}
      {children}
    </div>
  )
}

function Empty() {
  return (
    <div style={{ height: 200, display: 'grid', placeItems: 'center', color: DIM, fontSize: 12 }}>
      No calls in this range
    </div>
  )
}

/**
 * Line chart with a crosshair. An HTML chart IS interactive, so it ships with a
 * hover layer by default — reading an exact value off a line by eye is a thing
 * people give up on rather than complain about.
 */
export function LineChart({ points, unit = '', color = SERIES[0] }: {
  points: Point[]
  unit?: string
  color?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId()

  if (points.length === 0) return <Empty />

  const W = 560
  const H = 200
  const PAD_L = 34
  const PAD_B = 22
  const PAD_T = 10

  const max = Math.max(...points.map(p => p.value), 1)
  const innerW = W - PAD_L - 8
  const innerH = H - PAD_B - PAD_T

  const x = (i: number) =>
    points.length === 1 ? PAD_L + innerW / 2 : PAD_L + (i / (points.length - 1)) * innerW
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ')
  const area = `${path} L ${x(points.length - 1)} ${PAD_T + innerH} L ${x(0)} ${PAD_T + innerH} Z`

  // Only ever three gridlines. A chart with a label on every tick is a table
  // that has been made harder to read.
  const ticks = [0, max / 2, max]

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', minWidth: 280, display: 'block' }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={y(t)} x2={W - 8} y2={y(t)} style={{ stroke: GRID }} strokeWidth="1" />
            <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize="9" style={{ fill: DIM }}>
              {Math.round(t)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#g${gid})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={hover === i ? 4 : 0}
            fill={color}
            style={{ stroke: PANEL }}
            strokeWidth="2"
          />
        ))}

        {hover !== null && (
          <line
            x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={PAD_T + innerH}
            stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
          />
        )}

        {/* Hit targets wider than the marks — a 2px line is not something a
            mouse can be expected to find. */}
        {points.map((p, i) => (
          <rect
            key={`h${i}`}
            x={x(i) - innerW / Math.max(points.length, 1) / 2}
            y={PAD_T}
            width={innerW / Math.max(points.length, 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        <text x={PAD_L} y={H - 6} fontSize="9" style={{ fill: DIM }}>{points[0].label}</text>
        {points.length > 1 && (
          <text x={W - 8} y={H - 6} fontSize="9" style={{ fill: DIM }} textAnchor="end">
            {points[points.length - 1].label}
          </text>
        )}
      </svg>

      {hover !== null && (
        <div style={{
          position: 'absolute', top: 4, right: 8,
          background: 'var(--teams-field, #0d0f13)', border: `1px solid ${HAIRLINE}`,
          borderRadius: 3, padding: '4px 8px', fontSize: 11, color: TEXT,
          pointerEvents: 'none',
        }}>
          {points[hover].label} · <strong>{points[hover].value}{unit}</strong>
        </div>
      )}
    </div>
  )
}

/** Horizontal bars — the right form when the labels are words rather than
 *  times, because a vertical bar chart makes the reader tilt their head. */
export function BarList({ points, total, colorByIndex = false }: {
  points: Point[]
  total?: number
  colorByIndex?: boolean
}) {
  if (points.length === 0) return <Empty />
  const sum = total ?? points.reduce((n, p) => n + p.value, 0)
  const max = Math.max(...points.map(p => p.value), 1)

  return (
    <div style={{ display: 'grid', gap: 8, paddingTop: 2 }}>
      {points.map((p, i) => {
        const pct = sum > 0 ? Math.round((p.value / sum) * 100) : 0
        return (
          <div key={p.label} title={`${p.label}: ${p.value}`}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11.5, marginBottom: 3,
            }}>
              {/* Label in text ink, not the series colour — the swatch beside
                  it already carries identity, and coloured text just makes the
                  words harder to read. */}
              <span style={{ color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.label}
              </span>
              <span style={{ color: DIM, flexShrink: 0, marginLeft: 10 }}>
                {p.value.toLocaleString()}{sum > 0 && ` · ${pct}%`}
              </span>
            </div>
            <div style={{ height: 6, background: GRID, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${(p.value / max) * 100}%`,
                height: '100%',
                background: colorByIndex ? SERIES[i % SERIES.length] : SERIES[0],
                borderRadius: 3,
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function VolumeChart({ points }: { points: Point[] }) {
  return (
    <Card title="Call Volume Over Time">
      <LineChart points={points} />
    </Card>
  )
}

export function ConversionChart({ points }: { points: Point[] }) {
  return (
    <Card title="Conversion Rate Over Time">
      <LineChart points={points} unit="%" color={SERIES[1]} />
    </Card>
  )
}

export interface DispositionSlice {
  disposition: string
  label: string
  count: number
}

/**
 * The same pie the personal analytics page draws.
 *
 * This was a horizontal bar list, so the identical figure looked like two
 * different things depending on which screen you opened. The pie, its colours
 * and its label collision-avoidance now live in components/analytics and are
 * imported by both, rather than reimplemented here where they would drift.
 */
export function DispositionChart({ points }: { points: DispositionSlice[] }) {
  return (
    <Card title="Disposition Breakdown">
      {points.length === 0 ? <Empty /> : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={points}
              dataKey="count"
              // The label, not the stored value — so it reads "Not interested"
              // rather than NOT INTERESTED, and no legacy spelling reaches the
              // screen.
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={75}
              // recharts supplies cx/cy/outerRadius/index at call time, which
              // no static type here can know about, so the merged object is
              // cast through unknown rather than asserted to overlap.
              label={(props: unknown) => renderDispositionLabels({
                ...(props as object), data: points, chartHeight: 240,
              } as unknown as Parameters<typeof renderDispositionLabels>[0])}
              labelLine={false}
            >
              {points.map((d, i) => (
                <Cell key={i} fill={DISPOSITION_COLORS[d.disposition] || '#bbb'} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

export interface CampaignBar {
  name: string
  total: number
  contacted: number
  converted: number
}

/**
 * The same grouped bars the personal analytics page draws: total, contacted,
 * converted, side by side per campaign.
 *
 * It used to be one bar per campaign with conversions overlaid inside it,
 * which hid "contacted" entirely and made the conversion share hard to read
 * against anything but itself.
 */
export function CampaignChart({ points }: { points: CampaignBar[] }) {
  return (
    <Card title="Campaign Performance">
      {points.length === 0 ? <Empty /> : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={points} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="name" stroke={DIM} fontSize={9} />
            <YAxis stroke={DIM} fontSize={10} allowDecimals={false} domain={[0, 'auto']} />
            <Tooltip contentStyle={TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="total" fill={SERIES[0]} name="Total" />
            <Bar dataKey="contacted" fill={SERIES[3]} name="Contacted" />
            <Bar dataKey="converted" fill={SERIES[1]} name="Converted" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
