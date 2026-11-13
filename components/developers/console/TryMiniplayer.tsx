'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import { useDevBase } from '../base'
import { api } from '../ui'
import { useDevTheme } from '../theme'

// Sample leads covering every test outcome (see TEST_NUMBERS): placeholders,
// not people. 555-01xx numbers are reserved for fiction.
const SAMPLE_LEADS = [
  { external_id: 'lead_1', first_name: 'Answers', last_name: 'Human', phone: '+15125550101', city: 'Austin', state: 'TX' },
  { external_id: 'lead_2', first_name: 'Reaches', last_name: 'Voicemail', phone: '+15125550107', city: 'Dallas', state: 'TX' },
  { external_id: 'lead_3', first_name: 'Rings', last_name: 'Out', phone: '+15125550108', city: 'Houston', state: 'TX' },
  { external_id: 'lead_4', first_name: 'Line', last_name: 'Busy', phone: '+15125550109', city: 'El Paso', state: 'TX' },
  { external_id: 'lead_5', first_name: 'Bad', last_name: 'Number', phone: '555', city: '—', state: '—' },
]

interface Mounted { destroy(): void; on(type: string, fn: (p: unknown, t: string) => void): Mounted }
declare global { interface Window { DialerSeat?: { mount(el: Element, opts: Record<string, unknown>): Mounted } } }

export function TryMiniplayer() {
  const base = useDevBase()
  const theme = useDevTheme()
  const host = useRef<HTMLDivElement>(null)
  const mounted = useRef<Mounted | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<{ t: string; type: string; payload: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => mounted.current?.destroy(), [])

  const loadLoader = () => new Promise<void>((resolve, reject) => {
    if (window.DialerSeat) return resolve()
    const s = document.createElement('script')
    s.src = `${base}/embed/v1.js`
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('The loader script did not load.'))
    document.head.appendChild(s)
  })

  const start = async () => {
    setBusy(true); setError(null); setLog([])
    try {
      mounted.current?.destroy()
      mounted.current = null
      const { session, publishable_key } = await api<{ session: string; publishable_key: string | null }>('/api/developers/test-session', { method: 'POST' })
      await loadLoader()
      const d = window.DialerSeat!.mount(host.current!, { session, publishableKey: publishable_key, leads: SAMPLE_LEADS, campaign: 'console_try_it', theme })
      d.on('*', (payload, type) => setLog(l => [{ t: new Date().toLocaleTimeString(), type, payload: JSON.stringify(payload) }, ...l].slice(0, 40)))
      mounted.current = d
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the miniplayer.')
    } finally { setBusy(false) }
  }

  return (
    <div className="dv-card" id="try">
      <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="dv-card-title">Try it</h2>
          <p className="dv-card-desc">The real loader and the real frame, signed in with a test session and five sample leads, one for each test outcome. Every step sends your webhooks, and the browser events your page would get appear on the right.</p>
        </div>
        <button type="button" className="dv-btn dv-btn-primary" onClick={start} disabled={busy}>
          {open ? <><RotateCcw size={15} /> Restart</> : <><Play size={15} /> Open a test miniplayer</>}
        </button>
      </div>
      <div className="dv-card-body dv-try" style={{ display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr)', gap: 16 }}>
        <div style={{ position: 'relative', height: 640, borderRadius: 16, border: open ? 'none' : '1px dashed var(--dv-border)' }}>
          {!open && <span className="dv-dim" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{busy ? 'Opening…' : 'Your dialer appears here'}</span>}
          {/* The loader owns this node; React never renders into it. */}
          <div ref={host} style={{ height: '100%' }} />
        </div>
        <div className="dv-inset" style={{ height: 640, overflow: 'auto', padding: 12 }}>
          <div className="dv-dim" style={{ fontSize: 11, letterSpacing: .5, marginBottom: 8 }}>EVENTS YOUR PAGE RECEIVES · dialer.on(…)</div>
          {error && <div className="dv-alert dv-alert-amber" style={{ fontSize: 12.5 }}>{error}</div>}
          {log.length === 0 && !error && <div className="dv-dim" style={{ fontSize: 12.5 }}>Nothing yet.</div>}
          {log.map((e, i) => (
            <div key={i} style={{ fontFamily: 'var(--dv-mono)', fontSize: 11.5, padding: '6px 0', borderBottom: '1px solid var(--dv-border-soft)', overflowWrap: 'anywhere' }}>
              <span className="dv-dim">{e.t}</span> <span style={{ color: 'var(--dv-accent)' }}>{e.type}</span> <span className="dv-muted">{e.payload}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .dv-try { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  )
}
