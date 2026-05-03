'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

interface SubStatus {
  hasSubscription: boolean
  isActive: boolean
  status: string | null
  currentPeriodEnd: string | null
  trialEnd: string | null
  cancelAtPeriodEnd: boolean
}

export default function SettingsPage() {
  const { user } = useUser()
  const [sub, setSub] = useState<SubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/stripe/status')
      const data = await res.json()
      setSub(data)
    } catch {
      setError('Failed to load subscription status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleCancel = async () => {
    setCanceling(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/stripe/cancel', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to cancel')
        setCanceling(false)
        return
      }
      setMessage(
        data.cancelAt
          ? `Canceled. Your service continues until ${formatDate(data.cancelAt)}.`
          : 'Canceled.'
      )
      setConfirming(false)
      await loadStatus()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setCanceling(false)
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={titleStyle}>LOADING...</div>
        </div>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <div style={titleStyle}>SETTINGS</div>
        <div style={subtitleStyle}>
          {user?.primaryEmailAddress?.emailAddress}
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>{'\u25B8'} SUBSCRIPTION</div>

          {!sub?.hasSubscription && (
            <div style={mutedStyle}>No active subscription on file.</div>
          )}

          {sub?.hasSubscription && (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>STATUS</span>
                <span style={{ ...valueStyle, color: statusColor(sub.status) }}>
                  {sub.status?.toUpperCase()}
                  {sub.cancelAtPeriodEnd && ' (CANCELING)'}
                </span>
              </div>

              {sub.status === 'trialing' && sub.trialEnd && (
                <div style={rowStyle}>
                  <span style={labelStyle}>TRIAL ENDS</span>
                  <span style={valueStyle}>{formatDate(sub.trialEnd)}</span>
                </div>
              )}

              {sub.currentPeriodEnd && (
                <div style={rowStyle}>
                  <span style={labelStyle}>
                    {sub.cancelAtPeriodEnd ? 'ACCESS UNTIL' : 'NEXT BILLING'}
                  </span>
                  <span style={valueStyle}>{formatDate(sub.currentPeriodEnd)}</span>
                </div>
              )}

              <div style={rowStyle}>
                <span style={labelStyle}>PRICE</span>
                <span style={valueStyle}>$35.00 / WEEK</span>
              </div>
            </>
          )}
        </div>

        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {sub?.isActive && !sub.cancelAtPeriodEnd && (
          <>
            {!confirming ? (
              <button onClick={() => setConfirming(true)} style={dangerButtonStyle}>
                CANCEL SUBSCRIPTION
              </button>
            ) : (
              <div style={confirmBoxStyle}>
                <div style={confirmTextStyle}>
                  Cancel your subscription? You{"\u2019"}ll keep access until{' '}
                  <strong style={{ color: '#4a9eff' }}>
                    {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'period end'}
                  </strong>
                  . No further charges will be made.
                </div>
                <div style={confirmButtonsStyle}>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={canceling}
                    style={secondaryButtonStyle}
                  >
                    KEEP SUBSCRIPTION
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={canceling}
                    style={{ ...dangerButtonStyle, marginTop: 0 }}
                  >
                    {canceling ? 'CANCELING...' : 'CONFIRM CANCEL'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {sub?.cancelAtPeriodEnd && (
          <div style={warnStyle}>
            Your subscription is scheduled to cancel at the end of the current billing period.
          </div>
        )}
      </div>
    </main>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusColor(status: string | null) {
  if (status === 'active' || status === 'trialing') return '#32ff7e'
  if (status === 'past_due') return '#ffaa3e'
  return '#ff6464'
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0d0e14',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 40,
  fontFamily: FUTURA,
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  background: '#1a1c24',
  border: '1px solid #2a2c34',
  borderTop: '3px solid #4a9eff',
  borderRadius: 4,
  padding: 32,
  color: '#e0e2ea',
  fontFamily: FUTURA,
}

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 5,
  color: '#4a9eff',
  marginBottom: 4,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  color: '#888a92',
  marginBottom: 28,
}

const sectionStyle: React.CSSProperties = {
  background: '#0d0e14',
  border: '1px solid #2a2c34',
  borderLeft: '3px solid #4a9eff',
  borderRadius: 3,
  padding: 16,
  marginBottom: 20,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 3,
  color: '#888a92',
  marginBottom: 14,
  fontWeight: 700,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid #2a2c34',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: '#888a92',
}

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  color: '#e0e2ea',
  fontWeight: 700,
}

const mutedStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#888a92',
  letterSpacing: 1,
}

const dangerButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  background: '#0d0e14',
  border: 'none',
  borderTop: '3px solid #8a1a1a',
  borderRadius: 4,
  color: '#ff6464',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 4,
  cursor: 'pointer',
  fontFamily: FUTURA,
  marginTop: 8,
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: 14,
  background: '#0d0e14',
  border: 'none',
  borderTop: '3px solid #4a9eff',
  borderRadius: 4,
  color: '#4a9eff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 3,
  cursor: 'pointer',
  fontFamily: FUTURA,
}

const confirmBoxStyle: React.CSSProperties = {
  background: '#2a1a1a',
  border: '1px solid #8a1a1a',
  borderRadius: 4,
  padding: 16,
  marginTop: 8,
}

const confirmTextStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: '#e0c2c2',
  marginBottom: 16,
}

const confirmButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
}

const successStyle: React.CSSProperties = {
  background: '#1a2a1a',
  border: '1px solid #1a6a1a',
  color: '#32ff7e',
  padding: 12,
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 1,
  marginBottom: 16,
}

const errorStyle: React.CSSProperties = {
  background: '#2a1a1a',
  border: '1px solid #8a1a1a',
  color: '#ff6464',
  padding: 12,
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 1,
  marginBottom: 16,
}

const warnStyle: React.CSSProperties = {
  background: '#2a221a',
  border: '1px solid #8a6a1a',
  color: '#ffaa3e',
  padding: 12,
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 1,
  marginTop: 16,
}