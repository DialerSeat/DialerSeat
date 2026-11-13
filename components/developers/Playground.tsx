'use client'

// =============================================================================
// THE PLAYGROUND — a test CRM page, built on the public API
// =============================================================================
// Everything a platform's own app does, done here in the open: check a key,
// create a seat, mint a session, mount the miniplayer with a lead list, and
// watch the API requests and the browser events go by. Test keys only; the
// key lives in this page's memory and is never stored.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, KeyRound, Play, Plus, RotateCcw, Trash2, Wand2 } from 'lucide-react'
import { DevLink, useDevBase } from './base'
import { CodeBlock, MethodPill } from './ui'
import { useDevTheme } from './theme'
import { API_BASE, TEST_NUMBERS } from '@/lib/developers/catalog'

// Trailing slash: the paths below are appended to it.
const V1_BASE = '/api/v1/'

interface LeadRow { external_id: string; first_name: string; phone: string }
interface LogRow { at: string; method: string; path: string; status: number; ms: number; body: unknown }
interface EventRow { at: string; type: string; payload: unknown }
interface Mounted { destroy(): void; on(type: string, fn: (p: unknown, t: string) => void): Mounted }
declare global { interface Window { DialerSeat?: { mount(el: Element, opts: Record<string, unknown>): Mounted } } }

const START_LEADS: LeadRow[] = [
  { external_id: 'crm_1001', first_name: 'Answers', phone: '+15125550101' },
  { external_id: 'crm_1002', first_name: 'Voicemail', phone: '+15125550107' },
  { external_id: 'crm_1003', first_name: 'No answer', phone: '+15125550108' },
  { external_id: 'crm_1004', first_name: 'Busy', phone: '+15125550109' },
]

const now = () => new Date().toLocaleTimeString()

export function Playground() {
  const base = useDevBase()
  const theme = useDevTheme()
  const [key, setKey] = useState('')
  const [me, setMe] = useState<{ name: string; livemode: boolean } | null>(null)
  const [seatExt, setSeatExt] = useState('playground_agent')
  const [seatName, setSeatName] = useState('Playground Agent')
  const [seat, setSeat] = useState<{ id: string; status: string } | null>(null)
  const [campaign, setCampaign] = useState('playground')
  const [leads, setLeads] = useState<LeadRow[]>(START_LEADS)
  const [log, setLog] = useState<LogRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [tab, setTab] = useState<'requests' | 'events' | 'curl'>('requests')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const mounted = useRef<Mounted | null>(null)
  const [dialerOn, setDialerOn] = useState(false)

  useEffect(() => () => mounted.current?.destroy(), [])

  const call = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
    const t0 = performance.now()
    const res = await fetch(V1_BASE + path.replace(/^\//, ''), {
      method,
      headers: { Authorization: `Bearer ${key.trim()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    setLog(l => [{ at: now(), method, path, status: res.status, ms: Math.round(performance.now() - t0), body: data }, ...l].slice(0, 50))
    if (!res.ok) throw new Error((data as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`)
    return data as T
  }

  const run = async (fn: () => Promise<void>, label: string) => {
    setBusy(label); setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.') }
    finally { setBusy(null) }
  }

  const makeKey = () => run(async () => {
    // Signed-in developers can mint a playground key from their console session.
    const res = await fetch('/api/developers/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'secret', env: 'test', name: 'Playground' }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Sign in and activate a developer account to create a key here, or paste a test key you already have.' : (data?.error?.message || 'Could not create a key.'))
    setKey(data.key); setMe(null); setSeat(null)
  }, 'key')

  const connect = () => run(async () => {
    if (/^dsk_live_/.test(key.trim())) throw new Error('The playground only takes test keys. Live keys belong on your server.')
    const r = await call<{ name: string; livemode: boolean }>('GET', '/me')
    setMe(r)
  }, 'connect')

  const createSeat = () => run(async () => {
    const r = await call<{ id: string; status: string }>('POST', '/seats', { external_user_id: seatExt, name: seatName })
    setSeat(r)
  }, 'seat')

  const loadLoader = () => new Promise<void>((resolve, reject) => {
    if (window.DialerSeat) return resolve()
    const s = document.createElement('script')
    s.src = `${base}/embed/v1.js`
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('The miniplayer loader did not load.'))
    document.head.appendChild(s)
  })

  const openDialer = () => run(async () => {
    if (!seat) return
    const sess = await call<{ token: string }>('POST', `/seats/${seat.id}/sessions`)
    await loadLoader()
    mounted.current?.destroy()
    const d = window.DialerSeat!.mount(host.current!, {
      session: sess.token, campaign: campaign || undefined, theme,
      leads: leads.filter(l => l.phone.trim()).map(l => ({ external_id: l.external_id, first_name: l.first_name, phone: l.phone })),
    })
    d.on('*', (payload, type) => setEvents(e => [{ at: now(), type, payload }, ...e].slice(0, 80)))
    mounted.current = d
    setDialerOn(true); setTab('events')
  }, 'dialer')

  const reset = () => {
    mounted.current?.destroy(); mounted.current = null
    setDialerOn(false); setSeat(null); setMe(null); setEvents([]); setLog([]); setError(null)
  }

  const curl = [
    `# 1. Check the key\ncurl ${API_BASE}/me \\\n  -H "Authorization: Bearer dsk_test_..."`,
    `# 2. Create or update the seat\ncurl ${API_BASE}/seats \\\n  -H "Authorization: Bearer dsk_test_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"external_user_id":"${seatExt}","name":"${seatName}"}'`,
    `# 3. A session for the miniplayer (one use, 15 minutes)\ncurl -X POST ${API_BASE}/seats/${seat?.id || '{seat_id}'}/sessions \\\n  -H "Authorization: Bearer dsk_test_..."`,
    `<!-- 4. Your page -->\n<script src="https://dev.dialerseat.com/embed/v1.js"></script>\n<div id="dialer"></div>\n<script>\n  const dialer = DialerSeat.mount('#dialer', {\n    session: SESSION_TOKEN,\n    campaign: '${campaign}',\n    leads: ${JSON.stringify(leads.slice(0, 2).map(l => ({ external_id: l.external_id, first_name: l.first_name, phone: l.phone })))},\n  })\n  dialer.on('disposition', e => console.log(e))\n</script>`,
  ].join('\n\n')

  const stepHead = (n: number, title: string, done: boolean) => (
    <div className="dv-row" style={{ marginBottom: 12 }}>
      {done ? <CheckCircle2 size={18} color="var(--dv-green)" /> : <span style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--dv-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--dv-muted)' }}>{n}</span>}
      <span style={{ fontWeight: 600 }}>{title}</span>
    </div>
  )

  return (
    <div className="dv-pg" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 420px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
      <div className="dv-stack">
        {error && <div className="dv-alert dv-alert-amber" style={{ fontSize: 13 }}>{error}</div>}

        <div className="dv-card" style={{ padding: 18 }}>
          {stepHead(1, 'Your test secret key', !!me)}
          <div className="dv-row" style={{ gap: 8 }}>
            <input className="dv-input dv-mono" type="password" autoComplete="off" spellCheck={false} placeholder="dsk_test_…" value={key} onChange={e => { setKey(e.target.value); setMe(null) }} aria-label="Test secret key" />
            <button type="button" className="dv-btn dv-btn-primary" onClick={connect} disabled={!key.trim() || busy === 'connect'}>{busy === 'connect' ? 'Checking…' : 'Connect'}</button>
          </div>
          <div className="dv-row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="dv-btn dv-btn-sm" onClick={makeKey} disabled={busy === 'key'}><Wand2 size={14} /> Create a test key for me</button>
            <DevLink href="/console/api-keys" className="dv-link" style={{ fontSize: 13, padding: '8px 0' }}><KeyRound size={13} style={{ verticalAlign: '-2px' }} /> API keys</DevLink>
          </div>
          {me && <p className="dv-help" style={{ marginTop: 10 }}>Connected to <strong style={{ color: 'var(--dv-text)' }}>{me.name}</strong> in test mode. Nothing here places a real call.</p>}
          {!me && <p className="dv-help" style={{ marginTop: 10 }}>Test keys only. The key stays in this page and is never saved.</p>}
        </div>

        <div className="dv-card" style={{ padding: 18, opacity: me ? 1 : .55 }}>
          {stepHead(2, 'A seat for your user', !!seat)}
          <div className="dv-grid-2" style={{ gap: 8 }}>
            <div><label className="dv-label">Your user id</label><input className="dv-input dv-mono" value={seatExt} onChange={e => setSeatExt(e.target.value)} /></div>
            <div><label className="dv-label">Name</label><input className="dv-input" value={seatName} onChange={e => setSeatName(e.target.value)} /></div>
          </div>
          <button type="button" className="dv-btn" style={{ marginTop: 10 }} onClick={createSeat} disabled={!me || !seatExt.trim() || busy === 'seat'}>{seat ? 'Update seat' : 'Create seat'}</button>
          {seat && <p className="dv-help">Seat <code className="dv-inline-code">{seat.id.slice(0, 8)}…</code> is {seat.status}.</p>}
        </div>

        <div className="dv-card" style={{ padding: 18, opacity: seat ? 1 : .55 }}>
          {stepHead(3, 'Leads and campaign', dialerOn)}
          <label className="dv-label">Campaign id <span className="dv-dim">(yours, optional)</span></label>
          <input className="dv-input dv-mono" value={campaign} onChange={e => setCampaign(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'grid', gap: 6 }}>
            {leads.map((l, i) => (
              <div key={i} className="dv-pg-lead" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr) 36px', gap: 6 }}>
                <input className="dv-input" value={l.first_name} placeholder="Name" aria-label="Lead name" onChange={e => setLeads(ls => ls.map((x, j) => j === i ? { ...x, first_name: e.target.value } : x))} />
                <input className="dv-input dv-mono" value={l.phone} placeholder="+1…" aria-label="Lead phone" onChange={e => setLeads(ls => ls.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
                <button type="button" className="dv-btn dv-btn-ghost" aria-label="Remove lead" style={{ padding: 0 }} onClick={() => setLeads(ls => ls.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="dv-btn dv-btn-sm" style={{ marginTop: 8 }} onClick={() => setLeads(ls => [...ls, { external_id: `crm_${1001 + ls.length}`, first_name: '', phone: '' }])}><Plus size={14} /> Add a lead</button>
          <p className="dv-help">Test outcomes by last digit: {TEST_NUMBERS.map(t => `${t.ending} ${t.label.toLowerCase()}`).join(' · ')}.</p>
          <div className="dv-row" style={{ marginTop: 12, gap: 8 }}>
            <button type="button" className="dv-btn dv-btn-primary" onClick={openDialer} disabled={!seat || busy === 'dialer'}><Play size={15} /> {dialerOn ? 'Reopen the dialer' : 'Open the dialer'}</button>
            <button type="button" className="dv-btn dv-btn-ghost" onClick={reset}><RotateCcw size={14} /> Start over</button>
          </div>
        </div>
      </div>

      <div className="dv-stack">
        <div className="dv-pg-stage" style={{ display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr)', gap: 16 }}>
          <div style={{ position: 'relative', height: 640, borderRadius: 16, border: dialerOn ? 'none' : '1px dashed var(--dv-border)' }}>
            {!dialerOn && <div className="dv-dim" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, fontSize: 13 }}>Your dialer appears here, exactly as it would inside your CRM.</div>}
            <div ref={host} style={{ height: '100%' }} />
          </div>
          <div className="dv-card" style={{ height: 640, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="dv-row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--dv-border-soft)' }}>
              <div className="dv-seg">
                <button type="button" aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}>API requests · {log.length}</button>
                <button type="button" aria-pressed={tab === 'events'} onClick={() => setTab('events')}>Browser events · {events.length}</button>
                <button type="button" aria-pressed={tab === 'curl'} onClick={() => setTab('curl')}>As code</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {tab === 'requests' && (log.length === 0 ? <div className="dv-empty">Requests your app would make appear here.</div> : log.map((r, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--dv-border-soft)' }}>
                  <button type="button" onClick={() => setOpen(open === i ? null : i)} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', padding: '9px 2px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
                    <MethodPill method={r.method} />
                    <code style={{ flex: 1, fontSize: 12.5, overflowWrap: 'anywhere' }}>/v1{r.path}</code>
                    <span className={`dv-badge ${r.status < 300 ? 'dv-badge-green' : 'dv-badge-red'}`}>{r.status}</span>
                    <span className="dv-dim" style={{ fontSize: 12 }}>{r.ms} ms</span>
                  </button>
                  {open === i && <div style={{ paddingBottom: 10 }}><CodeBlock lang="json" title={`response · ${r.at}`} code={JSON.stringify(r.body, null, 2)} /></div>}
                </div>
              )))}
              {tab === 'events' && (events.length === 0 ? <div className="dv-empty">Events from <code className="dv-inline-code">dialer.on(…)</code> appear here once the dialer is open.</div> : events.map((e, i) => (
                <div key={i} style={{ fontFamily: 'var(--dv-mono)', fontSize: 12, padding: '7px 0', borderBottom: '1px solid var(--dv-border-soft)', overflowWrap: 'anywhere' }}>
                  <span className="dv-dim">{e.at}</span> <span style={{ color: 'var(--dv-accent)' }}>{e.type}</span> <span className="dv-muted">{JSON.stringify(e.payload)}</span>
                </div>
              )))}
              {tab === 'curl' && <CodeBlock lang="bash" title="what this page did, as your app would do it" code={curl} />}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 1250px) { .dv-pg-stage { grid-template-columns: minmax(0, 1fr) !important; } }
        @media (max-width: 900px) { .dv-pg { grid-template-columns: minmax(0, 1fr) !important; } }
      `}</style>
    </div>
  )
}
