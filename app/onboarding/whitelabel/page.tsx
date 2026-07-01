'use client'

import { useEffect, useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { WhitelabelLivePreview } from '@/components/WhitelabelLivePreview'
import LoginLinkSection from '@/components/LoginLinkSection'

// =============================================================================
// /onboarding/whitelabel — v10 (UI refresh, tenant-independent chrome)
// =============================================================================
// v10 is a visual-only pass. No state, handlers, effects, endpoints, or
// request/response shapes changed from v9 — every fetch call, field name,
// and validation rule below is byte-for-byte the same logic as before.
//
// What changed: the page's own chrome (card, labels, buttons, inputs) is now
// pinned to the fixed Pass 1 canonical palette instead of `var(--brand-*)` /
// `var(--text-*)` / `var(--surface)` etc. This is deliberate — this is the
// page where a tenant sets their brand colors, so it should never itself be
// reskinned by whatever brand color happens to be live (or mid-edit). The
// only place actual tenant colors appear is inside <WhitelabelLivePreview>
// and <LoginLinkSection>, which are supposed to render the real thing.
//
// v9 added the optional subdomain-login link via LoginLinkSection.
// v8 (Push E): cancel moved to bottom + logo recos.
// v7 (Push C): saved themes dropdown its own card above EXACT PREVIEW.
// v6 (Push A): emoji removed, saved themes collapsible, cancel added, etc.
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
  logo_url: string | null
  created_at: string
}

const PRESETS: Preset[] = [
  {
    key: 'preset-1',
    label: 'Preset 1',
    description:
      'Warm gray sidebar, forest-green header, near-black accent on a muted green page.',
    primary: '#101017',
    sidebar: '#514f4d',
    headerBg: '#208330',
    pageBg: '#5f635f',
  },
  {
    key: 'preset-2',
    label: 'Preset 2',
    description:
      'Clean light gray sidebar, white header, deep corporate blue accent on a white page.',
    primary: '#00539B',
    sidebar: '#dbdbdb',
    headerBg: '#ffffff',
    pageBg: '#ffffff',
  },
  {
    key: 'preset-3',
    label: 'Preset 3',
    description:
      'Slate teal — deep blue-gray chrome with a bright teal accent, monochrome page wash.',
    primary: '#1ABC9C',
    sidebar: '#2C3E50',
    headerBg: '#2C3E50',
    pageBg: '#2C3E50',
  },
  {
    key: 'preset-4',
    label: 'Preset 4',
    description:
      'All black chrome and page with a soft charcoal accent. Stealth and minimal.',
    primary: '#363636',
    sidebar: '#000000',
    headerBg: '#000000',
    pageBg: '#000000',
  },
  {
    key: 'preset-5',
    label: 'Preset 5',
    description:
      'Warm stone chrome with a taupe accent on a charcoal page. Understated and editorial.',
    primary: '#9C8F84',
    sidebar: '#D8D9D6',
    headerBg: '#D8D9D6',
    pageBg: '#3D3D3D',
  },
  {
    key: 'preset-6',
    label: 'Preset 6',
    description:
      'Deep brown chrome with slate blue accents on a warm gray dashboard. Quiet and confident.',
    primary: '#62839d',
    sidebar: '#3b261b',
    headerBg: '#3b261b',
    pageBg: '#5b5759',
  },
  {
    key: 'preset-7',
    label: 'Preset 7',
    description:
      'Soft light gray chrome, lavender accent, faint lavender page wash. Calm and easy on the eyes.',
    primary: '#b8a3e0',
    sidebar: '#e4e6eb',
    headerBg: '#e4e6eb',
    pageBg: '#f1ecf7',
  },
  {
    key: 'preset-default',
    label: 'Default',
    description:
      'The standard DialerSeat look — use this to run as the default DialerSeat tenant.',
    primary: '#4a9eff',
    sidebar: '#111118',
    headerBg: '#1a1a2e',
    pageBg: '#f0f1f4',
  },
]

// The Default (standard DialerSeat) preset is the initial/fallback theme for a
// new tenant — pinned by key so reordering the visible list never changes it.
const DEFAULT_PRESET = PRESETS.find(p => p.key === 'preset-default') ?? PRESETS[0]
const MAX_SAVED_THEMES = 15
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/
const HEX_RE = /^#[0-9a-fA-F]{6}$/

const PENDING_LOGO_KEY = 'wl:pendingLogoPreview'

// ─── Design tokens — Pass 1 canonical palette, hardcoded on purpose ───────
// This page must look identical no matter what a tenant has set (or is
// mid-editing) for `--brand-primary` and friends, so nothing below reads
// from a CSS custom property — everything is a literal value from the
// locked Pass 1 spec. ACCENT is the Pass 1 fallback for --brand-primary,
// used here as this page's own fixed signature color.
const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`
const MONO = `'SF Mono', 'Roboto Mono', ui-monospace, 'Courier New', monospace`

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const ACCENT = '#4a9eff'

const STATUS = {
  success: { bg: '#e8f5e8', fg: T.green },
  info: { bg: '#e8eef8', fg: T.accent },
  warn: { bg: '#f8f4e8', fg: T.amber },
  danger: { bg: '#f8e8e8', fg: T.red },
  neutral: { bg: '#f0f0f4', fg: T.muted },
}

type SlugStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'reserved' }
  | { kind: 'invalid'; reason: string }

export default function WhitelabelOnboardingPage() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
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

  // v9: optional subdomain-login link
  const [loginLinkLabel, setLoginLinkLabel] = useState('')
  const [loginLinkText, setLoginLinkText] = useState('')
  const [loginLinkUrl, setLoginLinkUrl] = useState('')

  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([])
  const [savedThemesOpen, setSavedThemesOpen] = useState(false)
  const [saveAsNewOpen, setSaveAsNewOpen] = useState(false)
  const [newThemeName, setNewThemeName] = useState('')
  const [savingAsNew, setSavingAsNew] = useState(false)
  const [saveAsNewError, setSaveAsNewError] = useState<string | null>(null)
  const [saveAsNewSuccess, setSaveAsNewSuccess] = useState<string | null>(null)
  const [deletingThemeId, setDeletingThemeId] = useState<string | null>(null)
  const [overwritingTheme, setOverwritingTheme] = useState(false)
  const [overwriteSuccess, setOverwriteSuccess] = useState<string | null>(null)

  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ kind: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abandoning, setAbandoning] = useState(false)

  useEffect(() => {
    if (!isLoaded || !user?.id) return
    let cancelled = false

    Promise.all([
      fetch('/api/whitelabel/onboarding').then(r => r.json()).catch(() => null),
      fetch('/api/whitelabel/custom-themes').then(r => r.json()).catch(() => null),
    ]).then(([tenantData, themesData]) => {
      if (cancelled) return

      const themes: SavedTheme[] = themesData?.themes || []
      setSavedThemes(themes)

      if (tenantData?.tenant) {
        setEditMode(true)
        setBrandName(tenantData.tenant.brand_name || '')
        setSlug(tenantData.tenant.slug || '')
        setOriginalSlug(tenantData.tenant.slug || '')
        setExistingLogoUrl(tenantData.tenant.logo_url || null)

        // v9: pre-fill login link
        setLoginLinkLabel(tenantData.tenant.login_link_label || '')
        setLoginLinkText(tenantData.tenant.login_link_text || '')
        setLoginLinkUrl(tenantData.tenant.login_link_url || '')

        const loadedPrimary = tenantData.tenant.primary_color || DEFAULT_PRESET.primary
        const loadedSidebar = tenantData.tenant.sidebar_color || DEFAULT_PRESET.sidebar
        const loadedHeaderBg =
          tenantData.tenant.header_bg_color || loadedSidebar
        const loadedPageBg = tenantData.tenant.page_bg_color || DEFAULT_PRESET.pageBg
        setPrimary(loadedPrimary)
        setSidebar(loadedSidebar)
        setHeaderBg(loadedHeaderBg)
        setPageBg(loadedPageBg)

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
          if (matchedTheme) {
            setPresetKey(`theme-${matchedTheme.id}`)
            setSavedThemesOpen(true)
          } else {
            setPresetKey('custom')
          }
        }
      }

      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [isLoaded, user?.id])

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
    if (theme.logo_url) {
      setExistingLogoUrl(theme.logo_url)
      setLogoFile(null)
    }
  }

  const updateColor = (
    field: 'primary' | 'sidebar' | 'headerBg' | 'pageBg',
    value: string
  ) => {
    if (field === 'primary') setPrimary(value)
    else if (field === 'sidebar') setSidebar(value)
    else if (field === 'headerBg') setHeaderBg(value)
    else setPageBg(value)
    if (presetKey.startsWith('preset-')) {
      setPresetKey('custom')
    }
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

  const resolveCurrentLogoUrl = async (): Promise<{ url: string | null; error?: string }> => {
    if (logoFile) {
      try {
        const fd = new FormData()
        fd.append('logo', logoFile)
        const upRes = await fetch('/api/whitelabel/upload-logo', {
          method: 'POST',
          body: fd,
        })
        const upData = await upRes.json()
        if (!upRes.ok) {
          return { url: null, error: upData.detail || upData.error || 'Logo upload failed.' }
        }
        return { url: upData.url }
      } catch (err: any) {
        return { url: null, error: err.message || 'Logo upload failed.' }
      }
    }
    return { url: existingLogoUrl }
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
    const { url: logoUrl, error: logoErr } = await resolveCurrentLogoUrl()
    if (logoErr) {
      setSaveAsNewError(logoErr)
      setSavingAsNew(false)
      return
    }

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
          logo_url: logoUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveAsNewError(data.detail || data.error || 'Save failed.')
        setSavingAsNew(false)
        return
      }
      setSavedThemes(prev => [...prev, data.theme])
      setPresetKey(`theme-${data.theme.id}`)
      setSavedThemesOpen(true)
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

  const handleOverwriteTheme = async () => {
    const themeId = presetKey.startsWith('theme-') ? presetKey.slice(6) : null
    if (!themeId) return
    const theme = savedThemes.find(t => t.id === themeId)
    if (!theme) return

    setOverwritingTheme(true)
    const { url: logoUrl, error: logoErr } = await resolveCurrentLogoUrl()
    if (logoErr) {
      alert(logoErr)
      setOverwritingTheme(false)
      return
    }

    try {
      const res = await fetch(
        `/api/whitelabel/custom-themes?id=${encodeURIComponent(themeId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primary_color: primary,
            sidebar_color: sidebar,
            header_bg_color: headerBg,
            page_bg_color: pageBg,
            logo_url: logoUrl,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        alert(data.detail || data.error || 'Overwrite failed.')
        setOverwritingTheme(false)
        return
      }
      setSavedThemes(prev => prev.map(t => t.id === data.theme.id ? data.theme : t))
      setOverwriteSuccess(`Updated "${data.theme.name}".`)
      setTimeout(() => setOverwriteSuccess(null), 3500)
      setOverwritingTheme(false)
    } catch (err: any) {
      alert(err.message || 'Overwrite failed.')
      setOverwritingTheme(false)
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
    if (!editMode && !logoFile && !existingLogoUrl) {
      setError('Logo is required.')
      return
    }
    if (editMode && !logoFile && !existingLogoUrl) {
      setError('Logo is required.')
      return
    }

    // v9: light client-side guard for the optional login link — if the user
    // started one, require both clickable text and URL. Server re-validates.
    const wantsLink =
      loginLinkText.trim().length > 0 ||
      loginLinkUrl.trim().length > 0 ||
      loginLinkLabel.trim().length > 0
    if (wantsLink && (!loginLinkText.trim() || !loginLinkUrl.trim())) {
      setError('Your login link needs both clickable text and a URL — or clear the link fields.')
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
          // v9: optional login link
          login_link_label: loginLinkLabel.trim(),
          login_link_text: loginLinkText.trim(),
          login_link_url: loginLinkUrl.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || data.error || 'Failed to save.')
        setSubmitting(false)
        return
      }

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
        } catch {}
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setSubmitting(false)
    }
  }

  // Edit mode unchanged (→ /dashboard); new-user mode signs out exactly like
  // the billing page cancel does.
  const handleCancel = async () => {
    if (editMode) {
      router.push('/dashboard')
      return
    }
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

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.bg,
          color: T.muted,
          fontFamily: FUTURA,
          fontSize: 11,
          fontWeight: 700,
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
    pickerDescription = `Your saved theme "${activeSavedTheme.name}". Edit colors below, then OVERWRITE to update this theme, SAVE AS NEW to save a copy, or SAVE CHANGES to apply to your live tenant.`
  } else {
    pickerDescription = activePreset?.description || ''
  }

  return (
    <main className="wl-onboard" style={pageStyle}>
      <style>{`
        .wl-onboard * { box-sizing: border-box; }
        .wl-onboard input:focus-visible,
        .wl-onboard button:focus-visible {
          outline: 2px solid ${ACCENT};
          outline-offset: 2px;
        }
        .wl-onboard input[type="text"]:focus,
        .wl-onboard input[type="file"]:focus {
          border-color: ${ACCENT} !important;
        }
        .wl-btn-primary { transition: background-color 0.15s ease, border-color 0.15s ease; }
        .wl-btn-primary:hover:not(:disabled) { background: #e8eaf0; }
        .wl-btn-outline:hover:not(:disabled) { background: rgba(74,158,255,0.06); }
        .wl-btn-ghost:hover:not(:disabled) { color: ${T.text}; border-color: ${T.muted}; }
        .wl-preset-card:hover { border-color: ${ACCENT}; }
        .wl-theme-card:hover { border-color: ${ACCENT}; }
        @media (max-width: 640px) {
          .wl-card { padding: 22px 16px !important; }
          .wl-title { font-size: 17px !important; letter-spacing: 2px !important; }
          .wl-subdomain-row { flex-wrap: wrap !important; }
          .wl-subdomain-input { border-radius: 4px !important; }
          .wl-subdomain-suffix {
            width: 100% !important;
            border-radius: 4px !important;
            border-left: 1px solid ${T.border} !important;
            justify-content: flex-start !important;
          }
          .wl-preset-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .wl-saved-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <div className="wl-card" style={cardStyle}>
        <div style={{ marginBottom: 28 }}>
          <div className="wl-title" style={titleStyle}>
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
            <div className="wl-subdomain-row" style={subdomainRowStyle}>
              <input
                className="wl-subdomain-input"
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase())}
                placeholder="acme"
                maxLength={30}
                style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
              />
              <div className="wl-subdomain-suffix" style={subdomainSuffixStyle}>.dialerseat.com</div>
            </div>
            <div style={hintStyle}>
              {renderSlugStatus(slugStatus, slug, editMode && slug === originalSlug)}
            </div>
          </div>

          {/* ── LOGO ── */}
          <div style={sectionStyle}>
            <label style={sectionLabelStyle}>▸ LOGO</label>
            <div style={hintStyle}>
              PNG, SVG, GIF, JPEG, or WEBP. Recommended 512×148 px, under
              200KB — but any dimensions work; mobile auto-scales to fit.
              Transparent backgrounds blend best.
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0] || null
                setLogoFile(f)
              }}
              style={{ ...inputStyle, padding: 8, marginTop: 8 }}
            />
            {displayLogo && (
              <div style={logoPreviewBoxStyle}>
                <div style={logoPreviewLabelStyle}>PREVIEW</div>
                <img
                  src={displayLogo}
                  alt="Logo preview"
                  style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain', alignSelf: 'flex-start' }}
                />
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => setLogoFile(null)}
                    style={logoRemoveButtonStyle}
                  >REMOVE</button>
                )}
              </div>
            )}
          </div>

          {/* ── THEME — presets + Custom + color pickers ── */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>▸ THEME</div>

            <div className="wl-preset-grid" style={presetGridStyle}>
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className="wl-preset-card"
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
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                className="wl-preset-card"
                style={presetCardStyle(presetKey === 'custom')}
              >
                <div
                  style={{
                    ...presetSwatchRowStyle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 28,
                    color: T.muted,
                    fontSize: 18,
                    letterSpacing: 0,
                  }}
                >
                  ✎
                </div>
                <div style={presetNameStyle(presetKey === 'custom')}>Custom</div>
              </button>
            </div>

            <div style={presetHintStyle}>{pickerDescription}</div>

            {(presetKey === 'custom' || activeSavedTheme) && (
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

          {/* ── SAVED THEMES ── */}
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>▸ MY SAVED THEMES</div>
            <button
              type="button"
              onClick={() => setSavedThemesOpen(o => !o)}
              style={savedThemesToggleStyle}
            >
              <span>
                {savedThemesOpen ? '▾' : '▸'} {savedThemes.length} SAVED
              </span>
              {savedThemes.length === 0 && (
                <span style={savedThemesToggleHintStyle}>
                  none yet — save your current look below
                </span>
              )}
            </button>
            {savedThemesOpen && savedThemes.length > 0 && (
              <div className="wl-saved-grid" style={savedThemesGridStyle}>
                {savedThemes.map(t => (
                  <div key={t.id} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => applyTheme(t)}
                      className="wl-theme-card"
                      style={savedThemeCardStyle(presetKey === `theme-${t.id}`)}
                    >
                      <div style={presetSwatchRowStyle}>
                        <div style={{ ...presetSwatchStyle, background: t.sidebar_color }} />
                        <div style={{ ...presetSwatchStyle, background: t.header_bg_color }} />
                        <div style={{ ...presetSwatchStyle, background: t.primary_color }} />
                        <div style={{ ...presetSwatchStyle, background: t.page_bg_color }} />
                      </div>
                      {t.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.logo_url} alt="" style={savedThemeLogoStyle} />
                      ) : (
                        <div style={savedThemeNoLogoStyle}>NO LOGO</div>
                      )}
                      <div style={presetNameStyle(presetKey === `theme-${t.id}`)}>
                        {t.name}
                      </div>
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
              </div>
            )}
            {savedThemesOpen && savedThemes.length === 0 && (
              <div style={savedThemesEmptyStyle}>
                You haven't saved any themes yet. Configure your colors and
                logo, then use SAVE AS NEW THEME below to create one. You
                can save up to {MAX_SAVED_THEMES} themes per account.
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

          {/* ── LOGIN PAGE LINK (optional) ── */}
          <div style={sectionStyle}>
            <LoginLinkSection
              brandName={brandName}
              logoUrl={displayLogo}
              primaryColor={HEX_RE.test(primary) ? primary : '#4a9eff'}
              pageBgColor={HEX_RE.test(pageBg) ? pageBg : '#f0f1f4'}
              sidebarColor={HEX_RE.test(sidebar) ? sidebar : '#111118'}
              label={loginLinkLabel}
              text={loginLinkText}
              url={loginLinkUrl}
              onLabelChange={setLoginLinkLabel}
              onTextChange={setLoginLinkText}
              onUrlChange={setLoginLinkUrl}
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

          {/* ── SUBMIT ── */}
          <button
            type="submit"
            disabled={submitting}
            className="wl-btn-primary"
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
                ? 'SAVE CHANGES'
                : 'CONFIRM'}
          </button>

          {/* ── EDIT-MODE THEME PERSISTENCE ACTIONS ── */}
          {editMode && (
            <>
              {activeSavedTheme && (
                <button
                  type="button"
                  onClick={handleOverwriteTheme}
                  disabled={overwritingTheme}
                  className="wl-btn-outline"
                  style={{
                    ...overwriteButtonStyle,
                    opacity: overwritingTheme ? 0.5 : 1,
                    cursor: overwritingTheme ? 'wait' : 'pointer',
                  }}
                >
                  {overwritingTheme
                    ? 'OVERWRITING...'
                    : `↻ OVERWRITE "${activeSavedTheme.name}"`}
                </button>
              )}

              {overwriteSuccess && (
                <div style={saveAsNewSuccessStyle}>✓ {overwriteSuccess}</div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSaveAsNewOpen(o => !o)
                  setSaveAsNewError(null)
                }}
                disabled={atSavedThemeLimit && !saveAsNewOpen}
                className="wl-btn-ghost"
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
                    Saves the current colors and logo as a named theme.
                    Doesn&apos;t change what your dashboard currently looks
                    like — use SAVE CHANGES above to apply.
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

          {/* ── CANCEL ── */}
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting || abandoning}
            className="wl-btn-ghost"
            style={{
              ...cancelButtonStyle,
              opacity: submitting || abandoning ? 0.5 : 1,
              cursor: submitting || abandoning ? 'not-allowed' : 'pointer',
              marginTop: 20,
            }}
          >
            {abandoning ? 'CANCELING...' : 'Cancel'}
          </button>
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
  const handleHexChange = (raw: string) => {
    const digits = raw.replace(/#/g, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    onChange('#' + digits)
  }

  return (
    <div style={colorRowStyle}>
      <input
        type="color"
        value={HEX_RE.test(value) ? value : '#000000'}
        onChange={e => onChange(e.target.value)}
        style={colorSwatchInputStyle}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={colorRowLabelStyle}>{label}</div>
        <div style={colorRowDescStyle}>{description}</div>
      </div>
      <input
        type="text"
        value={value.startsWith('#') ? value : '#' + value}
        onChange={e => handleHexChange(e.target.value)}
        maxLength={7}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
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
  const pill = (fg: string, label: React.ReactNode) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: fg, fontWeight: 700, letterSpacing: 0.3 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      {label}
    </span>
  )

  if (status.kind === 'idle') {
    return <>Pick something memorable. 2-30 chars, lowercase, dashes ok.</>
  }
  if (status.kind === 'checking') {
    return <span style={{ color: T.muted }}>Checking availability...</span>
  }
  if (status.kind === 'available') {
    return pill(STATUS.success.fg, `${slug}.dialerseat.com ${isUnchangedEdit ? '(your current subdomain)' : 'is available'}`)
  }
  if (status.kind === 'taken') {
    return pill(STATUS.danger.fg, `${slug}.dialerseat.com is taken`)
  }
  if (status.kind === 'reserved') {
    return pill(STATUS.danger.fg, `${slug} is reserved by DialerSeat`)
  }
  if (status.kind === 'invalid') {
    return <span style={{ color: STATUS.warn.fg }}>{status.reason}</span>
  }
  return null
}

// ─── Styles ──────────────────────────────────────────────────────────
// Every value below is a literal from the fixed Pass 1 palette / ACCENT
// constant defined above this page's own chrome never reads a tenant
// `--brand-*` custom property, so it renders the same regardless of what
// any tenant has configured (or is mid-editing) for their live theme.

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: T.bg,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 20px',
  fontFamily: FUTURA,
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 720,
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderTop: `3px solid ${ACCENT}`,
  borderRadius: 6,
  padding: 36,
  color: T.text,
}

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 4,
  color: ACCENT,
  marginBottom: 8,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  letterSpacing: 0.5,
  lineHeight: 1.6,
  color: T.muted,
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 28,
}

const sectionLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  letterSpacing: 3,
  color: T.muted,
  marginBottom: 10,
  fontWeight: 700,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  color: T.text,
  fontSize: 14,
  letterSpacing: 0.5,
  fontFamily: FUTURA,
  outline: 'none',
  marginBottom: 8,
  boxSizing: 'border-box',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.5,
  color: T.muted,
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
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderLeft: 'none',
  borderRadius: '0 4px 4px 0',
  color: T.muted,
  fontSize: 13,
  fontFamily: MONO,
  whiteSpace: 'nowrap',
}

const logoPreviewBoxStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 4,
  border: `1px solid ${T.border}`,
  background: T.bg,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const logoPreviewLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: T.muted,
  fontWeight: 700,
}

const logoRemoveButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: 10,
  letterSpacing: 1,
  color: T.muted,
  background: 'transparent',
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: FUTURA,
}

const presetGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 10,
  marginBottom: 12,
}

function presetCardStyle(selected: boolean): React.CSSProperties {
  return {
    background: T.bg,
    border: selected ? `2px solid ${ACCENT}` : `1px solid ${T.border}`,
    padding: selected ? 11 : 12,
    borderRadius: 4,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: FUTURA,
    transition: 'border-color 0.15s',
    width: '100%',
    color: T.text,
  }
}

function savedThemeCardStyle(selected: boolean): React.CSSProperties {
  return {
    background: T.surface,
    border: selected ? `2px solid ${ACCENT}` : `1px solid ${T.border}`,
    padding: selected ? 9 : 10,
    borderRadius: 4,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: FUTURA,
    transition: 'border-color 0.15s',
    width: '100%',
    color: T.text,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
  border: '1px solid rgba(0,0,0,0.08)',
  flex: 1,
}

function presetNameStyle(selected: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: 700,
    color: selected ? ACCENT : T.text,
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
  background: 'rgba(26,26,46,0.55)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 3,
  fontSize: 14,
  lineHeight: 1,
  cursor: 'pointer',
  fontFamily: FUTURA,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const presetHintStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.5,
  color: T.muted,
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
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
}

const colorSwatchInputStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  padding: 0,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  flexShrink: 0,
}

const colorRowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 1,
  fontWeight: 700,
  color: T.text,
}

const colorRowDescStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.5,
  color: T.muted,
  marginTop: 2,
  lineHeight: 1.5,
}

const colorHexInputStyle: React.CSSProperties = {
  width: 90,
  padding: '8px 10px',
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  color: T.text,
  fontSize: 12,
  letterSpacing: 0.5,
  fontFamily: MONO,
  outline: 'none',
  boxSizing: 'border-box',
  flexShrink: 0,
}

const savedThemesToggleStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: T.bg,
  border: `1px dashed ${T.border}`,
  borderRadius: 4,
  color: T.text,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  fontFamily: FUTURA,
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
}

const savedThemesToggleHintStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: 0.5,
  color: T.muted,
  textTransform: 'none',
}

const savedThemesGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: 10,
  marginTop: 10,
  padding: 10,
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
}

const savedThemesEmptyStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 14,
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 4,
  fontSize: 11,
  letterSpacing: 0.5,
  color: T.muted,
  lineHeight: 1.6,
}

const savedThemeLogoStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  objectFit: 'contain',
  objectPosition: 'center',
  background: 'rgba(0,0,0,0.04)',
  borderRadius: 3,
  display: 'block',
}

const savedThemeNoLogoStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  background: 'rgba(0,0,0,0.04)',
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 8,
  letterSpacing: 2,
  color: T.muted,
  fontWeight: 700,
}

const disclaimerBoxStyle: React.CSSProperties = {
  background: 'rgba(74, 158, 255, 0.06)',
  border: '1px solid rgba(74, 158, 255, 0.3)',
  borderLeft: `3px solid ${ACCENT}`,
  borderRadius: 4,
  padding: '14px 16px',
  marginBottom: 20,
  fontSize: 12,
  lineHeight: 1.6,
  color: T.text,
  letterSpacing: 0.3,
}

const disclaimerHeadingStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 3,
  color: ACCENT,
  fontWeight: 700,
}

const errorBoxStyle: React.CSSProperties = {
  background: STATUS.danger.bg,
  border: '1px solid rgba(138,26,26,0.25)',
  borderLeft: `3px solid ${STATUS.danger.fg}`,
  color: STATUS.danger.fg,
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
  background: T.bg,
  borderTop: `3px solid ${ACCENT}`,
  border: 'none',
  borderRadius: 4,
  color: ACCENT,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 4,
  fontFamily: FUTURA,
  cursor: 'pointer',
  marginTop: 8,
}

const cancelButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  background: 'transparent',
  border: 'none',
  color: T.muted,
  fontSize: 11,
  letterSpacing: 2,
  cursor: 'pointer',
  fontFamily: FUTURA,
}

const overwriteButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  background: 'transparent',
  border: `1px solid ${ACCENT}`,
  borderRadius: 4,
  color: ACCENT,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 3,
  fontFamily: FUTURA,
  cursor: 'pointer',
  marginTop: 16,
}

const saveAsNewButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  background: 'transparent',
  border: `1px dashed ${T.border}`,
  borderRadius: 4,
  color: T.muted,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 3,
  fontFamily: FUTURA,
  cursor: 'pointer',
  marginTop: 10,
}

const saveAsNewPanelStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 14,
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderLeft: `3px solid ${ACCENT}`,
  borderRadius: 4,
}

const saveAsNewLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 3,
  color: T.muted,
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
  background: ACCENT,
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 2,
  fontFamily: FUTURA,
  whiteSpace: 'nowrap',
}

const saveAsNewErrorStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '8px 10px',
  background: STATUS.danger.bg,
  border: '1px solid rgba(138,26,26,0.25)',
  borderLeft: `3px solid ${STATUS.danger.fg}`,
  color: STATUS.danger.fg,
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 0.5,
}

const saveAsNewHintStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 10,
  letterSpacing: 0.5,
  color: T.muted,
  lineHeight: 1.5,
}

const saveAsNewSuccessStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '8px 10px',
  background: STATUS.success.bg,
  border: '1px solid rgba(26,106,26,0.25)',
  borderLeft: `3px solid ${STATUS.success.fg}`,
  color: STATUS.success.fg,
  borderRadius: 3,
  fontSize: 11,
  letterSpacing: 0.5,
  textAlign: 'center',
}