'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { DIAL_MODES, type DialMode } from '@/lib/developers/catalog'
import type { DialModeException } from '@/lib/developers/store'
import { api, useToast } from '../ui'

interface Policy { default_dial_mode: DialMode; allowed_dial_modes: DialMode[]; seats_may_choose_mode: boolean }

export function DialModePolicy({ policy, exceptions }: { policy: Policy; exceptions: DialModeException[] }) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [p, setP] = useState(policy)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(p) !== JSON.stringify(policy)

  const [scope, setScope] = useState<'seat' | 'campaign'>('seat')
  const [ext, setExt] = useState('')
  const [mode, setMode] = useState<DialMode>('predictive')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const toggleAllowed = (m: DialMode) => {
    setP(cur => {
      const has = cur.allowed_dial_modes.includes(m)
      const allowed = has ? cur.allowed_dial_modes.filter(x => x !== m) : DIAL_MODES.map(d => d.id).filter(x => x === m || cur.allowed_dial_modes.includes(x))
      const def = allowed.includes(cur.default_dial_mode) ? cur.default_dial_mode : (allowed[0] || cur.default_dial_mode)
      return { ...cur, allowed_dial_modes: allowed, default_dial_mode: def }
    })
  }

  const save = async () => {
    setSaving(true)
    try { await api('/api/developers/platform', { method: 'PATCH', body: p }); toast('Dial-mode policy saved'); router.refresh() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save.') }
    finally { setSaving(false) }
  }

  const addException = async () => {
    setBusy(true)
    try {
      await api('/api/developers/exceptions', { method: 'POST', body: { scope, external_id: ext, dial_mode: mode, allowed_modes: [mode], note } })
      setExt(''); setNote(''); toast('Exception saved'); router.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  const removeException = async (id: string) => {
    setBusy(true)
    try { await api(`/api/developers/exceptions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); router.refresh() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not remove.') }
    finally { setBusy(false) }
  }

  return (
    <div className="dv-stack">
      <div className="dv-card" id="allowed">
        <div className="dv-card-head"><h2 className="dv-card-title">Platform policy</h2><p className="dv-card-desc">Applies to every seat and campaign on your platform unless an exception below says otherwise.</p></div>
        <div className="dv-card-body">
          <div className="dv-grid-2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {DIAL_MODES.map(m => {
              const on = p.allowed_dial_modes.includes(m.id)
              const isDefault = p.default_dial_mode === m.id
              return (
                <div key={m.id} className="dv-inset" style={{ padding: 14, borderColor: isDefault ? 'rgba(74,158,255,.5)' : undefined, opacity: on ? 1 : .55 }}>
                  <div className="dv-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{m.name}</span>
                    <button type="button" className="dv-switch" role="switch" aria-checked={on} aria-label={`Allow ${m.name}`} onClick={() => toggleAllowed(m.id)} />
                  </div>
                  <p className="dv-muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: '8px 0 12px', minHeight: 38 }}>{m.summary}</p>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, cursor: on ? 'pointer' : 'not-allowed' }} id={isDefault ? 'default' : undefined}>
                    <input type="radio" name="default" disabled={!on} checked={isDefault} onChange={() => setP(cur => ({ ...cur, default_dial_mode: m.id }))} style={{ accentColor: '#4a9eff' }} />
                    Default
                  </label>
                </div>
              )
            })}
          </div>
          <div className="dv-inset dv-row" style={{ marginTop: 14, padding: '12px 14px', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14 }}>Seats may choose their mode</div>
              <div className="dv-dim" style={{ fontSize: 12.5, marginTop: 2 }}>On: an agent can switch between the allowed modes in the miniplayer. Off: every seat dials in the default mode.</div>
            </div>
            <button type="button" className="dv-switch" role="switch" aria-checked={p.seats_may_choose_mode} aria-label="Seats may choose their mode" onClick={() => setP(cur => ({ ...cur, seats_may_choose_mode: !cur.seats_may_choose_mode }))} />
          </div>
        </div>
        <div className="dv-card-foot">
          <span>{dirty ? 'Unsaved changes' : 'Saved'}</span>
          <div className="dv-row">
            {dirty && <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={() => setP(policy)}>Discard</button>}
            <button type="button" className="dv-btn dv-btn-primary dv-btn-sm" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save policy'}</button>
          </div>
        </div>
      </div>

      <div className="dv-card" id="exceptions">
        <div className="dv-card-head"><h2 className="dv-card-title">Exceptions and upgrades</h2><p className="dv-card-desc">Override the policy for one seat or one campaign, by the id you use on your platform. An exception can allow a mode the platform policy turns off.</p></div>
        <div className="dv-card-body">
          <div className="dv-exc-form" style={{ display: 'grid', gridTemplateColumns: '150px minmax(0, 1fr) 170px minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
            <div><label className="dv-label">Applies to</label>
              <select className="dv-select" value={scope} onChange={e => setScope(e.target.value as 'seat' | 'campaign')}><option value="seat">A seat</option><option value="campaign">A campaign</option></select></div>
            <div><label className="dv-label">{scope === 'seat' ? 'Your user id' : 'Your campaign id'}</label>
              <input className="dv-input" value={ext} onChange={e => setExt(e.target.value)} placeholder={scope === 'seat' ? 'usr_829' : 'crm_campaign_77'} /></div>
            <div><label className="dv-label">Dial mode</label>
              <select className="dv-select" value={mode} onChange={e => setMode(e.target.value as DialMode)}>{DIAL_MODES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div><label className="dv-label">Note <span className="dv-dim">(optional)</span></label>
              <input className="dv-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Enterprise team upgrade" maxLength={200} /></div>
            <button type="button" className="dv-btn" onClick={addException} disabled={busy || !ext.trim()}><Plus size={14} /> Add</button>
          </div>
          <div style={{ marginTop: 18 }}>
            {exceptions.length === 0 ? <div className="dv-empty">No exceptions. Every seat and campaign follows the platform policy.</div> : (
              <div className="dv-table-wrap"><table className="dv-table">
                <thead><tr><th>Applies to</th><th>Id</th><th>Mode</th><th>Note</th><th></th></tr></thead>
                <tbody>
                  {exceptions.map(x => (
                    <tr key={x.id}>
                      <td style={{ textTransform: 'capitalize' }}>{x.scope}</td>
                      <td><code className="dv-inline-code">{x.external_id}</code></td>
                      <td><span className="dv-badge dv-badge-blue" style={{ textTransform: 'capitalize' }}>{x.dial_mode || (x.allowed_modes || []).join(', ')}</span></td>
                      <td className="dv-muted">{x.note || '—'}</td>
                      <td style={{ textAlign: 'right' }}><button type="button" className="dv-btn dv-btn-ghost dv-btn-sm dv-btn-danger" onClick={() => removeException(x.id)} disabled={busy} aria-label="Remove exception"><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </div>
      </div>
      {toastNode}
      <style>{`@media (max-width: 1000px) { .dv-exc-form { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } #allowed .dv-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (max-width: 560px) { .dv-exc-form, #allowed .dv-grid-2 { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  )
}
