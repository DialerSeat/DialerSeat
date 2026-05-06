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
  tier?: 'active' | 'lapsed' | 'new'
}

export default function SettingsPage() {
  const { user } = useUser()
  const [sub, setSub] = useState<SubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [typedConfirm, setTypedConfirm] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

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
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [])

  const confirmReady = typedConfirm.toLowerCase().trim() === 'cancel'

  const handleCancel = async () => {
    if (!confirmReady) return
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
      setTypedConfirm('')
      await loadStatus()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setCanceling(false)
    }
  }

  const handleStartCancel = () => {
    setConfirming(true)
    setTypedConfirm('')
    setError(null)
    setMessage(null)
  }

  const handleAbortCancel = () => {
    setConfirming(false)
    setTypedConfirm('')
  }

  const handleResubscribe = () => {
    window.location.href = '/billing'
  }

  if (loading) {
    return (
      <div className="settings-root" style={pageStyle}>
        <div style={cardStyle}>
          <div style={titleStyle}>LOADING...</div>
        </div>
      </div>
    )
  }

  // Show resubscribe panel for: lapsed users, OR canceling users (after period ends they'll be lapsed)
  const showResubscribe =
    !isAdmin &&
    (sub?.tier === 'lapsed' || (sub?.cancelAtPeriodEnd && sub?.isActive))

  return (
    <div className="settings-root" style={pageStyle}>
      <style>{`
        @media (max-width: 768px) {
          .settings-root {
            padding: 20px !important;
          }
          .settings-card {
            padding: 20px !important;
          }
          .settings-confirm-buttons {
            flex-direction: column !important;
          }
        }
      `}</style>

      <div className="settings-card" style={cardStyle}>
        <div style={titleStyle}>SETTINGS</div>
        <div style={subtitleStyle}>
          {user?.primaryEmailAddress?.emailAddress}
          {isAdmin && (
            <span style={{
              marginLeft: 8,
              fontSize: 9,
              letterSpacing: 3,
              color: '#4a9eff',
              fontWeight: 'bold',
            }}>· ADMIN</span>
          )}
          {!isAdmin && sub?.tier === 'lapsed' && (
            <span style={{
              marginLeft: 8,
              fontSize: 9,
              letterSpacing: 3,
              color: '#ffaa3e',
              fontWeight: 'bold',
            }}>· UNSUBSCRIBED</span>
          )}
        </div>

        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>▸ SUBSCRIPTION</div>

          {!sub?.hasSubscription && (
            <div style={mutedStyle}>No active subscription on file.</div>
          )}

          {sub?.hasSubscription && (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>STATUS</span>
                <span style={{ ...valueStyle, color: tierStatusColor(sub) }}>
                  {tierStatusLabel(sub)}
                </span>
              </div>

              {sub.status === 'trialing' && sub.trialEnd && (
                <div style={rowStyle}>
                  <span style={labelStyle}>TRIAL ENDS</span>
                  <span style={valueStyle}>{formatDate(sub.trialEnd)}</span>
                </div>
              )}

              {sub.currentPeriodEnd && sub.tier !== 'lapsed' && (
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

        {/* RESUBSCRIBE — for lapsed users or those who canceled (still in paid period) */}
        {showResubscribe && (
          <div style={resubscribeBoxStyle}>
            <div style={resubscribeHeaderStyle}>
              {sub?.tier === 'lapsed'
                ? 'YOUR SUBSCRIPTION HAS LAPSED'
                : 'YOUR SUBSCRIPTION IS SCHEDULED TO CANCEL'}
            </div>
            <div style={resubscribeTextStyle}>
              {sub?.tier === 'lapsed'
                ? 'Resubscribe to restore dialing, campaign creation, and lead imports. Your existing leads, recordings, and analytics are still here.'
                : `You'll lose dialing access on ${sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'period end'}. Resume billing now to keep going without interruption.`
              }
            </div>
            <button onClick={handleResubscribe} style={resubscribeButtonStyle}>
              {sub?.tier === 'lapsed' ? 'RESUBSCRIBE — $35/WEEK' : 'RESUME SUBSCRIPTION'}
            </button>
          </div>
        )}

        {/* ADMIN: cancel UI fully hidden, replaced with a notice */}
        {isAdmin && sub?.isActive && !sub.cancelAtPeriodEnd && (
          <div style={adminNoticeStyle}>
            ▸ ADMIN ACCOUNTS CANNOT CANCEL FROM THIS PANEL
          </div>
        )}

        {/* NON-ADMIN: type-to-confirm cancel flow */}
        {!isAdmin && sub?.isActive && !sub.cancelAtPeriodEnd && (
          <>
            {!confirming ? (
              <button onClick={handleStartCancel} style={dangerButtonStyle}>
                CANCEL SUBSCRIPTION
              </button>
            ) : (
              <div style={confirmBoxStyle}>
                <div style={confirmTextStyle}>
                  Cancel your subscription? You'll keep access until{' '}
                  <strong style={{ color: '#4a9eff' }}>
                    {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'period end'}
                  </strong>
                  . No further charges will be made.
                </div>

                <div style={typePromptStyle}>
                  Type <strong style={{ color: '#ff6464' }}>cancel</strong> to confirm:
                </div>
                <input
                  type="text"
                  value={typedConfirm}
                  onChange={e => setTypedConfirm(e.target.value)}
                  placeholder="cancel"
                  autoFocus
                  style={typeInputStyle}
                />

                <div className="settings-confirm-buttons" style={confirmButtonsStyle}>
                  <button
                    onClick={handleAbortCancel}
                    disabled={canceling}
                    style={secondaryButtonStyle}
                  >
                    KEEP SUBSCRIPTION
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={canceling || !confirmReady}
                    style={{
                      ...dangerButtonStyle,
                      marginTop: 0,
                      flex: 1,
                      opacity: canceling || !confirmReady ? 0.4 : 1,
                      cursor: canceling || !confirmReady ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {canceling ? 'CANCELING...' : 'CONFIRM CANCEL'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {sub?.cancelAtPeriodEnd && !showResubscribe && (
          <div style={warnStyle}>
            Your subscription is scheduled to cancel at the end of the current billing period.
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function tierStatusLabel(sub: SubStatus): string {
  if (sub.tier === 'lapsed') return 'UNSUBSCRIBED'
  if (sub.cancelAtPeriodEnd) return `${sub.status?.toUpperCase()} (CANCELING)`
  return sub.status?.toUpperCase() || '—'
}

function tierStatusColor(sub: SubStatus): string {
  if (sub.tier === 'lapsed') return '#ffaa3e'
  if (sub.status === 'active' || sub.status === 'trialing') return '#32ff7e'
  if (sub.status === 'past_due') return '#ffaa3e'
  return '#ff6464'
}

const pageStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 'calc(100vh - 64px)',
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
  boxSizing: 'border-box',
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
  wordBreak: 'break-word',
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
  gap: 12,
  flexWrap: 'wrap',
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

const typePromptStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1,
  color: '#e0c2c2',
  marginBottom: 8,
}

const typeInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#0d0e14',
  border: '1px solid #4a2a2a',
  borderRadius: 3,
  fontFamily: 'monospace',
  fontSize: 13,
  color: '#ff8888',
  outline: 'none',
  marginBottom: 16,
  letterSpacing: 1,
  boxSizing: 'border-box',
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

const adminNoticeStyle: React.CSSProperties = {
  background: 'rgba(74,158,255,0.06)',
  border: '1px solid #2a4a8a',
  borderLeft: '3px solid #4a9eff',
  color: '#4a9eff',
  padding: 12,
  borderRadius: 3,
  fontSize: 10,
  letterSpacing: 3,
  fontWeight: 700,
  marginTop: 16,
}

const resubscribeBoxStyle: React.CSSProperties = {
  background: 'rgba(255,170,62,0.06)',
  border: '1px solid #8a6a1a',
  borderLeft: '3px solid #ffaa3e',
  borderRadius: 3,
  padding: 16,
  marginBottom: 16,
}

const resubscribeHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 3,
  color: '#ffaa3e',
  fontWeight: 700,
  marginBottom: 8,
}

const resubscribeTextStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: '#e0e2ea',
  marginBottom: 14,
}

const resubscribeButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
  border: 'none',
  borderRadius: 4,
  color: 'white',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 4,
  cursor: 'pointer',
  fontFamily: FUTURA,
  boxShadow: '0 0 15px rgba(74,158,255,0.25)',
}