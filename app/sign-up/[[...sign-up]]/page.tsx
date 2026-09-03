'use client'

import { SignUp } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { useBranding } from '@/components/ThemeProvider'


































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
          aria-label={`${brandName}, return to home`}
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
      {/* ── EVERY SIGN-UP GOES THROUGH THE ROUTER. NO EXCEPTIONS. ───────
          This was fallbackRedirectUrl for four days and it cost us /welcome.

          The history is worth keeping straight, because the reasoning was
          sound at each step and the end state still came out wrong:

            1. forceRedirectUrl (original). Clerk's OVERRIDE — it wins over
               ?redirect_url. /join/CODE sent an invited agent here to sign
               up and the return trip was discarded, so the code never
               reached /api/teams/redeem.
            2. fallbackRedirectUrl (8b463cb2). YIELDS to ?redirect_url, so
               the join code survived sign-up. It also meant post-signin —
               the only thing that routes anyone to /welcome — was skipped
               for anybody carrying a redirect_url, including whatever
               Clerk's own hosted flow appends.
            3. The cookie (615c176b, the very next day). ?redirect_url was
               found not to survive the hosted portal either, so the code
               moved to ds_join_code, set before the user ever leaves for
               Clerk. See the header of /api/join/start.

          Step 3 replaced step 2's mechanism but not step 2's edit, so this
          prop kept standing aside for a query parameter nothing depends on
          any more — and took the showcase down with it.

          Safe to force now precisely BECAUSE of the cookie: post-signin and
          /welcome both read it, and /welcome hands it to billing, which
          redeems it. That is the flow the cookie was written for — its own
          comment says "/welcome reads it on the server and puts it in the
          URL it hands to billing."

          Sign-in deliberately still uses fallbackRedirectUrl: an existing
          user can be deep-linked to a real page, and that destination is
          worth keeping. A brand-new account has no such destination. */}
      <SignUp
        forceRedirectUrl="/api/auth/post-signin"
        appearance={{
          variables: {
            colorPrimary,
            colorBackground,
            colorText: '#ffffff',
            colorTextSecondary: '#8888aa',
            // Clerk derives a lot of small print — the password rules, field
            // hints, character counters — from colorNeutral by mixing it with
            // the background at low alpha. The default neutral is BLACK, which
            // on this dark card produced grey-on-near-black: present, legible
            // to nobody. White neutral makes every derived shade lighter than
            // the card instead of darker, which is the whole trick to a dark
            // Clerk theme and is not obvious from the element list.
            colorNeutral: '#ffffff',
            colorSuccess: '#4ade80',
            colorDanger: '#f87171',
            colorWarning: '#fbbf24',
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
            // The password requirement checklist and its siblings. Named
            // explicitly as well as covered by colorNeutral, because these are
            // the lines somebody reads while they are stuck — the moment where
            // unreadable small print costs a signup.
            formFieldHintText: {
              color: '#b9bbd4',
              fontFamily: FUTURA,
            },
            formFieldInfoText: {
              color: '#b9bbd4',
              fontFamily: FUTURA,
            },
            formFieldSuccessText: {
              color: '#4ade80',
              fontFamily: FUTURA,
            },
            formFieldWarningText: {
              color: '#fbbf24',
              fontFamily: FUTURA,
            },
            formFieldErrorText: {
              color: '#f87171',
              fontFamily: FUTURA,
            },
            formFieldAction: {
              color: 'var(--brand-primary)',
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