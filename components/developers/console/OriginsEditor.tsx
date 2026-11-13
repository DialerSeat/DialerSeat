'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Plus, X } from 'lucide-react'
import { api, useToast } from '../ui'

export function OriginsEditor({ initial }: { initial: string[] }) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [origins, setOrigins] = useState(initial)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (next: string[]) => {
    setBusy(true)
    try {
      const r = await api<{ platform: { allowed_origins: string[] } }>('/api/developers/platform', { method: 'PATCH', body: { allowed_origins: next } })
      setOrigins(r.platform.allowed_origins)
      toast('Allowed origins saved')
      router.refresh()
      return true
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save.'); return false }
    finally { setBusy(false) }
  }

  const add = async () => {
    if (!draft.trim()) return
    if (await save([...origins, draft.trim()])) setDraft('')
  }

  return (
    <div className="dv-card" id="origins">
      <div className="dv-card-head">
        <h2 className="dv-card-title">Allowed origins</h2>
        <p className="dv-card-desc">The miniplayer loads only inside these. Add every address your app runs on, staging included. The scheme and port count: <code className="dv-inline-code">https://app.acme.com</code> is not <code className="dv-inline-code">https://acme.com</code>.</p>
      </div>
      <div className="dv-card-body">
        <div style={{ display: 'grid', gap: 8 }}>
          {origins.length === 0 && <div className="dv-dim" style={{ fontSize: 13 }}>None yet. Until you add one, the miniplayer refuses to load anywhere.</div>}
          {origins.map(o => (
            <div key={o} className="dv-inset dv-row" style={{ padding: '8px 8px 8px 12px' }}>
              <Globe size={14} color="var(--dv-muted)" />
              <code style={{ flex: 1, fontSize: 13 }}>{o}</code>
              <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" aria-label={`Remove ${o}`} disabled={busy} onClick={() => save(origins.filter(x => x !== o))}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="dv-row" style={{ marginTop: 12 }}>
          <input className="dv-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="app.yourcrm.com" aria-label="New origin"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
          <button type="button" className="dv-btn" onClick={add} disabled={busy || !draft.trim()}><Plus size={14} /> Add</button>
        </div>
      </div>
      {toastNode}
    </div>
  )
}
