'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, UserButton, SignOutButton } from '@clerk/nextjs'
import { APPS, getApp } from './registry'
import type { AppId, RecentApp } from './types'

interface StartMenuProps {
  onClose: () => void
  onLaunchApp: (id: AppId) => void
  recent: RecentApp[]
}

// =============================================================================
// START MENU — v22.d
// =============================================================================
// Win7 Start menu — left column with pinned apps, right column with profile
// header + recent items + Shut Down. Closes on outside click or Escape.
//
// v22.d FIX — Manage Account routes to a page instead of opening a modal.
//   Clerk's <UserButton> default opens its profile manager as a modal
//   rendered through a React portal at document.body. Inside the admin
//   desktop the StartMenu container has `overflow: hidden`, AND the
//   <UserButton> sits inside a small 48x48 white box for visual fit.
//   Even though Clerk's portal escapes the DOM ancestry, the modal layer
//   was rendering inconsistently — sometimes invisible, sometimes
//   clipped, depending on stacking context.
//
//   The fix is to use Clerk's routing-mode "path" with userProfileUrl
//   pointing at a real /dashboard/admin/profile route. Now "Manage
//   Account" navigates to that page (which renders <UserProfile />
//   inline). Predictable, always works, and matches the desktop's
//   spatial metaphor — clicking it feels like opening a window.
// =============================================================================

export default function StartMenu({ onClose, onLaunchApp, recent }: StartMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
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

  const fullName = user
    ? (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User')
    : 'Loading...'

  const recentValid = recent
    .map(r => ({ ...r, app: getApp(r.appId) }))
    .filter(r => r.app)
    .slice(0, 6)

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
      }}>
        <div style={{
          width: 48, height: 48,
          borderRadius: 6,
          background: 'white',
          border: '2px solid white',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {isLoaded && (
            <UserButton
              userProfileMode="navigation"
              userProfileUrl="/dashboard/admin/profile"
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

      {/* ── PINNED APPS ────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 4px',
        borderBottom: '1px solid #d0d6e0',
        overflowY: 'auto',
      }}>
        <SectionHeader>All Apps</SectionHeader>
        {APPS.map(app => (
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
      </div>

      {/* ── RECENT ─────────────────────────────────────────────────────── */}
      {recentValid.length > 0 && (
        <div style={{
          padding: '8px 4px',
          borderBottom: '1px solid #d0d6e0',
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

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: 8,
        background: 'linear-gradient(to bottom, #e0e8f0, #c8d4e0)',
        borderTop: '1px solid #5a7ba0',
        display: 'flex',
        gap: 4,
      }}>
        <SignOutButton redirectUrl="/">
          <button style={footerBtnStyle}>
            <span style={{ marginRight: 6 }}>🔒</span>
            Log Off
          </button>
        </SignOutButton>
        <button
          style={footerBtnStyle}
          onClick={() => {
            onClose()
            router.push('/dashboard/analytics')
          }}
        >
          <span style={{ marginRight: 6 }}>⏻</span>
          Shut Down
        </button>
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
  padding: '8px 12px',
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
}