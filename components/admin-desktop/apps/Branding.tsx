'use client'
import { useEffect, useRef, useState } from 'react'

const FUTURA = "'Futura PT', Futura, sans-serif"
const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  text: '#1a1c24',
  muted: '#5a5e6a',
  primary: '#2a4a8a',
  green: '#1a6a1a',
  red: '#8a1a1a',
}

interface TenantSettings {
  brand_name: string
  slug: string
  logo_url: string | null
  primary_color: string
  sidebar_color: string
  header_bg_color: string
  page_bg_color: string
}

const COLOR_FIELDS: { key: keyof TenantSettings; label: string; hint: string }[] = [
  { key: 'primary_color', label: 'PRIMARY', hint: 'Buttons, links, accents' },
  { key: 'sidebar_color', label: 'SIDEBAR', hint: 'Left navigation background' },
  { key: 'header_bg_color', label: 'HEADER', hint: 'Top bar background' },
  { key: 'page_bg_color', label: 'PAGE BACKGROUND', hint: 'Main content area behind cards' },
]

export default function BrandingApp() {
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)

  const [original, setOriginal] = useState<TenantSettings | null>(null)
  const [form, setForm] = useState<TenantSettings | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/whitelabel/onboarding')
      const data = await res.json()
      if (data.status !== 'complete' || !data.tenant) {
        setNotFound(true)
        return
      }
      const settings: TenantSettings = {
        brand_name: data.tenant.brand_name,
        slug: data.tenant.slug,
        logo_url: data.tenant.logo_url,
        primary_color: data.tenant.primary_color,
        sidebar_color: data.tenant.sidebar_color,
        header_bg_color: data.tenant.header_bg_color,
        page_bg_color: data.tenant.page_bg_color,
      }
      setOriginal(settings)
      setForm(settings)
    } catch {
      setError('Could not load your branding settings.')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = form && original && JSON.stringify(form) !== JSON.stringify(original)

  const handleLogoFile = async (file: File) => {
    setUploading(true)
    setSaveError(null)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/whitelabel/upload-logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.detail || data.error || 'Logo upload failed')
        return
      }
      setForm(prev => prev ? { ...prev, logo_url: data.url } : prev)
    } catch (e: any) {
      setSaveError(e.message || 'Logo upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form || !original) return
    setSaving(true)
    setSaveError(null)
    try {
      const changed: Record<string, string | null> = {}
      for (const key of Object.keys(form) as (keyof TenantSettings)[]) {
        if (key === 'slug') continue // read-only here, on purpose
        if (form[key] !== original[key]) changed[key] = form[key]
      }
      if (Object.keys(changed).length === 0) return

      const res = await fetch('/api/whitelabel/branding/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changed),
      })
      const data = await res.json()
      if (!data.success) {
        setSaveError(data.error || 'Could not save changes')
        return
      }
      setOriginal(form)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 3000)
    } catch (e: any) {
      setSaveError(e.message || 'Could not save changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Centered><Muted>Loading your branding…</Muted></Centered>
  }

  if (notFound) {
    return (
      <Centered>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: T.muted, marginBottom: 8 }}>NO ACTIVE TENANT</div>
        <Muted>This account doesn't have an active white-label tenant to manage.</Muted>
      </Centered>
    )
  }

  if (error || !form) {
    return <Centered><span style={{ color: T.red, fontSize: 13 }}>{error || 'Something went wrong.'}</span></Centered>
  }

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'auto', background: T.bg,
      fontFamily: FUTURA, color: T.text, padding: 24,
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 'bold', color: T.muted, marginBottom: 4 }}>
          ▸ BRANDING — {form.slug}.dialerseat.com
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>Your brand</div>

        {/* LOGO */}
        <Section title="LOGO">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 12, background: 'white',
              border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
            }}>
              {form.logo_url
                ? <img src={form.logo_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <span style={{ color: T.muted, fontSize: 10 }}>NO LOGO</span>}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
              />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={btnSubtle(uploading)}>
                {uploading ? 'UPLOADING…' : 'UPLOAD NEW LOGO'}
              </button>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>PNG, SVG, JPG, or WebP</div>
            </div>
          </div>
        </Section>

        {/* BRAND NAME */}
        <Section title="BRAND NAME">
          <input
            value={form.brand_name}
            onChange={e => setForm(prev => prev ? { ...prev, brand_name: e.target.value } : prev)}
            maxLength={60}
            style={inputStyle}
          />
        </Section>

        {/* SUBDOMAIN (read-only) */}
        <Section title="SUBDOMAIN">
          <div style={{
            padding: '10px 12px', background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 4, fontSize: 13, color: T.muted, fontFamily: 'monospace',
          }}>
            {form.slug}.dialerseat.com
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>
            Changing your subdomain affects every link your agents already have — reach out if you need this changed.
          </div>
        </Section>

        {/* COLORS */}
        <Section title="COLORS">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {COLOR_FIELDS.map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 10, letterSpacing: 1, fontWeight: 'bold', color: T.muted, marginBottom: 6 }}>
                  {f.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={form[f.key] as string}
                    onChange={e => setForm(prev => prev ? { ...prev, [f.key]: e.target.value } : prev)}
                    style={{ width: 36, height: 36, border: `1px solid ${T.border}`, borderRadius: 4, padding: 0, cursor: 'pointer' }}
                  />
                  <input
                    value={form[f.key] as string}
                    onChange={e => setForm(prev => prev ? { ...prev, [f.key]: e.target.value } : prev)}
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>{f.hint}</div>
              </div>
            ))}
          </div>
        </Section>

        {saveError && <div style={{ color: T.red, fontSize: 12, marginBottom: 12 }}>{saveError}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{
              ...btnPrimary,
              opacity: !hasChanges || saving ? 0.5 : 1,
              cursor: !hasChanges || saving ? 'not-allowed' : 'pointer',
            }}
          >{saving ? 'SAVING…' : 'SAVE CHANGES'}</button>
          {savedAt && <span style={{ color: T.green, fontSize: 12, fontWeight: 'bold' }}>✓ SAVED</span>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 'bold', color: T.muted, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: FUTURA, textAlign: 'center', padding: 24,
    }}>{children}</div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: T.muted, fontSize: 13 }}>{children}</span>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'white', border: `1px solid ${T.border}`,
  borderRadius: 4, fontFamily: FUTURA, fontSize: 13, color: T.text,
}

const btnPrimary: React.CSSProperties = {
  padding: '12px 24px', background: T.primary, color: 'white', border: 'none', borderRadius: 4,
  fontSize: 11, letterSpacing: 2, fontWeight: 'bold', cursor: 'pointer', fontFamily: FUTURA,
}

function btnSubtle(busy: boolean): React.CSSProperties {
  return {
    padding: '10px 16px', background: 'transparent', color: T.primary, border: `1px solid ${T.primary}`,
    borderRadius: 4, fontSize: 11, letterSpacing: 1, fontWeight: 'bold',
    cursor: busy ? 'not-allowed' : 'pointer', fontFamily: FUTURA, opacity: busy ? 0.6 : 1,
  }
}
