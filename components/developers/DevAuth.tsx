'use client'

import { SignIn, SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { DevLink, useDevBase, useMainSiteUrl } from './base'
import { DevLogo } from './ui'
import type { DevTheme } from './theme'

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
    card: { background: '#0f0f1a', border: '1px solid #23233b', boxShadow: 'none' },
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

// Sign-in and sign-up are dark unless the visitor switches them, whatever the
// console is set to. Their own key, so switching here never changes the console.
const AUTH_KEY = 'dv-auth-theme'
const AUTH_EVENT = 'dv-auth-theme'
function authTheme(): DevTheme {
  try { return localStorage.getItem(AUTH_KEY) === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}
function useAuthTheme(): DevTheme {
  return useSyncExternalStore(
    cb => { window.addEventListener(AUTH_EVENT, cb); return () => window.removeEventListener(AUTH_EVENT, cb) },
    authTheme,
    () => 'dark',
  )
}
function AuthThemeToggle() {
  const t = useAuthTheme()
  const next: DevTheme = t === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" className="dv-btn dv-btn-ghost" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      style={{ width: 36, padding: 0, color: 'var(--dv-muted)' }}
      onClick={() => { try { localStorage.setItem(AUTH_KEY, next) } catch { /* this visit only */ } window.dispatchEvent(new Event(AUTH_EVENT)) }}>
      {t === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

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
  const theme = useAuthTheme()
  return (
    <main className="dv-app dv-auth" data-theme={theme} suppressHydrationWarning style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 64px', background: 'var(--dv-bg)' }}>
      <style>{`html:has(.dv-auth[data-theme="dark"]), html:has(.dv-auth[data-theme="dark"]) body { background: #07070d; }`}</style>
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 'clamp(24px, 6vw, 48px)' }}>
        <DevLink href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, minWidth: 0 }}><DevLogo /></DevLink>
        <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}><AuthThemeToggle /><a href={main} className="dv-btn dv-btn-ghost dv-btn-sm" style={{ flexShrink: 0 }} aria-label="Back to dialerseat.com"><ArrowLeft size={14} /><span className="dv-auth-back"> dialerseat.com</span></a></span>
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
  const appearance = appearanceFor(useAuthTheme())
  const returnTo = useReturnTo()
  return (
    <Frame mode="in">
      <SignIn routing="path" path={`${base}/sign-in`} signUpUrl={`${base}/sign-up`} forceRedirectUrl={returnTo} signUpForceRedirectUrl={`${base}/welcome`} appearance={appearance} />
    </Frame>
  )
}

export function DevSignUp() {
  const base = useDevBase()
  const appearance = appearanceFor(useAuthTheme())
  return (
    <Frame mode="up">
      <SignUp routing="path" path={`${base}/sign-up`} signInUrl={`${base}/sign-in`} forceRedirectUrl={`${base}/welcome`} signInForceRedirectUrl={`${base}/welcome`} appearance={appearance} />
    </Frame>
  )
}
