'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// INCENTIVES — the seat rate an admin agreed, typed in
// =============================================================================
// Above fifty seats the volume tier is deliberately negotiated rather than
// printed, so a rate is never promised that sales has not agreed. The gap was
// that nothing could then honour the agreed number: sales says 30%, billing
// charges the published rate, and somebody has to remember to fix it by hand
// in the Stripe dashboard — where it leaves no record inside the product of
// who agreed what, or when.
//
// THE BEST RATE WINS, ALWAYS. A number typed here competes with the volume
// tier and any account comp rather than replacing them. Typing 20% against an
// owner whose seats already earn 25% changes nothing, and this screen says so
// rather than letting somebody believe it applied. Using the word "override"
// to make a customer worse off than the published rate is not a thing anybody
// should be able to do by filling in a box.
//
// APPLIED ON SAVE. Every live seat subscription for that owner is re-synced
// immediately rather than waiting for the nightly pass, because the person
// typing this is usually on the phone with the customer.
// =============================================================================

const T = {
  bg: '#0d0f13',
  panel: '#14161c',
  raised: '#1b1e25',
  line: '#242833',
  text: '#e8e9ee',
  muted: '#8b90a3',
  dim: '#5e6478',
  accent: '#4a9eff',
  green: '#4ade80',
  amber: '#fbbf24',
}

interface Owner {
  clerkId: string
  email: string | null
  name: string | null
  fundedSeats: number
  earnedPercentOff: number
  tierLabel: string | null
  overridePct: number | null
  note: string | null
  setAt: string | null
  setBy: string | null
  exempt: boolean
}

const WEEKLY_CENTS = 3500

function weekly(percentOff: number): string {
  const cents = Math.round(WEEKLY_CENTS * (1 - percentOff / 100))
  return `$${(cents / 100).toFixed(2)}`
}

export default function Incentives() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  // Keyed by clerkId so two rows being edited never share a draft.
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/seat-discount').then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not load owners')
      setOwners(r.owners || [])
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Could not load owners')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async (clerkId: string, percentOff: number | null) => {
    setBusy(clerkId)
    setResult(null)
    try {
      const r = await fetch('/api/admin/seat-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId, percentOff, note: notes[clerkId] || null }),
      }).then(x => x.json())

      if (!r.success) {
        setResult(r.error || 'That did not save.')
      } else {
        setResult(
          `${r.email || clerkId}: ${r.note}` +
          (r.subscriptionsUpdated
            ? ` ${r.subscriptionsUpdated} of ${r.subscriptionsChecked} subscriptions updated.`
            : '')
        )
        setDrafts(d => { const n = { ...d }; delete n[clerkId]; return n })
        await load()
      }
    } catch (e: any) {
      setResult(e?.message || 'That did not save.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 20, color: T.muted, fontSize: 13 }}>Loading owners…</div>
  }

  return (
    <div style={{
      padding: 18, background: T.bg, color: T.text, minHeight: '100%',
      fontFamily: "'Futura PT', Futura, sans-serif", fontSize: 13,
    }}>
      <div style={{ marginBottom: 4, fontSize: 15, fontWeight: 700, letterSpacing: 0.4 }}>
        Seat discounts
      </div>
      <p style={{ margin: '0 0 16px', color: T.muted, fontSize: 12, lineHeight: 1.7, maxWidth: 720 }}>
        A rate you agreed by hand, per owner, applied to every seat they pay for.
        It competes with the volume tier rather than replacing it — <strong style={{ color: T.text }}>the
        best rate always wins</strong>, so setting a low number can never make somebody
        worse off than what they earned. Saving pushes it to Stripe immediately.
      </p>

      {error && (
        <div style={{
          background: '#2a1416', border: '1px solid #7f1d1d', color: '#fecaca',
          borderRadius: 4, padding: '10px 12px', marginBottom: 14, fontSize: 12,
        }}>{error}</div>
      )}

      {result && (
        <div style={{
          background: T.raised, border: `1px solid ${T.line}`, color: T.text,
          borderRadius: 4, padding: '10px 12px', marginBottom: 14, fontSize: 12, lineHeight: 1.6,
        }}>{result}</div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {owners.length === 0 && (
          <div style={{ color: T.dim, fontSize: 12 }}>Nobody owns a team yet.</div>
        )}

        {owners.map(o => {
          const draft = drafts[o.clerkId] ?? (o.overridePct === null ? '' : String(o.overridePct))
          const parsed = draft.trim() === '' ? null : Number(draft)
          const valid = parsed === null || (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100)
          const changed = draft !== (o.overridePct === null ? '' : String(o.overridePct))
          // What they would actually be charged: the best of what they typed
          // and what the owner already earns.
          const effective = Math.max(o.earnedPercentOff, valid && parsed !== null ? parsed : 0)

          return (
            <div key={o.clerkId} style={{
              background: T.panel, border: `1px solid ${o.overridePct !== null ? T.accent : T.line}`,
              borderRadius: 5, padding: '12px 14px',
              display: 'grid', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600 }}>{o.name || o.email}</span>
                <span style={{ color: T.dim, fontSize: 11.5 }}>{o.email}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: T.muted, fontSize: 11.5 }}>
                  {o.fundedSeats} funded {o.fundedSeats === 1 ? 'seat' : 'seats'}
                  {o.tierLabel ? ` · ${o.tierLabel}` : ''}
                  {o.earnedPercentOff > 0 ? ` · earns ${o.earnedPercentOff}%` : ''}
                </span>
              </div>

              {o.exempt && (
                <div style={{ color: T.amber, fontSize: 11.5 }}>
                  Billing exempt — every seat this owner opens invoices $0.00 regardless
                  of anything set here.
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={draft}
                  onChange={e => setDrafts(d => ({ ...d, [o.clerkId]: e.target.value }))}
                  placeholder="—"
                  inputMode="numeric"
                  style={{
                    width: 72, background: T.raised, color: T.text,
                    border: `1px solid ${valid ? T.line : '#7f1d1d'}`,
                    borderRadius: 3, padding: '7px 9px', fontSize: 13, fontFamily: 'inherit',
                    textAlign: 'right',
                  }}
                />
                <span style={{ color: T.muted, fontSize: 12 }}>% off</span>

                <span style={{ color: T.dim, fontSize: 12, marginLeft: 4 }}>
                  → <strong style={{ color: effective > 0 ? T.green : T.text }}>
                    {weekly(effective)}
                  </strong> a week
                  {effective > (valid && parsed !== null ? parsed : 0) && (
                    <span style={{ color: T.amber }}> (their earned rate is better)</span>
                  )}
                </span>

                <span style={{ flex: 1 }} />

                <input
                  value={notes[o.clerkId] ?? (o.note || '')}
                  onChange={e => setNotes(n => ({ ...n, [o.clerkId]: e.target.value }))}
                  placeholder="Why — who agreed it"
                  style={{
                    flex: '1 1 220px', minWidth: 160, background: T.raised, color: T.text,
                    border: `1px solid ${T.line}`, borderRadius: 3,
                    padding: '7px 9px', fontSize: 12, fontFamily: 'inherit',
                  }}
                />

                <button
                  onClick={() => save(o.clerkId, parsed)}
                  disabled={!valid || busy === o.clerkId || !changed}
                  style={{
                    background: !valid || !changed ? T.raised : T.accent,
                    color: !valid || !changed ? T.dim : '#06080c',
                    border: 'none', borderRadius: 3, padding: '7px 14px',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    cursor: !valid || !changed ? 'not-allowed' : 'pointer',
                  }}
                >{busy === o.clerkId ? 'Saving…' : 'Save'}</button>

                {o.overridePct !== null && (
                  <button
                    onClick={() => save(o.clerkId, null)}
                    disabled={busy === o.clerkId}
                    style={{
                      background: 'transparent', color: T.muted,
                      border: `1px solid ${T.line}`, borderRadius: 3,
                      padding: '7px 12px', fontSize: 12, fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >Clear</button>
                )}
              </div>

              {o.setAt && (
                <div style={{ color: T.dim, fontSize: 11 }}>
                  Set {new Date(o.setAt).toLocaleString()}
                  {o.setBy ? ` by ${o.setBy}` : ''}
                  {o.note ? ` — ${o.note}` : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
