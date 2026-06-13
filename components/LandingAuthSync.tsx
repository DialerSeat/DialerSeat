'use client'
import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'

// =============================================================================
// LANDING AUTH SYNC — heals the stale-header-after-logout race
// =============================================================================
// The landing page decides its header on the SERVER from await auth(). After
// a client-side sign-out that soft-navigates back to dialerseat.com, the
// browser can keep the previously-rendered (logged-in-shaped) tree until a
// manual refresh — the server was never re-hit.
//
// This component runs on the client and compares Clerk's LIVE auth state to
// what the server assumed when it rendered (passed in as serverThoughtLoggedIn).
// If the server rendered the logged-IN layout but Clerk now reports SIGNED
// OUT (and Clerk has finished loading), that's exactly the stale state — we
// do ONE hard reload so the server re-runs auth() and paints the correct
// logged-out chrome. A ref guard prevents reload loops.
//
// It renders nothing.
// =============================================================================

export default function LandingAuthSync({
  serverThoughtLoggedIn,
}: {
  serverThoughtLoggedIn: boolean
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const reloadedRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || reloadedRef.current) return

    // Stale logout: server painted the logged-in layout, client is now
    // signed out. Hard-reload once to re-render with correct auth state.
    if (serverThoughtLoggedIn && !isSignedIn) {
      reloadedRef.current = true
      window.location.reload()
      return
    }

    // Inverse staleness (signed in on the client but server painted
    // logged-out) — same one-time heal, e.g. after a soft nav from sign-in.
    if (!serverThoughtLoggedIn && isSignedIn) {
      reloadedRef.current = true
      window.location.reload()
    }
  }, [isLoaded, isSignedIn, serverThoughtLoggedIn])

  return null
}