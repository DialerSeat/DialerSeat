'use client'

import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useBranding } from '@/components/ThemeProvider'

// =============================================================================
// /sign-in — branded sign-in (v26 — restore dark mode)
// =============================================================================
// v26 changes vs v25:
//   - Page background: var(--background) (Pass-1 vestigial #0a0a0f) →
//     var(--brand-sidebar-bg). Default DialerSeat resolves to #111118
//     (the original dark sign-in look); tenants get their sidebar color
//     automatically — no per-tenant logic needed. JC: "easily customizable
//     like signup page... map their background to sites sidebar color."
//   - Wordmark fallback color: var(--text-primary) → var(--brand-on-sidebar)
//     (white on dark, derived for tenants).
//   - Tagline color: var(--text-secondary) → var(--brand-on-sidebar-muted)
//     (#8888aa on default, derived for tenants).
//   - Clerk <SignIn /> widget themed dark via appearance prop. Card uses a
//     subtle white-3% overlay so it lifts off the sidebar bg without
//     introducing a bright surface. Form inputs are the same lifted treatment.
//     Primary button uses var(--brand-primary) + var(--brand-on-primary).
//
// Preserved from v25:
//   - useBranding() hook for tenant logo + primary color
//   - Logo wrapper is a Link to "/"
//   - forceRedirectUrl="/api/auth/post-signin" (post-signin route v2 stays
//     on current host until subdomains are wired up)
//
// "Easily customizable" semantics:
//   - Default DialerSeat: sidebar=#111118 → sign-in bg #111118, text white,
//     muted #8888aa, primary #4a9eff. Dark-mode original look.
//   - Tenant (e.g. demo): sidebar=#3b261b (brown) → sign-in bg brown,
//     muted text derived (white at 65% alpha over brown — readable),
//     primary tenant-chosen.
// =============================================================================

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

export default function SignInPage() {
  const branding = useBranding()
  const brandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'
  const logoUrl = branding?.logo_url || null
  // Clerk's appearance.variables.colorBackground needs a concrete hex
  // (CSS vars aren't supported there). Default to #111118 and let tenant
  // sidebar override. Clerk uses this for internal contrast derivations.
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
          {logoUrl ? `WELCOME TO ${brandName}` : 'WELCOME BACK'}
        </p>
      </div>
      <SignIn
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