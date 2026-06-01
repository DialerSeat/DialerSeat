'use client'

import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useBranding } from '@/components/ThemeProvider'

// =============================================================================
// /sign-in — branded login (v23, Phase C)
// =============================================================================
// Reads useBranding() so the sign-in page reflects the tenant when
// accessed via a tenant subdomain. On dialerseat.com (no branding), the
// page renders exactly as it did in v22.
//
// What changes when branding is active:
//   - The "D" gradient mark + "DIALERSEAT" wordmark are replaced by the
//     tenant logo at 256×74.
//   - The "WELCOME BACK" tagline becomes "WELCOME TO {BRAND_NAME}".
//   - The hardcoded #4a9eff gradient on the default mark isn't rendered.
//
// v25 polish: the logo is now a Link to `/`. Relative href means tenants
// land on their own subdomain root; default DialerSeat users land on the
// marketing site. Hover opacity gives the visual affordance.
// =============================================================================

export default function SignInPage() {
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
      <style>{`
        .auth-logo-link {
          transition: opacity 0.15s ease;
        }
        .auth-logo-link:hover {
          opacity: 0.75;
        }
      `}</style>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <Link
          href="/"
          aria-label={`${brandName} — return to home`}
          className="auth-logo-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: logoUrl ? 0 : '12px',
            marginBottom: '12px',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
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
        </Link>
        <p style={{ fontSize: '12px', letterSpacing: '3px', color: 'var(--text-secondary)' }}>
          {logoUrl ? `WELCOME TO ${brandName}` : 'WELCOME BACK'}
        </p>
      </div>
      <SignIn />
    </main>
  )
}