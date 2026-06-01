'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

// =============================================================================
// /onboarding/whitelabel — v2 (Phase D2 foundation: live-themed)
// =============================================================================
// The entire page IS the preview. Every surface, button, border, text
// color is bound to a --brand-* CSS variable. As the user picks colors,
// an inline <style> block updates those variables and the whole page
// re-themes in real-time.
//
// Six built-in presets at the top let users grab a polished look in
// 5 seconds. "Custom" unlocks the individual color pickers for power
// users.
//
// Logo upload is exactly 512×148 PNG/SVG. The block displays at 256×74
// in the sidebar (matching the dashboard layout). Anything else is
// rejected server-side by the upload API.
//
// On successful save, redirects to /dashboard. The save sets
// wl_onboarding_status='complete' which clears the proxy.ts hard-lock.
// =============================================================================

interface Preset {
  key: string
  label: string
  description: string
  primary: string
  secondary: string
  surface: string
  background: string
  text: string
}

// ──────────────────────────────────────────────────────────────────────────
// Pick a contrast-safe text color (black or white) for any background hex.
// Used for buttons that fill with --brand-primary as their background — the
// "PROVISION TENANT" submit button being the main one. Without this, a
// light primary like Slate's #f0f2f5 paired with the brand's near-white
// text color renders an invisible button label.
//
// Uses the standard sRGB relative luminance formula: anything above ~0.55
// is light enough that black text reads better; below uses white. The
// threshold is biased slightly toward picking black to be safe (white on
// medium-saturation primaries can still be hard to read).
// ──────────────────────────────────────────────────────────────────────────
function pickContrastText(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  // Linearize
  const lin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.55 ? '#1a1c24' : '#ffffff'
}

const PRESETS: Preset[] = [
  {
    key: 'default',
    label: 'DialerSeat Default',
    description: 'The original dark theme. Clean, professional, neutral.',
    primary: '#4a9eff',
    secondary: '#2a6eff',
    surface: '#1a1c24',
    background: '#0a0a0f',
    text: '#e0e2ea',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    description: 'Deep black backgrounds with electric blue accents.',
    primary: '#5fb3ff',
    secondary: '#3a7fff',
    surface: '#0d0d18',
    background: '#000005',
    text: '#f0f2fa',
  },
  {
    key: 'crimson',
    label: 'Crimson',
    description: 'Dark plum surface with bold red brand color.',
    primary: '#ff4d6d',
    secondary: '#d92645',
    surface: '#1f1018',
    background: '#0d0608',
    text: '#f0e0e4',
  },
  {
    key: 'forest',
    label: 'Forest',
    description: 'Dark green surface with bright lime primary.',
    primary: '#5fe78a',
    secondary: '#2dba5a',
    surface: '#0f1a12',
    background: '#06090a',
    text: '#e0f0e4',
  },
  {
    key: 'slate',
    label: 'Slate',
    description: 'Neutral gray surface with crisp white primary. Minimal.',
    primary: '#f0f2f5',
    secondary: '#c0c4cc',
    surface: '#222428',
    background: '#0e0f12',
    text: '#e6e8ec',
  },
  {
    key: 'sunrise',
    label: 'Sunrise',
    description: 'Warm dark surface with amber and orange highlights.',
    primary: '#ffa53e',
    secondary: '#ff6e1a',
    surface: '#1e1812',
    background: '#0a0805',
    text: '#f5ead8',
  },
]

interface BrandState {
  primary: string
  secondary: string
  surface: string
  background: string
  text: string
}

const DEFAULT_BRAND: BrandState = {
  primary: PRESETS[0].primary,
  secondary: PRESETS[0].secondary,
  surface: PRESETS[0].surface,
  background: PRESETS[0].background,
  text: PRESETS[0].text,
}

// Subdomain regex must match what middleware + DB constraint expect.
// 2-30 chars, lowercase a-z 0-9 -, can't start/end with -.
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/

export default function WhitelabelOnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // ── State ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [slug, setSlug] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null)
  const [presetKey, setPresetKey] = useState<string>('default')
  const [colors, setColors] = useState<BrandState>(DEFAULT_BRAND)

  // Subdomain live availability check
  const [slugStatus, setSlugStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'available' }
    | { kind: 'taken' }
    | { kind: 'reserved' }
    | { kind: 'invalid'; reason: string }
  >({ kind: 'idle' })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load existing tenant if user has already onboarded ───────────────
  useEffect(() => {
    if (!isLoaded || !user) return
    let cancelled = false

    fetch('/api/whitelabel/onboarding')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.tenant) {
          setEditMode(true)
          setBrandName(data.tenant.brand_name || '')
          setSlug(data.tenant.slug || '')
          setExistingLogoUrl(data.tenant.logo_url || null)
          setColors({
            primary: data.tenant.primary_color || DEFAULT_BRAND.primary,
            secondary: data.tenant.secondary_color || DEFAULT_BRAND.secondary,
            surface: data.tenant.accent_color || DEFAULT_BRAND.surface,
            background: data.tenant.background_color || DEFAULT_BRAND.background,
            text: data.tenant.text_color || DEFAULT_BRAND.text,
          })

          // Detect which preset (if any) matches the loaded colors
          const matchPreset = PRESETS.find(p =>
            p.primary === data.tenant.primary_color &&
            p.secondary === data.tenant.secondary_color &&
            p.surface === data.tenant.accent_color &&
            p.background === data.tenant.background_color &&
            p.text === data.tenant.text_color
          )
          setPresetKey(matchPreset?.key || 'custom')
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [isLoaded, user])

  // ── Subdomain availability check (debounced) ─────────────────────────
  useEffect(() => {
    if (!slug) {
      setSlugStatus({ kind: 'idle' })
      return
    }
    if (!SLUG_REGEX.test(slug)) {
      setSlugStatus({
        kind: 'invalid',
        reason: 'Use only lowercase letters, numbers, and hyphens (2-30 chars, no leading/trailing dash).',
      })
      return
    }
    // In edit mode, if slug hasn't changed from the saved value, skip the check
    setSlugStatus({ kind: 'checking' })
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/whitelabel/check-subdomain?slug=${encodeURIComponent(slug)}`)
        const data = await res.json()
        if (data.reserved) setSlugStatus({ kind: 'reserved' })
        else if (data.available) setSlugStatus({ kind: 'available' })
        else setSlugStatus({ kind: 'taken' })
      } catch {
        setSlugStatus({ kind: 'idle' })
      }
    }, 350)
    return () => clearTimeout(t)
  }, [slug])

  // ── Logo file → object URL for live preview ──────────────────────────
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  // ── Handlers ─────────────────────────────────────────────────────────
  const applyPreset = (key: string) => {
    setPresetKey(key)
    if (key === 'custom') return
    const p = PRESETS.find(p => p.key === key)
    if (p) {
      setColors({
        primary: p.primary,
        secondary: p.secondary,
        surface: p.surface,
        background: p.background,
        text: p.text,
      })
    }
  }

  const updateColor = (field: keyof BrandState, value: string) => {
    setColors(prev => ({ ...prev, [field]: value }))
    // Picking a custom color demotes the preset selection to "custom"
    setPresetKey('custom')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!brandName.trim()) {
      setError('Brand name is required.')
      return
    }
    if (!slug.trim()) {
      setError('Subdomain is required.')
      return
    }
    if (slugStatus.kind === 'invalid') {
      setError(slugStatus.reason)
      return
    }
    if (slugStatus.kind === 'taken' || slugStatus.kind === 'reserved') {
      setError('This subdomain is not available. Pick another.')
      return
    }
    if (!editMode && !logoFile) {
      setError('Logo is required. Upload a 512×148 PNG or SVG.')
      return
    }
    if (editMode && !logoFile && !existingLogoUrl) {
      setError('Logo is required.')
      return
    }

    setSubmitting(true)
    try {
      // Step 1: upload logo if a new file was selected
      let logoUrl = existingLogoUrl
      if (logoFile) {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const upRes = await fetch('/api/whitelabel/upload-logo', {
          method: 'POST',
          body: fd,
        })
        const upData = await upRes.json()
        if (!upRes.ok) {
          setError(upData.error || 'Logo upload failed.')
          setSubmitting(false)
          return
        }
        logoUrl = upData.logo_url
      }

      // Step 2: provision / update tenant
      const res = await fetch('/api/whitelabel/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName.trim(),
          subdomain: slug.trim(),
          logo_url: logoUrl,
          primary_color: colors.primary,
          secondary_color: colors.secondary,
          // The DB column is still called accent_color — we send our
          // "surface" picker value into that column. Reinterpretation
          // only; no migration.
          accent_color: colors.surface,
          background_color: colors.background,
          text_color: colors.text,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save.')
        setSubmitting(false)
        return
      }

      // Success → /dashboard. The hard-lock in proxy.ts clears now that
      // wl_onboarding_status is 'complete'.
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setSubmitting(false)
    }
  }

  // ── Live-theming style block ─────────────────────────────────────────
  // This injects --brand-* primitives at :root, which cascades through
  // globals.css's semantic tokens to re-theme the entire page in real time.
  const liveThemeStyle = useMemo(() => `
    :root {
      --brand-primary: ${colors.primary};
      --brand-secondary: ${colors.secondary};
      --brand-surface: ${colors.surface};
      --brand-bg: ${colors.background};
      --brand-text: ${colors.text};
    }
  `, [colors])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: 12,
        letterSpacing: 3,
      }}>
        LOADING...
      </div>
    )
  }

  const displayLogo = logoPreviewUrl || existingLogoUrl

  return (
    <>
      {/* Live theme injection — updates as the user picks colors */}
      <style dangerouslySetInnerHTML={{ __html: liveThemeStyle }} />

      <main style={pageStyle}>
        <div style={cardStyle}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={titleStyle}>
              {editMode ? 'EDIT YOUR WHITELABEL DIALER' : 'CUSTOMIZE YOUR WHITELABEL DIALER'}
            </div>
            <div style={subtitleStyle}>
              {editMode
                ? 'Your tenant is live. Make changes anytime — they propagate within 60 seconds.'
                : 'Pick your brand, your subdomain, your colors. Your customers see your dialer, not ours.'}
            </div>
          </div>

          {/* PRESETS */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>▸ THEME</div>
            <div style={presetGridStyle}>
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  style={presetCardStyle(p, presetKey === p.key)}
                >
                  <div style={presetSwatchRowStyle}>
                    <div style={{ ...presetSwatchStyle, background: p.background }} />
                    <div style={{ ...presetSwatchStyle, background: p.surface }} />
                    <div style={{ ...presetSwatchStyle, background: p.primary }} />
                    <div style={{ ...presetSwatchStyle, background: p.secondary }} />
                  </div>
                  <div style={presetNameStyle(presetKey === p.key)}>{p.label}</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                style={presetCardStyle(null, presetKey === 'custom')}
              >
                <div style={{
                  ...presetSwatchRowStyle,
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 24,
                  color: 'var(--text-secondary)',
                  fontSize: 18,
                  letterSpacing: 2,
                }}>
                  ✎
                </div>
                <div style={presetNameStyle(presetKey === 'custom')}>Custom</div>
              </button>
            </div>
            <div style={presetHintStyle}>
              {presetKey !== 'custom'
                ? PRESETS.find(p => p.key === presetKey)?.description
                : 'Tweak any color below to fine-tune.'}
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            {/* BRAND NAME */}
            <div style={sectionStyle}>
              <label style={sectionLabelStyle}>▸ BRAND NAME</label>
              <input
                type="text"
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="Acme Sales Group"
                maxLength={64}
                style={inputStyle}
              />
              <div style={hintStyle}>
                Shown in your dashboard sidebar header and on your sign-in page.
              </div>
            </div>

            {/* SUBDOMAIN */}
            <div style={sectionStyle}>
              <label style={sectionLabelStyle}>▸ SUBDOMAIN</label>
              <div style={subdomainRowStyle}>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase())}
                  placeholder="acme"
                  maxLength={30}
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
                <div style={subdomainSuffixStyle}>.dialerseat.com</div>
              </div>
              <div style={hintStyle}>
                {renderSlugStatus(slugStatus, slug)}
              </div>
            </div>

            {/* LOGO */}
            <div style={sectionStyle}>
              <label style={sectionLabelStyle}>▸ LOGO</label>
              <div style={hintStyle}>
                PNG or SVG. <strong>Exactly 512×148 pixels.</strong> Max 200 KB.
                Transparent backgrounds recommended — they blend into the sidebar.
              </div>

              {/* Live preview — uses the actual sidebar block dimensions */}
              {displayLogo && (
                <div style={logoPreviewWrapStyle}>
                  <div style={logoPreviewLabelStyle}>
                    PREVIEW (256×74 — your sidebar block):
                  </div>
                  <div style={logoPreviewBoxStyle}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayLogo}
                      alt="Your logo"
                      style={{
                        width: 256,
                        height: 74,
                        objectFit: 'contain',
                        objectPosition: 'left center',
                        display: 'block',
                      }}
                    />
                  </div>
                </div>
              )}

              <input
                type="file"
                accept="image/png,image/svg+xml"
                onChange={e => {
                  const f = e.target.files?.[0] || null
                  setLogoFile(f)
                }}
                style={{ ...inputStyle, padding: 8, marginTop: 8 }}
              />
            </div>

            {/* COLORS — only shown when "custom" is selected */}
            {presetKey === 'custom' && (
              <div style={sectionStyle}>
                <label style={sectionLabelStyle}>▸ COLORS</label>
                <div style={hintStyle}>
                  Page is themeing live as you pick. Status colors (errors, success) stay red and green.
                </div>

                <div style={colorPickerGridStyle}>
                  <ColorRow
                    label="Primary"
                    description="Buttons, links, active nav"
                    value={colors.primary}
                    onChange={v => updateColor('primary', v)}
                  />
                  <ColorRow
                    label="Secondary"
                    description="Button gradients, hover states"
                    value={colors.secondary}
                    onChange={v => updateColor('secondary', v)}
                  />
                  <ColorRow
                    label="Surface"
                    description="Sidebar, cards, modal backgrounds"
                    value={colors.surface}
                    onChange={v => updateColor('surface', v)}
                  />
                  <ColorRow
                    label="Background"
                    description="Page background, deepest layer"
                    value={colors.background}
                    onChange={v => updateColor('background', v)}
                  />
                  <ColorRow
                    label="Text"
                    description="Body text, headings"
                    value={colors.text}
                    onChange={v => updateColor('text', v)}
                  />
                </div>
              </div>
            )}

            {error && (
              <div style={errorBoxStyle}>{error}</div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...submitButtonStyle,
                color: pickContrastText(colors.primary),
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting
                ? (editMode ? 'SAVING...' : 'PROVISIONING...')
                : (editMode ? '▶ SAVE CHANGES' : '▶ PROVISION TENANT')}
            </button>

            {!editMode && (
              <div style={{ ...hintStyle, textAlign: 'center', marginTop: 12 }}>
                You can change everything later from this same page.
              </div>
            )}
          </form>
        </div>
      </main>
    </>
  )
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function ColorRow({
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
    <div style={colorRowStyle}>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={colorSwatchInputStyle}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={colorRowLabelStyle}>{label}</div>
        <div style={colorRowDescStyle}>{description}</div>
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={7}
        style={colorHexInputStyle}
      />
    </div>
  )
}

function renderSlugStatus(
  status:
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'available' }
    | { kind: 'taken' }
    | { kind: 'reserved' }
    | { kind: 'invalid'; reason: string },
  slug: string,
): React.ReactNode {
  if (status.kind === 'idle') {
    return <>Pick something memorable. 2-30 chars, lowercase, dashes ok.</>
  }
  if (status.kind === 'checking') {
    return <span style={{ color: 'var(--text-muted)' }}>Checking availability...</span>
  }
  if (status.kind === 'available') {
    return (
      <span style={{ color: 'var(--color-success)' }}>
        ✓ {slug}.dialerseat.com is available
      </span>
    )
  }
  if (status.kind === 'taken') {
    return (
      <span style={{ color: 'var(--color-error)' }}>
        ✗ {slug}.dialerseat.com is taken
      </span>
    )
  }
  if (status.kind === 'reserved') {
    return (
      <span style={{ color: 'var(--color-error)' }}>
        ✗ {slug} is reserved by DialerSeat
      </span>
    )
  }
  if (status.kind === 'invalid') {
    return <span style={{ color: 'var(--color-warning)' }}>{status.reason}</span>
  }
  return null
}

// =============================================================================
// STYLES — all use CSS variables so the page re-themes live
// =============================================================================

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--background)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 20px',
  fontFamily: 'var(--font-futura)',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 640,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderTop: '3px solid var(--brand-primary)',
  borderRadius: 6,
  padding: 36,
  color: 'var(--text-primary)',
}

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 4,
  color: 'var(--brand-primary)',
  marginBottom: 8,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: 0.5,
  lineHeight: 1.6,
  color: 'var(--text-secondary)',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 28,
}

const sectionLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  letterSpacing: 3,
  color: 'var(--text-muted)',
  marginBottom: 10,
  fontWeight: 700,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 14,
  letterSpacing: 0.5,
  fontFamily: 'var(--font-futura)',
  outline: 'none',
  marginBottom: 8,
  boxSizing: 'border-box',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.5,
  color: 'var(--text-muted)',
  lineHeight: 1.6,
  marginTop: 4,
}

const subdomainRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 0,
}

const subdomainSuffixStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderLeft: 'none',
  borderRadius: '0 4px 4px 0',
  color: 'var(--text-muted)',
  fontSize: 13,
  whiteSpace: 'nowrap',
}

const presetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 10,
  marginBottom: 12,
}

function presetCardStyle(p: Preset | null, selected: boolean): React.CSSProperties {
  return {
    background: 'var(--background)',
    border: selected ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
    padding: selected ? 11 : 12,
    borderRadius: 4,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-futura)',
    transition: 'border-color 0.15s',
  }
}

const presetSwatchRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginBottom: 10,
}

const presetSwatchStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.08)',
}

function presetNameStyle(selected: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: 700,
    color: selected ? 'var(--brand-primary)' : 'var(--text-primary)',
  }
}

const presetHintStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.5,
  color: 'var(--text-muted)',
  lineHeight: 1.6,
}

const logoPreviewWrapStyle: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 8,
}

const logoPreviewLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: 'var(--text-muted)',
  marginBottom: 8,
  fontWeight: 700,
}

// Preview box uses the actual sidebar surface color so user sees exactly
// what their logo will look like in the sidebar. Width matches 256+padding.
const logoPreviewBoxStyle: React.CSSProperties = {
  background: 'var(--brand-surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: 16,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
}

const colorPickerGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 8,
}

const colorRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 10,
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 4,
}

const colorSwatchInputStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  padding: 0,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
}

const colorRowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  fontWeight: 700,
  color: 'var(--text-primary)',
}

const colorRowDescStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.5,
  color: 'var(--text-muted)',
  marginTop: 2,
}

const colorHexInputStyle: React.CSSProperties = {
  width: 90,
  padding: '8px 10px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  color: 'var(--text-primary)',
  fontSize: 12,
  letterSpacing: 0.5,
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  boxSizing: 'border-box',
}

const errorBoxStyle: React.CSSProperties = {
  background: 'var(--color-error-bg)',
  border: '1px solid var(--color-error-border)',
  borderLeft: '3px solid var(--color-error)',
  color: 'var(--color-error)',
  padding: '12px 14px',
  borderRadius: 4,
  fontSize: 12,
  letterSpacing: 0.5,
  marginBottom: 16,
  lineHeight: 1.5,
}

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 16,
  background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
  border: 'none',
  borderRadius: 4,
  color: 'var(--brand-text)',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 4,
  fontFamily: 'var(--font-futura)',
  cursor: 'pointer',
  marginTop: 8,
  boxShadow: '0 0 30px color-mix(in srgb, var(--brand-primary) 25%, transparent)',
}