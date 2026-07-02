'use client'
import { useEffect, useState, useCallback } from 'react'
import { WhitelabelLivePreview } from '@/components/WhitelabelLivePreview'



























const C = {
  bg: '#f5f9fd',
  surface: '#ffffff',
  surfaceAlt: '#e2e4ea',
  border: '#c4c8d0',
  borderStrong: '#7ba6db',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  blue: '#4a9eff',
  blueDeep: '#2a6eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

type WLSubTabKey = 'tenants' | 'branding' | 'billing' | 'demoview' | 'settings'

interface WLSubTab {
  key: WLSubTabKey
  label: string
  status: 'live' | 'coming-soon'
}

const WL_SUBTABS: WLSubTab[] = [
  { key: 'tenants',   label: 'Tenants',    status: 'live' },
  { key: 'branding',  label: 'Branding',   status: 'live' },
  { key: 'billing',   label: 'Billing',    status: 'live' },
  { key: 'demoview',  label: 'Demo View',  status: 'live' },
  { key: 'settings',  label: 'Settings',   status: 'live' },
]



interface Tenant {
  id: string
  slug: string
  custom_domain: string | null
  status: 'active' | 'suspended' | 'cancelled'
  is_active: boolean
  owner_clerk_id: string
  brand_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  sidebar_color: string
  header_bg_color: string
  page_bg_color: string
  accent_color: string // legacy mirror of sidebar_color — read-only here
  support_email: string | null
  footer_text: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
  slug_changed_at: string | null
  last_applied_theme_id: string | null
}

interface TeamRow {
  id: string
  name: string
  owner_clerk_id: string
  tenant_id: string | null
  tenant_slug: string | null
  member_count: number
  campaign_count: number
  total_calls_30d: number
  status: 'active' | 'inactive'
  created_at: string
}

async function readError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    return j?.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export default function WhiteLabelApp() {
  const [activeSub, setActiveSub] = useState<WLSubTabKey>('tenants')

  return (
    <div style={{
      width: '100%',
      minHeight: '100%',
      background: C.bg,
      fontFamily: '"Segoe UI", Tahoma, sans-serif',
      color: C.text,
      fontSize: 12,
      padding: 16,
      boxSizing: 'border-box',
    }}>
      <style>{`
        .wl-subtab-strip {
          display: flex;
          border-bottom: 1px solid ${C.border};
          margin-bottom: 16px;
          overflow-x: auto;
        }
        .wl-subtab {
          padding: 8px 18px;
          background: transparent;
          border: 1px solid transparent;
          border-bottom: none;
          font-size: 11px;
          color: ${C.muted};
          cursor: pointer;
          margin-bottom: -1px;
          white-space: nowrap;
          font-family: inherit;
        }
        .wl-subtab:hover {
          background: ${C.surfaceAlt};
        }
        .wl-subtab.active {
          background: ${C.surface};
          border-color: ${C.border};
          border-bottom-color: ${C.surface};
          color: ${C.text};
          font-weight: bold;
        }
        .wl-subtab.coming-soon {
          font-style: italic;
          color: #999;
        }
        .wl-table {
          width: 100%;
          border-collapse: collapse;
          background: ${C.surface};
          border: 1px solid ${C.border};
        }
        .wl-table th {
          background: linear-gradient(to bottom, #f5f9fd, #dde7f1);
          padding: 7px 10px;
          text-align: left;
          font-size: 11px;
          font-weight: bold;
          color: ${C.text};
          border-bottom: 1px solid ${C.border};
          white-space: nowrap;
        }
        .wl-table td {
          padding: 7px 10px;
          font-size: 11px;
          border-bottom: 1px solid #f0f1f4;
        }
        .wl-table tr:hover td {
          background: #fffdf0;
        }
        .wl-table tr.selected td {
          background: ${C.blue};
          color: white;
        }
        .wl-input {
          padding: 5px 8px;
          font-size: 11px;
          border: 1px solid ${C.borderStrong};
          background: white;
          color: ${C.text};
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }
        .wl-input:focus {
          outline: 1px solid ${C.blue};
          outline-offset: -1px;
        }
        .wl-label {
          font-size: 11px;
          color: ${C.text};
          margin-bottom: 4px;
          display: block;
        }
        .wl-btn {
          padding: 5px 14px;
          background: linear-gradient(to bottom, #f5f9fd, #c0d4e8);
          border: 1px solid #7ba6db;
          border-radius: 3px;
          font-size: 11px;
          color: ${C.text};
          cursor: pointer;
          font-family: inherit;
        }
        .wl-btn:hover { background: linear-gradient(to bottom, #ffffff, #d0e0f0); }
        .wl-btn.primary {
          background: linear-gradient(to bottom, #5a9eff, #2a6eff);
          color: white;
          border-color: #1a4eaf;
          font-weight: bold;
        }
        .wl-btn.primary:hover { background: linear-gradient(to bottom, #6aaeff, #3a7eff); }
        .wl-btn.danger {
          background: linear-gradient(to bottom, #ff7070, #d04040);
          color: white;
          border-color: #a02020;
        }
        .wl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="wl-subtab-strip">
        {WL_SUBTABS.map(sub => (
          <div
            key={sub.key}
            className={`wl-subtab ${activeSub === sub.key ? 'active' : ''} ${sub.status === 'coming-soon' ? 'coming-soon' : ''}`}
            onClick={() => setActiveSub(sub.key)}
          >
            {sub.label}
            {sub.status === 'coming-soon' && <span style={{ marginLeft: 6, fontSize: 9 }}>(soon)</span>}
          </div>
        ))}
      </div>

      {activeSub === 'tenants' && <TenantsSubTab />}
      {activeSub === 'branding' && <BrandingSubTab />}
      {activeSub === 'demoview' && <DemoViewSubTab />}
      {activeSub === 'billing' && <BillingSubTab />}
      {activeSub === 'settings' && <SettingsSubTab />}
    </div>
  )
}




function TenantsSubTab() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Tenant | null>(null)

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tenants')
      if (!res.ok) throw new Error(await readError(res))
      const json = await res.json()
      setTenants(json.tenants ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setTenants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTenants() }, [fetchTenants])

  if (loading && tenants === null) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 11 }}>Loading tenants...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 2 }}>
            White Label Tenants
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {tenants?.length ?? 0} tenant{tenants?.length === 1 ? '' : 's'} registered
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="wl-btn" onClick={fetchTenants}>↻ Refresh</button>
          <button className="wl-btn primary" onClick={() => setShowCreate(true)}>+ New Tenant</button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fff4f4', border: '1px solid #c08080', padding: 12,
          fontSize: 11, color: C.red, marginBottom: 12,
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {tenants && tenants.length === 0 && !error && (
        <div style={{
          padding: 40, textAlign: 'center', background: C.surface,
          border: `1px solid ${C.border}`, color: C.muted, fontSize: 11,
        }}>
          No tenants yet. Click <strong>+ New Tenant</strong> to create your first white-label customer.
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <table className="wl-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Brand Name</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr
                key={t.id}
                className={selected?.id === t.id ? 'selected' : ''}
                onClick={() => setSelected(t)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ fontFamily: 'monospace' }}>{t.slug}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: 2,
                      background: t.primary_color, border: '1px solid rgba(0,0,0,0.2)',
                    }} />
                    {t.brand_name}
                  </span>
                </td>
                <td>
                  <span style={{
                    padding: '1px 6px', fontSize: 9, fontWeight: 'bold',
                    color: t.status === 'active' ? C.green : t.status === 'suspended' ? C.amber : C.red,
                    border: `1px solid currentColor`, borderRadius: 2,
                  }}>{(t.status || 'active').toUpperCase()}</span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 10, color: C.muted }}>
                  {t.owner_clerk_id.slice(0, 16)}...
                </td>
                <td style={{ fontSize: 10, color: C.muted }}>
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td>
                  <a
                    href={`https://${t.slug}.dialerseat.com`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: C.blue, fontSize: 10, textDecoration: 'underline' }}
                  >
                    visit →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchTenants() }} />}
      {selected && <TenantDetailModal tenant={selected} onClose={() => setSelected(null)} onUpdated={fetchTenants} />}
    </div>
  )
}

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [slug, setSlug] = useState('')
  const [brandName, setBrandName] = useState('')
  const [ownerClerkId, setOwnerClerkId] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4a9eff')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, brand_name: brandName, owner_clerk_id: ownerClerkId,
          support_email: supportEmail, primary_color: primaryColor,
        }),
      })
      if (!res.ok) throw new Error(await readError(res))
      onCreated()
    } catch (e: any) {
      setErr(e?.message ?? 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="New White Label Tenant" onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <label className="wl-label">Slug (subdomain) <span style={{ color: C.muted }}>e.g. &quot;acme&quot; → acme.dialerseat.com</span></label>
          <input className="wl-input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="acme" />
        </div>
        <div>
          <label className="wl-label">Brand Name</label>
          <input className="wl-input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Acme Dialer" />
        </div>
        <div>
          <label className="wl-label">Owner Clerk ID <span style={{ color: C.muted }}>(user_... — must already exist in users)</span></label>
          <input className="wl-input" value={ownerClerkId} onChange={(e) => setOwnerClerkId(e.target.value)} placeholder="user_..." style={{ fontFamily: 'monospace' }} />
        </div>
        <div>
          <label className="wl-label">Support Email <span style={{ color: C.muted }}>(optional)</span></label>
          <input className="wl-input" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@acme.com" />
        </div>
        <div>
          <label className="wl-label">Primary Color <span style={{ color: C.muted }}>(buttons + accents; the other 3 tokens start at defaults — edit in Branding)</span></label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 40, height: 26, border: `1px solid ${C.borderStrong}`, padding: 0, cursor: 'pointer' }} />
            <input className="wl-input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1, fontFamily: 'monospace' }} />
          </div>
        </div>

        {err && (
          <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 8, fontSize: 11, color: C.red }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 6 }}>
          <button className="wl-btn" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="wl-btn primary" onClick={submit} disabled={submitting || !slug || !brandName || !ownerClerkId}>
            {submitting ? 'Creating...' : 'Create Tenant'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function TenantDetailModal({ tenant, onClose, onUpdated }: {
  tenant: Tenant
  onClose: () => void
  onUpdated: () => void
}) {
  const [working, setWorking] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const setStatus = async (status: Tenant['status']) => {
    setWorking('status')
    setErr(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(await readError(res))
      onUpdated()
      onClose()
    } catch (e: any) {
      setErr(e?.message ?? 'Failed')
    } finally {
      setWorking(null)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete tenant "${tenant.slug}"? This cannot be undone.`)) return
    setWorking('delete')
    setErr(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await readError(res))
      onUpdated()
      onClose()
    } catch (e: any) {
      
      setErr(e?.message ?? 'Failed')
    } finally {
      setWorking(null)
    }
  }

  return (
    <ModalShell title={`Tenant: ${tenant.brand_name}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="ID" value={tenant.id} mono />
        <Field label="Slug" value={tenant.slug} mono />
        <Field label="Brand Name" value={tenant.brand_name} />
        <Field label="Owner" value={tenant.owner_clerk_id} mono />
        <Field label="Support Email" value={tenant.support_email ?? '(none)'} />
        <Field label="Custom Domain" value={tenant.custom_domain ?? '(none)'} mono />
        <Field label="Stripe Customer" value={tenant.stripe_customer_id ?? '(none)'} mono />
        <Field label="Stripe Subscription" value={tenant.stripe_subscription_id ?? '(none)'} mono />
        <Field label="Status" value={`${tenant.status || 'active'}${tenant.is_active ? '' : ' (inactive)'}`} />
        <Field label="Subdomain URL" value={`https://${tenant.slug}.dialerseat.com`} link />

        <div>
          <label className="wl-label">Theme Tokens</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              ['PRIMARY', tenant.primary_color],
              ['SIDEBAR', tenant.sidebar_color],
              ['HEADER', tenant.header_bg_color],
              ['PAGE', tenant.page_bg_color],
            ] as const).map(([label, color]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 38, height: 22, borderRadius: 2,
                  background: color || '#000', border: '1px solid rgba(0,0,0,0.25)',
                }} />
                <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {err && (
          <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 8, fontSize: 11, color: C.red }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {tenant.status === 'active' && (
            <button className="wl-btn" onClick={() => setStatus('suspended')} disabled={working !== null}>
              {working === 'status' ? 'Suspending...' : 'Suspend'}
            </button>
          )}
          {tenant.status !== 'active' && (
            <button className="wl-btn primary" onClick={() => setStatus('active')} disabled={working !== null}>
              {working === 'status' ? 'Activating...' : 'Activate'}
            </button>
          )}
          <a
            href={`https://${tenant.slug}.dialerseat.com`}
            target="_blank" rel="noopener noreferrer"
            className="wl-btn"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Visit Site ↗
          </a>
          <button className="wl-btn danger" onClick={remove} disabled={working !== null}>
            {working === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}





interface BrandingDraft {
  brand_name: string
  logo_url: string
  favicon_url: string
  support_email: string
  footer_text: string
  primary_color: string
  sidebar_color: string
  header_bg_color: string
  page_bg_color: string
}

function draftFrom(t: Tenant): BrandingDraft {
  return {
    brand_name: t.brand_name ?? '',
    logo_url: t.logo_url ?? '',
    favicon_url: t.favicon_url ?? '',
    support_email: t.support_email ?? '',
    footer_text: t.footer_text ?? '',
    primary_color: t.primary_color || '#4a9eff',
    sidebar_color: t.sidebar_color || '#1a1a2e',
    header_bg_color: t.header_bg_color || '#1a1a2e',
    page_bg_color: t.page_bg_color || '#0a0a14',
  }
}

function BrandingSubTab() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<BrandingDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tenants')
        if (!res.ok) throw new Error(await readError(res))
        const json = await res.json()
        const list: Tenant[] = json.tenants ?? []
        setTenants(list)
        if (list.length > 0) {
          setSelected(list[0])
          setDraft(draftFrom(list[0]))
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    if (!selected || !draft) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/tenants/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_name: draft.brand_name,
          logo_url: draft.logo_url || null,
          favicon_url: draft.favicon_url || null,
          support_email: draft.support_email || null,
          footer_text: draft.footer_text || null,
          primary_color: draft.primary_color,
          sidebar_color: draft.sidebar_color, // server mirrors accent_color
          header_bg_color: draft.header_bg_color,
          page_bg_color: draft.page_bg_color,
        }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const json = await res.json()
      const updated: Tenant = json.tenant
      setSelected(updated)
      setDraft(draftFrom(updated))
      setTenants(prev => prev.map(t => t.id === updated.id ? updated : t))
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2500)
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 11 }}>Loading...</div>

  if (error || tenants.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', color: C.muted, fontSize: 11,
        background: C.surface, border: `1px solid ${C.border}`,
      }}>
        {error ? <><strong>Error:</strong> {error}</> : 'No tenants to edit. Create one in the Tenants sub-tab first.'}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 300px', gap: 12, minHeight: 400 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 6, overflowY: 'auto', maxHeight: 600 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: C.muted, padding: '4px 6px', borderBottom: `1px solid ${C.border}` }}>
          TENANTS
        </div>
        {tenants.map(t => (
          <div
            key={t.id}
            onClick={() => { setSelected(t); setDraft(draftFrom(t)) }}
            style={{
              padding: 8, cursor: 'pointer',
              background: selected?.id === t.id ? C.blue : 'transparent',
              color: selected?.id === t.id ? 'white' : C.text,
              fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ width: 10, height: 10, background: t.primary_color, border: '1px solid rgba(0,0,0,0.2)' }} />
            {t.brand_name}
          </div>
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 12 }}>Edit Branding</div>
        {selected && draft && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="wl-label">Brand Name</label>
              <input className="wl-input" value={draft.brand_name} onChange={(e) => setDraft({ ...draft, brand_name: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="wl-label">Logo URL</label>
                <input className="wl-input" value={draft.logo_url} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="wl-label">Favicon URL</label>
                <input className="wl-input" value={draft.favicon_url} onChange={(e) => setDraft({ ...draft, favicon_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            <div>
              <label className="wl-label" style={{ fontWeight: 'bold' }}>
                Theme Tokens
                <span style={{ color: C.muted, fontWeight: 'normal', marginLeft: 6 }}>
                  — the 4 colors the tenant dashboard actually renders
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <ColorField label="PRIMARY — buttons, links, accents" value={draft.primary_color}    onChange={(v) => setDraft({ ...draft, primary_color: v })} />
                <ColorField label="SIDEBAR — left nav background"     value={draft.sidebar_color}    onChange={(v) => setDraft({ ...draft, sidebar_color: v })} />
                <ColorField label="HEADER — top bar background"       value={draft.header_bg_color}  onChange={(v) => setDraft({ ...draft, header_bg_color: v })} />
                <ColorField label="PAGE BG — content background"      value={draft.page_bg_color}    onChange={(v) => setDraft({ ...draft, page_bg_color: v })} />
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                The legacy <code>accent_color</code> is mirrored from SIDEBAR automatically on save.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="wl-label">Support Email</label>
                <input className="wl-input" value={draft.support_email} onChange={(e) => setDraft({ ...draft, support_email: e.target.value })} placeholder="support@acme.com" />
              </div>
              <div>
                <label className="wl-label">Footer Text</label>
                <input className="wl-input" value={draft.footer_text} onChange={(e) => setDraft({ ...draft, footer_text: e.target.value })} placeholder="Hosted by DialerSeat" />
              </div>
            </div>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="wl-btn primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save Branding'}
              </button>
              {savedFlash && <span style={{ fontSize: 11, color: C.green, fontWeight: 'bold' }}>✓ Saved</span>}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: C.muted, marginBottom: 8 }}>LIVE PREVIEW</div>
        {draft && (
          <WhitelabelLivePreview
            primary={draft.primary_color}
            sidebar={draft.sidebar_color}
            headerBg={draft.header_bg_color}
            pageBg={draft.page_bg_color}
            brandName={draft.brand_name}
            logoUrl={draft.logo_url || null}
          />
        )}
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="wl-label" style={{ fontSize: 10 }}>{label}</label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 30, height: 22, border: `1px solid ${C.borderStrong}`, padding: 0, cursor: 'pointer' }} />
        <input className="wl-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 10 }} />
      </div>
    </div>
  )
}




function DemoViewSubTab() {
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/teams')
        if (!res.ok) throw new Error(await readError(res))
        const json = await res.json()
        setTeams(json.teams ?? (Array.isArray(json) ? json : []))
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
        setTeams([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const startDemoView = async (team: TeamRow) => {
    setStarting(team.id)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: team.id }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const data = await res.json()
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank', 'noopener,noreferrer')
      }
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown'}`)
    } finally {
      setStarting(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 11 }}>Loading teams...</div>

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold' }}>Demo View</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
          Opens the selected team&apos;s site in a new tab — the tenant subdomain for white-label teams,
          the main dashboard otherwise. This shows the tenant&apos;s public experience; it does not sign
          you in as the team&apos;s users (true impersonation needs Clerk actor tokens — separate build).
          Branded subdomain rendering also depends on the wildcard-subdomain infrastructure, which is
          still pending.
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 12, fontSize: 11, color: C.red, marginBottom: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {teams && teams.length > 0 && (
        <table className="wl-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Tenant</th>
              <th>Members</th>
              <th>Campaigns</th>
              <th>Calls 30d</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.tenant_slug ? <span style={{ fontFamily: 'monospace' }}>{t.tenant_slug}</span> : <span style={{ color: C.muted }}>(DialerSeat)</span>}</td>
                <td>{t.member_count}</td>
                <td>{t.campaign_count}</td>
                <td>{t.total_calls_30d?.toLocaleString() ?? '0'}</td>
                <td>
                  <button
                    className="wl-btn primary"
                    onClick={() => startDemoView(t)}
                    disabled={starting === t.id}
                    style={{ fontSize: 10, padding: '3px 10px' }}
                  >
                    {starting === t.id ? 'Opening...' : 'Open Site →'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {teams && teams.length === 0 && !error && (
        <div style={{ padding: 40, textAlign: 'center', background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 11 }}>
          No teams found.
        </div>
      )}
    </div>
  )
}




interface BillingState {
  state: string
  planNickname: string | null
  amountCents: number
  currency: string
  interval: string
  intervalCount: number
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  mrrCents: number
}

interface BillingTenantRow {
  id: string
  slug: string
  brand_name: string
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  billing: BillingState | null
  billingError: string | null
}

interface Portfolio {
  tenantCount: number
  billedCount: number
  activeCount: number
  pastDueCount: number
  canceledCount: number
  mrrCents: number
  arrCents: number
  currency: string
}

function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

const BILLING_STATE_COLOR: Record<string, string> = {
  active: C.green, trialing: C.blue,
  past_due: C.amber, unpaid: C.amber,
  canceled: C.red, incomplete_expired: C.red, incomplete: C.muted,
  paused: C.muted, none: C.muted,
}

function intervalLabel(b: BillingState): string {
  const n = b.intervalCount > 1 ? `${b.intervalCount} ` : ''
  return `${n}${b.interval}${b.intervalCount > 1 ? 's' : ''}`
}

function BillingSubTab() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [rows, setRows] = useState<BillingTenantRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const fetchBilling = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/billing')
      if (!res.ok) throw new Error(await readError(res))
      const json = await res.json()
      setPortfolio(json.portfolio)
      setRows(json.tenants ?? [])
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBilling() }, [fetchBilling])

  if (loading && rows === null) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 11 }}>Loading billing from Stripe...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 'bold' }}>Billing</div>
          <div style={{ fontSize: 11, color: C.muted }}>Live Stripe state across all tenants. MRR normalized to a monthly figure.</div>
        </div>
        <button className="wl-btn" onClick={fetchBilling} disabled={loading}>
          {loading ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 12, fontSize: 11, color: C.red, marginBottom: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {portfolio && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <PortfolioCard label="MRR" value={money(portfolio.mrrCents, portfolio.currency)} sub={`${money(portfolio.arrCents, portfolio.currency)} ARR`} accent={C.green} />
          <PortfolioCard label="ACTIVE" value={String(portfolio.activeCount)} sub={`of ${portfolio.billedCount} billed`} accent={C.blue} />
          <PortfolioCard label="PAST DUE" value={String(portfolio.pastDueCount)} sub="needs attention" accent={portfolio.pastDueCount > 0 ? C.amber : C.muted} />
          <PortfolioCard label="CANCELED" value={String(portfolio.canceledCount)} sub={`${portfolio.tenantCount} tenants total`} accent={portfolio.canceledCount > 0 ? C.red : C.muted} />
        </div>
      )}

      {rows && rows.length > 0 && (
        <table className="wl-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>State</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>MRR</th>
              <th>Next Charge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => {
              const b = t.billing
              const stateColor = b ? (BILLING_STATE_COLOR[b.state] ?? C.muted) : C.muted
              return (
                <tr key={t.id} onClick={() => setDetailId(t.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <strong>{t.brand_name}</strong>
                    <span style={{ color: C.muted, marginLeft: 6, fontFamily: 'monospace', fontSize: 10 }}>{t.slug}</span>
                  </td>
                  <td>
                    {t.billingError ? (
                      <span style={{ color: C.red, fontSize: 10 }}>error</span>
                    ) : b ? (
                      <span style={{ padding: '1px 6px', fontSize: 9, fontWeight: 'bold', color: stateColor, border: '1px solid currentColor', borderRadius: 2 }}>
                        {b.state.toUpperCase().replace(/_/g, ' ')}
                        {b.cancelAtPeriodEnd ? ' · ENDING' : ''}
                      </span>
                    ) : (
                      <span style={{ color: C.muted, fontSize: 10 }}>no subscription</span>
                    )}
                  </td>
                  <td style={{ fontSize: 10 }}>{b?.planNickname ?? (b ? `every ${intervalLabel(b)}` : '—')}</td>
                  <td style={{ fontFamily: 'monospace' }}>{b ? `${money(b.amountCents, b.currency)}/${intervalLabel(b)}` : '—'}</td>
                  <td style={{ fontFamily: 'monospace', color: b && b.mrrCents > 0 ? C.green : C.muted }}>{b ? money(b.mrrCents, b.currency) : '—'}</td>
                  <td style={{ fontSize: 10, color: C.muted }}>{b?.currentPeriodEnd ? new Date(b.currentPeriodEnd).toLocaleDateString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {rows && rows.length === 0 && !error && (
        <div style={{ padding: 40, textAlign: 'center', background: C.surface, border: `1px solid ${C.border}`, color: C.muted, fontSize: 11 }}>
          No tenants to bill yet.
        </div>
      )}

      {detailId && <BillingDetailModal tenantId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

function PortfolioCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderTop: `3px solid ${accent}`, borderRadius: 4, padding: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: C.muted, fontWeight: 'bold', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace', color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{sub}</div>
    </div>
  )
}

interface BillingDetail extends BillingTenantRow {
  invoices: Array<{
    id: string; amountCents: number; currency: string; status: string | null
    created: string; reason: string | null; hostedUrl: string | null; pdfUrl: string | null
  }>
}

function BillingDetailModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<BillingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/billing?tenant_id=${tenantId}`)
        if (!res.ok) throw new Error(await readError(res))
        const json = await res.json()
        setDetail(json.tenant)
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantId])

  return (
    <ModalShell title={detail ? `Billing: ${detail.brand_name}` : 'Billing'} onClose={onClose}>
      {loading && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 11 }}>Loading from Stripe...</div>}
      {error && <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 8, fontSize: 11, color: C.red }}>{error}</div>}
      {detail && (
        <div style={{ display: 'grid', gap: 10 }}>
          {detail.billingError && (
            <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 8, fontSize: 11, color: C.red }}>
              {detail.billingError}
            </div>
          )}
          {detail.billing && (
            <>
              <Field label="State" value={detail.billing.state.replace(/_/g, ' ') + (detail.billing.cancelAtPeriodEnd ? ' (cancels at period end)' : '')} />
              <Field label="Plan" value={detail.billing.planNickname ?? `every ${intervalLabel(detail.billing)}`} />
              <Field label="Amount" value={`${money(detail.billing.amountCents, detail.billing.currency)} / ${intervalLabel(detail.billing)}`} />
              <Field label="Monthly (MRR)" value={money(detail.billing.mrrCents, detail.billing.currency)} />
              <Field label="Next Charge" value={detail.billing.currentPeriodEnd ? new Date(detail.billing.currentPeriodEnd).toLocaleString() : '—'} />
            </>
          )}
          <Field label="Stripe Customer" value={detail.stripe_customer_id ?? '(none)'} mono />
          <Field label="Stripe Subscription" value={detail.stripe_subscription_id ?? '(none)'} mono />

          {detail.invoices.length > 0 && (
            <div>
              <label className="wl-label">Recent Invoices</label>
              <table className="wl-table">
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Status</th><th>Reason</th><th></th></tr>
                </thead>
                <tbody>
                  {detail.invoices.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ fontSize: 10 }}>{new Date(inv.created).toLocaleDateString()}</td>
                      <td style={{ fontFamily: 'monospace' }}>{money(inv.amountCents, inv.currency)}</td>
                      <td style={{ fontSize: 10, color: inv.status === 'paid' ? C.green : inv.status === 'open' ? C.amber : C.muted }}>
                        {inv.status ?? '—'}
                      </td>
                      <td style={{ fontSize: 10, color: C.muted }}>{(inv.reason ?? '').replace(/_/g, ' ')}</td>
                      <td>
                        {inv.hostedUrl && (
                          <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontSize: 10 }}>view →</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  )
}




function SettingsSubTab() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [slug, setSlug] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [rowMsg, setRowMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async (keepId?: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tenants')
      if (!res.ok) throw new Error(await readError(res))
      const json = await res.json()
      const list: Tenant[] = json.tenants ?? []
      setTenants(list)
      const pick = (keepId && list.find(t => t.id === keepId)) || list[0] || null
      setSelected(pick)
      if (pick) { setSlug(pick.slug); setCustomDomain(pick.custom_domain ?? '') }
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'Failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pickTenant = (t: Tenant) => {
    setSelected(t); setSlug(t.slug); setCustomDomain(t.custom_domain ?? ''); setRowMsg(null)
  }

  const patch = async (body: Record<string, any>, okText: string) => {
    if (!selected) return
    setSaving(true); setRowMsg(null)
    try {
      const res = await fetch(`/api/admin/tenants/${selected.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await readError(res))
      setRowMsg({ kind: 'ok', text: okText })
      await load(selected.id)
    } catch (e: any) {
      setRowMsg({ kind: 'err', text: e?.message ?? 'Failed' })
    } finally {
      setSaving(false)
    }
  }

  if (loading && tenants.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 11 }}>Loading...</div>
  }
  if (error && tenants.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.red, fontSize: 11, background: C.surface, border: `1px solid ${C.border}` }}><strong>Error:</strong> {error}</div>
  }
  if (tenants.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 11, background: C.surface, border: `1px solid ${C.border}` }}>No tenants. Create one in the Tenants sub-tab first.</div>
  }

  const slugDirty = selected ? slug !== selected.slug : false
  const domainDirty = selected ? customDomain !== (selected.custom_domain ?? '') : false

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, minHeight: 400 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 6, overflowY: 'auto', maxHeight: 600 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: C.muted, padding: '4px 6px', borderBottom: `1px solid ${C.border}` }}>TENANTS</div>
        {tenants.map(t => (
          <div key={t.id} onClick={() => pickTenant(t)} style={{
            padding: 8, cursor: 'pointer',
            background: selected?.id === t.id ? C.blue : 'transparent',
            color: selected?.id === t.id ? 'white' : C.text,
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.status === 'active' ? C.green : C.amber }} />
            {t.brand_name}
          </div>
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
        {selected && (
          <div style={{ display: 'grid', gap: 16, maxWidth: 460 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold' }}>
              {selected.brand_name} — Settings
            </div>

            {rowMsg && (
              <div style={{
                fontSize: 11, padding: 8, borderRadius: 3,
                background: rowMsg.kind === 'ok' ? 'rgba(26,106,26,0.08)' : '#fff4f4',
                border: `1px solid ${rowMsg.kind === 'ok' ? C.green : '#c08080'}`,
                color: rowMsg.kind === 'ok' ? C.green : C.red,
              }}>{rowMsg.text}</div>
            )}

            {/* Status */}
            <div>
              <label className="wl-label" style={{ fontWeight: 'bold' }}>Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  padding: '2px 8px', fontSize: 10, fontWeight: 'bold', borderRadius: 2,
                  color: selected.status === 'active' ? C.green : selected.status === 'suspended' ? C.amber : C.red,
                  border: '1px solid currentColor',
                }}>{(selected.status || 'active').toUpperCase()}</span>
                {selected.status === 'active' ? (
                  <button className="wl-btn" disabled={saving} onClick={() => patch({ status: 'suspended' }, 'Tenant suspended')}>
                    Suspend
                  </button>
                ) : (
                  <button className="wl-btn primary" disabled={saving} onClick={() => patch({ status: 'active' }, 'Tenant activated')}>
                    Activate
                  </button>
                )}
                <span style={{ fontSize: 10, color: C.muted }}>
                  Suspended tenants stop resolving on their subdomain.
                </span>
              </div>
            </div>

            {/* Slug */}
            <div>
              <label className="wl-label" style={{ fontWeight: 'bold' }}>Subdomain Slug</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input className="wl-input" value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} style={{ fontFamily: 'monospace' }} />
                <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>.dialerseat.com</span>
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                Changing the slug breaks the old subdomain URL immediately. Validated server-side (1–40 chars, a–z 0–9 hyphens, not reserved).
              </div>
              <button className="wl-btn primary" style={{ marginTop: 8 }} disabled={saving || !slugDirty || !slug}
                onClick={() => patch({ slug }, `Slug changed to "${slug}"`)}>
                {saving ? 'Saving...' : 'Save Slug'}
              </button>
            </div>

            {/* Custom domain */}
            <div>
              <label className="wl-label" style={{ fontWeight: 'bold' }}>Custom Domain</label>
              <input className="wl-input" value={customDomain} onChange={e => setCustomDomain(e.target.value.trim())} placeholder="dialer.acme.com" style={{ fontFamily: 'monospace' }} />
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                Stored here for reference. DNS/SSL provisioning for custom domains is separate infrastructure and still on the backlog — setting this does not yet make the domain resolve.
              </div>
              <button className="wl-btn primary" style={{ marginTop: 8 }} disabled={saving || !domainDirty}
                onClick={() => patch({ custom_domain: customDomain || null }, customDomain ? `Custom domain set to ${customDomain}` : 'Custom domain cleared')}>
                {saving ? 'Saving...' : 'Save Domain'}
              </button>
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
              Feature flags and per-tenant rate limits will live here too — they need a new column/table, so they aren&apos;t wired yet. Branding lives in the Branding sub-tab; billing in Billing.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}




function ModalShell({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100000, padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: '#f5f9fd',
        border: '1px solid #3a6ea5',
        borderRadius: 6,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: 'linear-gradient(to bottom, #bfdcf5, #7baeda, #4f88c4)',
          padding: '6px 8px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #a4c3e5',
        }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', color: '#1c1c2c' }}>
            {title}
          </span>
          <div
            onClick={onClose}
            style={{
              width: 28, height: 18,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, color: '#1c1c2c',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e81123'
              e.currentTarget.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#1c1c2c'
            }}
          >×</div>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: boolean }) {
  return (
    <div>
      <label className="wl-label">{label}</label>
      {link ? (
        <a
          href={value} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: C.blue, textDecoration: 'underline', fontFamily: mono ? 'monospace' : 'inherit' }}
        >
          {value}
        </a>
      ) : (
        <div style={{
          padding: '4px 8px',
          background: 'white',
          border: `1px solid ${C.border}`,
          fontSize: 11,
          color: C.text,
          fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-all',
        }}>
          {value}
        </div>
      )}
    </div>
  )
}