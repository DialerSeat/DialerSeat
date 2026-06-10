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
// v22 FIX — iPhone home indicator bottom gap:
//   Taskbar is `position: fixed; bottom: 0; height: calc(48px + env(safe-area-inset-bottom))`.
//   The desktop root div now also carries `paddingBottom: env(safe-area-inset-bottom)`
//   so the gradient background fills the safe zone and the black body never
//   shows through behind the taskbar's safe-area fill strip.
//
//   TASKBAR_HEIGHT (used for window math) stays as 48 + safeAreaBottom via
//   the JS probe — window geometry needs px values, not CSS strings. The
//   visual fix (no black strip) is handled purely in CSS on the root div.
// =============================================================================

const MOBILE_BREAKPOINT = 768
const TASKBAR_VISIBLE_HEIGHT = 48
const LS_KEY = 'ds:admin-desktop:v1'

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
  const [windows, setWindows] = useState<WindowState[]>(initial?.windows ?? [])
  const [focusedId, setFocusedId] = useState<string | null>(initial?.focusedId ?? null)
  const [topZ, setTopZ] = useState(initial?.topZ ?? 100)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<RightClickState | null>(null)
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [bootedAnalytics, setBootedAnalytics] = useState((initial?.windows.length ?? 0) > 0)
  const [safeAreaBottom, setSafeAreaBottom] = useState(0)

  const TASKBAR_HEIGHT = TASKBAR_VISIBLE_HEIGHT + safeAreaBottom

  // ── KILL BODY BACKGROUND ─────────────────────────────────────────────────
  // globals.css sets body { background-color: #0a0a0f } which bleeds through
  // as a black strip behind the taskbar's safe-area zone on iOS. The Desktop
  // component owns the entire viewport so we override it to transparent on
  // mount and restore on unmount.
  useEffect(() => {
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = 'transparent'
    return () => { document.body.style.backgroundColor = prev }
  }, [])

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
        { label: 'Sort by', icon: '↕', disabled: true },
        { label: 'Refresh', icon: '↻', onClick: () => window.location.reload() },
        {},
        { label: 'Personalize', icon: '🎨', disabled: true },
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
        // KEY FIX: paddingBottom fills the safe-area zone with the gradient
        // so the body/page black never shows behind the taskbar's safe-area
        // fill strip on iPhone.
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.08) 0%, transparent 60%),
          linear-gradient(180deg, #1a3a6a 0%, #4a7ab0 50%, #82a6cf 100%)
        `,
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
        <div style={{
          padding: isMobile ? 12 : 20,
          paddingTop: isMobile
            ? `calc(12px + env(safe-area-inset-top, 0px))`
            : `calc(20px + env(safe-area-inset-top, 0px))`,
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'repeat(auto-fill, minmax(80px, 1fr))'
            : 'repeat(auto-fill, 96px)',
          gap: isMobile ? 8 : 14,
          alignContent: 'start',
          maxWidth: isMobile ? '100%' : 540,
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
                isMobile={isMobile}
              />
            )
          })}
        </div>
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
    </div>
  )
}

function DesktopIcon({
  name, icon, iconBg, isOpen, onDoubleClick, onContextMenu, isMobile,
}: {
  name: string
  icon: string
  iconBg: string
  isOpen: boolean
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  isMobile: boolean
}) {
  const [selected, setSelected] = useState(false)
  const lastTapRef = useRef<number>(0)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
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

  useEffect(() => {
    if (!selected) return
    const onAway = () => setSelected(false)
    document.addEventListener('mousedown', onAway)
    return () => document.removeEventListener('mousedown', onAway)
  }, [selected])

  return (
    <div
      onClick={handleClick}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        borderRadius: 4,
        cursor: 'pointer',
        background: selected ? 'rgba(74,158,255,0.25)' : 'transparent',
        border: '1px solid ' + (selected ? 'rgba(126,192,255,0.6)' : 'transparent'),
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
      }}>{name}</div>
    </div>
  )
}