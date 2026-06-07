'use client'

import { SignUp } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useBranding } from '@/components/ThemeProvider'

// =============================================================================
// /sign-up — branded sign-up (v24 — restore dark mode, mirror of sign-in)
// =============================================================================
// v24 changes vs v23:
//   - Page background: var(--background) → var(--brand-sidebar-bg)
//   - Wordmark color: var(--text-primary) → var(--brand-on-sidebar)
//   - Tagline color: var(--text-secondary) → var(--brand-on-sidebar-muted)
//   - Clerk <SignUp /> widget themed dark via appearance prop, identical
//     pattern to sign-in v26 (subtle card overlay, lifted form inputs,
//     primary button uses brand tokens).
//   - Adds forceRedirectUrl="/api/auth/post-signin" so post-signup routes
//     through the same handler as post-signin. Currently the route is
//     same-host (hotfix) so this is safe regardless of subdomain status.
//
// KNOWN ISSUE (NOT FIXED HERE):
//   JC reports the agency logo doesn't appear on the first render of
//   /sign-up — the default "DIALERSEAT WELCOME" header shows, and the
//   tenant logo only appears after clicking the browser back button.
//   This is likely a branding-load timing mismatch between Clerk's
//   internal sign-up widget routing and the SSR/CSR auth state needed by
//   getActiveTenantForUser() in the root layout. Possible causes worth
//   investigating:
//     1. Initial render of /sign-up sees no auth (cookies haven't synced)
//        → branding=null → default DialerSeat. Then Clerk completes some
//        client-side routing and the page re-renders with branding.
//     2. Clerk's sign-up widget intercepts the route and renders an
//        intermediate state before our wrapper applies.
//     3. The /sign-up route bypasses the standard root-layout branding
//        fetch entirely.
//   The wrapper code below (useBranding + conditional logo) is correct.
//   Whichever fix lands, this file shouldn't need changing.
// =============================================================================

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

export default function SignUpPage() {
  const branding = useBranding()
  const brandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'
  const logoUrl = branding?.logo_url || null
  const colorBackground = branding?.sidebar_color || '#111118'
  const colorPrimary = branding?.primary_color || '#4a9eff'

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--brand-sidebar-bg)',
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
                color: 'var(--brand-on-sidebar)',
              }}>DIALERSEAT</span>
            </>
          )}
        </Link>
        <p style={{
          fontSize: '12px',
          letterSpacing: '3px',
          color: 'var(--brand-on-sidebar-muted)',
        }}>
          {logoUrl ? `JOIN ${brandName}` : 'CREATE YOUR ACCOUNT'}
        </p>
      </div>
      <SignUp
        forceRedirectUrl="/api/auth/post-signin"
        appearance={{
          variables: {
            colorPrimary,
            colorBackground,
            colorText: '#ffffff',
            colorTextSecondary: '#8888aa',
            colorInputBackground: 'rgba(255,255,255,0.05)',
            colorInputText: '#ffffff',
            borderRadius: '4px',
            fontFamily: FUTURA,
          },
          elements: {
            card: {
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: 'none',
            },
            headerTitle: {
              color: '#ffffff',
              fontFamily: FUTURA,
              fontWeight: 700,
              letterSpacing: '1px',
            },
            headerSubtitle: {
              color: '#8888aa',
              fontFamily: FUTURA,
            },
            socialButtonsBlockButton: {
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
            },
            socialButtonsBlockButtonText: {
              color: '#ffffff',
              fontFamily: FUTURA,
            },
            dividerText: {
              color: '#8888aa',
              fontFamily: FUTURA,
            },
            dividerLine: {
              background: 'rgba(255,255,255,0.15)',
            },
            formFieldLabel: {
              color: '#ffffff',
              fontFamily: FUTURA,
              letterSpacing: '0.5px',
            },
            formFieldInput: {
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
              fontFamily: FUTURA,
            },
            formFieldInputShowPasswordButton: {
              color: '#8888aa',
            },
            formButtonPrimary: {
              background: 'var(--brand-primary)',
              color: 'var(--brand-on-primary)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontWeight: 700,
              fontFamily: FUTURA,
            },
            footerActionText: {
              color: '#8888aa',
              fontFamily: FUTURA,
            },
            footerActionLink: {
              color: 'var(--brand-primary)',
              fontFamily: FUTURA,
            },
            identityPreviewText: {
              color: '#ffffff',
              fontFamily: FUTURA,
            },
            identityPreviewEditButton: {
              color: 'var(--brand-primary)',
            },
            formResendCodeLink: {
              color: 'var(--brand-primary)',
            },
            otpCodeFieldInput: {
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
            },
            alertText: {
              color: '#ffffff',
              fontFamily: FUTURA,
            },
            footer: {
              background: 'transparent',
            },
          },
        }}
      />
    </main>
  )
}