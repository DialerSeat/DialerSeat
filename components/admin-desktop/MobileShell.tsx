'use client'
import { useCallback, useMemo, useState } from 'react'
import { APPS, getApp } from './registry'
import { appVisibleToRole, type AppId, type AppRole } from './types'
import { DesktopServicesContext, type DesktopServices } from './desktopServices'

// =============================================================================
// MOBILE SHELL — the admin/manager desktop, for phones
// =============================================================================
// The desktop metaphor in Desktop.tsx is draggable absolutely-positioned
// windows on a z-index stack. That is not a thing that can be made responsive:
// there is no arrangement of overlapping resizable windows that works on a
// 390px screen, and shrinking them produces something worse than useless.
//
// So this is not a responsive Desktop — it's a second shell around the SAME
// apps. The registry already separates "what an app is" (id, name, icon,
// Component) from "how it's framed", so every app renders here unchanged, one
// at a time, full screen. Nothing in apps/ needed to change.
//
// It exists because the product standard is that mobile support equals
// desktop, and an admin who can't check the number pool or a user tracker
// from their phone doesn't have that.
//
// WHAT IS DELIBERATELY MISSING vs the desktop shell: window management,
// wallpapers, icon drag-arrange, the taskbar, install/uninstall. None of it
// means anything without windows. Role-based app visibility is preserved
// exactly, because that one is a permission boundary rather than chrome.
// =============================================================================

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

const M = {
  bg: '#0e1220',
  surface: '#171c2e',
  surfaceLift: '#1f263c',
  border: '#2b3350',
  text: '#eef1f8',
  muted: '#8b93ad',
  accent: '#4a9eff',
}

export default function MobileShell({ role = 'admin' }: { role?: AppRole }) {
  const [openId, setOpenId] = useState<AppId | null>(null)
  const [recent, setRecent] = useState<AppId[]>([])

  const apps = useMemo(
    () => APPS.filter(a => appVisibleToRole(a, role)),
    [role]
  )

  const openApp = useCallback((id: AppId) => {
    const app = getApp(id)
    if (!app) return
    // Same role gate the desktop shell applies in its openApp. Without it,
    // an app that links to another app could hand a manager an admin-only
    // surface — the mobile shell must not be the weaker door.
    if (!appVisibleToRole(app, role)) return

    if (app.external) {
      window.open(app.external.url, app.external.target || '_blank')
      return
    }
    setOpenId(id)
    setRecent(prev => [id, ...prev.filter(r => r !== id)].slice(0, 4))
  }, [role])

  // Apps call useDesktopServices() for cross-app navigation. Providing a real
  // implementation rather than leaving the context null means "open Teams from
  // Analytics" still works here. The install/uninstall members are no-ops:
  // there is no desktop to add an icon to.
  const services: DesktopServices = useMemo(() => ({
    role,
    installedAppIds: apps.map(a => a.id),
    hiddenAppIds: [],
    installApp: () => {},
    uninstallApp: () => {},
    addToDesktop: () => {},
    removeFromDesktop: () => {},
    openApp,
  }), [role, apps, openApp])

  const current = openId ? getApp(openId) : null
  const Current = current?.Component

  return (
    <DesktopServicesContext.Provider value={services}>
      <div style={{
        position: 'fixed', inset: 0, background: M.bg, color: M.text,
        fontFamily: FUTURA, display: 'flex', flexDirection: 'column',
        // Keeps the header and bottom bar clear of the notch and the home
        // indicator on iOS rather than sitting under them.
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <style>{`
          .ms-tile:active { transform: scale(.96); }
          .ms-tile { transition: transform .12s ease; }
          .ms-scroll { -webkit-overflow-scrolling: touch; }
        `}</style>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: M.surface,
          borderBottom: `1px solid ${M.border}`, flexShrink: 0,
        }}>
          {current ? (
            <button
              onClick={() => setOpenId(null)}
              aria-label="Back to apps"
              style={{
                background: 'transparent', border: 'none', color: M.accent,
                fontSize: 22, lineHeight: 1, padding: '2px 6px 2px 0',
                cursor: 'pointer', fontFamily: FUTURA,
              }}
            >‹</button>
          ) : null}
          <div style={{
            fontSize: 12, fontWeight: 'bold', letterSpacing: 2,
            color: current ? M.text : M.muted, flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {current ? current.name : `${role === 'admin' ? 'ADMIN' : 'MANAGER'} APPS`}
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────── */}
        <div className="ms-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {Current ? (
            <Current />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
              gap: 14, padding: 16,
            }}>
              {apps.map(app => (
                <button
                  key={app.id}
                  className="ms-tile"
                  onClick={() => openApp(app.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 7, background: 'transparent', border: 'none',
                    padding: 0, cursor: 'pointer', fontFamily: FUTURA,
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: app.iconBg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, overflow: 'hidden', flexShrink: 0,
                  }}>
                    {app.iconSrc
                      ? <img src={app.iconSrc} alt="" width={56} height={56} style={{ objectFit: 'cover' }} />
                      : app.icon}
                  </div>
                  <span style={{
                    fontSize: 10, letterSpacing: .6, color: M.text,
                    textAlign: 'center', lineHeight: 1.25,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {app.shortName || app.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── BOTTOM BAR ─────────────────────────────────────────────── */}
        {recent.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', background: M.surface,
            borderTop: `1px solid ${M.border}`, flexShrink: 0,
            overflowX: 'auto',
          }}>
            <button
              onClick={() => setOpenId(null)}
              style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 6,
                background: openId === null ? M.surfaceLift : 'transparent',
                border: `1px solid ${openId === null ? M.accent : M.border}`,
                color: openId === null ? M.accent : M.muted,
                fontSize: 10, fontWeight: 'bold', letterSpacing: 1.2,
                fontFamily: FUTURA, cursor: 'pointer',
              }}
            >APPS</button>
            {recent.map(id => {
              const a = getApp(id)
              if (!a) return null
              const active = id === openId
              return (
                <button
                  key={id}
                  onClick={() => openApp(id)}
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 11px', borderRadius: 6,
                    background: active ? M.surfaceLift : 'transparent',
                    border: `1px solid ${active ? M.accent : M.border}`,
                    color: active ? M.text : M.muted,
                    fontSize: 10, letterSpacing: 1, fontFamily: FUTURA,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{a.icon}</span>
                  {a.shortName || a.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </DesktopServicesContext.Provider>
  )
}
