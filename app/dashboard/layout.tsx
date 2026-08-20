'use client'
import { useUser, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useBranding } from '@/components/ThemeProvider'
import DashboardBanners from '@/components/DashboardBanners'

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

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [tier, setTier] = useState<AccessTier>(null)
  // Teams this person has been admitted to but not yet approved for. They can
  // be in the product; they cannot dial that team's campaigns yet.
  const [seatLapsed, setSeatLapsed] =
    useState<Array<{ teamId: string; teamName: string; reason: string }>>([])
  const [awaitingApproval, setAwaitingApproval] =
    useState<Array<{ teamId: string; teamName: string }>>([])
  const [plan, setPlan] = useState<Plan>(null)
  const [seats, setSeats] = useState<SubsSummary | null>(null)
  const [pendingLogo, setPendingLogo] = useState<{ publicUrl: string; dataUrl: string } | null>(null)
  const profileRowRef = useRef<HTMLDivElement | null>(null)

  // Optimistic nav highlight: the instant a nav item is tapped, it should
  // look selected — regardless of how long the destination route takes to
  // fetch/render. `pathname` only flips once the new route has actually
  // resolved, so relying on it alone means the tap looks like it did
  // nothing until content finishes loading. `pendingHref` is set
  // synchronously in the click handler and wins over `pathname` until the
  // real navigation catches up.
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  const setDrawer = (open: boolean) => {
    const d = document.getElementById('ds-menu-drawer')
    const o = document.getElementById('ds-menu-overlay')
    if (d) d.classList.toggle('open', open)
    if (o) o.classList.toggle('open', open)
    // The checkbox is what CSS reads, and it is uncontrolled so that the
    // browser can toggle it before React exists. Anything that opens or
    // closes the drawer in code — a nav tap, a route change — has to write it
    // back, or the :checked rule would hold the drawer open against everything
    // else saying it is shut.
    const t = document.getElementById('ds-drawer-toggle') as HTMLInputElement | null
    if (t && t.checked !== open) t.checked = open
    document.body.style.overflow = open ? 'hidden' : ''
  }

  const lastPathRef = useRef(pathname)
  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname
      setDrawer(false)
      setPendingHref(null)
    }
  }, [pathname])

  useEffect(() => () => { document.body.style.overflow = '' }, [])

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
          setAwaitingApproval(d.awaitingApproval || [])
          setSeatLapsed(d.seatLapsed || [])
        })
        .catch(() => {
          if (cancelled) return
          setTier(null)
          setPlan(null)
          setAwaitingApproval([])
          setSeatLapsed([])
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
    if (pendingHref !== null) return pendingHref === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const handleNavClick = (href: string) => {
    // Fires synchronously on tap — before Next.js has fetched anything for
    // the destination. Highlight moves and the mobile drawer closes right
    // now, not whenever the new route's data happens to arrive.
    setPendingHref(href)
    setDrawer(false)
    window.setTimeout(() => {
      setPendingHref(prev => (prev === href ? null : prev))
    }, 6000)
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
              prefetch={true}
              className="ds-nav-link"
              // POINTERDOWN, not click. On touch, `click` fires 100-300ms
              // after the finger lands — the browser waits to see if it is a
              // double tap or a scroll. Everything this handler does is local
              // (move the highlight, close the drawer), so there is nothing to
              // undo if the gesture turns into a scroll, and firing early is
              // the single largest perceived-latency win available here.
              //
              // Navigation itself still rides the anchor's own click, which
              // keeps middle-click, ctrl-click and long-press-open-in-new-tab
              // behaving correctly.
              // onClick, and ONLY onClick. Running this on pointerdown
              // re-renders the row mid-gesture, between press and release,
              // which loses the click on mouse and touch alike and makes a tab
              // need pressing twice.
              //
              // Nothing is lost by waiting for the click: the press feedback
              // is pure CSS (:active), so the row acknowledges the finger
              // immediately without React involved at all, and
              // touch-action: manipulation removes the delay that made
              // firing early look worth it in the first place.
              onClick={() => handleNavClick(item.href)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 18px',
                cursor: 'pointer',
                // Kills the legacy 300ms double-tap delay outright.
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
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

      {!isAdmin && (tier === 'lapsed' || seatLapsed.length > 0) && !hasAnySeat && !hasManagerPlus && (
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
          profile row) and same nav-tab styling, left-aligned like the nav
          links above it. */}
      {!isAdmin && hasManagerPlus && (
        <Link
          href="/dashboard/manager/desktop"
          style={{
            display: 'flex',
            alignItems: 'center',
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
        /* ── PRESS FEEDBACK ─────────────────────────────────────────────
           The largest remaining source of "it feels slow" is not the
           navigation — it is the gap between a finger landing and anything
           on screen acknowledging it. This paints on the compositor the
           instant the touch registers, with no JS, no React render and no
           hydration required, so it responds even while the current page is
           still loading.

           transform rather than a colour change on purpose: it is
           compositor-only, so it cannot be delayed by whatever the main
           thread happens to be busy with — which, during a page load, is
           everything. */
        /* ── PRESS FEEDBACK: COLOUR ONLY, NEVER GEOMETRY ────────────────
           A background change is instant, needs no JS or hydration, and —
           the part that matters — does not move anything.

           There WAS a scale(0.985) here. It broke tab navigation on both
           mouse and touch: shrinking the row on press pulls its edges inward,
           and the browser resolves the release against the element's CURRENT
           geometry, so the pointer-up can land outside and no click is
           generated at all. The tab then needs pressing twice.

           I first assumed a finger was immune because its contact patch is
           large. It is not — the target moves regardless of what is pressing
           it. Nothing in a press state may change layout or transform. */
        .ds-nav-link {
          transition: background 90ms ease;
        }
        .ds-nav-link:active {
          background: var(--brand-primary-soft) !important;
        }

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
          /* ── THE DRAWER OPENS WITHOUT JAVASCRIPT ────────────────────────
             A React onClick does not exist until hydration finishes, so the
             hamburger was genuinely INERT while a page loaded — not slow,
             not laggy, attached to nothing. Hence three taps.

             The hamburger is now a <label> for a hidden checkbox, and these
             two rules open the drawer from the checkbox state alone. That is
             the browser's own behaviour, live the instant the HTML paints,
             with no bundle, no hydration and no React involved.

             The .open class stays alongside it so React remains in charge
             once it has booted; the two are kept in agreement by an effect
             that writes the checkbox from state. */
          .ds-drawer-checkbox:checked ~ .ds-sidebar-mobile { transform: translateX(0); }
          .ds-drawer-checkbox:checked ~ .ds-mobile-overlay { opacity: 1; pointer-events: auto; }
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

      {/* Hidden, and deliberately the FIRST of the three siblings — the CSS
          rules above reach the drawer and overlay through `~`, which only
          looks forward. Uncontrolled on purpose: the browser must be free to
          toggle it before React exists. */}
      <input
        type="checkbox"
        id="ds-drawer-toggle"
        className="ds-drawer-checkbox"
        defaultChecked={false}
        onChange={e => setDrawer(e.target.checked)}
        aria-label="Open menu"
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />

      {/* A label, not a div with onClick, so tapping away closes the drawer
          pre-hydration too. */}
      <label
        id="ds-menu-overlay"
        htmlFor="ds-drawer-toggle"
        className="ds-mobile-overlay"
        aria-hidden="true"
      />

      <aside id="ds-menu-drawer" className="ds-sidebar-mobile">
        <Sidebar />
      </aside>

      <div className="ds-mobile-content" style={{ flex: 1, minWidth: 0 }}>
        <div className="ds-mobile-topbar">
          {/* A <label>, not a <button>. This is the whole fix: a label's
              association with its checkbox is browser behaviour, so it works
              the moment the HTML paints. A button's onClick does not exist
              until React hydrates, which is exactly the window in which the
              taps were being swallowed. */}
          <label
            id="ds-menu-btn"
            htmlFor="ds-drawer-toggle"
            role="button"
            aria-label="Open menu"
            aria-controls="ds-menu-drawer"
            style={{
              width: 40, height: 40, border: '1px solid var(--brand-sidebar-active-bg)',
              background: 'var(--brand-header-bg)', borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, cursor: 'pointer', padding: 0,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 'calc(-1 * max(12px, env(safe-area-inset-top, 12px)))',
                left: 'calc(-1 * max(16px, env(safe-area-inset-left, 16px)))',
                bottom: -12,
                right: -20,
              }}
            />
            <span style={{ width: 18, height: 2, background: 'var(--brand-on-header)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--brand-on-header)', borderRadius: 1 }} />
            <span style={{ width: 18, height: 2, background: 'var(--brand-on-header)', borderRadius: 1 }} />
          </label>

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

        <DashboardBanners />

        {/* ── THE SEAT STOPPED BEING PAID FOR ──────────────────────────────
            The owner suspended this seat or their card stopped covering it.
            Deliberately the plain unsubscribed message and nothing more: this
            person did nothing wrong, they are not in an error state, and the
            only thing that changed is who is paying. Their account, leads,
            recordings and dispositions are all untouched — so the message is
            about restoring dialing, not about recovering an account.
            Suppressed when they already have their own plan, because then
            there is nothing to restore. */}
        {seatLapsed.length > 0 && !hasActivePersonal && (
          <div style={{
            padding: '10px 16px', background: '#2a1a05',
            borderBottom: '1px solid #78350f', color: '#ffaa3e',
            fontSize: 13, lineHeight: 1.5,
          }}>
            {seatLapsed.map(t => t.teamName).join(', ')} is no longer paying for your seat.
            {' '}Your account and all your data are still here — subscribe on your own plan
            to keep dialing.
            <Link
              href="/billing"
              style={{ color: '#ffd96a', marginLeft: 8, textDecoration: 'underline' }}
            >
              Subscribe
            </Link>
          </div>
        )}

        {/* ── ADMITTED, NOT YET APPROVED ────────────────────────────────────
            Someone who redeemed an owner-paid invite that needs approval is
            inside DialerSeat and cannot dial that team's campaigns yet. With
            nothing said anywhere, that is indistinguishable from the product
            being broken: they were told the seat was covered, they got in, and
            nothing works.
            Amber rather than red — this is a normal step in joining a team,
            not a fault, and it clears itself when the owner accepts. */}
        {awaitingApproval.length > 0 && (
          <div style={{
            padding: '10px 16px', background: '#2a1a05',
            borderBottom: '1px solid #78350f', color: '#fbbf24',
            fontSize: 13, lineHeight: 1.5,
          }}>
            Waiting on {awaitingApproval.map(t => t.teamName).join(', ')} to approve you.
            {' '}You will be able to dial their campaigns as soon as they do — nothing
            to pay, the seat is on them.
            {/* The only person who can resolve this is whoever sent the code,
                and DialerSeat cannot chase them. Saying so turns an open-ended
                wait into a next step the person can actually take. */}
            <span style={{ display: 'block', marginTop: 4, color: '#a1731a', fontSize: 12 }}>
              If access does not arrive, contact whoever sent you the invite code —
              only they can approve it.
            </span>
          </div>
        )}
        {children}
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){if(window.__dsMenuBridge)return;window.__dsMenuBridge=1;document.addEventListener('click',function(e){var t=e.target;if(!(t&&t.closest))return;var d=document.getElementById('ds-menu-drawer');var o=document.getElementById('ds-menu-overlay');if(!d||!o)return;var close=function(){d.classList.remove('open');o.classList.remove('open');document.body.style.overflow='';};if(t.closest('#ds-menu-btn')){d.classList.add('open');o.classList.add('open');document.body.style.overflow='hidden';}else if(t.closest('#ds-menu-overlay')){close();}else{var a=t.closest('a');if(a&&d.contains(a))close();}},true);})();",
        }}
      />
    </main>
  )
}