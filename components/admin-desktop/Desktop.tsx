'use client'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { APPS, getApp } from './registry'
import AppWindow from './AppWindow'
import Taskbar from './Taskbar'
import StartMenu from './StartMenu'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import { DesktopServicesContext, isBaseApp, uninstallWarns, DEFAULT_HIDDEN_APP_IDS, type DesktopServices } from './desktopServices'
import type { AppId, AppRole, WindowState, RecentApp } from './types'
import { appVisibleToRole } from './types'

// =============================================================================
// DESKTOP — root shell component
// =============================================================================
// v25 changes vs v24.1:
// - CLEAN DEFAULT ARRANGEMENT (restore): unsaved icons fill ROW-MAJOR across
//   4 columns (left-to-right, then next row) — the tidy v22 grid look —
//   instead of v24's tall first column. Grid snapping, no-overlap cells, and
//   layout freezing are unchanged; only the DEFAULT placement order differs.
//   "Reset icon layout" returns to this arrangement.
// - XP AUTUMN WALLPAPER: uses `contain` so the FULL image is shown uncropped
//   (JC: "not zoomed in, the full version"). On screens whose aspect ratio
//   differs from the image's 3:2, this leaves a BLACK mat (#000000) on the
//   short sides — the intended tradeoff for showing the whole picture rather
//   than cropping it as `cover` did.
// - TASKBAR PILL REORDER: new reorderWindows(dragId, targetId) moves a
//   window within the windows array (pill order = array order, zIndex
//   untouched); passed to Taskbar v2 as onReorderWindows.
// - ICON RESTYLE (de-cheese pass): smaller squircle tiles (52px, radius 12),
//   glossy inset highlight removed, softer shadow, slightly smaller emoji,
//   subtle desaturation. Plus iconSrc support — registry entries that set
//   iconSrc render a real image instead of the emoji (types v3).
// - ACCOUNT HIDDEN BY DEFAULT: initial hiddenApps falls back to
//   DEFAULT_HIDDEN_APP_IDS (['clerk-profile']) when no localStorage cache
//   exists; server-side defaults handled by prefs route v3 + migration 014.
//   ADD TO DESKTOP in the App Store still restores it permanently.
//
// v24.1: open-desktop-app event listener (Account window repair).
// v24: grid snapping, wallpaper drag-drop, OG presets, App Store system.
//
// v25.1: RUBBER-BAND / OVERSCROLL FIX — iOS bounce could reveal the
//   hardcoded-dark `body` background behind this component (which is
//   `position: fixed`, so it never scrolls itself, but nothing enforced
//   containment on the actually-scrollable regions beneath it). Added a
//   mount-time effect that pins body/html background + overscroll-behavior
//   while Desktop is mounted, and `overscrollBehavior: contain` +
//   `WebkitOverflowScrolling: touch` on the mobile icon grid, the one
//   genuinely scrollable region owned by this file.
// =============================================================================

const MOBILE_BREAKPOINT = 768
const TASKBAR_VISIBLE_HEIGHT = 48
// Persistence is namespaced by role so an admin and a manager on the same
// browser never collide. Admin keys keep their original v1 strings so existing
// admin desktops load unchanged; manager gets its own namespace + its own API.
function lsKeyFor(role: AppRole): string {
  return role === 'admin' ? 'ds:admin-desktop:v1' : `ds:${role}-desktop:v1`
}
function prefsLsKeyFor(role: AppRole): string {
  return role === 'admin' ? 'ds:admin-desktop:prefs:v1' : `ds:${role}-desktop:prefs:v1`
}
// API base for prefs + wallpaper. Admin → /api/admin/desktop-prefs (unchanged).
// Manager → /api/manager/desktop-prefs (route to be added; until it exists the
// fetches fail soft and the manager desktop persists via localStorage only).
function prefsApiBaseFor(role: AppRole): string {
  return role === 'admin' ? '/api/admin/desktop-prefs' : `/api/${role}/desktop-prefs`
}

// ── ICON GRID (the invisible Windows grid) ──────────────────────────────────
const ICON_W = 96
const ICON_H = 92
const CELL_W = 110
const CELL_H = 106
const GRID_X = 20   // grid origin
const GRID_Y = 20
const DEFAULT_FILL_COLS = 4   // v25: default arrangement = 4-wide rows (v22 look)

// Per-role default arrangement. Admin keeps the 4-wide row-major grid. Manager+
// defaults to a single column down the left (Dashboard, Analytics, Teams, App
// Store, top→bottom). Once a user drags an icon, their saved positions win and
// this no longer applies.
function defaultFillColsFor(role: AppRole): number {
  return role === 'manager' ? 1 : DEFAULT_FILL_COLS
}

// Explicit default placement order for the manager desktop, top→bottom. Apps
// not listed fall back to registry order after these. Ids the manager can't see
// (or that aren't installed/visible) are simply skipped.
const MANAGER_DEFAULT_ORDER: string[] = ['dashboard', 'analytics', 'teams', 'appstore']

function gridDims(vw: number, vh: number, taskbarH: number) {
  return {
    cols: Math.max(1, Math.floor((vw - GRID_X) / CELL_W)),
    rows: Math.max(1, Math.floor((vh - taskbarH - GRID_Y) / CELL_H)),
  }
}

function cellToXY(c: number, r: number) {
  return { x: GRID_X + c * CELL_W, y: GRID_Y + r * CELL_H }
}

function xyToCell(x: number, y: number) {
  return {
    c: Math.round((x - GRID_X) / CELL_W),
    r: Math.round((y - GRID_Y) / CELL_H),
  }
}

const cellKey = (c: number, r: number) => `${c},${r}`

// Nearest unoccupied cell to (c0, r0), searching outward ring by ring.
// Falls back to (c0, r0) if the entire grid is full (overlap as last resort).
function nearestFreeCell(
  c0: number, r0: number,
  cols: number, rows: number,
  occupied: Set<string>
): { c: number; r: number } {
  const maxRadius = Math.max(cols, rows)
  for (let radius = 0; radius <= maxRadius; radius++) {
    let best: { c: number; r: number; d: number } | null = null
    for (let c = Math.max(0, c0 - radius); c <= Math.min(cols - 1, c0 + radius); c++) {
      for (let r = Math.max(0, r0 - radius); r <= Math.min(rows - 1, r0 + radius); r++) {
        if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== radius) continue
        if (occupied.has(cellKey(c, r))) continue
        const d = (c - c0) ** 2 + (r - r0) ** 2
        if (!best || d < best.d) best = { c, r, d }
      }
    }
    if (best) return { c: best.c, r: best.r }
  }
  return { c: c0, r: r0 }
}

// ── BACKGROUNDS ──────────────────────────────────────────────────────────────
type BgSetting = { type: 'preset' | 'solid' | 'image'; value: string }

const DEFAULT_BG_CSS = `
  radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
  radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 60%),
  linear-gradient(180deg, #1a3a6a 0%, #4a7ab0 50%, #82a6cf 100%)
`

// OG wallpapers. Hotlinks can break or rate-limit — the durable setup is:
// download each image, drop it in /public/wallpapers/, and swap the url to
// '/wallpapers/<file>.jpg'. To add more OGs (Bliss, Vista Aurora, Win 10
// Hero...), save the file and add an entry — nothing else needed.
const BG_PRESETS: { id: string; name: string; css: string }[] = [
  { id: 'aero', name: 'AERO (DEFAULT)', css: DEFAULT_BG_CSS },
  {
    id: 'preset1',
    name: 'PRESET 1',
    css: `#1a3a6a url("https://i.imgur.com/394nH.jpeg") center / cover no-repeat`,
  },
  {
    id: 'preset2',
    name: 'PRESET 2',
    css: `#1a3a6a url("https://i.imgur.com/W8tQ3.jpeg") center / cover no-repeat`,
  },
  {
    id: 'preset3',
    name: 'PRESET 3',
    css: `#1a3a6a url("https://i.imgur.com/Zslk8.jpeg") center / cover no-repeat`,
  },
  {
    id: 'preset4',
    name: 'PRESET 4',
    css: `#1a3a6a url("https://i.imgur.com/eBgJB.jpeg") center / cover no-repeat`,
  },
  {
    id: 'preset5',
    name: 'PRESET 5',
    css: `#000000 url("https://i.redd.it/82smngfjfs251.jpg") center / cover no-repeat`,
  },
  {
    id: 'win7',
    name: 'WINDOWS 7',
    css: `#1a3a6a url("https://wallpapers.com/images/hd/windows-7-background-imfecqv6cnsicbx4.jpg") center / cover no-repeat`,
  },
  {
    // XP Autumn. Uses the smart-cropped preview.redd.it render with `cover`
    // so it fills the screen edge-to-edge — no side bars. (The earlier
    // i.redd.it + `contain` combo showed a dark mat as bars on wide screens.)
    id: 'bliss',
    name: 'XP AUTUMN',
    css: `#000000 url("https://preview.redd.it/finally-windows-xps-autumn-wallpaper-in-full-res-4200x2800-v0-3ma6nhepxbb81.jpg?width=1080&crop=smart&auto=webp&s=e3747c3ccf8c439969200d2d67fb06d3f3738138") center / contain no-repeat`,
  },
  // { id: 'vista', name: 'VISTA AURORA', css: `#0d2a1a url("/wallpapers/vista-aurora.jpg") center / cover no-repeat` },
  // { id: 'win10', name: 'WIN 10 HERO', css: `#0a2a4a url("/wallpapers/win10-hero.jpg") center / cover no-repeat` },
]

function bgCssFor(bg: BgSetting | null): string {
  if (!bg) return DEFAULT_BG_CSS
  if (bg.type === 'preset') {
    return BG_PRESETS.find(p => p.id === bg.value)?.css ?? DEFAULT_BG_CSS
  }
  if (bg.type === 'solid') return bg.value
  if (bg.type === 'image') {
    const safe = bg.value.replace(/["\\]/g, '')
    return `#1a3a6a url("${safe}") center / cover no-repeat`
  }
  return DEFAULT_BG_CSS
}

interface PersistedState {
  windows: WindowState[]
  focusedId: string | null
  topZ: number
}

// Apps that must NEVER be restored as open windows on boot. The Dashboard app
// is a "navigate away" launcher — restoring it as an open window (the desktop
// remembers last-session windows) caused a redirect loop. We drop these from
// the restored window set; they only ever open by an explicit click.
const NEVER_RESTORE_APP_IDS: string[] = ['dashboard']

function loadPersistedState(role: AppRole): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(lsKeyFor(role))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!Array.isArray(parsed.windows)) return null
    // Filter out never-restore apps so a leftover Dashboard window from a prior
    // session can't reopen (and, with old builds, re-trigger the redirect loop).
    const windows = parsed.windows.filter(w => !NEVER_RESTORE_APP_IDS.includes(w.appId))
    const dropped = windows.length !== parsed.windows.length
    const focusedId = (parsed.focusedId && windows.some(w => w.id === parsed.focusedId))
      ? parsed.focusedId : null
    return { ...parsed, windows, focusedId: dropped ? focusedId : parsed.focusedId }
  } catch {
    return null
  }
}

function savePersistedState(role: AppRole, state: PersistedState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(lsKeyFor(role), JSON.stringify(state))
  } catch {}
}

interface CachedPrefs {
  iconPositions: Record<string, { x: number; y: number }>
  background: BgSetting | null
  installedApps: string[]
  hiddenApps: string[]
}

function loadCachedPrefs(role: AppRole): CachedPrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(prefsLsKeyFor(role))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedPrefs>
    return {
      iconPositions: parsed.iconPositions && typeof parsed.iconPositions === 'object'
        ? parsed.iconPositions : {},
      background: parsed.background ?? null,
      installedApps: Array.isArray(parsed.installedApps) ? parsed.installedApps : [],
      hiddenApps: Array.isArray(parsed.hiddenApps) ? parsed.hiddenApps : [],
    }
  } catch {
    return null
  }
}

interface RightClickState {
  type: 'desktop' | 'icon' | 'taskbar-item' | 'titlebar'
  x: number
  y: number
  payload?: any
}

interface PositionHint {
  shiftX?: number
  shiftY?: number
}

export default function Desktop({ role = 'admin' }: { role?: AppRole } = {}) {
  const router = useRouter()

  const initial = (typeof window !== 'undefined') ? loadPersistedState(role) : null
  const initialPrefs = (typeof window !== 'undefined') ? loadCachedPrefs(role) : null

  const [windows, setWindows] = useState<WindowState[]>(initial?.windows ?? [])
  const [focusedId, setFocusedId] = useState<string | null>(initial?.focusedId ?? null)
  const [topZ, setTopZ] = useState(initial?.topZ ?? 100)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<RightClickState | null>(null)
  // App pending an uninstall confirm via the desktop right-click menu. Only set
  // for apps in UNINSTALL_WARN_APP_IDS (e.g. Notes) so the same "all data will
  // be deleted" warning the App Store shows also gates the icon's Uninstall.
  const [confirmUninstallId, setConfirmUninstallId] = useState<AppId | null>(null)
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [bootedAnalytics, setBootedAnalytics] = useState((initial?.windows.length ?? 0) > 0)
  const [safeAreaBottom, setSafeAreaBottom] = useState(0)
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  // ── prefs state ──────────────────────────────────────────────────────────
  const [iconPositions, setIconPositions] = useState<Record<string, { x: number; y: number }>>(
    initialPrefs?.iconPositions ?? {}
  )
  const [background, setBackground] = useState<BgSetting | null>(initialPrefs?.background ?? null)
  const [installedApps, setInstalledApps] = useState<string[]>(initialPrefs?.installedApps ?? [])
  // v25: no cache → default-hidden apps apply (server enforces the same)
  const [hiddenApps, setHiddenApps] = useState<string[]>(
    initialPrefs?.hiddenApps ?? [...DEFAULT_HIDDEN_APP_IDS]
  )
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [personalizeOpen, setPersonalizeOpen] = useState(false)
  const prefsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── drag + wallpaper transient state ─────────────────────────────────────
  const [dragGhost, setDragGhost] = useState<{ appId: AppId; x: number; y: number } | null>(null)
  const [wallpaperBusy, setWallpaperBusy] = useState(false)
  const [wallpaperError, setWallpaperError] = useState<string | null>(null)

  const TASKBAR_HEIGHT = TASKBAR_VISIBLE_HEIGHT + safeAreaBottom

  // ── APP VISIBILITY ───────────────────────────────────────────────────────
  // Two independent gates:
  //   1. ROLE (visibleTo) — does this app exist for this desktop at all?
  //      Admin sees everything; manager sees only apps opted into 'manager'.
  //      This is what keeps one registry driving both desktops in lockstep.
  //   2. INSTALL/HIDE — App Store state, unchanged from before.
  // Role is checked FIRST so a manager can never install/unhide an admin-only
  // app (it isn't in their roleApps set to begin with).
  const roleApps = useMemo(
    () => APPS.filter(a => appVisibleToRole(a, role)),
    [role]
  )
  const isInstalled = useCallback(
    (id: AppId) => isBaseApp(id, role) || installedApps.includes(id),
    [installedApps]
  )
  const visibleApps = useMemo(
    () => roleApps.filter(a => isInstalled(a.id) && !hiddenApps.includes(a.id)),
    [roleApps, isInstalled, hiddenApps]
  )
  const installedAppMetas = useMemo(
    () => roleApps.filter(a => isInstalled(a.id)),
    [roleApps, isInstalled]
  )

  // ── MOBILE DETECTION + VIEWPORT ──────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  // ── SAFE-AREA-BOTTOM PROBE (for window math only) ────────────────────────
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:env(safe-area-inset-bottom);'
    document.body.appendChild(probe)
    const measure = () => {
      const rect = probe.getBoundingClientRect()
      setSafeAreaBottom(Math.round(rect.height))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      probe.remove()
    }
  }, [])

  // ── BODY BACKGROUND / OVERSCROLL GUARD (rubber-band fix) ─────────────────
  // iOS rubber-band bounce briefly reveals whatever sits behind the scrolling
  // content. This component is `position: fixed; inset: 0`, so it never
  // scrolls itself — but nothing here previously constrained the actually
  // scrollable regions beneath it (the mobile icon grid, and whatever
  // AppWindow bodies do), so an overscroll could still propagate up to
  // `body`, which is hardcoded dark in globals.css for the landing page.
  // While Desktop is mounted: pin body/html background to match the desktop
  // bg and disable document-level overscroll, so nothing can bounce past
  // this component's own boundary. Restored on unmount so other routes are
  // untouched.
  useEffect(() => {
    const bodyEl = document.body
    const htmlEl = document.documentElement
    const prevBodyBg = bodyEl.style.background
    const prevBodyOverscroll = bodyEl.style.overscrollBehavior
    const prevHtmlOverscroll = htmlEl.style.overscrollBehavior

    bodyEl.style.overscrollBehavior = 'none'
    htmlEl.style.overscrollBehavior = 'none'

    return () => {
      bodyEl.style.background = prevBodyBg
      bodyEl.style.overscrollBehavior = prevBodyOverscroll
      htmlEl.style.overscrollBehavior = prevHtmlOverscroll
    }
  }, [])

  // Keep body's background mirroring the actual active wallpaper (not a
  // fixed placeholder color) so that IF any sliver of body is ever exposed
  // — e.g. a browser without visualViewport support — it matches what's
  // already on screen instead of showing as a mismatched flat color. Runs
  // whenever the wallpaper changes, independent of the mount/unmount effect
  // above so switching wallpapers updates it live.
  useEffect(() => {
    document.body.style.background = bgCssFor(background)
  }, [background])

  // ── PERSIST WINDOW STATE ─────────────────────────────────────────────────
  useEffect(() => {
    savePersistedState(role, { windows, focusedId, topZ })
  }, [windows, focusedId, topZ, role])

  // ── LOAD PREFS FROM SUPABASE (LS cache already painted) ──────────────────
  // Admin → /api/admin/desktop-prefs. Manager → /api/manager/desktop-prefs
  // (until that route exists the fetch fails soft; the LS cache already
  // painted the desktop, so the manager still gets a working, locally-
  // persisted layout). prefsApiBaseFor() picks the right endpoint by role.
  useEffect(() => {
    let cancelled = false
    fetch(prefsApiBaseFor(role))
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.success && d.prefs) {
          setIconPositions(d.prefs.iconPositions || {})
          setBackground(d.prefs.background ?? null)
          setInstalledApps(Array.isArray(d.prefs.installedApps) ? d.prefs.installedApps : [])
          setHiddenApps(Array.isArray(d.prefs.hiddenApps) ? d.prefs.hiddenApps : [])
        }
        setPrefsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setPrefsLoaded(true)
      })
    return () => { cancelled = true }
  }, [role])

  // ── PERSIST PREFS (LS immediately, Supabase debounced 800ms) ─────────────
  useEffect(() => {
    if (!prefsLoaded) return
    try {
      localStorage.setItem(prefsLsKeyFor(role), JSON.stringify({
        iconPositions, background, installedApps, hiddenApps,
      }))
    } catch {}
    if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current)
    prefsSaveTimer.current = setTimeout(() => {
      fetch(prefsApiBaseFor(role), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iconPositions, background, installedApps, hiddenApps }),
      }).catch(() => {})
    }, 800)
    return () => {
      if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current)
    }
  }, [iconPositions, background, installedApps, hiddenApps, prefsLoaded, role])

  // ── GRID LAYOUT ──────────────────────────────────────────────────────────
  // Pass 1: icons with saved positions snap to their cell (collisions bumped
  // to nearest free). Pass 2 (v25): unsaved icons fill ROW-MAJOR across 4
  // columns (left-to-right, then next row) — the clean v22 arrangement —
  // overflowing into columns 5+ only if the 4-wide block runs out of rows.
  const desktopLayout = useMemo(() => {
    const { cols, rows } = gridDims(viewport.w, viewport.h, TASKBAR_HEIGHT)
    const occupied = new Set<string>()
    const layout: Record<string, { x: number; y: number }> = {}

    for (const app of visibleApps) {
      const saved = iconPositions[app.id]
      if (!saved) continue
      let { c, r } = xyToCell(saved.x, saved.y)
      c = Math.max(0, Math.min(cols - 1, c))
      r = Math.max(0, Math.min(rows - 1, r))
      if (occupied.has(cellKey(c, r))) {
        const nf = nearestFreeCell(c, r, cols, rows, occupied)
        c = nf.c; r = nf.r
      }
      occupied.add(cellKey(c, r))
      layout[app.id] = cellToXY(c, r)
    }

    const fillCols = Math.min(defaultFillColsFor(role), cols)
    const placeDefault = (appId: string): void => {
      // primary block: fillCols-wide row-major (admin: 4-wide; manager: 1-wide
      // = a single left column, top→bottom)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < fillCols; c++) {
          if (occupied.has(cellKey(c, r))) continue
          occupied.add(cellKey(c, r))
          layout[appId] = cellToXY(c, r)
          return
        }
      }
      // overflow: remaining columns, column-major
      for (let c = fillCols; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (occupied.has(cellKey(c, r))) continue
          occupied.add(cellKey(c, r))
          layout[appId] = cellToXY(c, r)
          return
        }
      }
      layout[appId] = cellToXY(0, 0) // grid full fallback
    }

    // Order unsaved icons. Manager: explicit MANAGER_DEFAULT_ORDER first (so the
    // left column reads Dashboard, Analytics, Teams, App Store), then any other
    // visible apps in registry order. Admin: plain registry order.
    const unplaced = visibleApps.filter(app => !layout[app.id])
    const orderedUnplaced =
      role === 'manager'
        ? [
            ...MANAGER_DEFAULT_ORDER
              .map(id => unplaced.find(a => a.id === id))
              .filter((a): a is NonNullable<typeof a> => !!a),
            ...unplaced.filter(a => !MANAGER_DEFAULT_ORDER.includes(a.id)),
          ]
        : unplaced

    for (const app of orderedUnplaced) {
      placeDefault(app.id)
    }

    return layout
  }, [visibleApps, iconPositions, viewport, TASKBAR_HEIGHT, role])

  const layoutRef = useRef(desktopLayout)
  layoutRef.current = desktopLayout

  // During drag: free-floating ghost, pixel-clamped to the desktop area
  const handleIconDrag = useCallback((appId: AppId, x: number, y: number) => {
    const maxX = Math.max(0, viewport.w - ICON_W)
    const maxY = Math.max(0, viewport.h - TASKBAR_HEIGHT - ICON_H)
    setDragGhost({
      appId,
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    })
  }, [viewport, TASKBAR_HEIGHT])

  // On release: snap to nearest free cell, freeze the whole layout so nothing
  // else reflows, preserve saved spots of hidden icons.
  const handleIconDragEnd = useCallback((appId: AppId, dropX: number, dropY: number) => {
    const { cols, rows } = gridDims(viewport.w, viewport.h, TASKBAR_HEIGHT)
    const frozen: Record<string, { x: number; y: number }> = {}
    const occupied = new Set<string>()

    for (const [id, pos] of Object.entries(layoutRef.current)) {
      if (id === appId) continue
      frozen[id] = pos
      const { c, r } = xyToCell(pos.x, pos.y)
      occupied.add(cellKey(c, r))
    }

    let { c, r } = xyToCell(dropX, dropY)
    c = Math.max(0, Math.min(cols - 1, c))
    r = Math.max(0, Math.min(rows - 1, r))
    if (occupied.has(cellKey(c, r))) {
      const nf = nearestFreeCell(c, r, cols, rows, occupied)
      c = nf.c; r = nf.r
    }
    frozen[appId] = cellToXY(c, r)

    // Keep saved positions of icons not currently on the desktop (hidden apps)
    setIconPositions(prev => {
      const next: Record<string, { x: number; y: number }> = { ...frozen }
      for (const [id, pos] of Object.entries(prev)) {
        if (!(id in next) && id !== appId) next[id] = pos
      }
      return next
    })
    setDragGhost(null)
  }, [viewport, TASKBAR_HEIGHT])

  const resetIconLayout = useCallback(() => {
    setIconPositions({})
  }, [])

  // ── APP STORE SERVICES ───────────────────────────────────────────────────
  const installApp = useCallback((id: AppId) => {
    if (isBaseApp(id, role)) return // base apps are always installed
    setInstalledApps(prev => prev.includes(id) ? prev : [...prev, id])
    setHiddenApps(prev => prev.filter(h => h !== id)) // land on the desktop
  }, [])

  const uninstallApp = useCallback((id: AppId) => {
    if (isBaseApp(id, role)) return // base apps (incl. App Store) cannot be uninstalled
    setInstalledApps(prev => prev.filter(a => a !== id))
    setHiddenApps(prev => prev.filter(h => h !== id))
    setIconPositions(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
    // Close any open windows of the uninstalled app
    setWindows(prev => {
      const next = prev.filter(w => w.appId !== id)
      if (next.length !== prev.length) {
        setFocusedId(f => next.some(w => w.id === f) ? f : (next[next.length - 1]?.id ?? null))
      }
      return next
    })
  }, [])

  // Right-click "Uninstall" routes through this: if the app warns on uninstall
  // (data loss, e.g. Notes), open the confirm modal instead of uninstalling
  // immediately; otherwise uninstall straight away. This mirrors the App
  // Store's guard so both entry points show the same warning.
  const requestUninstall = useCallback((id: AppId) => {
    if (isBaseApp(id, role)) return
    if (uninstallWarns(id)) {
      setConfirmUninstallId(id)
    } else {
      uninstallApp(id)
    }
  }, [uninstallApp])

  const removeFromDesktop = useCallback((id: AppId) => {
    setHiddenApps(prev => prev.includes(id) ? prev : [...prev, id])
  }, [])

  const addToDesktop = useCallback((id: AppId) => {
    setHiddenApps(prev => prev.filter(h => h !== id))
  }, [])

  const openApp = useCallback((appId: AppId, hint?: PositionHint) => {
    const app = getApp(appId)
    if (!app) return
    // Role gate: never open an app this role isn't allowed to see, even if a
    // stray id reaches openApp (Start menu, context menu, boot, custom event).
    if (!appVisibleToRole(app, role)) return

    if (app.external) {
      window.open(app.external.url, app.external.target ?? '_blank', 'noopener,noreferrer')
      return
    }

    setWindows(prev => {
      const existing = prev.find(w => w.appId === appId)
      if (existing) {
        const newZ = topZ + 1
        setTopZ(newZ)
        setFocusedId(existing.id)
        return prev.map(w => w.id === existing.id ? { ...w, minimized: false, zIndex: newZ } : w)
      }

      const newZ = topZ + 1
      setTopZ(newZ)
      const id = `${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const defaultSize = app.defaultSize || { width: 900, height: 600 }

      const offset = (prev.length % 6) * 28
      const w = Math.min(defaultSize.width, window.innerWidth - 40)
      const h = Math.min(defaultSize.height, window.innerHeight - TASKBAR_HEIGHT - 40)
      const baseX = Math.max(0, Math.round((window.innerWidth - w) / 2)) + offset - (3 * 28)
      const baseY = Math.max(0, Math.round((window.innerHeight - TASKBAR_HEIGHT - h) / 2)) + offset - (3 * 28)

      const shiftX = hint?.shiftX ?? 0
      const shiftY = hint?.shiftY ?? 0
      const hintedX = Math.max(0, Math.min(baseX + shiftX, window.innerWidth - w))
      const hintedY = Math.max(0, Math.min(baseY + shiftY, window.innerHeight - TASKBAR_HEIGHT - h))

      const mobileNow = window.innerWidth < MOBILE_BREAKPOINT

      const newWindow: WindowState = mobileNow
        ? {
            id, appId,
            x: 0, y: 0,
            width: window.innerWidth,
            height: window.innerHeight - TASKBAR_HEIGHT,
            zIndex: newZ,
            minimized: false, maximized: true,
            preMaximize: { x: hintedX, y: hintedY, width: w, height: h },
            openedAt: Date.now(),
          }
        : {
            id, appId,
            x: hintedX, y: hintedY,
            width: w, height: h,
            zIndex: newZ,
            minimized: false, maximized: false,
            openedAt: Date.now(),
          }
      setFocusedId(id)
      return [...prev, newWindow]
    })
  }, [topZ, TASKBAR_HEIGHT, role])

  // ── OPEN-DESKTOP-APP EVENT LISTENER (v24.1 repair) ───────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.appId && getApp(detail.appId)) {
        openApp(detail.appId as AppId)
      }
    }
    window.addEventListener('open-desktop-app', handler)
    return () => window.removeEventListener('open-desktop-app', handler)
  }, [openApp])

  // ── v25: TASKBAR PILL REORDER ────────────────────────────────────────────
  const reorderWindows = useCallback((dragId: string, targetId: string) => {
    if (dragId === targetId) return
    setWindows(prev => {
      const from = prev.findIndex(w => w.id === dragId)
      const to = prev.findIndex(w => w.id === targetId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const desktopServices: DesktopServices = useMemo(() => ({
    role,
    installedAppIds: installedApps,
    hiddenAppIds: hiddenApps,
    installApp,
    uninstallApp,
    addToDesktop,
    removeFromDesktop,
    openApp,
  }), [role, installedApps, hiddenApps, installApp, uninstallApp, addToDesktop, removeFromDesktop, openApp])

  useEffect(() => {
    if (bootedAnalytics) return
    setBootedAnalytics(true)
    const id = setTimeout(() => openApp('analytics', { shiftX: 200 }), 250)
    return () => clearTimeout(id)
  }, [bootedAnalytics, openApp])

  const closeWindow = useCallback((windowId: string) => {
    setWindows(prev => {
      const closing = prev.find(w => w.id === windowId)
      if (closing) {
        setRecentApps(r => {
          const filtered = r.filter(item => item.appId !== closing.appId)
          return [{ appId: closing.appId, closedAt: Date.now() }, ...filtered].slice(0, 10)
        })
      }
      const next = prev.filter(w => w.id !== windowId)
      if (focusedId === windowId) {
        const topmost = next.reduce<WindowState | null>((acc, w) =>
          (!acc || w.zIndex > acc.zIndex) && !w.minimized ? w : acc, null)
        setFocusedId(topmost?.id ?? null)
      }
      return next
    })
  }, [focusedId])

  const toggleMinimize = useCallback((windowId: string) => {
    setWindows(prev => {
      const target = prev.find(w => w.id === windowId)
      if (!target) return prev
      const willBeMinimized = !target.minimized
      if (willBeMinimized && focusedId === windowId) {
        const topmost = prev
          .filter(w => w.id !== windowId && !w.minimized)
          .reduce<WindowState | null>((acc, w) =>
            (!acc || w.zIndex > acc.zIndex) ? w : acc, null)
        setFocusedId(topmost?.id ?? null)
      }
      return prev.map(w => w.id === windowId ? { ...w, minimized: willBeMinimized } : w)
    })
  }, [focusedId])

  const toggleMaximize = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId) return w
      if (w.maximized) {
        const restore = w.preMaximize
        return {
          ...w, maximized: false,
          x: restore?.x ?? w.x, y: restore?.y ?? w.y,
          width: restore?.width ?? w.width, height: restore?.height ?? w.height,
          preMaximize: undefined,
        }
      } else {
        return {
          ...w, maximized: true,
          preMaximize: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0, y: 0,
          width: window.innerWidth,
          height: window.innerHeight - TASKBAR_HEIGHT,
        }
      }
    }))
  }, [TASKBAR_HEIGHT])

  const focusWindow = useCallback((windowId: string) => {
    if (focusedId === windowId) return
    const newZ = topZ + 1
    setTopZ(newZ)
    setFocusedId(windowId)
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, zIndex: newZ } : w))
  }, [focusedId, topZ])

  const moveWindow = useCallback((windowId: string, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, x, y } : w))
  }, [])

  const resizeWindow = useCallback((windowId: string, width: number, height: number) => {
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, width, height } : w))
  }, [])

  const peekRestoreRef = useRef<string[] | null>(null)
  const showDesktop = useCallback(() => {
    const visibleIds = windows.filter(w => !w.minimized).map(w => w.id)
    if (visibleIds.length > 0) {
      peekRestoreRef.current = visibleIds
      setWindows(prev => prev.map(w => visibleIds.includes(w.id) ? { ...w, minimized: true } : w))
      setFocusedId(null)
      return
    }
    const toRestore = peekRestoreRef.current
    if (toRestore && toRestore.length > 0) {
      setWindows(prev => prev.map(w => toRestore.includes(w.id) ? { ...w, minimized: false } : w))
      peekRestoreRef.current = null
    }
  }, [windows])

  const onTaskbarItemClick = useCallback((windowId: string) => {
    setWindows(prev => {
      const win = prev.find(w => w.id === windowId)
      if (!win) return prev
      if (win.minimized) {
        const newZ = topZ + 1
        setTopZ(newZ)
        setFocusedId(windowId)
        return prev.map(w => w.id === windowId ? { ...w, minimized: false, zIndex: newZ } : w)
      }
      if (focusedId === windowId) {
        const topmost = prev
          .filter(w => w.id !== windowId && !w.minimized)
          .reduce<WindowState | null>((acc, w) =>
            (!acc || w.zIndex > acc.zIndex) ? w : acc, null)
        setFocusedId(topmost?.id ?? null)
        return prev.map(w => w.id === windowId ? { ...w, minimized: true } : w)
      }
      const newZ = topZ + 1
      setTopZ(newZ)
      setFocusedId(windowId)
      return prev.map(w => w.id === windowId ? { ...w, zIndex: newZ } : w)
    })
  }, [focusedId, topZ])

  // ── WALLPAPER DRAG-AND-DROP ──────────────────────────────────────────────
  const onRootDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
  }

  const onRootDrop = async (e: React.DragEvent) => {
    if (!e.dataTransfer?.files?.length) return
    e.preventDefault()
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (!file) return
    setWallpaperBusy(true)
    setWallpaperError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${prefsApiBaseFor(role)}/wallpaper`, { method: 'POST', body: fd })
      const d = await r.json()
      if (d.success && d.url) {
        setBackground({ type: 'image', value: d.url })
      } else {
        setWallpaperError(d.error || 'Upload failed')
      }
    } catch {
      setWallpaperError('Upload failed')
    }
    setWallpaperBusy(false)
  }

  useEffect(() => {
    if (!wallpaperError) return
    const id = setTimeout(() => setWallpaperError(null), 4000)
    return () => clearTimeout(id)
  }, [wallpaperError])

  // ── CONTEXT MENUS ────────────────────────────────────────────────────────
  const onDesktopContextMenu = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    setContextMenu({ type: 'desktop', x: e.clientX, y: e.clientY })
  }

  // ── MOBILE LONG-PRESS → desktop context menu ───────────────────────────
  // Touch devices don't reliably fire onContextMenu from tap-and-hold, so we
  // synthesize it: a 500ms timer started on touchstart fires the desktop
  // menu at the touch point. Canceled if the finger moves >10px (a scroll or
  // drag) or lifts before the timer elapses. Only binds on the empty desktop
  // background — touches that start on an icon are ignored here (icons have
  // their own handling).
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressStart = useRef<{ x: number; y: number } | null>(null)

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressStart.current = null
  }, [])

  const onDesktopTouchStart = (e: React.TouchEvent) => {
    // Only the empty background, and only single-finger presses.
    if (e.target !== e.currentTarget || e.touches.length !== 1) return
    const t = e.touches[0]
    longPressStart.current = { x: t.clientX, y: t.clientY }
    clearLongPress()
    longPressStart.current = { x: t.clientX, y: t.clientY }
    longPressTimer.current = setTimeout(() => {
      const p = longPressStart.current
      if (p) {
        if (startMenuOpen) setStartMenuOpen(false)
        setContextMenu({ type: 'desktop', x: p.x, y: p.y })
        // haptic nudge where supported
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(10) } catch {}
        }
      }
      longPressTimer.current = null
    }, 500)
  }

  const onDesktopTouchMove = (e: React.TouchEvent) => {
    const p = longPressStart.current
    if (!p || e.touches.length === 0) return
    const t = e.touches[0]
    if (Math.hypot(t.clientX - p.x, t.clientY - p.y) > 10) clearLongPress()
  }

  const onDesktopTouchEnd = () => clearLongPress()

  const onIconContextMenu = (e: React.MouseEvent, appId: AppId) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ type: 'icon', x: e.clientX, y: e.clientY, payload: appId })
  }

  const onTaskbarContextMenu = (windowId: string, x: number, y: number) => {
    setContextMenu({ type: 'taskbar-item', x, y, payload: windowId })
  }

  const onTitleBarContextMenu = (windowId: string, x: number, y: number) => {
    setContextMenu({ type: 'titlebar', x, y, payload: windowId })
  }

  const contextMenuItems: ContextMenuItem[] = (() => {
    if (!contextMenu) return []
    if (contextMenu.type === 'desktop') {
      return [
        { label: 'View', icon: '👁', disabled: true },
        { label: 'Reset icon layout', icon: '↕', onClick: resetIconLayout },
        { label: 'Refresh', icon: '↻', onClick: () => window.location.reload() },
        {},
        { label: 'Personalize', icon: '🎨', onClick: () => setPersonalizeOpen(true) },
        { label: 'App Store', icon: '🛍️', onClick: () => openApp('appstore') },
        {},
        { label: 'Show desktop', icon: '▭', onClick: showDesktop },
        {},
        { label: 'Back to Dashboard', icon: '←', onClick: () => router.push('/dashboard/analytics') },
      ]
    }
    if (contextMenu.type === 'icon') {
      const appId = contextMenu.payload as AppId
      const alreadyOpen = windows.find(w => w.appId === appId)
      const base = isBaseApp(appId, role)
      return [
        { label: 'Open', icon: '▶', onClick: () => openApp(appId) },
        {},
        { label: 'Remove from desktop', onClick: () => removeFromDesktop(appId) },
        ...(!base ? [{ label: 'Uninstall', icon: '✕', danger: true, onClick: () => requestUninstall(appId) }] : []),
        {},
        { label: alreadyOpen ? 'Running' : (base ? 'Base app' : 'Store app'), disabled: true },
      ]
    }
    if (contextMenu.type === 'taskbar-item' || contextMenu.type === 'titlebar') {
      const windowId = contextMenu.payload as string
      const win = windows.find(w => w.id === windowId)
      if (!win) return []
      return [
        { label: win.minimized ? 'Restore' : 'Minimize', onClick: () => toggleMinimize(windowId) },
        { label: win.maximized ? 'Restore down' : 'Maximize', onClick: () => toggleMaximize(windowId) },
        {},
        { label: 'Close', icon: '✕', danger: true, onClick: () => closeWindow(windowId) },
      ]
    }
    return []
  })()

  return (
    <DesktopServicesContext.Provider value={desktopServices}>
      <div
        onDragOver={onRootDragOver}
        onDrop={onRootDrop}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100dvh',
          background: bgCssFor(background),
          overflow: 'hidden',
          fontFamily: '"Segoe UI", Tahoma, sans-serif',
          userSelect: 'none',
        }}
      >
        <div
          onContextMenu={onDesktopContextMenu}
          onTouchStart={onDesktopTouchStart}
          onTouchMove={onDesktopTouchMove}
          onTouchEnd={onDesktopTouchEnd}
          onTouchCancel={onDesktopTouchEnd}
          onClick={() => {
            if (startMenuOpen) setStartMenuOpen(false)
            if (contextMenu) setContextMenu(null)
          }}
          style={{
            position: 'absolute',
            inset: 0,
            bottom: TASKBAR_HEIGHT,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isMobile ? (
            <div
              onTouchStart={onDesktopTouchStart}
              onTouchMove={onDesktopTouchMove}
              onTouchEnd={onDesktopTouchEnd}
              onTouchCancel={onDesktopTouchEnd}
              onContextMenu={onDesktopContextMenu}
              style={{
                padding: 12,
                paddingTop: `calc(12px + env(safe-area-inset-top, 0px))`,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 8,
                alignContent: 'start',
                maxWidth: '100%',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            >
              {visibleApps.map(app => {
                const isOpen = !!windows.find(w => w.appId === app.id)
                return (
                  <DesktopIcon
                    key={app.id}
                    name={app.name}
                    icon={app.icon}
                    iconSrc={app.iconSrc}
                    iconBg={app.iconBg}
                    isOpen={isOpen}
                    onDoubleClick={() => openApp(app.id)}
                    onContextMenu={(e) => onIconContextMenu(e, app.id)}
                    isMobile={true}
                  />
                )
              })}
            </div>
          ) : (
            visibleApps.map(app => {
              const isOpen = !!windows.find(w => w.appId === app.id)
              const ghost = dragGhost?.appId === app.id ? dragGhost : null
              const pos = ghost ?? desktopLayout[app.id] ?? { x: GRID_X, y: GRID_Y }
              return (
                <DesktopIcon
                  key={app.id}
                  name={app.name}
                  icon={app.icon}
                  iconSrc={app.iconSrc}
                  iconBg={app.iconBg}
                  isOpen={isOpen}
                  x={pos.x}
                  y={pos.y}
                  isGhosting={!!ghost}
                  onDrag={(x, y) => handleIconDrag(app.id, x, y)}
                  onDragEnd={(x, y) => handleIconDragEnd(app.id, x, y)}
                  onDoubleClick={() => openApp(app.id)}
                  onContextMenu={(e) => onIconContextMenu(e, app.id)}
                  isMobile={false}
                />
              )
            })
          )}
        </div>

        {windows.map(win => {
          const app = getApp(win.appId)
          if (!app) return null
          return (
            <AppWindow
              key={win.id}
              state={win}
              appName={app.name}
              appIcon={app.icon}
              iconBg={app.iconBg}
              Component={app.Component}
              isFocused={focusedId === win.id}
              isMobile={isMobile}
              onFocus={() => focusWindow(win.id)}
              onClose={() => closeWindow(win.id)}
              onMinimize={() => toggleMinimize(win.id)}
              onToggleMaximize={() => toggleMaximize(win.id)}
              onMove={(x, y) => moveWindow(win.id, x, y)}
              onResize={(w, h) => resizeWindow(win.id, w, h)}
              onTitleBarContextMenu={(x, y) => onTitleBarContextMenu(win.id, x, y)}
            />
          )
        })}

        <Taskbar
          windows={windows}
          focusedWindowId={focusedId}
          recentApps={recentApps.map(r => getApp(r.appId)).filter((a): a is NonNullable<typeof a> => !!a)}
          onStartClick={() => setStartMenuOpen(o => !o)}
          startMenuOpen={startMenuOpen}
          onTaskbarItemClick={onTaskbarItemClick}
          onTaskbarItemContextMenu={onTaskbarContextMenu}
          onShowDesktop={showDesktop}
          isMobile={isMobile}
          onReorderWindows={reorderWindows}
        />

        {startMenuOpen && (
          <StartMenu
            onClose={() => setStartMenuOpen(false)}
            onLaunchApp={openApp}
            recent={recentApps}
            installedApps={installedAppMetas}
            onOpenPersonalize={() => setPersonalizeOpen(true)}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={contextMenuItems}
            onClose={() => setContextMenu(null)}
          />
        )}

        {confirmUninstallId && (() => {
          const app = getApp(confirmUninstallId)
          const appName = app?.name ?? 'this app'
          return (
            <div
              onClick={() => setConfirmUninstallId(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 100000,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20,
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', maxWidth: 440,
                  background: '#1a1a2e', border: '1px solid #8a1a1a',
                  borderTop: '3px solid #8a1a1a', borderRadius: 4,
                  padding: 24, color: '#e0e2ea', boxSizing: 'border-box',
                  fontFamily: 'Futura PT, Futura, sans-serif',
                }}
              >
                <div style={{ fontSize: 11, letterSpacing: 4, color: '#8a1a1a', fontWeight: 'bold', marginBottom: 14 }}>
                  ⚠ UNINSTALL {appName.toUpperCase()}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#c0c2ca', marginBottom: 10 }}>
                  Uninstalling <strong style={{ color: 'white' }}>{appName}</strong> removes it from your desktop.
                </div>
                <div style={{
                  background: 'rgba(138,26,26,0.2)', border: '1px solid #8a1a1a',
                  borderLeft: '3px solid #8a1a1a', borderRadius: 3,
                  padding: '10px 12px', marginBottom: 20,
                  fontSize: 12, lineHeight: 1.6, color: '#ffaaaa', fontWeight: 'bold',
                }}>
                  WARNING: all data will be deleted. This cannot be undone.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setConfirmUninstallId(null)}
                    style={{
                      padding: '10px 18px', background: 'transparent', color: '#a0a2aa',
                      border: '1px solid #4a4a5e', borderRadius: 3,
                      fontSize: 10, letterSpacing: 3, fontWeight: 'bold', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >CANCEL</button>
                  <button
                    onClick={() => { uninstallApp(confirmUninstallId); setConfirmUninstallId(null) }}
                    style={{
                      padding: '10px 18px', background: '#8a1a1a', color: 'white',
                      border: 'none', borderRadius: 3,
                      fontSize: 10, letterSpacing: 3, fontWeight: 'bold', cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >■ DELETE & UNINSTALL</button>
                </div>
              </div>
            </div>
          )
        })()}

        {personalizeOpen && (
          <PersonalizePopup
            background={background}
            onSetBackground={setBackground}
            onClose={() => setPersonalizeOpen(false)}
          />
        )}

        {(wallpaperBusy || wallpaperError) && (
          <div style={{
            position: 'fixed',
            bottom: `calc(${TASKBAR_VISIBLE_HEIGHT + 16}px + env(safe-area-inset-bottom, 0px))`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999995,
            padding: '8px 16px',
            borderRadius: 20,
            background: wallpaperError ? 'rgba(106,26,26,0.95)' : 'rgba(20,22,36,0.95)',
            border: '1px solid rgba(126,192,255,0.35)',
            color: 'white',
            fontSize: 9, letterSpacing: 2, fontWeight: 'bold',
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            {wallpaperError ? wallpaperError.toUpperCase() : 'SETTING WALLPAPER...'}
          </div>
        )}
      </div>
    </DesktopServicesContext.Provider>
  )
}

// =============================================================================
// PERSONALIZE POPUP — background picker dialog
// =============================================================================
function PersonalizePopup({
  background, onSetBackground, onClose,
}: {
  background: BgSetting | null
  onSetBackground: (bg: BgSetting | null) => void
  onClose: () => void
}) {
  const [imageUrl, setImageUrl] = useState(background?.type === 'image' ? background.value : '')

  const solidValue = background?.type === 'solid' ? background.value : '#1a3a6a'
  const activePresetId = background === null
    ? 'aero'
    : (background.type === 'preset' ? background.value : null)

  const applyImage = () => {
    const v = imageUrl.trim()
    if (!/^https?:\/\//i.test(v)) return
    onSetBackground({ type: 'image', value: v })
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: 3, fontWeight: 'bold',
    color: '#8888aa', marginBottom: 8,
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999998,
          background: 'rgba(0,0,0,0.35)',
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 999999,
        width: 'min(460px, calc(100vw - 24px))',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, rgba(30,34,52,0.98), rgba(20,22,36,0.98))',
        border: '1px solid rgba(126,192,255,0.35)',
        borderRadius: 8,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        color: 'white',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(126,192,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: '#7ec0ff' }}>
            PERSONALIZE
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: '#8888aa',
              fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}
          >✕</button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={labelStyle}>WALLPAPERS</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {BG_PRESETS.map(p => {
                const active = activePresetId === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => onSetBackground(
                      p.id === 'aero' ? null : { type: 'preset', value: p.id }
                    )}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{
                      height: 58,
                      borderRadius: 4,
                      background: p.css,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: active
                        ? '2px solid #7ec0ff'
                        : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: active ? '0 0 10px rgba(126,192,255,0.5)' : 'none',
                    }} />
                    <div style={{
                      fontSize: 8, letterSpacing: 2, fontWeight: 'bold',
                      color: active ? '#7ec0ff' : '#8888aa',
                      textAlign: 'center', marginTop: 4,
                    }}>{p.name}</div>
                  </div>
                )
              })}
            </div>
            <div style={{
              fontSize: 9, letterSpacing: 1, color: '#8888aa',
              marginTop: 10, lineHeight: 1.5,
            }}>
              TIP — drag and drop any image onto the desktop to set it as your wallpaper.
            </div>
          </div>

          <div>
            <div style={labelStyle}>SOLID COLOR</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={solidValue}
                onChange={e => onSetBackground({ type: 'solid', value: e.target.value })}
                style={{
                  width: 52, height: 32, padding: 0,
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4, background: 'transparent', cursor: 'pointer',
                }}
              />
              <span style={{
                fontSize: 11, fontFamily: 'monospace',
                color: background?.type === 'solid' ? '#7ec0ff' : '#8888aa',
              }}>
                {background?.type === 'solid' ? background.value.toUpperCase() : 'PICK A COLOR'}
              </span>
            </div>
          </div>

          <div>
            <div style={labelStyle}>IMAGE URL</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyImage() }}
                placeholder="https://..."
                style={{
                  flex: 1, padding: '7px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4, color: 'white',
                  fontSize: 11, fontFamily: 'monospace', outline: 'none',
                }}
              />
              <button
                onClick={applyImage}
                disabled={!/^https?:\/\//i.test(imageUrl.trim())}
                style={{
                  padding: '7px 14px',
                  background: /^https?:\/\//i.test(imageUrl.trim()) ? '#2a4a8a' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(126,192,255,0.3)',
                  borderRadius: 4, color: 'white',
                  fontSize: 9, letterSpacing: 2, fontWeight: 'bold',
                  cursor: /^https?:\/\//i.test(imageUrl.trim()) ? 'pointer' : 'default',
                  fontFamily: '"Segoe UI", Tahoma, sans-serif',
                }}
              >APPLY</button>
            </div>
            {background?.type === 'image' && (
              <div style={{ fontSize: 9, letterSpacing: 1, color: '#7ec0ff', marginTop: 6, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                ACTIVE: {background.value}
              </div>
            )}
          </div>
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(126,192,255,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={() => { onSetBackground(null); setImageUrl('') }}
            style={{
              padding: '7px 14px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4, color: '#cfd6e4',
              fontSize: 9, letterSpacing: 2, fontWeight: 'bold', cursor: 'pointer',
              fontFamily: '"Segoe UI", Tahoma, sans-serif',
            }}
          >RESTORE DEFAULT</button>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              background: '#2a4a8a',
              border: '1px solid rgba(126,192,255,0.4)',
              borderRadius: 4, color: 'white',
              fontSize: 9, letterSpacing: 2, fontWeight: 'bold', cursor: 'pointer',
              fontFamily: '"Segoe UI", Tahoma, sans-serif',
            }}
          >CLOSE</button>
        </div>
      </div>
    </>
  )
}

// =============================================================================
// DESKTOP ICON
// =============================================================================
// v25 restyle (de-cheese pass): smaller squircle tile, no glossy inset
// highlight, softer shadow, subtle desaturation, smaller glyph. Renders
// iconSrc image when the registry provides one. Drag behavior unchanged from
// v24: onDrag drives the ghost, onDragEnd snaps to the nearest free cell, 5px
// threshold separates drags from clicks. Mobile: grid layout, tap to open.
function DesktopIcon({
  name, icon, iconSrc, iconBg, isOpen, onDoubleClick, onContextMenu, isMobile,
  x, y, isGhosting, onDrag, onDragEnd,
}: {
  name: string
  icon: string
  iconSrc?: string
  iconBg: string
  isOpen: boolean
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  isMobile: boolean
  x?: number
  y?: number
  isGhosting?: boolean
  onDrag?: (x: number, y: number) => void
  onDragEnd?: (x: number, y: number) => void
}) {
  const [selected, setSelected] = useState(false)
  const [dragging, setDragging] = useState(false)
  const lastTapRef = useRef<number>(0)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origX: number
    origY: number
    lastX: number
    lastY: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (isMobile) {
      const now = Date.now()
      if (now - lastTapRef.current < 400) {
        onDoubleClick()
        return
      }
      lastTapRef.current = now
      onDoubleClick()
      return
    }
    setSelected(true)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (isMobile || !onDrag || e.button !== 0) return
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: x ?? 0,
      origY: y ?? 0,
      lastX: x ?? 0,
      lastY: y ?? 0,
      moved: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId || !onDrag) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 5) return
      d.moved = true
      setDragging(true)
    }
    d.lastX = d.origX + dx
    d.lastY = d.origY + dy
    onDrag(d.lastX, d.lastY)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    if (d.moved) {
      suppressClickRef.current = true
      if (onDragEnd) onDragEnd(d.lastX, d.lastY)
    }
    dragRef.current = null
    setDragging(false)
  }

  useEffect(() => {
    if (!selected) return
    const onAway = () => setSelected(false)
    document.addEventListener('mousedown', onAway)
    return () => document.removeEventListener('mousedown', onAway)
  }, [selected])

  const positioned = !isMobile && x !== undefined && y !== undefined
  const tile = isMobile ? 46 : 52

  return (
    <div
      onClick={handleClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...(positioned ? {
          position: 'absolute' as const,
          left: x,
          top: y,
          width: ICON_W,
          touchAction: 'none' as const,
          zIndex: dragging ? 50 : 1,
          transition: (dragging || isGhosting) ? 'none' : 'left 0.12s ease, top 0.12s ease',
        } : {}),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        padding: 6,
        borderRadius: 4,
        cursor: dragging ? 'grabbing' : 'pointer',
        background: (selected || dragging) ? 'rgba(74,158,255,0.25)' : 'transparent',
        border: '1px solid ' + ((selected || dragging) ? 'rgba(126,192,255,0.6)' : 'transparent'),
        opacity: dragging ? 0.85 : 1,
      }}
    >
      <div style={{
        width: tile,
        height: tile,
        borderRadius: 12,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isMobile ? 22 : 25,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.18)',
        filter: 'saturate(0.88)',
        position: 'relative',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" width={Math.round(tile * 0.6)} height={Math.round(tile * 0.6)}
            style={{ objectFit: 'contain' }} draggable={false} />
        ) : icon}
        {isOpen && (
          <div style={{
            position: 'absolute',
            bottom: 3, left: '50%',
            transform: 'translateX(-50%)',
            width: 5, height: 5,
            background: '#7ec0ff',
            borderRadius: '50%',
            boxShadow: '0 0 5px rgba(126,192,255,0.9)',
          }} />
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: 'white',
        textAlign: 'center',
        textShadow: '0 1px 3px rgba(0,0,0,0.85)',
        fontWeight: 500,
        maxWidth: 84,
        wordBreak: 'break-word',
        lineHeight: 1.25,
        pointerEvents: 'none',
      }}>{name}</div>
    </div>
  )
}