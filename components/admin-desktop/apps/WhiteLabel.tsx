'use client'
import { useEffect, useState, useCallback } from 'react'

// =============================================================================
// WHITE LABEL APP — admin desktop edition
// =============================================================================
// Internal sub-tab system:
//   - Tenants:    CRUD list of all white_label_tenants (live)
//   - Branding:   pick a tenant, edit name/logo/colors with live preview
//   - Demo View:  pick any team, open new tab as that team
//   - Billing:    coming soon
//   - Settings:   coming soon
//
// Endpoints used (some will return 404 until backend ships in next session):
//   GET    /api/admin/tenants
//   POST   /api/admin/tenants
//   PATCH  /api/admin/tenants/:id
//   DELETE /api/admin/tenants/:id
//   GET    /api/admin/teams
//   POST   /api/admin/impersonate
// =============================================================================

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
  { key: 'billing',   label: 'Billing',    status: 'coming-soon' },
  { key: 'demoview',  label: 'Demo View',  status: 'live' },
  { key: 'settings',  label: 'Settings',   status: 'coming-soon' },
]

interface Tenant {
  id: string
  slug: string
  brand_name: string
  owner_clerk_id: string
  status: 'active' | 'suspended' | 'cancelled'
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
  logo_url: string | null
  favicon_url: string | null
  footer_text: string | null
  support_email: string
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
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
      {activeSub === 'billing' && (
        <ComingSoon
          title="WL BILLING"
          description="Per-tenant Stripe subscription view, MRR per tenant, payment health, dunning recovery queue."
        />
      )}
      {activeSub === 'settings' && (
        <ComingSoon
          title="WL SETTINGS"
          description="Per-tenant feature flags, rate limits, custom landing templates."
        />
      )}
    </div>
  )
}

// =============================================================================
// TENANTS — CRUD list
// =============================================================================
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setTenants(Array.isArray(json) ? json : json.tenants ?? [])
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
          <strong>API not available yet:</strong> {error}<br />
          <span style={{ color: C.muted }}>
            Wire up <code>GET /api/admin/tenants</code> to return tenants from <code>white_label_tenants</code>.
          </span>
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
                  }}>{t.status.toUpperCase()}</span>
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
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `HTTP ${res.status}`)
      }
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
          <label className="wl-label">Owner Clerk ID <span style={{ color: C.muted }}>(user_...)</span></label>
          <input className="wl-input" value={ownerClerkId} onChange={(e) => setOwnerClerkId(e.target.value)} placeholder="user_..." style={{ fontFamily: 'monospace' }} />
        </div>
        <div>
          <label className="wl-label">Support Email</label>
          <input className="wl-input" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@acme.com" />
        </div>
        <div>
          <label className="wl-label">Primary Color</label>
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
          <button className="wl-btn primary" onClick={submit} disabled={submitting || !slug || !brandName || !ownerClerkId || !supportEmail}>
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

  const setStatus = async (status: Tenant['status']) => {
    setWorking('status')
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onUpdated()
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown'}`)
    } finally {
      setWorking(null)
    }
  }

  const remove = async () => {
    if (!confirm(`Delete tenant "${tenant.slug}"? This cannot be undone.`)) return
    setWorking('delete')
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onUpdated()
      onClose()
    } catch (e: any) {
      alert(`Failed: ${e?.message ?? 'unknown'}`)
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
        <Field label="Support Email" value={tenant.support_email} />
        <Field label="Stripe Subscription" value={tenant.stripe_subscription_id ?? '(none)'} mono />
        <Field label="Status" value={tenant.status} />
        <Field label="Subdomain URL" value={`https://${tenant.slug}.dialerseat.com`} link />

        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
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

// =============================================================================
// BRANDING — pick tenant, edit colors with live preview
// =============================================================================
function BrandingSubTab() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Tenant | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Tenant>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/tenants')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const list = Array.isArray(json) ? json : json.tenants ?? []
        setTenants(list)
        if (list.length > 0) {
          setSelected(list[0])
          setDraft(list[0])
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/tenants/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = await res.json()
      setSelected(updated.tenant ?? updated)
      setDraft(updated.tenant ?? updated)
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
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 260px', gap: 12, minHeight: 400 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 6, overflowY: 'auto', maxHeight: 600 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: C.muted, padding: '4px 6px', borderBottom: `1px solid ${C.border}` }}>
          TENANTS
        </div>
        {tenants.map(t => (
          <div
            key={t.id}
            onClick={() => { setSelected(t); setDraft(t) }}
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
        {selected && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="wl-label">Brand Name</label>
              <input className="wl-input" value={draft.brand_name ?? ''} onChange={(e) => setDraft({ ...draft, brand_name: e.target.value })} />
            </div>
            <div>
              <label className="wl-label">Logo URL</label>
              <input className="wl-input" value={draft.logo_url ?? ''} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value || null })} placeholder="https://..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ColorField label="Primary"    value={draft.primary_color ?? '#4a9eff'}    onChange={(v) => setDraft({ ...draft, primary_color: v })} />
              <ColorField label="Secondary"  value={draft.secondary_color ?? '#2a6eff'}  onChange={(v) => setDraft({ ...draft, secondary_color: v })} />
              <ColorField label="Accent"     value={draft.accent_color ?? '#1a1a2e'}     onChange={(v) => setDraft({ ...draft, accent_color: v })} />
              <ColorField label="Background" value={draft.background_color ?? '#0a0a14'} onChange={(v) => setDraft({ ...draft, background_color: v })} />
              <ColorField label="Text"       value={draft.text_color ?? '#ffffff'}       onChange={(v) => setDraft({ ...draft, text_color: v })} />
            </div>
            <div>
              <label className="wl-label">Footer Text</label>
              <input className="wl-input" value={draft.footer_text ?? ''} onChange={(e) => setDraft({ ...draft, footer_text: e.target.value })} placeholder="Hosted by DialerSeat" />
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="wl-btn primary" onClick={save} disabled={saving}>
                {saving ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: C.muted, marginBottom: 8 }}>LIVE PREVIEW</div>
        <BrandingPreview tenant={{ ...selected!, ...draft } as Tenant} />
      </div>
    </div>
  )
}

function BrandingPreview({ tenant }: { tenant: Tenant }) {
  return (
    <div style={{
      background: tenant.background_color, color: tenant.text_color,
      padding: 16, borderRadius: 4, border: '1px solid #ccc',
      minHeight: 280,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.brand_name} style={{ width: 24, height: 24, borderRadius: 4 }} />
        ) : (
          <div style={{
            width: 24, height: 24, borderRadius: 4,
            background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 11, fontWeight: 'bold',
          }}>
            {tenant.brand_name?.[0]?.toUpperCase() ?? 'D'}
          </div>
        )}
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 3, color: tenant.primary_color }}>
          {tenant.brand_name?.toUpperCase() ?? 'BRAND NAME'}
        </span>
      </div>
      <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 12, lineHeight: 1.5 }}>
        Welcome back. This is roughly how your dashboard will appear to your downstream customers.
      </div>
      <button style={{
        padding: '6px 12px', background: tenant.primary_color, color: 'white',
        border: 'none', borderRadius: 3,
        fontSize: 10, fontWeight: 'bold', letterSpacing: 2, cursor: 'default',
      }}>
        PRIMARY ACTION
      </button>
      <div style={{
        marginTop: 16, padding: '4px 0', borderTop: `1px solid ${tenant.accent_color}`,
        fontSize: 9, opacity: 0.6, letterSpacing: 1,
      }}>
        {tenant.footer_text || 'Hosted by DialerSeat'}
      </div>
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="wl-label">{label}</label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 30, height: 22, border: `1px solid ${C.borderStrong}`, padding: 0, cursor: 'pointer' }} />
        <input className="wl-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 10 }} />
      </div>
    </div>
  )
}

// =============================================================================
// DEMO VIEW — open new tab as a chosen team
// =============================================================================
function DemoViewSubTab() {
  const [teams, setTeams] = useState<TeamRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/teams')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        // /api/admin/teams returns { success, teams: [...] }
        setTeams(json.teams ?? (Array.isArray(json) ? json : []))
      } catch (e: any) {
        setError(e?.message ?? 'Failed')
        setTeams([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const startImpersonation = async (team: TeamRow) => {
    setStarting(team.id)
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: team.id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const url = data.redirect_url
        ?? (team.tenant_slug
            ? `https://${team.tenant_slug}.dialerseat.com/dashboard/analytics?impersonate=${team.id}`
            : `/dashboard/analytics?impersonate=${team.id}`)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      alert(`Failed to impersonate: ${e?.message ?? 'unknown'}`)
    } finally {
      setStarting(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 11 }}>Loading teams...</div>

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold' }}>Demo View / Team Impersonation</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          Open a new tab as a member of the selected team. The tenant&apos;s branding renders and a banner indicates impersonation.
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff4f4', border: '1px solid #c08080', padding: 12, fontSize: 11, color: C.red, marginBottom: 12 }}>
          <strong>API not available yet:</strong> {error}<br />
          <span style={{ color: C.muted }}>
            Wire up <code>GET /api/admin/teams</code> (already exists) and <code>POST /api/admin/impersonate</code>.
          </span>
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
                    onClick={() => startImpersonation(t)}
                    disabled={starting === t.id}
                    style={{ fontSize: 10, padding: '3px 10px' }}
                  >
                    {starting === t.id ? 'Opening...' : 'View As →'}
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

// =============================================================================
// SHARED
// =============================================================================
function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      padding: 60, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, opacity: 0.4, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.muted, maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
        {description}
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