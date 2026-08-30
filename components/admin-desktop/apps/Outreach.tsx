'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// Outreach — the list, and the people who said no
// =============================================================================
// This app does not send. Every transactional provider (Resend, SendGrid,
// Mailgun, SES) bans cold email in their terms, so sending belongs to a tool
// built for it, pointed at mailboxes on a domain that is not dialerseat.com.
//
// What lives here is the half that has to outlive that choice: the list, the
// suppression record, and the unsubscribe links. Export a batch, send it
// elsewhere, and every opt-out still lands back in this database — so changing
// sending tools can never resurrect someone who already opted out.
// =============================================================================

const FONT = 'Futura PT, Futura, sans-serif'
const GREEN = '#1a6a1a'
const RED = '#8a1a1a'
const AMBER = '#8a6a1a'

interface Contact {
  id: string
  email: string
  name: string | null
  company: string | null
  source: string | null
  status: 'new' | 'sent' | 'replied' | 'bounced' | 'unsubscribed'
  times_sent: number
  last_sent_at: string | null
  created_at: string
}

interface Stats {
  total: number; new: number; sent: number
  unsubscribed: number; bounced: number; suppressed: number
}

interface ImportReport {
  parsed: number; imported: number; duplicates: number; suppressed: number
  roleAccounts: number; invalid: number; unreadable: number
  samples: { unreadable?: string[]; roleAccounts?: string[]; invalid?: string[] }
}

const STATUS_COLOR: Record<Contact['status'], string> = {
  new: 'var(--brand-primary)',
  sent: AMBER,
  replied: GREEN,
  bounced: RED,
  unsubscribed: RED,
}

export default function OutreachApp() {
  const [tab, setTab] = useState<'list' | 'import' | 'suppress'>('list')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const [pasteText, setPasteText] = useState('')
  const [source, setSource] = useState('')
  const [keepRoleAccounts, setKeepRoleAccounts] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)

  const [supText, setSupText] = useState('')
  const [supReason, setSupReason] = useState('manual')
  const [supResult, setSupResult] = useState<string | null>(null)

  const reload = useCallback(() => setReloadTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams({ status, q: search })
    fetch(`/api/admin/outreach?${qs}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (!j.ok) { setError(j.error || 'Could not load'); return }
        setError(null)
        setContacts(j.contacts)
        setStats(j.stats)
        setTruncated(j.truncated)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load')
      })
    return () => { cancelled = true }
  }, [status, search, reloadTick])

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || 'Failed')
    return json
  }

  const runImport = async () => {
    if (!pasteText.trim()) return
    setBusy(true); setError(null); setReport(null)
    try {
      const j = await post({ action: 'import', text: pasteText, source, keepRoleAccounts })
      setReport(j.report)
      setPasteText('')
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally { setBusy(false) }
  }

  const runSuppress = async () => {
    if (!supText.trim()) return
    setBusy(true); setError(null); setSupResult(null)
    try {
      const j = await post({ action: 'suppress', text: supText, reason: supReason })
      setSupResult(`${j.added} added to suppression (${j.submitted} submitted).`)
      setSupText('')
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppress failed')
    } finally { setBusy(false) }
  }

  const download = (scope: 'new' | 'all') => {
    const a = document.createElement('a')
    a.href = `/api/admin/outreach/export?scope=${scope}`
    a.download = ''
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto', fontFamily: FONT,
      background: 'var(--brand-page-bg)', color: 'var(--brand-on-page-bg)',
      padding: '18px 20px 28px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: 'var(--brand-primary)' }}>
        OUTREACH
      </div>
      <div style={{ fontSize: 10, letterSpacing: 1.4, color: 'var(--brand-muted-text)', marginTop: 4 }}>
        The list and the opt-outs. Sending happens elsewhere — see the note below.
      </div>

      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: 8, margin: '16px 0 14px',
        }}>
          <Stat label="TOTAL" value={stats.total} />
          <Stat label="NEVER SENT" value={stats.new} tone="var(--brand-primary)" />
          <Stat label="SENT" value={stats.sent} tone={AMBER} />
          <Stat label="UNSUBSCRIBED" value={stats.unsubscribed} tone={RED} />
          <Stat label="BOUNCED" value={stats.bounced} tone={RED} />
          <Stat label="SUPPRESSED" value={stats.suppressed} tone={RED} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['list', 'import', 'suppress'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
            {t === 'suppress' ? 'suppression' : t}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => download('new')} style={btn}>⤓ EXPORT NEVER-SENT</button>
        <button onClick={() => download('all')} style={btn}>⤓ EXPORT ALL MAILABLE</button>
      </div>

      {error && <Banner tone={RED}>{error}</Banner>}

      {tab === 'import' && (
        <>
          <P>
            Paste anything — one per line, comma or semicolon separated,
            <code> Name &lt;bob@x.com&gt;</code>, or a CSV column order it can find
            the address in. Role accounts (info@, sales@, support@) are dropped by
            default: several people read them, none of them asked to, and they are
            where complaints come from.
          </P>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={'bob@acme.com\nJane Smith <jane@widgets.io>\nsam@foo.co, Sam Lee, Foo Ltd'}
            style={{ ...field, minHeight: 190, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <input
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="where it came from (e.g. apollo-jan, conference list)"
              style={{ ...field, flex: '1 1 240px', minHeight: 0 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <input type="checkbox" checked={keepRoleAccounts}
                     onChange={e => setKeepRoleAccounts(e.target.checked)} />
              keep role accounts
            </label>
            <button onClick={() => void runImport()} disabled={busy || !pasteText.trim()}
                    style={{ ...btn, opacity: busy || !pasteText.trim() ? 0.4 : 1 }}>
              {busy ? 'IMPORTING…' : 'IMPORT'}
            </button>
          </div>

          {report && (
            <div style={{
              marginTop: 14, padding: '12px 14px', borderRadius: 4,
              background: 'var(--brand-card-surface)', fontSize: 11.5, lineHeight: 1.9,
            }}>
              <div style={{ fontWeight: 'bold', letterSpacing: 2, fontSize: 10, marginBottom: 6 }}>
                IMPORT REPORT
              </div>
              <Line k="Imported" v={report.imported} tone={GREEN} />
              <Line k="Already on the list" v={report.duplicates} />
              <Line k="Held back — already opted out" v={report.suppressed} tone={report.suppressed ? RED : undefined} />
              <Line k="Role accounts skipped" v={report.roleAccounts} tone={report.roleAccounts ? AMBER : undefined} />
              <Line k="Invalid addresses" v={report.invalid} tone={report.invalid ? AMBER : undefined} />
              <Line k="Lines it could not read" v={report.unreadable} tone={report.unreadable ? AMBER : undefined} />
              {!!report.samples?.unreadable?.length && (
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--brand-muted-text)' }}>
                  e.g. {report.samples.unreadable.slice(0, 3).map(s => `"${s}"`).join(', ')}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'suppress' && (
        <>
          <P>
            Paste addresses that must never be mailed again — replies asking to
            stop, and every bounce your sending tool reports back. Suppression is
            keyed by address and has no expiry: it survives deleting the contact,
            wiping the list, and changing sending tools.
          </P>
          <textarea
            value={supText}
            onChange={e => setSupText(e.target.value)}
            placeholder={'bob@acme.com\njane@widgets.io'}
            style={{ ...field, minHeight: 150, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11.5 }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <select value={supReason} onChange={e => setSupReason(e.target.value)}
                    style={{ ...field, minHeight: 0, flex: '0 0 auto', padding: '8px 10px' }}>
              <option value="manual">asked to stop</option>
              <option value="bounced">bounced</option>
              <option value="complained">marked as spam</option>
              <option value="role_account">role account</option>
            </select>
            <button onClick={() => void runSuppress()} disabled={busy || !supText.trim()}
                    style={{ ...btn, opacity: busy || !supText.trim() ? 0.4 : 1 }}>
              {busy ? 'SAVING…' : 'SUPPRESS'}
            </button>
          </div>
          {supResult && <Banner tone={GREEN}>{supResult}</Banner>}
        </>
      )}

      {tab === 'list' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
                   placeholder="search email…"
                   style={{ ...field, flex: '1 1 200px', minHeight: 0 }} />
            <select value={status} onChange={e => setStatus(e.target.value)}
                    style={{ ...field, minHeight: 0, flex: '0 0 auto', padding: '8px 10px' }}>
              <option value="all">all</option>
              <option value="new">never sent</option>
              <option value="sent">sent</option>
              <option value="replied">replied</option>
              <option value="bounced">bounced</option>
              <option value="unsubscribed">unsubscribed</option>
            </select>
          </div>

          {truncated && (
            <Banner tone={AMBER}>Showing the first 2,000. Narrow with search or a status filter.</Banner>
          )}

          {contacts.length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--brand-muted-text)', padding: '18px 0' }}>
              Nothing here yet. Paste a list into the Import tab.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--brand-muted-text)', fontSize: 9.5, letterSpacing: 1.4 }}>
                    <th style={th}>EMAIL</th><th style={th}>NAME</th><th style={th}>COMPANY</th>
                    <th style={th}>SOURCE</th><th style={th}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c => (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--brand-card-surface)' }}>
                      <td style={td}>{c.email}</td>
                      <td style={td}>{c.name || '—'}</td>
                      <td style={td}>{c.company || '—'}</td>
                      <td style={{ ...td, color: 'var(--brand-muted-text)' }}>{c.source || '—'}</td>
                      <td style={{ ...td, color: STATUS_COLOR[c.status], letterSpacing: 1, fontSize: 10 }}>
                        {c.status.toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* The constraint that shaped this app, written down where it will be
          read — because the obvious next step is to wire a send button here,
          and that is the one thing that must not happen. */}
      <div style={{
        marginTop: 26, padding: '12px 14px', borderRadius: 4,
        background: 'var(--brand-card-surface)',
        fontSize: 10.5, lineHeight: 1.75, color: 'var(--brand-muted-text)',
      }}>
        <strong style={{ color: 'var(--brand-on-page-bg)' }}>Why there is no send button.</strong>{' '}
        Resend, SendGrid, Mailgun and SES all prohibit cold email in their terms
        — sending through one gets the account terminated, and if that account is
        also the product&apos;s email, password resets and receipts go down with it.
        Send from a tool whose terms permit it, using mailboxes on a domain that
        is not dialerseat.com.
        <br /><br />
        Put the <code>unsubscribe_url</code> column from the export into the
        <code> List-Unsubscribe</code> header, add{' '}
        <code>List-Unsubscribe-Post: List-Unsubscribe=One-Click</code>, and use the
        same URL as the visible footer link. Opt-outs then land back here no
        matter which tool sent the message.
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  padding: '7px 13px', cursor: 'pointer', fontFamily: FONT,
  fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase',
  background: 'transparent', color: 'var(--brand-primary)',
  border: '1px solid var(--brand-primary)', borderRadius: 3,
}

const tabBtn = (on: boolean): React.CSSProperties => ({
  ...btn,
  background: on ? 'var(--brand-primary)' : 'transparent',
  color: on ? 'var(--brand-page-bg)' : 'var(--brand-primary)',
})

const field: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontFamily: FONT, fontSize: 12,
  background: 'var(--brand-card-surface)', color: 'var(--brand-on-page-bg)',
  border: '1px solid var(--brand-muted-text)', borderRadius: 3,
}

const th: React.CSSProperties = { padding: '6px 8px', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '7px 8px', whiteSpace: 'nowrap' }

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div style={{ background: 'var(--brand-card-surface)', borderRadius: 4, padding: '9px 10px' }}>
      <div style={{
        fontSize: 19, fontWeight: 'bold', lineHeight: 1,
        color: tone ?? 'var(--brand-on-page-bg)', fontVariantNumeric: 'tabular-nums',
      }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 8.5, letterSpacing: 1.3, color: 'var(--brand-muted-text)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function Line({ k, v, tone }: { k: string; v: number; tone?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--brand-muted-text)' }}>{k}</span>
      <span style={{ color: tone ?? 'var(--brand-on-page-bg)', fontVariantNumeric: 'tabular-nums' }}>
        {v.toLocaleString()}
      </span>
    </div>
  )
}

function Banner({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '9px 12px', margin: '10px 0', borderRadius: 3,
      border: `1px solid ${tone}`, color: tone, fontSize: 11, letterSpacing: 0.3,
    }}>{children}</div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11.5, lineHeight: 1.7, color: 'var(--brand-muted-text)', marginBottom: 10,
    }}>{children}</div>
  )
}
