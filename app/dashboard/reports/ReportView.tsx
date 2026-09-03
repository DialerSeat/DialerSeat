'use client'

import { useEffect, useState, useCallback } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// THE STATEMENT
//
// Printed on white, always. This is the one screen in DialerSeat that exists to
// leave DialerSeat — it goes to an accountant, into a folder, through a
// printer — and a dark dashboard theme rendered to PDF is either unreadable or
// a solid black page that empties a toner cartridge.
//
// Everything on it is a figure the server confirmed. Where a figure could not
// be confirmed against Stripe it says so rather than presenting it with the
// same confidence as the ones that were.
// ─────────────────────────────────────────────────────────────────────────

const INK = '#111318'
const SOFT = '#5b6270'
const RULE = '#d8dce3'
const BRAND = '#2a6eff'

function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ', '
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ', '
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

/** The same mark as the sidebar: gradient tile, white D, spaced wordmark. */
function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>D</span>
      </div>
      <span style={{
        fontSize: 14, fontWeight: 'bold', letterSpacing: 4, color: INK,
      }}>DIALERSEAT</span>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="row-pair" style={{
      display: 'flex', justifyContent: 'space-between', gap: 20,
      padding: '7px 0', borderBottom: `1px solid ${RULE}`,
      fontSize: 13,
    }}>
      <span style={{ color: SOFT }}>{label}</span>
      <span style={{ color: INK, fontWeight: strong ? 700 : 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase',
      color: SOFT, fontWeight: 700, margin: '28px 0 10px',
    }}>{children}</h2>
  )
}

export default function ReportView({ period }: { period: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [legalName, setLegalName] = useState('')
  const [address, setAddress] = useState('')
  const [reference, setReference] = useState('')
  const [savingId, setSavingId] = useState(false)
  const [idError, setIdError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/reports/seat-report?period=${encodeURIComponent(period)}`)
        .then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not build this statement')
      setData(r)
      setLegalName(r.account?.legalName || '')
      setAddress(r.account?.address || '')
      setReference(r.account?.reference || '')
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Could not build this statement')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { void load() }, [load])

  const saveIdentity = async () => {
    setSavingId(true)
    setIdError(null)
    try {
      const r = await fetch('/api/reports/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legalName, address, reference }),
      }).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not save')
      await load()
    } catch (e: any) {
      setIdError(e.message || 'Could not save')
    } finally {
      setSavingId(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 40, color: SOFT, fontSize: 14 }}>Building statement…</div>
  }
  if (error || !data) {
    return <div style={{ padding: 40, color: '#c0392b', fontSize: 14 }}>{error}</div>
  }

  const b = data.billing
  const prev = data.previous
  const delta = (now: number, before: number | null | undefined) => {
    if (before === null || before === undefined) return null
    if (before === 0) return now === 0 ? null : { pct: null, dir: 'up' as const }
    const pct = Math.round(((now - before) / before) * 1000) / 10
    return { pct, dir: pct >= 0 ? ('up' as const) : ('down' as const) }
  }
  const spendDelta = delta(b.paidCents, prev?.paidCents)
  const seatDelta = delta(b.distinctSeats, prev?.seatCount)

  return (
    <div style={{
      background: '#ffffff', color: INK, minHeight: '100vh',
      fontFamily: "'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      <style>{`
        @media print {
          /* Controls are for the screen. A printed statement with a "Download
             PDF" button on it looks like a screenshot of a website, which is
             exactly what it must not look like. */
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
          /* Never split a table row or a section heading across a page break. */
          tr, .keep { break-inside: avoid; page-break-inside: avoid; }
          h2 { break-after: avoid; page-break-after: avoid; }
        }
        @page { margin: 16mm; }
        .rt th { text-align: left; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: ${SOFT}; font-weight: 700; padding: 6px 8px; border-bottom: 1.5px solid ${RULE}; }
        .rt td { font-size: 12px; padding: 7px 8px; border-bottom: 1px solid ${RULE}; color: ${INK}; }
        .rt td.num, .rt th.num { text-align: right; font-variant-numeric: tabular-nums; }
        .idf { font-size: 13px; padding: 8px 10px; border: 1px solid ${RULE}; border-radius: 4px; width: 100%; font-family: inherit; color: ${INK}; }
        .idf:focus { outline: none; border-color: ${BRAND}; }

        /* ── MOBILE ────────────────────────────────────────────────────────
           A statement gets opened on a phone more often than anywhere else 
           somebody forwarding it to their accountant from the car. The charge
           table is the only thing here that cannot simply reflow, so it scrolls
           inside its own box rather than pushing the whole page sideways: a
           document you have to pan horizontally to read is one people give up
           on. */
        @media (max-width: 640px) {
          .sheet { padding: 20px 14px 48px !important; }
          .rt th, .rt td { padding: 6px 6px; font-size: 11px; }
          .rt { min-width: 560px; }
          .rt-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .hdr { flex-direction: column; align-items: flex-start !important; }
          .hdr-right { text-align: left !important; }
          .row-pair { flex-direction: column; gap: 2px !important; }
          .row-pair span:last-child { text-align: left !important; }
        }
      `}</style>

      {/* ── SCREEN-ONLY CONTROLS ─────────────────────────────────────────── */}
      <div className="no-print" style={{
        borderBottom: `1px solid ${RULE}`, padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        position: 'sticky', top: 0, background: '#fff', zIndex: 10,
      }}>
        <strong style={{ fontSize: 14 }}>{data.periodLabel} statement</strong>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => window.print()}
          style={{
            background: BRAND, color: '#fff', border: 'none', borderRadius: 4,
            padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >Download PDF</button>
      </div>

      {/* ── ADDRESSING ───────────────────────────────────────────────────── */}
      <div className="no-print" style={{
        maxWidth: 820, margin: '18px auto 0', padding: '0 20px',
      }}>
        <div style={{
          border: `1px solid ${RULE}`, borderRadius: 6, padding: '14px 16px',
          background: '#f7f8fa',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
            Who is this statement for?
          </div>
          <div style={{ fontSize: 12, color: SOFT, marginBottom: 12, lineHeight: 1.6 }}>
            If the seats were bought by a company, put the company&apos;s legal name
            here, a deduction belongs to the entity that incurred the expense.
            Saved once and used on every statement.
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              className="idf"
              placeholder="Legal or business name"
              value={legalName}
              onChange={e => setLegalName(e.target.value)}
            />
            <textarea
              className="idf"
              placeholder="Business address (optional)"
              rows={2}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
            <input
              className="idf"
              placeholder="Your own reference (optional)"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
            <div style={{ fontSize: 11, color: SOFT }}>
              Do not enter an EIN or SSN. DialerSeat does not store tax
              identifiers, and this statement does not need one to be valid.
            </div>
            {idError && (
              <div style={{ fontSize: 12, color: '#c0392b' }}>{idError}</div>
            )}
            <div>
              <button
                onClick={saveIdentity}
                disabled={savingId}
                style={{
                  background: 'transparent', border: `1px solid ${BRAND}`,
                  color: BRAND, borderRadius: 4, padding: '7px 14px',
                  fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{savingId ? 'Saving…' : 'Save and update statement'}</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── THE STATEMENT ────────────────────────────────────────────────── */}
      <div className="sheet" style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 60px' }}>

        <div className="keep hdr" style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', gap: 24, paddingBottom: 16,
          borderBottom: `2px solid ${INK}`,
        }}>
          <div>
            <Logo />
            <div style={{ fontSize: 11.5, color: SOFT, marginTop: 10, lineHeight: 1.65 }}>
              {data.supplier.service}<br />
              {data.supplier.site} · {data.supplier.contact}
            </div>
          </div>
          <div className="hdr-right" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Billing Statement</div>
            <div style={{ fontSize: 13, color: SOFT, marginTop: 3 }}>{data.periodLabel}</div>
            <div style={{ fontSize: 11, color: SOFT, marginTop: 8 }}>
              Issued {shortDate(data.generatedAt)}
            </div>
            {data.documentRef && (
              <div style={{ fontSize: 10.5, color: SOFT, marginTop: 6, fontWeight: 600 }}>
                {data.documentRef}
              </div>
            )}
            {data.account.customerId && (
              <div style={{ fontSize: 10.5, color: SOFT, marginTop: 2 }}>
                Account {data.account.customerId}
              </div>
            )}
          </div>
        </div>

        <div className="keep" style={{ marginTop: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: SOFT, fontWeight: 700 }}>
            Billed to
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 5 }}>
            {data.account.name || data.account.email || 'Account holder'}
          </div>
          {data.account.address && (
            <div style={{ fontSize: 12.5, color: SOFT, marginTop: 3, whiteSpace: 'pre-line' }}>
              {data.account.address}
            </div>
          )}
          {data.account.email && (
            <div style={{ fontSize: 12.5, color: SOFT, marginTop: 3 }}>{data.account.email}</div>
          )}
          {data.account.reference && (
            <div style={{ fontSize: 11.5, color: SOFT, marginTop: 3 }}>
              Reference: {data.account.reference}
            </div>
          )}
        </div>

        <H>Summary</H>
        <div className="keep">
          <Row label={`Seats billed in ${data.periodLabel}`} value={String(b.distinctSeats)} />
          <Row label="Charges settled" value={String(b.paidCount)} />
          {b.discountCents > 0 && (
            <>
              <Row label="Subtotal at list price" value={money(b.listCents)} />
              <Row label="Volume discount applied" value={`− ${money(b.discountCents)}`} />
            </>
          )}
          <Row label="Total paid" value={money(b.paidCents)} strong />
          {b.unpaidCount > 0 && (
            <Row
              label={`Not settled (${b.unpaidCount}), excluded from the total`}
              value={money(b.unpaidCents)}
            />
          )}
        </div>

        {b.discountCents === 0 && data.tier?.percentOff > 0 && (
          <div style={{ fontSize: 11.5, color: SOFT, marginTop: 8, lineHeight: 1.6 }}>
            This account currently qualifies for a {data.tier.percentOff}% volume
            discount ({data.tier.label} tier, {data.tier.activeSeats} active seats).
            No discount was applied to the charges in this period.
          </div>
        )}

        {prev && (
          <>
            <H>Compared with {prev.label}</H>
            <div className="keep">
              <Row
                label="Spend"
                value={`${money(prev.paidCents)} → ${money(b.paidCents)}${
                  spendDelta?.pct !== null && spendDelta?.pct !== undefined
                    ? `  (${spendDelta.pct >= 0 ? '+' : ''}${spendDelta.pct}%)` : ''
                }`}
              />
              <Row
                label="Seats"
                value={`${prev.seatCount} → ${b.distinctSeats}${
                  seatDelta?.pct !== null && seatDelta?.pct !== undefined
                    ? `  (${seatDelta.pct >= 0 ? '+' : ''}${seatDelta.pct}%)` : ''
                }`}
              />
            </div>
          </>
        )}

        <H>Charges</H>
        {b.lineItems.length === 0 ? (
          <div style={{ fontSize: 13, color: SOFT }}>
            No seat charges were raised in this period.
          </div>
        ) : (
          <div className="rt-wrap">
            <table className="rt" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Agent</th>
                  <th>Team</th>
                  <th>Service period</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {b.lineItems.map((li: any) => (
                  <tr key={li.id}>
                    <td>{shortDate(li.date)}</td>
                    <td>{li.agentName}</td>
                    <td>{li.teamName}</td>
                    <td>{shortDate(li.serviceStart)}, {shortDate(li.serviceEnd)}</td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {li.status}
                      {!li.reconciled && li.status === 'paid' && (
                        <span style={{ color: SOFT }}> *</span>
                      )}
                    </td>
                    <td className="num">
                      {li.discountCents > 0 && (
                        <span style={{ color: SOFT, textDecoration: 'line-through', marginRight: 6 }}>
                          {money(li.listCents)}
                        </span>
                      )}
                      {money(li.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!b.reconciliation.complete && b.paidCount > 0 && (
          <div style={{ fontSize: 11, color: SOFT, marginTop: 8, lineHeight: 1.6 }}>
            * This amount is DialerSeat&apos;s recorded charge and could not be
            re-confirmed against the payment processor at the time this statement
            was generated. Your card or bank statement is the authoritative record.
          </div>
        )}

        <H>Payment method</H>
        <div className="keep">
          {data.paymentMethods.length === 0 ? (
            <div style={{ fontSize: 13, color: SOFT }}>
              No card on file at the time this statement was generated.
            </div>
          ) : (
            data.paymentMethods.map((pm: any, i: number) => (
              <Row
                key={i}
                label={`${pm.brand.toUpperCase()} ending ${pm.last4}`}
                value={`Expires ${String(pm.expMonth).padStart(2, '0')}/${pm.expYear}`}
              />
            ))
          )}
        </div>

        <H>Account structure</H>
        <div style={{ fontSize: 11.5, color: SOFT, marginBottom: 8, lineHeight: 1.6 }}>
          A snapshot as at {shortDate(data.generatedAt)}, not a reconstruction of
          how the account was configured during the period.
        </div>
        {data.structure.teams.length === 0 ? (
          <div style={{ fontSize: 13, color: SOFT }}>No teams on this account.</div>
        ) : (
          <table className="rt" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Team</th>
                <th>Created</th>
                <th className="num">Members</th>
                <th className="num">Campaigns</th>
              </tr>
            </thead>
            <tbody>
              {data.structure.teams.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{shortDate(t.createdAt)}</td>
                  <td className="num">{t.members}</td>
                  <td className="num">{t.campaigns}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td />
                <td className="num" style={{ fontWeight: 700 }}>{data.structure.totalMembers}</td>
                <td className="num" style={{ fontWeight: 700 }}>{data.structure.totalCampaigns}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ── NOTICES ────────────────────────────────────────────────────
            Two separate things, kept separate on purpose. The first is what
            this document is and is not. The second is a factual statement of
            law about altering it. Neither is tax advice and the page says so —
            claiming this "meets IRS requirements" would be a promise nobody
            here is in a position to make, and it varies by entity and state. */}
        <H>What this statement contains</H>
        {/* ── THE FIVE ELEMENTS ────────────────────────────────────────────
            IRS guidance on supporting documents for business expenses names
            five things a record has to establish: the payee, the amount paid,
            proof of payment, the date incurred, and a description of what was
            bought. Each is set out explicitly rather than left for a reader to
            hunt for, because the common failure with a software receipt is not
            that it is missing — it is that it shows a charge without showing
            what the charge was FOR. */}
        <div className="keep" style={{ fontSize: 11.5, color: SOFT, lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 10px' }}>
            IRS guidance on supporting documents for business expenses lists five
            things a record needs to establish. This statement carries each of
            them:
          </p>
          <div style={{ marginBottom: 12 }}>
            <Row label="Payee" value={`${data.supplier.name}, ${data.supplier.site}`} />
            <Row label="Amount paid" value={money(b.paidCents)} />
            <Row
              label="Proof of payment"
              value={
                data.paymentMethods.length > 0
                  ? `${data.paymentMethods[0].brand.toUpperCase()} ending ${data.paymentMethods[0].last4}`
                  : 'See charge table'
              }
            />
            <Row label="Date incurred" value={`Each charge dated in the table above`} />
            <Row label="Description" value="Per-seat software subscription" />
          </div>
          <p style={{ margin: '0 0 10px' }}>
            Only settled charges are included in the total. Charges that failed or
            are still pending are listed separately and excluded, because money that
            did not leave the account is not an expense, and an overstated
            deduction is a worse outcome than a missing one.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            <strong style={{ color: INK }}>Keep this.</strong> The IRS period of
            limitations for most returns is three years from filing, and longer in
            some circumstances, six years where more than 25% of gross income was
            omitted, and no limit where no return was filed. Retention is measured
            from the date the return was filed, not from the date of this document.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            This is a billing record, not tax advice. Whether these amounts are
            deductible, and how they should be treated, depends on your entity and
            jurisdiction, that is a question for a qualified tax professional. Your
            card or bank statement remains the authoritative record of payment.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: INK }}>Do not alter this document.</strong>{' '}
            Under 26 U.S.C. § 7206, willfully making or using a document known to be
            false as to any material matter, in connection with a matter arising
            under the internal revenue laws, is a federal criminal offense. If a
            figure here is wrong, ask us to correct it at {data.supplier.contact} 
            a corrected statement is reissued under the same reference, and it takes
            minutes.
          </p>
        </div>

        <div style={{
          marginTop: 26, paddingTop: 12, borderTop: `1px solid ${RULE}`,
          fontSize: 10.5, color: SOFT, display: 'flex',
          justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <span>DialerSeat · {data.supplier.site}</span>
          <span>{data.periodLabel} · issued {shortDate(data.generatedAt)}</span>
        </div>
      </div>
    </div>
  )
}
