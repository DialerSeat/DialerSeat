'use client'

import { SignIn, SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { DevLink, useDevBase, useMainSiteUrl } from './base'
import { DevLogo } from './ui'
import { ThemeToggle, useDevTheme, type DevTheme } from './theme'

// The same DialerSeat login as dialerseat.com, dressed for the developer
// site. After signing in or up, everyone lands on /welcome, which sends an
// activated developer to the console and asks everyone else what they came for.

const darkAppearance = {
  variables: {
    colorPrimary: '#4a9eff',
    colorBackground: '#0f0f1a',
    colorText: '#e9e9f3',
    colorTextSecondary: '#9a9ab8',
    // White neutral keeps Clerk's derived small print lighter than a dark
    // card instead of darker (see app/sign-in for the full story).
    colorNeutral: '#ffffff',
    colorSuccess: '#34d399',
    colorDanger: '#f87171',
    colorWarning: '#fbbf24',
    colorInputBackground: '#0b0b14',
    colorInputText: '#e9e9f3',
    borderRadius: '8px',
    fontFamily: "'Futura PT', Futura, 'Trebuchet MS', sans-serif",
  },
  elements: {
    // Fill a phone's width instead of Clerk's fixed card width.
    rootBox: { width: '100%', maxWidth: '400px' },
    cardBox: { width: '100%', maxWidth: '400px' },
    card: { background: '#0f0f1a', border: '1px solid #23233b', boxShadow: '0 30px 80px rgba(0,0,0,.45)' },
    socialButtonsBlockButton: { background: '#141424', border: '1px solid #23233b', color: '#e9e9f3' },
    footer: { background: 'transparent' },
  },
}

const lightAppearance = {
  variables: {
    ...darkAppearance.variables,
    colorBackground: '#ffffff',
    colorText: '#131316',
    colorTextSecondary: '#5e5f6b',
    colorNeutral: '#000000',
    colorInputBackground: '#ffffff',
    colorInputText: '#131316',
    colorPrimary: '#2a6eff',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif",
  },
  elements: {
    ...darkAppearance.elements,
    card: { background: '#ffffff', border: '1px solid #e2e2e5', boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 12px 32px rgba(0,0,0,.06)' },
    socialButtonsBlockButton: { background: '#ffffff', border: '1px solid #e2e2e5', color: '#131316' },
    footer: { background: 'transparent' },
  },
}

const appearanceFor = (t: DevTheme) => (t === 'dark' ? darkAppearance : lightAppearance)

/** Only a path on this site may be a return address; anything else goes to /welcome. */
function useReturnTo(): string {
  const base = useDevBase()
  const params = useSearchParams()
  const want = params.get('redirect_url') || ''
  const safe = want.startsWith('/') && !want.startsWith('//') && want.startsWith(base + '/') ? want : ''
  return safe || `${base}/welcome`
}

function Frame({ children, mode }: { children: React.ReactNode; mode: 'in' | 'up' }) {
  const main = useMainSiteUrl()
  return (
    <main className="dv-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 64px', background: 'radial-gradient(800px 360px at 50% -10%, rgba(74,158,255,.14), transparent 70%), var(--dv-bg)' }}>
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 'clamp(24px, 6vw, 48px)' }}>
        <DevLink href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, minWidth: 0 }}><DevLogo /></DevLink>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}><ThemeToggle /><a href={main} className="dv-btn dv-btn-ghost dv-btn-sm" style={{ flexShrink: 0 }} aria-label="Back to dialerseat.com"><ArrowLeft size={14} /><span className="dv-auth-back"> dialerseat.com</span></a></span>
        <style>{`@media (max-width: 420px) { .dv-auth-back { display: none; } }`}</style>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 22, maxWidth: 440 }}>
        <h1 style={{ fontSize: 'clamp(20px, 5.5vw, 24px)', margin: 0, fontWeight: 600 }}>{mode === 'in' ? 'Sign in to DialerSeat for Developers' : 'Create your developer account'}</h1>
        <p className="dv-muted" style={{ fontSize: 14, margin: '10px 0 0', lineHeight: 1.6 }}>
          {mode === 'in'
            ? 'Use your DialerSeat login. Your developer account and your dialerseat.com account stay separate.'
            : 'Free to build. Already use DialerSeat? Sign in with the same login instead.'}
        </p>
      </div>
      {children}
    </main>
  )
}

export function DevSignIn() {
  const base = useDevBase()
  const appearance = appearanceFor(useDevTheme())
  const returnTo = useReturnTo()
  return (
    <Frame mode="in">
      <SignIn routing="path" path={`${base}/sign-in`} signUpUrl={`${base}/sign-up`} forceRedirectUrl={returnTo} signUpForceRedirectUrl={`${base}/welcome`} appearance={appearance} />
    </Frame>
  )
}

export function DevSignUp() {
  const base = useDevBase()
  const appearance = appearanceFor(useDevTheme())
  return (
    <Frame mode="up">
      <SignUp routing="path" path={`${base}/sign-up`} signInUrl={`${base}/sign-in`} forceRedirectUrl={`${base}/welcome`} signInForceRedirectUrl={`${base}/welcome`} appearance={appearance} />
    </Frame>
  )
}
