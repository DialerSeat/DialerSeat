'use client'

import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useBranding } from '@/components/ThemeProvider'

// =============================================================================
// /sign-in — branded sign-in (v27 — co-branding mark + optional partner link)
// =============================================================================
// v27 changes vs v26:
//   - When a tenant brand is active (logoUrl present), the tagline line is
//     replaced by an on-dark co-branding mark: "<Brand> × DialerSeat",
//     plus the tenant's optional login link (label + clickable text + url) read
//     from useBranding(). Default DialerSeat (no tenant) keeps the original
//     "WELCOME BACK" tagline and DIALERSEAT wordmark — no mark shown there, since
//     "DialerSeat × DialerSeat" would be silly.
//   - The mark is fixed-format and non-removable per spec; the link is optional
//     and only renders when the tenant set both clickable text and a URL.
//
// v26: page bg → var(--brand-sidebar-bg); wordmark/tagline colors derived;
//      Clerk widget themed dark via appearance. (unchanged below)
// =============================================================================

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

export default function SignInPage() {
  const branding = useBranding()
  const brandName = branding?.brand_name?.toUpperCase() || 'DIALERSEAT'
  const logoUrl = branding?.logo_url || null
  const colorBackground = branding?.sidebar_color || '#111118'
  const colorPrimary = branding?.primary_color || '#4a9eff'

  // A tenant brand is "active" when we have a logo (white-label context). Only
  // then do we show the "<Brand> × DialerSeat" mark + optional partner link.
  const isTenant = !!logoUrl
  const loginLinkLabel = branding?.login_link_label || null
  const loginLinkText = branding?.login_link_text || null
  const loginLinkUrl = branding?.login_link_url || null

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
            marginBottom: '16px',
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

        {isTenant ? (
          // Co-branding mark + optional partner link. Colors come from the
          // brand vars; on the dark sign-in bg we pass explicit on-dark colors
          // so the mark reads correctly against the sidebar background.
          <div style={{ marginTop: 4 }}>
            <CoBrandOnDark
              brandName={branding?.brand_name || 'Brand'}
              linkLabel={loginLinkLabel}
              linkText={loginLinkText}
              linkUrl={loginLinkUrl}
              primary={colorPrimary}
            />
          </div>
        ) : (
          <p style={{
            fontSize: '12px',
            letterSpacing: '3px',
            color: 'var(--brand-on-sidebar-muted)',
          }}>
            WELCOME BACK
          </p>
        )}
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

// Co-branding mark + optional link, styled for the DARK sign-in background.
// (TenantLoginBrand is tuned for light tenant pages; the sign-in page is dark,
// so we render an on-dark variant here with the same structure + icon.)
function CoBrandOnDark({
  brandName,
  linkLabel,
  linkText,
  linkUrl,
  primary,
}: {
  brandName: string
  linkLabel: string | null
  linkText: string | null
  linkUrl: string | null
  primary: string
}) {
  const showLink = !!(linkText && linkText.trim() && linkUrl && linkUrl.trim())
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 12, letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase',
        fontFamily: FUTURA,
      }}>
        <span style={{ color: 'var(--brand-on-sidebar)' }}>{brandName}</span>
        <span aria-hidden style={{ color: primary, fontSize: 14, fontWeight: 400, transform: 'translateY(-1px)' }}>×</span>
        <span style={{ color: 'var(--brand-on-sidebar-muted)' }}>DialerSeat</span>
      </div>

      {showLink && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {linkLabel && linkLabel.trim() ? (
            <div style={{
              fontSize: 9, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase',
              color: 'var(--brand-on-sidebar-muted)', fontFamily: FUTURA,
            }}>{linkLabel}</div>
          ) : null}
          <a
            href={linkUrl!}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center',
              fontSize: 12, fontWeight: 700, letterSpacing: 0.4,
              color: primary, textDecoration: 'none',
              borderBottom: `1px solid ${primary}66`, paddingBottom: 1,
              fontFamily: FUTURA,
            }}
          >
            {linkText}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={primary}
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
              style={{ marginLeft: 5, flexShrink: 0, transform: 'translateY(0.5px)' }}>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}
    </div>
  )
}