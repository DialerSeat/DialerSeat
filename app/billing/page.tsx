'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
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

export default function BillingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [submittingPromo, setSubmittingPromo] = useState(false)
  const [promoApplied, setPromoApplied] = useState<string | null>(null)
  const [freeWithCoupon, setFreeWithCoupon] = useState(false)

  // The actual subscription init request, broken out so it can be re-run
  // when a promo code is submitted.
  const initSubscription = async (codeToApply?: string) => {
    setError(null)
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
        body: JSON.stringify(codeToApply ? { code: codeToApply } : {}),
      })
      const createData = await createRes.json()

      if (!createRes.ok) {
        setError(createData.error || 'Failed to start subscription')
        setCheckingStatus(false)
        setSubmittingPromo(false)
        return
      }

      // Free coupon path — sub already active, skip Stripe Elements entirely
      if (createData.freeWithCoupon) {
        setFreeWithCoupon(true)
        setCheckingStatus(false)
        setSubmittingPromo(false)
        // Brief delay so they see the success state, then redirect
        setTimeout(() => router.push('/dashboard'), 1500)
        return
      }

      setClientSecret(createData.clientSecret)
      if (codeToApply) setPromoApplied(codeToApply)
      setCheckingStatus(false)
      setSubmittingPromo(false)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setCheckingStatus(false)
      setSubmittingPromo(false)
    }
  }

  useEffect(() => {
    if (!isLoaded || !user) return
    initSubscription()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user])

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
            Promo code applied. Redirecting to your dashboard...
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
          >
            {'\u25B6'} TRY AGAIN
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={cancelStyle}
          >
            Back to home
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
        <div style={titleStyle}>START YOUR SUBSCRIPTION</div>
        <div style={subtitleStyle}>
          Pay $35 today and start dialing immediately.
        </div>

        <div style={termsBoxStyle}>
          <div style={termsHeaderStyle}>{'\u25B8'} BILLING TERMS</div>
          <ul style={termsListStyle}>
            <li>
              <strong style={{ color: '#4a9eff' }}>$35.00 USD</strong> charged today to start your subscription
            </li>
            <li>
              You will be billed{' '}
              <strong style={{ color: '#4a9eff' }}>$35.00 USD weekly</strong>{' '}
              automatically thereafter
            </li>
            <li>Cancel anytime in Settings {'\u2014'} service continues until period end</li>
            <li>Subscription is non-refundable once a billing cycle has been charged</li>
          </ul>
        </div>

        {/* PROMO CODE BLOCK */}
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
          // Force re-mount when clientSecret changes (e.g. after promo code applied)
          key={clientSecret}
        >
          <CheckoutForm />
        </Elements>

        <div style={footerNoteStyle}>
          {'\uD83D\uDD12'} Payments processed securely by Stripe. Your card details never touch our servers.
        </div>
      </div>
    </main>
  )
}

function CheckoutForm() {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !agreed) return

    setSubmitting(true)
    setErrorMsg(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing/success`,
      },
    })

    if (error) {
      setErrorMsg(error.message || 'Payment failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      <label style={agreementStyle}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginRight: 10, accentColor: '#4a9eff' }}
        />
        <span>
          I agree my card will be charged <strong>$35.00 USD today</strong> and{' '}
          <strong>$35.00 USD weekly</strong> thereafter until I cancel.
        </span>
      </label>

      {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

      <button
        type="submit"
        disabled={!stripe || submitting || !agreed}
        style={{
          ...buttonStyle,
          opacity: !stripe || submitting || !agreed ? 0.5 : 1,
          cursor: !stripe || submitting || !agreed ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'PROCESSING...' : `${'\u25B6'} PAY $35 & START DIALING`}
      </button>

      <button
        type="button"
        onClick={() => router.push('/')}
        style={cancelStyle}
      >
        Cancel
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
  marginBottom: 20,
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
  fontSize: 13,
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