'use client'

// =============================================================================
// DialingModeCTA — auth-aware bottom CTA for /dialing-modes/* deep-dive pages
// =============================================================================
// The 4 deep-dive pages (preview/power/progressive/predictive) are server
// components with metadata exports, but their bottom CTA needs to differ
// for signed-in vs signed-out visitors. Importing this client component
// keeps the rest of each page server-rendered.
//
// Behavior:
//   • Mode-specific `headline` and `description` are passed in by the page,
//     so each mode keeps its own marketing copy.
//   • Signed-out: "START DIALING →" → /sign-up (Clerk handles onboarding)
//   • Signed-in:  "OPEN DIALER  →" → /dashboard/dialer (jump straight in)
//   • Secondary "ALL MODES" link → /dialing-modes for both states.
//
// Before Clerk loads, render the signed-out variant to avoid a flicker
// where a signed-in user briefly sees the wrong button.
// =============================================================================

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import type { CSSProperties } from 'react'

interface Props {
  headline: string
  description: string
}

export default function DialingModeCTA({ headline, description }: Props) {
  const { isLoaded, isSignedIn } = useUser()
  const showSignedIn = isLoaded && isSignedIn

  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>{headline}</h2>
      <p style={pStyle}>{description}</p>
      <div style={btnRowStyle}>
        {showSignedIn ? (
          <Link href="/dashboard/dialer" style={primaryBtnStyle}>
            OPEN DIALER →
          </Link>
        ) : (
          <Link href="/sign-up" style={primaryBtnStyle}>
            START DIALING →
          </Link>
        )}
        <Link href="/dialing-modes" style={secondaryBtnStyle}>
          ALL MODES
        </Link>
      </div>
    </section>
  )
}

const sectionStyle: CSSProperties = {
  background: 'white',
  padding: '72px 32px',
  textAlign: 'center',
  fontFamily: '"Futura PT", Futura, sans-serif',
}

const h2Style: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: '-0.4px',
  margin: '0 0 14px 0',
  color: '#1a1c24',
}

const pStyle: CSSProperties = {
  fontSize: 16,
  color: '#5a5e6a',
  maxWidth: 540,
  margin: '0 auto 28px',
  lineHeight: 1.7,
}

const btnRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'center',
  flexWrap: 'wrap',
}

const primaryBtnStyle: CSSProperties = {
  padding: '14px 28px',
  background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
  color: 'white',
  fontSize: 12,
  letterSpacing: '2.5px',
  fontWeight: 'bold',
  borderRadius: 8,
  textDecoration: 'none',
}

const secondaryBtnStyle: CSSProperties = {
  padding: '14px 28px',
  background: 'transparent',
  color: '#1a1c24',
  border: '1px solid #c4c8d0',
  fontSize: 12,
  letterSpacing: '2.5px',
  fontWeight: 'bold',
  borderRadius: 8,
  textDecoration: 'none',
}