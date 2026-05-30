'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

// =============================================================================
// /onboarding/whitelabel — v22 (Phase B)
// =============================================================================
// Doubles as the ONBOARDING form (first time) AND the EDIT form (anytime
// later). Detects state via /api/whitelabel/onboarding GET:
//   - status='not_started' → bounce to /billing?plan=wl
//   - status='pending'     → show empty form, button says "Provision tenant"
//   - status='complete'    → show populated form, button says "Save changes"
//
// CHANGES from v21:
//   - Logo: 512×148 PNG/SVG (was 28×28) — matches the sidebar brand block
//   - Live preview renders the uploaded logo at 256×74 (the actual 1x size)
//   - Accent color picker (was primary-only)
//   - Live subdomain availability check (debounced 300ms)
//   - Edit mode: form pre-populates from existing tenant, supports
//     in-place updates
//   - Logo upload happens FIRST via /api/whitelabel/upload-logo, then the
//     returned URL is sent to /api/whitelabel/onboarding as part of the
//     full config payload
//   - Slug cooldown UI: if the user changed their subdomain in the last
//     24h, the field shows a warning and the change request is rejected
//     server-side
//
// REDIRECT BEHAVIOR (Phase B):
//   On successful provision/save, redirect to /dashboard on the SAME host
//   the user is on (probably dialerseat.com). Phase C will switch this to
//   `https://{slug}.dialerseat.com/dashboard` once subdomain middleware is
//   live. Until then, the subdomain would 404 — staying on main host is
//   correct for now.
// =============================================================================

const LOGO_REQ_WIDTH = 512
const LOGO_REQ_HEIGHT = 148
const LOGO_PREVIEW_WIDTH = 256
const LOGO_PREVIEW_HEIGHT = 74
const LOGO_MAX_BYTES = 200 * 1024 // 200 KB

const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'support',
  'dashboard', 'billing', 'auth', 'docs', 'help', 'status',
  'staging', 'dev', 'test', 'demo', 'preview', 'sandbox',
  'cdn', 'assets', 'static', 'media', 'images', 'files',
  'sip', 'voice', 'webhook', 'webhooks', 'signalwire',
  'stripe', 'clerk', 'supabase', 'vercel', 'sentry',
  'dialerseat', 'whitelabel', 'wl', 'onboarding',
  'manager', 'managers', 'pro', 'team', 'teams',
  'signin', 'signup', 'login', 'logout', 'account', 'settings',
  'terms', 'privacy', 'about', 'contact', 'pricing', 'faq',
  'home', 'blog', 'callback', 'oauth', 'saml',
  'referral', 'promo', 'public', 'upload',
])

interface TenantConfig {
  brand_name: string
  slug: string
  primary_color: string
  accent_color: string
  logo_url: string
}

interface StatusResponse {
  status: 'not_started' | 'pending' | 'complete'
  existingSubdomain?: string
  tenant?: TenantConfig
  canChangeSlugAt?: string | null
  isActive?: boolean
}

type AvailabilityState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; current?: boolean }
  | { kind: 'unavailable'; reason: string }

export default function WhitelabelOnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [statusLoaded, setStatusLoaded] = useState(false)
  const [statusErr, setStatusErr] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [originalSlug, setOriginalSlug] = useState<string | null>(null)
  const [canChangeSlugAt, setCanChangeSlugAt] = useState<string | null>(null)

  // Form fields
  const [brandName, setBrandName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4a9eff')
  const [accentColor, setAccentColor] = useState('#2a4a8a')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null)
  const [logoErr, setLogoErr] = useState<string | null>(null)

  // Subdomain availability
  const [availability, setAvailability] = useState<AvailabilityState>({ kind: 'idle' })
  const availabilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  // ── STATUS CHECK ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user) return
    let cancelled = false

    fetch('/api/whitelabel/onboarding', { cache: 'no-store' })
      .then(async (r) => {
        const text = await r.text()
        if (!r.ok) throw new Error(text.slice(0, 200))
        return JSON.parse(text) as StatusResponse
      })
      .then((data) => {
        if (cancelled) return

        if (data.status === 'not_started') {
          router.push('/billing?plan=wl')
          return
        }

        if (data.status === 'complete' && data.tenant) {
          // Edit mode — pre-populate the form
          setIsEditMode(true)
          setOriginalSlug(data.tenant.slug)
          setBrandName(data.tenant.brand_name)
          setSubdomain(data.tenant.slug)
          setPrimaryColor(data.tenant.primary_color)
          setAccentColor(data.tenant.accent_color)
          setExistingLogoUrl(data.tenant.logo_url)
          setCanChangeSlugAt(data.canChangeSlugAt || null)
        }

        setStatusLoaded(true)
      })
      .catch((e) => {
        if (!cancelled) {
          setStatusErr(e?.message || 'Status check failed')
          setStatusLoaded(true)
        }
      })

    return () => { cancelled = true }
  }, [isLoaded, user, router])

  // ── SUBDOMAIN INPUT ───────────────────────────────────────────────
  const onSubdomainChange = (raw: string) => {
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+/, '')
      .slice(0, 30)
    setSubdomain(cleaned)
  }

  // ── LIVE AVAILABILITY CHECK (debounced 300ms) ─────────────────────
  const checkAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) {
      setAvailability({ kind: 'idle' })
      return
    }
    if (RESERVED_SUBDOMAINS.has(slug)) {
      setAvailability({ kind: 'unavailable', reason: 'reserved' })
      return
    }
    setAvailability({ kind: 'checking' })
    try {
      const r = await fetch(`/api/whitelabel/check-subdomain?slug=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      })
      const data = await r.json()
      if (data.available) {
        setAvailability({ kind: 'available', current: data.current })
      } else {
        setAvailability({ kind: 'unavailable', reason: data.reason || 'taken' })
      }
    } catch {
      setAvailability({ kind: 'idle' })
    }
  }, [])

  useEffect(() => {
    if (availabilityTimer.current) clearTimeout(availabilityTimer.current)
    if (!subdomain) {
      setAvailability({ kind: 'idle' })
      return
    }
    availabilityTimer.current = setTimeout(() => {
      checkAvailability(subdomain)
    }, 300)
    return () => {
      if (availabilityTimer.current) clearTimeout(availabilityTimer.current)
    }
  }, [subdomain, checkAvailability])

  // ── LOGO UPLOAD HANDLING ──────────────────────────────────────────
  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoErr(null)
    setLogoFile(null)
    setLogoPreview(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > LOGO_MAX_BYTES) {
      setLogoErr(`Too large. Max ${LOGO_MAX_BYTES / 1024} KB.`)
      return
    }

    const isPng = file.type === 'image/png'
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')

    if (!isPng && !isSvg) {
      setLogoErr('Must be a PNG or SVG.')
      return
    }

    // For PNG, validate exact dimensions client-side. For SVG, accept (server
    // will validate viewBox aspect ratio).
    if (isPng) {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        if (img.naturalWidth !== LOGO_REQ_WIDTH || img.naturalHeight !== LOGO_REQ_HEIGHT) {
          setLogoErr(
            `PNG must be exactly ${LOGO_REQ_WIDTH}×${LOGO_REQ_HEIGHT} pixels. ` +
            `Yours is ${img.naturalWidth}×${img.naturalHeight}.`
          )
          URL.revokeObjectURL(url)
          return
        }
        setLogoFile(file)
        setLogoPreview(url)
      }
      img.onerror = () => {
        setLogoErr('Could not read image. Try another file.')
        URL.revokeObjectURL(url)
      }
      img.src = url
    } else {
      // SVG — just preview as-is; server validates aspect ratio
      const url = URL.createObjectURL(file)
      setLogoFile(file)
      setLogoPreview(url)
    }
  }

  // ── SUBMIT ────────────────────────────────────────────────────────
  const slugChangedFromOriginal = isEditMode && originalSlug !== subdomain
  const slugInCooldown = !!canChangeSlugAt && slugChangedFromOriginal

  const canSubmit = (() => {
    if (submitting) return false
    if (!brandName.trim() || brandName.trim().length < 2) return false
    if (!subdomain || subdomain.length < 3) return false
    if (availability.kind === 'unavailable') return false
    if (availability.kind === 'checking') return false
    if (slugInCooldown) return false
    if (!/^#[0-9a-fA-F]{6}$/.test(primaryColor)) return false
    if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) return false
    // Logo required in onboarding mode; optional in edit mode (keep existing)
    if (!isEditMode && !logoFile) return false
    if (logoErr) return false
    return true
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitErr(null)

    try {
      // ── Step 1: upload logo if user picked a new one ─────────────
      let logoUrl = existingLogoUrl || ''
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const upRes = await fetch('/api/whitelabel/upload-logo', {
          method: 'POST',
          body: fd,
        })
        const upText = await upRes.text()
        if (!upRes.ok) {
          let detail = upText.slice(0, 300)
          try {
            const parsed = JSON.parse(upText)
            detail = parsed.detail || parsed.error || detail
          } catch {}
          throw new Error(`Logo upload failed: ${detail}`)
        }
        const upData = JSON.parse(upText)
        logoUrl = upData.url
      }

      // ── Step 2: write tenant config ───────────────────────────────
      const cfgRes = await fetch('/api/whitelabel/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName.trim(),
          subdomain,
          primary_color: primaryColor,
          accent_color: accentColor,
          logo_url: logoUrl,
        }),
      })
      const cfgText = await cfgRes.text()
      if (!cfgRes.ok) {
        let detail = cfgText.slice(0, 300)
        try {
          const parsed = JSON.parse(cfgText)
          detail = parsed.detail || parsed.error || detail
        } catch {}
        throw new Error(detail)
      }

      // ── Step 3: redirect ──────────────────────────────────────────
      // Phase B: stay on main host. Phase C will switch this to subdomain.
      router.push('/dashboard')
    } catch (err: any) {
      setSubmitErr(err?.message || 'Failed to save')
      setSubmitting(false)
    }
  }

  // ── RENDER ─────────────────────────────────────────────────────────
  if (!isLoaded || !statusLoaded) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={titleStyle}>LOADING...</div>
        </div>
      </main>
    )
  }

  if (statusErr) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ ...titleStyle, color: '#ff6464' }}>ERROR</div>
          <div style={subtitleStyle}>{statusErr}</div>
        </div>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <form style={cardStyle} onSubmit={handleSubmit}>
        <div style={badgeStyle}>
          <span style={badgeLabelStyle}>{'\u25B8'} WHITE LABEL</span>
          <span style={badgeNameStyle}>{isEditMode ? 'EDIT' : 'SETUP'}</span>
        </div>

        <div style={titleStyle}>
          {isEditMode ? 'EDIT YOUR TENANT' : 'CONFIGURE YOUR TENANT'}
        </div>
        <div style={subtitleStyle}>
          {isEditMode
            ? 'Update your branding. Changes apply immediately.'
            : 'One-time setup. You can change everything later.'}
        </div>

        {/* ── BRAND NAME ────────────────────────────────────────── */}
        <Field
          label="BRAND NAME"
          hint="Shown to your team in the sidebar and emails."
        >
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value.slice(0, 60))}
            placeholder="Acme Dialer"
            style={inputStyle}
            maxLength={60}
            required
          />
        </Field>

        {/* ── SUBDOMAIN ─────────────────────────────────────────── */}
        <Field
          label="SUBDOMAIN"
          hint="Your team's login URL. 3–30 chars. Lowercase letters, digits, hyphens."
        >
          <div style={subdomainRowStyle}>
            <input
              type="text"
              value={subdomain}
              onChange={(e) => onSubdomainChange(e.target.value)}
              placeholder="acme"
              style={{ ...inputStyle, flex: 1, textTransform: 'lowercase' }}
              maxLength={30}
              required
              disabled={slugInCooldown}
            />
            <span style={subdomainSuffixStyle}>.dialerseat.com</span>
          </div>
          <AvailabilityHint
            state={availability}
            slug={subdomain}
            isEditMode={isEditMode}
            originalSlug={originalSlug}
          />
          {slugInCooldown && canChangeSlugAt && (
            <div style={cooldownNoteStyle}>
              You changed your subdomain recently. You can change it again on{' '}
              <strong>{new Date(canChangeSlugAt).toLocaleString()}</strong>.
            </div>
          )}
        </Field>

        {/* ── COLORS ────────────────────────────────────────────── */}
        <Field
          label="PRIMARY COLOR"
          hint="Used for buttons, active nav, focus rings."
        >
          <ColorRow color={primaryColor} setColor={setPrimaryColor} />
        </Field>

        <Field
          label="ACCENT COLOR"
          hint="Used for highlights, badges, secondary chrome."
        >
          <ColorRow color={accentColor} setColor={setAccentColor} />
        </Field>

        {/* ── LOGO ──────────────────────────────────────────────── */}
        <Field
          label="LOGO"
          hint={`PNG or SVG. Exactly ${LOGO_REQ_WIDTH}×${LOGO_REQ_HEIGHT} pixels. Max ${LOGO_MAX_BYTES / 1024} KB. ` +
                `Replaces the "D / DIALERSEAT" block in the sidebar.`}
        >
          <div style={logoRowStyle}>
            <input
              type="file"
              accept="image/png,image/svg+xml,.svg"
              onChange={onLogoChange}
              style={fileInputStyle}
              required={!isEditMode}
            />
          </div>
          {logoErr && <div style={errorTextStyle}>{logoErr}</div>}

          {/* PREVIEW — render at native 256x74 (1x display size) */}
          {(logoPreview || existingLogoUrl) && (
            <div style={logoPreviewBoxStyle}>
              <div style={{
                fontSize: 9, letterSpacing: 2, color: '#888a92',
                marginBottom: 8, fontWeight: 700,
              }}>PREVIEW (renders at 256×74 in your sidebar)</div>
              <div style={{
                background: '#0a1020',
                padding: 12,
                borderRadius: 4,
                display: 'flex',
                justifyContent: 'flex-start',
              }}>
                <img
                  src={logoPreview || existingLogoUrl || ''}
                  alt="Logo preview"
                  width={LOGO_PREVIEW_WIDTH}
                  height={LOGO_PREVIEW_HEIGHT}
                  style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                />
              </div>
            </div>
          )}
        </Field>

        {submitErr && (
          <div style={errorBoxStyle}>
            <strong>Failed:</strong> {submitErr}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...buttonStyle,
            opacity: !canSubmit ? 0.4 : 1,
            cursor: !canSubmit ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting
            ? (isEditMode ? 'SAVING...' : 'PROVISIONING...')
            : (isEditMode ? '▶ SAVE CHANGES' : '▶ PROVISION TENANT')}
        </button>

        <div style={footerNoteStyle}>
          {isEditMode
            ? 'Subdomain changes redirect the old URL for 30 days, then it becomes available again.'
            : 'Your subdomain becomes the login URL for your team.'}
        </div>
      </form>
    </main>
  )
}

// ─── COLOR PICKER ROW ────────────────────────────────────────────
function ColorRow({
  color,
  setColor,
}: {
  color: string
  setColor: (c: string) => void
}) {
  return (
    <div style={colorRowStyle}>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        style={colorPickerStyle}
      />
      <input
        type="text"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        placeholder="#4a9eff"
        style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
        maxLength={7}
      />
      <div style={{ ...colorSwatch, background: color }} />
    </div>
  )
}

// ─── AVAILABILITY HINT ───────────────────────────────────────────
function AvailabilityHint({
  state,
  slug,
  isEditMode,
  originalSlug,
}: {
  state: AvailabilityState
  slug: string
  isEditMode: boolean
  originalSlug: string | null
}) {
  if (!slug) return null

  if (slug.length < 3) {
    return <div style={hintStyle}>Need at least 3 characters.</div>
  }
  if (state.kind === 'checking') {
    return <div style={hintStyle}>Checking…</div>
  }
  if (state.kind === 'available') {
    if (state.current && isEditMode) {
      return (
        <div style={availabilityOkStyle}>
          ✓ <strong>{slug}.dialerseat.com</strong> — your current subdomain
        </div>
      )
    }
    return (
      <div style={availabilityOkStyle}>
        ✓ <strong>{slug}.dialerseat.com</strong> is available
      </div>
    )
  }
  if (state.kind === 'unavailable') {
    const msg =
      state.reason === 'reserved' ? 'reserved by DialerSeat' :
      state.reason === 'taken' ? 'already in use by another tenant' :
      state.reason === 'redirecting' ? 'currently redirecting from a recent edit (try again in 30 days)' :
      state.reason === 'too_short' ? 'too short' :
      state.reason === 'too_long' ? 'too long' :
      'invalid'
    return (
      <div style={availabilityBadStyle}>
        ✗ <strong>{slug}.dialerseat.com</strong> — {msg}
      </div>
    )
  }
  return null
}

// ─── FIELD WRAPPER ───────────────────────────────────────────────
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div style={fieldStyle}>
      <div style={fieldLabelStyle}>{label}</div>
      {hint && <div style={fieldHintStyle}>{hint}</div>}
      {children}
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────
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
  maxWidth: 560,
  background: '#1a1c24',
  border: '1px solid #2a2c34',
  borderTop: '3px solid #4a9eff',
  borderRadius: 4,
  padding: 32,
  color: '#e0e2ea',
  fontFamily: FUTURA,
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(74,158,255,0.08)',
  border: '1px solid #2a4a8a',
  borderLeft: '3px solid #4a9eff',
  padding: '4px 10px',
  borderRadius: 3,
  marginBottom: 14,
}
const badgeLabelStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: 3, color: '#888a92', fontWeight: 700,
}
const badgeNameStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 2, color: '#4a9eff', fontWeight: 700,
}

const titleStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, letterSpacing: 4,
  color: '#4a9eff', marginBottom: 8, fontFamily: FUTURA,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 12, letterSpacing: 1, color: '#888a92', marginBottom: 20, fontFamily: FUTURA,
}

const fieldStyle: React.CSSProperties = {
  marginBottom: 18,
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 3, color: '#888a92',
  fontWeight: 700, marginBottom: 4,
}

const fieldHintStyle: React.CSSProperties = {
  fontSize: 10, color: '#666870', marginBottom: 8, lineHeight: 1.5,
}

const hintStyle: React.CSSProperties = {
  fontSize: 11, color: '#888a92', marginTop: 6,
  fontFamily: FUTURA,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#0d0e14',
  border: '1px solid #2a2c34',
  borderRadius: 3,
  color: '#e0e2ea',
  fontSize: 14,
  outline: 'none',
  fontFamily: FUTURA,
  boxSizing: 'border-box',
}

const subdomainRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const subdomainSuffixStyle: React.CSSProperties = {
  fontSize: 12, color: '#888a92', fontFamily: 'monospace', whiteSpace: 'nowrap',
}

const availabilityOkStyle: React.CSSProperties = {
  fontSize: 11, color: '#32ff7e', marginTop: 6, fontFamily: FUTURA,
}

const availabilityBadStyle: React.CSSProperties = {
  fontSize: 11, color: '#ff6464', marginTop: 6, fontFamily: FUTURA,
}

const cooldownNoteStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ffaa3e',
  marginTop: 6,
  padding: '8px 10px',
  background: 'rgba(255,170,62,0.08)',
  border: '1px solid #8a6a1a',
  borderLeft: '3px solid #ffaa3e',
  borderRadius: 3,
  lineHeight: 1.5,
}

const colorRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const colorPickerStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  border: '1px solid #2a2c34',
  borderRadius: 3,
  background: '#0d0e14',
  cursor: 'pointer',
  padding: 2,
}

const colorSwatch: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 3, border: '1px solid #2a2c34',
}

const logoRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const fileInputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: '#c0c2ca',
  fontFamily: FUTURA,
}

const logoPreviewBoxStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '12px 14px',
  background: '#0d0e14',
  border: '1px solid #2a2c34',
  borderRadius: 3,
}

const errorTextStyle: React.CSSProperties = {
  fontSize: 11, color: '#ff6464', marginTop: 6, fontFamily: FUTURA,
}

const errorBoxStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: '#2a1a1a',
  border: '1px solid #8a1a1a',
  color: '#ff6464',
  fontSize: 11,
  borderRadius: 3,
  marginBottom: 12,
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
  fontFamily: FUTURA,
  marginTop: 8,
}

const footerNoteStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1, color: '#666870',
  textAlign: 'center', marginTop: 20,
  paddingTop: 16, borderTop: '1px solid #2a2c34', fontFamily: FUTURA,
}