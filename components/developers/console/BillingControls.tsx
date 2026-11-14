'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, CreditCard, Mail, Plug, Sparkles, UserPlus, Wallet, Zap } from 'lucide-react'
import { SALES_EMAIL, type Tier } from '@/lib/developers/catalog'
import { CodeBlock, CopyButton, api, useToast } from '../ui'

interface P {
  id: string; name: string; website: string | null; tier: string
  live_status: string; live_requested_at: string | null; live_activated_at: string | null
  billing_model: 'user' | 'platform' | 'mixed'
  cut_model: 'seat_week' | 'revenue_share'
  rate_seat_week: number | null; rate_included_dials: number | null; rate_per_dial: number | null; revenue_share_pct: number | null
}
interface Bal { currency: string; due_cents: number; fees_cents: number; paid_cents: number; rate_not_set: number; customer_revenue_cents: number }
interface Row { id: string; kind: string; external_user_id: string | null; customer_amount_cents: number | null; fee_cents: number | null; currency: string; period_start: string | null; period_end: string | null; source: string; created_at: string }

const MODELS = [
  { id: 'platform', title: 'Platform-billed (default)', body: 'Your users pay you. You report each signup and renewal; DialerSeat bills you its cut. Your users never see a DialerSeat bill.' },
  { id: 'mixed', title: 'Mixed', body: 'Choose per seat with billed_to: report subscriptions for most seats, cover a few yourself.' },
  { id: 'user', title: 'User-billed', body: 'Each user pays DialerSeat directly by the week. Only for platforms that agree it with sales.' },
] as const

const cents = (n: number | null | undefined, cur = 'usd') => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase() }).format(n / 100))
const dollars = (n: number | null, digits = 2) => (n == null ? '—' : `$${Number(n).toFixed(digits)}`)
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const KIND: Record<string, string> = { signup: 'Signup', renewal: 'Renewal', refund: 'Refund', owner_payment: 'Your payment', adjustment: 'Adjustment' }

export function BillingControls({ env, apiBase, checkout, platform, balance, rows, stripe, email, tiers }: {
  env: 'test' | 'live'; apiBase: string; checkout: 'paid' | 'not_paid' | null
  platform: P; balance: Bal; rows: Row[]
  stripe: { token: string; has_secret: boolean; last_event_at: string | null } | null
  email: string | null; tiers: Tier[]
}) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [model, setModel] = useState(platform.billing_model)
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<'api' | 'stripe'>(stripe ? 'stripe' : 'api')
  const [secret, setSecret] = useState('')

  const mail = (subject: string, lines: string[]) =>
    `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
  const salesMail = mail(`Live dialing for ${platform.name}`, [
    `Project: ${platform.name}`, `Project id: ${platform.id}`, platform.website ? `Website: ${platform.website}` : 'Website:',
    email ? `Contact: ${email}` : 'Contact:', '', 'Dial modes our users need:', 'Expected seats:', 'Expected dials per seat per day:', 'When we want to go live:',
  ])

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try { await fn() } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong.') } finally { setBusy(null) }
  }
  const requestLive = () => run('live', async () => {
    await api('/api/developers/live', { method: 'POST' })
    window.location.href = salesMail
    toast('Request recorded. Your email to sales is open.'); router.refresh()
  })
  const saveModel = (m: P['billing_model']) => run('model', async () => {
    setModel(m)
    try { await api('/api/developers/platform', { method: 'PATCH', body: { billing_model: m } }); toast('Saved'); router.refresh() }
    catch (e) { setModel(platform.billing_model); throw e }
  })
  const simulate = () => run('sim', async () => {
    const r = await api<{ external_user_id: string }>('/api/developers/billing/simulate', { method: 'POST', body: { amount: 4900, interval: 'month' } })
    toast(`Recorded a $49.00 signup for ${r.external_user_id}. Its seat is active.`); router.refresh()
  })
  const makeStripe = () => run('stripe', async () => { await api('/api/developers/billing/stripe-source', { method: 'POST' }); router.refresh() })
  const saveSecret = () => run('secret', async () => {
    await api('/api/developers/billing/stripe-source', { method: 'PATCH', body: { signing_secret: secret } })
    setSecret(''); toast('Signing secret saved. Paid invoices now activate seats.'); router.refresh()
  })
  const pay = () => run('pay', async () => {
    const r = await api<{ url: string }>('/api/developers/billing/pay', { method: 'POST' })
    window.location.href = r.url
  })

  const stripeUrl = stripe ? `${apiBase}/billing/stripe/${stripe.token}` : ''
  const live = platform.live_status
  const cutLabel = platform.cut_model === 'revenue_share'
    ? (platform.revenue_share_pct == null ? 'Not set yet' : `${platform.revenue_share_pct}% of what each user pays you`)
    : (platform.rate_seat_week == null ? 'Not set yet' : `${dollars(platform.rate_seat_week)} per seat per week`)

  const apiExample = `curl ${apiBase}/subscriptions \\
  -H "Authorization: Bearer $DIALERSEAT_SECRET_KEY" \\
  -H "Idempotency-Key: invoice_8841" \\
  -H "Content-Type: application/json" \\
  -d '{
    "external_user_id": "usr_829",
    "email": "dana@acme.com",
    "name": "Dana Ruiz",
    "external_subscription_id": "sub_829",
    "amount": 4900,
    "currency": "usd",
    "interval": "month"
  }'`

  return (
    <div className="dv-stack">
      {checkout === 'paid' && <div className="dv-alert dv-alert-green"><Check size={16} color="var(--dv-green)" /> Payment received. Thank you. It is on your ledger below.</div>}
      {checkout === 'not_paid' && <div className="dv-alert dv-alert-amber">That checkout was not completed, so nothing was charged.</div>}

      <div className="dv-card">
        <div className="dv-card-head"><h2 className="dv-card-title">How billing works</h2></div>
        <div className="dv-card-body">
          <ol className="dv-flow">
            {[
              [UserPlus, 'A user pays you', 'Your checkout, your price, your billing system.'],
              [Plug, 'You tell DialerSeat', 'POST /v1/subscriptions, or forward your Stripe webhook.'],
              [Zap, 'Their seat dials', 'Created or renewed, active through the period paid for.'],
              [Wallet, 'Our cut, your balance', 'DialerSeat bills you, the owner. Never your user.'],
            ].map(([Icon, t, d], i) => {
              const I = Icon as typeof UserPlus
              return (
                <li key={i}>
                  <span className="dv-flow-n"><I size={16} /></span>
                  <span><strong style={{ display: 'block', fontSize: 14 }}>{t as string}</strong><span className="dv-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{d as string}</span></span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className="dv-grid-3" id="balance" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {[
          ['Amount due', env === 'live' ? cents(balance.due_cents, balance.currency) : cents(0), env === 'test' ? 'Test mode: nothing is owed' : 'DialerSeat\'s cut, less what you paid'],
          ['Your users paid you', cents(balance.customer_revenue_cents, balance.currency), 'Signups and renewals you reported'],
          ['DialerSeat\'s cut', cents(balance.fees_cents, balance.currency), 'On those payments'],
          ['Waiting for a rate', String(balance.rate_not_set), 'Recorded before sales set your rate'],
        ].map(([label, v, sub]) => (
          <div key={label} className="dv-card" style={{ padding: 16 }}>
            <div className="dv-dim" style={{ fontSize: 12.5 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6 }}>{v}</div>
            <div className="dv-dim" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="dv-card">
        <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div><h2 className="dv-card-title">Ledger</h2><p className="dv-card-desc">Every signup, renewal and payment in {env} mode, newest first.</p></div>
          <span style={{ display: 'flex', gap: 8 }}>
            {env === 'test' && <button type="button" className="dv-btn" onClick={simulate} disabled={!!busy}><Sparkles size={15} /> {busy === 'sim' ? 'Recording…' : 'Simulate a signup'}</button>}
            {env === 'live' && balance.due_cents >= 50 && <button type="button" className="dv-btn dv-btn-primary" onClick={pay} disabled={!!busy}><CreditCard size={15} /> {busy === 'pay' ? 'Opening…' : `Pay ${cents(balance.due_cents, balance.currency)}`}</button>}
          </span>
        </div>
        <div className="dv-card-body">
          {rows.length === 0 ? (
            <div className="dv-empty">Nothing yet. {env === 'test' ? 'Simulate a signup, or call POST /v1/subscriptions with a test key.' : 'Signups appear here as you report them.'}</div>
          ) : (
            <div className="dv-table-wrap">
              <table className="dv-table">
                <thead><tr><th>Date</th><th>Event</th><th>User</th><th>Paid period</th><th style={{ textAlign: 'right' }}>User paid you</th><th style={{ textAlign: 'right' }}>DialerSeat&apos;s cut</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td className="dv-muted" style={{ whiteSpace: 'nowrap' }}>{day(r.created_at)}</td>
                      <td><span className={`dv-badge ${r.kind === 'owner_payment' ? 'dv-badge-green' : r.kind === 'signup' ? 'dv-badge-blue' : ''}`}>{KIND[r.kind] || r.kind}</span> <span className="dv-dim" style={{ fontSize: 12 }}>{r.source === 'stripe' ? 'Stripe' : r.source === 'checkout' ? 'Card' : r.source === 'console' ? 'Simulated' : 'API'}</span></td>
                      <td className="dv-mono" style={{ fontSize: 12.5 }}>{r.external_user_id || '—'}</td>
                      <td className="dv-muted" style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{r.period_start ? `${day(r.period_start)} to ${day(r.period_end)}` : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{cents(r.customer_amount_cents, r.currency)}</td>
                      <td style={{ textAlign: 'right' }}>{r.kind !== 'owner_payment' && r.fee_cents == null ? <span className="dv-dim">Rate not set</span> : cents(r.fee_cents, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="dv-card" id="signups">
        <div className="dv-card-head"><h2 className="dv-card-title">Tell DialerSeat when a user pays you</h2><p className="dv-card-desc">Pick one. Both create or renew the seat and put DialerSeat&apos;s cut on your balance, once per payment.</p></div>
        <div className="dv-card-body">
          <div className="dv-seg" role="tablist" style={{ marginBottom: 16 }}>
            <button type="button" role="tab" aria-selected={tab === 'api'} onClick={() => setTab('api')}>From your code</button>
            <button type="button" role="tab" aria-selected={tab === 'stripe'} onClick={() => setTab('stripe')}>Forward your Stripe</button>
          </div>
          {tab === 'api' ? (
            <>
              <p className="dv-muted" style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 0 }}>Call this wherever your billing confirms a payment (a signup or each renewal). <code className="dv-inline-code">amount</code> is what the user paid you, in cents. Send <code className="dv-inline-code">interval</code> or the exact <code className="dv-inline-code">period_end</code>. The Idempotency-Key makes a retry safe.</p>
              <CodeBlock lang="bash" title="On your server, after a user pays you" code={apiExample} />
              <p className="dv-help">Cancellations: <code className="dv-inline-code">POST /v1/subscriptions/cancel</code> with the user or subscription id. The seat keeps its paid days, then stops.</p>
            </>
          ) : (
            <div className="dv-stack">
              <ol className="dv-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9 }}>
                <li>Make your endpoint URL here{env === 'test' ? ' (this one is for Stripe test mode)' : ' (this one is for Stripe live mode)'}.</li>
                <li>In your Stripe dashboard, open Workbench, then Webhooks, then <em>Create an event destination</em>. Choose <strong>Your account</strong>, payload <strong>Snapshot</strong>, events <code className="dv-inline-code">invoice.paid</code> and <code className="dv-inline-code">customer.subscription.deleted</code>, and paste the URL.</li>
                <li>Reveal the endpoint&apos;s signing secret (it starts with <code className="dv-inline-code">whsec_</code>) and paste it below.</li>
                <li>Optional: put <code className="dv-inline-code">dialerseat_user_id</code> in each subscription&apos;s metadata to use your own user id. Otherwise the Stripe customer id is the seat&apos;s id.</li>
              </ol>
              {!stripe ? (
                <button type="button" className="dv-btn dv-btn-primary" onClick={makeStripe} disabled={!!busy}><Plug size={15} /> {busy === 'stripe' ? 'Making…' : 'Make my Stripe endpoint URL'}</button>
              ) : (
                <>
                  <div>
                    <div className="dv-label">Endpoint URL for Stripe</div>
                    <div className="dv-inset" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 12px' }}>
                      <code style={{ flex: 1, fontSize: 12.5, overflowX: 'auto', whiteSpace: 'nowrap' }}>{stripeUrl}</code>
                      <CopyButton text={stripeUrl} label="Copy" />
                    </div>
                  </div>
                  <div>
                    <label className="dv-label" htmlFor="whsec">Signing secret {stripe.has_secret && <span className="dv-badge dv-badge-green" style={{ marginLeft: 6 }}>Saved</span>}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input id="whsec" className="dv-input" type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} placeholder={stripe.has_secret ? 'Paste a new one to replace it' : 'whsec_…'} />
                      <button type="button" className="dv-btn dv-btn-primary" onClick={saveSecret} disabled={!secret.trim() || !!busy}>Save</button>
                    </div>
                    <p className="dv-help">{stripe.last_event_at ? `Last event from Stripe: ${new Date(stripe.last_event_at).toLocaleString()}.` : 'No event from Stripe yet. Send a test event from Stripe once the secret is saved.'}</p>
                  </div>
                  <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={makeStripe} disabled={!!busy} style={{ alignSelf: 'flex-start' }}>Make a new URL (retires this one)</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dv-card" id="live" style={{ borderColor: live === 'active' ? 'color-mix(in srgb, var(--dv-green) 40%, transparent)' : undefined }}>
        <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 className="dv-card-title">Live dialing</h2>
            <p className="dv-card-desc">
              {live === 'active' && `Active since ${platform.live_activated_at ? new Date(platform.live_activated_at).toLocaleDateString() : 'activation'}. Live keys place real calls.`}
              {live === 'requested' && `Requested on ${platform.live_requested_at ? new Date(platform.live_requested_at).toLocaleDateString() : 'record'}. Sales will reply with your rate and switch it on. Everything keeps working in test mode meanwhile.`}
              {live === 'not_activated' && 'Off. Everything works in test mode: the API, webhooks, the miniplayer, billing events and every setting. Live keys refuse to dial until this is on.'}
              {live === 'past_due' && 'A balance is overdue. Pay it above to keep live dialing on.'}
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
              {live === 'not_activated' && <button type="button" className="dv-btn dv-btn-primary" onClick={requestLive} disabled={!!busy}><Zap size={15} /> {busy === 'live' ? 'Recording…' : 'Request live dialing'}</button>}
              <a className="dv-btn" href={salesMail}><Mail size={15} /> Email {SALES_EMAIL}</a>
            </div>
          )}
          <p className="dv-help" style={{ marginTop: 12 }}>Your rate follows the dial modes your users need and your volume, so it is set with sales. Once agreed, it appears below and live dialing is switched on.</p>
        </div>
      </div>

      <div className="dv-card" id="rates">
        <div className="dv-card-head"><h2 className="dv-card-title">DialerSeat&apos;s cut</h2><p className="dv-card-desc">Set with {SALES_EMAIL}. A dash means not agreed yet; signups recorded before then show &quot;rate not set&quot; and are not charged. Every rate is per week.</p></div>
        <div className="dv-card-body dv-grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {[
            ['How the cut is worked out', platform.cut_model === 'revenue_share' ? 'Share of revenue' : 'Per seat-week'],
            ['Your rate', cutLabel],
            ['Dials included per seat-week', platform.rate_included_dials == null ? '—' : platform.rate_included_dials.toLocaleString()],
            ['Per dial beyond that', dollars(platform.rate_per_dial, 4)],
          ].map(([label, v]) => (
            <div key={label} className="dv-inset" style={{ padding: 14 }}>
              <div className="dv-dim" style={{ fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="dv-card" id="model">
        <div className="dv-card-head"><h2 className="dv-card-title">Who pays for seats</h2><p className="dv-card-desc">Applies to new seats. A seat&apos;s own <code className="dv-inline-code">billed_to</code> decides it when the model is Mixed.</p></div>
        <div className="dv-card-body dv-grid-3">
          {MODELS.map(m => {
            const on = model === m.id
            return (
              <button key={m.id} type="button" onClick={() => saveModel(m.id)} aria-pressed={on} className="dv-inset"
                style={{ textAlign: 'left', padding: 16, cursor: 'pointer', color: 'inherit', font: 'inherit', borderColor: on ? 'var(--dv-accent)' : undefined, background: on ? 'var(--dv-accent-soft)' : undefined }}>
                <div className="dv-row" style={{ justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>{m.title}</span>{on && <Check size={16} color="var(--dv-accent)" />}</div>
                <div className="dv-muted" style={{ fontSize: 13, lineHeight: 1.55, marginTop: 6 }}>{m.body}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="dv-card" id="tiers">
        <div className="dv-card-head"><h2 className="dv-card-title">Tiers</h2><p className="dv-card-desc">You are on <strong style={{ color: 'var(--dv-text)', textTransform: 'capitalize' }}>{platform.tier}</strong>. Moving up is agreed with sales.</p></div>
        <div className="dv-card-body dv-grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {tiers.map(t => {
            const current = t.id === platform.tier
            return (
              <div key={t.id} className="dv-inset" style={{ padding: 16, borderColor: current ? 'var(--dv-accent)' : undefined }}>
                <div className="dv-row" style={{ justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>{t.name}</span>{current && <span className="dv-badge dv-badge-blue">Current</span>}</div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>{t.price}</div>
                <div className="dv-dim" style={{ fontSize: 12 }}>{t.priceNote}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 6, fontSize: 12.5 }} className="dv-muted">
                  {t.features.slice(0, 4).map(f => <li key={f} style={{ display: 'flex', gap: 6 }}><Check size={13} color="var(--dv-green)" style={{ flexShrink: 0, marginTop: 2 }} />{f}</li>)}
                </ul>
                {!current && t.cta === 'sales' && <a className="dv-btn dv-btn-sm" style={{ marginTop: 14, width: '100%' }} href={mail(`${t.name} tier for ${platform.name}`, [`Project id: ${platform.id}`, '', 'Dial modes our users need:', 'Expected seats:', 'Expected dials per seat per day:'])}>Talk to sales <ArrowRight size={13} /></a>}
              </div>
            )
          })}
        </div>
      </div>
      {toastNode}
      <style>{`
        .dv-flow { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .dv-flow li { display: flex; gap: 12px; align-items: flex-start; }
        .dv-flow-n { width: 32px; height: 32px; border-radius: 8px; background: var(--dv-accent-soft); color: var(--dv-accent); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        @media (max-width: 1000px) { .dv-flow, #balance, #rates .dv-grid-3, #tiers .dv-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
        @media (max-width: 600px) { .dv-flow, #balance, #rates .dv-grid-3, #tiers .dv-grid-3, #model .dv-grid-3 { grid-template-columns: minmax(0, 1fr) !important; } }
      `}</style>
    </div>
  )
}
