'use client'

import { SignUp } from '@clerk/nextjs'
import Image from 'next/image'
import { useBranding } from '@/components/ThemeProvider'

// =============================================================================
// /sign-up — branded sign-up (v23, Phase D1)
// =============================================================================
// Mirror of the sign-in page. Reads useBranding() to swap the header chrome
// for the tenant logo when accessed on a subdomain. Otherwise renders the
// default DialerSeat branding exactly as before.
//
// The Clerk <SignUp /> widget itself stays default-themed. The brand
// surrounds it; the widget doesn't need to match (and shouldn't — users
// associate the Clerk UI with security/trust).
// =============================================================================

export default function SignUpPage() {
  const branding = useBranding()
  const brandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'
  const logoUrl = branding?.logo_url || null

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: logoUrl ? 0 : '12px',
          marginBottom: '12px',
        }}>
          {logoUrl ? (
            <span style={{
              position: 'relative',
              display: 'block',
              width: 256,
              height: 74,
            }}>
              <Image
                src={logoUrl}
                alt={brandName}
                fill
                sizes="256px"
                style={{ objectFit: 'contain' }}
                priority
                unoptimized
              />
            </span>
          ) : (
            <>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>D</span>
              </div>
              <span style={{
                fontSize: '18px',
                fontWeight: 'bold',
                letterSpacing: '6px',
                color: 'var(--text-primary)',
              }}>DIALERSEAT</span>
            </>
          )}
        </div>
        <p style={{ fontSize: '12px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
          {logoUrl ? `JOIN ${brandName}` : 'CREATE YOUR ACCOUNT'}
        </p>
      </div>
      <SignUp />
    </main>
  )
}