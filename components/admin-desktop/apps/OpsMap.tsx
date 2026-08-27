'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LAND, MAP_W, MAP_H, project } from '@/lib/worldMap'

const BG = '#0e1014'
const PANEL = '#15181e'
const HAIRLINE = '#232732'
const TEXT = '#e6e9ef'
const MUTED = '#8b93a3'
const DIM = '#6b7280'
const LINE = '#4a9eff'

// Paper, not satellite. Flat fill, hairline coast, no gradients or shadows —
// the ink should read as printed so the pings are the only thing that glows.
const SEA = '#11141a'
const LAND_FILL = '#1c212b'
const LAND_EDGE = '#2c3444'
const GRAT = '#191d26'

const MODES = [
  { id: 'online', label: 'ONLINE NOW', hint: 'Dialing in the last 90 seconds' },
  { id: 'subscribed', label: 'ACTIVE SUB', hint: 'Active or trialing subscription' },
  { id: 'trialing', label: 'ON TRIAL', hint: 'Currently inside a free trial' },
  { id: 'all', label: 'ALL SIGNUPS', hint: 'Every account, wherever we can place it' },
  { id: 'visitors', label: 'VISITORS', hint: 'Unique visitors — strangers, not accounts' },
] as const
type Mode = (typeof MODES)[number]['id']

const RANGES = [
  { id: '24h', label: '24H' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
] as const

type Point = {
  key: string; label: string; scope: 'state' | 'country'
  lat: number; lon: number; users: number; online: number; views: number
  names: string[]
}
type Payload = {
  mode: Mode
  points: Point[]
  totals: { total: number; placed: number; unplaced: number; online: number; locations: number }
  unplacedNames: string[]
}

// ── ZOOM ────────────────────────────────────────────────────────────────
// The viewBox IS the camera. Panning subtracts from x/y, zooming scales w/h
// about a focal point, and nothing else in the component has to know. The
// alternative — CSS transforms on a wrapper — fights the SVG's own coordinate
// space and makes hit-testing a second projection to keep in step.
const MIN_W = MAP_W / 24   // deepest zoom: roughly one US state filling the frame
const MAX_W = MAP_W        // fully zoomed out is the whole world, never further

type View = { x: number; y: number; w: number; h: number }
const WORLD: View = { x: 0, y: 0, w: MAP_W, h: MAP_H }

export default function OpsMap() {
  const [mode, setMode] = useState<Mode>('online')
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('30d')
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<View>(WORLD)

  const svgRef = useRef<SVGSVGElement | null>(null)
  // Live pointers, keyed by id. One is a drag, two is a pinch — tracked here
  // rather than in state because they change on every move and re-rendering
  // the map sixty times a second to store a coordinate is wasted work.
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragFrom = useRef<{ px: number; py: number; view: View } | null>(null)
  const pinchFrom = useRef<{ dist: number; view: View; cx: number; cy: number } | null>(null)
  const moved = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const qs = new URLSearchParams({ mode })
      if (mode === 'visitors') qs.set('range', range)
      const res = await fetch(`/api/admin/ops-map?${qs}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load map')
      setData(json)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load map')
    } finally {
      setLoading(false)
    }
  }, [mode, range])

  useEffect(() => { load() }, [load])

  // Only ONLINE moves on its own. Polling a list of signups every 20 seconds
  // would be a request that can never return anything new.
  useEffect(() => {
    if (mode !== 'online') return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [mode, load])

  const landPaths = useMemo(
    () => LAND.map(l => ({
      name: l.name,
      d: l.ring
        .map(([lat, lon], i) => {
          const { x, y } = project(lat, lon, MAP_W, MAP_H)
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
        })
        .join(' ') + ' Z',
    })),
    []
  )

  const graticule = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (let lon = -150; lon <= 150; lon += 30) {
      const a = project(90, lon, MAP_W, MAP_H), b = project(-90, lon, MAP_W, MAP_H)
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const a = project(lat, -180, MAP_W, MAP_H), b = project(lat, 180, MAP_W, MAP_H)
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    return lines
  }, [])

  const points = data?.points ?? []
  const maxUsers = Math.max(1, ...points.map(p => p.users))
  const zoom = MAP_W / view.w
  // Pings are drawn in map units but must read at a constant SIZE on screen,
  // so every radius and stroke divides by the zoom. Without this a ping at 8x
  // is a continent-sized blob.
  const k = 1 / zoom

  const clampView = useCallback((v: View): View => {
    const w = Math.min(MAX_W, Math.max(MIN_W, v.w))
    const h = w * (MAP_H / MAP_W)
    // Allow a little overscroll so a ping on the very edge can be centred.
    const pad = w * 0.15
    return {
      w, h,
      x: Math.min(MAP_W - w + pad, Math.max(-pad, v.x)),
      y: Math.min(MAP_H - h + pad, Math.max(-pad, v.y)),
    }
  }, [])

  /** Client pixels -> map units, via the SVG's own box. */
  const toMap = useCallback((clientX: number, clientY: number, v: View) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
    }
  }, [])

  const zoomAbout = useCallback((factor: number, clientX?: number, clientY?: number) => {
    setView(prev => {
      const nw = Math.min(MAX_W, Math.max(MIN_W, prev.w / factor))
      const nh = nw * (MAP_H / MAP_W)
      const rect = svgRef.current?.getBoundingClientRect()
      // No focal point (button press): keep the centre still.
      if (clientX == null || clientY == null || !rect) {
        return clampView({
          w: nw, h: nh,
          x: prev.x + (prev.w - nw) / 2,
          y: prev.y + (prev.h - nh) / 2,
        })
      }
      const fx = (clientX - rect.left) / rect.width
      const fy = (clientY - rect.top) / rect.height
      // Keep the point under the cursor under the cursor.
      return clampView({
        w: nw, h: nh,
        x: prev.x + (prev.w - nw) * fx,
        y: prev.y + (prev.h - nh) * fy,
      })
    })
  }, [clampView])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    if (pointers.current.size === 1) {
      dragFrom.current = { px: e.clientX, py: e.clientY, view }
      pinchFrom.current = null
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchFrom.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        view,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      }
      dragFrom.current = null
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2 && pinchFrom.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const start = pinchFrom.current
      if (start.dist > 0) {
        moved.current = true
        const factor = dist / start.dist
        const nw = Math.min(MAX_W, Math.max(MIN_W, start.view.w / factor))
        const nh = nw * (MAP_H / MAP_W)
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          const fx = (start.cx - rect.left) / rect.width
          const fy = (start.cy - rect.top) / rect.height
          setView(clampView({
            w: nw, h: nh,
            x: start.view.x + (start.view.w - nw) * fx,
            y: start.view.y + (start.view.h - nh) * fy,
          }))
        }
      }
      return
    }

    if (dragFrom.current) {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = ((e.clientX - dragFrom.current.px) / rect.width) * dragFrom.current.view.w
      const dy = ((e.clientY - dragFrom.current.py) / rect.height) * dragFrom.current.view.h
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved.current = true
      setView(clampView({
        ...dragFrom.current.view,
        x: dragFrom.current.view.x - dx,
        y: dragFrom.current.view.y - dy,
      }))
    }
  }

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchFrom.current = null
    if (pointers.current.size === 0) dragFrom.current = null
  }

  // Non-passive so preventDefault actually stops the page scrolling underneath.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      zoomAbout(ev.deltaY < 0 ? 1.18 : 1 / 1.18, ev.clientX, ev.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAbout])

  const focusPoint = (p: Point) => {
    const { x, y } = project(p.lat, p.lon, MAP_W, MAP_H)
    const w = Math.max(MIN_W, MAP_W / 8)
    const h = w * (MAP_H / MAP_W)
    setView(clampView({ w, h, x: x - w / 2, y: y - h / 2 }))
    setSelected(p.key)
  }

  const sel = points.find(p => p.key === selected) || null
  const isVisitors = mode === 'visitors'
  const unit = isVisitors ? 'visitor' : 'user'
  const modeMeta = MODES.find(m => m.id === mode)!

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      <style>{`
        .om-controls { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
        .om-body { display:grid; grid-template-columns: 1fr 260px; gap:10px; flex:1; min-height:0; }
        .om-side { display:flex; flex-direction:column; gap:8px; min-height:0; }
        @media (max-width: 860px) {
          .om-body { grid-template-columns: 1fr; }
          .om-side { max-height: 42%; }
        }
        .om-chip {
          background:${PANEL}; border:1px solid ${HAIRLINE}; color:${MUTED};
          border-radius:4px; padding:6px 10px; font-size:10px; letter-spacing:1.4px;
          font-weight:700; cursor:pointer; white-space:nowrap;
        }
        .om-chip[data-on="true"] { border-color:${LINE}; color:${LINE}; background:rgba(74,158,255,0.12); }
        .om-row {
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding:6px 8px; border-radius:4px; cursor:pointer; border:1px solid transparent;
        }
        .om-row:hover { background:${PANEL}; }
        .om-row[data-on="true"] { background:${PANEL}; border-color:${LINE}; }
        @keyframes om-pulse {
          0%   { r: var(--r0); opacity: 0.55; }
          70%  { r: var(--r1); opacity: 0; }
          100% { r: var(--r1); opacity: 0; }
        }
      `}</style>

      {/* ── CONTROLS ─────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0 }}>
        <div className="om-controls">
          {MODES.map(m => (
            <button
              key={m.id}
              className="om-chip"
              data-on={mode === m.id}
              title={m.hint}
              onClick={() => { setMode(m.id); setSelected(null) }}
            >{m.label}</button>
          ))}
          {isVisitors && (
            <>
              <span style={{ width: 8 }} />
              {RANGES.map(r => (
                <button
                  key={r.id}
                  className="om-chip"
                  data-on={range === r.id}
                  onClick={() => setRange(r.id)}
                >{r.label}</button>
              ))}
            </>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: DIM, marginTop: 6 }}>
          {modeMeta.hint}
          {data && (
            <> · <strong style={{ color: MUTED }}>{data.totals.placed}</strong> placed
              across <strong style={{ color: MUTED }}>{data.totals.locations}</strong>{' '}
              {data.totals.locations === 1 ? 'location' : 'locations'}
              {data.totals.unplaced > 0 && (
                <> · <span style={{ color: '#d97706' }}>{data.totals.unplaced} unplaced</span></>
              )}
            </>
          )}
        </div>
      </div>

      <div className="om-body" style={{ padding: 10 }}>
        {/* ── MAP ────────────────────────────────────────────────────── */}
        <div style={{
          position: 'relative', background: SEA, border: `1px solid ${HAIRLINE}`,
          borderRadius: 6, overflow: 'hidden', minHeight: 0,
        }}>
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={endPointer}
            style={{
              width: '100%', height: '100%', display: 'block',
              cursor: dragFrom.current ? 'grabbing' : 'grab',
              // Without this the browser claims the gesture for page scrolling
              // and the map only pans until the finger moves more than a few
              // pixels vertically.
              touchAction: 'none',
            }}
          >
            <rect x={-MAP_W} y={-MAP_H} width={MAP_W * 3} height={MAP_H * 3} fill={SEA} />

            {graticule.map((g, i) => (
              <line key={i} {...g} stroke={GRAT} strokeWidth={0.6 * k} />
            ))}

            {landPaths.map(l => (
              <path
                key={l.name}
                d={l.d}
                fill={LAND_FILL}
                stroke={LAND_EDGE}
                strokeWidth={0.7 * k}
                strokeLinejoin="round"
              />
            ))}

            {points.map(p => {
              const { x, y } = project(p.lat, p.lon, MAP_W, MAP_H)
              // Area-proportional, so a place with ten is visibly bigger than
              // one with two without a single point swamping the map.
              const scale = Math.sqrt(p.users / maxUsers)
              const r = (2.2 + scale * 4.5) * k
              const live = p.online > 0
              const colour = live ? '#32ff7e' : LINE
              const isSel = selected === p.key
              return (
                <g
                  key={p.key}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { if (!moved.current) setSelected(isSel ? null : p.key) }}
                >
                  {live && (
                    <circle
                      cx={x} cy={y} fill="none" stroke={colour} strokeWidth={1.2 * k}
                      style={{
                        // Custom props so the keyframes scale with zoom too.
                        ['--r0' as any]: `${r}px`,
                        ['--r1' as any]: `${r * 3.4}px`,
                        animation: 'om-pulse 2.2s ease-out infinite',
                      }}
                    />
                  )}
                  <circle cx={x} cy={y} r={r} fill={colour} fillOpacity={0.85} />
                  <circle
                    cx={x} cy={y} r={r + (isSel ? 2.5 : 1.2) * k}
                    fill="none" stroke={colour}
                    strokeWidth={(isSel ? 1.6 : 0.8) * k}
                    strokeOpacity={isSel ? 1 : 0.5}
                  />
                  {/* Labels only once there is room, otherwise the world view
                      is a pile of overlapping text. */}
                  {zoom > 2.2 && (
                    <text
                      x={x} y={y - r - 3 * k}
                      textAnchor="middle"
                      fill={TEXT}
                      style={{ fontSize: `${7 * k}px`, letterSpacing: `${0.4 * k}px`, pointerEvents: 'none' }}
                    >
                      {p.label} · {p.users}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Zoom controls. Buttons as well as gestures, because a trackpad
              pinch is unreliable and a keyboard has neither. */}
          <div style={{
            position: 'absolute', right: 8, bottom: 8, display: 'flex',
            flexDirection: 'column', gap: 4,
          }}>
            {[
              { label: '+', onClick: () => zoomAbout(1.5), title: 'Zoom in' },
              { label: '−', onClick: () => zoomAbout(1 / 1.5), title: 'Zoom out' },
              { label: '⤢', onClick: () => { setView(WORLD); setSelected(null) }, title: 'Whole world' },
            ].map(b => (
              <button
                key={b.label}
                onClick={b.onClick}
                title={b.title}
                style={{
                  width: 30, height: 30, borderRadius: 4, cursor: 'pointer',
                  background: 'rgba(21,24,30,0.9)', border: `1px solid ${HAIRLINE}`,
                  color: MUTED, fontSize: 14, lineHeight: 1, fontWeight: 700,
                }}
              >{b.label}</button>
            ))}
          </div>

          {zoom > 1.02 && (
            <div style={{
              position: 'absolute', left: 8, bottom: 8, fontSize: 10,
              color: DIM, background: 'rgba(21,24,30,0.9)',
              border: `1px solid ${HAIRLINE}`, borderRadius: 4, padding: '3px 7px',
            }}>{zoom.toFixed(1)}×</div>
          )}

          {(loading || err) && (
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              background: 'rgba(14,16,20,0.72)', fontSize: 12,
              color: err ? '#f87171' : MUTED, padding: 20, textAlign: 'center',
            }}>{err || 'Loading map…'}</div>
          )}
        </div>

        {/* ── LIST ───────────────────────────────────────────────────── */}
        <div className="om-side">
          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
            padding: '10px 10px 8px', display: 'flex', flexDirection: 'column',
            minHeight: 0, flex: 1,
          }}>
            <div style={{
              fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
              color: MUTED, marginBottom: 8, flexShrink: 0,
            }}>
              {isVisitors ? 'Visitors by place' : 'People by place'}
            </div>

            {points.length === 0 && !loading ? (
              <div style={{ color: DIM, fontSize: 11.5, lineHeight: 1.7 }}>
                Nobody to place in this view.
                {(data?.totals.unplaced ?? 0) > 0 && ' Everyone found is unplaced — see below.'}
              </div>
            ) : (
              <div style={{ overflowY: 'auto', minHeight: 0 }}>
                {points.map(p => (
                  <div
                    key={p.key}
                    className="om-row"
                    data-on={selected === p.key}
                    onClick={() => focusPoint(p)}
                  >
                    <span style={{
                      minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', fontSize: 11.5,
                    }}>
                      {p.online > 0 && (
                        <span style={{ color: '#32ff7e', marginRight: 5 }}>●</span>
                      )}
                      {p.label}
                    </span>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                      color: p.online > 0 ? '#32ff7e' : LINE, flexShrink: 0,
                    }}>{p.users}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selection detail. Names for accounts; visitors have none to give,
              and inventing a label for an anonymous reader would be a lie. */}
          {sel && (
            <div style={{
              background: PANEL, border: `1px solid ${LINE}`, borderRadius: 6,
              padding: '10px', flexShrink: 0, maxHeight: '38%', overflowY: 'auto',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{sel.label}</div>
              <div style={{ fontSize: 10.5, color: DIM, marginBottom: 8 }}>
                {sel.users} {unit}{sel.users === 1 ? '' : 's'}
                {sel.online > 0 && <span style={{ color: '#32ff7e' }}> · {sel.online} dialing now</span>}
                {isVisitors && sel.views > 0 && <> · {sel.views} views</>}
              </div>
              {sel.names.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {sel.names.map((n, i) => (
                    <div key={i} style={{ fontSize: 11, color: MUTED }}>{n}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(data?.totals.unplaced ?? 0) > 0 && (
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`,
              borderLeft: '3px solid #d97706', borderRadius: 6,
              padding: '9px 10px', flexShrink: 0,
            }}>
              <div style={{ fontSize: 10, letterSpacing: 1, color: '#d97706', fontWeight: 700 }}>
                {data!.totals.unplaced} UNPLACED
              </div>
              <div style={{ fontSize: 10.5, color: DIM, lineHeight: 1.6, marginTop: 3 }}>
                Location comes from a dialing heartbeat or an attributed page
                view. Anyone who has done neither since those started being
                recorded cannot be placed, and is counted here rather than
                guessed at.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
