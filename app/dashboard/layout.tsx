'use client'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useBranding } from '@/components/ThemeProvider'

// =============================================================================
// app/dashboard/layout.tsx — C5 (Manager+ "Go to Desktop" sidebar button)
// =============================================================================
// C5 changes vs C4:
//
//   - GO TO DESKTOP BUTTON. A themed entry to the Manager+ desktop now
//     renders just above the profile row in the sidebar, gated on
//     hasManagerPlus (already derived from /api/stripe/status — true for
//     plan 'manager_plus' or 'both'). It links to /dashboard/manager/desktop
//     (a server-guarded route that re-checks tenant ownership). Because it
//     lives inside the shared <Sidebar/>, it appears in BOTH the desktop
//     sidebar and the mobile drawer automatically. Themed with brandPrimary
//     so it reads as part of the owner's brand. Shows for nobody else —
//     admins, Pro-only users, team-seat users, and lapsed users never see it.
//
//   - When the REAL Manager+ desktop ships (replacing the Coming Soon page),
//     add '/dashboard/manager/desktop' to BARE_LAYOUT_PREFIXES so it renders
//     full-screen without this dashboard chrome, exactly like the admin
//     desktop does today.
//
// C4 changes vs C3:
//   - Desktop logo Link: added justifyContent: 'center' so the logo
//     content sits centered within the 260px sidebar instead of pinned
//     to the left.
//
// C3 changes vs C2:
//   - Desktop tenant logo box BG: var(--brand-header-bg) → transparent.
//
// What stays (untouched):
//   - Logo box dimensions: tenantLogoUrl ? 74 : 64 (height), 0 vs '0 18px'.
//   - Hamburger button → --brand-header-bg background, --brand-on-header bars.
//   - Mobile topbar background → --brand-header-bg.
//   - Desktop sidebar / mobile drawer background → --brand-sidebar-bg.
//   - Nav items, profile row, drawer chrome → sidebar-tinted tokens.
//   - Lapsed RESUBSCRIBE banner → semantic amber #ffaa3e.
//   - ADMIN CONSOLE subtitle blue (#4a9eff) — only on default brand.
//   - DefaultBrand* gradient D logos.
//   - brandPrimary JS const for profile-row conditional badge color.
// =============================================================================

const userNavItems = [
  { label: 'ANALYTICS', href: '/dashboard/analytics' },
  { label: 'DIALER', href: '/dashboard/dialer' },
  { label: 'CAMPAIGNS', href: '/dashboard/campaigns' },
  { label: 'RECORDINGS', href: '/dashboard/recordings' },
  { label: 'LEADS', href: '/dashboard/leads' },
  { label: 'TEAMS', href: '/dashboard/teams' },
  { label: 'SETTINGS', href: '/dashboard/settings' },
]

const adminNavItems = [
  { label: 'ANALYTICS', href: '/dashboard/admin/analytics' },
  { label: 'OVERVIEW', href: '/dashboard/admin/overview' },
  { label: 'TEAMS', href: '/dashboard/admin/teams' },
  { label: 'NUMBERS', href: '/dashboard/admin/numbers' },
  { label: 'SETTINGS', href: '/dashboard/admin/settings' },
]

type AccessTier = 'active' | 'lapsed' | 'new' | null
type Plan = 'pro' | 'manager_plus' | 'both' | null

interface SubsSummary {
  ownerPaidSeats: { teamId: string; teamName: string }[]
  agentPaidSeats: { teamId: string; teamName: string }[]
  counts: { ownerPaid: number; agentPaid: number; totalSeats: number }
}

const PENDING_LOGO_KEY = 'wl:pendingLogoPreview'
const PENDING_LOGO_MAX_AGE_MS = 5 * 60 * 1000

const BARE_LAYOUT_PREFIXES = ['/dashboard/admin/desktop', '/dashboard/manager/desktop']

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
  const [pendingLogo, setPendingLogo] = useState<{ publicUrl: string; dataUrl: string } | null>(null)
  const profileRowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (bare) return
    try {
      const raw = sessionStorage.getItem(PENDING_LOGO_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { publicUrl?: string; dataUrl?: string; savedAt?: number }
      if (!parsed.publicUrl || !parsed.dataUrl || !parsed.savedAt) {
        sessionStorage.removeItem(PENDING_LOGO_KEY)
        return
      }
      const age = Date.now() - parsed.savedAt
      if (age > PENDING_LOGO_MAX_AGE_MS) {
        sessionStorage.removeItem(PENDING_LOGO_KEY)
        return
      }
      setPendingLogo({ publicUrl: parsed.publicUrl, dataUrl: parsed.dataUrl })
    } catch {
      try { sessionStorage.removeItem(PENDING_LOGO_KEY) } catch {}
    }
  }, [bare])

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
  const rawLogoUrl = branding?.logo_url || null
  const tenantLogoUrl = (pendingLogo && rawLogoUrl === pendingLogo.publicUrl)
    ? pendingLogo.dataUrl
    : rawLogoUrl
  const tenantBrandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'

  const totalSeats = seats?.counts.totalSeats || 0
  const hasActivePersonal = tier === 'active'
  const hasAnySeat = totalSeats > 0
  const hasManagerPlus = plan === 'manager_plus' || plan === 'both'

  let primaryLabel: string
  let primaryColor: string
  let primaryWeight: 'bold' | 'normal'
  let secondaryText: string | null = null

  if (isAdmin) {
    primaryLabel = 'ADMIN'
    primaryColor = brandPrimary
    primaryWeight = 'bold'
  } else if (hasManagerPlus) {
    primaryLabel = plan === 'both' ? 'PRO + MANAGER+' : 'MANAGER+'
    primaryColor = brandPrimary
    primaryWeight = 'bold'
    if (hasAnySeat) {
      secondaryText = `+ ${totalSeats} TEAM SEAT${totalSeats === 1 ? '' : 'S'}`
    }
  } else if (hasActivePersonal && hasAnySeat) {
    primaryLabel = 'PRO PLAN'
    primaryColor = 'var(--brand-on-sidebar-muted)'
    primaryWeight = 'normal'
    secondaryText = `+ ${totalSeats} TEAM SEAT${totalSeats === 1 ? '' : 'S'}`
  } else if (hasActivePersonal) {
    primaryLabel = 'PRO PLAN'
    primaryColor = 'var(--brand-on-sidebar-muted)'
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
    primaryColor = 'var(--brand-on-sidebar-muted)'
    primaryWeight = 'normal'
  }

  const TenantBrandDesktop = () => (
    <span style={{
      position: 'relative',
      display: 'block',
      width: '100%',
      height: 74,
      flexShrink: 0,
    }}>
      <Image
        src={tenantLogoUrl!}
        alt={tenantBrandName}
        fill
        sizes="260px"
        style={{ objectFit: 'contain', objectPosition: 'center center' }}
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
        style={{ objectFit: 'contain', objectPosition: 'center center' }}
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
          color: 'var(--brand-on-sidebar)',
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
      <span style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: 'var(--brand-on-sidebar)' }}>
        DIALERSEAT
      </span>
    </>
  )

  // Logo box. C4: justifyContent center so the logo content sits in the
  // middle of the 260px sidebar instead of pinned left. Applies to both
  // tenant logos (already centered via objectFit but now explicitly
  // declared) and default brand (gradient D + DIALERSEAT text was
  // previously left-aligned with padding).
  const Sidebar = () => (
    <>
      <Link href={logoHref} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tenantLogoUrl ? 0 : '12px',
        padding: tenantLogoUrl ? 0 : '0 18px',
        marginBottom: '24px',
        textDecoration: 'none',
        flexShrink: 0,
        height: tenantLogoUrl ? 74 : 64,
        background: 'transparent',
      }}>
        {tenantLogoUrl ? <TenantBrandDesktop /> : <DefaultBrandDesktop />}
      </Link>

      <nav style={{
        flex: 1, minHeight: 0, padding: 0,
        display: 'flex', flexDirection: 'column',
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
                padding: '12px 18px',
                cursor: 'pointer',
                background: active
                  ? 'var(--brand-primary-soft)'
                  : 'transparent',
                border: active
                  ? '1px solid var(--brand-sidebar-active-bg)'
                  : '1px solid transparent',
                boxSizing: 'border-box',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontSize: '11px',
                letterSpacing: '2px',
                fontWeight: 'bold',
                color: active ? 'var(--brand-primary)' : 'var(--brand-on-sidebar-muted)',
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
            fontSize: 9, color: 'var(--brand-on-sidebar-muted)', letterSpacing: 1,
          }}>Restore dialing access</span>
        </Link>
      )}

      {/* GO TO DESKTOP — Manager+ owners only. Same position (just above the
          profile row) and same nav-tab styling, but CENTERED horizontally
          rather than left-aligned like the nav links above it. */}
      {!isAdmin && hasManagerPlus && (
        <Link
          href="/dashboard/manager/desktop"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 18px',
            cursor: 'pointer',
            background: 'transparent',
            border: '1px solid transparent',
            boxSizing: 'border-box',
            textDecoration: 'none',
            flexShrink: 0,
          }}>
          <span style={{
            fontSize: '11px',
            letterSpacing: '2px',
            fontWeight: 'bold',
            color: 'var(--brand-on-sidebar-muted)',
            textAlign: 'center',
          }}>GO TO DESKTOP</span>
        </Link>
      )}

      <div
        ref={profileRowRef}
        onClick={handleProfileRowClick}
        className="ds-profile-row"
        style={{
          padding: '14px 24px',
          paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 8px))',
          borderTop: '1px solid var(--brand-sidebar-active-bg)',
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
            fontSize: '12px', fontWeight: 'bold', color: 'var(--brand-on-sidebar)',
            letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{user?.firstName} {user?.lastName}</div>
          <div style={{
            fontSize: '10px', color: primaryColor,
            letterSpacing: '1px', fontWeight: primaryWeight,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{primaryLabel}</div>
          {secondaryText && (
            <div style={{
              fontSize: '9px', color: 'var(--brand-on-sidebar-muted)',
              letterSpacing: '0.5px', marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{secondaryText}</div>
          )}
        </div>
      </div>
    </>
  )

  return (
    <main style={{ minHeight: '100vh', background: 'var(--brand-page-bg)', display: 'flex' }}>
      <style>{`
        .ds-sidebar-desktop {
          width: 260px; height: 100vh; position: sticky; top: 0;
          background: var(--brand-sidebar-bg); border-right: 1px solid var(--brand-sidebar-active-bg);
          display: flex; flex-direction: column; padding: 20px 0;
          flex-shrink: 0; overflow: hidden;
        }
        .ds-mobile-topbar { display: none; }
        .ds-sidebar-mobile { display: none; }
        .ds-mobile-overlay { display: none; }
        .ds-profile-row:hover { background: color-mix(in srgb, var(--brand-primary) 6%, transparent); }

        @media (max-width: 768px) {
          .ds-sidebar-desktop { display: none; }
          .ds-mobile-topbar {
            display: flex; position: sticky; top: 0; left: 0; right: 0; z-index: 40;
            align-items: center; justify-content: space-between;
            padding-top: max(12px, env(safe-area-inset-top, 12px));
            padding-bottom: 12px;
            padding-left: max(16px, env(safe-area-inset-left, 16px));
            padding-right: max(16px, env(safe-area-inset-right, 16px));
            background: var(--brand-header-bg); border-bottom: 1px solid var(--brand-sidebar-active-bg);
          }
          .ds-sidebar-mobile {
            display: flex; position: fixed; top: 0; left: 0; bottom: 0;
            width: 280px; max-width: 85vw;
            background: var(--brand-sidebar-bg); border-right: 1px solid var(--brand-sidebar-active-bg);
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
              width: 40, height: 40, border: '1px solid var(--brand-sidebar-active-bg)',
              background: 'var(--brand-header-bg)', borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, cursor: 'pointer', padding: 0,
              flexShrink: 0,
            }}
          >
            <span style={{ width: 18, height: 2, background: 'var(--brand-on-header)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--brand-on-header)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--brand-on-header)', borderRadius: 1 }} />
          </button>

          <Link href={logoHref} style={{
            display: 'flex',
            alignItems: 'center',
            gap: tenantLogoUrl ? 0 : 8,
            textDecoration: 'none',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
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