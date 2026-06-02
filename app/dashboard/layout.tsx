'use client'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useBranding } from '@/components/ThemeProvider'

const userNavItems = [
  { icon: '📈', label: 'ANALYTICS', href: '/dashboard/analytics' },
  { icon: '📞', label: 'DIALER', href: '/dashboard/dialer' },
  { icon: '📋', label: 'CAMPAIGNS', href: '/dashboard/campaigns' },
  { icon: '🎙️', label: 'RECORDINGS', href: '/dashboard/recordings' },
  { icon: '👥', label: 'LEADS', href: '/dashboard/leads' },
  { icon: '🏢', label: 'TEAMS', href: '/dashboard/teams' },
  { icon: '⚙️', label: 'SETTINGS', href: '/dashboard/settings' },
]

const adminNavItems = [
  { icon: '📈', label: 'ANALYTICS', href: '/dashboard/admin/analytics' },
  { icon: '📋', label: 'OVERVIEW', href: '/dashboard/admin/overview' },
  { icon: '🏢', label: 'TEAMS', href: '/dashboard/admin/teams' },
  { icon: '📞', label: 'NUMBERS', href: '/dashboard/admin/numbers' },
  { icon: '⚙️', label: 'SETTINGS', href: '/dashboard/admin/settings' },
]

type AccessTier = 'active' | 'lapsed' | 'new' | null
type Plan = 'pro' | 'manager_plus' | 'both' | null

interface SubsSummary {
  ownerPaidSeats: { teamId: string; teamName: string }[]
  agentPaidSeats: { teamId: string; teamName: string }[]
  counts: { ownerPaid: number; agentPaid: number; totalSeats: number }
}

// =============================================================================
// /dashboard — LAYOUT (v24 — Phase D2: MANAGER+ awareness)
// =============================================================================
// Reads `plan` from /api/stripe/status response (added in Phase D2 status
// route) and shows MANAGER+ / PRO + MANAGER+ in the sidebar profile row
// when the user owns a white-label tenant.
//
// Everything else from v23 preserved verbatim — tenant logo, mobile drawer,
// admin nav, brand-aware active nav highlight, etc.
// =============================================================================

const BARE_LAYOUT_PREFIXES = [
  '/dashboard/admin/desktop',
]

function shouldRenderBare(pathname: string | null): boolean {
  if (!pathname) return false
  return BARE_LAYOUT_PREFIXES.some((p) => pathname.startsWith(p))
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const pathname = usePathname()
  const branding = useBranding()

  const bare = shouldRenderBare(pathname)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tier, setTier] = useState<AccessTier>(null)
  const [plan, setPlan] = useState<Plan>(null)
  const [seats, setSeats] = useState<SubsSummary | null>(null)
  const profileRowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (bare) return
    if (drawerOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen, bare])

  useEffect(() => {
    if (!user || bare) return
    let cancelled = false
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => { if (!cancelled) setIsAdmin(!!d.isAdmin) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })
    return () => { cancelled = true }
  }, [user, bare])

  useEffect(() => {
    if (!user || bare) return
    let cancelled = false
    const loadStatus = () => {
      fetch('/api/stripe/status')
        .then(r => r.json())
        .then(d => {
          if (cancelled) return
          setTier(d.tier || null)
          setPlan((d.plan as Plan) ?? null)
        })
        .catch(() => {
          if (cancelled) return
          setTier(null)
          setPlan(null)
        })
    }
    const loadSeats = () => {
      fetch('/api/subscriptions/summary')
        .then(r => r.json())
        .then(d => {
          if (cancelled) return
          if (d.success) {
            setSeats({
              ownerPaidSeats: d.ownerPaidSeats || [],
              agentPaidSeats: d.agentPaidSeats || [],
              counts: d.counts || { ownerPaid: 0, agentPaid: 0, totalSeats: 0 },
            })
          }
        })
        .catch(() => {})
    }
    loadStatus()
    loadSeats()
    const onFocus = () => { loadStatus(); loadSeats() }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [user, pathname, bare])

  if (bare) {
    return <>{children}</>
  }

  const navItems = isAdmin ? adminNavItems : userNavItems

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
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

  const logoHref = isAdmin ? '/dashboard/admin/analytics' : '/dashboard/analytics'

  const brandPrimary = branding?.primary_color || '#4a9eff'
  const tenantLogoUrl = branding?.logo_url || null
  const tenantBrandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'

  const totalSeats = seats?.counts.totalSeats || 0
  const hasActivePersonal = tier === 'active'
  const hasAnySeat = totalSeats > 0
  const hasManagerPlus = plan === 'manager_plus' || plan === 'both'

  let primaryLabel: string
  let primaryColor: string
  let primaryWeight: 'bold' | 'normal'
  let secondaryText: string | null = null

  // ── Label ladder (v24 — Manager+ branch added) ──────────────────────
  if (isAdmin) {
    primaryLabel = 'ADMIN'
    primaryColor = brandPrimary
    primaryWeight = 'bold'
  } else if (hasManagerPlus) {
    // Manager+ is the highest tier — show it whether or not they ALSO have Pro.
    // If they have both, layout still shows MANAGER+ since it's the higher tier
    // and supersedes Pro for display purposes. Settings page shows both.
    primaryLabel = plan === 'both' ? 'PRO + MANAGER+' : 'MANAGER+'
    primaryColor = brandPrimary
    primaryWeight = 'bold'
    if (hasAnySeat) {
      secondaryText = `+ ${totalSeats} TEAM SEAT${totalSeats === 1 ? '' : 'S'}`
    }
  } else if (hasActivePersonal && hasAnySeat) {
    primaryLabel = 'PRO PLAN'
    primaryColor = 'var(--text-secondary)'
    primaryWeight = 'normal'
    secondaryText = `+ ${totalSeats} TEAM SEAT${totalSeats === 1 ? '' : 'S'}`
  } else if (hasActivePersonal) {
    primaryLabel = 'PRO PLAN'
    primaryColor = 'var(--text-secondary)'
    primaryWeight = 'normal'
  } else if (hasAnySeat) {
    primaryLabel = 'TEAM SEAT'
    primaryColor = brandPrimary
    primaryWeight = 'bold'
    const firstTeam = (seats?.ownerPaidSeats[0] || seats?.agentPaidSeats[0])
    if (firstTeam) {
      secondaryText = totalSeats === 1
        ? `via ${firstTeam.teamName}`
        : `${totalSeats} teams`
    }
  } else if (tier === 'lapsed') {
    primaryLabel = 'UNSUBSCRIBED'
    primaryColor = '#ffaa3e'
    primaryWeight = 'bold'
  } else if (tier === 'new') {
    primaryLabel = 'NO PLAN'
    primaryColor = '#ffaa3e'
    primaryWeight = 'bold'
  } else {
    primaryLabel = '...'
    primaryColor = 'var(--text-secondary)'
    primaryWeight = 'normal'
  }

  const TenantBrandDesktop = () => (
    <span style={{
      position: 'relative',
      display: 'block',
      width: 224,
      height: 64,
      flexShrink: 0,
    }}>
      <Image
        src={tenantLogoUrl!}
        alt={tenantBrandName}
        fill
        sizes="224px"
        style={{ objectFit: 'contain', objectPosition: 'left center' }}
        priority
        unoptimized
      />
    </span>
  )

  const TenantBrandMobileTopbar = () => (
    <span style={{
      position: 'relative',
      display: 'block',
      width: 140,
      height: 30,
      flexShrink: 0,
    }}>
      <Image
        src={tenantLogoUrl!}
        alt={tenantBrandName}
        fill
        sizes="140px"
        style={{ objectFit: 'contain', objectPosition: 'left center' }}
        priority
        unoptimized
      />
    </span>
  )

  const DefaultBrandDesktop = () => (
    <>
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
    </>
  )

  const DefaultBrandMobileTopbar = () => (
    <>
      <div style={{
        width: 26, height: 26, borderRadius: 6,
        background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>D</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: 'var(--text-primary)' }}>
        DIALERSEAT
      </span>
    </>
  )

  const Sidebar = () => (
    <>
      <Link href={logoHref} style={{
        display: 'flex',
        alignItems: 'center',
        gap: tenantLogoUrl ? 0 : '12px',
        padding: '0 18px',
        marginBottom: '24px',
        textDecoration: 'none',
        flexShrink: 0,
        height: 64,
      }}>
        {tenantLogoUrl ? <TenantBrandDesktop /> : <DefaultBrandDesktop />}
      </Link>

      <nav style={{
        flex: 1, minHeight: 0, padding: '0 12px',
        display: 'flex', flexDirection: 'column', gap: '2px',
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
                background: active
                  ? `color-mix(in srgb, ${brandPrimary} 10%, transparent)`
                  : 'transparent',
                border: active
                  ? `1px solid color-mix(in srgb, ${brandPrimary} 20%, transparent)`
                  : '1px solid transparent',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span style={{
                fontSize: '11px',
                letterSpacing: '2px',
                fontWeight: 'bold',
                color: active ? brandPrimary : 'var(--text-secondary)',
                flex: 1,
              }}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {!isAdmin && tier === 'lapsed' && !hasAnySeat && !hasManagerPlus && (
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
            fontSize: 9, letterSpacing: 2, fontWeight: 'bold', color: '#ffaa3e',
          }}>▸ RESUBSCRIBE</span>
          <span style={{
            fontSize: 9, color: 'var(--text-secondary)', letterSpacing: 1,
          }}>Restore dialing access</span>
        </Link>
      )}

      <div
        ref={profileRowRef}
        onClick={handleProfileRowClick}
        className="ds-profile-row"
        style={{
          padding: '14px 24px',
          paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 8px))',
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
            fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)',
            letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{user?.firstName} {user?.lastName}</div>
          <div style={{
            fontSize: '10px', color: primaryColor,
            letterSpacing: '1px', fontWeight: primaryWeight,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{primaryLabel}</div>
          {secondaryText && (
            <div style={{
              fontSize: '9px', color: 'var(--text-secondary)',
              letterSpacing: '0.5px', marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{secondaryText}</div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <main style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex' }}>
      <style>{`
        .ds-sidebar-desktop {
          width: 260px; height: 100vh; position: sticky; top: 0;
          background: var(--surface); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; padding: 20px 0;
          flex-shrink: 0; overflow: hidden;
        }
        .ds-mobile-topbar { display: none; }
        .ds-sidebar-mobile { display: none; }
        .ds-mobile-overlay { display: none; }
        .ds-profile-row:hover { background: color-mix(in srgb, ${brandPrimary} 6%, transparent); }

        @media (max-width: 768px) {
          .ds-sidebar-desktop { display: none; }
          .ds-mobile-topbar {
            display: flex; position: sticky; top: 0; left: 0; right: 0; z-index: 40;
            align-items: center; justify-content: space-between;
            padding-top: max(12px, env(safe-area-inset-top, 12px));
            padding-bottom: 12px;
            padding-left: max(16px, env(safe-area-inset-left, 16px));
            padding-right: max(16px, env(safe-area-inset-right, 16px));
            background: var(--surface); border-bottom: 1px solid var(--border);
          }
          .ds-sidebar-mobile {
            display: flex; position: fixed; top: 0; left: 0; bottom: 0;
            width: 280px; max-width: 85vw;
            background: var(--surface); border-right: 1px solid var(--border);
            flex-direction: column;
            padding-top: max(24px, calc(env(safe-area-inset-top, 0px) + 16px));
            padding-bottom: 0;
            z-index: 60;
            transform: translateX(-100%); transition: transform 0.25s ease;
          }
          .ds-sidebar-mobile.open { transform: translateX(0); }
          .ds-mobile-overlay {
            display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.55);
            z-index: 50; opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
          }
          .ds-mobile-overlay.open { opacity: 1; pointer-events: auto; }
          .ds-mobile-content {
            flex: 1; min-width: 0; display: flex; flex-direction: column;
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
              width: 40, height: 40, border: '1px solid var(--border)',
              background: 'var(--surface)', borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, cursor: 'pointer', padding: 0,
            }}
          >
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--text-primary)', borderRadius: 1 }} />
          </button>

          <Link href={logoHref} style={{
            display: 'flex',
            alignItems: 'center',
            gap: tenantLogoUrl ? 0 : 8,
            textDecoration: 'none',
          }}>
            {tenantLogoUrl ? <TenantBrandMobileTopbar /> : <DefaultBrandMobileTopbar />}
          </Link>

          <UserButton />
        </div>

        {children}
      </div>
    </main>
  )
}