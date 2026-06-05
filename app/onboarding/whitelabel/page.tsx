'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { WhitelabelLivePreview } from '@/components/WhitelabelLivePreview'

// =============================================================================
// /onboarding/whitelabel — Pass 2 expansion (3-color)
// =============================================================================
// Pass 2 expansion (migration 003): 2 colors → 3 colors.
//   - PRESETS now carry pageBg per preset
//   - Custom picker now shows 3 ColorRows: Sidebar, Primary, Page background
//   - WhitelabelLivePreview receives pageBg and renders themed page-bg with
//     auto-contrast body text + derived card surfaces, so the user sees
//     readability on all 4 contrast points (sidebar, header, page body,
//     buttons) before saving
//   - POST body adds page_bg_color
//   - GET response includes page_bg_color
//   - Preset matching on initial load now checks all 3 colors
//
// Preserved from B3:
//   - 60-second propagation disclaimer
//   - Brand name input, subdomain input + 350ms debounced availability
//     check, 24h slug cooldown for edit mode, redirect grace logic
//   - Logo upload with sessionStorage handoff (so the dashboard sidebar
//     shows the new logo instantly after redirect, while the CDN
//     propagates the new URL)
//   - Edit mode (pre-fills from GET /api/whitelabel/onboarding)
//   - All error handling and submit flow
//   - Onboarding chrome stays DialerSeat default — only the preview
//     component reflects the user's color picks
// =============================================================================

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
    description:
      'Light gray-white sidebar, soft lavender accents, faint lavender page wash. Calm and easy on the eyes.',
    primary: '#b8a3e0',
    sidebar: '#e4e6eb',
    pageBg: '#f1ecf7',
  },
  {
    key: 'forest',
    label: 'Forest',
    description:
      'Deep forest sidebar, bright leaf-green accents, fresh green page wash. Earthy, grounded, confident.',
    primary: '#5fb87a',
    sidebar: '#1a3a26',
    pageBg: '#ecf5e8',
  },
  {
    key: 'bloom',
    label: 'Bloom',
    description:
      'Warm brown sidebar, rose pink accents, soft rose page wash. Soft, distinctive, memorable.',
    primary: '#e8b8c5',
    sidebar: '#6e5142',
    pageBg: '#fbeef2',
  },
]

const DEFAULT_PRESET = PRESETS[0] // Stone & Lavender — confirmed default
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/

// SessionStorage key for local-blob handoff to the dashboard after upload.
const PENDING_LOGO_KEY = 'wl:pendingLogoPreview'

type SlugStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'reserved' }
  | { kind: 'invalid'; reason: string }

export default function WhitelabelOnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [brandName, setBrandName] = useState('')
  const [slug, setSlug] = useState('')
  const [originalSlug, setOriginalSlug] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null)
  const [presetKey, setPresetKey] = useState<string>(DEFAULT_PRESET.key)
  const [primary, setPrimary] = useState<string>(DEFAULT_PRESET.primary)
  const [sidebar, setSidebar] = useState<string>(DEFAULT_PRESET.sidebar)
  const [pageBg, setPageBg] = useState<string>(DEFAULT_PRESET.pageBg)

  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Load existing tenant data ──────────────────────────────────────
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
          setOriginalSlug(data.tenant.slug || '')
          setExistingLogoUrl(data.tenant.logo_url || null)

          const loadedPrimary = data.tenant.primary_color || DEFAULT_PRESET.primary
          const loadedSidebar = data.tenant.sidebar_color || DEFAULT_PRESET.sidebar
          const loadedPageBg = data.tenant.page_bg_color || DEFAULT_PRESET.pageBg
          setPrimary(loadedPrimary)
          setSidebar(loadedSidebar)
          setPageBg(loadedPageBg)

          // Match loaded colors against the preset list (all 3 must match)
          const match = PRESETS.find(
            p =>
              p.primary.toLowerCase() === loadedPrimary.toLowerCase() &&
              p.sidebar.toLowerCase() === loadedSidebar.toLowerCase() &&
              p.pageBg.toLowerCase() === loadedPageBg.toLowerCase()
          )
          setPresetKey(match?.key || 'custom')
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isLoaded, user])

  // ─── Slug availability check (350ms debounce) ──────────────────────
  useEffect(() => {
    if (!slug) {
      setSlugStatus({ kind: 'idle' })
      return
    }
    if (!SLUG_REGEX.test(slug)) {
      setSlugStatus({
        kind: 'invalid',
        reason:
          'Use only lowercase letters, numbers, and hyphens (2-30 chars, no leading/trailing dash).',
      })
      return
    }
    if (editMode && originalSlug && slug === originalSlug) {
      setSlugStatus({ kind: 'available' })
      return
    }

    setSlugStatus({ kind: 'checking' })
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/whitelabel/check-subdomain?slug=${encodeURIComponent(slug)}`
        )
        const data = await res.json()
        if (data.reserved) setSlugStatus({ kind: 'reserved' })
        else if (data.available) setSlugStatus({ kind: 'available' })
        else setSlugStatus({ kind: 'taken' })
      } catch {
        setSlugStatus({ kind: 'idle' })
      }
    }, 350)
    return () => clearTimeout(t)
  }, [slug, editMode, originalSlug])

  // ─── Logo preview blob URL lifecycle ────────────────────────────────
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  const applyPreset = (key: string) => {
    setPresetKey(key)
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
  }

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
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
    if (!HEX_RE.test(primary)) {
      setError('Primary color must be a #RRGGBB hex value.')
      return
    }
    if (!HEX_RE.test(sidebar)) {
      setError('Sidebar color must be a #RRGGBB hex value.')
      return
    }
    if (!HEX_RE.test(pageBg)) {
      setError('Page background color must be a #RRGGBB hex value.')
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
      let logoUrl = existingLogoUrl
      let stashDataUrl: string | null = null

      if (logoFile) {
        // Pre-encode for instant-preview handoff to the dashboard
        try {
          stashDataUrl = await fileToDataUrl(logoFile)
        } catch {
          stashDataUrl = null
        }

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
        logoUrl = upData.url
      }

      const res = await fetch('/api/whitelabel/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: brandName.trim(),
          subdomain: slug.trim(),
          logo_url: logoUrl,
          primary_color: primary,
          sidebar_color: sidebar,
          page_bg_color: pageBg,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || data.error || 'Failed to save.')
        setSubmitting(false)
        return
      }

      // Instant-preview handoff: dashboard sidebar shows the new logo
      // immediately while CDN propagates the new URL.
      if (stashDataUrl && logoUrl) {
        try {
          sessionStorage.setItem(
            PENDING_LOGO_KEY,
            JSON.stringify({
              publicUrl: logoUrl,
              dataUrl: stashDataUrl,
              savedAt: Date.now(),
            })
          )
        } catch {
          // Storage quota exceeded or disabled — fail silently.
        }
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 12,
          letterSpacing: 3,
        }}
      >
        LOADING...
      </div>
    )
  }

  const displayLogo = logoPreviewUrl || existingLogoUrl
  const activePreset = PRESETS.find(p => p.key === presetKey)

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {/* Title + subtitle */}
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

        <form onSubmit={handleSubmit}>
          {/* ── BRAND NAME ── */}
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

          {/* ── SUBDOMAIN ── */}
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
              {renderSlugStatus(slugStatus, slug, editMode && slug === originalSlug)}
            </div>
          </div>

          {/* ── LOGO ── */}
          <div style={sectionStyle}>
            <label style={sectionLabelStyle}>▸ LOGO</label>
            <div style={hintStyle}>
              PNG or SVG. <strong>Exactly 512×148 pixels recommended</strong> (max 200 KB).
              Transparent backgrounds blend best. The preview below shows exactly how
              it'll fill the sidebar logo box — edge to edge, no padding.
            </div>
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

          {/* ── THEME ── */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>▸ THEME</div>
            <div style={presetGridStyle}>
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  style={presetCardStyle(presetKey === p.key)}
                >
                  <div style={presetSwatchRowStyle}>
                    <div style={{ ...presetSwatchStyle, background: p.sidebar }} />
                    <div style={{ ...presetSwatchStyle, background: p.primary }} />
                    <div style={{ ...presetSwatchStyle, background: p.pageBg }} />
                  </div>
                  <div style={presetNameStyle(presetKey === p.key)}>{p.label}</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                style={presetCardStyle(presetKey === 'custom')}
              >
                <div
                  style={{
                    ...presetSwatchRowStyle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 28,
                    color: 'var(--text-secondary)',
                    fontSize: 20,
                    letterSpacing: 0,
                  }}
                >
                  ✎
                </div>
                <div style={presetNameStyle(presetKey === 'custom')}>Custom</div>
              </button>
            </div>
            <div style={presetHintStyle}>
              {presetKey === 'custom'
                ? 'Pick your own sidebar, primary, and page background colors below.'
                : activePreset?.description}
            </div>

            {presetKey === 'custom' && (
              <div style={colorPickerGridStyle}>
                <ColorRow
                  label="Sidebar"
                  description="Sidebar background, header strip, and primary button background"
                  value={sidebar}
                  onChange={v => updateColor('sidebar', v)}
                />
                <ColorRow
                  label="Primary"
                  description="Buttons, accents, active states, focus rings, chart line"
                  value={primary}
                  onChange={v => updateColor('primary', v)}
                />
                <ColorRow
                  label="Page background"
                  description="The main background of every dashboard page — body text auto-contrasts against it"
                  value={pageBg}
                  onChange={v => updateColor('pageBg', v)}
                />
              </div>
            )}
          </div>

          {/* ── EXACT PREVIEW ── */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>▸ EXACT PREVIEW</div>
            <div style={{ ...hintStyle, marginBottom: 12 }}>
              This is exactly what your dashboard will look like with the colors and
              logo you've picked. Body text auto-picks white or near-black so it's
              always readable on your chosen background.
            </div>
            <WhitelabelLivePreview
              primary={primary}
              sidebar={sidebar}
              pageBg={pageBg}
              brandName={brandName}
              logoUrl={displayLogo}
            />
          </div>

          {/* ── PROPAGATION DISCLAIMER ── */}
          <div style={disclaimerBoxStyle}>
            <strong style={disclaimerHeadingStyle}>ⓘ HEADS UP</strong>
            <div style={{ marginTop: 6 }}>
              Color and logo changes propagate site-wide within 60 seconds. Your own
              browser updates instantly on save. Other users (your team, your
              customers) will see the new look after their next page load, up to a
              minute later.
            </div>
          </div>

          {error && <div style={errorBoxStyle}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...submitButtonStyle,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {submitting
              ? editMode
                ? 'SAVING...'
                : 'CONFIRMING...'
              : editMode
                ? '▶ SAVE CHANGES'
                : '▶ CONFIRM'}
          </button>

          {!editMode && (
            <div style={{ ...hintStyle, textAlign: 'center', marginTop: 12 }}>
              You can change everything later from this same page.
            </div>
          )}
        </form>
      </div>
    </main>
  )
}

// ─── Inline helper component ─────────────────────────────────────────

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
  status: SlugStatus,
  slug: string,
  isUnchangedEdit: boolean,
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
        ✓ {slug}.dialerseat.com {isUnchangedEdit ? '(your current subdomain)' : 'is available'}
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

// ─── Styles ──────────────────────────────────────────────────────────

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
  maxWidth: 720,
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

function presetCardStyle(selected: boolean): React.CSSProperties {
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
  width: 28,
  height: 28,
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
  marginBottom: 12,
}

const colorPickerGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 12,
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
  lineHeight: 1.5,
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

const disclaimerBoxStyle: React.CSSProperties = {
  background: 'rgba(74, 158, 255, 0.06)',
  border: '1px solid rgba(74, 158, 255, 0.3)',
  borderLeft: '3px solid var(--brand-primary)',
  borderRadius: 4,
  padding: '14px 16px',
  marginBottom: 20,
  fontSize: 12,
  lineHeight: 1.6,
  color: 'var(--text-primary)',
  letterSpacing: 0.3,
}

const disclaimerHeadingStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 3,
  color: 'var(--brand-primary)',
  fontWeight: 700,
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
  background: 'var(--surface)',
  borderTop: '3px solid var(--brand-primary)',
  border: 'none',
  borderRadius: 4,
  color: 'var(--brand-primary)',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 4,
  fontFamily: 'var(--font-futura)',
  cursor: 'pointer',
  marginTop: 8,
}