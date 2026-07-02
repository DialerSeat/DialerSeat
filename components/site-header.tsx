'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, UserButton } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  darker: '#0a0a14',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
}











































const SUPPRESS_HEADER_PREFIXES = [
  '/dashboard/admin/desktop',
]




const LEFT_LOGO_PREFIXES = [
  '/faq',
  '/vs',
  '/terms',
  '/privacy',
  '/dialing-modes',
]

function shouldSuppressHeader(pathname: string | null): boolean {
  if (!pathname) return false
  return SUPPRESS_HEADER_PREFIXES.some((p) => pathname.startsWith(p))
}

function shouldUseLeftLogo(pathname: string | null): boolean {
  if (!pathname) return false
  return LEFT_LOGO_PREFIXES.some((p) => pathname.startsWith(p))
}




function BrandMark({
  brandName,
  brandPrimary,
  pathname,
  isLoaded,
  isSignedIn,
}: {
  brandName: string
  brandPrimary: string
  pathname: string | null
  isLoaded: boolean
  isSignedIn: boolean | undefined
}) {
  return (
    <Link
      href={
        !isLoaded || !isSignedIn
          ? '/'
          : (pathname?.startsWith('/dashboard') ? '/dashboard' : '/?view=landing')
      }
      className="site-header-brand"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textDecoration: 'none',
      }}
    >
      <div
        className="site-header-brand-mark"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
          D
        </span>
      </div>
      <span
        className="site-header-brand-text"
        style={{
          fontSize: 13,
          fontWeight: 'bold',
          letterSpacing: 4,
          color: brandPrimary,
        }}
      >
        {brandName}
      </span>
    </Link>
  )
}

export default function SiteHeader({ tenantSlug = null }: { tenantSlug?: string | null } = {}) {
  const pathname = usePathname()
  const suppressed = shouldSuppressHeader(pathname)

  const { isSignedIn, isLoaded, user } = useUser()
  const [isAdmin, setIsAdmin] = useState(false)

  
  const brandName = 'DIALERSEAT'
  const brandLogoUrl = null
  const brandPrimary = T.blue

  
  
  const useLeftLogo = isLoaded && !isSignedIn && shouldUseLeftLogo(pathname)

  const userButtonRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return
    if (suppressed) return

    let cancelled = false
    const lookup = async () => {
      try {
        
        
        
        const res = await fetch('/api/users/me')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.is_admin) setIsAdmin(true)
      } catch {
        
      }
    }
    lookup()
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user?.id, suppressed])

  if (suppressed) return null

  const dashboardPath = isAdmin ? '/dashboard/admin/desktop' : '/dashboard/analytics'
  
  
  
  const dashboardHref = tenantSlug ? `https://${tenantSlug}.dialerseat.com${dashboardPath}` : dashboardPath

  const displayName = (() => {
    if (!user) return ''
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    if (fullName) return fullName
    const email = user.primaryEmailAddress?.emailAddress || ''
    return email.split('@')[0] || ''
  })()

  const openUserMenu = () => {
    const root = userButtonRef.current
    if (!root) return
    const trigger =
      (root.querySelector('.cl-userButtonTrigger') as HTMLButtonElement | null) ||
      (root.querySelector('button') as HTMLButtonElement | null)
    if (trigger) trigger.click()
  }

  return (
    <header
      className="site-header"
      style={{
        background: T.darker,
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        paddingBottom: 12,
        paddingLeft: 'max(24px, env(safe-area-inset-left, 24px))',
        paddingRight: 'max(24px, env(safe-area-inset-right, 24px))',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        className="site-header-grid"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div className="site-header-left" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isLoaded && isSignedIn && (
            <Link
              href={dashboardHref}
              className="site-header-dashboard-btn"
              style={{
                fontSize: 10,
                letterSpacing: 2.5,
                color: brandPrimary,
                textDecoration: 'none',
                fontWeight: 'bold',
                padding: '8px 14px',
                borderRadius: 4,
                border: `1px solid ${brandPrimary}`,
                background: 'rgba(74,158,255,0.06)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(74,158,255,0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(74,158,255,0.06)'
              }}
            >
              <span className="site-header-dashboard-btn-full">← DASHBOARD</span>
              <span className="site-header-dashboard-btn-short" aria-hidden>←</span>
            </Link>
          )}

          {useLeftLogo && (
            <BrandMark
              brandName={brandName}
              brandPrimary={brandPrimary}
              pathname={pathname}
              isLoaded={isLoaded}
              isSignedIn={isSignedIn}
            />
          )}
        </div>

        {!useLeftLogo && (
          <BrandMark
            brandName={brandName}
            brandPrimary={brandPrimary}
            pathname={pathname}
            isLoaded={isLoaded}
            isSignedIn={isSignedIn}
          />
        )}
        {useLeftLogo && <div aria-hidden />}

        <div
          className="site-header-right"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {isLoaded && isSignedIn ? (
            <div
              className="site-header-user-wrap"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div ref={userButtonRef} style={{ display: 'flex', alignItems: 'center' }}>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: {
                        width: 32,
                        height: 32,
                      },
                      userButtonPopoverCard: {
                        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                        border: `1px solid ${T.border}`,
                      },
                    },
                  }}
                />
              </div>
              {displayName && (
                <button
                  type="button"
                  onClick={openUserMenu}
                  className="site-header-username"
                  aria-label="Open account menu"
                  style={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#c4c8d8',
                    letterSpacing: 1.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 180,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {displayName}
                </button>
              )}
            </div>
          ) : isLoaded && !isSignedIn ? (
            <>
              <Link
                href="/sign-in"
                className="site-header-auth-link"
                style={{
                  fontSize: 10,
                  letterSpacing: 2.5,
                  color: '#8888aa',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  padding: '6px 10px',
                  whiteSpace: 'nowrap',
                }}
              >
                LOG IN
              </Link>
              <Link
                href="/sign-up"
                className="site-header-auth-btn"
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 'bold',
                  letterSpacing: 2.5,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                SIGN UP
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <style>{`
        .site-header-dashboard-btn-short { display: none; }
        .site-header-dashboard-btn-full { display: inline; }

        @media (max-width: 768px) {
          .site-header-grid {
            gap: 8px !important;
          }
          .site-header-brand-mark {
            width: 24px !important;
            height: 24px !important;
            border-radius: 5px !important;
          }
          .site-header-brand-text {
            font-size: 11px !important;
            letter-spacing: 3px !important;
          }
          .site-header-dashboard-btn {
            font-size: 9px !important;
            padding: 6px 10px !important;
            letter-spacing: 2px !important;
          }
          .site-header-dashboard-btn-full { display: none !important; }
          .site-header-dashboard-btn-short { display: inline !important; font-size: 14px; letter-spacing: 0; }
          .site-header-username {
            display: none !important;
          }
          .site-header-auth-link {
            font-size: 9px !important;
            padding: 4px 6px !important;
            letter-spacing: 2px !important;
          }
          .site-header-auth-btn {
            padding: 6px 12px !important;
            font-size: 9px !important;
            letter-spacing: 2px !important;
          }
        }

        @media (max-width: 380px) {
          .site-header-brand-text {
            font-size: 10px !important;
            letter-spacing: 2px !important;
          }
          .site-header-dashboard-btn {
            font-size: 11px !important;
            padding: 5px 8px !important;
          }
        }
      `}</style>
    </header>
  )
}