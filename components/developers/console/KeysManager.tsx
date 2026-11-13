'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Info, KeyRound, Plus, TriangleAlert, X } from 'lucide-react'
import { API_BASE } from '@/lib/developers/catalog'
import { DevLink } from '../base'
import { CopyButton, api, useToast } from '../ui'

export interface KeyView {
  id: string
  kind: 'secret' | 'publishable'
  env: 'test' | 'live'
  name: string
  prefix: string
  last4: string
  token: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null)

export function KeysManager({ keys, liveActive, initialEnv = 'test' }: { keys: KeyView[]; liveActive: boolean; initialEnv?: 'test' | 'live' }) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [env, setEnv] = useState<'test' | 'live'>(initialEnv)
  const [creating, setCreating] = useState<null | 'secret' | 'publishable'>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<{ key: string; kind: string } | null>(null)
  const [showPk, setShowPk] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<KeyView | null>(null)

  const inEnv = keys.filter(k => k.env === env)
  const active = inEnv.filter(k => !k.revoked_at)
  const revoked = inEnv.filter(k => k.revoked_at)
  const pk = active.find(k => k.kind === 'publishable')
  const sk = active.find(k => k.kind === 'secret')

  const create = async () => {
    if (!creating) return
    setBusy(true)
    try {
      const r = await api<{ key: string }>('/api/developers/keys', { method: 'POST', body: { kind: creating, env, name } })
      setRevealed({ key: r.key, kind: creating })
      setCreating(null); setName('')
      router.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not create the key.') }
    finally { setBusy(false) }
  }

  const revoke = async (k: KeyView) => {
    setBusy(true)
    try {
      await api(`/api/developers/keys/${k.id}`, { method: 'DELETE' })
      toast(`${k.name} revoked`)
      setConfirmRevoke(null)
      router.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not revoke the key.') }
    finally { setBusy(false) }
  }

  const envFile = [
    `DIALERSEAT_API_URL=${API_BASE}`,
    `DIALERSEAT_PUBLISHABLE_KEY=${pk?.token || `pk_${env}_…`}`,
    `# DIALERSEAT_SECRET_KEY=${sk ? `${sk.prefix}••••${sk.last4}` : `sk_${env}_…`}`,
  ].join('\n')

  return (
    <div className="dv-keys" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 28, alignItems: 'start' }}>
      <div className="dv-stack">
        <div className="dv-seg" id="env" role="tablist" aria-label="Environment">
          <button type="button" aria-pressed={env === 'test'} onClick={() => setEnv('test')}>Test keys</button>
          <button type="button" aria-pressed={env === 'live'} onClick={() => setEnv('live')}>Live keys</button>
        </div>

        {env === 'live' && !liveActive && (
          <div className="dv-alert dv-alert-amber">
            <TriangleAlert size={16} color="var(--dv-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Live keys work for every read and setting, but anything that would place a call returns <code className="dv-inline-code">402 live_dialing_inactive</code> until <DevLink href="/console/billing#live" className="dv-link">live dialing is active</DevLink>.</span>
          </div>
        )}

        {/* Quick copy, after the Clerk layout */}
        <div className="dv-card" data-theme="dark" style={{ background: '#05050a' }}>
          <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <h2 className="dv-card-title">Quick copy</h2>
              <p className="dv-card-desc">Paste into your server&apos;s environment file. The secret key is commented out because only its last four characters are stored. Paste the full key you saved.</p>
            </div>
          </div>
          <div className="dv-card-body">
            <div className="dv-code">
              <div className="dv-code-head"><span>.env</span><CopyButton text={envFile} /></div>
              <pre><code>{envFile.split('\n').map((l, i) => <div key={i}><span className="dv-dim" style={{ userSelect: 'none', display: 'inline-block', width: 22 }}>{i + 1}</span><span className={l.startsWith('#') ? 'tok-c' : ''}>{l}</span></div>)}</code></pre>
            </div>
          </div>
        </div>

        {/* Publishable */}
        <div className="dv-card" id="publishable">
          <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 className="dv-card-title">Publishable key</h2>
              <p className="dv-card-desc">Used by the miniplayer loader in the browser. Safe to share. It only works from origins you allow under Miniplayer.</p>
            </div>
            {!pk && <button type="button" className="dv-btn dv-btn-sm" onClick={() => setCreating('publishable')}><Plus size={14} /> Add key</button>}
          </div>
          <div className="dv-card-body">
            {pk ? (
              <div className="dv-inset" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14 }}>{pk.name}</div>
                  <div className="dv-dim" style={{ fontSize: 12 }}>{pk.last_used_at ? `Last used ${fmt(pk.last_used_at)}` : 'Never used'}</div>
                </div>
                <code className="dv-inline-code" style={{ fontSize: 12.5 }}>{showPk ? pk.token : `${pk.prefix}${'•'.repeat(6)}${pk.last4}`}</code>
                <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={() => setShowPk(s => !s)} aria-label={showPk ? 'Hide key' : 'Show key'}>{showPk ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                <CopyButton text={pk.token || ''} />
                <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm dv-btn-danger" onClick={() => setConfirmRevoke(pk)}>Revoke</button>
              </div>
            ) : <div className="dv-empty">No active {env} publishable key.</div>}
          </div>
        </div>

        {/* Secret */}
        <div className="dv-card" id="secret">
          <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 className="dv-card-title">Secret keys</h2>
              <p className="dv-card-desc">Full access to your platform through the API: seats, campaigns, leads, dispositions, calls. Keep them on your server. Each is shown once, when it is created.</p>
            </div>
            <button type="button" id="create" className="dv-btn dv-btn-sm dv-link" onClick={() => setCreating('secret')} style={{ color: 'var(--dv-accent)' }}><Plus size={14} /> Add new key</button>
          </div>
          <div className="dv-card-body">
            {active.filter(k => k.kind === 'secret').length === 0 ? <div className="dv-empty">No active {env} secret keys.</div> : (
              <div className="dv-table-wrap">
                <table className="dv-table">
                  <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th></th></tr></thead>
                  <tbody>
                    {active.filter(k => k.kind === 'secret').map(k => (
                      <tr key={k.id}>
                        <td>{k.name}</td>
                        <td><code className="dv-inline-code">{k.prefix}••••{k.last4}</code></td>
                        <td className="dv-dim">{fmt(k.created_at)}</td>
                        <td className="dv-dim">{fmt(k.last_used_at) || 'Never'}</td>
                        <td style={{ textAlign: 'right' }}><button type="button" className="dv-btn dv-btn-ghost dv-btn-sm dv-btn-danger" onClick={() => setConfirmRevoke(k)}>Revoke</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {revoked.length > 0 && (
            <details className="dv-card-foot" style={{ display: 'block' }}>
              <summary style={{ cursor: 'pointer' }}>{revoked.length} revoked key{revoked.length > 1 ? 's' : ''}</summary>
              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {revoked.map(k => <div key={k.id} className="dv-row" style={{ fontSize: 12.5 }}><code className="dv-inline-code" style={{ opacity: .6 }}>{k.prefix}••••{k.last4}</code><span>{k.name}</span><span className="dv-dim">revoked {fmt(k.revoked_at)}</span></div>)}
              </div>
            </details>
          )}
        </div>
      </div>

      <aside className="dv-stack" style={{ fontSize: 13 }}>
        {[
          ['API base URL', API_BASE],
          ['Auth header', 'Authorization: Bearer sk_…'],
          ['Webhook signature header', 'DialerSeat-Signature'],
        ].map(([label, value]) => (
          <div key={label} style={{ paddingBottom: 14, borderBottom: '1px solid var(--dv-border-soft)' }}>
            <div className="dv-dim" style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><code style={{ fontSize: 12.5, flex: 1, overflowWrap: 'anywhere' }}>{value}</code><CopyButton text={value} /></div>
          </div>
        ))}
        <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--dv-border-soft)' }}>
          <div className="dv-dim" style={{ fontSize: 12, marginBottom: 6 }}>API version</div>
          <code style={{ fontSize: 12.5 }}>v1</code>
        </div>
        <DevLink href="/docs/authentication" className="dv-muted" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', padding: '8px 0' }}><Info size={14} /> Learn about API keys</DevLink>
      </aside>

      {creating && (
        <Modal onClose={() => setCreating(null)} title={`New ${env} ${creating} key`}>
          <label className="dv-label" htmlFor="kname">Name</label>
          <input id="kname" className="dv-input" value={name} onChange={e => setName(e.target.value)} placeholder={creating === 'secret' ? 'Production server' : 'Web app'} autoFocus maxLength={60}
            onKeyDown={e => { if (e.key === 'Enter') create() }} />
          <p className="dv-help">A name helps you tell keys apart when it is time to rotate one.</p>
          <div className="dv-row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setCreating(null)}>Cancel</button>
            <button type="button" className="dv-btn dv-btn-primary" onClick={create} disabled={busy}><KeyRound size={14} /> {busy ? 'Creating…' : 'Create key'}</button>
          </div>
        </Modal>
      )}

      {revealed && (
        <Modal onClose={() => setRevealed(null)} title="Copy your new key">
          {revealed.kind === 'secret' && (
            <div className="dv-alert dv-alert-amber" style={{ marginBottom: 14 }}>
              <TriangleAlert size={16} color="var(--dv-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>This is the only time the full secret key is shown. Copy it to your server&apos;s environment now.</span>
            </div>
          )}
          <div className="dv-inset" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 8px 8px 12px' }}>
            <code style={{ flex: 1, fontSize: 13, overflowWrap: 'anywhere' }}>{revealed.key}</code>
            <CopyButton text={revealed.key} label="Copy" />
          </div>
          <div className="dv-row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="dv-btn dv-btn-primary" onClick={() => setRevealed(null)}>Done</button>
          </div>
        </Modal>
      )}

      {confirmRevoke && (
        <Modal onClose={() => setConfirmRevoke(null)} title={`Revoke ${confirmRevoke.name}?`}>
          <p className="dv-muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            <code className="dv-inline-code">{confirmRevoke.prefix}••••{confirmRevoke.last4}</code> stops working immediately. Anything still using it gets <code className="dv-inline-code">401</code>. This cannot be undone.
          </p>
          <div className="dv-row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setConfirmRevoke(null)}>Cancel</button>
            <button type="button" className="dv-btn dv-btn-danger" onClick={() => revoke(confirmRevoke)} disabled={busy}>{busy ? 'Revoking…' : 'Revoke key'}</button>
          </div>
        </Modal>
      )}
      {toastNode}
      <style>{`@media (max-width: 1000px) { .dv-keys { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(3,3,8,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onMouseDown={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') onClose() }} className="dv-card" style={{ width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <div className="dv-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h3>
          <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
