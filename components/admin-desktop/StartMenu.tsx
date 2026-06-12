'use client'
import { useEffect, useRef } from 'react'
import { useUser, UserButton, SignOutButton } from '@clerk/nextjs'
import { getApp } from './registry'
import { APP_STORE_ID } from './desktopServices'
import type { AppId, RecentApp, AppDefinition } from './types'

interface StartMenuProps {
  onClose: () => void
  onLaunchApp: (id: AppId) => void
  recent: RecentApp[]
  installedApps: AppDefinition[]
  onOpenPersonalize: () => void
}

// =============================================================================
// START MENU — v24
// =============================================================================
// v24 changes vs v23 (App Store push):
// - INSTALLED-APPS AWARE: the All Apps list now comes from the new
//   `installedApps` prop (base apps + downloaded store apps, supplied by
//   Desktop v24) instead of importing APPS directly. Hidden-from-desktop
//   apps still appear here — Start is the full launcher.
// - APP STORE PERMANENTLY PINNED: its own strip directly above the footer,
//   always present even when the App Store icon is removed from the desktop.
//   This is the guaranteed recovery path: Start → App Store → INSTALLED tab
//   → ADD TO DESKTOP.
// - PERSONALIZE footer button (between Account and Log Off) opens the
//   wallpaper dialog via the new `onOpenPersonalize` prop.
// - Recently Closed entries are filtered to apps that are still installed,
//   so an uninstalled store app can't be reopened from recents.
// - Account window flow simplified: the footer button and avatar now call
//   onLaunchApp('clerk-profile') directly. The open-desktop-app CustomEvent
//   dispatch is kept as a fallback for any other dispatchers — and Desktop
//   v24 finally implements the listener (it never existed before v24, which
//   is why Manage Account was dead).
//
// v23 — Manage Account opens the draggable ClerkProfile desktop window.
// =============================================================================

export default function StartMenu({
  onClose, onLaunchApp, recent, installedApps, onOpenPersonalize,
}: StartMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { user, isLoaded } = useUser()

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Don't close if clicking on the Start button (its own handler will toggle)
        const target = e.target as HTMLElement
        if (target.closest('[aria-label="Start"]')) return
        onClose()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // v24: launch directly through the window manager; keep the CustomEvent as
  // a secondary path for any external dispatchers.
  const openAccountWindow = () => {
    onLaunchApp('clerk-profile')
    window.dispatchEvent(
      new CustomEvent('open-desktop-app', { detail: { appId: 'clerk-profile' } })
    )
    onClose()
  }

  const fullName = user
    ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User')
    : 'Loading...'

  const installedIds = new Set(installedApps.map(a => a.id))

  const recentValid = recent
    .map(r => ({ ...r, app: getApp(r.appId) }))
    .filter(r => r.app && installedIds.has(r.appId))
    .slice(0, 6)

  const appStore = getApp(APP_STORE_ID)
  const mainApps = installedApps.filter(a => a.id !== APP_STORE_ID)

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        bottom: 48,
        left: 0,
        width: 380,
        maxWidth: 'calc(100vw - 8px)',
        maxHeight: 'calc(100vh - 56px)',
        background: 'rgba(245, 249, 253, 0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid #3a6ea5',
        borderBottomLeftRadius: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 8,
        boxShadow: '6px -6px 28px rgba(0,0,0,0.45)',
        zIndex: 10001,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Segoe UI", Tahoma, sans-serif',
        color: '#1c1c2c',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER (profile) ───────────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(to bottom, #d0e4f8 0%, #93b8de 60%, #5a8ac0 100%)',
        borderBottom: '1px solid #5a8ac0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <div
          onClick={openAccountWindow}
          title="Manage account"
          style={{
            width: 48, height: 48,
            borderRadius: 6,
            background: 'white',
            border: '2px solid white',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isLoaded && (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: { width: 44, height: 44 },
                  userButtonPopoverCard: {
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                  },
                },
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: 'white',
            textShadow: '0 1px 1px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{fullName}</div>
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 1px rgba(0,0,0,0.3)',
            marginTop: 2,
          }}>DialerSeat Admin</div>
        </div>
      </div>

      {/* ── INSTALLED APPS ─────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 4px',
        borderBottom: '1px solid #d0d6e0',
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}>
        <SectionHeader>All Apps</SectionHeader>
        {mainApps.map(app => (
          <StartMenuItem
            key={app.id}
            icon={app.icon}
            iconBg={app.iconBg}
            label={app.name}
            sublabel={app.description}
            onClick={() => {
              onLaunchApp(app.id)
              onClose()
            }}
          />
        ))}
        {mainApps.length === 0 && (
          <div style={{ padding: '4px 12px 8px', fontSize: 11, color: '#6a7080' }}>
            No apps installed — visit the App Store below
          </div>
        )}
      </div>

      {/* ── RECENT ─────────────────────────────────────────────────────── */}
      {recentValid.length > 0 && (
        <div style={{
          padding: '8px 4px',
          borderBottom: '1px solid #d0d6e0',
          flexShrink: 0,
        }}>
          <SectionHeader>Recently Closed</SectionHeader>
          {recentValid.map((r, idx) => (
            <StartMenuItem
              key={`${r.appId}-${idx}`}
              icon={r.app!.icon}
              iconBg={r.app!.iconBg}
              label={r.app!.name}
              sublabel={'Reopen'}
              onClick={() => {
                onLaunchApp(r.appId)
                onClose()
              }}
            />
          ))}
        </div>
      )}

      {/* ── APP STORE (permanently pinned) ─────────────────────────────── */}
      {appStore && (
        <div style={{
          padding: '6px 4px',
          borderBottom: '1px solid #b8c4d4',
          background: 'linear-gradient(to bottom, #eaf1f9, #dbe6f2)',
          flexShrink: 0,
        }}>
          <StartMenuItem
            icon={appStore.icon}
            iconBg={appStore.iconBg}
            label={appStore.name}
            sublabel="Download, uninstall, and re-add desktop apps"
            onClick={() => {
              onLaunchApp(appStore.id)
              onClose()
            }}
          />
        </div>
      )}

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: 8,
        background: 'linear-gradient(to bottom, #e0e8f0, #c8d4e0)',
        borderTop: '1px solid #5a7ba0',
        display: 'flex',
        gap: 4,
        flexShrink: 0,
      }}>
        <button
          style={footerBtnStyle}
          onClick={openAccountWindow}
        >
          <span style={{ marginRight: 6 }}>👤</span>
          Account
        </button>
        <button
          style={footerBtnStyle}
          onClick={() => {
            onOpenPersonalize()
            onClose()
          }}
        >
          <span style={{ marginRight: 6 }}>🎨</span>
          Personalize
        </button>
        <SignOutButton redirectUrl="/">
          <button style={footerBtnStyle}>
            <span style={{ marginRight: 6 }}>🔒</span>
            Log Off
          </button>
        </SignOutButton>
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: '#5a6a7a',
      letterSpacing: 1.5,
      padding: '6px 12px 4px 12px',
      textTransform: 'uppercase',
    }}>{children}</div>
  )
}

function StartMenuItem({
  icon, iconBg, label, sublabel, onClick,
}: {
  icon: string
  iconBg: string
  label: string
  sublabel: string
  onClick: () => void
}) {
  return (
    <div
      role="menuitem"
      onClick={onClick}
      style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        borderRadius: 3,
        margin: '0 4px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'linear-gradient(to bottom, #c8def8, #92b8e0)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#6a7080', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sublabel}
        </div>
      </div>
    </div>
  )
}

const footerBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  background: 'linear-gradient(to bottom, #f0f4f8, #d0d8e0)',
  border: '1px solid #8a9aab',
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 600,
  color: '#1c1c2c',
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
}