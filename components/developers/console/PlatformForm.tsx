'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, useToast } from '../ui'

export function PlatformForm({ name, website }: { name: string; website: string | null }) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [n, setN] = useState(name)
  const [w, setW] = useState(website || '')
  const [busy, setBusy] = useState(false)
  const dirty = n !== name || w !== (website || '')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try { await api('/api/developers/platform', { method: 'PATCH', body: { name: n, website: w } }); toast('Saved'); router.refresh() }
    catch (err) { toast(err instanceof Error ? err.message : 'Could not save.') }
    finally { setBusy(false) }
  }

  return (
    <form className="dv-card" id="platform" onSubmit={save}>
      <div className="dv-card-head"><h2 className="dv-card-title">Platform</h2><p className="dv-card-desc">How your platform appears in the console and on invoices.</p></div>
      <div className="dv-card-body dv-grid-2">
        <div><label className="dv-label" htmlFor="sname">Name</label><input id="sname" className="dv-input" value={n} onChange={e => setN(e.target.value)} maxLength={80} required /></div>
        <div><label className="dv-label" htmlFor="sweb">Website</label><input id="sweb" className="dv-input" value={w} onChange={e => setW(e.target.value)} placeholder="https://" maxLength={200} /></div>
      </div>
      <div className="dv-card-foot">
        <span>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button type="submit" className="dv-btn dv-btn-primary dv-btn-sm" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {toastNode}
    </form>
  )
}
