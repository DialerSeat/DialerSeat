'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, UserButton } from '@clerk/nextjs'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useBranding } from '@/components/ThemeProvider'

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

export default function SiteHeader() {
  const { isSignedIn, isLoaded, user } = useUser()
  const [isAdmin, setIsAdmin] = useState(false)

  // ── WHITE-LABEL BRANDING ──────────────────────────────────────────────
  // useBranding() returns null on the standard dialerseat.com domain, so
  // every reference below has a default. White-label tenants override only
  // what they've explicitly set:
  //   - brand_name (always required for tenants)
  //   - logo_url (optional — falls back to the gradient "D" placeholder)
  //   - primary_color (used to tint the brand link color and accent border)
  const branding = useBranding()
  const brandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'
  const brandLogoUrl = branding?.logo_url || null
  const brandPrimary = branding?.primary_color || T.blue

  // We render UserButton inside a wrapper. To make the username text "open
  // the dropdown" when clicked, we forward a click to the avatar element
  // inside the wrapper. Clerk doesn't expose a programmatic open, so this
  // synthetic-click approach is the standard workaround. Works across
  // Clerk v6+ because UserButton always renders a clickable .cl-userButtonTrigger.
  const userButtonRef = useRef<HTMLDivElement | null>(null)

  // Look up admin status to pick the right DASHBOARD destination
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return

    let cancelled = false
    const lookup = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          // Anon key is fine here — RLS on users table should allow self-lookup.
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        )
        const { data } = await supabase
          .from('users')
          .select('is_admin')
          .eq('clerk_id', user.id)
          .maybeSingle()
        if (!cancelled && data?.is_admin) setIsAdmin(true)
      } catch {
        // Silently default to non-admin on lookup failure
      }
    }
    lookup()
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user?.id])

  const dashboardHref = isAdmin ? '/dashboard/admin/analytics' : '/dashboard/analytics'

  // Build display name for the signed-in user.
  // Prefer first + last name; fall back to email username; fall back to empty.
  const displayName = (() => {
    if (!user) return ''
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    if (fullName) return fullName
    const email = user.primaryEmailAddress?.emailAddress || ''
    return email.split('@')[0] || ''
  })()

  // Click handler for the username text. Finds the Clerk avatar button inside
  // our wrapper and synthetically clicks it to open the popover. If the avatar
  // isn't there yet (Clerk still loading), the click is a no-op.
  const openUserMenu = () => {
    const root = userButtonRef.current
    if (!root) return
    // Clerk's UserButton renders a button with class .cl-userButtonTrigger
    // in modern versions. We also fall back to any button inside the wrapper.
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
        borderBottom: `1px solid ${T.border}`,
        padding: '12px 24px',
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
        {/*
          LEFT: DASHBOARD button (signed in only).
          Arrow points LEFT (←) because clicking this sends the user back to
          the dashboard they came from — they're currently on a marketing page.
        */}
        <div className="site-header-left" style={{ display: 'flex', alignItems: 'center' }}>
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
        </div>

        {/* CENTER: brand mark + brand name. Both come from useBranding()
            on white-label subdomains, fall back to the gradient "D" logo
            and "DIALERSEAT" text on the main domain. */}
        <Link
          href="/"
          className="site-header-brand"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          {brandLogoUrl ? (
            // Tenant uploaded a logo — render it as an image at the same
            // dimensions as the default gradient mark
            <span
              className="site-header-brand-mark"
              style={{
                position: 'relative',
                width: 28,
                height: 28,
                borderRadius: 6,
                overflow: 'hidden',
                flexShrink: 0,
                background: T.darker,
              }}
            >
              <Image
                src={brandLogoUrl}
                alt={brandName}
                fill
                sizes="28px"
                style={{ objectFit: 'cover' }}
                priority
                unoptimized
              />
            </span>
          ) : (
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
          )}
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

        {/* RIGHT: avatar + name when signed in, auth links when not */}
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
        /* Default (desktop): show full "← DASHBOARD" text, hide the short arrow-only version */
        .site-header-dashboard-btn-short { display: none; }
        .site-header-dashboard-btn-full { display: inline; }

        /* ──────────────────────────────────────────────────────────────── */
        /* TABLET / NARROW LAPTOP (≤ 768px)                                 */
        /* ──────────────────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .site-header {
            padding: 10px 14px !important;
          }
          /* Reduce side gutters so brand stays visually centered */
          .site-header-grid {
            gap: 8px !important;
          }
          /* Brand mark shrinks slightly */
          .site-header-brand-mark {
            width: 24px !important;
            height: 24px !important;
            border-radius: 5px !important;
          }
          .site-header-brand-text {
            font-size: 11px !important;
            letter-spacing: 3px !important;
          }
          /* DASHBOARD button shrinks; show short ← version */
          .site-header-dashboard-btn {
            font-size: 9px !important;
            padding: 6px 10px !important;
            letter-spacing: 2px !important;
          }
          .site-header-dashboard-btn-full { display: none !important; }
          .site-header-dashboard-btn-short { display: inline !important; font-size: 14px; letter-spacing: 0; }
          /* Username gets hidden on mobile to keep header clean — avatar still opens menu */
          .site-header-username {
            display: none !important;
          }
          /* Auth links shrink */
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

        /* ──────────────────────────────────────────────────────────────── */
        /* SMALL PHONE (≤ 380px)                                            */
        /* ──────────────────────────────────────────────────────────────── */
        /* iPhone SE and tiny Android phones — be aggressive about size.    */
        @media (max-width: 380px) {
          .site-header {
            padding: 8px 10px !important;
          }
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