'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useBranding } from '@/components/ThemeProvider'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'
















export default function BillingSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const branding = useBranding()

  const isWl = searchParams.get('plan') === 'wl'
  const teamMemberId = searchParams.get('teamMemberId')
  const amountParam = searchParams.get('amount')

  // ── EVERYONE LANDS WHERE EVERYONE ELSE LANDS ──────────────────────────
  // A seat purchase used to end at the dialer, on the reasoning that somebody
  // who just bought a seat wants to dial. But every other route into the
  // product ends at /dashboard, which resolves to analytics for an agent and
  // the desktop for an admin — so a seat buyer was the one person dropped
  // somewhere different, with no sense of where they actually are.
  //
  // /dashboard rather than /dashboard/analytics on purpose: it is the one
  // place that already knows an admin belongs somewhere else, and hardcoding
  // the analytics path here would send an admin to the wrong screen.
  const destination = teamMemberId
    ? '/dashboard'
    : isWl ? '/onboarding/whitelabel' : '/dashboard'

  const price = amountParam
    ? `$${(parseInt(amountParam, 10) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : isWl ? '$75.00' : '$35.00'

  const [countdown, setCountdown] = useState(3)

  // ── ASK THE SERVER TO RE-READ STRIPE BEFORE WE SEND THEM ON ────────────
  // Entitlement requires an active subscription with a confirmed card,
  // and that confirmation reaches us by webhook, which has no deadline. The
  // three-second countdown below is otherwise a race: land on /dashboard
  // before the webhook and the proxy sees `incomplete` and bounces them back
  // to billing, which looks exactly like a declined card.
  //
  // Fire-and-forget on purpose. If it fails the webhook still arrives and the
  // countdown still runs — this only ever makes access appear sooner, so
  // there is nothing here worth blocking the redirect on.
  useEffect(() => {
    fetch('/api/stripe/sync', { method: 'POST' }).catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          router.push(destination)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router, destination])

  const brandName = branding?.brand_name?.toUpperCase() || null
  const logoUrl = branding?.logo_url || null

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {logoUrl && (
          <div style={{ marginBottom: 24 }}>
            <span style={{
              position: 'relative',
              display: 'inline-block',
              width: 200,
              height: 58,
            }}>
              <Image
                src={logoUrl}
                alt={brandName || 'Brand'}
                fill
                sizes="200px"
                style={{ objectFit: 'contain' }}
                priority
                unoptimized
              />
            </span>
          </div>
        )}

        <div style={iconStyle}>✓</div>

        <div style={titleStyle}>SUBSCRIPTION ACTIVE</div>

        <div style={subtitleStyle}>
          {isWl ? (
            <>
              Your Manager+ subscription is live.<br />
              You&apos;ll be charged <strong style={{ color: '#e0e2ea' }}>{price}/week</strong> weekly from today.
              <br /><br />
              Next: set up your tenant: subdomain, logo, and brand colors.
            </>
          ) : (
            <>
              Your subscription is live.<br />
              You&apos;ll be charged <strong style={{ color: '#e0e2ea' }}>{price}/week</strong> weekly from today.
              Cancel anytime in Settings.
            </>
          )}
        </div>

        <div style={countdownStyle}>
          Redirecting to {teamMemberId ? 'the dialer' : isWl ? 'tenant setup' : 'dashboard'} in {countdown}…
        </div>

        <button
          onClick={() => router.push(destination)}
          style={buttonStyle}
        >
          ▶ {isWl ? 'CONTINUE TO SETUP' : 'GO TO DASHBOARD'}
        </button>
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0d0e14',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  fontFamily: FUTURA,
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 440,
  background: '#1a1c24',
  border: '1px solid #2a2c34',
  borderTop: '3px solid #1a6a1a',
  borderRadius: 4,
  padding: 40,
  color: '#e0e2ea',
  textAlign: 'center',
}

const iconStyle: React.CSSProperties = {
  fontSize: 48,
  color: '#32ff7e',
  marginBottom: 16,
  textShadow: '0 0 20px #32ff7e',
}

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 5,
  color: '#32ff7e',
  marginBottom: 16,
  fontFamily: FUTURA,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.7,
  color: '#c0c2ca',
  marginBottom: 24,
}

const countdownStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  color: '#888a92',
  marginBottom: 20,
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  background: '#0d0e14',
  border: 'none',
  borderTop: '3px solid #4a9eff',
  borderRadius: 4,
  color: '#4a9eff',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 4,
  cursor: 'pointer',
  fontFamily: FUTURA,
}