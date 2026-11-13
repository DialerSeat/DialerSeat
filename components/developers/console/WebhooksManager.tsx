'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Pause, Play, Plus, Send, Trash2 } from 'lucide-react'
import { WEBHOOK_EVENTS } from '@/lib/developers/catalog'
import type { WebhookEndpoint } from '@/lib/developers/store'
import { DevLink } from '../base'
import { CodeBlock, CopyButton, api, useToast } from '../ui'
import { Modal } from './KeysManager'

interface DeliveryView {
  id: string
  endpoint_id: string
  event_type: string
  status: string
  last_status_code: number | null
  last_error: string | null
  created_at: string
  payload: unknown
}

export function WebhooksManager({ endpoints, deliveries }: { endpoints: WebhookEndpoint[]; deliveries: DeliveryView[] }) {
  const router = useRouter()
  const { toast, toastNode } = useToast()
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')
  const [env, setEnv] = useState<'test' | 'live'>('test')
  const [all, setAll] = useState(true)
  const [events, setEvents] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const [testType, setTestType] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<DeliveryView | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WebhookEndpoint | null>(null)

  const add = async () => {
    setBusy('add')
    try {
      await api('/api/developers/webhooks', { method: 'POST', body: { url, description: desc, env, events: all ? ['*'] : events } })
      setAdding(false); setUrl(''); setDesc(''); setEvents([]); setAll(true)
      toast('Endpoint added')
      router.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not add the endpoint.') }
    finally { setBusy(null) }
  }

  const sendTest = async (ep: WebhookEndpoint) => {
    setBusy('test:' + ep.id)
    try {
      const r = await api<{ delivery: { status: string; last_status_code: number | null; last_error: string | null }; duration_ms: number }>(`/api/developers/webhooks/${ep.id}/test`, { method: 'POST', body: { type: testType[ep.id] || 'call.dispositioned' } })
      toast(r.delivery.status === 'delivered' ? `Delivered: HTTP ${r.delivery.last_status_code} in ${r.duration_ms} ms` : `Not delivered: ${r.delivery.last_error}`)
      router.refresh()
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not send.') }
    finally { setBusy(null) }
  }

  const toggle = async (ep: WebhookEndpoint) => {
    setBusy('toggle:' + ep.id)
    try { await api(`/api/developers/webhooks/${ep.id}`, { method: 'PATCH', body: { disabled: !ep.disabled_at } }); router.refresh() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not update.') }
    finally { setBusy(null) }
  }

  const remove = async (ep: WebhookEndpoint) => {
    setBusy('del:' + ep.id)
    try { await api(`/api/developers/webhooks/${ep.id}`, { method: 'DELETE' }); setConfirmDelete(null); toast('Endpoint deleted'); router.refresh() }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not delete.') }
    finally { setBusy(null) }
  }

  const urlOf = (id: string) => endpoints.find(e => e.id === id)?.url || 'deleted endpoint'

  return (
    <div className="dv-stack">
      <div className="dv-card" id="endpoints">
        <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 className="dv-card-title">Endpoints</h2>
            <p className="dv-card-desc">Up to 16. Test endpoints receive events from test keys; live endpoints from live keys.</p>
          </div>
          <button type="button" id="add" className="dv-btn dv-btn-primary dv-btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> Add endpoint</button>
        </div>
        <div className="dv-card-body dv-stack">
          {endpoints.length === 0 && (
            <div className="dv-empty">
              No endpoints yet. Add one, then press <strong>Send test event</strong> to check your signature verification against a real signed delivery.
            </div>
          )}
          {endpoints.map(ep => (
            <div key={ep.id} className="dv-inset" style={{ padding: 16, opacity: ep.disabled_at ? .65 : 1 }}>
              <div className="dv-row" style={{ flexWrap: 'wrap' }}>
                <code style={{ fontSize: 13.5, flex: 1, minWidth: 220, overflowWrap: 'anywhere' }}>{ep.url}</code>
                <span className={`dv-badge ${ep.env === 'live' ? 'dv-badge-blue' : ''}`}>{ep.env}</span>
                {ep.disabled_at ? <span className="dv-badge dv-badge-amber">Paused</span> : <span className="dv-badge dv-badge-green"><span className="dv-dot" />Enabled</span>}
              </div>
              {ep.description && <div className="dv-muted" style={{ fontSize: 13, marginTop: 6 }}>{ep.description}</div>}
              <div className="dv-dim" style={{ fontSize: 12.5, marginTop: 8 }}>
                Events: {ep.events.includes('*') ? 'all events' : ep.events.join(', ')}
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="dv-label">Signing secret</div>
                <div className="dv-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <code className="dv-inline-code" style={{ fontSize: 12.5, overflowWrap: 'anywhere', minWidth: 0 }}>{shown[ep.id] ? ep.signing_secret : 'whsec_' + '•'.repeat(18)}</code>
                  <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={() => setShown(s => ({ ...s, [ep.id]: !s[ep.id] }))} aria-label={shown[ep.id] ? 'Hide secret' : 'Reveal secret'}>{shown[ep.id] ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <CopyButton text={ep.signing_secret} />
                </div>
              </div>
              <div className="dv-row" style={{ marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
                <select className="dv-select" style={{ width: '100%', maxWidth: 240, flex: '1 1 180px', height: 34, fontSize: 13 }} value={testType[ep.id] || 'call.dispositioned'} onChange={e => setTestType(t => ({ ...t, [ep.id]: e.target.value }))} aria-label="Event to send">
                  {WEBHOOK_EVENTS.map(ev => <option key={ev.type} value={ev.type}>{ev.type}</option>)}
                </select>
                <button type="button" className="dv-btn dv-btn-sm" onClick={() => sendTest(ep)} disabled={busy === 'test:' + ep.id || !!ep.disabled_at}><Send size={13} /> {busy === 'test:' + ep.id ? 'Sending…' : 'Send test event'}</button>
                <span style={{ flex: 1 }} />
                <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={() => toggle(ep)} disabled={!!busy}>{ep.disabled_at ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}</button>
                <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm dv-btn-danger" onClick={() => setConfirmDelete(ep)}><Trash2 size={13} /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dv-card">
        <div className="dv-card-head"><h2 className="dv-card-title">Recent deliveries</h2><p className="dv-card-desc">The last 30 attempts across your endpoints. Click one to see exactly what was sent.</p></div>
        <div className="dv-card-body">
          {deliveries.length === 0 ? <div className="dv-empty">Nothing delivered yet.</div> : (
            <div className="dv-table-wrap">
              <table className="dv-table">
                <thead><tr><th>Event</th><th>Endpoint</th><th>Result</th><th style={{ textAlign: 'right' }}>When</th></tr></thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id} onClick={() => setOpen(d)} style={{ cursor: 'pointer' }}>
                      <td className="dv-mono" style={{ fontSize: 12.5 }}>{d.event_type}</td>
                      <td className="dv-dim" style={{ fontSize: 12.5, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{urlOf(d.endpoint_id)}</td>
                      <td>{d.status === 'delivered'
                        ? <span className="dv-badge dv-badge-green">{d.last_status_code}</span>
                        : <span className="dv-badge dv-badge-red" title={d.last_error || ''}>{d.last_status_code ?? 'failed'}</span>}</td>
                      <td className="dv-dim" style={{ textAlign: 'right' }}>{new Date(d.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="dv-card">
        <div className="dv-card-head"><h2 className="dv-card-title">Verify a delivery</h2><p className="dv-card-desc">Check the <code className="dv-inline-code">DialerSeat-Signature</code> header before trusting a body. <DevLink href="/docs/webhooks#verify" className="dv-link">Full guide</DevLink>.</p></div>
        <div className="dv-card-body">
          <CodeBlock lang="js" title="verify.js" code={"import crypto from 'node:crypto'\n\nexport function verify(rawBody, header, secret) {\n  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')))\n  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false\n  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))\n}"} />
        </div>
      </div>

      {adding && (
        <Modal title="Add an endpoint" onClose={() => setAdding(false)}>
          <div className="dv-stack">
            <div>
              <label className="dv-label" htmlFor="wurl">Endpoint URL</label>
              <input id="wurl" className="dv-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.yourcrm.com/webhooks/dialerseat" autoFocus />
              <p className="dv-help">Must be https. While building on your own machine, use a tunnel such as ngrok.</p>
            </div>
            <div>
              <label className="dv-label" htmlFor="wdesc">Description <span className="dv-dim">(optional)</span></label>
              <input id="wdesc" className="dv-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Production CRM sync" maxLength={120} />
            </div>
            <div>
              <span className="dv-label">Receives events from</span>
              <div className="dv-seg">
                <button type="button" aria-pressed={env === 'test'} onClick={() => setEnv('test')}>Test keys</button>
                <button type="button" aria-pressed={env === 'live'} onClick={() => setEnv('live')}>Live keys</button>
              </div>
            </div>
            <div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} style={{ accentColor: '#4a9eff' }} /> All events, including ones added later
              </label>
              {!all && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                  {WEBHOOK_EVENTS.map(ev => (
                    <label key={ev.type} title={ev.summary} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, fontFamily: 'var(--dv-mono)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={events.includes(ev.type)} onChange={e => setEvents(list => e.target.checked ? [...list, ev.type] : list.filter(x => x !== ev.type))} style={{ accentColor: '#4a9eff' }} />
                      {ev.type}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="dv-row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button type="button" className="dv-btn dv-btn-primary" onClick={add} disabled={busy === 'add' || !url.trim() || (!all && events.length === 0)}>{busy === 'add' ? 'Adding…' : 'Add endpoint'}</button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete this endpoint?" onClose={() => setConfirmDelete(null)}>
          <p className="dv-muted" style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            <code className="dv-inline-code" style={{ overflowWrap: 'anywhere' }}>{confirmDelete.url}</code> stops receiving events and its delivery history is removed. Pausing keeps both.
          </p>
          <div className="dv-row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button type="button" className="dv-btn dv-btn-danger" onClick={() => remove(confirmDelete)} disabled={!!busy}>Delete endpoint</button>
          </div>
        </Modal>
      )}

      {open && (
        <Modal title={open.event_type} onClose={() => setOpen(null)}>
          <div className="dv-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
            <span className={`dv-badge ${open.status === 'delivered' ? 'dv-badge-green' : 'dv-badge-red'}`}>{open.status}{open.last_status_code ? ` · HTTP ${open.last_status_code}` : ''}</span>
            {open.last_error && <span className="dv-dim" style={{ fontSize: 12.5 }}>{open.last_error}</span>}
          </div>
          <div style={{ maxHeight: 360, overflow: 'auto' }}><CodeBlock lang="json" title="body" code={JSON.stringify(open.payload, null, 2)} /></div>
        </Modal>
      )}
      {toastNode}
    </div>
  )
}
