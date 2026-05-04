'use client'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const navItems = [
  { icon: '\uD83D\uDCCA', label: 'DASHBOARD', href: '/dashboard' },
  { icon: '\uD83D\uDCDE', label: 'DIALER', href: '/dashboard/dialer' },
  { icon: '\uD83D\uDCCB', label: 'CAMPAIGNS', href: '/dashboard/campaigns' },
  { icon: '\uD83D\uDC65', label: 'LEADS', href: '/dashboard/leads' },
  { icon: '\uD83D\uDCC8', label: 'ANALYTICS', href: '/dashboard/analytics' },
  { icon: '\uD83C\uDFE2', label: 'TEAM', href: '/dashboard/team' },
  { icon: '\u2699\uFE0F', label: 'SETTINGS', href: '/dashboard/settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const Sidebar = () => (
    <>
      {/* LOGO */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 24px',
        marginBottom: '48px',
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
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '4px',
          color: 'var(--text-primary)',
        }}>DIALERSEAT</span>
      </div>

      {/* NAV ITEMS */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                padding: '12px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: active ? 'rgba(74,158,255,0.1)' : 'transparent',
                border: active ? '1px solid rgba(74,158,255,0.2)' : '1px solid transparent',
                textDecoration: 'none',
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

      {/* USER SECTION */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <UserButton />
        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: 'var(--text-primary)',
            letterSpacing: '1px',
          }}>{user?.firstName} {user?.lastName}</div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-secondary)',
            letterSpacing: '1px',
          }}>PRO PLAN</div>
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
          min-height: 100vh;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 32px 0;
          flex-shrink: 0;
        }
        .ds-mobile-topbar { display: none; }
        .ds-sidebar-mobile { display: none; }
        .ds-mobile-overlay { display: none; }

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

      {/* DESKTOP SIDEBAR — unchanged from before */}
      <div className="ds-sidebar-desktop">
        <Sidebar />
      </div>

      {/* MOBILE OVERLAY */}
      <div
        className={`ds-mobile-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* MOBILE DRAWER */}
      <aside className={`ds-sidebar-mobile ${drawerOpen ? 'open' : ''}`}>
        <Sidebar />
      </aside>

      {/* MAIN COLUMN */}
      <div className="ds-mobile-content" style={{ flex: 1, minWidth: 0 }}>
        {/* MOBILE TOP BAR (hamburger + logo) — only shows on mobile */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          </div>

          <UserButton />
        </div>

        {children}
      </div>
    </main>
  )
}