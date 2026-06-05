'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { WhitelabelLivePreview } from '@/components/WhitelabelLivePreview'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

// =============================================================================
// SETTINGS PAGE (v26 — Pass 2 expansion: 3-color theme editor)
// =============================================================================
// Changes vs v25:
//   - Inline theme editor now handles 3 colors (sidebar + primary + page-bg)
//     to match the migration 003 expansion. Custom mode shows a third
//     DarkColorRow for Page background.
//   - WhitelabelLivePreview receives pageBg so the user sees themed page-bg
//     with auto-contrast body text + derived card surfaces inline.
//   - Preset matching on load now checks all 3 colors (falls to Custom
//     if any differ).
//   - POST body sends page_bg_color.
//
// Preserved from v25:
//   - The ▸ YOUR WHITELABEL section (which was a single "EDIT YOUR
//     WHITELABEL →" link to /onboarding/whitelabel) is replaced with
//     ▸ YOUR WHITELABEL THEME — an inline editor with presets, custom
//     picker, WhitelabelLivePreview, 60-sec disclaimer, and a SAVE
//     THEME button. POSTs to the same /api/whitelabel/onboarding endpoint
//     used by the full onboarding page.
//   - A small footnote link to /onboarding/whitelabel is kept for users
//     who need to change brand name, subdomain, or logo.
//   - All other sections (brand view toggle, subscription, team seats,
//     cancel flow, resubscribe, seat-cancel modal) preserved byte-for-byte.
//
// JC's directive: "keep the background of this page the same for all
// whitelabel accounts. only change the center content to match." Honored:
// the page chrome stays in DialerSeat dark default. The only element
// reflecting the tenant's chosen colors is the WhitelabelLivePreview
// component inside the new theme section.
// =============================================================================

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

interface BrandOptions {
  available: AvailableTenant[]
  canSeeStandard: boolean
  currentTenantId: string | null
}

interface TenantData {
  brand_name: string
  slug: string
  logo_url: string | null
  primary_color: string
  sidebar_color: string
  page_bg_color: string
}

interface Preset {
  key: string
  label: string
  description: string
  primary: string
  sidebar: string
  pageBg: string
}

const PRESETS: Preset[] = [
  {
    key: 'stone-lavender',
    label: 'Stone & Lavender',
    description: 'Gray-white sidebar, lavender accents, faint lavender page.',
    primary: '#b8a3e0',
    sidebar: '#e4e6eb',
    pageBg: '#f1ecf7',
  },
  {
    key: 'forest',
    label: 'Forest',
    description: 'Forest sidebar, leaf-green accents, fresh green page.',
    primary: '#5fb87a',
    sidebar: '#1a3a26',
    pageBg: '#ecf5e8',
  },
  {
    key: 'bloom',
    label: 'Bloom',
    description: 'Brown sidebar, rose pink accents, soft rose page.',
    primary: '#e8b8c5',
    sidebar: '#6e5142',
    pageBg: '#fbeef2',
  },
]

const HEX_RE = /^#[0-9a-fA-F]{6}$/

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

  // ── Inline theme editor state (Pass 2 expansion: 3 colors) ────────
  const [tenantData, setTenantData] = useState<TenantData | null>(null)
  const [presetKey, setPresetKey] = useState<string>(PRESETS[0].key)
  const [primary, setPrimary] = useState<string>(PRESETS[0].primary)
  const [sidebar, setSidebar] = useState<string>(PRESETS[0].sidebar)
  const [pageBg, setPageBg] = useState<string>(PRESETS[0].pageBg)
  const [themeSaving, setThemeSaving] = useState(false)
  const [themeFeedback, setThemeFeedback] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null)

  const loadStatus = async () => {
    try {
      const [statusRes, summaryRes, brandRes, tenantRes] = await Promise.all([
        fetch('/api/stripe/status'),
        fetch('/api/subscriptions/summary'),
        fetch('/api/whitelabel/available-tenants'),
        fetch('/api/whitelabel/onboarding'),
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
          canSeeStandard: !!brandData.canSeeStandard,
          currentTenantId: brandData.currentTenantId ?? null,
        })
      }
      if (tenantRes.ok) {
        const tenantPayload = await tenantRes.json()
        if (tenantPayload.tenant) {
          const t: TenantData = {
            brand_name: tenantPayload.tenant.brand_name,
            slug: tenantPayload.tenant.slug,
            logo_url: tenantPayload.tenant.logo_url,
            primary_color: tenantPayload.tenant.primary_color || PRESETS[0].primary,
            sidebar_color: tenantPayload.tenant.sidebar_color || PRESETS[0].sidebar,
            page_bg_color: tenantPayload.tenant.page_bg_color || PRESETS[0].pageBg,
          }
          setTenantData(t)
          setPrimary(t.primary_color)
          setSidebar(t.sidebar_color)
          setPageBg(t.page_bg_color)
          const match = PRESETS.find(
            p =>
              p.primary.toLowerCase() === t.primary_color.toLowerCase() &&
              p.sidebar.toLowerCase() === t.sidebar_color.toLowerCase() &&
              p.pageBg.toLowerCase() === t.page_bg_color.toLowerCase()
          )
          setPresetKey(match?.key || 'custom')
        }
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
    const tenant_id = value === 'standard' ? null : value
    setSwitchingBrand(true)
    setError(null); setMessage(null)
    try {
      const res = await fetch('/api/whitelabel/switch-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id }),
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

  // ── Theme editor handlers (3-color) ───────────────────────────────
  const applyPreset = (key: string) => {
    setPresetKey(key)
    setThemeFeedback(null)
    if (key === 'custom') return
    const p = PRESETS.find(p => p.key === key)
    if (p) {
      setPrimary(p.primary)
      setSidebar(p.sidebar)
      setPageBg(p.pageBg)
    }
  }

  const updateColor = (field: 'primary' | 'sidebar' | 'pageBg', value: string) => {
    if (field === 'primary') setPrimary(value)
    else if (field === 'sidebar') setSidebar(value)
    else setPageBg(value)
    setPresetKey('custom')
    setThemeFeedback(null)
  }

  const handleSaveTheme = async () => {
    if (!tenantData) return
    if (!HEX_RE.test(primary)) {
      setThemeFeedback({ kind: 'error', text: 'Primary must be a #RRGGBB hex value.' })
      return
    }
    if (!HEX_RE.test(sidebar)) {
      setThemeFeedback({ kind: 'error', text: 'Sidebar must be a #RRGGBB hex value.' })
      return
    }
    if (!HEX_RE.test(pageBg)) {
      setThemeFeedback({ kind: 'error', text: 'Page background must be a #RRGGBB hex value.' })
      return
    }

    setThemeSaving(true)
    setThemeFeedback(null)
    try {
      const res = await fetch('/api/whitelabel/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: tenantData.brand_name,
          subdomain: tenantData.slug,
          logo_url: tenantData.logo_url,
          primary_color: primary,
          sidebar_color: sidebar,
          page_bg_color: pageBg,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setThemeFeedback({
          kind: 'error',
          text: data.detail || data.error || 'Failed to save theme.',
        })
        return
      }
      setThemeFeedback({
        kind: 'success',
        text: 'Theme saved. Propagating site-wide now — up to 60 seconds for everyone else.',
      })
      // Update locally so a refresh isn't needed for the live preview
      setTenantData({
        ...tenantData,
        primary_color: primary,
        sidebar_color: sidebar,
        page_bg_color: pageBg,
      })
    } catch (err: any) {
      setThemeFeedback({ kind: 'error', text: err.message || 'Network error.' })
    } finally {
      setThemeSaving(false)
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

  const optionCount = (brandOptions?.available.length || 0) +
                      (brandOptions?.canSeeStandard ? 1 : 0)
  const showBrandToggle = optionCount >= 2

  const currentBrandValue = brandOptions?.currentTenantId ?? 'standard'

  const wlActive = !!sub?.wlActive
  const planLabel = planLabelFor(sub?.plan)
  const weeklyPrice = sub?.weeklyPrice ?? (sub?.hasSubscription ? 35 : 0)

  const activePreset = PRESETS.find(p => p.key === presetKey)

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
            <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: 3, color: '#4a9eff', fontWeight: 'bold' }}>· ADMIN</span>
          )}
          {!isAdmin && planLabel && (
            <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: 3, color: '#4a9eff', fontWeight: 'bold' }}>· {planLabel}</span>
          )}
          {!isAdmin && sub?.tier === 'lapsed' && !wlActive && (
            <span style={{ marginLeft: 8, fontSize: 9, letterSpacing: 3, color: '#ffaa3e', fontWeight: 'bold' }}>· UNSUBSCRIBED</span>
          )}
        </div>

        {/* BRAND VIEW TOGGLE */}
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
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0d0e14',
                border: '1px solid #2a4a8a',
                borderRadius: 3,
                color: '#e0e2ea',
                fontSize: 13,
                fontFamily: FUTURA,
                outline: 'none',
                cursor: switchingBrand ? 'wait' : 'pointer',
              }}
            >
              {brandOptions.canSeeStandard && (
                <option value="standard">
                  DialerSeat Pro (default view)
                </option>
              )}
              {brandOptions.available.map(t => (
                <option key={t.id} value={t.id}>
                  {t.brand_name}{t.role === 'owner' ? ' (your tenant)' : ''}
                </option>
              ))}
            </select>

            {switchingBrand && (
              <div style={{ ...mutedStyle, marginTop: 8, fontSize: 10 }}>
                Switching view…
              </div>
            )}
          </div>
        )}

        {/* ── YOUR WHITELABEL THEME (3-color inline editor) ── */}
        {wlActive && tenantData && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>▸ YOUR WHITELABEL THEME</div>
            <div style={{ ...mutedStyle, marginBottom: 14, lineHeight: 1.6 }}>
              Pick a preset or fine-tune your colors. Saves apply to your
              sign-in page, sidebar, and dashboard chrome within 60 seconds.
            </div>

            {/* Preset cards */}
            <div style={themePresetGridStyle}>
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  style={themePresetCardStyle(presetKey === p.key)}
                >
                  <div style={themePresetSwatchRowStyle}>
                    <div style={{ ...themePresetSwatchStyle, background: p.sidebar }} />
                    <div style={{ ...themePresetSwatchStyle, background: p.primary }} />
                    <div style={{ ...themePresetSwatchStyle, background: p.pageBg }} />
                  </div>
                  <div style={themePresetNameStyle(presetKey === p.key)}>{p.label}</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                style={themePresetCardStyle(presetKey === 'custom')}
              >
                <div
                  style={{
                    ...themePresetSwatchRowStyle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 24,
                    color: '#888a92',
                    fontSize: 18,
                    letterSpacing: 0,
                  }}
                >
                  ✎
                </div>
                <div style={themePresetNameStyle(presetKey === 'custom')}>Custom</div>
              </button>
            </div>

            <div style={{ fontSize: 11, color: '#888a92', letterSpacing: 0.5, lineHeight: 1.6, marginBottom: 14 }}>
              {presetKey === 'custom'
                ? 'Pick your own sidebar, primary, and page background colors below.'
                : activePreset?.description}
            </div>

            {presetKey === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <DarkColorRow
                  label="Sidebar"
                  description="Sidebar background, header strip, primary button background"
                  value={sidebar}
                  onChange={v => updateColor('sidebar', v)}
                />
                <DarkColorRow
                  label="Primary"
                  description="Buttons, accents, active states, focus rings, chart line"
                  value={primary}
                  onChange={v => updateColor('primary', v)}
                />
                <DarkColorRow
                  label="Page background"
                  description="Main background of every dashboard page — body text auto-contrasts"
                  value={pageBg}
                  onChange={v => updateColor('pageBg', v)}
                />
              </div>
            )}

            {/* Live preview — the ONLY element on this page reflecting tenant colors */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: '#888a92', marginBottom: 8, fontWeight: 700 }}>
                EXACT PREVIEW
              </div>
              <WhitelabelLivePreview
                primary={primary}
                sidebar={sidebar}
                pageBg={pageBg}
                brandName={tenantData.brand_name}
                logoUrl={tenantData.logo_url}
              />
            </div>

            {/* Disclaimer */}
            <div style={themeDisclaimerStyle}>
              <strong style={{ color: '#4a9eff', letterSpacing: 2 }}>ⓘ HEADS UP</strong>
              <div style={{ marginTop: 4 }}>
                Your browser updates instantly on save. Other users (your team,
                your customers) will see the new look after their next page load,
                up to 60 seconds later.
              </div>
            </div>

            {/* Feedback */}
            {themeFeedback && (
              <div style={themeFeedback.kind === 'success' ? themeSuccessStyle : themeErrorStyle}>
                {themeFeedback.text}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSaveTheme}
              disabled={themeSaving}
              style={{
                ...themeSaveButtonStyle,
                opacity: themeSaving ? 0.6 : 1,
                cursor: themeSaving ? 'wait' : 'pointer',
              }}
            >
              {themeSaving ? 'SAVING...' : 'SAVE THEME'}
            </button>

            {/* Small link to full editor */}
            <div style={{ marginTop: 14, fontSize: 11, letterSpacing: 0.5, color: '#888a92', lineHeight: 1.6 }}>
              Need to change your brand name, subdomain, or logo?{' '}
              <Link href="/onboarding/whitelabel" style={{ color: '#4a9eff', textDecoration: 'underline' }}>
                Open the full editor →
              </Link>
            </div>
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

        {/* TEAM SEATS */}
        {hasAnySeats && (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              ▸ TEAM SEATS ({seats!.counts.totalSeats})
            </div>

            {seats!.ownerPaidSeats.map(seat => (
              <div key={seat.id} style={seatRowStyle('#1a4a8a')}>
                <div style={seatHeaderStyle}>
                  <span style={seatTeamStyle}>{seat.teamName}</span>
                  <span style={seatBadgeStyle('#4a9eff')}>OWNER PAID</span>
                </div>
                <div style={seatDetailStyle}>
                  Paid by <strong style={{ color: '#e0e2ea' }}>{seat.ownerName}</strong> · ${(seat.amountCents / 100).toFixed(2)} / WEEK
                </div>
                <div style={seatDetailStyle}>
                  Period: {formatDate(seat.periodStart)} → {formatDate(seat.periodEnd)}
                </div>
                <div style={{ ...seatDetailStyle, color: '#666870', fontSize: 10, marginTop: 6 }}>
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
                  Campaign: <strong style={{ color: '#e0e2ea' }}>{seat.campaignName || '—'}</strong>
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
              fontSize: 10, color: '#666870', letterSpacing: 1, lineHeight: 1.5,
              marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a2c34',
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
            ▸ ADMIN ACCOUNTS CANNOT CANCEL FROM THIS PANEL
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
                  <strong style={{ color: '#4a9eff' }}>
                    {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : 'period end'}
                  </strong>
                  . No further charges. Refunds for partial periods are only available via dispute through your bank.
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
      </div>

      {seatConfirmTarget && (
        <div
          onClick={() => seatCancelling === null && (setSeatConfirmTarget(null), setSeatTypedConfirm(''))}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1c24', border: '1px solid #2a2c34',
              borderTop: '3px solid #8a1a1a', borderRadius: 4, padding: 28,
              maxWidth: 460, width: '100%', fontFamily: FUTURA, color: '#e0e2ea',
            }}
          >
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: 4, color: '#ff6464', marginBottom: 14,
            }}>CANCEL SEAT ACCESS</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#e0e2ea', margin: '0 0 14px 0' }}>
              Cancel your access to <strong>{seatConfirmTarget.campaignName || 'this campaign'}</strong> on team <strong>{seatConfirmTarget.teamName}</strong>?
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: '#888a92', margin: '0 0 16px 0' }}>
              You stay on the team but lose dialing access to this campaign. Your $35/wk for this seat stops at period close. Refunds for partial periods are only available via dispute through your bank.
            </p>
            <div style={typePromptStyle}>
              Type <strong style={{ color: '#ff6464' }}>cancel</strong> to confirm:
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
    </div>
  )
}

// ─── Dark-themed ColorRow for the theme editor ──────────────────────
function DarkColorRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      background: '#0a0b10',
      border: '1px solid #2a2c34',
      borderRadius: 4,
    }}>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 40,
          height: 40,
          padding: 0,
          border: '1px solid #2a2c34',
          borderRadius: 4,
          background: 'transparent',
          cursor: 'pointer',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: '#e0e2ea' }}>{label}</div>
        <div style={{ fontSize: 10, color: '#888a92', letterSpacing: 0.5, marginTop: 2, lineHeight: 1.5 }}>{description}</div>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={7}
        style={{
          width: 90,
          padding: '8px 10px',
          background: '#1a1c24',
          border: '1px solid #2a2c34',
          borderRadius: 3,
          color: '#e0e2ea',
          fontSize: 12,
          fontFamily: 'monospace',
          outline: 'none',
          boxSizing: 'border-box',
          letterSpacing: 0.5,
        }}
      />
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
  return '#ff6464'
}

const pageStyle: React.CSSProperties = {
  flex: 1, minHeight: 'calc(100vh - 64px)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: 40, fontFamily: FUTURA,
}

const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 640, background: '#1a1c24',
  border: '1px solid #2a2c34', borderTop: '3px solid #4a9eff',
  borderRadius: 4, padding: 32, color: '#e0e2ea',
  fontFamily: FUTURA, boxSizing: 'border-box',
}

const titleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, letterSpacing: 5, color: '#4a9eff', marginBottom: 4,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12, letterSpacing: 1, color: '#888a92', marginBottom: 28, wordBreak: 'break-word',
}

const sectionStyle: React.CSSProperties = {
  background: '#0d0e14', border: '1px solid #2a2c34',
  borderLeft: '3px solid #4a9eff', borderRadius: 3,
  padding: 16, marginBottom: 20,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: 3, color: '#888a92', marginBottom: 14, fontWeight: 700,
}

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '8px 0', borderBottom: '1px solid #2a2c34', gap: 12, flexWrap: 'wrap',
}

const labelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 2, color: '#888a92' }
const valueStyle: React.CSSProperties = { fontSize: 12, letterSpacing: 1, color: '#e0e2ea', fontWeight: 700 }
const mutedStyle: React.CSSProperties = { fontSize: 12, color: '#888a92', letterSpacing: 1 }

const dangerButtonStyle: React.CSSProperties = {
  width: '100%', padding: 14, background: '#0d0e14', border: 'none',
  borderTop: '3px solid #8a1a1a', borderRadius: 4, color: '#ff6464',
  fontSize: 12, fontWeight: 700, letterSpacing: 4, cursor: 'pointer',
  fontFamily: FUTURA, marginTop: 8,
}

const miniDangerButtonStyle: React.CSSProperties = {
  marginTop: 10, padding: '8px 14px', background: 'transparent',
  border: '1px solid #8a1a1a', borderRadius: 3, color: '#ff6464',
  fontSize: 10, fontWeight: 700, letterSpacing: 2, cursor: 'pointer',
  fontFamily: FUTURA,
}

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1, padding: 14, background: '#0d0e14', border: 'none',
  borderTop: '3px solid #4a9eff', borderRadius: 4, color: '#4a9eff',
  fontSize: 11, fontWeight: 700, letterSpacing: 3, cursor: 'pointer', fontFamily: FUTURA,
}

const confirmBoxStyle: React.CSSProperties = {
  background: '#2a1a1a', border: '1px solid #8a1a1a', borderRadius: 4, padding: 16, marginTop: 8,
}

const confirmTextStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: 1.6, color: '#e0c2c2', marginBottom: 16,
}

const typePromptStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 1, color: '#e0c2c2', marginBottom: 8,
}

const typeInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: '#0d0e14',
  border: '1px solid #4a2a2a', borderRadius: 3,
  fontFamily: 'monospace', fontSize: 13, color: '#ff8888',
  outline: 'none', marginBottom: 16, letterSpacing: 1, boxSizing: 'border-box',
}

const confirmButtonsStyle: React.CSSProperties = { display: 'flex', gap: 8 }

const successStyle: React.CSSProperties = {
  background: '#1a2a1a', border: '1px solid #1a6a1a', color: '#32ff7e',
  padding: 12, borderRadius: 3, fontSize: 11, letterSpacing: 1, marginBottom: 16,
}

const errorStyle: React.CSSProperties = {
  background: '#2a1a1a', border: '1px solid #8a1a1a', color: '#ff6464',
  padding: 12, borderRadius: 3, fontSize: 11, letterSpacing: 1, marginBottom: 16,
}

const warnStyle: React.CSSProperties = {
  background: '#2a221a', border: '1px solid #8a6a1a', color: '#ffaa3e',
  padding: 12, borderRadius: 3, fontSize: 11, letterSpacing: 1, marginTop: 16,
}

const adminNoticeStyle: React.CSSProperties = {
  background: 'rgba(74,158,255,0.06)', border: '1px solid #2a4a8a',
  borderLeft: '3px solid #4a9eff', color: '#4a9eff',
  padding: 12, borderRadius: 3, fontSize: 10, letterSpacing: 3, fontWeight: 700, marginTop: 16,
}

const resubscribeBoxStyle: React.CSSProperties = {
  background: 'rgba(255,170,62,0.06)', border: '1px solid #8a6a1a',
  borderLeft: '3px solid #ffaa3e', borderRadius: 3, padding: 16, marginBottom: 16,
}

const resubscribeHeaderStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 3, color: '#ffaa3e', fontWeight: 700, marginBottom: 8,
}

const resubscribeTextStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: 1.6, color: '#e0e2ea', marginBottom: 14,
}

const resubscribeButtonStyle: React.CSSProperties = {
  width: '100%', padding: 14, background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
  border: 'none', borderRadius: 4, color: 'white',
  fontSize: 12, fontWeight: 700, letterSpacing: 4, cursor: 'pointer',
  fontFamily: FUTURA, boxShadow: '0 0 15px rgba(74,158,255,0.25)',
}

function seatRowStyle(borderColor: string): React.CSSProperties {
  return {
    background: '#0d0e14', border: `1px solid ${borderColor}`,
    borderLeft: `3px solid ${borderColor}`, borderRadius: 3,
    padding: 14, marginBottom: 10,
  }
}

const seatHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 8, gap: 10, flexWrap: 'wrap',
}

const seatTeamStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#e0e2ea',
}

function seatBadgeStyle(color: string): React.CSSProperties {
  return {
    padding: '3px 10px', borderRadius: 3, fontSize: 9, fontWeight: 700,
    letterSpacing: 2, color, border: `1px solid ${color}`, background: 'transparent',
    fontFamily: 'monospace',
  }
}

const seatDetailStyle: React.CSSProperties = {
  fontSize: 11, color: '#888a92', letterSpacing: 0.5, lineHeight: 1.5, marginTop: 4,
}

// ─── Inline theme editor styles ─────────────────────────────────────

const themePresetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: 8,
  marginBottom: 12,
}

function themePresetCardStyle(selected: boolean): React.CSSProperties {
  return {
    background: '#0a0b10',
    border: selected ? '2px solid #4a9eff' : '1px solid #2a2c34',
    padding: selected ? 9 : 10,
    borderRadius: 4,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: FUTURA,
    transition: 'border-color 0.15s',
  }
}

const themePresetSwatchRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginBottom: 8,
}

const themePresetSwatchStyle: React.CSSProperties = {
  width: 26,
  height: 24,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.08)',
}

function themePresetNameStyle(selected: boolean): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: 700,
    color: selected ? '#4a9eff' : '#e0e2ea',
  }
}

const themeDisclaimerStyle: React.CSSProperties = {
  background: 'rgba(74,158,255,0.06)',
  border: '1px solid rgba(74,158,255,0.3)',
  borderLeft: '3px solid #4a9eff',
  borderRadius: 4,
  padding: '10px 14px',
  marginBottom: 14,
  fontSize: 11,
  lineHeight: 1.6,
  color: '#e0e2ea',
  letterSpacing: 0.3,
}

const themeSuccessStyle: React.CSSProperties = {
  background: '#1a2a1a',
  border: '1px solid #1a6a1a',
  borderLeft: '3px solid #32ff7e',
  color: '#32ff7e',
  padding: 12,
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 0.5,
  lineHeight: 1.5,
  marginBottom: 12,
}

const themeErrorStyle: React.CSSProperties = {
  background: '#2a1a1a',
  border: '1px solid #8a1a1a',
  borderLeft: '3px solid #ff6464',
  color: '#ff6464',
  padding: 12,
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 0.5,
  lineHeight: 1.5,
  marginBottom: 12,
}

const themeSaveButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  background: '#0d0e14',
  borderTop: '3px solid #4a9eff',
  border: 'none',
  borderRadius: 4,
  color: '#4a9eff',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 4,
  fontFamily: FUTURA,
}