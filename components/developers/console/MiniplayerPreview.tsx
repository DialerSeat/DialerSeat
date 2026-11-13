'use client'

import { useState } from 'react'
import { Mic, Pause, PhoneOff, SkipForward } from 'lucide-react'

// An illustration of the embedded panel so a platform can see what its users
// will get. It is clearly labelled as a preview on the page; the names below
// are placeholders, not records.

const DISPOSITIONS = ['Appointment set', 'Callback', 'Not interested', 'Voicemail', 'Wrong number', 'Do not call']

export function MiniplayerPreview() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div style={{ width: '100%', maxWidth: 380, borderRadius: 18, border: '1px solid var(--dv-border)', background: 'linear-gradient(180deg, #10101c, #0b0b14)', boxShadow: '0 30px 80px rgba(0,0,0,.5)', overflow: 'hidden' }}>
      <div className="dv-row" style={{ padding: '12px 14px', borderBottom: '1px solid var(--dv-border-soft)', justifyContent: 'space-between' }}>
        <span className="dv-row" style={{ gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg,#4a9eff,#2a6eff)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>D</span>
          <span style={{ fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>DIALERSEAT</span>
        </span>
        <span className="dv-badge dv-badge-blue">Power</span>
      </div>
      <div style={{ padding: 16 }}>
        <div className="dv-dim" style={{ fontSize: 11, letterSpacing: .5 }}>CONNECTED · 01:24</div>
        <div style={{ fontSize: 20, fontWeight: 600, marginTop: 6 }}>Sample Lead</div>
        <div className="dv-muted dv-mono" style={{ fontSize: 13, marginTop: 2 }}>(512) 555-0100 · Austin, TX</div>
        <div className="dv-inset" style={{ marginTop: 14, padding: 12, fontSize: 12.5, lineHeight: 1.6 }}>
          <div className="dv-dim" style={{ fontSize: 10.5, letterSpacing: .6, marginBottom: 4 }}>SCRIPT</div>
          Hi, this is your agent calling about the quote you asked for…
        </div>
        <div className="dv-row" style={{ justifyContent: 'center', gap: 10, margin: '18px 0' }}>
          {[Mic, Pause, SkipForward].map((I, i) => (
            <span key={i} style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--dv-panel-2)', border: '1px solid var(--dv-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><I size={17} color="var(--dv-muted)" /></span>
          ))}
          <span style={{ width: 42, height: 42, borderRadius: '50%', background: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><PhoneOff size={17} color="#fff" /></span>
        </div>
        <div className="dv-dim" style={{ fontSize: 10.5, letterSpacing: .6, marginBottom: 8 }}>YOUR DISPOSITIONS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {DISPOSITIONS.map(d => (
            <button key={d} type="button" onClick={() => setPicked(d)} className="dv-btn dv-btn-sm" style={{ justifyContent: 'flex-start', background: picked === d ? 'var(--dv-accent-soft)' : undefined, borderColor: picked === d ? 'rgba(74,158,255,.5)' : undefined }}>{d}</button>
          ))}
        </div>
      </div>
      <div className="dv-dim" style={{ padding: '10px 14px', borderTop: '1px solid var(--dv-border-soft)', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
        <span>Queue: next lead ready</span><span>Embedded in your app</span>
      </div>
    </div>
  )
}
