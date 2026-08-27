'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LAND, BORDERS, MAP_W, MAP_H, project } from '@/lib/worldMap'

// ── PALETTE ─────────────────────────────────────────────────────────────
// Deliberately NOT the admin desktop's chrome. This app is meant to read as
// its own console rather than a window in a suite, so the panels take the
// map's own black instead of the surrounding UI's slate, and the only bright
// colour in the whole thing is data.
const VOID = '#04060a'        // page + panel background, one colour on purpose
const SEA = '#060910'
const LAND_FILL = '#0d141f'
const LAND_EDGE = '#27384f'
const GRAT = '#0d1522'
const EDGE = '#12508a'        // panel borders — dim until something glows on them
const EDGE_HOT = '#2f8fd8'
const INK = '#dbe6f5'
const MUTED = '#7b8ba3'
const DIM = '#4a5a72'

const CYAN = '#5fd8ff'
const GREEN = '#3cff9e'
const AMBER = '#ffae3c'
const PINK = '#ff6ec7'
const RED = '#ff5c5c'
const VIOLET = '#a98cff'

const MODES = [
  { id: 'visitors', label: 'VISITORS', hint: 'Unique visitors — strangers, not accounts' },
  { id: 'online', label: 'ONLINE NOW', hint: 'Dialing in the last 90 seconds' },
  { id: 'subscribed', label: 'ACTIVE SUB', hint: 'Active subscriptions, including trials' },
  { id: 'all', label: 'ALL SIGNUPS', hint: 'Every account we can place' },
] as const
type Mode = (typeof MODES)[number]['id']

const RANGES = ['12h', '24h', '7d', '30d', '90d'] as const
type Range = (typeof RANGES)[number]

const SYNC_MS = 5000

type Point = {
  key: string; label: string; scope: 'state' | 'country'
  lat: number; lon: number; users: number; online: number; views: number
  trialing: number; names: string[]
}
type Person = {
  id: string; label: string; username: string | null; email: string | null
  joined: string; place: string | null; device: string | null
  dialerState: string | null; dialerMode: string | null
  online: boolean; lastHeartbeat: string | null
  status: string | null; plan: string | null; trialEnd: string | null
  seatPayer: string | null; seatTeam: string | null
  calls: number; answered: number; lastCall: string | null
  campaigns: number; leads: number
}
type Target = {
  key: string; label: string; lat: number; lon: number
  calls: number; answered: number; connected: number; codes: string[]
}
type FeedRow = {
  id: string; at: string; agent: string; agentPlace: string | null
  agentRegion: string | null; phone: string | null
  targetState: string | null; targetPlace: string | null
  duration: number; talkSeconds: number | null; answered: boolean
  disposition: string | null; amdResult: string | null; amdRequested: boolean
  source: string | null; campaign: string | null; recording: string | null
}
type PulseBucket = { at: string; calls: number; answered: number; connected: number }
type PlacePerson = {
  label: string; username: string | null; email: string | null
  joined: string; online: boolean
  device: string | null; mode: string | null; state: string | null
  lastHeartbeat: string | null
  status: string | null; plan: string | null; trialEnd?: string | null
  seatPayer?: string | null
  calls: number; answered: number; lastCall: string | null
  campaigns: number; leads: number
}
type PlaceDetail = {
  people: PlacePerson[]
  traffic: {
    visitors: number; views: number; authed: number
    firstSeen: string | null; lastSeen: string | null
    signups: number; signupsInRange: number
  } | null
  topPaths: { path: string; views: number }[]
  sources: { source: string; views: number }[]
}

type Payload = {
  mode: Mode; range: Range
  pulse: PulseBucket[]
  people: Person[]
  points: Point[]; targets: Target[]
  arcs: { key: string; from: [number, number]; to: [number, number]; n: number }[]
  feed: FeedRow[]
  breakdown: Record<string, { label: string; n: number; detail: string }[]>
  totals: {
    total: number; placed: number; unplaced: number; online: number
    locations: number; targetLocations: number; targetCalls: number
    targetsUnmapped: number; trialing: number
  }
  unplacedNames: string[]
}

// ── PERSISTED UI STATE ──────────────────────────────────────────────────
// Read with a lazy initialiser rather than restored in an effect. That is only
// safe because the registry loads this app with ssr:false — there is no server
// render to disagree with, so there is no hydration mismatch to dodge, and
// reading in an effect would just mean one wasted render plus a visible flip
// from the default to the stored value.
const STORE = 'ds:ops-map'
type Persisted = {
  mode?: Mode; range?: Range
  feedOpen?: boolean; ranksOpen?: boolean; pulseOpen?: boolean
  showTargets?: boolean; feedView?: 'calls' | 'people'
}
function readPersisted(): Persisted {
  try { return JSON.parse(window.localStorage.getItem(STORE) || '{}') as Persisted }
  catch { return {} }
}

const MIN_W = MAP_W / 40
// Deliberately wider than the world. Stopping at exactly one world means the
// globe touches all four edges at minimum zoom with nowhere to go — you can
// never see the whole thing with air around it, and at scale the far pings sit
// on the frame. 2.6 worlds gives it margin to breathe.
const MAX_W = MAP_W * 2.6
type View = { x: number; y: number; w: number; h: number }
// Opens on North America rather than the whole globe: every point in the data
// is there, and a world view spends most of its pixels on empty ocean.
const HOME: View = { x: 96, y: 26, w: 250, h: 125 }
const WORLD: View = { x: 0, y: 0, w: MAP_W, h: MAP_H }

const dispColour = (d: string | null) => {
  const k = (d || '').toUpperCase()
  if (k === 'CLOSED') return GREEN
  if (k === 'APPOINTMENT' || k === 'CALL BACK') return CYAN
  if (k === 'NOT INTERESTED') return AMBER
  if (k === 'DO NOT CALL') return RED
  if (k === 'VOICEMAIL') return VIOLET
  if (k === 'NO_ANSWER') return DIM
  if (k === 'SKIPPED') return MUTED
  return MUTED
}
const amdColour = (a: string | null) =>
  a === 'human' ? GREEN : a === 'machine' ? VIOLET : a === 'not_sure' ? AMBER : DIM

const hhmmss = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour12: false })
}
const prettyPhone = (p: string | null) => {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  const t = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  return t.length === 10 ? `${t.slice(0, 3)}.${t.slice(3, 6)}.${t.slice(6)}` : p
}

export default function OpsMap() {
  const [saved] = useState(readPersisted)
  const [mode, setMode] = useState<Mode>(
    MODES.some(m => m.id === saved.mode) ? saved.mode! : 'visitors')
  const [range, setRange] = useState<Range>(
    (RANGES as readonly string[]).includes(saved.range || '') ? saved.range! : '24h')
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [beat, setBeat] = useState(0)

  const [selected, setSelected] = useState<string | null>(null)
  const [detailFor, setDetailFor] = useState<{ key: string; data: PlaceDetail } | null>(null)

  const [feedOpen, setFeedOpen] = useState(saved.feedOpen ?? true)
  const [ranksOpen, setRanksOpen] = useState(saved.ranksOpen ?? true)
  const [pulseOpen, setPulseOpen] = useState(saved.pulseOpen ?? true)
  const [showTargets, setShowTargets] = useState(saved.showTargets ?? true)

  // What the wide panel is showing. CALLS is a ticker of events; PEOPLE is a
  // roster of accounts. They answer different questions and neither belongs
  // inside the other, so the panel switches rather than nesting one in the
  // other or growing a second panel nobody has room for.
  const [feedView, setFeedView] = useState<'calls' | 'people'>(saved.feedView ?? 'calls')
  const [callFilter, setCallFilter] = useState<'all' | 'answered' | 'missed' | 'machine' | 'human'>('all')
  // The PEOPLE view needs its own filter, not a shared one: "answered" means
  // nothing about an account and "trial" means nothing about a call.
  const [peopleFilter, setPeopleFilter] =
    useState<'all' | 'online' | 'paying' | 'trial' | 'seat' | 'dialed' | 'unplaced'>('all')
  const [view, setView] = useState<View>(WORLD)

  // Which feed rows arrived on the most recent sync. Held in state because it
  // drives a render; the ref beside it is the previous id set, which must NOT
  // drive one — comparing against a value that re-renders when you set it is
  // how this kind of diff turns into a loop.
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const seenIds = useRef<Set<string> | null>(null)
  const stampRef = useRef<string | null>(null)

  // ── FULLSCREEN ────────────────────────────────────────────────────────
  // The real Fullscreen API on this container, not a CSS "cover the window"
  // trick. Only that actually escapes the desktop shell — a maximised div is
  // still inside the app frame, under the taskbar, and bounded by whatever the
  // window manager thinks its size is. requestFullscreen takes the element out
  // of all of it, and Esc gets you back without the app having to handle it.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isFull, setIsFull] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFull(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFull = () => {
    const el = rootRef.current
    if (!el) return
    if (document.fullscreenElement === el) void document.exitFullscreen?.()
    else void el.requestFullscreen?.().catch(() => { /* denied by policy — leave as-is */ })
  }

  // ── FIT vs FILL ───────────────────────────────────────────────────────
  // 'slice' fills a wide frame handsomely and crops badly on a tall narrow
  // one — on a phone it throws away most of the world to fill the width.
  // 'meet' letterboxes instead, which is the right trade when the whole map
  // has to be visible. Measured from the element rather than a media query so
  // it follows the WINDOW's size inside the desktop, not the device's.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      // The map is 2:1. Anything squarer than that has to fit rather than fill.
      setNarrow(width / Math.max(height, 1) < 1.9)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const svgRef = useRef<SVGSVGElement | null>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragFrom = useRef<{ px: number; py: number; view: View } | null>(null)
  const pinchFrom = useRef<{ dist: number; view: View; cx: number; cy: number } | null>(null)
  const moved = useRef(false)

  // ── SYNC ──────────────────────────────────────────────────────────────
  // Five seconds, and never a spinner after the first paint. A console that
  // blanks itself every five seconds is unreadable — the refresh has to be
  // invisible, so `firstLoad` gates the loading state and nothing else does.
  const load = useCallback(async (quiet: boolean) => {
    try {
      const res = await fetch(`/api/admin/ops-map?mode=${mode}&range=${range}`)
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load')
      setData(json)
      setErr(null)
      if (!quiet) setBeat(b => b + 1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [mode, range])

  // No setState for "have we loaded yet" — that is `data === null`, and
  // deriving it removes a state that could disagree with the data it
  // describes, while keeping a mode switch from flashing a spinner over
  // results that are still perfectly good.
  //
  // The disable below is for a false positive: load() awaits fetch before it
  // touches state, so nothing runs synchronously in the effect body. The
  // rule cannot see across the useCallback boundary to know that, and both
  // ways to satisfy it are worse than the warning — fetching during render, or
  // an initial-fetch flag that is itself state describing the fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(false) }, [load])

  useEffect(() => {
    const t = setInterval(() => { load(false) }, SYNC_MS)
    return () => clearInterval(t)
  }, [load])

  // Detail for whichever ping is open, refreshed on the same beat so it never
  // contradicts the map behind it.
  useEffect(() => {
    // Nothing to clear on deselect: the result carries the key it belongs to
    // and the render below ignores it once that key stops matching. Storing
    // the pair instead of clearing state is also what stops a slow response
    // for one ping landing under a different ping the user has since clicked.
    const originKey = selected && !selected.startsWith('T-') ? selected : null
    if (!originKey) return
    let cancelled = false
    fetch(`/api/admin/ops-map?place=${encodeURIComponent(originKey)}&range=${range}`)
      .then(r => r.json())
      .then((j: { success?: boolean; detail?: PlaceDetail }) => {
        if (!cancelled && j?.success && j.detail) setDetailFor({ key: originKey, data: j.detail })
      })
      .catch(() => { /* the next beat tries again */ })
    return () => { cancelled = true }
  }, [selected, range, beat])

  const detail = detailFor && detailFor.key === selected ? detailFor.data : null

  useEffect(() => {
    const ids = (data?.feed ?? []).map(f => f.id)
    if (!ids.length) return
    // Switching mode or range replaces the feed wholesale, so the baseline is
    // dropped here rather than in a second effect that would have to setState
    // to do it. A ref can be reset in place; state cannot.
    const stamp = `${mode}|${range}`
    if (stampRef.current !== stamp) {
      stampRef.current = stamp
      seenIds.current = new Set(ids)
      return
    }
    // First payload is not "new" — every row would flash at once and the
    // effect would read as a glitch rather than as activity.
    if (seenIds.current === null) { seenIds.current = new Set(ids); return }
    const prev = seenIds.current
    const fresh = ids.filter(id => !prev.has(id))
    seenIds.current = new Set(ids)
    if (!fresh.length) return
    setFreshIds(new Set(fresh))
    const t = setTimeout(() => setFreshIds(new Set()), 1800)
    return () => clearTimeout(t)
  }, [data, mode, range])



  useEffect(() => {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({
        mode, range, feedOpen, ranksOpen, showTargets, pulseOpen, feedView,
      }))
    } catch { /* nothing here is worth failing a render for */ }
  }, [mode, range, feedOpen, ranksOpen, showTargets, pulseOpen, feedView])

  // ── GEOMETRY ──────────────────────────────────────────────────────────
  const landPaths = useMemo(
    () => LAND.map(l => ({
      name: l.name,
      d: l.ring.map(([lat, lon], i) => {
        const { x, y } = project(lat, lon, MAP_W, MAP_H)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      }).join(' ') + ' Z',
    })), [])

  // Same projection as the coastlines, so the two can never drift apart.
  const borderPaths = useMemo(
    () => BORDERS.map(line =>
      line.map(([lat, lon], i) => {
        const { x, y } = project(lat, lon, MAP_W, MAP_H)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      }).join(' ')
    ),
    []
  )

  const graticule = useMemo(() => {
    const l: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (let lon = -180; lon <= 180; lon += 15) {
      const a = project(85, lon, MAP_W, MAP_H), b = project(-85, lon, MAP_W, MAP_H)
      l.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const a = project(lat, -180, MAP_W, MAP_H), b = project(lat, 180, MAP_W, MAP_H)
      l.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
    return l
  }, [])

  const points = data?.points ?? []
  const targets = showTargets ? (data?.targets ?? []) : []
  const arcs = showTargets ? (data?.arcs ?? []) : []
  const maxUsers = Math.max(1, ...points.map(p => p.users))
  const maxCalls = Math.max(1, ...targets.map(t => t.calls))
  // Filtering here rather than in the query: the feed is 80 rows and already
  // in memory, so a round trip per filter click would add latency to answer a
  // question the client can answer instantly.
  const shownPeople = (data?.people ?? []).filter(p => {
    switch (peopleFilter) {
      case 'online': return p.online
      case 'paying': return p.status === 'active' || !!p.seatPayer
      case 'trial': return p.status === 'trialing'
      case 'seat': return !!p.seatPayer
      case 'dialed': return p.calls > 0
      // The ones the map cannot draw. Worth a filter of its own precisely
      // because they are invisible everywhere else on this screen.
      case 'unplaced': return !p.place
      default: return true
    }
  })

  const shownFeed = (data?.feed ?? []).filter(f => {
    if (callFilter === 'answered') return f.answered
    if (callFilter === 'missed') return !f.answered
    if (callFilter === 'human') return f.amdResult === 'human'
    if (callFilter === 'machine') return f.amdResult === 'machine'
    return true
  })

  const zoom = MAP_W / view.w
  // Ping radii are drawn in map units, so dividing by the zoom keeps them a
  // constant size on screen. That is right on a desktop, where zooming is for
  // reading labels — and wrong on a phone, where zooming IS how you pick a
  // ping out and a dot that never grows stays just as hard to hit.
  //
  // The exponent is the compromise: at 0.55 a 4x zoom makes a ping about
  // twice its size rather than four times, so it becomes tappable without
  // swallowing the state it is sitting on.
  const k = 1 / zoom
  const pingK = narrow ? Math.pow(k, 0.55) : k

  // ── SCREEN PIXELS TO MAP UNITS ────────────────────────────────────────
  // rect.width / view.w is only the scale when the viewBox stretches to fill
  // the element, which is what preserveAspectRatio="none" does. This map uses
  // meet or slice, so the SVG scales UNIFORMLY and one axis is letterboxed or
  // cropped — on that axis the naive ratio is wrong, and it gets wronger the
  // further you zoom, which is exactly how dragging came to feel like it was
  // fighting back.
  //
  // One scale for both axes, plus the offset of the rendered content inside
  // the element. Everything that converts a pointer position goes through it,
  // so panning, pinching and wheel-zoom all agree about where the finger is.
  const viewScale = useCallback((v: View) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) {
      return { scale: 1, offX: 0, offY: 0, rect: null as DOMRect | null }
    }
    const sx = rect.width / v.w
    const sy = rect.height / v.h
    // meet fits the whole box inside (min); slice covers it (max).
    const scale = narrow ? Math.min(sx, sy) : Math.max(sx, sy)
    return {
      scale,
      offX: (rect.width - v.w * scale) / 2,
      offY: (rect.height - v.h * scale) / 2,
      rect,
    }
  }, [narrow])

  const clampView = useCallback((v: View): View => {
    const w = Math.min(MAX_W, Math.max(MIN_W, v.w))
    const h = w * (MAP_H / MAP_W)
    // Pad scales with the view, so zoomed all the way out the world can sit
    // centred with space around it rather than pinned to a corner.
    const pad = Math.max(w * 0.2, (w - MAP_W) / 2 + 20)
    return {
      w, h,
      x: Math.min(MAP_W - w + pad, Math.max(-pad, v.x)),
      y: Math.min(MAP_H - h + pad, Math.max(-pad, v.y)),
    }
  }, [])

  const zoomAbout = useCallback((factor: number, cx?: number, cy?: number) => {
    setView(prev => {
      const nw = Math.min(MAX_W, Math.max(MIN_W, prev.w / factor))
      const nh = nw * (MAP_H / MAP_W)
      const rect = svgRef.current?.getBoundingClientRect()
      if (cx == null || cy == null || !rect) {
        return clampView({ w: nw, h: nh, x: prev.x + (prev.w - nw) / 2, y: prev.y + (prev.h - nh) / 2 })
      }
      const fx = (cx - rect.left) / rect.width
      const fy = (cy - rect.top) / rect.height
      return clampView({ w: nw, h: nh, x: prev.x + (prev.w - nw) * fx, y: prev.y + (prev.h - nh) * fy })
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
        dist: Math.hypot(a.x - b.x, a.y - b.y), view,
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
      }
      dragFrom.current = null
    }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    if (pointers.current.size >= 2 && pinchFrom.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const st = pinchFrom.current
      if (st.dist > 0) {
        moved.current = true
        const nw = Math.min(MAX_W, Math.max(MIN_W, st.view.w / (dist / st.dist)))
        const nh = nw * (MAP_H / MAP_W)
        // Same correction as the wheel path: find the map point under the
        // pinch centre through the real scale and the letterbox offset, then
        // hold it still. Without this a two-finger zoom drifts sideways.
        const { scale: s0, offX, offY } = viewScale(st.view)
        const mx = st.view.x + (st.cx - rect.left - offX) / s0
        const my = st.view.y + (st.cy - rect.top - offY) / s0
        const fx = (mx - st.view.x) / st.view.w
        const fy = (my - st.view.y) / st.view.h
        setView(clampView({ w: nw, h: nh, x: st.view.x + (st.view.w - nw) * fx, y: st.view.y + (st.view.h - nh) * fy }))
      }
      return
    }
    if (dragFrom.current) {
      // Divide by the real scale, so one pixel of finger is one pixel of map
      // at every zoom level and on both axes.
      const { scale } = viewScale(dragFrom.current.view)
      const dx = (e.clientX - dragFrom.current.px) / scale
      const dy = (e.clientY - dragFrom.current.py) / scale
      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) moved.current = true
      setView(clampView({ ...dragFrom.current.view, x: dragFrom.current.view.x - dx, y: dragFrom.current.view.y - dy }))
    }
  }
  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchFrom.current = null
    if (pointers.current.size === 0) dragFrom.current = null
  }

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      zoomAbout(ev.deltaY < 0 ? 1.2 : 1 / 1.2, ev.clientX, ev.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAbout])

  // ── KEYBOARD ──────────────────────────────────────────────────────────
  // Scoped to the container, not window. This is one app inside a desktop of
  // them; a global listener would pan the map while somebody typed in another
  // window, which is the kind of bug nobody reports and everybody notices.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = view.w * 0.18
    if (e.key === 'Escape') { setSelected(null); return }
    if (e.key === '+' || e.key === '=') { zoomAbout(1.5); e.preventDefault(); return }
    if (e.key === '-' || e.key === '_') { zoomAbout(1 / 1.5); e.preventDefault(); return }
    if (e.key.toLowerCase() === 'w') { setView(WORLD); return }
    if (e.key.toLowerCase() === 'h') { setView(HOME); return }
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const d = pan[e.key]
    if (d) {
      e.preventDefault()
      setView(v => clampView({ ...v, x: v.x + d[0], y: v.y + d[1] }))
    }
  }

  const focus = (lat: number, lon: number, key: string) => {
    const { x, y } = project(lat, lon, MAP_W, MAP_H)
    const w = Math.max(MIN_W, MAP_W / 12)
    const h = w * (MAP_H / MAP_W)
    setView(clampView({ w, h, x: x - w / 2, y: y - h / 2 }))
    setSelected(key)
  }

  const selPoint = points.find(p => p.key === selected) || null
  const selTarget = targets.find(t => t.key === selected) || null
  const isVisitors = mode === 'visitors'
  const ranks = data?.breakdown ?? {}

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        height: '100%', position: 'relative', background: VOID, color: INK,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif', overflow: 'hidden',
        outline: 'none',
      }}
    >
      <style>{`
        .om-panel {
          background: ${VOID};
          border: 1px solid ${EDGE};
          border-radius: 5px;
          box-shadow: 0 0 0 1px rgba(18,80,138,0.18), 0 0 10px rgba(18,80,138,0.16), inset 0 0 30px rgba(8,30,54,0.4);
          display: flex; flex-direction: column; min-height: 0;
        }
        .om-head {
          display:flex; align-items:center; justify-content:center; gap:8px;
          padding:6px 10px; cursor:pointer; user-select:none; position:relative;
          border-bottom:1px solid ${EDGE};
          background: linear-gradient(180deg, rgba(20,72,124,0.35), rgba(4,6,10,0));
          font-size:10.5px; letter-spacing:3px; font-weight:800; color:${INK};
          text-shadow: 0 0 6px rgba(95,216,255,0.25);
          flex-shrink:0;
        }
        .om-caret {
          width:15px;height:15px;border-radius:50%;border:1px solid ${EDGE_HOT};
          display:inline-flex;align-items:center;justify-content:center;
          font-size:8px;color:${EDGE_HOT};line-height:1;flex-shrink:0;
        }
        .om-t { width:100%; border-collapse:collapse; font-size:10.5px;
                font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
        .om-t th {
          text-align:left; font-weight:700; letter-spacing:1.2px; font-size:9px;
          color:${MUTED}; padding:4px 8px; border-bottom:1px solid ${EDGE};
          position:sticky; top:0; background:${VOID}; z-index:1; white-space:nowrap;
        }
        .om-t td { padding:2.5px 8px; white-space:nowrap; border-bottom:1px solid rgba(18,80,138,0.10); }
        .om-t tr:hover td { background: rgba(18,80,138,0.14); }
        .om-scroll { overflow:auto; min-height:0; }
        .om-scroll::-webkit-scrollbar { width:7px; height:7px; }
        .om-scroll::-webkit-scrollbar-thumb { background:${EDGE}; border-radius:4px; }
        .om-scroll::-webkit-scrollbar-track { background:transparent; }
        .om-chip {
          background: rgba(4,6,10,0.82); border:1px solid ${EDGE}; color:${MUTED};
          border-radius:3px; padding:5px 9px; font-size:9.5px; letter-spacing:1.6px;
          font-weight:800; cursor:pointer; white-space:nowrap;
        }
        .om-switch { display:inline-flex; align-items:center; gap:6px; }
        .om-track {
          width:20px; height:10px; border-radius:6px; flex-shrink:0;
          border:1px solid ${EDGE}; background:rgba(0,0,0,0.5);
          display:inline-flex; align-items:center; padding:0 1px;
          transition: background .12s, border-color .12s;
        }
        .om-knob {
          width:6px; height:6px; border-radius:50%; background:${DIM};
          transform:translateX(0); transition: transform .12s, background .12s;
        }
        .om-switch[data-on="true"] .om-track { border-color:${AMBER}; background:rgba(255,174,60,0.2); }
        .om-switch[data-on="true"] .om-knob { transform:translateX(9px); background:${AMBER}; }
        .om-chip[data-on="true"] {
          border-color:${EDGE_HOT}; color:${CYAN}; background:rgba(18,80,138,0.28);
          box-shadow:0 0 7px rgba(47,143,216,0.25);
        }
        /* position:relative is load-bearing — the magnitude bar inside each row
           is absolutely positioned, and without it every bar escapes to the
           app container and stacks in one corner. */
        .om-subbar {
          display:flex; align-items:center; gap:4px; flex-wrap:wrap;
          padding:4px 8px; border-bottom:1px solid ${EDGE};
          background: rgba(18,80,138,0.07); flex-shrink:0;
        }
        .om-mini {
          background:transparent; border:1px solid transparent; color:${DIM};
          border-radius:3px; padding:2px 6px; font-size:8.5px; letter-spacing:1.3px;
          font-weight:800; cursor:pointer; white-space:nowrap;
        }
        .om-mini:hover { color:${MUTED}; }
        .om-mini[data-on="true"] { color:${CYAN}; border-color:${EDGE}; background:rgba(18,80,138,0.25); }
        .om-sep { width:1px; height:11px; background:${EDGE}; margin:0 3px; }
        .om-rank { position:relative; display:flex; align-items:center; gap:7px;
                   padding:2.5px 9px; font-size:10.5px; overflow:hidden;
                   font-family: ui-monospace, Menlo, Consolas, monospace; }
        .om-rank:hover { background: rgba(18,80,138,0.14); }
        @keyframes om-ping { 0%{opacity:.65;transform:scale(1)} 70%{opacity:0;transform:scale(3.2)} 100%{opacity:0;transform:scale(3.2)} }
        /* A ticker that changes silently is indistinguishable from a frozen
           one. New rows land lit and cool over a second, so a glance tells you
           the feed is alive without watching the clock. */
        @keyframes om-fresh {
          0%   { background: rgba(60,255,158,0.22); box-shadow: inset 2px 0 0 ${GREEN}; }
          100% { background: transparent;           box-shadow: inset 2px 0 0 transparent; }
        }
        .om-t tr[data-fresh="1"] td { animation: om-fresh 1.6s ease-out; }
        @keyframes om-dash { to { stroke-dashoffset: -1000; } }
        .om-dock { position:absolute; left:8px; right:8px; bottom:8px; display:flex;
                   flex-direction:column; gap:8px; z-index:5; pointer-events:none; }
        .om-dock-row { display:flex; gap:8px; align-items:flex-end; min-height:0; }
        .om-dock * { pointer-events:auto; }
        .om-pulse-wrap { flex:0 0 auto; }
        .om-feed-wrap { flex:1 1 auto; min-width:0; max-height:28vh; }
        .om-rank-wrap { width:258px; flex:0 0 auto; max-height:28vh; }
        .om-detail { position:absolute; right:8px; top:44px; width:300px; max-height:46vh; z-index:6; }
        @media (max-width: 900px) {
          .om-dock { left:6px; right:6px; bottom:6px; }
          .om-dock-row { flex-direction:column; align-items:stretch; }
          .om-rank-wrap { width:auto; max-height:20vh; }
          .om-feed-wrap { max-height:23vh; }
          .om-detail { left:6px; right:6px; width:auto; top:auto; bottom:6px; max-height:56vh; }
          .om-hide-sm { display:none !important; }
        }
      `}</style>

      {/* ── MAP ─────────────────────────────────────────────────────────── */}
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio={narrow ? 'xMidYMid meet' : 'xMidYMid slice'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          background: SEA, cursor: 'grab', touchAction: 'none',
        }}
      >
        <defs>
          {/* Bloom kept faint. Glow reads as importance, so when everything
              glows nothing does — and a filter this cheap applied to hundreds
              of nodes is also the first thing to cost frames at scale. */}
          <filter id="om-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="0.7" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="om-halo">
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.22" />
            <stop offset="70%" stopColor={CYAN} stopOpacity="0.03" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="om-halo-hot">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.28" />
            <stop offset="70%" stopColor={GREEN} stopOpacity="0.03" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="om-halo-t">
            <stop offset="0%" stopColor={AMBER} stopOpacity="0.16" />
            <stop offset="70%" stopColor={AMBER} stopOpacity="0.02" />
            <stop offset="100%" stopColor={AMBER} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x={-MAP_W} y={-MAP_H} width={MAP_W * 3} height={MAP_H * 3} fill={SEA} />
        {graticule.map((g, i) => <line key={i} {...g} stroke={GRAT} strokeWidth={0.5 * k} />)}
        {landPaths.map(l => (
          <path key={l.name} d={l.d} fill={LAND_FILL} stroke={LAND_EDGE}
                strokeWidth={0.8 * k} strokeLinejoin="round" />
        ))}

        {/* Borders sit above the land fill and below everything else. They
            exist to make a shape recognisable — you find Texas by the line
            above it, not by reading a label — and are drawn thinner and
            fainter than the coast so a continent's outline stays the
            strongest line on the map. */}
        {borderPaths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={LAND_EDGE}
                strokeWidth={0.4 * k} strokeOpacity={0.65}
                strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* Arcs: origin -> destination, curved so two-way traffic does not
            overlap into one ambiguous straight line. */}
        {arcs.map((a, i) => {
          const p1 = project(a.from[0], a.from[1], MAP_W, MAP_H)
          const p2 = project(a.to[0], a.to[1], MAP_W, MAP_H)
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
          const dx = p2.x - p1.x, dy = p2.y - p1.y
          const len = Math.hypot(dx, dy) || 1
          // Bowed perpendicular to the line, so a route dialed both ways draws
          // two visible arcs instead of one overdrawn straight stroke.
          const cx = mx - (dy / len) * len * 0.22
          const cy = my + (dx / len) * len * 0.22
          const d = `M${p1.x} ${p1.y} Q${cx} ${cy} ${p2.x} ${p2.y}`
          // Busier routes send their pulse more often. Staggered by index so
          // every arc on the map does not fire in lockstep, which reads as one
          // blinking object rather than as independent traffic.
          const dur = Math.max(1.6, 4.2 - Math.min(2.4, a.n * 0.3))
          return (
            <g key={a.key}>
              <path d={d} fill="none" stroke={CYAN} strokeOpacity={0.3}
                strokeWidth={(0.5 + Math.min(2, a.n * 0.25)) * k}
                strokeDasharray={`${3 * k} ${3 * k}`}
                style={{ animation: 'om-dash 6s linear infinite' }} />
              {/* animateMotion rather than a JS rAF loop: the browser drives it
                  off the compositor, so a hundred arcs cost nothing on the main
                  thread and keep moving while React re-renders around them. */}
              <circle r={1.5 * k} fill={CYAN} filter="url(#om-glow)">
                <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={d}
                               begin={`${(i % 7) * 0.35}s`} />
              </circle>
            </g>
          )
        })}

        {/* Destinations — where the calls went. */}
        {targets.map(t => {
          const { x, y } = project(t.lat, t.lon, MAP_W, MAP_H)
          // Tiny by design. There will eventually be one of these per state
          // dialed into; at the old size a busy week painted the whole country
          // amber and the origins disappeared underneath it.
          const r = (0.5 + Math.sqrt(t.calls / maxCalls) * 1.1) * pingK
          const on = selected === t.key
          return (
            <g key={t.key} style={{ cursor: 'pointer' }}
               onClick={() => { if (!moved.current) setSelected(on ? null : t.key) }}>
              <circle cx={x} cy={y} r={r * 4} fill="url(#om-halo-t)" />
              <circle cx={x} cy={y} r={r} fill={AMBER} fillOpacity={0.9} filter="url(#om-glow)" />
              <circle cx={x} cy={y} r={r + (on ? 3 : 1.5) * k} fill="none"
                      stroke={AMBER} strokeOpacity={on ? 0.95 : 0.4} strokeWidth={(on ? 1.4 : 0.7) * k} />
              {/* Native title: hover answers the small question without a
                  click, and it reaches keyboard and screen readers, which a
                  hand-built floating div would not. */}
              <title>{`${t.label} — ${t.calls} dialed, ${t.answered} answered`}</title>
            </g>
          )
        })}

        {/* Origins — people. */}
        {points.map(p => {
          const { x, y } = project(p.lat, p.lon, MAP_W, MAP_H)
          // Sized for a map with hundreds of these on it, not four.
          const r = (0.9 + Math.sqrt(p.users / maxUsers) * 2.0) * pingK
          const live = p.online > 0
          const c = live ? GREEN : CYAN
          const on = selected === p.key
          return (
            <g key={p.key} style={{ cursor: 'pointer' }}
               onClick={() => { if (!moved.current) setSelected(on ? null : p.key) }}>
              <circle cx={x} cy={y} r={r * 5} fill={live ? 'url(#om-halo-hot)' : 'url(#om-halo)'} />
              {live && (
                <circle cx={x} cy={y} r={r} fill="none" stroke={GREEN} strokeWidth={1.1 * k}
                        style={{ transformOrigin: `${x}px ${y}px`, animation: 'om-ping 2.4s ease-out infinite' }} />
              )}
              <circle cx={x} cy={y} r={r} fill={c} fillOpacity={0.95} filter="url(#om-glow)" />
              <circle cx={x} cy={y} r={r + (on ? 3.4 : 1.6) * k} fill="none"
                      stroke={c} strokeOpacity={on ? 1 : 0.55} strokeWidth={(on ? 1.6 : 0.8) * k} />
              <title>
                {`${p.label} — ${p.users} ${isVisitors ? 'visitor' : 'person'}${p.users === 1 ? '' : 's'}` +
                 (p.online ? `, ${p.online} dialing now` : '')}
              </title>
              {zoom > 2.6 && (
                <text x={x} y={y - r - 3.4 * k} textAnchor="middle" fill={INK}
                      style={{ fontSize: `${6.5 * k}px`, letterSpacing: `${0.3 * k}px`, pointerEvents: 'none',
                               fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  {p.label.toUpperCase()} · {p.users}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Vignette. Pure decoration, and the reason the panels read as floating
          above the map rather than pasted onto it — the corners fall away, so
          the eye lands in the middle where the data is. Never intercepts a
          pointer, or it would eat every drag. */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background:
          'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.45) 78%, rgba(0,0,0,0.78) 100%)',
      }} />

      {/* ── TOP BAR ─────────────────────────────────────────────────────────
          The bar and the status line share one absolutely-positioned column
          rather than each being pinned to its own `top`. The bar wraps — five
          modes, five ranges and six buttons will not fit one row on a narrow
          window — and a status strip nailed to top:40 sat underneath the
          second row the moment it did. Stacking them means the status is
          wherever the bar ended, at any width. */}
      <div style={{
        position: 'absolute', top: 8, left: 8, right: 8, zIndex: 6,
        pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 5,
      }}>
      <div style={{
        display: 'flex',
        gap: 6, flexWrap: 'wrap', alignItems: 'center', pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', pointerEvents: 'auto' }}>
          {MODES.map(m => (
            <button key={m.id} className="om-chip" data-on={mode === m.id} title={m.hint}
                    onClick={() => { setMode(m.id); setSelected(null) }}>{m.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, pointerEvents: 'auto' }} className="om-hide-sm">
          {RANGES.map(r => (
            <button key={r} className="om-chip" data-on={range === r}
                    onClick={() => setRange(r)}>{r.toUpperCase()}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, pointerEvents: 'auto', marginLeft: 'auto' }}>
          {/* A switch rather than a chip: this hides a whole layer of the
              map, and a toggle that looks like the mode buttons beside it
              invites being read as another mode. */}
          <button className="om-chip om-switch" data-on={showTargets}
                  title="Show or hide the tiny dots marking where calls were placed"
                  onClick={() => setShowTargets(v => !v)}>
            <span className="om-track"><span className="om-knob" /></span>
            CALLS MADE
          </button>
          <button className="om-chip" title="Fullscreen (Esc to exit)"
                  onClick={toggleFull}>{isFull ? 'EXIT' : 'FULL'}</button>
          <button className="om-chip" onClick={() => zoomAbout(1.6)}>+</button>
          <button className="om-chip" onClick={() => zoomAbout(1 / 1.6)}>−</button>
          <button className="om-chip" onClick={() => { setView(HOME); setSelected(null) }}>US</button>
          <button className="om-chip" onClick={() => { setView(WORLD); setSelected(null) }}>WORLD</button>
        </div>
      </div>

      {/* Status strip — now a sibling in the column above, so it follows the
          bar down instead of being overlapped by it. */}
      <div style={{
        fontSize: 9.5, paddingLeft: 2,
        letterSpacing: 1.4, color: DIM, fontFamily: 'ui-monospace, Menlo, monospace',
        textShadow: `0 0 8px ${VOID}`, pointerEvents: 'none',
      }}>
        <span style={{ color: GREEN }}>●</span> LIVE · {SYNC_MS / 1000}s
        {data && <> · {data.totals.placed} PLACED / {data.totals.locations} LOC</>}
        {data && data.totals.trialing > 0 &&
          <> · <span style={{ color: CYAN }}>{data.totals.trialing} TRIALING</span></>}
        {data && data.totals.targetCalls > 0 &&
          <> · <span style={{ color: AMBER }}>{data.totals.targetCalls} DIALED</span> / {data.totals.targetLocations} ST</>}
        {data && data.totals.unplaced > 0 && <> · <span style={{ color: AMBER }}>{data.totals.unplaced} UNPLACED</span></>}
        {zoom > 1.02 && <> · {zoom.toFixed(1)}×</>}
        {err && <> · <span style={{ color: RED }}>{err}</span></>}
        {!data && <> · SYNCING…</>}
      </div>
      </div>

      {/* ── DETAIL ──────────────────────────────────────────────────────── */}
      {(selPoint || selTarget) && (
        <div className="om-panel om-detail">
          <div className="om-head" onClick={() => setSelected(null)}>
            {(selPoint?.label || selTarget?.label || '').toUpperCase()}
            <span className="om-caret">✕</span>
          </div>
          <div className="om-scroll" style={{ padding: '8px 10px' }}>
            {selTarget && (
              <>
                <Row k="CALLS PLACED" v={String(selTarget.calls)} c={AMBER} />
                <Row k="ANSWERED" v={String(selTarget.answered)} c={GREEN} />
                <Row k="CONNECTED" v={String(selTarget.connected)} c={CYAN} />
                <Row k="ANSWER RATE" v={selTarget.calls ? `${Math.round((selTarget.answered / selTarget.calls) * 100)}%` : '—'} />
                <Row k="AREA CODES" v={selTarget.codes.join(', ')} />
              </>
            )}
            {selPoint && (
              <>
                <Row k={isVisitors ? 'UNIQUE VISITORS' : 'PEOPLE'} v={String(selPoint.users)} c={CYAN} />
                {selPoint.online > 0 && <Row k="DIALING NOW" v={String(selPoint.online)} c={GREEN} />}
                {selPoint.trialing > 0 && <Row k="ON TRIAL" v={String(selPoint.trialing)} c={CYAN} />}
                {!detail && <div style={{ color: DIM, fontSize: 10, padding: '6px 0' }}>Loading…</div>}

                {detail?.traffic && (
                  <Section title={`TRAFFIC · ${range.toUpperCase()}`}>
                    <Row k="VISITORS" v={String(detail.traffic.visitors ?? 0)} />
                    <Row k="VIEWS" v={String(detail.traffic.views ?? 0)} />
                    <Row k="SIGNED-IN VIEWS" v={String(detail.traffic.authed ?? 0)} />
                    {/* Attention and what it turned into, together. "312 views,
                        14 visitors, 0 signed up" is a different story from the
                        same traffic with three, and reading it used to mean
                        holding two panels in your head. */}
                    <Row k="SIGNED UP" v={String(detail.traffic.signups ?? 0)}
                         c={(detail.traffic.signups ?? 0) > 0 ? GREEN : DIM} />
                    <Row k={`SIGNED UP · ${range.toUpperCase()}`}
                         v={String(detail.traffic.signupsInRange ?? 0)}
                         c={(detail.traffic.signupsInRange ?? 0) > 0 ? GREEN : DIM} />
                  </Section>
                )}

                {Array.isArray(detail?.sources) && detail.sources.length > 0 && (
                  <Section title="CAME FROM">
                    {detail.sources.map((s, i) => (
                      <Row key={i} k={s.source} v={String(s.views)}
                           c={s.source?.includes('chatgpt') ? PINK : undefined} />
                    ))}
                  </Section>
                )}

                {Array.isArray(detail?.topPaths) && detail.topPaths.length > 0 && (
                  <Section title="READ">
                    {detail.topPaths.map((p, i) => (
                      <Row key={i} k={p.path} v={String(p.views)} />
                    ))}
                  </Section>
                )}

                {Array.isArray(detail?.people) && detail.people.length > 0 && (
                  <Section title={`PEOPLE · ${detail.people.length}`}>
                    {detail.people.map((p, i) => (
                      <div key={i} style={{
                        border: `1px solid ${EDGE}`, borderRadius: 3, padding: '6px 7px',
                        marginBottom: 5, background: 'rgba(18,80,138,0.08)',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: p.online ? GREEN : INK }}>
                          {p.online ? '● ' : ''}{p.label}
                        </div>
                        {p.username && (
                          <div style={{ fontSize: 9.5, color: CYAN }}>@{p.username}</div>
                        )}
                        <div style={{ fontSize: 9.5, color: DIM, marginBottom: 4 }}>{p.email}</div>
                        <Row k="STATUS" v={statusLabel(p)} c={statusColour(p)} />
                        <Row k="CALLS" v={`${p.calls} · ${p.answered} answered`} />
                        <Row k="CAMPAIGNS" v={`${p.campaigns} · ${p.leads} leads`} />
                        {p.device && <Row k="DEVICE" v={`${p.device}${p.mode ? ` · ${p.mode}` : ''}`} />}
                        {p.state && <Row k="DIALER" v={p.state} c={p.state === 'available' ? GREEN : MUTED} />}
                        {p.lastCall && <Row k="LAST CALL" v={new Date(p.lastCall).toLocaleString()} />}
                        <Row k="JOINED" v={new Date(p.joined).toLocaleDateString()} />
                      </div>
                    ))}
                  </Section>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── DOCK ────────────────────────────────────────────────────────── */}
      <div className="om-dock">
        {/* VOLUME. The panels below count; this shows shape. "1,569 skipped"
            and "1,569 skipped, all inside twenty minutes on Tuesday" are
            different facts and only one of them survives a total. */}
        {(data?.pulse?.length ?? 0) > 0 && (
          <div className="om-panel om-pulse-wrap om-hide-sm">
            <div className="om-head" onClick={() => setPulseOpen(o => !o)}>
              CALL VOLUME · {range.toUpperCase()}
              <span className="om-caret">{pulseOpen ? '▼' : '▲'}</span>
            </div>
            {pulseOpen && <Pulse buckets={data!.pulse} />}
          </div>
        )}

        <div className="om-dock-row">
          <div className="om-panel om-feed-wrap" style={feedOpen ? undefined : { maxHeight: 'none' }}>
            <div className="om-head" onClick={() => setFeedOpen(o => !o)}>
              {feedView === 'calls' ? 'LIVE CALLS' : 'PEOPLE'}
              <span className="om-caret">{feedOpen ? '▼' : '▲'}</span>
            </div>

            {feedOpen && (
              <>
                {/* View and filter live in the panel, not the top bar. They
                    change what this box shows and nothing else, and a control
                    sitting next to the thing it changes never has to be
                    explained. Stops propagation so picking a filter does not
                    also collapse the panel underneath it. */}
                <div className="om-subbar" onClick={e => e.stopPropagation()}>
                  <button className="om-mini" data-on={feedView === 'calls'}
                          onClick={() => setFeedView('calls')}>CALLS</button>
                  <button className="om-mini" data-on={feedView === 'people'}
                          onClick={() => setFeedView('people')}>PEOPLE</button>
                  {feedView === 'calls' ? (
                    <>
                      <span className="om-sep" />
                      {([
                        ['all', 'ALL'], ['answered', 'ANSWERED'], ['missed', 'MISSED'],
                        ['human', 'HUMAN'], ['machine', 'MACHINE'],
                      ] as const).map(([id, lbl]) => (
                        <button key={id} className="om-mini" data-on={callFilter === id}
                                onClick={() => setCallFilter(id)}>{lbl}</button>
                      ))}
                    </>
                  ) : (
                    <>
                      <span className="om-sep" />
                      {([
                        ['all', 'ALL'], ['online', 'ONLINE'], ['paying', 'PAYING'],
                        ['trial', 'TRIAL'], ['seat', 'ON A SEAT'], ['dialed', 'HAS DIALED'],
                        ['unplaced', 'UNPLACED'],
                      ] as const).map(([id, lbl]) => (
                        <button key={id} className="om-mini" data-on={peopleFilter === id}
                                onClick={() => setPeopleFilter(id)}>{lbl}</button>
                      ))}
                    </>
                  )}
                  <span style={{ marginLeft: 'auto', color: DIM, fontSize: 9, letterSpacing: 1 }}>
                    {feedView === 'calls'
                      ? shownFeed.length + ' of ' + (data?.feed ?? []).length
                      : shownPeople.length + ' of ' + (data?.people ?? []).length + ' accounts'}
                  </span>
                </div>

                <div className="om-scroll">
                  {feedView === 'calls' ? (
                    <table className="om-t">
                      <thead>
                        <tr>
                          <th>TIME</th>
                          <th style={{ color: GREEN }}>AGENT</th>
                          <th className="om-hide-sm">FROM</th>
                          <th style={{ color: AMBER }}>DIALED</th>
                          <th className="om-hide-sm">TO</th>
                          <th className="om-hide-sm">DUR</th>
                          <th className="om-hide-sm">TALK</th>
                          <th>RESULT</th>
                          <th className="om-hide-sm">AMD</th>
                          <th className="om-hide-sm">CAMPAIGN</th>
                          <th className="om-hide-sm">REC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownFeed.map(f => (
                          <tr key={f.id} data-fresh={freshIds.has(f.id) ? '1' : undefined}>
                            <td style={{ color: CYAN }}>{hhmmss(f.at)}</td>
                            <td style={{ color: GREEN }}>{f.agent}</td>
                            <td className="om-hide-sm" style={{ color: MUTED }}>{f.agentPlace || '—'}</td>
                            <td style={{ color: AMBER }}>{prettyPhone(f.phone)}</td>
                            <td className="om-hide-sm" style={{ color: MUTED }}>{f.targetPlace || 'unknown'}</td>
                            {/* Nine seconds is the compliance floor, so a short
                                call is worth seeing without reading the number. */}
                            <td className="om-hide-sm" style={{ color: f.duration >= 9 ? INK : RED }}>{f.duration}s</td>
                            <td className="om-hide-sm" style={{ color: f.talkSeconds ? INK : DIM }}>
                              {f.talkSeconds ? f.talkSeconds + 's' : '—'}
                            </td>
                            <td style={{ color: f.disposition ? dispColour(f.disposition) : (f.answered ? INK : DIM) }}>
                              {f.disposition || (f.answered ? 'answered' : 'no answer')}
                            </td>
                            <td className="om-hide-sm" style={{ color: amdColour(f.amdResult) }}>
                              {f.amdResult || (f.amdRequested ? 'pending' : 'off')}
                            </td>
                            <td className="om-hide-sm" style={{ color: DIM }}>{f.campaign || 'manual'}</td>
                            <td className="om-hide-sm"
                                style={{ color: f.recording === 'completed' ? VIOLET : DIM }}>
                              {f.recording === 'completed' ? 'rec' : '—'}
                            </td>
                          </tr>
                        ))}
                        {shownFeed.length === 0 && (
                          <tr><td colSpan={11} style={{ color: DIM, padding: 10 }}>
                            {(data?.feed ?? []).length === 0
                              ? 'No calls yet.'
                              : 'No calls match this filter.'}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="om-t">
                      <thead>
                        <tr>
                          <th style={{ color: GREEN }}>WHO</th>
                          <th className="om-hide-sm">USERNAME</th>
                          <th className="om-hide-sm">EMAIL</th>
                          <th>STATUS</th>
                          <th className="om-hide-sm">WHERE</th>
                          <th className="om-hide-sm">DEVICE</th>
                          <th>CALLS</th>
                          <th className="om-hide-sm">CAMPAIGNS</th>
                          <th className="om-hide-sm">LEADS</th>
                          <th className="om-hide-sm">LAST CALL</th>
                          <th className="om-hide-sm">JOINED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownPeople.map(pr => (
                          <tr key={pr.id}>
                            <td style={{ color: pr.online ? GREEN : INK }}>
                              {pr.online ? '● ' : ''}{pr.label}
                            </td>
                            {/* The display label falls back to username, so
                                without its own column the handle disappears the
                                moment somebody sets a real name. */}
                            <td className="om-hide-sm" style={{ color: CYAN }}>{pr.username || '—'}</td>
                            <td className="om-hide-sm" style={{ color: MUTED }}>{pr.email || '—'}</td>
                            <td style={{ color: statusColour(pr) }}>{statusLabel(pr)}</td>
                            <td className="om-hide-sm" style={{ color: MUTED }}>{pr.place || 'unplaced'}</td>
                            <td className="om-hide-sm" style={{ color: DIM }}>
                              {pr.device || '—'}{pr.dialerMode ? ' · ' + pr.dialerMode : ''}
                            </td>
                            <td style={{ color: pr.calls ? INK : DIM }}>
                              {pr.calls}{pr.calls ? ' · ' + pr.answered + 'a' : ''}
                            </td>
                            <td className="om-hide-sm" style={{ color: DIM }}>{pr.campaigns}</td>
                            <td className="om-hide-sm" style={{ color: DIM }}>{pr.leads}</td>
                            <td className="om-hide-sm" style={{ color: DIM }}>
                              {pr.lastCall ? new Date(pr.lastCall).toLocaleDateString() : '—'}
                            </td>
                            <td className="om-hide-sm" style={{ color: DIM }}>
                              {new Date(pr.joined).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                        {shownPeople.length === 0 && (
                          <tr><td colSpan={11} style={{ color: DIM, padding: 10 }}>
                            {(data?.people ?? []).length === 0
                              ? 'No accounts.'
                              : 'No accounts match this filter.'}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="om-panel om-rank-wrap" style={ranksOpen ? undefined : { maxHeight: 'none' }}>
            {/* The range belongs in this title and not on the feed, because the
                two genuinely differ: the feed is the latest calls whenever they
                happened, these counts are bounded by the range. Leaving both
                unlabelled invites reading one as the other. */}
            <div className="om-head" onClick={() => setRanksOpen(o => !o)}>
              BREAKDOWN · {range.toUpperCase()}
              <span className="om-caret">{ranksOpen ? '▼' : '▲'}</span>
            </div>
            {ranksOpen && (
              <div className="om-scroll" style={{ padding: '4px 0 6px' }}>
                {(ranks.disposition || []).length === 0 &&
                 (ranks.amd || []).length === 0 &&
                 points.length === 0 && (
                  <div style={{ color: DIM, fontSize: 10, padding: '8px 10px', lineHeight: 1.7 }}>
                    Nothing in the last {range}. Widen the range, or check a mode
                    with data behind it.
                  </div>
                )}
                <RankList title="DISPOSITIONS" rows={ranks.disposition || []} colour={r => dispColour(r.label)} />
                <RankList title="DETECTION" rows={ranks.amd || []} colour={r => amdColour(r.label)} />
                <RankList title="HOW DIALED" rows={ranks.source || []} colour={() => CYAN} />
                <RankList title="BY AGENT" rows={ranks.agent || []} colour={() => GREEN} />
                <RankList
                  title={isVisitors ? 'TOP PLACES (VISITORS)' : 'TOP PLACES'}
                  rows={points.slice(0, 8).map(p => ({ label: p.label, n: p.users, detail: p.online ? `${p.online} live` : '' }))}
                  colour={r => (r.detail ? GREEN : CYAN)}
                  onPick={l => { const p = points.find(x => x.label === l); if (p) focus(p.lat, p.lon, p.key) }}
                />
                {targets.length > 0 && (
                  <RankList
                    title="DIALED INTO"
                    rows={targets.slice(0, 8).map(t => ({ label: t.label, n: t.calls, detail: `${t.answered} ans` }))}
                    colour={() => AMBER}
                    onPick={l => { const t = targets.find(x => x.label === l); if (t) focus(t.lat, t.lon, t.key) }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── VOLUME STRIP ────────────────────────────────────────────────────────
// Bars are calls placed, the overlaid line is calls answered. Two series in
// one strip rather than two strips, because the question is always the ratio
// between them — dialing hard and connecting nothing looks identical to not
// dialing when the second series is somewhere else on screen.
function Pulse({ buckets }: { buckets: PulseBucket[] }) {
  const W = 1000, H = 46
  const max = Math.max(1, ...buckets.map(b => b.calls))
  const n = buckets.length
  const bw = W / Math.max(1, n)
  const total = buckets.reduce((s, b) => s + b.calls, 0)
  const ans = buckets.reduce((s, b) => s + b.answered, 0)
  const line = buckets.map((b, i) => {
    const x = i * bw + bw / 2
    const y = H - (b.answered / max) * H
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const label = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div style={{ padding: '5px 9px 6px' }}>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline',
        fontSize: 8.5, letterSpacing: 2, fontWeight: 800, marginBottom: 3,
      }}>
        <span style={{ color: DIM, letterSpacing: 1 }}>
          <span style={{ color: CYAN }}>{total}</span> placed ·{' '}
          <span style={{ color: GREEN }}>{ans}</span> answered ·{' '}
          {total ? Math.round((ans / total) * 100) : 0}%
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           style={{ width: '100%', height: 46, display: 'block', overflow: 'visible' }}>
        {buckets.map((b, i) => {
          const h = (b.calls / max) * H
          return (
            <rect key={i} x={i * bw + bw * 0.14} y={H - h}
                  width={bw * 0.72} height={h}
                  fill={CYAN} fillOpacity={b.calls ? 0.4 : 0}>
              <title>{`${label(b.at)} — ${b.calls} placed, ${b.answered} answered`}</title>
            </rect>
          )
        })}
        <path d={line} fill="none" stroke={GREEN} strokeWidth={1.4}
              strokeOpacity={0.95} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 8, color: DIM, marginTop: 1,
        fontFamily: 'ui-monospace, Menlo, monospace',
      }}>
        <span>{buckets.length ? label(buckets[0].at) : ''}</span>
        <span>{buckets.length ? label(buckets[buckets.length - 1].at) : 'now'}</span>
      </div>
    </div>
  )
}

// ── WHAT A PERSON'S STATUS ACTUALLY IS ──────────────────────────────────
// An owner-funded agent holds no subscription, so `status` alone reports them
// as having nothing — which reads as a freeloader rather than as a paid seat
// somebody else covers. The payer wins over the empty status for exactly that
// reason, and is shown as a name because "owner-funded" answers a different,
// less useful question than "Chris is paying for this".
type StatusLike = {
  seatPayer?: string | null; status: string | null
  plan: string | null; trialEnd?: string | null
}
function statusLabel(p: StatusLike): string {
  if (p.seatPayer) return `seat · ${p.seatPayer}`
  if (!p.status) return 'no sub'
  if (p.status === 'trialing') {
    if (!p.trialEnd) return 'trialing'
    const days = Math.ceil((new Date(p.trialEnd).getTime() - Date.now()) / 86400000)
    return days > 0 ? `trial · ${days}d left` : 'trial ending'
  }
  return p.plan ? `${p.status} · ${p.plan}` : p.status
}
function statusColour(p: StatusLike): string {
  if (p.seatPayer) return VIOLET
  if (p.status === 'trialing') return CYAN
  if (p.status === 'active') return GREEN
  if (p.status === 'canceled' || p.status === 'unpaid') return AMBER
  if (!p.status) return DIM
  return MUTED
}

function Row({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 10,
      fontSize: 10, padding: '1.5px 0',
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    }}>
      <span style={{ color: DIM, letterSpacing: 0.6, flexShrink: 0 }}>{k}</span>
      <span style={{ color: c || INK, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
    </div>
  )
}
// ── A FOLDABLE SECTION ──────────────────────────────────────────────────
// The detail panel stacks four of these and a place with ten people pushes
// everything else off the bottom. Collapsing is per-section and per-title, so
// the choice survives clicking a different ping — closing PEOPLE once should
// not have to be done again at every location.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const storeKey = 'ds:ops-map:sec:' + title.split(' · ')[0]
  const [open, setOpen] = useState(() => {
    try { return window.localStorage.getItem(storeKey) !== '0' }
    catch { return true }
  })
  const toggle = () => {
    setOpen(o => {
      const next = !o
      try { window.localStorage.setItem(storeKey, next ? '1' : '0') } catch {}
      return next
    })
  }
  return (
    <div>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 8.5, letterSpacing: 2, color: EDGE_HOT, fontWeight: 800,
          margin: '9px 0 3px', borderTop: `1px solid ${EDGE}`, paddingTop: 6,
          textAlign: 'left',
        }}
      >
        {title}
        <span style={{ color: EDGE_HOT, fontSize: 8 }}>{open ? '▼' : '▲'}</span>
      </button>
      {open && children}
    </div>
  )
}
function RankList({ title, rows, colour, onPick }: {
  title: string
  rows: { label: string; n: number; detail: string }[]
  colour: (r: { label: string; n: number; detail: string }) => string
  onPick?: (label: string) => void
}) {
  if (!rows.length) return null
  const max = Math.max(1, ...rows.map(r => r.n))
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        fontSize: 8.5, letterSpacing: 2, color: EDGE_HOT, fontWeight: 800,
        padding: '5px 9px 3px',
      }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="om-rank"
             style={{ cursor: onPick ? 'pointer' : 'default' }}
             onClick={() => onPick?.(r.label)}>
          <span style={{ color: DIM, width: 26, textAlign: 'right', flexShrink: 0 }}>{r.n}</span>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: colour(r), boxShadow: `0 0 4px ${colour(r)}`,
          }} />
          <span style={{
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', color: INK,
          }}>{r.label}</span>
          <span style={{ color: DIM, fontSize: 9, flexShrink: 0 }}>{r.detail}</span>
          <span style={{
            position: 'absolute', left: 0, height: 1, bottom: 0,
            width: `${(r.n / max) * 100}%`, background: colour(r), opacity: 0.25,
          }} />
        </div>
      ))}
    </div>
  )
}
