'use client'
import { useEffect, useRef, useState } from 'react'
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
// START MENU — v25
// =============================================================================
// v25 changes vs v24 (simplification pass):
// - NO MORE FULL APP DUMP: the default view shows a short list — recently
//   used apps first, topped up with installed apps until there are 6 rows.
//   An "All apps ▸" toggle at the bottom of the list expands the complete
//   installed list in place (Windows 7's "All Programs" behavior); "◂ Back"
//   collapses it. Collapsed is the default every time the menu opens.
// - Removed the separate "Recently Closed" section — recents ARE the main
//   list now, so the menu is one short list + App Store + footer.
// - iconSrc support: rows render the registry image icon when set, emoji
//   fallback otherwise.
//
// v24: installed-apps aware, App Store permanently pinned above the footer,
// Personalize footer button, Account opens the ClerkProfile desktop window.
// =============================================================================

const SIMPLE_LIST_SIZE = 6

export default function StartMenu({
  onClose, onLaunchApp, recent, installedApps, onOpenPersonalize,
}: StartMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { user, isLoaded } = useUser()
  const [allAppsOpen, setAllAppsOpen] = useState(false)

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
  const appStore = getApp(APP_STORE_ID)
  const launchable = installedApps.filter(a => a.id !== APP_STORE_ID)

  // ── Simple list: recents first (installed only, deduped), topped up with
  //    remaining installed apps until SIMPLE_LIST_SIZE rows ─────────────────
  const recentApps = recent
    .map(r => launchable.find(a => a.id === r.appId))
    .filter((a): a is AppDefinition => !!a && installedIds.has(a.id))
  const seen = new Set<string>()
  const simpleList: AppDefinition[] = []
  for (const a of [...recentApps, ...launchable]) {
    if (seen.has(a.id)) continue
    seen.add(a.id)
    simpleList.push(a)
    if (simpleList.length >= SIMPLE_LIST_SIZE) break
  }

  const listToShow = allAppsOpen ? launchable : simpleList
  const hasMore = launchable.length > simpleList.length

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

      {/* ── APP LIST (simple ↔ all apps) ───────────────────────────────── */}
      <div style={{
        padding: '8px 4px',
        borderBottom: '1px solid #d0d6e0',
        overflowY: 'auto',
        flex: 1,
        minHeight: 0,
      }}>
        {listToShow.map(app => (
          <StartMenuItem
            key={app.id}
            icon={app.icon}
            iconSrc={app.iconSrc}
            iconBg={app.iconBg}
            label={app.name}
            sublabel={app.description}
            onClick={() => {
              onLaunchApp(app.id)
              onClose()
            }}
          />
        ))}
        {listToShow.length === 0 && (
          <div style={{ padding: '4px 12px 8px', fontSize: 11, color: '#6a7080' }}>
            No apps installed — visit the App Store below
          </div>
        )}

        {(hasMore || allAppsOpen) && (
          <div
            role="menuitem"
            onClick={() => setAllAppsOpen(o => !o)}
            style={{
              padding: '8px 12px',
              margin: '4px 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              borderRadius: 3,
              borderTop: '1px solid #e0e4ea',
              fontSize: 12,
              fontWeight: 600,
              color: '#3a5a8a',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #c8def8, #92b8e0)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {allAppsOpen ? '◂ Back' : `All apps ▸`}
          </div>
        )}
      </div>

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
            iconSrc={appStore.iconSrc}
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

function StartMenuItem({
  icon, iconSrc, iconBg, label, sublabel, onClick,
}: {
  icon: string
  iconSrc?: string
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
        width: 28, height: 28, borderRadius: 6,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" width={18} height={18}
            style={{ objectFit: 'contain', pointerEvents: 'none' }} draggable={false} />
        ) : icon}
      </div>
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