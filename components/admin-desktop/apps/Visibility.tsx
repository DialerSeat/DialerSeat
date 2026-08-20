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

function ms(v: number | null | undefined): string {
  if (!v) return '—'
  const sec = Math.round(v / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  return `${m}m ${sec % 60}s`
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
  IN: 'India', PH: 'Philippines', MX: 'Mexico', DE: 'Germany', FR: 'France',
  NL: 'Netherlands', BR: 'Brazil', PK: 'Pakistan', NG: 'Nigeria', ES: 'Spain',
}

/** A small histogram — hours of the day, days of the week. Not a line, because
 *  these are buckets rather than a series over time, and a line implies a
 *  continuity between 23:00 and 00:00 that does not exist. */
function Histogram({ rows, highlight }: {
  rows: Array<{ label: string; views: number }>
  highlight?: string
}) {
  const max = Math.max(...rows.map(r => r.views), 1)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 90 }}>
      {rows.map(r => (
        <div
          key={r.label}
          title={`${r.label} — ${r.views.toLocaleString()} views`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}
        >
          <div style={{
            width: '100%',
            height: Math.max(2, (r.views / max) * 68),
            background: r.label === highlight ? LINE2 : LINE,
            opacity: r.views === 0 ? 0.18 : 1,
            borderRadius: '2px 2px 0 0',
          }} />
          <span style={{
            fontSize: 8, color: DIM, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'clip',
          }}>{r.label.length > 3 ? r.label.slice(0, 2) : r.label}</span>
        </div>
      ))}
    </div>
  )
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

/**
 * A ranked table where the bar is the row's background.
 *
 * A bar list reads magnitude well but truncates a long path to uselessness on
 * a phone — "/dashboard/campaig…" tells you nothing about which page it was.
 * A table keeps the full path, scrolls sideways when it has to, and lines the
 * numbers up so two rows can actually be compared. Putting the bar behind the
 * text keeps the at-a-glance shape without spending a column on it.
 */
function RankTable({ rows, labelHead, withVisitors }: {
  rows: Array<{ label: string; value: number; visitors?: number }>
  labelHead: string
  withVisitors?: boolean
}) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="vz-wrap">
      <table className="vz-t">
        <thead>
          <tr>
            <th>{labelHead}</th>
            <th className="num">Views</th>
            {withVisitors && <th className="num">Visitors</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr
              key={r.label}
              style={{
                background: `linear-gradient(to right, ${LINE}22 ${(r.value / max) * 100}%, transparent ${(r.value / max) * 100}%)`,
              }}
            >
              <td className="vz-path" title={r.label}>{r.label}</td>
              <td className="num">{n(r.value)}</td>
              {withVisitors && <td className="num" style={{ color: DIM }}>{n(r.visitors)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
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
  const referrers = data?.referrers || []

  return (
    // AppWindow is overflow:hidden by design — every app manages its own
    // scroll. This one did not, so on a phone the tables below simply had
    // nowhere to go and the bottom of the app was unreachable.
    <div style={{
      background: BG, color: TEXT, height: '100%', overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      padding: 16, boxSizing: 'border-box',
      fontFamily: "'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      <style>{`
        .vz-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .vz-t { width: 100%; border-collapse: collapse; min-width: 340px; }
        .vz-t th {
          text-align: left; font-size: 9px; letter-spacing: 1px;
          text-transform: uppercase; color: ${MUTED}; font-weight: 700;
          padding: 0 8px 6px; border-bottom: 1px solid ${HAIRLINE};
          white-space: nowrap;
        }
        .vz-t td {
          font-size: 11.5px; padding: 7px 8px; color: ${TEXT};
          border-bottom: 1px solid ${HAIRLINE};
        }
        .vz-t td.num, .vz-t th.num {
          text-align: right; font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        /* The bar lives BEHIND the path rather than beside it. A separate bar
           column costs width that a long URL needs, and magnitude at a glance
           is exactly what a bar is for — so it becomes the row's background
           and the path keeps the whole cell. */
        .vz-path {
          font-family: monospace; white-space: nowrap;
          max-width: 460px; overflow: hidden; text-overflow: ellipsis;
        }
      `}</style>
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
            <Tile
              label="Pages per visit"
              value={t.pagesPerVisit === null || t.pagesPerVisit === undefined ? '—' : String(t.pagesPerVisit)}
              sub={
                t.singlePageRate === null || t.singlePageRate === undefined
                  ? undefined
                  : `${t.singlePageRate}% saw one page`
              }
            />
            <Tile
              label="Time on page"
              value={ms(t.avgDwellMs)}
              // Coverage stated beside the average, because a figure built on
              // 8% of views is a different claim from one built on 90% — and a
              // reader deciding whether to act on it needs to know which.
              sub={
                t.dwellCoverage === null || t.dwellCoverage === undefined
                  ? 'no timings yet'
                  : `measured on ${t.dwellCoverage}% of views`
              }
            />
            <Tile
              label="vs previous"
              value={
                t.changePct === null || t.changePct === undefined
                  ? '—'
                  : `${t.changePct >= 0 ? '+' : ''}${t.changePct}%`
              }
              sub={`${n(t.previousViews)} before`}
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
                <RankTable
                  labelHead="Page"
                  withVisitors
                  rows={topPages.map((p: any) => ({
                    label: p.path, value: p.views, visitors: p.visitors,
                  }))}
                />
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
                <RankTable
                  labelHead="Source"
                  rows={referrers.map((r: any) => ({ label: r.host, value: r.views }))}
                />
              )}

              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, margin: '18px 0 10px',
              }}>Devices</div>
              <RankTable
                labelHead="Device"
                rows={(data.devices || []).map((d: any) => ({ label: d.device, value: d.views }))}
              />
            </div>
          </div>

          {/* ── HOW THEY ARRIVED ─────────────────────────────────────────
              Entry pages are a different question from most-viewed, and the
              more useful one for anything marketing: the busiest page is often
              somewhere people land AFTER arriving elsewhere. */}
          <div style={{
            display: 'grid', gap: 12, marginTop: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}>
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 4,
              }}>Landed on first</div>
              <div style={{ fontSize: 10.5, color: DIM, marginBottom: 10 }}>
                The page each visitor arrived on, per day
              </div>
              {(data.entryPages || []).length === 0 ? (
                <div style={{ color: DIM, fontSize: 12 }}>Nothing yet.</div>
              ) : (
                <RankTable
                  labelHead="Entry page"
                  rows={(data.entryPages || []).map((p: any) => ({
                    label: p.path, value: p.visits,
                  }))}
                />
              )}
            </div>

            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 4,
              }}>Held attention longest</div>
              <div style={{ fontSize: 10.5, color: DIM, marginBottom: 10 }}>
                Average time open · three or more timed views
              </div>
              {(data.dwellPages || []).length === 0 ? (
                <div style={{ color: DIM, fontSize: 12, lineHeight: 1.7 }}>
                  No timings yet. These appear once pages have been opened and
                  left a few times.
                </div>
              ) : (
                <div className="vz-wrap">
                  <table className="vz-t">
                    <thead>
                      <tr>
                        <th>Page</th>
                        <th className="num">Avg time</th>
                        <th className="num">Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.dwellPages || []).map((p: any) => (
                        <tr key={p.path}>
                          <td className="vz-path" title={p.path}>{p.path}</td>
                          <td className="num">{ms(p.avgMs)}</td>
                          <td className="num" style={{ color: DIM }}>{n(p.samples)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── WHEN ─────────────────────────────────────────────────────── */}
          <div style={{
            display: 'grid', gap: 12, marginTop: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}>
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 10,
              }}>Hour of day</div>
              <Histogram rows={data.byHour || []} />
            </div>

            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 10,
              }}>Day of week</div>
              <Histogram rows={data.byWeekday || []} />
            </div>
          </div>

          {/* ── WHO AND FROM WHERE ───────────────────────────────────────── */}
          <div style={{
            display: 'grid', gap: 12, marginTop: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}>
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 10,
              }}>Countries</div>
              {(data.countries || []).length === 0 ? (
                <div style={{ color: DIM, fontSize: 12, lineHeight: 1.7 }}>
                  No country data. This appears on deployed traffic — local
                  requests carry no location.
                </div>
              ) : (
                <RankTable
                  labelHead="Country"
                  rows={(data.countries || []).map((c: any) => ({
                    label: COUNTRY_NAMES[c.country] || c.country,
                    value: c.views,
                  }))}
                />
              )}
            </div>

            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
              padding: '12px 14px 14px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: MUTED, marginBottom: 4,
              }}>Campaigns</div>
              <div style={{ fontSize: 10.5, color: DIM, marginBottom: 10 }}>
                Traffic tagged with utm parameters
              </div>
              {(data.utmSources || []).length === 0 ? (
                <div style={{ color: DIM, fontSize: 12, lineHeight: 1.7 }}>
                  Nothing tagged yet. Add{' '}
                  <code style={{ color: MUTED }}>?utm_source=…&amp;utm_medium=…</code>{' '}
                  to a link and it shows up here.
                </div>
              ) : (
                <>
                  <RankTable
                    labelHead="Source / medium"
                    rows={(data.utmSources || []).map((u: any) => ({
                      label: u.label, value: u.views,
                    }))}
                  />
                  {(data.utmCampaigns || []).length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{
                        fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                        color: MUTED, marginBottom: 10,
                      }}>By campaign</div>
                      <RankTable
                        labelHead="Campaign"
                        rows={(data.utmCampaigns || []).map((u: any) => ({
                          label: u.label, value: u.views,
                        }))}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div style={{ fontSize: 10.5, color: DIM, marginTop: 14, lineHeight: 1.7 }}>
            Counted without storing IP addresses, user agents or user ids. A
            visitor is identified by a hash that rotates daily, so uniques are
            per-day and cannot be linked across days — including by us. Location
            is country and region only; campaign tags are read by name rather
            than by keeping the query string, which can carry search terms and
            tokens.
          </div>
        </>
      )}
    </div>
  )
}
