'use client'

import { useId, useState } from 'react'

const PANEL = '#232428'
const HAIRLINE = '#1a1b1e'
const TEXT = '#f2f3f5'
const MUTED = '#949ba4'
const DIM = '#80848e'

// ── PALETTE ──────────────────────────────────────────────────────────────
// Categorical hues assigned in fixed order and never cycled, so a series keeps
// its colour when a filter changes the number of series. Colour follows the
// entity, never its rank — a chart where the survivors get repainted after a
// filter is a chart nobody can compare against the one they saw a second ago.
const SERIES = ['#4a9eff', '#32c48d', '#c4884a', '#a37bd8', '#d86a8a', '#4ac0c4']
const GRID = '#2a2c31'

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
            <line x1={PAD_L} y1={y(t)} x2={W - 8} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD_L - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={DIM}>
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
            stroke={PANEL}
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

        <text x={PAD_L} y={H - 6} fontSize="9" fill={DIM}>{points[0].label}</text>
        {points.length > 1 && (
          <text x={W - 8} y={H - 6} fontSize="9" fill={DIM} textAnchor="end">
            {points[points.length - 1].label}
          </text>
        )}
      </svg>

      {hover !== null && (
        <div style={{
          position: 'absolute', top: 4, right: 8,
          background: '#0d0f13', border: `1px solid ${HAIRLINE}`,
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

export function DispositionChart({ points }: { points: Point[] }) {
  return (
    <Card title="Disposition Breakdown">
      <BarList points={points} colorByIndex />
    </Card>
  )
}

export function CampaignChart({ points }: { points: CampaignPoint[] }) {
  return (
    <Card
      title="Campaign Performance"
      subtitle={points.length > 0 ? 'Calls placed, with conversions' : undefined}
    >
      {points.length === 0 ? <Empty /> : (
        <div style={{ display: 'grid', gap: 8, paddingTop: 2 }}>
          {points.map(p => {
            const max = Math.max(...points.map(x => x.value), 1)
            const rate = p.value > 0 ? Math.round((p.conversions / p.value) * 1000) / 10 : 0
            return (
              <div key={p.label}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 11.5, marginBottom: 3,
                }}>
                  <span style={{ color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.label}
                  </span>
                  <span style={{ color: DIM, flexShrink: 0, marginLeft: 10 }}>
                    {p.value.toLocaleString()} · {rate}%
                  </span>
                </div>
                {/* Two marks, 2px apart, so the conversions bar reads as part of
                    the calls bar rather than a second unrelated series. */}
                <div style={{ height: 6, background: GRID, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${(p.value / max) * 100}%`, height: '100%',
                    background: SERIES[0], borderRadius: 3,
                  }} />
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: `${(p.conversions / max) * 100}%`, height: '100%',
                    background: SERIES[1], borderRadius: 3,
                    boxShadow: `0 0 0 2px ${PANEL}`,
                  }} />
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 10.5, color: DIM }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: SERIES[0], borderRadius: 2, marginRight: 5 }} />Calls</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: SERIES[1], borderRadius: 2, marginRight: 5 }} />Conversions</span>
          </div>
        </div>
      )}
    </Card>
  )
}
