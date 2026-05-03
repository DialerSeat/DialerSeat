'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BillingSuccessPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          router.push('/dashboard')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [router])

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={iconStyle}>✓</div>
        <div style={titleStyle}>TRIAL ACTIVATED</div>
        <div style={subtitleStyle}>
          Your 7-day free trial has started.<br />
          Your card will be charged $35.00/week starting day 8 unless you cancel.
        </div>
        <div style={countdownStyle}>
          Redirecting to dashboard in {countdown}...
        </div>
        <button onClick={() => router.push('/dashboard')} style={buttonStyle}>
          ▶ GO TO DASHBOARD NOW
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
  fontFamily: 'monospace',
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
  fontFamily: 'Futura PT, Futura, sans-serif',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
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
  fontFamily: 'Futura PT, Futura, sans-serif',
}