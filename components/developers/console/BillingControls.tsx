'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Mail, Zap } from 'lucide-react'
import { SALES_EMAIL, type Tier } from '@/lib/developers/catalog'
import { api, useToast } from '../ui'

interface P {
  id: string; name: string; website: string | null; tier: string
  live_status: string; live_requested_at: string | null; live_activated_at: string | null
  billing_model: 'user' | 'platform' | 'mixed'
  rate_seat_week: number | null; rate_included_dials: number | null; rate_per_dial: number | null; revenue_share_pct: number | null
}

const MODELS = [
  { id: 'user', title: 'User-billed', body: 'Each user pays DialerSeat by the week inside the miniplayer. Your platform pays nothing for those seats.' },
  { id: 'platform', title: 'Platform-billed', body: 'You pay one weekly invoice for every active seat and their dials, at your negotiated rate. Charge your users whatever you like.' },
  { id: 'mixed', title: 'Mixed', body: 'Choose per seat with billed_to: cover your own team, let customers pay for theirs.' },
] as const

const money = (n: number | null, digits = 2) => (n == null ? '—' : `$${Number(n).toFixed(digits)}`)

export function BillingControls({ platform, email, tiers }: { platform: P; email: string | null; tiers: Tier[] }) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [model, setModel] = useState(platform.billing_model)
  const [busy, setBusy] = useState(false)

  const mail = (subject: string, lines: string[]) =>
    `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`

  const salesMail = mail(`Live dialing for ${platform.name}`, [
    `Platform: ${platform.name}`,
    `Platform id: ${platform.id}`,
    platform.website ? `Website: ${platform.website}` : 'Website:',
    email ? `Contact: ${email}` : 'Contact:',
    `Billing model: ${model}`,
    '',
    'Expected seats:',
    'Expected dials per seat per day:',
    'When we want to go live:',
  ])

  const requestLive = async () => {
    setBusy(true)
    try {
      await api('/api/developers/live', { method: 'POST' })
      window.location.href = salesMail
      toast('Request recorded. Your email to sales is open.')
      router.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not record the request.') }
    finally { setBusy(false) }
  }

  const saveModel = async (m: P['billing_model']) => {
    setModel(m)
    try { await api('/api/developers/platform', { method: 'PATCH', body: { billing_model: m } }); toast('Billing model saved'); router.refresh() }
    catch (e) { setModel(platform.billing_model); toast(e instanceof Error ? e.message : 'Could not save.') }
  }

  const live = platform.live_status
  return (
    <div className="dv-stack">
      <div className="dv-card" id="live" style={{ borderColor: live === 'active' ? 'rgba(52,211,153,.35)' : undefined }}>
        <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 className="dv-card-title">Live dialing</h2>
            <p className="dv-card-desc">
              {live === 'active' && `Active since ${platform.live_activated_at ? new Date(platform.live_activated_at).toLocaleDateString() : 'activation'}. Live keys place real calls.`}
              {live === 'requested' && `Requested on ${platform.live_requested_at ? new Date(platform.live_requested_at).toLocaleDateString() : 'record'}. Sales will reply with your rates and switch it on. Everything keeps working in test mode meanwhile.`}
              {live === 'not_activated' && 'Off. Everything works in test mode: the API, webhooks, the miniplayer and every setting. Live keys refuse to dial until this is on.'}
              {live === 'past_due' && 'A payment is due. Live dialing stops at the end of the paid days.'}
              {live === 'paused' && 'Paused. Live keys cannot dial until it is resumed.'}
            </p>
          </div>
          <span className={live === 'active' ? 'dv-badge dv-badge-green' : live === 'requested' ? 'dv-badge dv-badge-amber' : 'dv-badge'} style={{ alignSelf: 'flex-start' }}>
            <span className="dv-dot" />{live === 'active' ? 'Active' : live === 'requested' ? 'Requested' : live === 'not_activated' ? 'Not active' : live.replace('_', ' ')}
          </span>
        </div>
        <div className="dv-card-body">
          {live !== 'active' && (
            <div className="dv-row" style={{ flexWrap: 'wrap' }}>
              {live === 'not_activated' && <button type="button" className="dv-btn dv-btn-primary" onClick={requestLive} disabled={busy}><Zap size={15} /> {busy ? 'Recording…' : 'Request live dialing'}</button>}
              <a className="dv-btn" href={salesMail}><Mail size={15} /> Email {SALES_EMAIL}</a>
            </div>
          )}
          <p className="dv-help" style={{ marginTop: 12 }}>Rates are set with sales because they follow your volume. Once they are agreed, they appear below and live dialing is switched on for your platform.</p>
        </div>
      </div>

      <div className="dv-card" id="model">
        <div className="dv-card-head"><h2 className="dv-card-title">Who pays for seats</h2><p className="dv-card-desc">Applies to new seats. A seat&apos;s own <code className="dv-inline-code">billed_to</code> decides it when the model is Mixed.</p></div>
        <div className="dv-card-body dv-grid-3">
          {MODELS.map(m => {
            const on = model === m.id
            return (
              <button key={m.id} type="button" onClick={() => saveModel(m.id)} aria-pressed={on} className="dv-inset"
                style={{ textAlign: 'left', padding: 16, cursor: 'pointer', color: 'inherit', font: 'inherit', borderColor: on ? 'rgba(74,158,255,.6)' : undefined, background: on ? 'var(--dv-accent-soft)' : undefined }}>
                <div className="dv-row" style={{ justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>{m.title}</span>{on && <Check size={16} color="var(--dv-accent)" />}</div>
                <div className="dv-muted" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>{m.body}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="dv-card" id="rates">
        <div className="dv-card-head"><h2 className="dv-card-title">Your negotiated rates</h2><p className="dv-card-desc">Set with {SALES_EMAIL} on volume and leverage. A dash means not agreed yet. Every rate is per week; nothing here is billed by the month.</p></div>
        <div className="dv-card-body dv-grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {[
            ['Per seat, per week', money(platform.rate_seat_week)],
            ['Dials included per seat-week', platform.rate_included_dials == null ? '—' : platform.rate_included_dials.toLocaleString()],
            ['Per dial beyond that', money(platform.rate_per_dial, 4)],
            ['Revenue share on user-billed seats', platform.revenue_share_pct == null ? '—' : `${platform.revenue_share_pct}%`],
          ].map(([label, v]) => (
            <div key={label} className="dv-inset" style={{ padding: 14 }}>
              <div className="dv-dim" style={{ fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dv-card" id="tiers">
        <div className="dv-card-head"><h2 className="dv-card-title">Tiers</h2><p className="dv-card-desc">You are on <strong style={{ color: 'var(--dv-text)', textTransform: 'capitalize' }}>{platform.tier}</strong>. Moving up is agreed with sales.</p></div>
        <div className="dv-card-body dv-grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {tiers.map(t => {
            const current = t.id === platform.tier
            return (
              <div key={t.id} className="dv-inset" style={{ padding: 16, borderColor: current ? 'rgba(74,158,255,.6)' : undefined }}>
                <div className="dv-row" style={{ justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>{t.name}</span>{current && <span className="dv-badge dv-badge-blue">Current</span>}</div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>{t.price}</div>
                <div className="dv-dim" style={{ fontSize: 12 }}>{t.priceNote}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 6, fontSize: 12.5 }} className="dv-muted">
                  {t.features.slice(0, 4).map(f => <li key={f} style={{ display: 'flex', gap: 6 }}><Check size={13} color="var(--dv-green)" style={{ flexShrink: 0, marginTop: 2 }} />{f}</li>)}
                </ul>
                {!current && t.cta === 'sales' && <a className="dv-btn dv-btn-sm" style={{ marginTop: 14, width: '100%' }} href={mail(`${t.name} tier for ${platform.name}`, [`Platform id: ${platform.id}`, '', 'Expected seats:', 'Expected dials per seat per day:'])}>Talk to sales</a>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="dv-card">
        <div className="dv-card-head"><h2 className="dv-card-title">Invoices</h2></div>
        <div className="dv-card-body"><div className="dv-empty">No invoices. Platform-billed seats are invoiced weekly once live dialing is active.</div></div>
      </div>
      {toastNode}
      <style>{`@media (max-width: 1000px) { #rates .dv-grid-3, #tiers .dv-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (max-width: 600px) { #rates .dv-grid-3, #tiers .dv-grid-3, #model .dv-grid-3 { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  )
}
