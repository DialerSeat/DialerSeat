'use client'
import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'

// =============================================================================
// /onboarding/whitelabel — v21
// =============================================================================
// Post-WL-payment tenant configuration. The user lands here after the
// /billing/success page detects ?plan=wl. They configure:
//
//   1. Subdomain  (e.g. "acme" → acme.dialerseat.com)
//      Validated: 3-30 chars, lowercase a-z/0-9/hyphen only, not reserved
//      (www/api/admin/app/mail/etc), not already taken.
//
//   2. Logo upload (PNG/JPG/WebP)
//      MUST be exactly 28x28 px to match the site-header brand mark slot.
//      We validate the natural dimensions in the browser BEFORE uploading;
//      anything else gets rejected with a clear error.
//
//   3. Primary color  (hex)
//      Used as the brand_primary in ThemeProvider — tints the dashboard
//      button, brand text, accent borders across the white-labeled site.
//
//   4. Brand name (display name shown next to the logo)
//
// On submit, POST to /api/whitelabel/onboarding which:
//   - Re-validates everything server-side (don't trust client)
//   - Uploads logo to the `tenant-assets` Supabase storage bucket
//   - Creates the white_label_tenants row
//   - Sets users.wl_onboarding_status = 'complete'
//   - Returns the new tenant subdomain so the page can redirect
//
// GUARDRAIL: this page checks wl_onboarding_status on mount. If it's
// 'not_started' (user got here without paying), redirect to /billing.
// If it's 'complete' (already onboarded), redirect to their tenant.
// =============================================================================

// Match the dimensions of the existing brand mark in site-header.tsx
// (currently 28x28 with a 6px border-radius applied via CSS).
const LOGO_REQ_WIDTH = 28
const LOGO_REQ_HEIGHT = 28
const LOGO_MAX_BYTES = 500 * 1024 // 500 KB

// Reserved subdomains we never want a tenant to claim
const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'support',
  'dashboard', 'billing', 'auth', 'docs', 'help', 'status',
  'staging', 'dev', 'test', 'demo', 'preview', 'sandbox',
  'cdn', 'assets', 'static', 'media', 'images', 'files',
  'sip', 'voice', 'webhook', 'webhooks', 'signalwire',
  'stripe', 'clerk', 'supabase', 'vercel', 'sentry',
  'dialerseat', 'whitelabel', 'wl', 'onboarding',
])

interface OnboardingStatus {
  status: 'not_started' | 'pending' | 'complete'
  existingSubdomain?: string
}

export default function WhitelabelOnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [statusLoaded, setStatusLoaded] = useState(false)
  const [statusErr, setStatusErr] = useState<string | null>(null)

  // Form fields
  const [brandName, setBrandName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4a9eff')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoErr, setLogoErr] = useState<string | null>(null)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  // ── STATUS CHECK ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !user) return
    let cancelled = false
    fetch('/api/whitelabel/onboarding', { method: 'GET', cache: 'no-store' })
      .then(async (r) => {
        const text = await r.text()
        if (!r.ok) throw new Error(text.slice(0, 200))
        return JSON.parse(text) as OnboardingStatus
      })
      .then((data) => {
        if (cancelled) return
        if (data.status === 'not_started') {
          router.push('/billing?plan=wl')
          return
        }
        if (data.status === 'complete' && data.existingSubdomain) {
          // Already onboarded — bounce to their tenant
          window.location.href = `https://${data.existingSubdomain}.dialerseat.com/dashboard`
          return
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

  // ── SUBDOMAIN INPUT — sanitize on keystroke ──────────────────────
  const onSubdomainChange = (raw: string) => {
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+/, '')
      .slice(0, 30)
    setSubdomain(cleaned)
  }

  const subdomainError = (() => {
    if (!subdomain) return null
    if (subdomain.length < 3) return 'Must be at least 3 characters.'
    if (subdomain.length > 30) return 'Must be 30 characters or fewer.'
    if (RESERVED_SUBDOMAINS.has(subdomain)) return 'That subdomain is reserved.'
    if (subdomain.endsWith('-')) return "Can't end with a hyphen."
    return null
  })()

  // ── LOGO UPLOAD — validate dimensions client-side ────────────────
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
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setLogoErr('Must be a PNG, JPG, or WebP image.')
      return
    }

    // Verify the natural pixel dimensions match the required slot
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth !== LOGO_REQ_WIDTH || img.naturalHeight !== LOGO_REQ_HEIGHT) {
        setLogoErr(
          `Image must be exactly ${LOGO_REQ_WIDTH}×${LOGO_REQ_HEIGHT} pixels. ` +
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
  }

  // ── SUBMIT ────────────────────────────────────────────────────────
  const canSubmit = !!brandName.trim()
    && !!subdomain
    && !subdomainError
    && !!logoFile
    && !logoErr
    && /^#[0-9a-fA-F]{6}$/.test(primaryColor)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !logoFile) return
    setSubmitting(true)
    setSubmitErr(null)

    const formData = new FormData()
    formData.append('brand_name', brandName.trim())
    formData.append('subdomain', subdomain)
    formData.append('primary_color', primaryColor)
    formData.append('logo', logoFile)

    try {
      const r = await fetch('/api/whitelabel/onboarding', {
        method: 'POST',
        body: formData,
      })
      const text = await r.text()
      if (!r.ok) throw new Error(text.slice(0, 400))
      const data = JSON.parse(text) as { subdomain: string }
      // Redirect to their tenant's dashboard
      window.location.href = `https://${data.subdomain}.dialerseat.com/dashboard`
    } catch (err: any) {
      setSubmitErr(err?.message || 'Failed to provision tenant')
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
          <span style={badgeNameStyle}>SETUP</span>
        </div>

        <div style={titleStyle}>CONFIGURE YOUR TENANT</div>
        <div style={subtitleStyle}>
          One-time setup. You can change everything later from your dashboard.
        </div>

        {/* ── BRAND NAME ────────────────────────────────────────── */}
        <Field
          label="BRAND NAME"
          hint="Displayed next to your logo. E.g. 'Acme Dialer'."
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
          hint="Your team logs in here. 3–30 chars. Lowercase letters, digits, hyphens."
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
            />
            <span style={subdomainSuffixStyle}>.dialerseat.com</span>
          </div>
          {subdomainError && <div style={errorTextStyle}>{subdomainError}</div>}
        </Field>

        {/* ── PRIMARY COLOR ─────────────────────────────────────── */}
        <Field
          label="BRAND COLOR"
          hint="Used for buttons, accents, and the brand text."
        >
          <div style={colorRowStyle}>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              style={colorPickerStyle}
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4a9eff"
              style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
              maxLength={7}
            />
            <div style={{ ...colorSwatch, background: primaryColor }} />
          </div>
        </Field>

        {/* ── LOGO ──────────────────────────────────────────────── */}
        <Field
          label="LOGO"
          hint={`PNG, JPG, or WebP. EXACTLY ${LOGO_REQ_WIDTH}×${LOGO_REQ_HEIGHT} pixels. Max ${LOGO_MAX_BYTES / 1024} KB.`}
        >
          <div style={logoRowStyle}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onLogoChange}
              style={fileInputStyle}
              required
            />
            {logoPreview && (
              <div style={logoPreviewBoxStyle}>
                {/* Preview at the actual on-site dimensions */}
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  width={LOGO_REQ_WIDTH}
                  height={LOGO_REQ_HEIGHT}
                  style={{ borderRadius: 6, border: '1px solid #2a4a8a', display: 'block' }}
                />
                <span style={{ fontSize: 10, color: '#888a92', marginLeft: 8 }}>
                  PREVIEW
                </span>
              </div>
            )}
          </div>
          {logoErr && <div style={errorTextStyle}>{logoErr}</div>}
        </Field>

        {submitErr && (
          <div style={errorBoxStyle}>
            <strong>Setup failed:</strong> {submitErr}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          style={{
            ...buttonStyle,
            opacity: !canSubmit || submitting ? 0.5 : 1,
            cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'PROVISIONING...' : '▶ PROVISION TENANT'}
        </button>

        <div style={footerNoteStyle}>
          Your subdomain becomes the login URL for your entire team.
        </div>
      </form>
    </main>
  )
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
  maxWidth: 520,
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
  display: 'flex',
  alignItems: 'center',
  padding: '8px 10px',
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