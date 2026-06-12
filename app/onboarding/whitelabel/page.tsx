'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { WhitelabelLivePreview } from '@/components/WhitelabelLivePreview'

// =============================================================================
// /onboarding/whitelabel — v8 (Push E: cancel moved to bottom + logo recos)
// =============================================================================
// v8 changes vs v7:
//   1. CANCEL button relocated to the absolute bottom of the form, below
//      every other action (submit, overwrite, save-as-new) and below the
//      "you can change everything later" hint. Per JC: a destructive
//      escape hatch belongs at the bottom, not nestled into the action
//      cluster at the top.
//   2. Logo hint reframed as a recommendation rather than a temporary
//      relaxation: "Recommended 512×148 px, under 200KB — but any
//      dimensions work; mobile auto-scales to fit." Per JC: the relaxed
//      validation is staying permanently; mobile rescales gracefully.
// 
// v7 (Push C):
//   - Saved themes dropdown moved out of THEME section to its own card
//     immediately above EXACT PREVIEW.
// 
// v6 (Push A):
//   - ▶ emoji removed from submit labels and hint text.
//   - Saved themes moved into collapsible dropdown.
//   - Cancel button added (now bottom-positioned in v8).
//   - Per-theme logos via applyTheme.
//   - OVERWRITE THIS THEME button when a saved theme is loaded.
//   - Logo size requirements stripped, file input accepts image/*.
// 
// Preserved from v5:
//   - 60-second propagation disclaimer.
//   - Brand name input + subdomain 350ms debounced availability check.
//   - 24h slug cooldown for edit mode, redirect grace logic.
//   - Logo upload + sessionStorage handoff for instant dashboard preview.
//   - Edit mode pre-fill from GET /api/whitelabel/onboarding.
//   - useEffect dependency on user?.id (stable string).
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

  const handleCancel = () => {
    if (editMode) {
      router.push('/dashboard')
    } else {
      router.push('/')
    }
  }