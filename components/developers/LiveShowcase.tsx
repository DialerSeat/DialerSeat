'use client'

// =============================================================================
// LIVE SHOWCASE — the dev landing page's moving demo
// =============================================================================
// In the spirit of dialerseat.com's DialerShowcase and LeadQueueShowcase: a
// mock-up that moves on its own. A CRM's contact list on the left, the
// DialerSeat miniplayer embedded beside it in DialerSeat's own palette, and
// the platform's server log underneath receiving each signed webhook as the
// call plays out. Every name and number is made up (555-01xx is reserved for
// fiction). Stands still for anyone who prefers reduced motion.
// =============================================================================

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Mic, Pause, PhoneOff, Phone } from 'lucide-react'

const LEADS = [
  { id: 'c_5501', name: 'Dana Ruiz', phone: '(512) 555-0142', city: 'Austin, TX', result: 'Appointment set' },
  { id: 'c_5502', name: 'Marcus Lee', phone: '(214) 555-0187', city: 'Dallas, TX', result: 'Call back' },
  { id: 'c_5503', name: 'Priya Shah', phone: '(713) 555-0119', city: 'Houston, TX', result: 'Left voicemail' },
  { id: 'c_5504', name: 'Tom Becker', phone: '(210) 555-0163', city: 'San Antonio, TX', result: 'Appointment set' },
]
const DISPOS = ['Appointment set', 'Call back', 'Not interested', 'Left voicemail']

type Stage = 'ready' | 'ringing' | 'connected' | 'wrap' | 'saved'
const STAGE_MS: Record<Stage, number> = { ready: 1400, ringing: 1800, connected: 3200, wrap: 1500, saved: 900 }
const NEXT: Record<Stage, Stage> = { ready: 'ringing', ringing: 'connected', connected: 'wrap', wrap: 'saved', saved: 'ready' }
const EVENT_FOR: Partial<Record<Stage, string>> = { ringing: 'call.started', connected: 'call.answered', wrap: 'call.ended', saved: 'call.dispositioned' }

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

export function LiveShowcase() {
  const still = useReducedMotion()
  const [i, setI] = useState(0)
  const [stage, setStage] = useState<Stage>('ready')
  const [secs, setSecs] = useState(0)
  const [log, setLog] = useState<{ k: number; type: string; lead: string; ms: number }[]>([])
  const [done, setDone] = useState<Record<string, string>>({})

  useEffect(() => {
    if (still) return
    const t = window.setTimeout(() => {
      const next = NEXT[stage]
      const ev = EVENT_FOR[next]
      const lead = LEADS[i]
      if (ev) setLog(l => [{ k: Date.now(), type: ev, lead: lead.id, ms: 30 + ((i * 17 + ev.length * 7) % 60) }, ...l].slice(0, 5))
      if (next === 'saved') setDone(d => ({ ...d, [lead.id]: lead.result }))
      if (next === 'ready') {
        const ni = (i + 1) % LEADS.length
        if (ni === 0) setDone({})
        setI(ni)
      }
      if (next === 'connected') setSecs(0)
      setStage(next)
    }, STAGE_MS[stage])
    return () => window.clearTimeout(t)
  }, [stage, i, still])

  useEffect(() => {
    if (still || stage !== 'connected') return
    const t = window.setInterval(() => setSecs(s => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [stage, still])

  const lead = LEADS[i]
  const label = stage === 'ringing' ? 'RINGING' : stage === 'connected' ? `CONNECTED · 00:${String(secs + 12).padStart(2, '0')}` : stage === 'wrap' || stage === 'saved' ? 'CALL ENDED' : `NEXT LEAD · ${LEADS.length - i} IN QUEUE`
  const labelColor = stage === 'ringing' ? '#ffaa3e' : stage === 'connected' ? '#32ff7e' : '#8888aa'

  return (
    <div className="ls" aria-label="A CRM page with the DialerSeat dialer embedded, sending results back by webhook" role="img">
      <div className="ls-window">
        <div className="ls-bar"><span /><span /><span /><div className="ls-url">app.yourcrm.com/contacts</div></div>
        <div className="ls-body">
          <div className="ls-crm">
            <div className="ls-crm-head">
              <strong>Contacts</strong>
              <span>Campaign: Spring follow-ups</span>
            </div>
            <div className="ls-rows">
              {LEADS.map((l, n) => (
                <div key={l.id} className={`ls-row${n === i && stage !== 'saved' ? ' on' : ''}`}>
                  <span className="ls-avatar">{l.name.split(' ').map(p => p[0]).join('')}</span>
                  <span className="ls-who"><b>{l.name}</b><small>{l.city}</small></span>
                  <span className={`ls-status${done[l.id] ? ' done' : ''}`}>{done[l.id] || (n === i ? (stage === 'ringing' || stage === 'connected' ? 'On a call' : 'Up next') : 'Queued')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ls-mp">
            <div className="ls-mp-head"><span className="ls-mark">D</span><span className="ls-word">DIALERSEAT</span><span style={{ flex: 1 }} /><span className="ls-tag">POWER</span></div>
            <div className="ls-mp-body">
              <div className="ls-card">
                <div className="ls-label" style={{ color: labelColor }}>{label}</div>
                <div className="ls-name">{lead.name}</div>
                <div className="ls-phone">{lead.phone}</div>
              </div>
              {(stage === 'wrap' || stage === 'saved') && (
                <div className="ls-dispos">
                  {DISPOS.map(d => <span key={d} className={`ls-dispo${d === lead.result ? ' on' : ''}`}>{d}</span>)}
                  <span className="ls-dispo ls-skip">Skip</span>
                </div>
              )}
            </div>
            <div className="ls-mp-foot">
              {stage === 'ringing' || stage === 'connected' ? (
                <div className="ls-controls"><span className="ls-round"><Mic size={15} /></span><span className="ls-round"><Pause size={15} /></span><span className="ls-round ls-hang"><PhoneOff size={15} /></span></div>
              ) : (
                <span className="ls-call"><Phone size={14} /> {stage === 'wrap' ? 'SAVE AND DIAL NEXT' : 'CALL'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="ls-log">
        <div className="ls-log-head">your server · POST /webhooks/dialerseat</div>
        {log.length === 0 && <div className="ls-log-row ls-dim">Waiting for events…</div>}
        {log.map(e => (
          <div key={e.k} className="ls-log-row">
            <span className="ls-ok">200</span>
            <span className="ls-evt">{e.type}</span>
            <span className="ls-dim">{e.lead}</span>
            <span className="ls-dim" style={{ marginLeft: 'auto' }}>{e.ms}ms · signed</span>
          </div>
        ))}
      </div>

      <style>{`
        .ls { display: grid; gap: 12px; font-family: 'Futura PT', Futura, 'Trebuchet MS', sans-serif; }
        .ls-window { border-radius: 10px; overflow: hidden; border: 1px solid #23233b; background: #f0f1f4; }
        .ls-bar { height: 30px; display: flex; align-items: center; gap: 6px; padding: 0 10px; background: #e2e4ea; border-bottom: 1px solid #c4c8d0; }
        .ls-bar > span { width: 9px; height: 9px; border-radius: 50%; background: #c4c8d0; }
        .ls-url { margin-left: 10px; flex: 1; max-width: 260px; height: 18px; border-radius: 4px; background: #fff; color: #5a5e6a; font: 11px ui-monospace, Menlo, monospace; display: flex; align-items: center; padding: 0 8px; }
        .ls-body { display: grid; grid-template-columns: minmax(0, 1fr) 220px; min-height: 300px; }
        .ls-crm { padding: 14px; color: #1a1c24; }
        .ls-crm-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 10px; font-size: 14px; }
        .ls-crm-head span { font-size: 11px; color: #5a5e6a; }
        .ls-rows { display: grid; gap: 6px; }
        .ls-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #fff; border: 1px solid #d0d4d8; border-radius: 4px; transition: background .3s, border-color .3s; }
        .ls-row.on { border-color: #4a9eff; animation: ls-pulse 1.6s ease-in-out infinite; }
        .ls-avatar { width: 26px; height: 26px; border-radius: 50%; background: #1a1a2e; color: #fff; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ls-who { display: grid; min-width: 0; flex: 1; font-size: 12.5px; }
        .ls-who small { color: #5a5e6a; font-size: 11px; }
        .ls-status { font-size: 10.5px; letter-spacing: .3px; padding: 3px 7px; border-radius: 3px; background: #e2e4ea; color: #5a5e6a; white-space: nowrap; }
        .ls-status.done { background: rgba(26,106,26,.12); color: #1a6a1a; animation: ls-rise .35s ease-out; }
        .ls-mp { display: flex; flex-direction: column; background: #0a0a0f; color: #f0f0f5; border-left: 1px solid #23233b; }
        .ls-mp-head { display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: #1a1a2e; border-top: 2px solid #4a9eff; }
        .ls-mark { width: 18px; height: 18px; border-radius: 4px; background: #4a9eff; color: #fff; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
        .ls-word { font-size: 9.5px; letter-spacing: 2.5px; font-weight: 700; }
        .ls-tag { font-size: 9px; letter-spacing: 1px; font-weight: 600; color: #4a9eff; background: rgba(74,158,255,.16); padding: 2px 6px; border-radius: 3px; }
        .ls-mp-body { flex: 1; padding: 10px; display: grid; gap: 8px; align-content: start; }
        .ls-card { background: #111118; border: 1px solid #2a2a3e; border-radius: 4px; padding: 10px; }
        .ls-label { font-size: 9.5px; letter-spacing: 1.1px; font-weight: 600; transition: color .3s; }
        .ls-name { font-size: 16px; font-weight: 600; margin-top: 4px; }
        .ls-phone { font: 11.5px ui-monospace, Menlo, monospace; color: #949ba4; margin-top: 2px; }
        .ls-dispos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; animation: ls-rise .3s ease-out; }
        .ls-dispo { font-size: 10px; padding: 6px; border-radius: 4px; border: 1px solid #2a2a3e; background: #1a1c24; line-height: 1.2; }
        .ls-dispo.on { border-color: #4a9eff; background: rgba(74,158,255,.16); }
        .ls-skip { grid-column: 1 / -1; text-align: center; border-style: dashed; background: transparent; color: #949ba4; }
        .ls-mp-foot { padding: 10px; border-top: 1px solid #2a2a3e; background: #111118; }
        .ls-call { display: flex; align-items: center; justify-content: center; gap: 6px; height: 32px; border-radius: 4px; background: #4a9eff; color: #fff; font-size: 11px; font-weight: 600; letter-spacing: .6px; }
        .ls-controls { display: flex; justify-content: center; gap: 10px; }
        .ls-round { width: 32px; height: 32px; border-radius: 50%; background: #1a1c24; border: 1px solid #2a2a3e; display: inline-flex; align-items: center; justify-content: center; }
        .ls-hang { background: #dc2626; border-color: #dc2626; }
        .ls-log { border-radius: 10px; border: 1px solid #23233b; background: #05050a; padding: 10px 12px; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; min-height: 132px; }
        .ls-log-head { color: #6a6a88; margin-bottom: 6px; font-size: 11px; }
        .ls-log-row { display: flex; gap: 10px; align-items: center; padding: 3px 0; animation: ls-rise .3s ease-out; white-space: nowrap; overflow: hidden; }
        .ls-ok { color: #34d399; }
        .ls-evt { color: #7fb6ff; }
        .ls-dim { color: #6a6a88; }
        @keyframes ls-pulse { 0%, 100% { background: rgba(74,158,255,.06); } 50% { background: rgba(74,158,255,.16); } }
        @keyframes ls-rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @media (max-width: 560px) {
          .ls-body { grid-template-columns: minmax(0, 1fr); }
          .ls-mp { border-left: none; border-top: 1px solid #23233b; }
          .ls-log-row span:last-child { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { .ls-row.on, .ls-status.done, .ls-dispos, .ls-log-row { animation: none; } }
      `}</style>
    </div>
  )
}
