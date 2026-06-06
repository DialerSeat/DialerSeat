'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { WhitelabelLivePreview } from '@/components/WhitelabelLivePreview'

// =============================================================================
// /onboarding/whitelabel — v5 (header/sidebar split + custom themes)
// =============================================================================
// v5 changes (migration 004 + custom_themes):
//   - 4-color theme model: header_bg_color now a separate Tier-1 color
//   - PRESETS rewritten: Preset 1 (new, JC's item 2 values), then
//     Preset 2 (Forest), Preset 3 (Bloom), Preset 4 (Stone & Lavender).
//     Default applied to a new tenant is Preset 1.
//   - Each preset has headerBg, defaulting to its sidebar value so the
//     visual stays unified unless the user picks divergent header in
//     Custom mode. Matches migration 004's backfill behavior.
//   - Custom picker now has 4 ColorRows (Sidebar, Header, Primary,
//     Page background).
//   - Saved themes fetched from /api/whitelabel/custom-themes and
//     rendered in the same grid as presets, with a × delete button.
//     Click a saved theme to load its values into the picker.
//   - New "+ SAVE AS NEW THEME (n/15)" button in edit mode opens an
//     inline name input; submit creates a new custom_theme via the
//     new endpoint. 15-per-user limit enforced both client- and
//     server-side. Button shows current count and is disabled at limit.
//   - Initial preset/theme match on tenant load checks all 4 colors.
//   - WhitelabelLivePreview call now passes headerBg.
//   - POST /api/whitelabel/onboarding body includes header_bg_color.
//
// Preserved from v4:
//   - 60-second propagation disclaimer
//   - Brand name input + subdomain 350ms debounced availability check
//   - 24h slug cooldown for edit mode, redirect grace logic
//   - Logo upload + sessionStorage handoff for instant dashboard preview
//   - Edit mode (pre-fills from GET /api/whitelabel/onboarding)
//   - Onboarding chrome stays DialerSeat default — only the preview
//     component reflects the user's color picks
// =============================================================================

interface Preset {
  key: string
  label: string
  description: string
  primary: string
  sidebar: string
  headerBg: string
  pageBg: string
}

interface SavedTheme {
  id: string
  name: string
  primary_color: string
  sidebar_color: string
  header_bg_color: string
  page_bg_color: string
  created_at: string
}

// Preset 1 sidebar==header per JC's item 2 ("keep its header the same as
// sidebar"). All other presets also default headerBg = sidebar so the
// unbranded visual stays unified.
const PRESETS: Preset[] = [
  {
    key: 'preset-1',
    label: 'Preset 1',
    description:
      'Deep brown chrome with slate blue accents on a warm gray dashboard. Quiet and confident.',
    primary: '#62839d',
    sidebar: '#3b261b',
    headerBg: '#3b261b',
    pageBg: '#5b5759',
  },
  {
    key: 'preset-2',
    label: 'Preset 2',
    description:
      'Deep forest chrome, bright leaf-green accents, fresh green page wash. Earthy and grounded.',
    primary: '#5fb87a',
    sidebar: '#1a3a26',
    headerBg: '#1a3a26',
    pageBg: '#ecf5e8',
  },
  {
    key: 'preset-3',
    label: 'Preset 3',
    description:
      'Warm brown chrome, rose pink accents, soft rose page wash. Soft, distinctive, memorable.',
    primary: '#e8b8c5',
    sidebar: '#6e5142',
    headerBg: '#6e5142',
    pageBg: '#fbeef2',
  },
  {
    key: 'preset-4',
    label: 'Preset 4',
    description:
      'Light gray-white chrome, soft lavender accents, faint lavender page wash. Calm and easy on the eyes.',
    primary: '#b8a3e0',
    sidebar: '#e4e6eb',
    headerBg: '#e4e6eb',
    pageBg: '#f1ecf7',
  },
]

const DEFAULT_PRESET = PRESETS[0]
const MAX_SAVED_THEMES = 15
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/

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
  const [headerBg, setHeaderBg] = useState<string>(DEFAULT_PRESET.headerBg)
  const [pageBg, setPageBg] = useState<string>(DEFAULT_PRESET.pageBg)

  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([])
  const [saveAsNewOpen, setSaveAsNewOpen] = useState(false)
  const [newThemeName, setNewThemeName] = useState('')
  const [savingAsNew, setSavingAsNew] = useState(false)
  const [saveAsNewError, setSaveAsNewError] = useState<string | null>(null)
  const [saveAsNewSuccess, setSaveAsNewSuccess] = useState<string | null>(null)
  const [deletingThemeId, setDeletingThemeId] = useState<string | null>(null)

  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Load existing tenant data + saved themes ──────────────────────
  useEffect(() => {
    if (!isLoaded || !user) return
    let cancelled = false

    Promise.all([
      fetch('/api/whitelabel/onboarding').then(r => r.json()).catch(() => null),
      fetch('/api/whitelabel/custom-themes').then(r => r.json()).catch(() => null),
    ]).then(([tenantData, themesData]) => {
      if (cancelled) return

      // Saved themes
      const themes: SavedTheme[] = themesData?.themes || []
      setSavedThemes(themes)

      // Existing tenant
      if (tenantData?.tenant) {
        setEditMode(true)
        setBrandName(tenantData.tenant.brand_name || '')
        setSlug(tenantData.tenant.slug || '')
        setOriginalSlug(tenantData.tenant.slug || '')
        setExistingLogoUrl(tenantData.tenant.logo_url || null)

        const loadedPrimary = tenantData.tenant.primary_color || DEFAULT_PRESET.primary
        const loadedSidebar = tenantData.tenant.sidebar_color || DEFAULT_PRESET.sidebar
        const loadedHeaderBg =
          tenantData.tenant.header_bg_color || loadedSidebar // fallback to sidebar
        const loadedPageBg = tenantData.tenant.page_bg_color || DEFAULT_PRESET.pageBg
        setPrimary(loadedPrimary)
        setSidebar(loadedSidebar)
        setHeaderBg(loadedHeaderBg)
        setPageBg(loadedPageBg)

        // Try matching against presets first, then saved themes, then fall
        // back to 'custom'. All 4 colors must match.
        const matchedPreset = PRESETS.find(
          p =>
            p.primary.toLowerCase() === loadedPrimary.toLowerCase() &&
            p.sidebar.toLowerCase() === loadedSidebar.toLowerCase() &&
            p.headerBg.toLowerCase() === loadedHeaderBg.toLowerCase() &&
            p.pageBg.toLowerCase() === loadedPageBg.toLowerCase()
        )
        if (matchedPreset) {
          setPresetKey(matchedPreset.key)
        } else {
          const matchedTheme = themes.find(
            t =>
              t.primary_color.toLowerCase() === loadedPrimary.toLowerCase() &&
              t.sidebar_color.toLowerCase() === loadedSidebar.toLowerCase() &&
              t.header_bg_color.toLowerCase() === loadedHeaderBg.toLowerCase() &&
              t.page_bg_color.toLowerCase() === loadedPageBg.toLowerCase()
          )
          setPresetKey(matchedTheme ? `theme-${matchedTheme.id}` : 'custom')
        }
      }

      setLoading(false)
    }).catch(() => {
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
      setHeaderBg(p.headerBg)
      setPageBg(p.pageBg)
    }
  }

  const applyTheme = (theme: SavedTheme) => {
    setPresetKey(`theme-${theme.id}`)
    setPrimary(theme.primary_color)
    setSidebar(theme.sidebar_color)
    setHeaderBg(theme.header_bg_color)
    setPageBg(theme.page_bg_color)
  }

  const updateColor = (
    field: 'primary' | 'sidebar' | 'headerBg' | 'pageBg',
    value: string
  ) => {
    if (field === 'primary') setPrimary(value)
    else if (field === 'sidebar') setSidebar(value)
    else if (field === 'headerBg') setHeaderBg(value)
    else setPageBg(value)
    setPresetKey('custom')
  }

  const handleDeleteTheme = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    setDeletingThemeId(id)
    try {
      const res = await fetch(
        `/api/whitelabel/custom-themes?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || data.error || 'Delete failed.')
        setDeletingThemeId(null)
        return
      }
      // If the deleted theme was selected, fall back to Custom
      if (presetKey === `theme-${id}`) {
        setPresetKey('custom')
      }
      setSavedThemes(prev => prev.filter(t => t.id !== id))
      setDeletingThemeId(null)
    } catch (err: any) {
      alert(err.message || 'Delete failed.')
      setDeletingThemeId(null)
    }
  }

  const handleSaveAsNew = async () => {
    setSaveAsNewError(null)
    const name = newThemeName.trim()
    if (!name) {
      setSaveAsNewError('Name is required.')
      return
    }
    if (name.length > 40) {
      setSaveAsNewError('Name must be 40 characters or fewer.')
      return
    }
    if (savedThemes.length >= MAX_SAVED_THEMES) {
      setSaveAsNewError(`You've hit your limit of ${MAX_SAVED_THEMES} saved themes.`)
      return
    }
    if (!HEX_RE.test(primary) || !HEX_RE.test(sidebar) || !HEX_RE.test(headerBg) || !HEX_RE.test(pageBg)) {
      setSaveAsNewError('Fix invalid color values before saving.')
      return
    }

    setSavingAsNew(true)
    try {
      const res = await fetch('/api/whitelabel/custom-themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          sidebar_color: sidebar,
          header_bg_color: headerBg,
          primary_color: primary,
          page_bg_color: pageBg,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveAsNewError(data.detail || data.error || 'Save failed.')
        setSavingAsNew(false)
        return
      }
      // Refresh local list + select the new theme
      setSavedThemes(prev => [...prev, data.theme])
      setPresetKey(`theme-${data.theme.id}`)
      setSaveAsNewSuccess(`Saved "${data.theme.name}".`)
      setNewThemeName('')
      setSaveAsNewOpen(false)
      setSavingAsNew(false)
      setTimeout(() => setSaveAsNewSuccess(null), 3500)
    } catch (err: any) {
      setSaveAsNewError(err.message || 'Save failed.')
      setSavingAsNew(false)
    }
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
    if (!HEX_RE.test(headerBg)) {
      setError('Header color must be a #RRGGBB hex value.')
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
          header_bg_color: headerBg,
          page_bg_color: pageBg,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || data.error || 'Failed to save.')
        setSubmitting(false)
        return
      }

      // Instant-preview handoff for the dashboard.
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
  const activeSavedTheme =
    presetKey.startsWith('theme-')
      ? savedThemes.find(t => `theme-${t.id}` === presetKey)
      : undefined
  const atSavedThemeLimit = savedThemes.length >= MAX_SAVED_THEMES

  let pickerDescription: string
  if (presetKey === 'custom') {
    pickerDescription =
      'Pick your own sidebar, header, primary, and page background colors below.'
  } else if (activeSavedTheme) {
    pickerDescription = `Your saved theme "${activeSavedTheme.name}". Edit values below, then save changes to apply, or save as a new theme.`
  } else {
    pickerDescription = activePreset?.description || ''
  }

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
              it&apos;ll fill the logo box — edge to edge, no padding.
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
                    <div style={{ ...presetSwatchStyle, background: p.sidebar }} title="Sidebar" />
                    <div style={{ ...presetSwatchStyle, background: p.headerBg }} title="Header" />
                    <div style={{ ...presetSwatchStyle, background: p.primary }} title="Primary" />
                    <div style={{ ...presetSwatchStyle, background: p.pageBg }} title="Page background" />
                  </div>
                  <div style={presetNameStyle(presetKey === p.key)}>{p.label}</div>
                </button>
              ))}
              {savedThemes.map(t => (
                <div key={t.id} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => applyTheme(t)}
                    style={presetCardStyle(presetKey === `theme-${t.id}`)}
                  >
                    <div style={presetSwatchRowStyle}>
                      <div style={{ ...presetSwatchStyle, background: t.sidebar_color }} title="Sidebar" />
                      <div style={{ ...presetSwatchStyle, background: t.header_bg_color }} title="Header" />
                      <div style={{ ...presetSwatchStyle, background: t.primary_color }} title="Primary" />
                      <div style={{ ...presetSwatchStyle, background: t.page_bg_color }} title="Page background" />
                    </div>
                    <div style={presetNameStyle(presetKey === `theme-${t.id}`)}>{t.name}</div>
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteTheme(t.id, t.name)
                    }}
                    disabled={deletingThemeId === t.id}
                    title={`Delete "${t.name}"`}
                    style={themeDeleteButtonStyle}
                    aria-label={`Delete ${t.name}`}
                  >
                    {deletingThemeId === t.id ? '…' : '×'}
                  </button>
                </div>
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
            <div style={presetHintStyle}>{pickerDescription}</div>

            {presetKey === 'custom' && (
              <div style={colorPickerGridStyle}>
                <ColorRow
                  label="Sidebar"
                  description="Sidebar background and primary button background"
                  value={sidebar}
                  onChange={v => updateColor('sidebar', v)}
                />
                <ColorRow
                  label="Header"
                  description="Header strip background — the bar across the top of every dashboard page"
                  value={headerBg}
                  onChange={v => updateColor('headerBg', v)}
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
              logo you&apos;ve picked. Body text auto-picks white or near-black so it&apos;s
              always readable on your chosen background.
            </div>
            <WhitelabelLivePreview
              primary={primary}
              sidebar={sidebar}
              headerBg={headerBg}
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

          {/* ── SUBMIT BUTTONS ── */}
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

          {editMode && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSaveAsNewOpen(o => !o)
                  setSaveAsNewError(null)
                }}
                disabled={atSavedThemeLimit && !saveAsNewOpen}
                style={{
                  ...saveAsNewButtonStyle,
                  opacity: atSavedThemeLimit && !saveAsNewOpen ? 0.5 : 1,
                  cursor:
                    atSavedThemeLimit && !saveAsNewOpen ? 'not-allowed' : 'pointer',
                }}
                title={
                  atSavedThemeLimit
                    ? `You've hit your limit of ${MAX_SAVED_THEMES} saved themes. Delete one to save another.`
                    : undefined
                }
              >
                {saveAsNewOpen
                  ? '× CANCEL'
                  : `+ SAVE AS NEW THEME (${savedThemes.length}/${MAX_SAVED_THEMES})`}
              </button>

              {saveAsNewOpen && (
                <div style={saveAsNewPanelStyle}>
                  <div style={saveAsNewLabelStyle}>NAME THIS THEME</div>
                  <div style={saveAsNewInputRowStyle}>
                    <input
                      type="text"
                      value={newThemeName}
                      onChange={e => setNewThemeName(e.target.value)}
                      placeholder="e.g. Winter Brand, Holiday Variant..."
                      maxLength={40}
                      style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsNew}
                      disabled={savingAsNew || !newThemeName.trim()}
                      style={{
                        ...saveAsNewConfirmStyle,
                        opacity: savingAsNew || !newThemeName.trim() ? 0.5 : 1,
                        cursor:
                          savingAsNew || !newThemeName.trim() ? 'wait' : 'pointer',
                      }}
                    >
                      {savingAsNew ? 'SAVING...' : 'SAVE'}
                    </button>
                  </div>
                  {saveAsNewError && (
                    <div style={saveAsNewErrorStyle}>{saveAsNewError}</div>
                  )}
                  <div style={saveAsNewHintStyle}>
                    Saves the current colors as a named theme. Doesn&apos;t change
                    what your dashboard currently looks like — use ▶ SAVE CHANGES
                    above to apply.
                  </div>
                </div>
              )}

              {saveAsNewSuccess && (
                <div style={saveAsNewSuccessStyle}>✓ {saveAsNewSuccess}</div>
              )}
            </>
          )}

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
    width: '100%',
    color: 'var(--text-primary)',
  }
}

const presetSwatchRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  marginBottom: 10,
}

const presetSwatchStyle: React.CSSProperties = {
  width: 22,
  height: 28,
  borderRadius: 3,
  border: '1px solid rgba(255,255,255,0.08)',
  flex: 1,
}

function presetNameStyle(selected: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: 700,
    color: selected ? 'var(--brand-primary)' : 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }
}

const themeDeleteButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  width: 22,
  height: 22,
  padding: 0,
  background: 'rgba(0,0,0,0.4)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 3,
  fontSize: 14,
  lineHeight: 1,
  cursor: 'pointer',
  fontFamily: 'var(--font-futura)',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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

const saveAsNewButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  background: 'transparent',
  border: '1px dashed var(--border)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 3,
  fontFamily: 'var(--font-futura)',
  cursor: 'pointer',
  marginTop: 10,
}

const saveAsNewPanelStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 14,
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderLeft: '3px solid var(--brand-primary)',
  borderRadius: 4,
}

const saveAsNewLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 3,
  color: 'var(--text-muted)',
  marginBottom: 8,
  fontWeight: 700,
}

const saveAsNewInputRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'stretch',
}

const saveAsNewConfirmStyle: React.CSSProperties = {
  padding: '0 18px',
  background: 'var(--brand-primary)',
  border: 'none',
  borderRadius: 4,
  color: 'var(--brand-on-primary, #fff)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  fontFamily: 'var(--font-futura)',
  whiteSpace: 'nowrap',
}

const saveAsNewErrorStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '8px 10px',
  background: 'var(--color-error-bg)',
  border: '1px solid var(--color-error-border)',
  borderLeft: '3px solid var(--color-error)',
  color: 'var(--color-error)',
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 0.5,
}

const saveAsNewHintStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 10,
  letterSpacing: 0.5,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
}

const saveAsNewSuccessStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '8px 10px',
  background: 'var(--color-success-bg)',
  border: '1px solid var(--color-success-border)',
  borderLeft: '3px solid var(--color-success)',
  color: 'var(--color-success)',
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 0.5,
  textAlign: 'center',
}