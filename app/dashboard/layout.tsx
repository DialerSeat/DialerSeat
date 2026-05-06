'use client'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const userNavItems = [
  { icon: '📊', label: 'DASHBOARD', href: '/dashboard' },
  { icon: '📞', label: 'DIALER', href: '/dashboard/dialer' },
  { icon: '📋', label: 'CAMPAIGNS', href: '/dashboard/campaigns' },
  { icon: '🎙️', label: 'RECORDINGS', href: '/dashboard/recordings' },
  { icon: '👥', label: 'LEADS', href: '/dashboard/leads' },
  { icon: '📈', label: 'ANALYTICS', href: '/dashboard/analytics' },
  { icon: '🏢', label: 'TEAM', href: '/dashboard/team' },
  { icon: '⚙️', label: 'SETTINGS', href: '/dashboard/settings' },
]

const adminNavItems = [
  { icon: '📈', label: 'ANALYTICS', href: '/dashboard/admin/analytics' },
  { icon: '👁️', label: 'OVERVIEW', href: '/dashboard/admin/overview' },
  { icon: '🏢', label: 'TEAMS', href: '/dashboard/admin/teams' },
  { icon: '⚙️', label: 'SETTINGS', href: '/dashboard/settings' },
]

type AccessTier = 'active' | 'lapsed' | 'new' | null

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tier, setTier] = useState<AccessTier>(null)
  const profileRowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => { if (!cancelled) setIsAdmin(!!d.isAdmin) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })
    return () => { cancelled = true }
  }, [user])

  // Fetch access tier so the sidebar can show ACTIVE / LAPSED / ADMIN
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const loadTier = () => {
      fetch('/api/stripe/status')
        .then(r => r.json())
        .then(d => { if (!cancelled) setTier(d.tier || null) })
        .catch(() => { if (!cancelled) setTier(null) })
    }
    loadTier()
    // Refresh tier when tab regains focus, in case sub state changed
    // (e.g. user just resubscribed in another tab)
    const onFocus = () => loadTier()
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [user, pathname])

  // Heartbeat — ping every 60s while tab is open + on focus to avoid stale "online" state
  useEffect(() => {
    if (!user) return

    const ping = () => {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {})
    }

    ping() // initial ping
    const interval = setInterval(ping, 60_000)
    const onFocus = () => ping()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) ping()
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [user])

  const navItems = isAdmin ? adminNavItems : userNavItems

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const handleProfileRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('.cl-userButtonTrigger, .cl-userButtonAvatarBox')) return

    const row = e.currentTarget
    const trigger = row.querySelector(
      '.cl-userButtonTrigger, button.cl-userButtonAvatarBox, [data-clerk-component="UserButton"] button'
    ) as HTMLButtonElement | null
    if (trigger) trigger.click()
  }

  const logoHref = isAdmin ? '/dashboard/admin/analytics' : '/dashboard'

  // Tier label: ADMIN > LAPSED > ACTIVE > (loading)
  // Color: admin/active = blue, lapsed = orange/red
  const tierLabel = isAdmin
    ? 'ADMIN'
    : tier === 'lapsed'
      ? 'UNSUBSCRIBED'
      : tier === 'active'
        ? 'PRO PLAN'
        : tier === 'new'
          ? 'NO PLAN'
          : '...'

  const tierColor = isAdmin
    ? '#4a9eff'
    : tier === 'lapsed' || tier === 'new'
      ? '#ffaa3e'
      : tier === 'active'
        ? 'var(--text-secondary)'
        : 'var(--text-secondary)'

  const tierWeight: 'bold' | 'normal' = isAdmin || tier === 'lapsed' || tier === 'new'
    ? 'bold'
    : 'normal'

  const Sidebar = () => (
    <>
      <Link href={logoHref} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 24px',
        marginBottom: '24px',
        textDecoration: 'none',
        flexShrink: 0,
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>D</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '4px',
            color: 'var(--text-primary)',
          }}>DIALERSEAT</span>
          {isAdmin && (
            <span style={{
              fontSize: '8px',
              fontWeight: 'bold',
              letterSpacing: '3px',
              color: '#4a9eff',
              marginTop: 2,
            }}>ADMIN CONSOLE</span>
          )}
        </div>
      </Link>

      <nav style={{
        flex: 1,
        minHeight: 0,
        padding: '0 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflowY: 'auto',
      }}>
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: active ? 'rgba(74,158,255,0.1)' : 'transparent',
                border: active ? '1px solid rgba(74,158,255,0.2)' : '1px solid transparent',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span style={{
                fontSize: '11px',
                letterSpacing: '2px',
                fontWeight: 'bold',
                color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
                flex: 1,
              }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Resubscribe nudge for lapsed users — sits above profile row */}
      {!isAdmin && tier === 'lapsed' && (
        <Link
          href="/billing"
          style={{
            margin: '0 12px 8px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(255,170,62,0.08)',
            border: '1px solid rgba(255,170,62,0.4)',
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            flexShrink: 0,
          }}>
          <span style={{
            fontSize: 9,
            letterSpacing: 2,
            fontWeight: 'bold',
            color: '#ffaa3e',
          }}>▸ RESUBSCRIBE</span>
          <span style={{
            fontSize: 9,
            color: 'var(--text-secondary)',
            letterSpacing: 1,
          }}>Restore dialing access</span>
        </Link>
      )}

      <div
        ref={profileRowRef}
        onClick={handleProfileRowClick}
        className="ds-profile-row"
        style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        <UserButton />
        <div style={{ flex: 1, minWidth: 0, pointerEvents: 'none' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'var(--text-primary)',
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{user?.firstName} {user?.lastName}</div>
          <div style={{
            fontSize: '10px',
            color: tierColor,
            letterSpacing: '1px',
            fontWeight: tierWeight,
          }}>{tierLabel}</div>
        </div>
      </div>
    </>
  )

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
    }}>
      <style>{`
        .ds-sidebar-desktop {
          width: 260px;
          height: 100vh;
          position: sticky;
          top: 0;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 20px 0;
          flex-shrink: 0;
          overflow: hidden;
        }
        .ds-mobile-topbar { display: none; }
        .ds-sidebar-mobile { display: none; }
        .ds-mobile-overlay { display: none; }

        .ds-profile-row:hover {
          background: rgba(74,158,255,0.06);
        }

        @media (max-width: 768px) {
          .ds-sidebar-desktop { display: none; }
          .ds-mobile-topbar {
            display: flex;
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            z-index: 40;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
          }
          .ds-sidebar-mobile {
            display: flex;
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: 280px;
            max-width: 85vw;
            background: var(--surface);
            border-right: 1px solid var(--border);
            flex-direction: column;
            padding: 24px 0;
            z-index: 60;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .ds-sidebar-mobile.open { transform: translateX(0); }
          .ds-mobile-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.55);
            z-index: 50;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
          }
          .ds-mobile-overlay.open {
            opacity: 1;
            pointer-events: auto;
          }
          .ds-mobile-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="ds-sidebar-desktop">
        <Sidebar />
      </div>

      <div
        className={`ds-mobile-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <aside className={`ds-sidebar-mobile ${drawerOpen ? 'open' : ''}`}>
        <Sidebar />
      </aside>

      <div className="ds-mobile-content" style={{ flex: 1, minWidth: 0 }}>
        <div className="ds-mobile-topbar">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            style={{
              width: 40,
              height: 40,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 1 }} />
          </button>

          <Link href={logoHref} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>D</span>
            </div>
            <span style={{
              fontSize: 12,
              fontWeight: 'bold',
              letterSpacing: 4,
              color: 'var(--text-primary)',
            }}>DIALERSEAT</span>
          </Link>

          <UserButton />
        </div>

        {children}
      </div>
    </main>
  )
}