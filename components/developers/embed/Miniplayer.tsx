'use client'

// =============================================================================
// THE MINIPLAYER — the portable DialerSeat dialer, inside a platform's page
// =============================================================================
// Signs in with the session token from the URL fragment, then dials the lead
// queue the host page hands it. In test mode every call is simulated, decided
// by the number's last digit, and every step is reported to the server so the
// platform receives exactly the signed webhooks a real call sends, and to the
// host page through postMessage (dialer.on('call' | 'disposition' | ...)).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Pause, Phone, PhoneOff, Play, SkipForward, TriangleAlert, Voicemail, CircleCheck, Lock } from 'lucide-react'
import type { Invitation, Registerer, UserAgent } from 'sip.js'
import { TEST_NUMBERS } from '@/lib/developers/catalog'

type Outcome = 'human' | 'machine' | 'no_answer' | 'busy'
type Mode = 'preview' | 'progressive' | 'power' | 'predictive'

interface Config {
  env: 'test' | 'live'
  platform: { name: string }
  seat: { id: string; external_user_id: string; name: string | null; status: string; billed_to: string }
  campaign: { id: string | null; external_id: string; name: string | null } | null
  dial_modes: { allowed: Mode[]; default: Mode; may_choose: boolean; exception: string | null }
  dispositions: { code: string; label: string; outcome: string }[]
  can_dial: 'simulated' | 'live' | 'live_inactive' | 'live_unavailable' | 'needs_payment' | 'waiting_for_platform'
  allowed_origins: string[]
}

interface Lead { external_id: string | null; phone: string; name: string | null; state: string | null; fields: [string, string][]; valid: boolean }

interface Call {
  id: string
  /** 'live' for a real call: the carrier decides what happens, the frame follows it. */
  outcome: Outcome | 'live'
  status: 'ringing' | 'connected' | 'voicemail' | 'ended'
  startedAt: number
  answeredAt: number | null
  endedAt: number | null
  hangup: string | null
}

const MODE_LABEL: Record<Mode, string> = { preview: 'Preview', progressive: 'Progressive', power: 'Power', predictive: 'Predictive' }

function toLead(raw: unknown): Lead {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  let digits = String(r.phone ?? r.phone_number ?? r.mobile ?? '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1)
  const name = [r.first_name, r.last_name].filter(Boolean).join(' ') || (typeof r.name === 'string' ? r.name : '') || null
  const skip = new Set(['phone', 'phone_number', 'mobile', 'first_name', 'last_name', 'name', 'external_id'])
  const fields = Object.entries(r).filter(([k, v]) => !skip.has(k) && v !== null && v !== '' && typeof v !== 'object').slice(0, 6).map(([k, v]) => [k.replace(/_/g, ' '), String(v)] as [string, string])
  const state = typeof r.state === 'string' && r.state.trim() ? r.state.trim() : null
  return { external_id: r.external_id != null ? String(r.external_id) : null, phone: digits, name, state, fields, valid: digits.length === 10 }
}

const fmtPhone = (d: string) => (d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d || 'no number')
const fmtClock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

export function Miniplayer({ theme, campaign }: { theme: 'dark' | 'light'; campaign: string | null }) {
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<Config | null>(null)
  const frameToken = useRef<string | null>(null)
  const parentOrigin = useRef<string | null>(null)

  const [leads, setLeads] = useState<Lead[]>([])
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('power')
  const [call, setCall] = useState<Call | null>(null)
  const [muted, setMuted] = useState(false)
  const [held, setHeld] = useState(false)
  const [wrap, setWrap] = useState<{ preselect: string | null } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [paused, setPaused] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [done, setDone] = useState<{ lead: Lead; label: string }[]>([])
  const [webhooks, setWebhooks] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const timers = useRef<number[]>([])
  // The live call, readable from timers without going through a state updater
  // (an updater can run twice; a webhook must not).
  const callRef = useRef<Call | null>(null)
  const putCall = useCallback((c: Call | null) => { callRef.current = c; setCall(c) }, [])
  const isLive = (id: string, status: Call['status']) => callRef.current?.id === id && callRef.current.status === status

  const post = useCallback((type: string, payload?: unknown) => {
    if (!parentOrigin.current || window.parent === window) return
    window.parent.postMessage({ __dialerseat: 1, type, payload }, parentOrigin.current)
  }, [])

  const api = useCallback(async <T,>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Frame ${frameToken.current}` },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: { message?: string } })?.error?.message || `Request failed (${res.status})`)
    const w = (data as { webhooks?: { delivered?: number } }).webhooks
    if (w?.delivered) setWebhooks(n => n + (w.delivered || 0))
    return data as T
  }, [])

  const apiGet = useCallback(async <T,>(path: string): Promise<T> => {
    const res = await fetch(path, { headers: { Authorization: `Frame ${frameToken.current}` }, cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: { message?: string } })?.error?.message || `Request failed (${res.status})`)
    return data as T
  }, [])

  // ── THE BROWSER PHONE (live seats only) ─────────────────────────────────
  // The seat's own SIP line, set up the way the regular dialer sets up an
  // agent's (app/dashboard/dialer): register with the seat's credential,
  // auto-answer the agent leg the call engine rings, attach its audio, and
  // re-register after any reconnect. Only an agent leg the frame is expecting
  // is answered; anything else is refused.
  const [line, setLine] = useState<'off' | 'connecting' | 'ready' | 'error'>('off')
  const uaRef = useRef<UserAgent | null>(null)
  const regRef = useRef<Registerer | null>(null)
  const sessionRef = useRef<Invitation | null>(null)
  const expectingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const peer = (inv: Invitation | null): RTCPeerConnection | null =>
    ((inv?.sessionDescriptionHandler as unknown as { peerConnection?: RTCPeerConnection } | undefined)?.peerConnection) || null

  const attachAudio = useCallback((inv: Invitation) => {
    const pc = peer(inv)
    const el = audioRef.current
    if (!pc || !el) return
    const stream = new MediaStream()
    pc.getReceivers().forEach(r => { if (r.track && r.track.kind === 'audio') stream.addTrack(r.track) })
    el.srcObject = stream
    el.muted = false
    void el.play().catch(() => {})
  }, [])

  const setSending = useCallback((on: boolean) => {
    peer(sessionRef.current)?.getSenders().forEach(snd => { if (snd.track) snd.track.enabled = on })
  }, [])

  useEffect(() => {
    if (config?.can_dial !== 'live') return
    let cancelled = false
    let reconnectTimer: number | null = null
    let attempt = 0
    ;(async () => {
      setLine('connecting')
      try {
        const reg = await api<{ sipUsername: string; sipPassword: string; sipDomain: string; sipWssUrl: string; iceServers: RTCIceServer[] }>('/api/v1/embed/live/credentials', {})
        if (cancelled) return
        const { UserAgent, Registerer, SessionState } = await import('sip.js')
        const uri = UserAgent.makeURI(`sip:${reg.sipUsername}@${reg.sipDomain}`)
        if (!uri) throw new Error('bad SIP address')
        let rtcpMuxPolicy: string | undefined
        try { new RTCPeerConnection({ rtcpMuxPolicy: 'negotiate' } as unknown as RTCConfiguration).close(); rtcpMuxPolicy = 'negotiate' } catch { /* not supported */ }
        const ua = new UserAgent({
          uri,
          authorizationUsername: reg.sipUsername,
          authorizationPassword: reg.sipPassword,
          transportOptions: { server: reg.sipWssUrl, keepAliveInterval: 30 },
          sessionDescriptionHandlerFactoryOptions: {
            iceGatheringTimeout: 500,
            peerConnectionConfiguration: { iceServers: reg.iceServers, iceCandidatePoolSize: 1, ...((rtcpMuxPolicy ? { rtcpMuxPolicy } : {}) as unknown as RTCConfiguration) },
            constraints: { audio: true, video: false },
          },
        })
        const reregister = async () => { try { await regRef.current?.register() } catch { /* the next reconnect retries */ } }
        ua.delegate = {
          onConnect: () => { attempt = 0; if (reconnectTimer) window.clearTimeout(reconnectTimer); void reregister() },
          onDisconnect: () => {
            if (cancelled) return
            setLine('connecting')
            attempt += 1
            const delay = Math.min(30000, 1000 * Math.pow(2, attempt - 1))
            reconnectTimer = window.setTimeout(() => { void ua.reconnect().catch(() => {}) }, delay)
          },
          onInvite: async (inv: Invitation) => {
            if (!expectingRef.current || sessionRef.current) { void inv.reject().catch(() => {}); return }
            expectingRef.current = false
            sessionRef.current = inv
            inv.stateChange.addListener(state => {
              if (state === SessionState.Established) attachAudio(inv)
              if (state === SessionState.Terminated && sessionRef.current === inv) sessionRef.current = null
            })
            try {
              await inv.accept({ sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } } })
              attachAudio(inv)
            } catch (err) {
              const blocked = err instanceof Error && ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError'].includes(err.name)
              setNotice(blocked ? 'Microphone blocked. Allow the microphone for this page, then reload.' : 'Your line could not take this call.')
            }
          },
        }
        uaRef.current = ua
        await ua.start()
        if (cancelled) { void ua.stop(); return }
        const registerer = new Registerer(ua)
        regRef.current = registerer
        registerer.stateChange.addListener(st => { if (!cancelled) setLine(st === 'Registered' ? 'ready' : 'connecting') })
        await registerer.register()
      } catch (e) {
        if (!cancelled) { setLine('error'); setNotice(e instanceof Error ? e.message : 'Your line could not connect.') }
      }
    })()
    return () => {
      cancelled = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      void regRef.current?.unregister().catch(() => {})
      void uaRef.current?.stop().catch(() => {})
      uaRef.current = null; regRef.current = null
    }
  }, [config?.can_dial, api, attachAudio])


  // ── sign in from the fragment, once ──
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('s') || ''
    // The token is spent the moment it is read; it should not sit in history.
    history.replaceState(null, '', window.location.pathname + window.location.search)
    const anc = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins
    const fromAncestors = anc && anc.length ? anc[0] : null
    const fromReferrer = document.referrer ? (() => { try { return new URL(document.referrer).origin } catch { return null } })() : null
    const parent = window.parent === window ? window.location.origin : (fromAncestors || fromReferrer)
    parentOrigin.current = parent
    ;(async () => {
      try {
        const res = await fetch('/api/v1/embed/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, parent_origin: parent, campaign }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error?.message || 'The dialer could not sign in.')
        frameToken.current = data.frame_token
        const c = data.config as Config
        setConfig(c)
        setMode(c.dial_modes.default)
        setPhase('ready')
        if (parent) window.parent.postMessage({ __dialerseat: 1, type: 'ready', payload: { seat: c.seat, env: c.env, dial_mode: c.dial_modes.default } }, parent)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'The dialer could not sign in.'
        setError(msg); setPhase('error')
        if (parent) window.parent.postMessage({ __dialerseat: 1, type: 'error', payload: { message: msg } }, parent)
      }
    })()
  }, [campaign])

  // ── messages from the host page ──
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent || e.origin !== parentOrigin.current) return
      const d = e.data as { __dialerseat?: number; type?: string; payload?: unknown }
      if (!d || d.__dialerseat !== 1) return
      if (d.type === 'leads' && Array.isArray(d.payload)) {
        const next = d.payload.slice(0, 1000).map(toLead)
        setLeads(next); setIndex(0); setDone([])
        const bad = next.filter(l => !l.valid).length
        setNotice(bad ? `${bad} lead${bad > 1 ? 's' : ''} without a usable US number will be skipped.` : null)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // A clock for the call timer, only while a call is live.
  useEffect(() => {
    if (!call || call.status === 'ended') return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [call])

  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)) }, [])

  // Mute stops sending; hold stops sending and silences the far end, locally.
  useEffect(() => {
    setSending(!muted && !held)
    if (audioRef.current) audioRef.current.muted = held
  }, [muted, held, setSending])

  const lead = leads[index] as Lead | undefined
  const remaining = leads.slice(index).filter(l => l.valid).length

  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)) }

  const report = useCallback(async (id: string, l: Lead, body: Record<string, unknown>) => {
    try { await api(`/api/v1/embed/calls/${id}`, { ...body, lead: { external_id: l.external_id, phone: l.phone }, campaign, mode }) }
    catch (e) { setNotice(e instanceof Error ? e.message : 'A webhook could not be sent.') }
  }, [api, campaign, mode])

  const finish = useCallback((c: Call, l: Lead, hangup: string, preselectOutcome: string | null) => {
    const ended = Date.now()
    const ended_c: Call = { ...c, status: 'ended', endedAt: ended, hangup }
    putCall(ended_c)
    const talk = c.answeredAt ? Math.round((ended - c.answeredAt) / 1000) : 0
    void report(c.id, l, { event: 'ended', hangup_source: hangup, duration_seconds: Math.round((ended - c.startedAt) / 1000), talk_seconds: c.outcome === 'human' ? talk : 0 })
    post('call', { state: 'ended', call_id: c.id, lead: { external_id: l.external_id, phone: '+1' + l.phone }, hangup_source: hangup })
    const pre = preselectOutcome && config ? config.dispositions.find(d => d.outcome === preselectOutcome)?.code ?? null : null
    setPicked(pre); setNotes(''); setWrap({ preselect: pre })
  }, [config, post, putCall, report])

  const liveFinish = useCallback((c: Call, l: Lead, hangup: string) => {
    putCall({ ...c, status: 'ended', endedAt: Date.now(), hangup })
    expectingRef.current = false
    void sessionRef.current?.bye().catch(() => {})
    post('call', { state: 'ended', call_id: c.id, lead: { external_id: l.external_id, phone: '+1' + l.phone }, hangup_source: hangup })
    if (hangup === 'agent_unreachable') setNotice('Your browser phone did not pick up its line. Check the microphone permission and that this tab stayed open.')
    const preOutcome = hangup === 'amd' ? 'voicemail' : hangup === 'no_answer' || hangup === 'busy' ? 'no_answer' : null
    const pre = preOutcome && config ? config.dispositions.find(d => d.outcome === preOutcome)?.code ?? null : null
    setPicked(pre); setNotes(''); setWrap({ preselect: pre })
  }, [config, post, putCall])

  // While a live call is up, follow it from the carrier's side once a second.
  useEffect(() => {
    if (!call || call.outcome !== 'live' || call.status === 'ended' || !lead) return
    const c = call, l = lead
    const t = window.setInterval(async () => {
      try {
        const s = await apiGet<{ status: string; answered_at: string | null; amd_result: string | null; hangup_source: string | null }>(`/api/v1/embed/calls/${c.id}`)
        const cur = callRef.current
        if (!cur || cur.id !== c.id || cur.status === 'ended') return
        if (s.status === 'ended' || s.status === 'failed') { liveFinish(cur, l, s.hangup_source || 'failed'); return }
        if (s.status === 'connected') {
          const next: Call['status'] = s.amd_result === 'machine' ? 'voicemail' : 'connected'
          if (cur.status !== next) {
            putCall({ ...cur, status: next, answeredAt: s.answered_at ? Date.parse(s.answered_at) : Date.now() })
            post('call', { state: next, call_id: c.id, amd_result: s.amd_result })
          }
        }
      } catch { /* the next tick tries again */ }
    }, 1000)
    return () => window.clearInterval(t)
  }, [call, lead, apiGet, liveFinish, post, putCall])

  const dial = useCallback(async () => {
    if (!lead || !config) return
    if (!lead.valid) { setIndex(i => i + 1); return }
    setCountdown(null); setMuted(false); setHeld(false); setNotice(null)
    if (config.can_dial === 'live') {
      if (line !== 'ready') { setNotice('Your line is still connecting. Try again in a moment.'); return }
      // Ask for the microphone on the agent's click, before the call exists,
      // so the permission prompt never lands on a ringing lead.
      try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(tr => tr.stop()) }
      catch { setNotice('Allow the microphone to make calls.'); return }
      expectingRef.current = true
      try {
        const r = await api<{ call_id: string }>('/api/v1/embed/calls', { lead: { external_id: lead.external_id, phone: lead.phone, state: lead.state }, campaign, mode })
        putCall({ id: r.call_id, outcome: 'live', status: 'ringing', startedAt: Date.now(), answeredAt: null, endedAt: null, hangup: null }); setNow(Date.now())
        post('call', { state: 'ringing', call_id: r.call_id, lead: { external_id: lead.external_id, phone: '+1' + lead.phone } })
      } catch (e) {
        expectingRef.current = false
        setNotice(e instanceof Error ? e.message : 'The call could not start.')
      }
      return
    }
    try {
      const r = await api<{ call_id: string; outcome: Outcome }>('/api/v1/embed/calls', { lead: { external_id: lead.external_id, phone: lead.phone }, campaign, mode })
      const c: Call = { id: r.call_id, outcome: r.outcome, status: 'ringing', startedAt: Date.now(), answeredAt: null, endedAt: null, hangup: null }
      putCall(c); setNow(Date.now())
      post('call', { state: 'ringing', call_id: c.id, lead: { external_id: lead.external_id, phone: '+1' + lead.phone } })
      const l = lead
      if (r.outcome === 'human') {
        later(2200, () => {
          if (!isLive(c.id, 'ringing')) return
          putCall({ ...c, status: 'connected', answeredAt: Date.now() })
          void report(c.id, l, { event: 'answered', amd_result: 'human' })
          post('call', { state: 'connected', call_id: c.id, amd_result: 'human' })
        })
      } else if (r.outcome === 'machine') {
        later(2400, () => {
          if (!isLive(c.id, 'ringing')) return
          const vm: Call = { ...c, status: 'voicemail', answeredAt: Date.now() }
          putCall(vm)
          void report(c.id, l, { event: 'answered', amd_result: 'machine' })
          post('call', { state: 'voicemail', call_id: c.id, amd_result: 'machine' })
          later(1800, () => { if (isLive(c.id, 'voicemail')) finish(vm, l, 'amd', 'voicemail') })
        })
      } else if (r.outcome === 'no_answer') {
        later(6000, () => { if (isLive(c.id, 'ringing')) finish(c, l, 'no_answer', 'no_answer') })
      } else {
        later(1100, () => { if (isLive(c.id, 'ringing')) finish(c, l, 'busy', 'no_answer') })
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The call could not start.')
    }
  }, [api, campaign, config, finish, lead, line, mode, post, putCall, report])

  const hangUp = () => {
    const c = callRef.current
    if (!c || !lead || c.status === 'ended') return
    if (c.outcome === 'live') {
      // The engine ends both legs; the poll sees it and opens the wrap-up.
      void api(`/api/v1/embed/calls/${c.id}`, { event: 'hangup' }).catch(() => {})
      void sessionRef.current?.bye().catch(() => {})
      return
    }
    finish(c, lead, 'agent', c.status === 'ringing' ? 'no_answer' : null)
  }

  const saveDisposition = async () => {
    if (!call || !lead || !picked || !config) return
    const d = config.dispositions.find(x => x.code === picked)!
    await report(call.id, lead, { event: 'dispositioned', disposition: { code: d.code, notes } })
    post('disposition', { call_id: call.id, code: d.code, label: d.label, outcome: d.outcome, notes, lead: { external_id: lead.external_id, phone: '+1' + lead.phone } })
    setDone(list => [{ lead, label: d.label }, ...list].slice(0, 50))
    setWrap(null); putCall(null); setPicked(null); setNotes('')
    const next = index + 1
    setIndex(next)
    if (next >= leads.length) post('queue_empty', { dialled: done.length + 1 })
    else if (mode !== 'preview' && !paused) setCountdown(3)
  }

  // Auto-advance in every mode but preview: a visible countdown the agent can pause.
  useEffect(() => {
    if (countdown === null || paused) return
    const t = window.setTimeout(() => {
      if (countdown <= 1) { setCountdown(null); void dial() }
      else setCountdown(countdown - 1)
    }, 1000)
    return () => window.clearTimeout(t)
  }, [countdown, paused, dial])

  const skip = () => { setCountdown(null); setIndex(i => i + 1) }

  const vars = useMemo(() => (theme === 'light' ? {
    '--dv-bg': '#f6f7fb', '--dv-bg-2': '#ffffff', '--dv-panel': '#ffffff', '--dv-panel-2': '#f1f3f9', '--dv-raise': '#e8ecf6',
    '--dv-border': '#d9deea', '--dv-border-soft': '#e6e9f2', '--dv-text': '#14141f', '--dv-muted': '#5d6178', '--dv-dim': '#8a8fa6',
  } : {}) as React.CSSProperties, [theme])

  // ── screens ──
  const shell = (body: React.ReactNode, footer?: React.ReactNode) => (
    <div data-theme={theme} className="dv-app" style={{ ...vars, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--dv-bg)', color: 'var(--dv-text)', overflow: 'hidden' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--dv-border-soft)' }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#4a9eff,#2a6eff)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>D</span>
        <span className="mp-word" style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>DIALERSEAT</span>
        <span style={{ flex: 1 }} />
        {config?.env === 'test' && <span className="dv-badge dv-badge-amber" title="Calls are simulated. Nothing is dialled.">TEST</span>}
        {config?.can_dial === 'live' && (
          <span className={line === 'ready' ? 'dv-badge dv-badge-green' : line === 'error' ? 'dv-badge dv-badge-red' : 'dv-badge'} title="Your browser phone line">
            <span className="dv-dot" />{line === 'ready' ? 'Line ready' : line === 'error' ? 'Line down' : 'Connecting'}
          </span>
        )}
        {config && phase === 'ready' && (config.can_dial === 'simulated' || config.can_dial === 'live') && (config.dial_modes.may_choose && !call ? (
          <select aria-label="Dial mode" value={mode} onChange={e => { setMode(e.target.value as Mode); setCountdown(null) }} className="dv-select" style={{ width: 'auto', height: 26, fontSize: 12, padding: '0 6px' }}>
            {config.dial_modes.allowed.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
        ) : <span className="dv-badge dv-badge-blue">{MODE_LABEL[mode]}</span>)}
      </header>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{body}</div>
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      <style>{`@media (max-width: 360px) { .mp-word { display: none; } }`}</style>
      {footer}
    </div>
  )

  if (phase === 'loading') return shell(<div className="dv-empty">Signing in…</div>)
  if (phase === 'error' || !config) return shell(
    <div style={{ textAlign: 'center', padding: '40px 10px' }}>
      <TriangleAlert size={26} color="var(--dv-amber)" />
      <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>The dialer could not open</div>
      <div className="dv-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{error}</div>
    </div>,
  )

  if (config.can_dial !== 'simulated' && config.can_dial !== 'live') {
    const copy = {
      live_inactive: ['Live dialing is not on yet', `${config.platform.name} has not switched on live dialing with DialerSeat. Test sessions work in the meantime.`],
      live_unavailable: ['Live calling is being set up', 'DialerSeat is finishing the phone lines for live calls. Test sessions work in the meantime.'],
      needs_payment: ['Start your dialer seat', 'Your seat is billed weekly. Checkout opens here when DialerSeat for Developers launches.'],
      waiting_for_platform: ['Waiting for your team', `${config.platform.name} has not activated this seat yet.`],
    }[config.can_dial]
    return shell(
      <div style={{ textAlign: 'center', padding: '40px 10px' }}>
        <Lock size={26} color="var(--dv-muted)" />
        <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>{copy[0]}</div>
        <div className="dv-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{copy[1]}</div>
      </div>,
    )
  }

  const elapsed = call ? (call.endedAt || now) - (call.answeredAt || call.startedAt) : 0
  const statusLine = !call ? null
    : call.status === 'ringing' ? `Ringing · ${fmtClock((call.endedAt || now) - call.startedAt)}`
    : call.status === 'connected' ? `Connected · ${fmtClock(elapsed)}`
    : call.status === 'voicemail' ? 'Voicemail detected (AMD)'
    : call.hangup === 'no_answer' ? 'No answer' : call.hangup === 'busy' ? 'Busy' : call.hangup === 'amd' ? 'Voicemail: call ended' : `Call ended · ${fmtClock(elapsed)}`

  const body = (
    <>
      {notice && <div className="dv-alert dv-alert-amber" style={{ fontSize: 12, padding: '8px 10px', marginBottom: 10 }}>{notice}</div>}

      {!lead ? (
        <div className="dv-empty" style={{ padding: '30px 6px' }}>
          {leads.length === 0 ? (
            <>
              <div style={{ color: 'var(--dv-text)', fontWeight: 600, marginBottom: 6 }}>No leads yet</div>
              Your app passes them in: <code className="dv-inline-code">DialerSeat.mount(el, {'{'} session, leads {'}'})</code> or <code className="dv-inline-code">dialer.setLeads([...])</code>.
            </>
          ) : (
            <>
              <CircleCheck size={24} color="var(--dv-green)" />
              <div style={{ color: 'var(--dv-text)', fontWeight: 600, margin: '8px 0 4px' }}>Queue finished</div>
              {done.length} called in this session.
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="dv-dim" style={{ fontSize: 11, letterSpacing: .5 }}>
            {call ? statusLine : `NEXT · ${remaining} in queue`}
          </div>
          <div style={{ fontSize: 21, fontWeight: 600, marginTop: 4 }}>{lead.name || 'Unnamed lead'}</div>
          <div className="dv-mono dv-muted" style={{ fontSize: 13, marginTop: 2 }}>{fmtPhone(lead.phone)}{!lead.valid && ' · will be skipped'}</div>
          {lead.fields.length > 0 && (
            <div className="dv-inset" style={{ marginTop: 12, padding: '8px 10px', display: 'grid', gap: 4, fontSize: 12.5 }}>
              {lead.fields.map(([k, v]) => <div key={k} style={{ display: 'flex', gap: 8 }}><span className="dv-dim" style={{ minWidth: 80, textTransform: 'capitalize' }}>{k}</span><span>{v}</span></div>)}
            </div>
          )}
          {call?.status === 'voicemail' && <div className="dv-alert dv-alert-blue" style={{ marginTop: 12, fontSize: 12.5 }}><Voicemail size={15} /> Answering machine detected. The call ends on its own.</div>}

          {wrap && config && (
            <div style={{ marginTop: 16 }}>
              <div className="dv-dim" style={{ fontSize: 11, letterSpacing: .5, marginBottom: 8 }}>HOW DID IT GO?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {config.dispositions.map(d => (
                  <button key={d.code} type="button" onClick={() => setPicked(d.code)} className="dv-btn dv-btn-sm"
                    style={{ justifyContent: 'flex-start', height: 34, whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.2, background: picked === d.code ? 'var(--dv-accent-soft)' : undefined, borderColor: picked === d.code ? 'rgba(74,158,255,.6)' : undefined }}>
                    {d.label}
                  </button>
                ))}
              </div>
              <textarea className="dv-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" style={{ marginTop: 8, minHeight: 56, fontFamily: 'var(--dv-sans)' }} maxLength={2000} />
            </div>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="dv-dim" style={{ fontSize: 11, letterSpacing: .5, marginBottom: 6 }}>THIS SESSION</div>
          {done.slice(0, 5).map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--dv-border-soft)' }}>
              <span>{d.lead.name || fmtPhone(d.lead.phone)}</span><span className="dv-muted">{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const round = (on: boolean, danger = false): React.CSSProperties => ({ width: 46, height: 46, borderRadius: '50%', border: danger ? 'none' : '1px solid var(--dv-border)', background: danger ? '#ef4444' : on ? 'var(--dv-accent-soft)' : 'var(--dv-panel-2)', color: danger ? '#fff' : 'var(--dv-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' })

  const footer = (
    <footer style={{ borderTop: '1px solid var(--dv-border-soft)', padding: 12 }}>
      {lead && call && call.status !== 'ended' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onClick={() => setMuted(m => !m)} style={round(muted)} disabled={call.status !== 'connected'}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
          <button type="button" aria-label={held ? 'Resume' : 'Hold'} aria-pressed={held} onClick={() => setHeld(h => !h)} style={round(held)} disabled={call.status !== 'connected'}>{held ? <Play size={18} /> : <Pause size={18} />}</button>
          <button type="button" aria-label="Hang up" onClick={hangUp} style={round(false, true)}><PhoneOff size={18} /></button>
        </div>
      )}
      {lead && wrap && (
        <button type="button" className="dv-btn dv-btn-primary" style={{ width: '100%' }} disabled={!picked} onClick={saveDisposition}>
          {mode === 'preview' || paused ? 'Save' : 'Save and dial next'}
        </button>
      )}
      {lead && !call && !wrap && (
        <div style={{ display: 'flex', gap: 8 }}>
          {countdown !== null ? (
            <button type="button" className="dv-btn" style={{ flex: 1 }} onClick={() => { setPaused(true); setCountdown(null) }}><Pause size={15} /> Dialing in {countdown}… pause</button>
          ) : (
            <button type="button" className="dv-btn dv-btn-primary" style={{ flex: 1 }} disabled={config.can_dial === 'live' && line !== 'ready'} onClick={() => { setPaused(false); void dial() }}><Phone size={15} /> {paused && mode !== 'preview' ? 'Resume dialing' : 'Call'}</button>
          )}
          <button type="button" className="dv-btn" aria-label="Skip lead" onClick={skip}><SkipForward size={15} /></button>
        </div>
      )}
      {config.env === 'test' && (
        <details style={{ marginTop: 8, fontSize: 11 }} className="dv-dim">
          <summary style={{ cursor: 'pointer' }}>Test mode · calls are simulated{webhooks ? ` · ${webhooks} webhook${webhooks > 1 ? 's' : ''} delivered` : ''}</summary>
          <div style={{ display: 'grid', gap: 2, marginTop: 6 }}>
            {TEST_NUMBERS.map(t => <span key={t.ending}>Ends in {t.ending}: {t.label}</span>)}
          </div>
        </details>
      )}
    </footer>
  )

  return shell(body, footer)
}
