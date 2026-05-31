'use client'
import { useEffect, useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)

// =============================================================================
// BILLING PAGE — v23b (Phase D1 wording polish)
// =============================================================================
// Diff vs v22:
//   - PLAN_INFO.wl.label: 'WHITE LABEL' → 'MANAGER+'
//   - PLAN_INFO.wl.title: 'START YOUR WHITE LABEL TENANT' → 'CUSTOMIZE YOUR WHITELABEL DIALER'
//   - PLAN_INFO.wl.subtitle: tightened to match
//   - Plan switch button: restyled to be visible — solid blue-tinted
//     background, accent-blue text, bright border. Was a faint dashed
//     border on transparent (easy to miss).
//   - Switch button labels reference 'MANAGER+' not 'WHITE LABEL'
//
// No logic changes. Same Stripe price IDs, same env vars, same flow.
// =============================================================================

type Plan = 'standard' | 'wl'

const PLAN_INFO = {
  standard: {
    label: 'STANDARD',
    price: 35,
    title: 'START YOUR SUBSCRIPTION',
    subtitle: 'Pay $35 today and start dialing immediately.',
    weeklyBlurb: '$35.00 USD',
    description: 'Standard DialerSeat — one agent seat, all features, billed weekly.',
  },
  wl: {
    label: 'MANAGER+',
    price: 75,
    title: 'CUSTOMIZE YOUR WHITELABEL DIALER',
    subtitle: 'Pay $75 today to provision your branded dialer.',
    weeklyBlurb: '$75.00 USD',
    description:
      'Manager+ unlocks white-label DialerSeat — your subdomain, your branding, full team control. After payment, you\u2019ll pick your subdomain, upload your logo, and set your brand colors.',
  },
} as const

export default function BillingPage() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialPlan: Plan = searchParams.get('plan') === 'wl' ? 'wl' : 'standard'
  const [plan, setPlan] = useState<Plan>(initialPlan)
  const planInfo = PLAN_INFO[plan]

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [submittingPromo, setSubmittingPromo] = useState(false)
  const [promoApplied, setPromoApplied] = useState<string | null>(null)
  const [freeWithCoupon, setFreeWithCoupon] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [switchingPlan, setSwitchingPlan] = useState(false)

  async function abandonAndSignOut() {
    if (abandoning) return
    setAbandoning(true)
    try {
      await fetch('/api/stripe/abandon-billing', { method: 'POST' })
    } catch {}
    try {
      await signOut({ redirectUrl: '/' })
    } catch {
      router.push('/')
    }
  }

  const initSubscription = async (
    codeToApply?: string,
    planOverride?: Plan,
  ) => {
    setError(null)
    const usePlan = planOverride ?? plan
    try {
      const statusRes = await fetch('/api/stripe/status')
      const statusData = await statusRes.json()

      if (statusData.isActive) {
        router.push('/dashboard')
        return
      }

      const createRes = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: usePlan,
          ...(codeToApply ? { code: codeToApply } : {}),
        }),
      })
      const createData = await createRes.json()

      if (!createRes.ok) {
        setError(createData.error || 'Failed to start subscription')
        setCheckingStatus(false)
        setSubmittingPromo(false)
        setSwitchingPlan(false)
        return
      }

      if (createData.freeWithCoupon) {
        setFreeWithCoupon(true)
        setCheckingStatus(false)
        setSubmittingPromo(false)
        setSwitchingPlan(false)
        const successPath = usePlan === 'wl' ? '/onboarding/whitelabel' : '/dashboard'
        setTimeout(() => router.push(successPath), 1500)
        return
      }

      setClientSecret(createData.clientSecret)
      if (codeToApply) setPromoApplied(codeToApply)
      setCheckingStatus(false)
      setSubmittingPromo(false)
      setSwitchingPlan(false)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setCheckingStatus(false)
      setSubmittingPromo(false)
      setSwitchingPlan(false)
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return
    initSubscription()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user])

  const switchTo = async (newPlan: Plan) => {
    if (newPlan === plan) return
    setPlan(newPlan)
    setClientSecret(null)
    setSwitchingPlan(true)
    setPromoCode('')
    setPromoApplied(null)
    setShowPromo(false)
    await initSubscription(undefined, newPlan)
  }

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return
    setSubmittingPromo(true)
    setClientSecret(null)
    await initSubscription(promoCode.trim())
  }

  const handleRemovePromo = async () => {
    setPromoCode('')
    setPromoApplied(null)
    setSubmittingPromo(true)
    setClientSecret(null)
    await initSubscription()
  }

  if (!isLoaded || checkingStatus) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={titleStyle}>LOADING...</div>
          <div style={subtitleStyle}>Preparing secure checkout</div>
        </div>
      </main>
    )
  }

  if (freeWithCoupon) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ ...titleStyle, color: '#32ff7e' }}>SUBSCRIPTION ACTIVE</div>
          <div style={subtitleStyle}>
            Promo code applied. Redirecting{plan === 'wl' ? ' to white-label setup' : ' to your dashboard'}...
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ ...titleStyle, color: '#ff6464' }}>ERROR</div>
          <div style={{ ...subtitleStyle, marginBottom: 24 }}>{error}</div>
          <button
            style={buttonStyle}
            onClick={() => {
              setError(null)
              setCheckingStatus(true)
              initSubscription(promoApplied || undefined)
            }}
            disabled={abandoning}
          >
            {'\u25B6'} TRY AGAIN
          </button>
          <button
            type="button"
            onClick={abandonAndSignOut}
            disabled={abandoning}
            style={{
              ...cancelStyle,
              opacity: abandoning ? 0.5 : 1,
              cursor: abandoning ? 'not-allowed' : 'pointer',
            }}
          >
            {abandoning ? 'Going back...' : 'Back to home'}
          </button>
        </div>
      </main>
    )
  }

  if (!clientSecret) {
    return null
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={planBadgeStyle}>
          <span style={planBadgeLabelStyle}>{'\u25B8'} PLAN</span>
          <span style={planBadgeNameStyle}>{planInfo.label}</span>
          <span style={planBadgePriceStyle}>${planInfo.price}/WK</span>
        </div>

        <div style={titleStyle}>{planInfo.title}</div>
        <div style={subtitleStyle}>{planInfo.subtitle}</div>

        <div style={planDescStyle}>{planInfo.description}</div>

        {/* ── PLAN SWITCH — restyled to be visibly clickable ─────────── */}
        {plan === 'standard' ? (
          <button
            type="button"
            onClick={() => switchTo('wl')}
            disabled={switchingPlan}
            style={planSwitchStyle}
            onMouseEnter={(e) => {
              if (switchingPlan) return
              e.currentTarget.style.background = 'rgba(74,158,255,0.18)'
              e.currentTarget.style.borderColor = '#4a9eff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(74,158,255,0.08)'
              e.currentTarget.style.borderColor = '#2a4a8a'
            }}
          >
            {switchingPlan ? 'SWITCHING...' : '↗ SWITCH TO MANAGER+ ($75/WK)'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchTo('standard')}
            disabled={switchingPlan}
            style={planSwitchStyle}
            onMouseEnter={(e) => {
              if (switchingPlan) return
              e.currentTarget.style.background = 'rgba(74,158,255,0.18)'
              e.currentTarget.style.borderColor = '#4a9eff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(74,158,255,0.08)'
              e.currentTarget.style.borderColor = '#2a4a8a'
            }}
          >
            {switchingPlan ? 'SWITCHING...' : '↘ SWITCH TO STANDARD ($35/WK)'}
          </button>
        )}

        <div style={termsBoxStyle}>
          <div style={termsHeaderStyle}>{'\u25B8'} BILLING TERMS</div>
          <ul style={termsListStyle}>
            <li>
              <strong style={{ color: '#4a9eff' }}>{planInfo.weeklyBlurb}</strong> charged today to start your subscription
            </li>
            <li>
              You will be billed{' '}
              <strong style={{ color: '#4a9eff' }}>{planInfo.weeklyBlurb} weekly</strong>{' '}
              automatically thereafter
            </li>
            <li>Cancel anytime in Settings {'\u2014'} service continues until period end</li>
            <li>Subscription is non-refundable once a billing cycle has been charged</li>
            {plan === 'wl' && (
              <li style={{ color: '#ffd96a' }}>
                After payment you&apos;ll choose your subdomain, upload your logo, and set your brand colors.
              </li>
            )}
          </ul>
        </div>

        <div style={promoBoxStyle}>
          {promoApplied ? (
            <div style={promoAppliedStyle}>
              <span>
                ▸ CODE <strong style={{ color: '#32ff7e' }}>{promoApplied.toUpperCase()}</strong> APPLIED
              </span>
              <button
                onClick={handleRemovePromo}
                disabled={submittingPromo}
                style={promoRemoveStyle}
              >
                REMOVE
              </button>
            </div>
          ) : !showPromo ? (
            <button
              onClick={() => setShowPromo(true)}
              style={promoToggleStyle}
            >
              + HAVE A CODE?
            </button>
          ) : (
            <div style={promoFormStyle}>
              <input
                type="text"
                placeholder="Enter code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyPromo()
                }}
                style={promoInputStyle}
                autoFocus
              />
              <button
                onClick={handleApplyPromo}
                disabled={!promoCode.trim() || submittingPromo}
                style={{
                  ...promoApplyStyle,
                  opacity: !promoCode.trim() || submittingPromo ? 0.4 : 1,
                  cursor: !promoCode.trim() || submittingPromo ? 'not-allowed' : 'pointer',
                }}
              >
                {submittingPromo ? '...' : 'APPLY'}
              </button>
            </div>
          )}
        </div>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#4a9eff',
                colorBackground: '#1a1c24',
                colorText: '#e0e2ea',
                colorDanger: '#ff6464',
                fontFamily: FUTURA,
                borderRadius: '4px',
              },
            },
          }}
          key={clientSecret}
        >
          <CheckoutForm
            onAbandon={abandonAndSignOut}
            abandoning={abandoning}
            plan={plan}
          />
        </Elements>

        <div style={footerNoteStyle}>
          {'\uD83D\uDD12'} Payments processed securely by Stripe. Your card details never touch our servers.
        </div>
      </div>
    </main>
  )
}

function CheckoutForm({
  onAbandon,
  abandoning,
  plan,
}: {
  onAbandon: () => void
  abandoning: boolean
  plan: Plan
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)

  const planInfo = PLAN_INFO[plan]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !agreed) return

    setSubmitting(true)
    setErrorMsg(null)

    const successUrl = plan === 'wl'
      ? `${window.location.origin}/billing/success?plan=wl`
      : `${window.location.origin}/billing/success`

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: successUrl,
      },
    })

    if (error) {
      setErrorMsg(error.message || 'Payment failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: {
            type: 'accordion',
            defaultCollapsed: true,
            radios: 'auto',
            spacedAccordionItems: false,
          },
          paymentMethodOrder: ['card', 'apple_pay', 'google_pay', 'link'],
        }}
      />

      <label style={agreementStyle}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginRight: 10, accentColor: '#4a9eff' }}
        />
        <span>
          I agree my card will be charged <strong>{planInfo.weeklyBlurb} today</strong> and{' '}
          <strong>{planInfo.weeklyBlurb} weekly</strong> thereafter unless I cancel.
        </span>
      </label>

      {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

      <button
        type="submit"
        disabled={!stripe || submitting || !agreed || abandoning}
        style={{
          ...buttonStyle,
          opacity: !stripe || submitting || !agreed || abandoning ? 0.5 : 1,
          cursor: !stripe || submitting || !agreed || abandoning ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'PROCESSING...' : 'CONTINUE'}
      </button>

      <button
        type="button"
        onClick={onAbandon}
        disabled={submitting || abandoning}
        style={{
          ...cancelStyle,
          opacity: submitting || abandoning ? 0.5 : 1,
          cursor: submitting || abandoning ? 'not-allowed' : 'pointer',
        }}
      >
        {abandoning ? 'CANCELING...' : 'Cancel'}
      </button>
    </form>
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
  maxWidth: 480,
  background: '#1a1c24',
  border: '1px solid #2a2c34',
  borderTop: '3px solid #4a9eff',
  borderRadius: 4,
  padding: 32,
  color: '#e0e2ea',
  fontFamily: FUTURA,
}

const planBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(74,158,255,0.08)',
  border: '1px solid #2a4a8a',
  borderLeft: '3px solid #4a9eff',
  padding: '6px 10px',
  borderRadius: 3,
  marginBottom: 16,
  fontFamily: FUTURA,
}

const planBadgeLabelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 3,
  color: '#888a92',
  fontWeight: 700,
}

const planBadgeNameStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  color: '#4a9eff',
  fontWeight: 700,
}

const planBadgePriceStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  color: '#c0c2ca',
  fontWeight: 700,
  marginLeft: 'auto',
}

// ── plan switch button — restyled v23b ─────────────────────────────────
// Was: faint dashed border, transparent bg, gray text — easy to miss.
// Now: solid tinted background, accent-blue text + border, looks
// clickable. Hover handlers in JSX brighten it further on hover.
const planSwitchStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(74,158,255,0.08)',
  border: '1px solid #2a4a8a',
  borderRadius: 4,
  color: '#4a9eff',
  fontSize: 12,
  letterSpacing: 2,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: FUTURA,
  marginBottom: 16,
  transition: 'background 0.15s, border-color 0.15s',
}

const planDescStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.6,
  color: '#c0c2ca',
  marginBottom: 16,
  padding: '10px 12px',
  background: '#0d0e14',
  border: '1px solid #2a2c34',
  borderRadius: 3,
}

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: 4,
  color: '#4a9eff',
  marginBottom: 8,
  fontFamily: FUTURA,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  color: '#888a92',
  marginBottom: 16,
  fontFamily: FUTURA,
}

const termsBoxStyle: React.CSSProperties = {
  background: '#0d0e14',
  border: '1px solid #2a2c34',
  borderLeft: '3px solid #4a9eff',
  borderRadius: 3,
  padding: '12px 16px',
  marginBottom: 16,
  fontFamily: FUTURA,
}

const termsHeaderStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 3,
  color: '#888a92',
  marginBottom: 8,
  fontWeight: 700,
  fontFamily: FUTURA,
}

const termsListStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.7,
  color: '#c0c2ca',
  paddingLeft: 18,
  margin: 0,
  fontFamily: FUTURA,
}

const promoBoxStyle: React.CSSProperties = {
  marginBottom: 20,
}

const promoToggleStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  border: '1px dashed #4a4a5e',
  borderRadius: 3,
  color: '#888a92',
  fontSize: 11,
  letterSpacing: 3,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: FUTURA,
}

const promoFormStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
}

const promoInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  background: '#0d0e14',
  border: '1px solid #2a4a8a',
  borderRadius: 3,
  fontFamily: 'monospace',
  fontSize: 16,
  color: '#4a9eff',
  outline: 'none',
  letterSpacing: 2,
  textTransform: 'uppercase',
  boxSizing: 'border-box',
}

const promoApplyStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: '#0d0e14',
  border: 'none',
  borderTop: '3px solid #4a9eff',
  borderRadius: 3,
  color: '#4a9eff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 3,
  fontFamily: FUTURA,
}

const promoAppliedStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  background: 'rgba(50,255,126,0.08)',
  border: '1px solid #1a6a1a',
  borderLeft: '3px solid #32ff7e',
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 2,
  color: '#c0c2ca',
  fontFamily: FUTURA,
}

const promoRemoveStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #4a4a5e',
  borderRadius: 3,
  color: '#888a92',
  fontSize: 9,
  letterSpacing: 2,
  padding: '4px 10px',
  cursor: 'pointer',
  fontFamily: FUTURA,
  fontWeight: 700,
}

const agreementStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  fontSize: 11,
  color: '#c0c2ca',
  margin: '20px 0',
  cursor: 'pointer',
  lineHeight: 1.6,
  fontFamily: FUTURA,
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
  marginBottom: 8,
}

const cancelStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  background: 'transparent',
  border: 'none',
  color: '#666870',
  fontSize: 11,
  letterSpacing: 2,
  cursor: 'pointer',
  fontFamily: FUTURA,
}

const errorStyle: React.CSSProperties = {
  background: '#2a1a1a',
  border: '1px solid #8a1a1a',
  color: '#ff6464',
  padding: '8px 12px',
  borderRadius: 3,
  fontSize: 11,
  margin: '12px 0',
  fontFamily: FUTURA,
}

const footerNoteStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 1,
  color: '#666870',
  textAlign: 'center',
  marginTop: 20,
  paddingTop: 16,
  borderTop: '1px solid #2a2c34',
  fontFamily: FUTURA,
}