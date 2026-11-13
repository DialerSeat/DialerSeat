'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import { OUTCOME_CLASSES } from '@/lib/developers/catalog'
import { api, useToast } from '../ui'

interface Row { id: string; code: string; label: string; outcome: string; sort: number }

// Offered as a starting point the developer chooses to add, then edits. Never
// added on their behalf.
const STARTER: Omit<Row, 'id' | 'sort'>[] = [
  { code: 'APPT_SET', label: 'Appointment set', outcome: 'conversion' },
  { code: 'CALLBACK', label: 'Call back', outcome: 'callback' },
  { code: 'NOT_INTERESTED', label: 'Not interested', outcome: 'not_interested' },
  { code: 'LEFT_VM', label: 'Left voicemail', outcome: 'voicemail' },
  { code: 'NO_ANSWER', label: 'No answer', outcome: 'no_answer' },
  { code: 'WRONG_NUMBER', label: 'Wrong number', outcome: 'bad_number' },
  { code: 'DNC', label: 'Do not call', outcome: 'dnc' },
]

const outcomeLabel = (id: string) => OUTCOME_CLASSES.find(o => o.id === id)?.label || id

export function DispositionsManager({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [outcome, setOutcome] = useState('contact')
  const [busy, setBusy] = useState(false)

  const add = async (r: Omit<Row, 'id' | 'sort'>, quiet = false) => {
    await api('/api/developers/dispositions', { method: 'POST', body: r })
    if (!quiet) toast(`${r.label} saved`)
  }

  const submit = async () => {
    setBusy(true)
    try { await add({ code, label, outcome }); setCode(''); setLabel(''); router.refresh() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  const addStarter = async () => {
    setBusy(true)
    try {
      for (const s of STARTER) if (!rows.some(r => r.code === s.code)) await add(s, true)
      toast('Starter set added. Rename or remove any of them.')
      router.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not add.') }
    finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try { await api(`/api/developers/dispositions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); router.refresh() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not remove.') }
    finally { setBusy(false) }
  }

  return (
    <div className="dv-stack">
      <div className="dv-card" id="add">
        <div className="dv-card-head"><h2 className="dv-card-title">Add a disposition</h2><p className="dv-card-desc">Saving a code that already exists updates it. You can also manage these through <code className="dv-inline-code">POST /v1/dispositions</code>.</p></div>
        <div className="dv-card-body">
          <div className="dv-disp-form" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr) 200px auto', gap: 8, alignItems: 'end' }}>
            <div><label className="dv-label">Your code</label><input className="dv-input dv-mono" value={code} onChange={e => setCode(e.target.value.replace(/\s+/g, '_'))} placeholder="APPT_SET" maxLength={60} /></div>
            <div><label className="dv-label">Label agents see</label><input className="dv-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="Appointment set" maxLength={80} /></div>
            <div><label className="dv-label">Outcome class</label>
              <select className="dv-select" value={outcome} onChange={e => setOutcome(e.target.value)}>{OUTCOME_CLASSES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
            <button type="button" className="dv-btn dv-btn-primary" onClick={submit} disabled={busy || !code.trim() || !label.trim()}><Plus size={14} /> Save</button>
          </div>
          <p className="dv-help">Outcome class <strong>Do not call</strong> adds the number to your platform&apos;s do-not-call list when an agent picks it.</p>
        </div>
      </div>

      <div className="dv-card">
        <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="dv-card-title">Your dispositions</h2>
          {rows.length === 0 && <button type="button" className="dv-btn dv-btn-sm" onClick={addStarter} disabled={busy}><Wand2 size={14} /> Start from a common set</button>}
        </div>
        <div className="dv-card-body">
          {rows.length === 0 ? <div className="dv-empty">None yet. Until you add some, agents see DialerSeat&apos;s standard list.</div> : (
            <div className="dv-table-wrap"><table className="dv-table">
              <thead><tr><th>Code</th><th>Label</th><th>Outcome class</th><th></th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td><code className="dv-inline-code">{r.code}</code></td>
                    <td>{r.label}</td>
                    <td><span className={`dv-badge ${r.outcome === 'conversion' ? 'dv-badge-green' : r.outcome === 'dnc' ? 'dv-badge-red' : ''}`}>{outcomeLabel(r.outcome)}</span></td>
                    <td style={{ textAlign: 'right' }}><button type="button" className="dv-btn dv-btn-ghost dv-btn-sm dv-btn-danger" aria-label={`Remove ${r.code}`} onClick={() => remove(r.id)} disabled={busy}><Trash2 size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
      {toastNode}
      <style>{`@media (max-width: 900px) { .dv-disp-form { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }`}</style>
    </div>
  )
}
