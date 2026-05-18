'use client'
import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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

  // Look up admin status to pick the right HOME destination
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return

    let cancelled = false
    const lookup = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          // Anon key is fine here — RLS on users table should allow self-lookup.
          // If you don't expose anon key client-side, drop this whole block
          // and hard-code HOME to /dashboard/analytics.
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

  const homeHref = isAdmin ? '/dashboard/admin/analytics' : '/dashboard/analytics'

  return (
    <header
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
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* LEFT: HOME button (signed in only) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {isLoaded && isSignedIn && (
            <Link
              href={homeHref}
              style={{
                fontSize: 10,
                letterSpacing: 2.5,
                color: '#8888aa',
                textDecoration: 'none',
                fontWeight: 'bold',
                padding: '6px 10px',
                borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = T.blue
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#8888aa'
              }}
            >
              ← HOME
            </Link>
          )}
        </div>

        {/* CENTER: brand */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          <div
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
            style={{
              fontSize: 13,
              fontWeight: 'bold',
              letterSpacing: 4,
              color: T.blue,
            }}
          >
            DIALERSEAT
          </span>
        </Link>

        {/* RIGHT: UserButton (Clerk dropdown) when signed in, auth links when not */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {isLoaded && isSignedIn ? (
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
          ) : isLoaded && !isSignedIn ? (
            <>
              <Link
                href="/sign-in"
                style={{
                  fontSize: 10,
                  letterSpacing: 2.5,
                  color: '#8888aa',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  padding: '6px 10px',
                }}
              >
                LOG IN
              </Link>
              <Link
                href="/sign-up"
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 'bold',
                  letterSpacing: 2.5,
                  textDecoration: 'none',
                }}
              >
                SIGN UP
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  )
}