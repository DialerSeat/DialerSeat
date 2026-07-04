'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'
















































const CHROME = {
  
  
  
  surface: 'color-mix(in srgb, var(--brand-sidebar-bg) 88%, var(--brand-on-sidebar) 12%)',
  
  
  sectionBg: 'var(--brand-sidebar-bg)',
  
  border: 'color-mix(in srgb, var(--brand-sidebar-bg) 75%, var(--brand-on-sidebar) 25%)',
  
  borderSoft: 'color-mix(in srgb, var(--brand-sidebar-bg) 82%, var(--brand-on-sidebar) 18%)',
  text: 'var(--brand-on-sidebar)',
  muted: 'var(--brand-on-sidebar-muted)',
}

interface SubStatus {
  hasSubscription: boolean
  isActive: boolean
  status: string | null
  currentPeriodEnd: string | null
  trialEnd: string | null
  cancelAtPeriodEnd: boolean
  tier?: 'active' | 'lapsed' | 'new'
  plan?: 'pro' | 'manager_plus' | 'both' | null
  wlActive?: boolean
  weeklyPrice?: number
}

interface OwnerPaidSeat {
  id: string
  teamId: string
  teamName: string
  ownerName: string
  ownerEmail: string | null
  amountCents: number
  status: string
  periodStart: string
  periodEnd: string
  payer: 'owner'
}

interface AgentPaidSeat {
  id: string
  teamId: string
  teamName: string
  ownerName: string
  campaignId: string
  campaignName: string | null
  status: string
  payer: 'agent'
}

interface SubsSummary {
  ownerPaidSeats: OwnerPaidSeat[]
  agentPaidSeats: AgentPaidSeat[]
  counts: { ownerPaid: number; agentPaid: number; totalSeats: number }
}

interface AvailableTenant {
  id: string
  slug: string
  brand_name: string
  logo_url: string | null
  role: 'owner' | 'member'
}

interface SavedThemeOption {
  id: string
  name: string
}

interface BrandOptions {
  available: AvailableTenant[]
  savedThemes: SavedThemeOption[]
  canSeeStandard: boolean
  currentTenantId: string | null
  currentValue: string
}

export default function SettingsPage() {
  const { user } = useUser()
  const [sub, setSub] = useState<SubStatus | null>(null)
  const [seats, setSeats] = useState<SubsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [typedConfirm, setTypedConfirm] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const [seatCancelling, setSeatCancelling] = useState<string | null>(null)
  const [seatConfirmTarget, setSeatConfirmTarget] = useState<AgentPaidSeat | null>(null)
  const [seatTypedConfirm, setSeatTypedConfirm] = useState('')

  const [brandOptions, setBrandOptions] = useState<BrandOptions | null>(null)
  const [switchingBrand, setSwitchingBrand] = useState(false)

  // ── support form (settings → subscription details) ──
  const [showSupport, setShowSupport] = useState(false)
  const [supportType, setSupportType] = useState<'support' | 'bug' | 'suggestion'>('support')
  const [supportSubject, setSupportSubject] = useState('')
  const [supportBody, setSupportBody] = useState('')
  const [supportSubmitting, setSupportSubmitting] = useState(false)
  const [supportSubmitted, setSupportSubmitted] = useState(false)
  const [supportError, setSupportError] = useState<string | null>(null)

  // ── delete account (feedback first, then confirm) ──
  const [showDelete, setShowDelete] = useState(false)
  const [deleteStep, setDeleteStep] = useState<'feedback' | 'confirm' | 'done'>('feedback')
  const [exitRating, setExitRating] = useState<number>(0)
  const [exitFeedback, setExitFeedback] = useState('')
  const [exitSubmitting, setExitSubmitting] = useState(false)
  const [deleteTypedConfirm, setDeleteTypedConfirm] = useState('')
  const [deleteAccError, setDeleteAccError] = useState<string | null>(null)
  const [deleteAccSubmitting, setDeleteAccSubmitting] = useState(false)

  const loadStatus = async () => {
    try {
      const [statusRes, summaryRes, brandRes] = await Promise.all([
        fetch('/api/stripe/status'),
        fetch('/api/subscriptions/summary'),
        fetch('/api/whitelabel/available-tenants'),
      ])
      const statusData = await statusRes.json()
      setSub(statusData)
      const summaryData = await summaryRes.json()
      if (summaryData.success) {
        setSeats({
          ownerPaidSeats: summaryData.ownerPaidSeats || [],
          agentPaidSeats: summaryData.agentPaidSeats || [],
          counts: summaryData.counts || { ownerPaid: 0, agentPaid: 0, totalSeats: 0 },
        })
      }
      if (brandRes.ok) {
        const brandData = await brandRes.json()
        setBrandOptions({
          available: brandData.available || [],
          savedThemes: brandData.savedThemes || [],
          canSeeStandard: !!brandData.canSeeStandard,
          currentTenantId: brandData.currentTenantId ?? null,
          currentValue: brandData.currentValue || 'standard',
        })
      }
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
    setConfirming(true); setTypedConfirm(''); setError(null); setMessage(null)
  }
  const handleAbortCancel = () => { setConfirming(false); setTypedConfirm('') }
  const handleResubscribe = () => { window.location.href = '/billing' }

  const startCancelSeat = (seat: AgentPaidSeat) => {
    setSeatConfirmTarget(seat); setSeatTypedConfirm('')
  }
  const submitCancelSeat = async () => {
    if (!seatConfirmTarget) return
    if (seatTypedConfirm.toLowerCase().trim() !== 'cancel') return
    setSeatCancelling(seatConfirmTarget.id)
    setError(null); setMessage(null)
    try {
      const res = await fetch('/api/teams/access/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: seatConfirmTarget.teamId,
          campaignId: seatConfirmTarget.campaignId,
          confirm: 'remove',
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Failed to cancel seat'); return
      }
      setMessage(`Canceled access to ${seatConfirmTarget.campaignName || 'the campaign'}. You're still a member of ${seatConfirmTarget.teamName}.`)
      setSeatConfirmTarget(null); setSeatTypedConfirm('')
      await loadStatus()
    } catch (err: any) {
      setError(err.message || 'Failed to cancel seat')
    } finally {
      setSeatCancelling(null)
    }
  }

  const handleSwitchBrand = async (value: string) => {
    let body: any
    if (value === 'standard') {
      body = { tenant_id: null }
    } else if (value.startsWith('theme:')) {
      body = { theme_id: value.slice(6) }
    } else {
      body = { tenant_id: value }
    }

    setSwitchingBrand(true)
    setError(null); setMessage(null)
    try {
      const res = await fetch('/api/whitelabel/switch-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || data.error || 'Failed to switch view')
        setSwitchingBrand(false)
        return
      }
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Failed to switch view')
      setSwitchingBrand(false)
    }
  }

  function openSupport() {
    setShowSupport(true)
    setSupportType('support')
    setSupportSubject('')
    setSupportBody('')
    setSupportError(null)
    setSupportSubmitted(false)
  }
  function closeSupport() {
    if (supportSubmitting) return
    setShowSupport(false)
  }
  async function submitSupport() {
    if (!supportBody.trim()) { setSupportError('Please describe what\'s going on.'); return }
    setSupportSubmitting(true)
    setSupportError(null)
    try {
      const res = await fetch('/api/admin/support/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: supportType,
          subject: supportSubject.trim() || null,
          body: supportBody.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSupportError(data.error || 'Failed to send. Please try again.')
        return
      }
      setSupportSubmitted(true)
      setSupportSubject('')
      setSupportBody('')
    } catch (err: any) {
      setSupportError(err?.message || 'Failed to send. Please try again.')
    } finally {
      setSupportSubmitting(false)
    }
  }

  function openDeleteAccount() {
    setShowDelete(true)
    setDeleteStep('feedback')
    setExitRating(0)
    setExitFeedback('')
    setDeleteTypedConfirm('')
    setDeleteAccError(null)
  }
  function closeDeleteAccount() {
    if (exitSubmitting || deleteAccSubmitting) return
    setShowDelete(false)
  }
  async function submitExitFeedback(skip: boolean) {
    setExitSubmitting(true)
    try {
      if (!skip && (exitFeedback.trim() || exitRating > 0)) {
        await fetch('/api/admin/support/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'exit',
            subject: exitRating > 0 ? `Exit rating: ${exitRating}/5` : 'Account deletion feedback',
            body: exitFeedback.trim() || '(no written feedback — rating only)',
            disposition: exitRating > 0 ? `${exitRating}/5` : null,
          }),
        })
      }
    } catch {
      // never block account deletion on a feedback submission failure
    } finally {
      setExitSubmitting(false)
      setDeleteStep('confirm')
    }
  }
  async function executeDeleteAccount() {
    if (deleteTypedConfirm.trim().toUpperCase() !== 'DELETE') return
    setDeleteAccSubmitting(true)
    setDeleteAccError(null)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setDeleteAccError(data.error || 'Failed to delete account.')
        setDeleteAccSubmitting(false)
        return
      }
      try {
        await user?.delete()
      } catch {
        // app data is already wiped; identity cleanup failing shouldn't block the user
      }
      setDeleteStep('done')
      setDeleteAccSubmitting(false)
      setTimeout(() => { window.location.href = '/' }, 2200)
    } catch (err: any) {
      setDeleteAccError(err?.message || 'Network error — please try again.')
      setDeleteAccSubmitting(false)
    }
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

  const showResubscribe =
    !isAdmin &&
    (sub?.tier === 'lapsed' || (sub?.cancelAtPeriodEnd && sub?.isActive))

  const hasAnySeats = (seats?.counts.totalSeats || 0) > 0

  const optionCount =
    (brandOptions?.available.length || 0) +
    (brandOptions?.savedThemes.length || 0) +
    (brandOptions?.canSeeStandard ? 1 : 0)
  const showBrandToggle = optionCount >= 2

  const currentBrandValue = brandOptions?.currentValue || 'standard'

  const wlActive = !!sub?.wlActive
  const planLabel = planLabelFor(sub?.plan)
  const weeklyPrice = sub?.weeklyPrice ?? (sub?.hasSubscription ? 35 : 0)
  return (
    <div className="settings-root" style={pageStyle}>
      <style>{`
        @media (max-width: 768px) {
          .settings-root { padding: 20px !important; }
          .settings-card { padding: 20px !important; }
          .settings-confirm-buttons { flex-direction: column !important; }
        }
      `}</style>

      <div className="settings-card" style={cardStyle}>
        <div style={titleStyle}>SETTINGS</div>
        <div style={subtitleStyle}>
          {user?.primaryEmailAddress?.emailAddress}
          {isAdmin && (
            <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: 3, color: 'var(--brand-primary)', fontWeight: 'bold' }}>· ADMIN</span>
          )}
          {!isAdmin && planLabel && (
            <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: 3, color: 'var(--brand-primary)', fontWeight: 'bold' }}>· {planLabel}</span>
          )}
          {!isAdmin && sub?.tier === 'lapsed' && !wlActive && (
            <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: 3, color: '#ffaa3e', fontWeight: 'bold' }}>· UNSUBSCRIBED</span>
          )}
        </div>

        {/* BRAND VIEW TOGGLE — tenants + saved themes + standard, no parens */}
        {showBrandToggle && brandOptions && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>▸ WHITE-LABEL VIEW</div>
            <div style={{ ...mutedStyle, marginBottom: 12, lineHeight: 1.6 }}>
              Which brand do you want to view the app as? Your selection is
              saved to your account and applies on every device.
            </div>

            <select
              value={currentBrandValue}
              onChange={(e) => handleSwitchBrand(e.target.value)}
              disabled={switchingBrand}
              style={brandSelectStyle(switchingBrand)}
            >
              {brandOptions.available.map(t => (
                <option key={t.id} value={t.id}>
                  {t.brand_name}
                </option>
              ))}
              {brandOptions.savedThemes.map(t => (
                <option key={`theme-${t.id}`} value={`theme:${t.id}`}>
                  {t.name}
                </option>
              ))}
              {brandOptions.canSeeStandard && (
                <option value="standard">
                  DialerSeat Pro
                </option>
              )}
            </select>

            {switchingBrand && (
              <div style={{ ...mutedStyle, marginTop: 8, fontSize: 10 }}>
                Switching view…
              </div>
            )}
          </div>
        )}

        {/* ── WHITELABEL EDITOR (button only, no inline editor) ── */}
        {wlActive && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>▸ WHITELABEL EDITOR</div>
            <div style={{ ...mutedStyle, marginBottom: 12, lineHeight: 1.6 }}>
              Manage your colors, presets, custom themes, brand name,
              subdomain, and logo in the onboarding editor. Changes propagate
              site-wide within 60 seconds.
            </div>
            <Link href="/onboarding/whitelabel" style={editorButtonStyle}>
              OPEN WHITELABEL EDITOR
            </Link>
          </div>
        )}

        {/* PERSONAL SUBSCRIPTION */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>▸ YOUR SUBSCRIPTION</div>

          {!sub?.hasSubscription && !wlActive && (
            <div style={mutedStyle}>No active subscription on file.</div>
          )}

          {(sub?.hasSubscription || wlActive) && (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>PLAN</span>
                <span style={valueStyle}>{planLabel || 'PRO'}</span>
              </div>

              <div style={rowStyle}>
                <span style={labelStyle}>STATUS</span>
                <span style={{ ...valueStyle, color: tierStatusColor(sub) }}>
                  {tierStatusLabel(sub, wlActive)}
                </span>
              </div>

              {sub?.status === 'trialing' && sub?.trialEnd && (
                <div style={rowStyle}>
                  <span style={labelStyle}>TRIAL ENDS</span>
                  <span style={valueStyle}>{formatDate(sub.trialEnd)}</span>
                </div>
              )}

              {sub?.currentPeriodEnd && sub?.tier !== 'lapsed' && (
                <div style={rowStyle}>
                  <span style={labelStyle}>
                    {sub.cancelAtPeriodEnd ? 'ACCESS UNTIL' : 'NEXT BILLING'}
                  </span>
                  <span style={valueStyle}>{formatDate(sub.currentPeriodEnd)}</span>
                </div>
              )}

              <div style={rowStyle}>
                <span style={labelStyle}>PRICE</span>
                <span style={valueStyle}>${weeklyPrice.toFixed(2)} / WEEK</span>
              </div>
            </>
          )}
        </div>

        {/* SUPPORT — reaches the same inbox as the admin Support desktop app */}
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>▸ SUPPORT</div>
          <div style={{ ...mutedStyle, marginBottom: 12, lineHeight: 1.6 }}>
            Found a bug, need help, or have an idea to make DialerSeat better?
            Send it straight to us.
          </div>
          <button onClick={openSupport} style={editorButtonStyle}>
            CONTACT SUPPORT
          </button>
        </div>

        {/* TEAM SEATS */}
        {hasAnySeats && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              ▸ TEAM SEATS ({seats!.counts.totalSeats})
            </div>

            {seats!.ownerPaidSeats.map(seat => (
              <div key={seat.id} style={seatRowStyle('var(--brand-primary)')}>
                <div style={seatHeaderStyle}>
                  <span style={seatTeamStyle}>{seat.teamName}</span>
                  <span style={seatBadgeStyle('var(--brand-primary)')}>OWNER PAID</span>
                </div>
                <div style={seatDetailStyle}>
                  Paid by <strong style={{ color: CHROME.text }}>{seat.ownerName}</strong> · ${(seat.amountCents / 100).toFixed(2)} / WEEK
                </div>
                <div style={seatDetailStyle}>
                  Period: {formatDate(seat.periodStart)} → {formatDate(seat.periodEnd)}
                </div>
                <div style={{ ...seatDetailStyle, color: CHROME.muted, fontSize: 10, marginTop: 6 }}>
                  Only the team owner can cancel this seat.
                </div>
              </div>
            ))}

            {seats!.agentPaidSeats.map(seat => (
              <div key={seat.id} style={seatRowStyle('#8a6a1a')}>
                <div style={seatHeaderStyle}>
                  <span style={seatTeamStyle}>{seat.teamName}</span>
                  <span style={seatBadgeStyle('#ffaa3e')}>AGENT PAID</span>
                </div>
                <div style={seatDetailStyle}>
                  Campaign: <strong style={{ color: CHROME.text }}>{seat.campaignName || '—'}</strong>
                </div>
                <div style={seatDetailStyle}>
                  Owner: {seat.ownerName} · $35.00 / WEEK
                </div>
                <button
                  onClick={() => startCancelSeat(seat)}
                  disabled={seatCancelling === seat.id}
                  style={{
                    ...miniDangerButtonStyle,
                    opacity: seatCancelling === seat.id ? 0.4 : 1,
                    cursor: seatCancelling === seat.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {seatCancelling === seat.id ? 'CANCELING...' : 'CANCEL ACCESS'}
                </button>
              </div>
            ))}

            <div style={{
              fontSize: 10, color: CHROME.muted, letterSpacing: 1, lineHeight: 1.5,
              marginTop: 12, paddingTop: 12, borderTop: `1px solid ${CHROME.borderSoft}`,
            }}>
              Canceling a seat ends campaign access only. You remain on the team and can rejoin a campaign anytime. Refunds for partial periods are only available via dispute through your bank.
            </div>
          </div>
        )}

        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}

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

        {isAdmin && sub?.isActive && !sub.cancelAtPeriodEnd && (
          <div style={adminNoticeStyle}>
            ADMIN ACCOUNTS CANNOT CANCEL FROM THIS PANEL
          </div>
        )}

        {!isAdmin && sub?.isActive && !sub.cancelAtPeriodEnd && (
          <>
            {!confirming ? (
              <button onClick={handleStartCancel} style={dangerButtonStyle}>
                CANCEL SUBSCRIPTION
              </button>
            ) : (
              <div style={confirmBoxStyle}>
                <div style={confirmTextStyle}>
                  Cancel your subscription? You&apos;ll keep access until{' '}
                  <strong style={{ color: 'var(--brand-primary)' }}>
                    {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'period end'}
                  </strong>
                  . No further charges. Refunds for partial periods are only available via dispute through your bank.
                </div>

                <div style={typePromptStyle}>
                  Type <strong style={{ color: '#ff8888' }}>cancel</strong> to confirm:
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
                  <button onClick={handleAbortCancel} disabled={canceling} style={secondaryButtonStyle}>
                    KEEP SUBSCRIPTION
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={canceling || !confirmReady}
                    style={{
                      ...dangerButtonStyle, marginTop: 0, flex: 1,
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

        {/* DELETE ACCOUNT — separate from subscription cancellation; wipes app data + Clerk identity */}
        <div style={{ ...sectionStyle, borderLeft: '3px solid #8a1a1a', marginTop: 24 }}>
          <div style={{ ...sectionHeaderStyle, color: '#e0a0a0' }}>▸ DELETE ACCOUNT</div>
          <div style={{ ...mutedStyle, marginBottom: 12, lineHeight: 1.6 }}>
            Permanently deletes your DialerSeat account, leads, campaigns, calls, and sign-in.
            This cannot be undone.
          </div>
          {isAdmin ? (
            <div style={adminNoticeStyle}>ADMIN ACCOUNTS CANNOT SELF-DELETE FROM THIS PANEL</div>
          ) : (
            <button onClick={openDeleteAccount} style={miniDangerButtonStyle}>
              DELETE MY ACCOUNT
            </button>
          )}
        </div>
      </div>

      {seatConfirmTarget && (
        <div
          onClick={() => seatCancelling === null && (setSeatConfirmTarget(null), setSeatTypedConfirm(''))}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: CHROME.surface,
              border: `1px solid ${CHROME.border}`,
              borderTop: '3px solid #8a1a1a',
              borderRadius: 4, padding: 28,
              maxWidth: 460, width: '100%', fontFamily: FUTURA,
              color: CHROME.text,
            }}
          >
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: 4, color: '#ff8888', marginBottom: 14,
            }}>CANCEL SEAT ACCESS</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: CHROME.text, margin: '0 0 14px 0' }}>
              Cancel your access to <strong>{seatConfirmTarget.campaignName || 'this campaign'}</strong> on team <strong>{seatConfirmTarget.teamName}</strong>?
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: CHROME.muted, margin: '0 0 16px 0' }}>
              You stay on the team but lose dialing access to this campaign. Your $35/wk for this seat stops at period close. Refunds for partial periods are only available via dispute through your bank.
            </p>
            <div style={typePromptStyle}>
              Type <strong style={{ color: '#ff8888' }}>cancel</strong> to confirm:
            </div>
            <input
              type="text"
              value={seatTypedConfirm}
              onChange={e => setSeatTypedConfirm(e.target.value)}
              placeholder="cancel"
              autoFocus
              disabled={seatCancelling !== null}
              style={typeInputStyle}
            />
            <div className="settings-confirm-buttons" style={confirmButtonsStyle}>
              <button
                onClick={() => { setSeatConfirmTarget(null); setSeatTypedConfirm('') }}
                disabled={seatCancelling !== null}
                style={secondaryButtonStyle}
              >KEEP ACCESS</button>
              <button
                onClick={submitCancelSeat}
                disabled={seatCancelling !== null || seatTypedConfirm.toLowerCase().trim() !== 'cancel'}
                style={{
                  ...dangerButtonStyle, marginTop: 0, flex: 1,
                  opacity: (seatCancelling !== null || seatTypedConfirm.toLowerCase().trim() !== 'cancel') ? 0.4 : 1,
                  cursor: (seatCancelling !== null || seatTypedConfirm.toLowerCase().trim() !== 'cancel') ? 'not-allowed' : 'pointer',
                }}
              >
                {seatCancelling !== null ? 'CANCELING...' : 'CONFIRM CANCEL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupport && (
        <div
          onClick={closeSupport}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: CHROME.surface, border: `1px solid ${CHROME.border}`,
              borderTop: '3px solid var(--brand-primary)', borderRadius: 4, padding: 28,
              maxWidth: 460, width: '100%', fontFamily: FUTURA, color: CHROME.text,
              maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box',
            }}
          >
            {supportSubmitted ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--brand-primary)', marginBottom: 14 }}>
                  SENT
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 20px 0' }}>
                  Thanks — we&apos;ve got it and will follow up by email if we need anything else.
                </p>
                <button onClick={closeSupport} style={secondaryButtonStyle}>CLOSE</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'var(--brand-primary)', marginBottom: 14 }}>
                  CONTACT SUPPORT
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {([
                    { key: 'support', label: 'QUESTION' },
                    { key: 'bug', label: 'BUG' },
                    { key: 'suggestion', label: 'SUGGESTION' },
                  ] as const).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setSupportType(t.key)}
                      style={{
                        padding: '7px 12px', borderRadius: 3, cursor: 'pointer',
                        border: `1px solid ${supportType === t.key ? 'var(--brand-primary)' : CHROME.border}`,
                        background: supportType === t.key ? 'var(--brand-primary-soft)' : 'transparent',
                        color: supportType === t.key ? 'var(--brand-primary)' : CHROME.muted,
                        fontFamily: FUTURA, fontSize: 10, letterSpacing: 1.5, fontWeight: 700,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <label style={typePromptStyle}>SUBJECT (OPTIONAL)</label>
                <input
                  type="text"
                  value={supportSubject}
                  onChange={e => setSupportSubject(e.target.value)}
                  placeholder={supportType === 'suggestion' ? 'e.g. Dark mode for the dialer' : 'Short summary'}
                  maxLength={200}
                  style={{ ...typeInputStyle, color: CHROME.text, border: `1px solid ${CHROME.border}`, fontFamily: FUTURA }}
                />

                <label style={typePromptStyle}>
                  {supportType === 'suggestion' ? 'WHAT WOULD MAKE DIALERSEAT BETTER?' : 'WHAT\'S GOING ON?'}
                </label>
                <textarea
                  value={supportBody}
                  onChange={e => setSupportBody(e.target.value)}
                  placeholder={
                    supportType === 'bug' ? 'What happened, and what did you expect instead?'
                    : supportType === 'suggestion' ? 'Describe the idea — the more detail, the better.'
                    : 'Tell us what you need help with.'
                  }
                  maxLength={8000}
                  rows={5}
                  style={{
                    width: '100%', resize: 'vertical', boxSizing: 'border-box',
                    background: CHROME.sectionBg, border: `1px solid ${CHROME.border}`, borderRadius: 3,
                    color: CHROME.text, fontFamily: FUTURA, fontSize: 13, lineHeight: 1.6, padding: 12,
                    outline: 'none', marginBottom: 16,
                  }}
                />

                {supportError && <div style={errorStyle}>{supportError}</div>}

                <div className="settings-confirm-buttons" style={confirmButtonsStyle}>
                  <button onClick={closeSupport} disabled={supportSubmitting} style={secondaryButtonStyle}>
                    CANCEL
                  </button>
                  <button
                    onClick={submitSupport}
                    disabled={supportSubmitting || !supportBody.trim()}
                    style={{
                      ...secondaryButtonStyle, flex: 1,
                      opacity: supportSubmitting || !supportBody.trim() ? 0.4 : 1,
                      cursor: supportSubmitting || !supportBody.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {supportSubmitting ? 'SENDING...' : 'SEND'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showDelete && (
        <div
          onClick={closeDeleteAccount}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: CHROME.surface, border: `1px solid ${CHROME.border}`,
              borderTop: '3px solid #8a1a1a', borderRadius: 4, padding: 28,
              maxWidth: 460, width: '100%', fontFamily: FUTURA, color: CHROME.text,
              maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box',
            }}
          >
            {deleteStep === 'feedback' && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, color: '#ff8888', marginBottom: 10 }}>
                  BEFORE YOU GO
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 16px 0', color: CHROME.text }}>
                  How was your experience with DialerSeat? Your feedback goes straight to the
                  team — it genuinely helps us improve.
                </p>

                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setExitRating(n)}
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      style={{
                        flex: 1, padding: '10px 0', borderRadius: 3, cursor: 'pointer',
                        border: `1px solid ${exitRating >= n ? '#ffaa3e' : CHROME.border}`,
                        background: exitRating >= n ? 'rgba(255,170,62,0.14)' : 'transparent',
                        color: exitRating >= n ? '#ffaa3e' : CHROME.muted,
                        fontSize: 16, fontFamily: FUTURA,
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <textarea
                  value={exitFeedback}
                  onChange={e => setExitFeedback(e.target.value)}
                  placeholder="What worked, what didn't, what we should fix — anything at all."
                  maxLength={8000}
                  rows={5}
                  style={{
                    width: '100%', resize: 'vertical', boxSizing: 'border-box',
                    background: CHROME.sectionBg, border: `1px solid ${CHROME.border}`, borderRadius: 3,
                    color: CHROME.text, fontFamily: FUTURA, fontSize: 13, lineHeight: 1.6, padding: 12,
                    outline: 'none', marginBottom: 16,
                  }}
                />

                <div className="settings-confirm-buttons" style={confirmButtonsStyle}>
                  <button
                    onClick={() => submitExitFeedback(true)}
                    disabled={exitSubmitting}
                    style={secondaryButtonStyle}
                  >
                    SKIP
                  </button>
                  <button
                    onClick={() => submitExitFeedback(false)}
                    disabled={exitSubmitting}
                    style={{ ...secondaryButtonStyle, flex: 1 }}
                  >
                    {exitSubmitting ? 'SUBMITTING...' : 'SUBMIT & CONTINUE'}
                  </button>
                </div>
              </>
            )}

            {deleteStep === 'confirm' && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, color: '#ff8888', marginBottom: 14 }}>
                  PERMANENTLY DELETE YOUR ACCOUNT
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 14px 0', color: CHROME.text }}>
                  This removes your leads, campaigns, calls, recordings, team memberships, and
                  sign-in. This cannot be undone.
                </p>
                <p style={{ fontSize: 12, lineHeight: 1.6, margin: '0 0 16px 0', color: CHROME.muted }}>
                  If you have an active subscription, cancel it first — active accounts can&apos;t
                  be deleted until billing stops.
                </p>

                <div style={typePromptStyle}>
                  Type <strong style={{ color: '#ff8888' }}>DELETE</strong> to confirm:
                </div>
                <input
                  type="text"
                  value={deleteTypedConfirm}
                  onChange={e => setDeleteTypedConfirm(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                  disabled={deleteAccSubmitting}
                  style={typeInputStyle}
                />

                {deleteAccError && <div style={errorStyle}>{deleteAccError}</div>}

                <div className="settings-confirm-buttons" style={confirmButtonsStyle}>
                  <button onClick={closeDeleteAccount} disabled={deleteAccSubmitting} style={secondaryButtonStyle}>
                    KEEP MY ACCOUNT
                  </button>
                  <button
                    onClick={executeDeleteAccount}
                    disabled={deleteAccSubmitting || deleteTypedConfirm.trim().toUpperCase() !== 'DELETE'}
                    style={{
                      ...dangerButtonStyle, marginTop: 0, flex: 1,
                      opacity: deleteAccSubmitting || deleteTypedConfirm.trim().toUpperCase() !== 'DELETE' ? 0.4 : 1,
                      cursor: deleteAccSubmitting || deleteTypedConfirm.trim().toUpperCase() !== 'DELETE' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deleteAccSubmitting ? 'DELETING...' : 'DELETE PERMANENTLY'}
                  </button>
                </div>
              </>
            )}

            {deleteStep === 'done' && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, color: '#32ff7e', marginBottom: 14 }}>
                  ACCOUNT DELETED
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: CHROME.text }}>
                  Your data has been removed. Taking you home now — thanks for giving
                  DialerSeat a try.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function planLabelFor(plan: SubStatus['plan']): string {
  switch (plan) {
    case 'manager_plus': return 'MANAGER+'
    case 'both': return 'PRO + MANAGER+'
    case 'pro': return 'PRO'
    default: return ''
  }
}

function tierStatusLabel(sub: SubStatus | null, wlActive: boolean): string {
  if (!sub) return wlActive ? 'ACTIVE' : '—'
  if (sub.tier === 'lapsed' && !wlActive) return 'UNSUBSCRIBED'
  if (sub.cancelAtPeriodEnd) return `${sub.status?.toUpperCase()} (CANCELING)`
  return sub.status?.toUpperCase() || (wlActive ? 'ACTIVE' : '—')
}

function tierStatusColor(sub: SubStatus | null): string {
  if (!sub) return '#32ff7e'
  if (sub.tier === 'lapsed' && !sub.wlActive) return '#ffaa3e'
  if (sub.status === 'active' || sub.status === 'trialing') return '#32ff7e'
  if (sub.status === 'past_due') return '#ffaa3e'
  if (sub.wlActive) return '#32ff7e'
  return '#ff8888'
}



const pageStyle: React.CSSProperties = {
  flex: 1, minHeight: '100vh',
  background: 'var(--brand-sidebar-bg)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: 40, fontFamily: FUTURA,
}

const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 640,
  background: CHROME.surface,
  border: `1px solid ${CHROME.border}`,
  borderTop: '3px solid var(--brand-primary)',
  borderRadius: 4, padding: 32,
  color: CHROME.text,
  fontFamily: FUTURA, boxSizing: 'border-box',
}

const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, letterSpacing: 5,
  color: 'var(--brand-primary)', marginBottom: 4,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12, letterSpacing: 1,
  color: CHROME.muted,
  marginBottom: 28, wordBreak: 'break-word',
}

const sectionStyle: React.CSSProperties = {
  background: CHROME.sectionBg,
  border: `1px solid ${CHROME.border}`,
  borderLeft: '3px solid var(--brand-primary)',
  borderRadius: 3,
  padding: 16, marginBottom: 20,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: 3,
  color: CHROME.muted,
  marginBottom: 14, fontWeight: 700,
}

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 0',
  borderBottom: `1px solid ${CHROME.borderSoft}`,
  gap: 12, flexWrap: 'wrap',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 2, color: CHROME.muted,
}
const valueStyle: React.CSSProperties = {
  fontSize: 12, letterSpacing: 1,
  color: CHROME.text, fontWeight: 700,
}
const mutedStyle: React.CSSProperties = {
  fontSize: 12, color: CHROME.muted, letterSpacing: 1,
}

function brandSelectStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    background: CHROME.sectionBg,
    border: `1px solid ${CHROME.border}`,
    borderRadius: 3,
    color: CHROME.text,
    fontSize: 13,
    fontFamily: FUTURA,
    outline: 'none',
    cursor: disabled ? 'wait' : 'pointer',
  }
}

const editorButtonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 14,
  background: CHROME.surface,
  borderTop: '3px solid var(--brand-primary)',
  border: 'none',
  borderRadius: 4,
  color: 'var(--brand-primary)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 4,
  fontFamily: FUTURA,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box',
}

const dangerButtonStyle: React.CSSProperties = {
  width: '100%', padding: 14,
  background: CHROME.surface,
  border: 'none',
  borderTop: '3px solid #8a1a1a',
  borderRadius: 4, color: '#ff8888',
  fontSize: 12, fontWeight: 700, letterSpacing: 4, cursor: 'pointer',
  fontFamily: FUTURA, marginTop: 8,
}

const miniDangerButtonStyle: React.CSSProperties = {
  marginTop: 10, padding: '8px 14px', background: 'transparent',
  border: '1px solid #8a1a1a', borderRadius: 3, color: '#ff8888',
  fontSize: 10, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
  fontFamily: FUTURA,
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1, padding: 14,
  background: CHROME.surface,
  border: 'none',
  borderTop: '3px solid var(--brand-primary)',
  borderRadius: 4, color: 'var(--brand-primary)',
  fontSize: 11, fontWeight: 700, letterSpacing: 3, cursor: 'pointer', fontFamily: FUTURA,
}

const confirmBoxStyle: React.CSSProperties = {
  background: 'rgba(138, 26, 26, 0.18)',
  border: '1px solid #8a1a1a',
  borderLeft: '3px solid #8a1a1a',
  borderRadius: 4, padding: 16, marginTop: 8,
}

const confirmTextStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: 1.6,
  color: '#e0c2c2',
  marginBottom: 16,
}

const typePromptStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 1,
  color: '#e0c2c2',
  marginBottom: 8,
}

const typeInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: CHROME.sectionBg,
  border: '1px solid #8a1a1a',
  borderRadius: 3,
  fontFamily: 'monospace', fontSize: 13, color: '#ff8888',
  outline: 'none', marginBottom: 16, letterSpacing: 1, boxSizing: 'border-box',
}

const confirmButtonsStyle: React.CSSProperties = { display: 'flex', gap: 8 }

const successStyle: React.CSSProperties = {
  background: 'rgba(26, 106, 26, 0.18)',
  border: '1px solid #1a6a1a',
  borderLeft: '3px solid #1a6a1a',
  color: '#32ff7e',
  padding: 12, borderRadius: 3, fontSize: 11, letterSpacing: 1, marginBottom: 16,
}

const errorStyle: React.CSSProperties = {
  background: 'rgba(138, 26, 26, 0.18)',
  border: '1px solid #8a1a1a',
  borderLeft: '3px solid #8a1a1a',
  color: '#ff8888',
  padding: 12, borderRadius: 3, fontSize: 11, letterSpacing: 1, marginBottom: 16,
}

const warnStyle: React.CSSProperties = {
  background: 'rgba(138, 106, 26, 0.18)',
  border: '1px solid #8a6a1a',
  borderLeft: '3px solid #8a6a1a',
  color: '#ffaa3e',
  padding: 12, borderRadius: 3, fontSize: 11, letterSpacing: 1, marginTop: 16,
}

const adminNoticeStyle: React.CSSProperties = {
  background: 'var(--brand-primary-soft)',
  border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent)',
  borderLeft: '3px solid var(--brand-primary)',
  color: 'var(--brand-primary)',
  padding: 12, borderRadius: 3, fontSize: 10, letterSpacing: 3, fontWeight: 700, marginTop: 16,
}

const resubscribeBoxStyle: React.CSSProperties = {
  background: 'rgba(138, 106, 26, 0.18)',
  border: '1px solid #8a6a1a',
  borderLeft: '3px solid #8a6a1a',
  borderRadius: 3, padding: 16, marginBottom: 16,
}

const resubscribeHeaderStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 3, color: '#ffaa3e', fontWeight: 700, marginBottom: 8,
}

const resubscribeTextStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: 1.6,
  color: CHROME.text,
  marginBottom: 14,
}

const resubscribeButtonStyle: React.CSSProperties = {
  width: '100%', padding: 14,
  background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 75%, black))',
  border: 'none', borderRadius: 4,
  color: 'var(--brand-on-primary)',
  fontSize: 12, fontWeight: 700, letterSpacing: 4, cursor: 'pointer',
  fontFamily: FUTURA,
  boxShadow: '0 0 15px color-mix(in srgb, var(--brand-primary) 25%, transparent)',
}

function seatRowStyle(borderColor: string): React.CSSProperties {
  return {
    background: CHROME.surface,
    border: `1px solid ${borderColor}`,
    borderLeft: `3px solid ${borderColor}`, borderRadius: 3,
    padding: 14, marginBottom: 10,
  }
}

const seatHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 8, gap: 10, flexWrap: 'wrap',
}

const seatTeamStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, letterSpacing: 1,
  color: CHROME.text,
}

function seatBadgeStyle(color: string): React.CSSProperties {
  return {
    padding: '3px 10px', borderRadius: 3, fontSize: 9, fontWeight: 700,
    letterSpacing: 2, color, border: `1px solid ${color}`, background: 'transparent',
    fontFamily: 'monospace',
  }
}

const seatDetailStyle: React.CSSProperties = {
  fontSize: 11,
  color: CHROME.muted,
  letterSpacing: 0.5, lineHeight: 1.5, marginTop: 4,
}