'use client'

import { useEffect, useState, useCallback, useId } from 'react'

const BG = '#0e1014'
const PANEL = '#15181e'
const HAIRLINE = '#232732'
const TEXT = '#e6e9ef'
const MUTED = '#8b93a3'
const DIM = '#6b7280'
const LINE = '#4a9eff'
const LINE2 = '#32c48d'

const RANGES = [
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
]

function n(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString()
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
      padding: '12px 14px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
        color: MUTED, marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: DIM, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

/**
 * Views and visitors on one chart, on ONE axis.
 *
 * They share a unit — both are counts of the same kind of thing — so a single
 * scale is honest and the gap between the lines is itself the information:
 * wide means people are reading several pages, narrow means they arrive and
 * leave. Two axes would let that gap be anything the scaling chose.
 */
function TrafficChart({ series }: { series: Array<{ label: string; views: number; visitors: number }> }) {
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId()

  if (series.length === 0) {
    return (
      <div style={{ height: 220, display: 'grid', placeItems: 'center', color: DIM, fontSize: 12 }}>
        No views recorded yet
      </div>
    )
  }

  const W = 900
  const H = 220
  const PAD_L = 44
  const PAD_B = 26
  const PAD_T = 12
  const innerW = W - PAD_L - 12
  const innerH = H - PAD_B - PAD_T

  const max = Math.max(...series.map(p => p.views), 1)
  const x = (i: number) =>
    series.length === 1 ? PAD_L + innerW / 2 : PAD_L + (i / (series.length - 1)) * innerW
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH

  const line = (key: 'views' | 'visitors') =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p[key])}`).join(' ')

  const area = `${line('views')} L ${x(series.length - 1)} ${PAD_T + innerH} L ${x(0)} ${PAD_T + innerH} Z`
  const ticks = [0, max / 2, max]

  // Only ever a handful of x labels. One per day across 90 days is a smear.
  const step = Math.max(1, Math.ceil(series.length / 7))

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', minWidth: 420, display: 'block' }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`v${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={LINE} stopOpacity="0.26" />
            <stop offset="100%" stopColor={LINE} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={y(t)} x2={W - 12} y2={y(t)} stroke={HAIRLINE} strokeWidth="1" />
            <text x={PAD_L - 7} y={y(t) + 3} textAnchor="end" fontSize="9" fill={DIM}>
              {Math.round(t).toLocaleString()}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#v${gid})`} />
        <path d={line('views')} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
        <path d={line('visitors')} fill="none" stroke={LINE2} strokeWidth="2" strokeLinejoin="round" strokeDasharray="4 3" />

        {hover !== null && (
          <>
            <line
              x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={PAD_T + innerH}
              stroke={LINE} strokeWidth="1" strokeDasharray="3 3" opacity="0.55"
            />
            <circle cx={x(hover)} cy={y(series[hover].views)} r="4" fill={LINE} stroke={PANEL} strokeWidth="2" />
            <circle cx={x(hover)} cy={y(series[hover].visitors)} r="4" fill={LINE2} stroke={PANEL} strokeWidth="2" />
          </>
        )}

        {series.map((p, i) => (
          <rect
            key={i}
            x={x(i) - innerW / Math.max(series.length, 1) / 2}
            y={PAD_T}
            width={innerW / Math.max(series.length, 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {series.map((p, i) => (
          i % step === 0 ? (
            <text key={`l${i}`} x={x(i)} y={H - 8} fontSize="9" fill={DIM} textAnchor="middle">
              {p.label.length === 10 ? p.label.slice(5) : p.label}
            </text>
          ) : null
        ))}
      </svg>

      {hover !== null && (
        <div style={{
          position: 'absolute', top: 6, right: 12,
          background: BG, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
          padding: '6px 10px', fontSize: 11, color: TEXT, pointerEvents: 'none',
          fontFamily: 'monospace',
        }}>
          <div style={{ color: MUTED, marginBottom: 2 }}>{series[hover].label}</div>
          <div><span style={{ color: LINE }}>■</span> {n(series[hover].views)} views</div>
          <div><span style={{ color: LINE2 }}>■</span> {n(series[hover].visitors)} visitors</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 10.5, color: DIM }}>
        <span><span style={{ color: LINE }}>■</span> Views</span>
        <span><span style={{ color: LINE2 }}>■</span> Unique visitors</span>
      </div>
    </div>
  )
}

function BarRow({ label, value, max, sub }: {
  label: string; value: number; max: number; sub?: string
}) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11.5, marginBottom: 3 }}>
        <span style={{
          color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', fontFamily: 'monospace',
        }}>{label}</span>
        <span style={{ color: DIM, flexShrink: 0 }}>
          {n(value)}{sub ? ` · ${sub}` : ''}
        </span>
      </div>
      <div style={{ height: 5, background: HAIRLINE, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: LINE, borderRadius: 3 }} />
      </div>
    </div>
  )
}

export default function Visibility() {
  const [range, setRange] = useState('30d')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/visibility?range=${range}`).then(x => x.json())
      setData(r.success ? r : null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])

  const t = data?.totals
  const topPages = data?.topPages || []
  const maxPage = Math.max(...topPages.map((p: any) => p.views), 1)
  const referrers = data?.referrers || []
  const maxRef = Math.max(...referrers.map((r: any) => r.views), 1)

  return (
    <div style={{
      background: BG, color: TEXT, minHeight: '100%', padding: 16,
      fontFamily: "'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Visibility</div>
          <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>
            Site traffic across every page
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                background: range === r.key ? LINE : 'transparent',
                border: `1px solid ${range === r.key ? LINE : HAIRLINE}`,
                color: range === r.key ? '#06080c' : MUTED,
                borderRadius: 4, padding: '6px 12px', fontSize: 11,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div style={{ color: DIM, fontSize: 12 }}>Loading…</div>
      ) : !data ? (
        <div style={{ color: '#ff6464', fontSize: 12 }}>Could not load traffic.</div>
      ) : (
        <>
          <div style={{
            display: 'grid', gap: 10, marginBottom: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}>
            <Tile label="Views today" value={n(t.viewsToday)} sub={`${n(t.visitorsToday)} visitors`} />
            <Tile label={`Views · ${range}`} value={n(t.views)} />
            <Tile label={`Visitors · ${range}`} value={n(t.visitors)} sub="unique per day" />
            <Tile
              label="Signed in"
              value={t.views > 0 ? `${Math.round((t.authedViews / t.views) * 100)}%` : '—'}
              sub={`${n(t.anonViews)} anonymous`}
            />
          </div>

          {data.truncated && (
            // Said out loud rather than shown as a smaller number pretending to
            // be the whole picture.
            <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 10 }}>
              More views than this window can read — the figures below are a floor,
              not a total.
            </div>
          )}

          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
            padding: '12px 14px 14px', marginBottom: 14,
          }}>
            <TrafficChart series={data.series || []} />
          </div>

          <div style={{
            display: 'grid', gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}>
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 12,
              }}>Most viewed pages</div>
              {topPages.length === 0 ? (
                <div style={{ color: DIM, fontSize: 12 }}>Nothing yet.</div>
              ) : (
                topPages.map((p: any) => (
                  <BarRow
                    key={p.path}
                    label={p.path}
                    value={p.views}
                    max={maxPage}
                    sub={`${n(p.visitors)} visitors`}
                  />
                ))
              )}
            </div>

            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 12,
              }}>Where they came from</div>
              {referrers.length === 0 ? (
                <div style={{ color: DIM, fontSize: 12, lineHeight: 1.7 }}>
                  No external referrers yet — everything so far arrived directly or
                  with the referrer stripped.
                </div>
              ) : (
                referrers.map((r: any) => (
                  <BarRow key={r.host} label={r.host} value={r.views} max={maxRef} />
                ))
              )}

              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, margin: '18px 0 10px',
              }}>Devices</div>
              {(data.devices || []).map((d: any) => (
                <BarRow
                  key={d.device}
                  label={d.device}
                  value={d.views}
                  max={Math.max(...(data.devices || []).map((x: any) => x.views), 1)}
                />
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10.5, color: DIM, marginTop: 14, lineHeight: 1.7 }}>
            Counted without storing IP addresses, user agents or user ids. A
            visitor is identified by a hash that rotates daily, so uniques are
            per-day and cannot be linked across days — including by us.
          </div>
        </>
      )}
    </div>
  )
}
