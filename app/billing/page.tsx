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

  useEffect(() => {
    if (!isLoaded || !user) return

    const checkAndCreate = async () => {
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
        })
        const createData = await createRes.json()

        if (!createRes.ok) {
          setError(createData.error || 'Failed to start subscription')
          setCheckingStatus(false)
          return
        }

        setClientSecret(createData.clientSecret)
        setCheckingStatus(false)
      } catch (err: any) {
        setError(err.message || 'Something went wrong')
        setCheckingStatus(false)
      }
    }

    checkAndCreate()
  }, [isLoaded, user, router])

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

  if (error) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ ...titleStyle, color: '#ff6464' }}>ERROR</div>
          <div style={{ ...subtitleStyle, marginBottom: 24 }}>{error}</div>
          <button style={buttonStyle} onClick={() => location.reload()}>
            {'\u25B6'} TRY AGAIN
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
        <div style={titleStyle}>START YOUR 7-DAY FREE TRIAL</div>
        <div style={subtitleStyle}>
          Full access to DialerSeat for 7 days. No charge today.
        </div>

        <div style={termsBoxStyle}>
          <div style={termsHeaderStyle}>{'\u25B8'} TRIAL TERMS</div>
          <ul style={termsListStyle}>
            <li>$0 today {'\u2014'} payment method required to start trial</li>
            <li>
              After 7 days, you will be billed{' '}
              <strong style={{ color: '#4a9eff' }}>$35.00 USD weekly</strong>{' '}
              automatically
            </li>
            <li>Cancel anytime in Settings {'\u2014'} service continues until period end</li>
            <li>Subscription is non-refundable once a billing cycle has been charged</li>
          </ul>
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

    const { error } = await stripe.confirmSetup({
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

  const termsLink = (
    <a
      href="/terms"
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#4a9eff', textDecoration: 'underline' }}
    >
      Terms of Service
    </a>
  )

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
          I agree my card will be charged <strong>$35.00 USD weekly</strong>{' '}
          starting after my 7-day free trial unless I cancel. I have read and
          accept the {termsLink}.
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
        {submitting ? 'PROCESSING...' : `${'\u25B6'} START FREE TRIAL`}
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
  marginBottom: 24,
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