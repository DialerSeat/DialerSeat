'use client'
import { useEffect, useRef, useState } from 'react'
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

type Plan = 'standard' | 'wl'

const PLAN_INFO = {
  standard: {
    label: 'PRO',
    price: 35,
    title: 'Start your subscription',
    subtitle: 'Pay $35 today and start dialing immediately.',
    weeklyBlurb: '$35.00 USD',
    description: 'DialerSeat Pro — one agent seat, all features, billed weekly.',
    switchLabel: 'Switch to Manager+ ($75/wk)',
  },
  wl: {
    label: 'MANAGER+',
    price: 75,
    title: 'Customize your whitelabel dialer',
    subtitle: 'Pay $75 today to provision your branded dialer.',
    weeklyBlurb: '$75.00 USD',
    description:
      'Manager+ unlocks white-label DialerSeat — your subdomain, your branding, full team control. After payment, you\u2019ll pick your subdomain, upload your logo, and set your brand colors.',
    switchLabel: 'Switch to Pro ($35/wk)',
  },
} as const

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

// Builds the actual "charged today" / "billed thereafter" copy from the real
// Stripe invoice + coupon, instead of a static plan price that never moved
// when a coupon was applied. Falls back to the plan's base price only when
// we don't have real numbers yet (first paint, before create-subscription
// has returned).
function describeBilling(
  planInfo: (typeof PLAN_INFO)[Plan],
  amounts: { subtotalCents: number; totalCents: number; currency: string } | null,
  coupon: {
    percentOff: number | null
    amountOffCents: number | null
    duration: 'once' | 'repeating' | 'forever'
    durationInMonths: number | null
  } | null
) {
  const fallback = planInfo.weeklyBlurb
  if (!amounts) {
    return {
      todayLabel: fallback,
      recurringLabel: fallback,
      hasDiscount: false,
      todayCents: null as number | null,
    }
  }

  const todayLabel = formatCents(amounts.totalCents, amounts.currency)
  const fullLabel = formatCents(amounts.subtotalCents, amounts.currency)
  const hasDiscount = amounts.totalCents !== amounts.subtotalCents

  if (!hasDiscount || !coupon) {
    return { todayLabel, recurringLabel: todayLabel, hasDiscount: false, todayCents: amounts.totalCents }
  }

  // Recurring line depends on how long the coupon actually lasts.
  let recurringLabel: string
  if (coupon.duration === 'forever') {
    recurringLabel = `${todayLabel} weekly (discount applies permanently)`
  } else if (coupon.duration === 'repeating' && coupon.durationInMonths) {
    recurringLabel = `${todayLabel} weekly for ${coupon.durationInMonths} month${coupon.durationInMonths === 1 ? '' : 's'}, then ${fullLabel} weekly`
  } else {
    // 'once' — discount only applies to this first invoice
    recurringLabel = `${fullLabel} weekly`
  }

  return { todayLabel, recurringLabel, hasDiscount: true, fullLabel, todayCents: amounts.totalCents }
}

function BrandMark() {
  return (
    <div style={brandRowStyle}>
      <div style={brandMarkStyle}>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>D</span>
      </div>
      <span style={brandNameStyle}>DIALERSEAT</span>
    </div>
  )
}

function LoadingCard({ text }: { text: string }) {
  return (
    <main style={pageStyle}>
      <div style={narrowShellStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '48px 32px' }}>
          <BrandMark />
          <div style={{ ...mutedTextStyle, margin: 0 }}>{text}</div>
        </div>
      </div>
    </main>
  )
}

export default function BillingPage() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialPlan: Plan = searchParams.get('plan') === 'wl' ? 'wl' : 'standard'
  const teamMemberId = searchParams.get('teamMemberId')
  const [plan, setPlan] = useState<Plan>(initialPlan)
  const planInfo = PLAN_INFO[plan]

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [retryingBilling, setRetryingBilling] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [promoAction, setPromoAction] = useState<'applying' | 'removing' | null>(null)
  const [promoApplied, setPromoApplied] = useState<string | null>(null)
  const [freeWithCoupon, setFreeWithCoupon] = useState(false)
  const [amounts, setAmounts] = useState<{ subtotalCents: number; totalCents: number; currency: string } | null>(null)
  const [coupon, setCoupon] = useState<{
    percentOff: number | null
    amountOffCents: number | null
    duration: 'once' | 'repeating' | 'forever'
    durationInMonths: number | null
  } | null>(null)
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
        if (teamMemberId) {
          try {
            await fetch('/api/teams/activate-existing-subscriber', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ teamMemberId }),
            })
          } catch {}
          router.push('/dashboard/dialer')
          return
        }
        router.push('/dashboard')
        return
      }

      const createRes = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: usePlan,
          ...(codeToApply ? { code: codeToApply } : {}),
          ...(teamMemberId ? { teamMemberId } : {}),
        }),
      })
      const createData = await createRes.json()

      if (!createRes.ok) {
        setError(createData.error || 'Failed to start subscription')
        setCheckingStatus(false)
        setPromoAction(null)
        setRetryingBilling(false)
        setSwitchingPlan(false)
        return
      }

      if (createData.freeWithCoupon) {
        setFreeWithCoupon(true)
        setAmounts(createData.amounts ?? null)
        setCoupon(createData.coupon ?? null)
        setCheckingStatus(false)
        setPromoAction(null)
        setRetryingBilling(false)
        setSwitchingPlan(false)
        const successPath = usePlan === 'wl' ? '/onboarding/whitelabel' : '/dashboard'
        setTimeout(() => router.push(successPath), 1500)
        return
      }

      setClientSecret(createData.clientSecret)
      setAmounts(createData.amounts ?? null)
      setCoupon(createData.coupon ?? null)
      if (codeToApply) setPromoApplied(codeToApply)
      setCheckingStatus(false)
      setPromoAction(null)
      setRetryingBilling(false)
      setSwitchingPlan(false)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setCheckingStatus(false)
      setPromoAction(null)
      setRetryingBilling(false)
      setSwitchingPlan(false)
    }
  }

  // Clerk silently refreshes the session token roughly once a minute, which
  // can hand back a new `user` object reference without any real change.
  // Without this guard, that refresh re-triggers the effect below and
  // re-initializes the subscription with no promo code — wiping out a
  // discount that was already applied. This ensures the automatic,
  // on-mount initialization only ever runs once per visit; every later
  // call to initSubscription() is explicit (apply/remove code, switch
  // plan, retry) and passes its own arguments.
  const hasAutoInitialized = useRef(false)

  useEffect(() => {
    if (!isLoaded || !user) return
    if (hasAutoInitialized.current) return
    hasAutoInitialized.current = true
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
    setPromoAction('applying')
    setClientSecret(null)
    await initSubscription(promoCode.trim())
  }

  const handleRemovePromo = async () => {
    setPromoCode('')
    setPromoApplied(null)
    setPromoAction('removing')
    setClientSecret(null)
    await initSubscription()
  }

  if (!isLoaded || checkingStatus) {
    return <LoadingCard text={retryingBilling ? 'Returning to billing…' : 'Preparing secure checkout'} />
  }

  if (promoAction === 'applying') {
    return <LoadingCard text="Applying code…" />
  }

  if (promoAction === 'removing') {
    return <LoadingCard text="Removing code…" />
  }

  if (switchingPlan) {
    return <LoadingCard text="Switching plan…" />
  }

  if (freeWithCoupon) {
    return (
      <main style={pageStyle}>
        <div style={narrowShellStyle}>
          <div style={{ padding: '48px 32px', textAlign: 'center' }}>
            <BrandMark />
            <div style={{ ...statusTitleStyle, color: '#32ff7e' }}>Subscription active</div>
            <div style={mutedTextStyle}>
              Promo code applied. Redirecting{plan === 'wl' ? ' to white-label setup' : ' to your dashboard'}...
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    const isPromoError = error.toLowerCase().includes('promo code')
    return (
      <main style={pageStyle}>
        <div style={narrowShellStyle}>
          <div style={{ padding: '48px 32px', textAlign: 'center' }}>
            <BrandMark />
            <div style={{ ...statusTitleStyle, color: '#ff6464' }}>
              {isPromoError ? 'Invalid code' : 'Something went wrong'}
            </div>
            <div style={{ ...mutedTextStyle, marginBottom: 28 }}>{error}</div>
            <button
              style={primaryButtonStyle}
              onClick={() => {
                setError(null)
                setRetryingBilling(true)
                setCheckingStatus(true)
                initSubscription(promoApplied || undefined)
              }}
              disabled={abandoning}
            >
              Return to billing
            </button>
            <button
              type="button"
              onClick={abandonAndSignOut}
              disabled={abandoning}
              style={{
                ...textButtonStyle,
                opacity: abandoning ? 0.5 : 1,
                cursor: abandoning ? 'not-allowed' : 'pointer',
              }}
            >
              {abandoning ? 'Going back...' : 'Back to home'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (!clientSecret) {
    return <LoadingCard text="Preparing secure checkout" />
  }

  const billing = describeBilling(planInfo, amounts, coupon)

  return (
    <main style={pageStyle} className="billing-page">
      <div style={shellStyle}>
        <div className="billing-brand-desktop-only">
          <BrandMark />
        </div>

        <div style={gridStyle} className="billing-grid">
          {/* ── LEFT: order summary ─────────────────────────────── */}
          <div style={summaryColStyle} className="billing-col">
            <div style={eyebrowStyle}>
              <span style={eyebrowLabelStyle}>PLAN</span>
              <span style={eyebrowPlanStyle}>{planInfo.label}</span>
            </div>

            <div style={priceRowStyle} className="billing-price-row">
              {billing.hasDiscount && (
                <span style={priceWasStyle}>{billing.fullLabel}</span>
              )}
              <span style={priceNowStyle} className="billing-price-now">{billing.todayLabel}</span>
              <span style={priceUnitStyle}>{billing.hasDiscount ? 'today' : '/ week'}</span>
            </div>
            {billing.hasDiscount ? (
              <div style={priceCaptionStyle} className="billing-price-caption">
                <span style={{ color: '#32ff7e' }}>{promoApplied?.toUpperCase()}</span> applied — then {billing.recurringLabel}
              </div>
            ) : (
              <div style={priceCaptionStyle} className="billing-price-caption">Charged today, then weekly until you cancel.</div>
            )}

            <div style={sectionTitleStyle}>{planInfo.title}</div>
            <div style={planDescStyle} className="billing-plan-desc">{planInfo.description}</div>

            {plan === 'standard' ? (
              <button
                type="button"
                onClick={() => switchTo('wl')}
                disabled={switchingPlan}
                style={switchLinkStyle}
                className="billing-switch-link"
              >
                ↗ {PLAN_INFO.standard.switchLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchTo('standard')}
                disabled={switchingPlan}
                style={switchLinkStyle}
                className="billing-switch-link"
              >
                ↘ {PLAN_INFO.wl.switchLabel}
              </button>
            )}

            <div style={dividerStyle} className="billing-divider" />

            <div style={termsHeaderStyle} className="billing-terms-header">Billing terms</div>
            <ul style={termsListStyle} className="billing-terms-list">
              <li style={termItemStyle}>
                <span style={termBulletStyle} />
                <span>
                  <strong style={{ color: '#4a9eff' }}>{billing.todayLabel}</strong> charged today to start your subscription
                  {billing.hasDiscount && (
                    <span style={{ color: '#32ff7e' }}> ({promoApplied?.toUpperCase()} applied)</span>
                  )}
                </span>
              </li>
              <li style={termItemStyle}>
                <span style={termBulletStyle} />
                <span>
                  You will be billed <strong style={{ color: '#4a9eff' }}>{billing.recurringLabel}</strong> automatically thereafter
                </span>
              </li>
              <li style={termItemStyle}>
                <span style={termBulletStyle} />
                <span>Cancel anytime in Settings — service continues until period end</span>
              </li>
              <li style={termItemStyle}>
                <span style={termBulletStyle} />
                <span>Subscription is non-refundable once a billing cycle has been charged</span>
              </li>
              {plan === 'wl' && (
                <li style={termItemStyle}>
                  <span style={{ ...termBulletStyle, background: '#ffd96a' }} />
                  <span style={{ color: '#ffd96a' }}>
                    After payment you&apos;ll choose your subdomain, upload your logo, and set your brand colors.
                  </span>
                </li>
              )}
            </ul>
          </div>

          {/* ── RIGHT: payment ──────────────────────────────────── */}
          <div style={payColStyle} className="billing-col">
            <div style={payHeaderStyle} className="billing-pay-header">Payment details</div>

            <div style={promoBoxStyle} className="billing-promo-box">
              {promoApplied ? (
                <div style={promoAppliedStyle}>
                  <span>
                    ✓ CODE <strong style={{ color: '#32ff7e' }}>{promoApplied.toUpperCase()}</strong> APPLIED
                  </span>
                  <button
                    onClick={handleRemovePromo}
                    disabled={!!promoAction}
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
                  + Have a code?
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
                    disabled={!promoCode.trim() || !!promoAction}
                    style={{
                      ...promoApplyStyle,
                      opacity: !promoCode.trim() || !!promoAction ? 0.4 : 1,
                      cursor: !promoCode.trim() || !!promoAction ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {promoAction === 'applying' ? '...' : 'Apply'}
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
                    colorBackground: '#14151c',
                    colorText: '#e0e2ea',
                    colorDanger: '#ff6464',
                    fontFamily: FUTURA,
                    borderRadius: '5px',
                  },
                },
              }}
              key={clientSecret}
            >
              <CheckoutForm
                onAbandon={abandonAndSignOut}
                abandoning={abandoning}
                plan={plan}
                billing={billing}
                teamMemberId={teamMemberId}
              />
            </Elements>

            <div style={footerNoteStyle} className="billing-footer-note">
              Payments processed securely by Stripe. Your card details never touch our servers.
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout kicks in once there's room for it side by side;
          below that it stacks exactly like the payment-only mobile card. */}
      <style>{`
        @media (min-width: 860px) {
          .billing-grid {
            grid-template-columns: 380px 1fr !important;
          }
        }

        /* Mobile only (mirrors the 860px boundary above exactly, so this
           block and the desktop block above can never both apply at once).
           Desktop spacing/type is untouched — this only tightens the
           stacked single-column phone view to fit a real device viewport
           instead of running noticeably taller than the page. */
        @media (max-width: 859px) {
          .billing-brand-desktop-only {
            display: none !important;
          }
          .billing-page {
            /* Explicit longhand (not shorthand padding) so only the top
               edge accounts for the notch / dynamic island via
               env(safe-area-inset-top) — left/right/bottom stay plain
               values. The 20px fallback (used when the env() var isn't
               supported) matches what this rule used before; on real
               notched devices the safe-area inset takes over and adds
               whatever the device actually needs on top of it. */
            padding-top: calc(20px + env(safe-area-inset-top, 0px)) !important;
            padding-right: 14px !important;
            padding-bottom: 20px !important;
            padding-left: 14px !important;
          }
          .billing-col {
            padding: 20px !important;
          }
          .billing-price-now {
            font-size: 26px !important;
          }
          .billing-price-row {
            margin-bottom: 4px !important;
          }
          .billing-price-caption {
            margin-bottom: 16px !important;
          }
          .billing-plan-desc {
            margin-bottom: 14px !important;
          }
          .billing-switch-link {
            margin-bottom: 16px !important;
          }
          .billing-divider {
            margin: 14px 0 !important;
          }
          .billing-terms-header {
            margin-bottom: 10px !important;
          }
          .billing-terms-list {
            gap: 9px !important;
          }
          .billing-pay-header {
            margin-bottom: 12px !important;
          }
          .billing-promo-box {
            margin-bottom: 14px !important;
          }
          .billing-pay-block {
            margin-bottom: 14px !important;
          }
          .billing-agreement {
            margin: 14px 0 !important;
          }
          .billing-submit-btn {
            padding: 13px !important;
            margin-bottom: 8px !important;
          }
          .billing-cancel-btn {
            padding: 8px !important;
          }
          .billing-footer-note {
            margin-top: 12px !important;
          }
        }
      `}</style>
    </main>
  )
}

function CheckoutForm({
  onAbandon,
  abandoning,
  plan,
  billing,
  teamMemberId,
}: {
  onAbandon: () => void
  abandoning: boolean
  plan: Plan
  billing: ReturnType<typeof describeBilling>
  teamMemberId: string | null
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)

  // Card section starts open on desktop (room to spare) and collapsed on
  // mobile (saves scroll). Matches the same 860px boundary the two-column
  // layout switches on, so nothing here can disagree with the rest of the
  // page about what counts as "desktop." Defaults to collapsed before the
  // media query can run client-side (SSR-safe: window isn't touched during
  // the initial render), which matches the pre-existing mobile-first
  // behavior and just upgrades to open once we know it's a wide viewport.
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 860px)')
    setIsDesktopViewport(mql.matches)
    const handleChange = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !agreed) return

    setSubmitting(true)
    setErrorMsg(null)

    const successParams = new URLSearchParams()
    if (plan === 'wl') successParams.set('plan', 'wl')
    if (teamMemberId) successParams.set('teamMemberId', teamMemberId)
    if (typeof billing.todayCents === 'number') successParams.set('amount', String(billing.todayCents))
    const successUrl = `${window.location.origin}/billing/success?${successParams.toString()}`

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
      <div style={payBlockStyle} className="billing-pay-block">
        <PaymentElement
          options={{
            layout: {
              type: 'accordion',
              defaultCollapsed: !isDesktopViewport,
              radios: 'auto',
              spacedAccordionItems: false,
            },
            paymentMethodOrder: ['card', 'apple_pay', 'google_pay', 'link'],
          }}
        />
      </div>

      <label style={agreementStyle} className="billing-agreement">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginRight: 10, marginTop: 2, accentColor: '#4a9eff', flexShrink: 0 }}
        />
        <span>
          I agree my card will be charged <strong style={{ color: '#e0e2ea' }}>{billing.todayLabel} today</strong> and{' '}
          <strong style={{ color: '#e0e2ea' }}>{billing.recurringLabel}</strong> thereafter unless I cancel.
        </span>
      </label>

      {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

      <button
        type="submit"
        disabled={!stripe || submitting || !agreed || abandoning}
        style={{
          ...primaryButtonStyle,
          opacity: !stripe || submitting || !agreed || abandoning ? 0.5 : 1,
          cursor: !stripe || submitting || !agreed || abandoning ? 'not-allowed' : 'pointer',
        }}
        className="billing-submit-btn"
      >
        {submitting ? 'Processing...' : 'Continue'}
      </button>

      <button
        type="button"
        onClick={onAbandon}
        disabled={submitting || abandoning}
        style={{
          ...textButtonStyle,
          opacity: submitting || abandoning ? 0.5 : 1,
          cursor: submitting || abandoning ? 'not-allowed' : 'pointer',
        }}
        className="billing-cancel-btn"
      >
        {abandoning ? 'Canceling...' : 'Cancel'}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Styles
//
// Layout: a single card shell that is one column by default (mobile — the
// original design's width) and becomes a 380px summary + flexible payment
// column grid at >=860px, via the plain <style> media query above. Every
// color, radius, and spacing value below comes from the same dark/blue
// system used elsewhere in the product (see app/globals.css brand tokens).
// ─────────────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0d0e14',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  fontFamily: FUTURA,
}

const shellStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 1040,
}

const narrowShellStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: '#1a1c24',
  border: '1px solid #2a2c34',
  borderTop: '3px solid #4a9eff',
  borderRadius: 6,
  color: '#e0e2ea',
  fontFamily: FUTURA,
}

const brandRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 24,
  justifyContent: 'center',
}

const brandMarkStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 7,
  background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const brandNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  letterSpacing: 5,
  color: '#c0c2ca',
  fontFamily: FUTURA,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  background: '#1a1c24',
  border: '1px solid #2a2c34',
  borderTop: '3px solid #4a9eff',
  borderRadius: 6,
  overflow: 'hidden',
  color: '#e0e2ea',
}

const summaryColStyle: React.CSSProperties = {
  padding: 32,
  background: '#14151c',
  borderBottom: '1px solid #2a2c34',
}

const payColStyle: React.CSSProperties = {
  padding: 32,
}

const eyebrowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 14,
}

const eyebrowLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 3,
  color: '#888a92',
  fontWeight: 700,
}

const eyebrowPlanStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 2,
  color: '#4a9eff',
  fontWeight: 700,
}

const priceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  marginBottom: 6,
  flexWrap: 'wrap',
}

const priceWasStyle: React.CSSProperties = {
  fontSize: 15,
  color: '#666870',
  textDecoration: 'line-through',
}

const priceNowStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: '#e0e2ea',
  letterSpacing: 0.5,
}

const priceUnitStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#888a92',
  letterSpacing: 1,
}

const priceCaptionStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#888a92',
  lineHeight: 1.6,
  marginBottom: 24,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 1,
  color: '#e0e2ea',
  marginBottom: 8,
  fontFamily: FUTURA,
}

const statusTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 3,
  marginBottom: 12,
  fontFamily: FUTURA,
}

const planDescStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: '#c0c2ca',
  marginBottom: 22,
}

const switchLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  letterSpacing: 1.5,
  color: '#4a9eff',
  fontWeight: 700,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  marginBottom: 24,
  fontFamily: FUTURA,
  textAlign: 'left',
}

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: '#232530',
  margin: '22px 0',
}

const termsHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2.5,
  color: '#888a92',
  fontWeight: 700,
  marginBottom: 14,
  fontFamily: FUTURA,
}

const termsListStyle: React.CSSProperties = {
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  margin: 0,
  padding: 0,
}

const termItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  fontSize: 12,
  lineHeight: 1.55,
  color: '#c0c2ca',
  fontFamily: FUTURA,
}

const termBulletStyle: React.CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: '50%',
  background: '#4a9eff',
  flexShrink: 0,
  marginTop: 6,
}

const payHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 3,
  color: '#888a92',
  fontWeight: 700,
  marginBottom: 18,
  fontFamily: FUTURA,
}

const promoBoxStyle: React.CSSProperties = {
  marginBottom: 20,
}

const promoToggleStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '11px 14px',
  background: 'transparent',
  border: '1px dashed #3a3c48',
  borderRadius: 5,
  color: '#888a92',
  fontSize: 11,
  letterSpacing: 2,
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
  padding: '11px 14px',
  background: '#0d0e14',
  border: '1px solid #2a4a8a',
  borderRadius: 5,
  fontFamily: 'monospace',
  fontSize: 16,
  color: '#4a9eff',
  outline: 'none',
  letterSpacing: 2,
  textTransform: 'uppercase',
  boxSizing: 'border-box',
}

const promoApplyStyle: React.CSSProperties = {
  padding: '0 20px',
  background: 'rgba(74,158,255,0.08)',
  border: '1px solid #2a4a8a',
  borderRadius: 5,
  color: '#4a9eff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  fontFamily: FUTURA,
}

const promoAppliedStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 14px',
  background: 'rgba(50,255,126,0.08)',
  border: '1px solid #1a6a1a',
  borderRadius: 5,
  fontSize: 11,
  letterSpacing: 1,
  color: '#c0c2ca',
  fontFamily: FUTURA,
  gap: 10,
  flexWrap: 'wrap',
}

const promoRemoveStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #4a4a5e',
  borderRadius: 4,
  color: '#888a92',
  fontSize: 9,
  letterSpacing: 1.5,
  padding: '5px 10px',
  cursor: 'pointer',
  fontFamily: FUTURA,
  fontWeight: 700,
}

const payBlockStyle: React.CSSProperties = {
  marginBottom: 20,
}

const agreementStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  fontSize: 11.5,
  color: '#c0c2ca',
  margin: '20px 0',
  cursor: 'pointer',
  lineHeight: 1.6,
  fontFamily: FUTURA,
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 15,
  background: '#4a9eff',
  border: 'none',
  borderRadius: 6,
  color: '#0d0e14',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 3,
  cursor: 'pointer',
  fontFamily: FUTURA,
  marginBottom: 10,
}

const textButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  background: 'transparent',
  border: 'none',
  color: '#666870',
  fontSize: 11,
  letterSpacing: 1.5,
  cursor: 'pointer',
  fontFamily: FUTURA,
}

const errorStyle: React.CSSProperties = {
  background: '#2a1a1a',
  border: '1px solid #8a1a1a',
  color: '#ff6464',
  padding: '10px 14px',
  borderRadius: 5,
  fontSize: 11,
  margin: '12px 0',
  fontFamily: FUTURA,
}

const mutedTextStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  color: '#888a92',
  marginBottom: 16,
  fontFamily: FUTURA,
  textAlign: 'center',
}

const footerNoteStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.5,
  color: '#666870',
  textAlign: 'center',
  marginTop: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontFamily: FUTURA,
}
