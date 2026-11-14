'use client'

// =============================================================================
// THE MINIPLAYER — the portable DialerSeat dialer, inside a platform's page
// =============================================================================
// Signs in with the session token from the URL fragment, then dials the lead
// queue the host page hands it. In test mode every call is simulated, decided
// by the number's last digit, and every step is reported to the server so the
// platform receives exactly the signed webhooks a real call sends, and to the
// host page through postMessage (dialer.on('call' | 'disposition' | ...)).
//
// THE LOOK is DialerSeat's own (app/globals.css): the #1a1a2e header with the
// blue top rule, #4a9eff for the call button, 4px corners, Futura, and the
// app's green / amber / red for call states. Dark by default; theme=light uses
// the app's light page (#f0f1f4) and card (#e2e4ea) colours.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Pause, Phone, PhoneOff, Play, SkipForward, TriangleAlert, Voicemail, CircleCheck, Lock } from 'lucide-react'
import type { Invitation, Registerer, UserAgent } from 'sip.js'
import { SKIP_DISPOSITION, TEST_NUMBERS } from '@/lib/developers/catalog'

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
        // A hosted link or a plain iframe gets its list from the session itself.
        if (Array.isArray(data.leads) && data.leads.length) {
          const fromSession = (data.leads as unknown[]).slice(0, 1000).map(toLead)
          setLeads(fromSession); setIndex(0)
        }
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

  const saveDisposition = async (code: string | null = picked) => {
    if (!call || !lead || !code || !config) return
    const d = config.dispositions.find(x => x.code === code)
    if (!d) return
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

  // DialerSeat's palette, from app/globals.css (--brand-*).
  const vars = useMemo(() => (theme === 'light' ? {
    '--dv-bg': '#f0f1f4', '--dv-bg-2': '#ffffff', '--dv-panel': '#e2e4ea', '--dv-panel-2': '#ffffff', '--dv-raise': '#d0d4d8',
    '--dv-border': '#c4c8d0', '--dv-border-soft': '#d0d4d8', '--dv-text': '#1a1c24', '--dv-muted': '#5a5e6a', '--dv-dim': '#5a5e6a',
    '--mp-card': '#e2e4ea', '--mp-row': '#f0f1f4', '--mp-ok': '#16a34a', '--mp-warn': '#d97706', '--mp-bad': '#dc2626',
  } : {
    '--dv-bg': '#0a0a0f', '--dv-bg-2': '#111118', '--dv-panel': '#111118', '--dv-panel-2': '#1a1c24', '--dv-raise': '#1c1c2c',
    '--dv-border': '#2a2a3e', '--dv-border-soft': '#1c1c2c', '--dv-text': '#f0f0f5', '--dv-muted': '#949ba4', '--dv-dim': '#8888aa',
    '--mp-card': '#111118', '--mp-row': '#1a1c24', '--mp-ok': '#32ff7e', '--mp-warn': '#ffaa3e', '--mp-bad': '#ff6464',
  }) as React.CSSProperties, [theme])

  // ── screens ──
  const shell = (body: React.ReactNode, footer?: React.ReactNode) => (
    <div data-theme={theme} className="mp" style={{ ...vars, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--dv-bg)', color: 'var(--dv-text)', overflow: 'hidden' }}>
      <header className="mp-head">
        <span className="mp-mark">D</span>
        <span className="mp-word">DIALERSEAT</span>
        <span style={{ flex: 1 }} />
        {config?.env === 'test' && <span className="mp-tag mp-tag-warn" title="Calls are simulated. Nothing is dialled.">TEST</span>}
        {config?.can_dial === 'live' && (
          <span className={`mp-tag ${line === 'ready' ? 'mp-tag-ok' : line === 'error' ? 'mp-tag-bad' : ''}`} title="Your browser phone line">
            <span className="mp-dot" />{line === 'ready' ? 'LINE READY' : line === 'error' ? 'LINE DOWN' : 'CONNECTING'}
          </span>
        )}
        {config && phase === 'ready' && (config.can_dial === 'simulated' || config.can_dial === 'live') && (config.dial_modes.may_choose && !call ? (
          <select aria-label="Dial mode" value={mode} onChange={e => { setMode(e.target.value as Mode); setCountdown(null) }} className="mp-select">
            {config.dial_modes.allowed.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
        ) : <span className="mp-tag mp-tag-blue">{MODE_LABEL[mode].toUpperCase()}</span>)}
      </header>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{body}</div>
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      <style>{MP_CSS}</style>
      {footer}
    </div>
  )

  if (phase === 'loading') return shell(<div className="mp-empty">Signing in…</div>)
  if (phase === 'error' || !config) return shell(
    <div style={{ textAlign: 'center', padding: '40px 10px' }}>
      <TriangleAlert size={26} color="var(--mp-warn)" />
      <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>The dialer could not open</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--dv-muted)' }}>{error}</div>
    </div>,
  )

  if (config.can_dial !== 'simulated' && config.can_dial !== 'live') {
    const copy = {
      live_inactive: ['Live dialing is not on yet', `${config.platform.name} has not switched on live dialing with DialerSeat. Test sessions work in the meantime.`],
      live_unavailable: ['Live calling is being set up', 'DialerSeat is finishing the phone lines for live calls. Test sessions work in the meantime.'],
      needs_payment: ['Your seat is not active', `Your access through ${config.platform.name} has ended or has not started. Renew it with ${config.platform.name} to dial again.`],
      waiting_for_platform: ['Waiting for your team', `${config.platform.name} has not activated this seat yet.`],
    }[config.can_dial]
    return shell(
      <div style={{ textAlign: 'center', padding: '40px 10px' }}>
        <Lock size={26} color="var(--dv-muted)" />
        <div style={{ fontWeight: 600, margin: '12px 0 6px' }}>{copy[0]}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--dv-muted)' }}>{copy[1]}</div>
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
      {notice && <div className="mp-note mp-note-warn" style={{ marginTop: 0, marginBottom: 10 }}>{notice}</div>}

      {!lead ? (
        <div className="mp-empty">
          {leads.length === 0 ? (
            <>
              <div style={{ color: 'var(--dv-text)', fontWeight: 600, marginBottom: 6 }}>No leads yet</div>
              Your app sends them with the session, or from the page: <code>DialerSeat.mount(el, {'{'} session, leads {'}'})</code>.
            </>
          ) : (
            <>
              <CircleCheck size={24} color="var(--mp-ok)" />
              <div style={{ color: 'var(--dv-text)', fontWeight: 600, margin: '8px 0 4px' }}>Queue finished</div>
              {done.length} called in this session.
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="mp-card">
            <div className={`mp-label ${call ? (call.status === 'connected' ? 'mp-ok' : call.status === 'ringing' ? 'mp-warn' : call.status === 'voicemail' ? 'mp-blue' : '') : ''}`}>
              {call ? statusLine?.toUpperCase() : `NEXT LEAD · ${remaining} IN QUEUE`}
            </div>
            <div className="mp-name">{lead.name || 'Unnamed lead'}</div>
            <div className="mp-phone">{fmtPhone(lead.phone)}{!lead.valid && ' · will be skipped'}</div>
            {lead.fields.length > 0 && (
              <div className="mp-fields">
                {lead.fields.map(([k, v]) => <div key={k} className="mp-field"><span>{k}</span><span>{v}</span></div>)}
              </div>
            )}
          </div>
          {call?.status === 'voicemail' && <div className="mp-note mp-note-blue"><Voicemail size={15} /> Answering machine detected. The call ends on its own.</div>}

          {wrap && config && (
            <div style={{ marginTop: 14 }}>
              <div className="mp-label" style={{ marginBottom: 8 }}>DISPOSITION</div>
              <div className="mp-dispos">
                {config.dispositions.filter(d => d.code !== SKIP_DISPOSITION.code).map(d => (
                  <button key={d.code} type="button" onClick={() => setPicked(d.code)} className="mp-dispo" aria-pressed={picked === d.code}>
                    {d.label}
                  </button>
                ))}
                <button type="button" className="mp-dispo mp-dispo-skip" onClick={() => void saveDisposition(SKIP_DISPOSITION.code)} title="Move on without an outcome">
                  <SkipForward size={14} /> {SKIP_DISPOSITION.label}
                </button>
              </div>
              <textarea className="mp-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" maxLength={2000} />
            </div>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="mp-label" style={{ marginBottom: 6 }}>THIS SESSION · {done.length}</div>
          {done.slice(0, 5).map((d, i) => (
            <div key={i} className="mp-done">
              <span>{d.lead.name || fmtPhone(d.lead.phone)}</span><span>{d.label}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const round = (on: boolean, danger = false): React.CSSProperties => ({ width: 48, height: 48, borderRadius: '50%', border: danger ? 'none' : '1px solid var(--dv-border)', background: danger ? '#dc2626' : on ? 'rgba(74,158,255,.18)' : 'var(--mp-row)', color: danger ? '#fff' : on ? '#4a9eff' : 'var(--dv-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' })

  const footer = (
    <footer className="mp-foot">
      {lead && call && call.status !== 'ended' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted} onClick={() => setMuted(m => !m)} style={round(muted)} disabled={call.status !== 'connected'}>{muted ? <MicOff size={18} /> : <Mic size={18} />}</button>
          <button type="button" aria-label={held ? 'Resume' : 'Hold'} aria-pressed={held} onClick={() => setHeld(h => !h)} style={round(held)} disabled={call.status !== 'connected'}>{held ? <Play size={18} /> : <Pause size={18} />}</button>
          <button type="button" aria-label="Hang up" onClick={hangUp} style={round(false, true)}><PhoneOff size={18} /></button>
        </div>
      )}
      {lead && wrap && (
        <button type="button" className="mp-btn mp-btn-primary" style={{ width: '100%' }} disabled={!picked} onClick={() => void saveDisposition()}>
          {mode === 'preview' || paused ? 'Save' : 'Save and dial next'}
        </button>
      )}
      {lead && !call && !wrap && (
        <div style={{ display: 'flex', gap: 8 }}>
          {countdown !== null ? (
            <button type="button" className="mp-btn" style={{ flex: 1 }} onClick={() => { setPaused(true); setCountdown(null) }}><Pause size={15} /> Dialing in {countdown}… pause</button>
          ) : (
            <button type="button" className="mp-btn mp-btn-call" style={{ flex: 1 }} disabled={config.can_dial === 'live' && line !== 'ready'} onClick={() => { setPaused(false); void dial() }}><Phone size={16} /> {paused && mode !== 'preview' ? 'RESUME DIALING' : 'CALL'}</button>
          )}
          <button type="button" className="mp-btn" aria-label="Skip lead" title="Skip this lead" onClick={skip}><SkipForward size={15} /></button>
        </div>
      )}
      {config.env === 'test' && (
        <details style={{ marginTop: 8, fontSize: 11, color: 'var(--dv-dim)' }}>
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

// DialerSeat's dialer look, scoped to the frame.
const MP_CSS = `
.mp { font-family: 'Futura PT', Futura, 'Trebuchet MS', sans-serif; font-size: 14px; -webkit-font-smoothing: antialiased; }
.mp *, .mp *::before, .mp *::after { box-sizing: border-box; }
.mp-head { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: #1a1a2e; color: #fff; border-top: 2px solid #4a9eff; }
.mp-mark { width: 22px; height: 22px; border-radius: 4px; background: #4a9eff; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 700; }
.mp-word { font-size: 11px; letter-spacing: 3px; font-weight: 700; color: #fff; }
.mp-tag { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 7px; border-radius: 3px; font-size: 10px; letter-spacing: 1px; font-weight: 600; color: rgba(255,255,255,.75); background: rgba(255,255,255,.08); }
.mp-tag-warn { color: #ffaa3e; background: rgba(255,170,62,.14); }
.mp-tag-ok { color: #32ff7e; background: rgba(50,255,126,.12); }
.mp-tag-bad { color: #ff6464; background: rgba(255,100,100,.14); }
.mp-tag-blue { color: #4a9eff; background: rgba(74,158,255,.16); }
.mp-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.mp .mp-select { -webkit-appearance: none; appearance: none; height: 20px; line-height: 18px; border-radius: 3px; border: 1px solid rgba(74,158,255,.4); background: rgba(74,158,255,.16); color: #4a9eff; font-family: 'Futura PT', Futura, sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 0 6px; cursor: pointer; }
.mp-card { background: var(--mp-card); border: 1px solid var(--dv-border); border-radius: 4px; padding: 12px 14px; }
.mp-label { font-size: 10.5px; letter-spacing: 1.2px; font-weight: 600; color: var(--dv-dim); }
.mp-ok { color: var(--mp-ok); } .mp-warn { color: var(--mp-warn); } .mp-blue { color: #4a9eff; }
.mp-name { font-size: 21px; font-weight: 600; margin-top: 6px; }
.mp-phone { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; color: var(--dv-muted); margin-top: 2px; }
.mp-fields { margin-top: 10px; display: grid; gap: 3px; font-size: 12.5px; }
.mp-field { display: flex; gap: 8px; padding: 4px 8px; background: var(--mp-row); border-radius: 3px; }
.mp-field span:first-child { min-width: 84px; color: var(--dv-dim); text-transform: capitalize; }
.mp-note { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; padding: 8px 10px; border-radius: 4px; font-size: 12.5px; line-height: 1.5; border-left: 3px solid; }
.mp-note-blue { background: rgba(74,158,255,.10); border-color: #4a9eff; }
.mp-note-warn { background: rgba(255,170,62,.10); border-color: var(--mp-warn); }
.mp-dispos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mp-dispo { min-height: 36px; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--dv-border); background: var(--mp-row); color: var(--dv-text); font: 500 13px 'Futura PT', Futura, sans-serif; text-align: left; line-height: 1.2; cursor: pointer; }
.mp-dispo:hover { border-color: #4a9eff; }
.mp-dispo[aria-pressed="true"] { border-color: #4a9eff; background: rgba(74,158,255,.16); color: var(--dv-text); }
.mp-dispo-skip { grid-column: 1 / -1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: transparent; border-style: dashed; color: var(--dv-muted); text-align: center; }
.mp-notes { width: 100%; margin-top: 8px; min-height: 56px; padding: 8px 10px; border-radius: 4px; border: 1px solid var(--dv-border); background: var(--dv-bg-2); color: var(--dv-text); font: 13px 'Futura PT', Futura, sans-serif; resize: vertical; outline: none; }
.mp-notes:focus { border-color: #4a9eff; }
.mp-done { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid var(--dv-border-soft); }
.mp-done span:last-child { color: var(--dv-muted); }
.mp-foot { border-top: 1px solid var(--dv-border); padding: 12px; background: var(--mp-card); }
.mp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 14px; border-radius: 4px; border: 1px solid var(--dv-border); background: var(--mp-row); color: var(--dv-text); font: 600 13px 'Futura PT', Futura, sans-serif; letter-spacing: .6px; cursor: pointer; }
.mp-btn:disabled { opacity: .5; cursor: not-allowed; }
.mp-btn-primary, .mp-btn-call { background: #4a9eff; border-color: #4a9eff; color: #fff; }
.mp-btn-primary:hover:not(:disabled), .mp-btn-call:hover:not(:disabled) { background: #2a6eff; border-color: #2a6eff; }
.mp-empty { padding: 30px 6px; text-align: center; color: var(--dv-muted); font-size: 13px; line-height: 1.6; }
.mp-empty code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11.5px; background: var(--mp-row); padding: 1px 5px; border-radius: 3px; }
@media (max-width: 360px) { .mp-word { display: none; } }
`
