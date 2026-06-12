'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { APPS, getApp } from './registry'
import AppWindow from './AppWindow'
import Taskbar from './Taskbar'
import StartMenu from './StartMenu'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import type { AppId, WindowState, RecentApp } from './types'

// =============================================================================
// DESKTOP — root shell component
// =============================================================================
// v23 changes vs v22:
// - DRAGGABLE ICONS (desktop only): icons are now absolutely positioned and
//   free-drag via pointer events with a 5px threshold so click/double-click
//   behavior is untouched. Positions persist per-admin to Supabase
//   (admin_desktop_prefs, migration 012) through /api/admin/desktop-prefs,
//   debounced 800ms, with a localStorage cache for instant paint before the
//   server round-trip. Mobile keeps the v22 tap-to-open grid — no dragging.
// - CHANGEABLE BACKGROUND: right-click desktop → Personalize opens a dialog
//   with 6 gradient presets, a solid color picker, an image URL field, and a
//   RESTORE DEFAULT button (null = the original Vista-blue gradient).
//   Persisted alongside icon positions.
// - Right-click desktop menu: Personalize is now live (was disabled), and a
//   new "Reset icon layout" item clears saved positions back to the grid.
// - All v22 behavior preserved: window persistence in localStorage, analytics
//   boot window, safe-area handling, show desktop peek, context menus.
// =============================================================================

const MOBILE_BREAKPOINT = 768
const TASKBAR_VISIBLE_HEIGHT = 48
const LS_KEY = 'ds:admin-desktop:v1'
const PREFS_LS_KEY = 'ds:admin-desktop:prefs:v1'

// ── ICON LAYOUT ──────────────────────────────────────────────────────────────
const ICON_W = 96          // icon hitbox width (desktop)
const ICON_H = 92          // icon hitbox height (desktop)
const ICON_CELL_W = 110    // default grid cell width
const ICON_CELL_H = 106    // default grid cell height
const ICON_PAD = 20        // default grid origin padding
const ICONS_PER_ROW = 4    // default grid columns (mirrors v22 maxWidth 540 look)

function defaultIconPos(index: number): { x: number; y: number } {
  return {
    x: ICON_PAD + (index % ICONS_PER_ROW) * ICON_CELL_W,
    y: ICON_PAD + Math.floor(index / ICONS_PER_ROW) * ICON_CELL_H,
  }
}

// ── BACKGROUNDS ──────────────────────────────────────────────────────────────
type BgSetting = { type: 'preset' | 'solid' | 'image'; value: string }

const DEFAULT_BG_CSS = `
  radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
  radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 60%),
  linear-gradient(180deg, #1a3a6a 0%, #4a7ab0 50%, #82a6cf 100%)
`

const BG_PRESETS: { id: string; name: string; css: string }[] = [
  { id: 'vista-blue', name: 'VISTA BLUE', css: DEFAULT_BG_CSS },
  {
    id: 'midnight', name: 'MIDNIGHT', css: `
      radial-gradient(ellipse at 30% 20%, rgba(126,192,255,0.10) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.05) 0%, transparent 60%),
      linear-gradient(180deg, #0d0d16 0%, #1a1a2e 55%, #2a2a44 100%)
    `,
  },
  {
    id: 'emerald', name: 'EMERALD', css: `
      radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.06) 0%, transparent 60%),
      linear-gradient(180deg, #0e2e1a 0%, #1a6a3a 55%, #7ec9a0 100%)
    `,
  },
  {
    id: 'royal', name: 'ROYAL', css: `
      radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.13) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.07) 0%, transparent 60%),
      linear-gradient(180deg, #1e1038 0%, #4a2a8a 55%, #9a82cf 100%)
    `,
  },
  {
    id: 'sunset', name: 'SUNSET', css: `
      radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.14) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 80%, rgba(255,200,120,0.10) 0%, transparent 60%),
      linear-gradient(180deg, #2a1a3e 0%, #8a3a4a 55%, #e8a05a 100%)
    `,
  },
  {
    id: 'graphite', name: 'GRAPHITE', css: `
      radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.10) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.05) 0%, transparent 60%),
      linear-gradient(180deg, #18181c 0%, #3a3a42 55%, #6a6a74 100%)
    `,
  },
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

function loadPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!Array.isArray(parsed.windows)) return null
    return parsed
  } catch {
    return null
  }
}

function savePersistedState(state: PersistedState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {}
}

interface CachedPrefs {
  iconPositions: Record<string, { x: number; y: number }>
  background: BgSetting | null
}

function loadCachedPrefs(): CachedPrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREFS_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPrefs
    return {
      iconPositions: parsed.iconPositions && typeof parsed.iconPositions === 'object'
        ? parsed.iconPositions : {},
      background: parsed.background ?? null,
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

export default function Desktop() {
  const router = useRouter()

  const initial = (typeof window !== 'undefined') ? loadPersistedState() : null
  const initialPrefs = (typeof window !== 'undefined') ? loadCachedPrefs() : null

  const [windows, setWindows] = useState<WindowState[]>(initial?.windows ?? [])
  const [focusedId, setFocusedId] = useState<string | null>(initial?.focusedId ?? null)
  const [topZ, setTopZ] = useState(initial?.topZ ?? 100)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<RightClickState | null>(null)
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [bootedAnalytics, setBootedAnalytics] = useState((initial?.windows.length ?? 0) > 0)
  const [safeAreaBottom, setSafeAreaBottom] = useState(0)

  // ── v23: prefs state (icon positions + background) ───────────────────────
  const [iconPositions, setIconPositions] = useState<Record<string, { x: number; y: number }>>(
    initialPrefs?.iconPositions ?? {}
  )
  const [background, setBackground] = useState<BgSetting | null>(initialPrefs?.background ?? null)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [personalizeOpen, setPersonalizeOpen] = useState(false)
  const prefsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const TASKBAR_HEIGHT = TASKBAR_VISIBLE_HEIGHT + safeAreaBottom

  // ── MOBILE DETECTION ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
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

  // ── PERSIST WINDOW STATE ─────────────────────────────────────────────────
  useEffect(() => {
    savePersistedState({ windows, focusedId, topZ })
  }, [windows, focusedId, topZ])

  // ── v23: LOAD PREFS FROM SUPABASE (LS cache already painted) ─────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/desktop-prefs')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.success && d.prefs) {
          setIconPositions(d.prefs.iconPositions || {})
          setBackground(d.prefs.background ?? null)
        }
        setPrefsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setPrefsLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  // ── v23: PERSIST PREFS (LS immediately, Supabase debounced 800ms) ────────
  useEffect(() => {
    if (!prefsLoaded) return
    try {
      localStorage.setItem(PREFS_LS_KEY, JSON.stringify({ iconPositions, background }))
    } catch {}
    if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current)
    prefsSaveTimer.current = setTimeout(() => {
      fetch('/api/admin/desktop-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iconPositions, background }),
      }).catch(() => {})
    }, 800)
    return () => {
      if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current)
    }
  }, [iconPositions, background, prefsLoaded])

  const handleIconDrag = useCallback((appId: AppId, x: number, y: number) => {
    const maxX = Math.max(0, window.innerWidth - ICON_W)
    const maxY = Math.max(0, window.innerHeight - TASKBAR_HEIGHT - ICON_H)
    setIconPositions(prev => ({
      ...prev,
      [appId]: {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
      },
    }))
  }, [TASKBAR_HEIGHT])

  const resetIconLayout = useCallback(() => {
    setIconPositions({})
  }, [])

  const openApp = useCallback((appId: AppId, hint?: PositionHint) => {
    const app = getApp(appId)
    if (!app) return

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
  }, [topZ, TASKBAR_HEIGHT])

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

  const onDesktopContextMenu = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    setContextMenu({ type: 'desktop', x: e.clientX, y: e.clientY })
  }

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
        { label: 'Screen resolution', disabled: true },
        {},
        { label: 'Show desktop', icon: '▭', onClick: showDesktop },
        {},
        { label: 'Back to Dashboard', icon: '←', onClick: () => router.push('/dashboard/analytics') },
      ]
    }
    if (contextMenu.type === 'icon') {
      const appId = contextMenu.payload as AppId
      const alreadyOpen = windows.find(w => w.appId === appId)
      return [
        { label: 'Open', icon: '▶', onClick: () => openApp(appId) },
        { label: 'Open in new window', disabled: true },
        {},
        { label: alreadyOpen ? 'Already running' : 'Properties', disabled: true },
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: bgCssFor(background),
        overflow: 'hidden',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        userSelect: 'none',
      }}
    >
      <div
        onContextMenu={onDesktopContextMenu}
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
          <div style={{
            padding: 12,
            paddingTop: `calc(12px + env(safe-area-inset-top, 0px))`,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 8,
            alignContent: 'start',
            maxWidth: '100%',
          }}>
            {APPS.map(app => {
              const isOpen = !!windows.find(w => w.appId === app.id)
              return (
                <DesktopIcon
                  key={app.id}
                  name={app.name}
                  icon={app.icon}
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
          APPS.map((app, index) => {
            const isOpen = !!windows.find(w => w.appId === app.id)
            const pos = iconPositions[app.id] ?? defaultIconPos(index)
            return (
              <DesktopIcon
                key={app.id}
                name={app.name}
                icon={app.icon}
                iconBg={app.iconBg}
                isOpen={isOpen}
                x={pos.x}
                y={pos.y}
                onDrag={(x, y) => handleIconDrag(app.id, x, y)}
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
      />

      {startMenuOpen && (
        <StartMenu
          onClose={() => setStartMenuOpen(false)}
          onLaunchApp={openApp}
          recent={recentApps}
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

      {personalizeOpen && (
        <PersonalizePopup
          background={background}
          onSetBackground={setBackground}
          onClose={() => setPersonalizeOpen(false)}
        />
      )}
    </div>
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
    ? 'vista-blue'
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
        width: 'min(440px, calc(100vw - 24px))',
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
            <div style={labelStyle}>BACKGROUND PRESETS</div>
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
                      p.id === 'vista-blue' ? null : { type: 'preset', value: p.id }
                    )}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{
                      height: 52,
                      borderRadius: 4,
                      background: p.css,
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
// v23: on desktop, icons are absolutely positioned and draggable via pointer
// events. A 5px movement threshold separates drags from clicks; a drag
// suppresses the click that fires on pointer release so icons don't get
// selected (or double-open) after being moved. Mobile keeps v22 behavior:
// grid layout, tap to open, no dragging.
function DesktopIcon({
  name, icon, iconBg, isOpen, onDoubleClick, onContextMenu, isMobile, x, y, onDrag,
}: {
  name: string
  icon: string
  iconBg: string
  isOpen: boolean
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  isMobile: boolean
  x?: number
  y?: number
  onDrag?: (x: number, y: number) => void
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
    onDrag(d.origX + dx, d.origY + dy)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    if (d.moved) suppressClickRef.current = true
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
          width: 96,
          touchAction: 'none' as const,
          zIndex: dragging ? 50 : 1,
        } : {}),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        borderRadius: 4,
        cursor: dragging ? 'grabbing' : 'pointer',
        background: (selected || dragging) ? 'rgba(74,158,255,0.25)' : 'transparent',
        border: '1px solid ' + ((selected || dragging) ? 'rgba(126,192,255,0.6)' : 'transparent'),
        opacity: dragging ? 0.85 : 1,
      }}
    >
      <div style={{
        width: isMobile ? 48 : 56,
        height: isMobile ? 48 : 56,
        borderRadius: 8,
        background: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isMobile ? 26 : 30,
        boxShadow: '0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)',
        border: '1px solid rgba(0,0,0,0.2)',
        position: 'relative',
        pointerEvents: 'none',
      }}>
        {icon}
        {isOpen && (
          <div style={{
            position: 'absolute',
            bottom: -4, left: '50%',
            transform: 'translateX(-50%)',
            width: 6, height: 6,
            background: '#7ec0ff',
            borderRadius: '50%',
            boxShadow: '0 0 6px rgba(126,192,255,0.9)',
          }} />
        )}
      </div>
      <div style={{
        fontSize: 11,
        color: 'white',
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        fontWeight: 500,
        maxWidth: 84,
        wordBreak: 'break-word',
        lineHeight: 1.25,
        pointerEvents: 'none',
      }}>{name}</div>
    </div>
  )
}