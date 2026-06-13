'use client'
import { useEffect, useState, useCallback } from 'react'

// =============================================================================
// WHITE LABEL APP — admin desktop edition (v2)
// =============================================================================
// v2 changes vs v1:
// - REAL SCHEMA: Tenant interface now matches white_label_tenants as it
//   actually exists. The theme system is FOUR tokens — primary_color,
//   sidebar_color, header_bg_color, page_bg_color. v1 edited
//   secondary/background/text colors, which are dead legacy columns the
//   tenant dashboard never reads. accent_color is the legacy alias of
//   sidebar_color and is mirrored SERVER-SIDE on every write — never edited
//   directly here.
// - BRANDING TAB: edits brand_name, logo_url, favicon_url, support_email,
//   footer_text + the 4 real tokens. Live preview is now shaped like the
//   actual tenant dashboard (sidebar strip / header bar / page area /
//   primary-colored action) so what you see is what tenants get.
// - BACKEND IS LIVE: GET/POST /api/admin/tenants, PATCH/DELETE
//   /api/admin/tenants/:id, POST /api/admin/impersonate all exist now. All
//   endpoints return { success, ... } — error banners show the server's
//   error field instead of "API not available yet".
// - DELETE: server refuses (409) while teams still reference the tenant; the
//   detail modal surfaces that message.
// - DEMO VIEW: honest scope. The button resolves the team's tenant and opens
//   its site in a new tab. It is NOT sign-in-as-user impersonation (that
//   needs Clerk actor tokens — separate push), and branded subdomain
//   rendering depends on the wildcard-subdomain infra still on the backlog.
//
// Sub-tabs: Tenants (live) / Branding (live) / Billing (soon) /
//           Demo View (live) / Settings (soon)
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

// Matches white_label_tenants as it exists in the DB (real columns only;
// dead legacy color columns intentionally omitted).
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
      // 409 = teams still attached; server message says which/how many
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

// =============================================================================
// BRANDING — edit the REAL 4-token theme + brand assets, dashboard-shaped
// live preview. accent_color mirroring happens server-side.
// =============================================================================
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
        {draft && <DashboardPreview draft={draft} />}
      </div>
    </div>
  )
}

// Mini mock of the actual tenant dashboard: sidebar / header / page / primary.
function DashboardPreview({ draft }: { draft: BrandingDraft }) {
  return (
    <div style={{
      borderRadius: 4, border: '1px solid #ccc', overflow: 'hidden',
      display: 'grid', gridTemplateColumns: '64px 1fr', minHeight: 300,
    }}>
      {/* sidebar */}
      <div style={{ background: draft.sidebar_color, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {draft.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.logo_url} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: 'contain', margin: '0 auto' }} />
        ) : (
          <div style={{
            width: 26, height: 26, borderRadius: 4, margin: '0 auto',
            background: draft.primary_color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 12, fontWeight: 'bold',
          }}>
            {draft.brand_name?.[0]?.toUpperCase() ?? 'D'}
          </div>
        )}
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            height: 6, borderRadius: 3, margin: '0 4px',
            background: i === 0 ? draft.primary_color : 'rgba(255,255,255,0.22)',
          }} />
        ))}
      </div>

      {/* header + page */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: draft.header_bg_color, padding: '8px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 9, fontWeight: 'bold', letterSpacing: 2, color: 'white' }}>
            {(draft.brand_name || 'BRAND NAME').toUpperCase()}
          </span>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,255,255,0.35)' }} />
        </div>
        <div style={{ flex: 1, background: draft.page_bg_color, padding: 10 }}>
          <div style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 4, padding: 8, marginBottom: 8,
          }}>
            <div style={{ height: 5, width: '55%', borderRadius: 3, background: 'rgba(255,255,255,0.4)', marginBottom: 6 }} />
            <div style={{ height: 5, width: '80%', borderRadius: 3, background: 'rgba(255,255,255,0.18)' }} />
          </div>
          <button style={{
            padding: '5px 12px', background: draft.primary_color, color: 'white',
            border: 'none', borderRadius: 3,
            fontSize: 9, fontWeight: 'bold', letterSpacing: 2, cursor: 'default',
          }}>
            PRIMARY ACTION
          </button>
          <div style={{ marginTop: 10, fontSize: 9, color: draft.primary_color, textDecoration: 'underline' }}>
            primary link
          </div>
          <div style={{
            marginTop: 14, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.15)',
            fontSize: 8, color: 'rgba(255,255,255,0.55)', letterSpacing: 1,
          }}>
            {draft.footer_text || 'Hosted by DialerSeat'}
          </div>
        </div>
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

// =============================================================================
// DEMO VIEW — resolve a team's tenant and open its site in a new tab
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