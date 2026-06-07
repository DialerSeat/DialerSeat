'use client'

import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useBranding } from '@/components/ThemeProvider'

// =============================================================================
// /sign-in — branded login (v25, smart post-signin routing)
// =============================================================================
// Same as v24 (Pass-2 token sweep + Clerk widget themed) but with
// forceRedirectUrl wired to /api/auth/post-signin. That handler decides
// which subdomain to land the user on based on tenant affiliation:
//
//   - Signed in on blank.dialerseat.com AND user is part of blank →
//     stay on blank.dialerseat.com/dashboard/analytics
//   - Signed in on blank.dialerseat.com AND user is NOT part of blank →
//     redirect to their tenant's subdomain (active_tenant_id > owned >
//     member-of)
//   - Signed in on dialerseat.com AND user is affiliated with a tenant →
//     auto-redirect to that tenant's subdomain
//   - No tenant affiliation anywhere → dialerseat.com/dashboard/analytics
//
// forceRedirectUrl takes priority over any other Clerk redirect URL (the
// dashboard's ClerkProvider default, query-string after_sign_in_url, etc).
// Every successful sign-in goes through the routing handler.
//
// Theming (unchanged from v24):
//   - Page bg / wordmark / tagline → --brand-page-bg / --brand-on-page-bg /
//     --brand-muted-text
//   - Clerk widget: variables.colorPrimary = concrete hex from branding;
//     elements.* use var() for live theme propagation across card, header,
//     inputs, primary CTA, footer links, identity preview, dividers, and
//     social buttons.
// =============================================================================

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

export default function SignInPage() {
  const branding = useBranding()
  const brandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'
  const logoUrl = branding?.logo_url || null
  // Clerk's variables.colorPrimary needs a concrete hex value (it's used
  // internally to compute hover/focus/link colors). Default to the
  // DialerSeat blue if no tenant branding is present.
  const primary = branding?.primary_color || '#4a9eff'

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--brand-page-bg)',
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
                color: 'var(--brand-on-page-bg)',
              }}>DIALERSEAT</span>
            </>
          )}
        </Link>
        <p style={{
          fontSize: '12px',
          letterSpacing: '3px',
          color: 'var(--brand-muted-text)',
        }}>
          {logoUrl ? `WELCOME TO ${brandName}` : 'WELCOME BACK'}
        </p>
      </div>
      <SignIn
        forceRedirectUrl="/api/auth/post-signin"
        appearance={{
          variables: {
            colorPrimary: primary,
            borderRadius: '4px',
            fontFamily: FUTURA,
          },
          elements: {
            card: {
              background: 'var(--brand-card-surface)',
              border: '1px solid var(--brand-card-border)',
              boxShadow: 'none',
            },
            headerTitle: {
              color: 'var(--brand-on-page-bg)',
              fontFamily: FUTURA,
            },
            headerSubtitle: {
              color: 'var(--brand-muted-text)',
              fontFamily: FUTURA,
            },
            socialButtonsBlockButton: {
              background: 'var(--brand-page-bg)',
              border: '1px solid var(--brand-card-border)',
              color: 'var(--brand-on-page-bg)',
            },
            socialButtonsBlockButtonText: {
              color: 'var(--brand-on-page-bg)',
            },
            dividerText: {
              color: 'var(--brand-muted-text)',
            },
            dividerLine: {
              background: 'var(--brand-card-border)',
            },
            formFieldLabel: {
              color: 'var(--brand-on-page-bg)',
              fontFamily: FUTURA,
              letterSpacing: '0.5px',
            },
            formFieldInput: {
              background: 'var(--brand-page-bg)',
              border: '1px solid var(--brand-card-border)',
              color: 'var(--brand-on-page-bg)',
            },
            formFieldInputShowPasswordButton: {
              color: 'var(--brand-muted-text)',
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
              color: 'var(--brand-muted-text)',
              fontFamily: FUTURA,
            },
            footerActionLink: {
              color: 'var(--brand-primary)',
              fontFamily: FUTURA,
            },
            identityPreviewText: {
              color: 'var(--brand-on-page-bg)',
              fontFamily: FUTURA,
            },
            identityPreviewEditButton: {
              color: 'var(--brand-primary)',
            },
            formResendCodeLink: {
              color: 'var(--brand-primary)',
            },
            otpCodeFieldInput: {
              background: 'var(--brand-page-bg)',
              border: '1px solid var(--brand-card-border)',
              color: 'var(--brand-on-page-bg)',
            },
            alertText: {
              color: 'var(--brand-on-page-bg)',
            },
          },
        }}
      />
    </main>
  )
}