'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { t } from '@/lib/i18n/client'
import { toCsv, downloadText } from '@/lib/tools/phone'
import { ToolStyles, Stat, fmt, pct } from './kit'

// =============================================================================
// COLD CALLING TRACKER + TCPA COMPLIANCE CHECKLIST
// =============================================================================
// The tracker keeps its rows in this browser's localStorage and nowhere else:
// no account, nothing uploaded, gone if the browser's site data is cleared,
// which the page says plainly. The checklist states each rule with the
// regulation it comes from, using only rules already verified elsewhere on
// the site (lib/countryRules, the abandon-rate tool, the scrub page).
// =============================================================================

const OUTCOMES = ['No answer', 'Voicemail', 'Not interested', 'Call back', 'Appointment', 'Sale', 'Do not call'] as const
type Outcome = typeof OUTCOMES[number]
interface Entry { id: string; date: string; name: string; phone: string; outcome: Outcome; notes: string; followUp: string }
const KEY = 'ds_cold_calling_tracker_v1'
const today = () => new Date().toISOString().slice(0, 10)

// localStorage as an external store: the server renders an empty tracker, the
// browser fills it in after hydration, and another tab's changes show up too.
const trackerListeners = new Set<() => void>()
function subscribeTracker(cb: () => void) {
  trackerListeners.add(cb)
  window.addEventListener('storage', cb)
  return () => { trackerListeners.delete(cb); window.removeEventListener('storage', cb) }
}
const readTracker = () => { try { return localStorage.getItem(KEY) ?? '[]' } catch { return '[]' } }
const parseTracker = (raw: string): Entry[] => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] } }

export function ColdCallingTracker() {
  const raw = useSyncExternalStore(subscribeTracker, readTracker, () => '[]')
  const rows = useMemo(() => parseTracker(raw), [raw])
  const setRows = (next: Entry[] | ((r: Entry[]) => Entry[])) => {
    const value = typeof next === 'function' ? next(parseTracker(readTracker())) : next
    try { localStorage.setItem(KEY, JSON.stringify(value)) } catch {}
    trackerListeners.forEach((l) => l())
  }
  const [draft, setDraft] = useState<Omit<Entry, 'id' | 'date'>>({ name: '', phone: '', outcome: 'No answer', notes: '', followUp: '' })
  const [confirmClear, setConfirmClear] = useState(false)

  const add = () => {
    setRows((r) => [{ ...draft, id: Math.random().toString(36).slice(2), date: today() }, ...r])
    setDraft({ name: '', phone: '', outcome: 'No answer', notes: '', followUp: '' })
  }
  const count = (o: Outcome[]) => rows.filter((r) => o.includes(r.outcome)).length
  const reached = count(['Not interested', 'Call back', 'Appointment', 'Sale', 'Do not call'])
  const appts = count(['Appointment', 'Sale'])
  const csv = () => toCsv([['date', 'name', 'phone', 'outcome', 'notes', 'follow_up'], ...rows.map((r) => [r.date, r.name, r.phone, r.outcome, r.notes, r.followUp])])
  const due = rows.filter((r) => r.followUp && r.followUp <= today() && r.outcome !== 'Do not call')

  const input = { padding: 8, borderRadius: 6, border: '1px solid #c4c8d0', font: 'inherit', width: '100%', boxSizing: 'border-box' as const }
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid" style={{ ['--cols' as string]: 3 }}>
        <div className="tk-field"><label htmlFor="tr-n">{t("Name")}</label><input id="tr-n" style={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div className="tk-field"><label htmlFor="tr-p">{t("Phone")}</label><input id="tr-p" style={input} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
        <div className="tk-field"><label htmlFor="tr-o">{t("Outcome")}</label>
          <select id="tr-o" style={input} value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value as Outcome })}>
            {OUTCOMES.map((o) => <option key={o} value={o}>{t(o)}</option>)}
          </select>
        </div>
        <div className="tk-field" style={{ gridColumn: 'span 2' }}><label htmlFor="tr-x">{t("Notes")}</label><input id="tr-x" style={input} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
        <div className="tk-field"><label htmlFor="tr-f">{t("Follow up on")}</label><input id="tr-f" type="date" style={input} value={draft.followUp} onChange={(e) => setDraft({ ...draft, followUp: e.target.value })} /></div>
      </div>
      <div className="tk-row">
        <button type="button" className="tk-btn" onClick={add} disabled={!draft.name && !draft.phone}>{t("LOG CALL")}</button>
        <button type="button" className="tk-btn ghost" disabled={!rows.length} onClick={() => downloadText(`cold-calls-${today()}.csv`, csv())}>{t("EXPORT CSV")}</button>
        <button type="button" className="tk-btn ghost" onClick={() => downloadText('cold-calling-tracker-template.csv', toCsv([['date', 'name', 'phone', 'outcome', 'notes', 'follow_up']]))}>{t("BLANK TEMPLATE")}</button>
        {rows.length > 0 && (
          <button type="button" className="tk-btn ghost" onClick={() => { if (confirmClear) { setRows([]); setConfirmClear(false) } else setConfirmClear(true) }}>
            {confirmClear ? t("CLICK AGAIN TO DELETE ALL") : t("CLEAR")}
          </button>
        )}
      </div>
      <div className="tk-stats">
        <Stat value={fmt(rows.length)} label="Calls logged" />
        <Stat value={pct(rows.length ? reached / rows.length : NaN)} label="Reached a person" />
        <Stat value={fmt(appts)} label="Appointments" />
        <Stat value={pct(reached ? appts / reached : NaN)} label="Booked per conversation" />
        <Stat value={fmt(due.length)} label="Follow-ups due" />
      </div>
      {rows.length > 0 && (
        <div className="tk-tablewrap">
          <table className="tk-table">
            <thead><tr><th>{t("Date")}</th><th>{t("Name")}</th><th>{t("Phone")}</th><th>{t("Outcome")}</th><th>{t("Notes")}</th><th>{t("Follow up")}</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td><td>{r.name}</td><td>{r.phone}</td>
                  <td><span className={`tk-pill ${r.outcome === 'Appointment' || r.outcome === 'Sale' ? 'ok' : r.outcome === 'Do not call' ? 'no' : 'warn'}`}>{t(r.outcome)}</span></td>
                  <td>{r.notes}</td><td>{r.followUp}</td>
                  <td><button type="button" className="tk-btn ghost" style={{ padding: '4px 8px' }} onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label={t("Delete row")}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tk-foot">{t("Saved in this browser only, on this device. Nothing is uploaded, so clearing your browser's site data deletes it: export the CSV to keep a copy. Mark anyone who asks not to be called as \"Do not call\" and keep them off every list from then on.")}</p>
    </div>
  )
}

// ── TCPA / TSR CHECKLIST ───────────────────────────────────────────────
const CHECKS: { group: string; items: { text: string; cite: string }[] }[] = [
  { group: 'Do Not Call', items: [
    { text: 'Scrub every list against the National Do Not Call Registry, using a copy no more than 31 days old.', cite: '16 CFR 310.4(b)(3)(iv)' },
    { text: 'Check the state Do Not Call lists for the states you call.', cite: 'State law; see calling rules by country' },
    { text: 'Keep your own do-not-call list and honor every "don\'t call me again" immediately.', cite: '16 CFR 310.4(b)(1)(iii)(A)' },
    { text: 'Call registered numbers only with express written agreement or an established business relationship.', cite: '16 CFR 310.4(b)(1)(iii)(B)' },
  ] },
  { group: 'Consent', items: [
    { text: 'Get prior express written consent before autodialed or prerecorded marketing calls to mobile numbers.', cite: 'TCPA, 47 U.S.C. 227; 47 CFR 64.1200' },
    { text: 'Keep the consent record: when, where, and the exact wording the person agreed to.', cite: 'Burden of proof sits with the caller' },
  ] },
  { group: 'Calling hours', items: [
    { text: "Call only between 8 a.m. and 9 p.m. in the person's local time, not yours.", cite: '47 CFR 64.1200(c)(1); 16 CFR 310.4(c)' },
    { text: 'Apply stricter state hours where they exist (Florida ends at 8 p.m.).', cite: 'Fla. Stat. 501.616(6)(a)' },
  ] },
  { group: 'Predictive and multi-line dialing', items: [
    { text: 'Keep abandoned calls at or below 3% of calls answered by a person, per campaign, over each 30 days.', cite: '16 CFR 310.4(b)(4)(i)' },
    { text: 'Connect a live agent within 2 seconds of the greeting, or play a recorded message with the seller\'s name and number.', cite: '16 CFR 310.4(b)(4)(iii)' },
    { text: 'Let unanswered calls ring at least 15 seconds or four rings before hanging up.', cite: '16 CFR 310.4(b)(4)(ii)' },
  ] },
  { group: 'On the call', items: [
    { text: 'Transmit caller ID on every telemarketing call.', cite: '16 CFR 310.4(a)(8)' },
    { text: 'Say promptly who you are, which company you represent, and that the call is about selling something.', cite: '16 CFR 310.4(d)' },
  ] },
]

export function TcpaChecklist() {
  const all = CHECKS.flatMap((g) => g.items)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const n = all.filter((i) => done[i.text]).length
  return (
    <div className="tk">
      <ToolStyles />
      <div className={`tk-result ${n === all.length ? 'ok' : ''}`} aria-live="polite">
        <div className="tk-big">{t("{n} of {m} in place", { n, m: all.length })}</div>
        <p>{n === all.length ? t("Every item is checked. Re-check whenever you add a state, a list or a dialing mode.") : t("Tick what your campaign already does. What's left unticked is your to-do list.")}</p>
      </div>
      {CHECKS.map((g) => (
        <div key={g.group} style={{ marginTop: 16 }}>
          <div className="tk-label">{t(g.group)}</div>
          {g.items.map((i) => (
            <label key={i.text} className="tk-check">
              <input type="checkbox" checked={!!done[i.text]} onChange={(e) => setDone({ ...done, [i.text]: e.target.checked })} />
              <span>{t(i.text)}<small>{i.cite}</small></span>
            </label>
          ))}
        </div>
      ))}
      <div className="tk-row"><button type="button" className="tk-btn ghost" onClick={() => window.print()}>{t("PRINT")}</button></div>
      <p className="tk-foot">{t("US federal rules for outbound telemarketing, with the regulation behind each. States add their own rules on top. A checklist, not legal advice: for anything that decides whether a campaign runs, ask a lawyer who handles TCPA work.")}</p>
    </div>
  )
}
