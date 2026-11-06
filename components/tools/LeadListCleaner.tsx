'use client'

import { useMemo, useState } from 'react'
import { t } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'
import {
  parseDelimited, looksLikeHeader, guessColumns, cleanLeads, toImportCsv, TEMPLATE_CSV,
  FIELD_LABELS, type ColumnGuess, type FieldType,
  keepFullNumbers,
} from '@/lib/tools/leadSheet'
import { downloadText } from '@/lib/tools/phone'
import { ToolStyles, Stat, fmt } from './kit'

// =============================================================================
// LEAD LIST CLEANER — any lead sheet, made ready for DialerSeat's importer
// =============================================================================
// Built from a real support case: a sheet whose headers said FIRST NAME /
// Last name / Email over columns that held names, veteran status and ages,
// with Facebook "p:+1…" phones and states typed every way. It imported with
// every name blank. lib/tools/leadSheet.ts holds the rules; this is the page
// around them. The file is read in the browser and never uploaded.
// =============================================================================

const FIELD_ORDER: FieldType[] = [
  'phone', 'first_name', 'last_name', 'full_name', 'email', 'state', 'city', 'zip', 'address', 'notes',
  'consent_date', 'consent_source', 'consent_description', 'custom', 'skip',
]

// Fictional people and reserved 555-01xx numbers. Never paste a customer's real
// leads here: this text is published on a public page.
const SAMPLE = `FIRST NAME,Last name,Email,phone_number,state
Sam T. Example,veteran,74,p:+12145550101,TX
JORDAN SAMPLE,veteran,87,p:+13175550102,Indiana
Avery Placeholder,spouse_of_veteran,62,p:+14175550103,m0
Riley Testcase,spouse_of_veteran,82,p:+12075550104,somewhere Maine 04000
casey demo,widow_of_veteran,92,p:+19735550105,newjersey
Morgan Fictional,veteran,70,p:+18085550106,Yes
Taylor Sue Example,spouse_of_veteran,69 years old,p:+19185550107,Oklahoma
Taylor Sue Example,spouse_of_veteran,69 years old,p:+19185550107,Oklahoma
Short Number,veteran,70,555-0108,NY`

export default function LeadListCleaner() {
  const [text, setText] = useState(SAMPLE)
  const [fileName, setFileName] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<number, Partial<ColumnGuess>>>({})
  const [fixCase, setFixCase] = useState(true)
  const [dedupe, setDedupe] = useState(true)
  const [stateFromAreaCode, setStateFromAreaCode] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    const rows = parseDelimited(text)
    if (!rows.length) return null
    const hasHeader = looksLikeHeader(rows[0])
    const body = hasHeader ? rows.slice(1) : rows
    return { header: hasHeader ? rows[0] : null, body, offset: hasHeader ? 2 : 1 }
  }, [text])

  const guesses = useMemo(() => (parsed ? guessColumns(parsed.header, parsed.body) : []), [parsed])
  const cols = useMemo<ColumnGuess[]>(
    () => guesses.map((g) => ({ ...g, ...overrides[g.index] })),
    [guesses, overrides],
  )
  const result = useMemo(
    () => (parsed && cols.some((c) => c.type === 'phone') ? cleanLeads(parsed.body, cols, { fixCase, dedupe, stateFromAreaCode }, parsed.offset) : null),
    [parsed, cols, fixCase, dedupe, stateFromAreaCode],
  )

  async function openFile(f: File) {
    setError(null); setOverrides({}); setFileName(f.name)
    const name = f.name.toLowerCase()
    try {
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        keepFullNumbers(sheet)
        setText(XLSX.utils.sheet_to_csv(sheet, { blankrows: false }))
      } else {
        setText(await f.text())
      }
    } catch {
      setError('That file could not be read. Save it as CSV from your spreadsheet and open that instead.')
    }
  }

  const setCol = (i: number, patch: Partial<ColumnGuess>) => setOverrides((o) => ({ ...o, [i]: { ...o[i], ...patch } }))
  const r = result?.report

  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-field">
        <span className="tk-label">{t("1 · OPEN YOUR LEAD SHEET (CSV, TSV, TXT OR EXCEL), OR PASTE IT")}</span>
        <div className="tk-row" style={{ marginTop: 0 }}>
          <label className="tk-btn" style={{ display: 'inline-block' }}>
            {t("OPEN FILE")}
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f) }} />
          </label>
          <button type="button" className="tk-btn ghost" onClick={() => downloadText('dialerseat-lead-template.csv', TEMPLATE_CSV)}>{t("DOWNLOAD A BLANK TEMPLATE")}</button>
          {fileName && <span className="tk-hint" style={{ marginTop: 0 }}>{fileName}</span>}
        </div>
        <textarea className="tk-area" style={{ marginTop: 10 }} value={text} onChange={(e) => { setText(e.target.value); setOverrides({}); setFileName(null) }} spellCheck={false} aria-label={t("Lead sheet contents")} />
        <div className="tk-hint">{t("Your sheet is read in this browser tab and never uploaded. The example above is made up, in the shape real broken sheets arrive in.")}</div>
        {error && <div className="tk-pill no" style={{ marginTop: 8 }}>{t(error)}</div>}
      </div>

      {cols.length > 0 && (
        <>
          <div className="tk-label" style={{ marginTop: 18 }}>{t("2 · CHECK WHAT EACH COLUMN HOLDS")}</div>
          <div className="tk-tablewrap" style={{ maxHeight: 'none' }}>
            <table className="tk-table">
              <thead><tr><th>{t("Your header")}</th><th>{t("Sample values")}</th><th>{t("Use it as")}</th></tr></thead>
              <tbody>
                {cols.map((c) => (
                  <tr key={c.index}>
                    <td><b>{c.header || `Column ${c.index + 1}`}</b></td>
                    <td style={{ color: '#5a6072' }}>
                      {c.sample.join(' · ') || '—'}
                      {c.warning && <div className="tk-pill warn" style={{ marginTop: 6, whiteSpace: 'normal' }}>{t(c.warning, c.warningVars)}</div>}
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <select value={c.type} onChange={(e) => setCol(c.index, { type: e.target.value as FieldType })}
                        style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #c4c8d0', font: 'inherit' }}>
                        {FIELD_ORDER.map((f) => <option key={f} value={f}>{t(FIELD_LABELS[f])}</option>)}
                      </select>
                      {c.type === 'custom' && (
                        <input type="text" value={c.customName} onChange={(e) => setCol(c.index, { customName: e.target.value })}
                          aria-label={t("Column name")} placeholder="column_name"
                          style={{ width: '100%', marginTop: 6, padding: 6, borderRadius: 6, border: '1px solid #c4c8d0', font: 'inherit', boxSizing: 'border-box' }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tk-row">
            <label><input type="checkbox" checked={fixCase} onChange={(e) => setFixCase(e.target.checked)} /> {t("Fix ALL CAPS and lowercase names")}</label>
            <label><input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} /> {t("Remove duplicate phone numbers")}</label>
            <label><input type="checkbox" checked={stateFromAreaCode} onChange={(e) => setStateFromAreaCode(e.target.checked)} /> {t("Fill an unreadable state from the area code")}</label>
          </div>
        </>
      )}

      {!result && cols.length > 0 && (
        <div className="tk-result over"><p>{t("No column is set as the phone number. Pick the column that holds phones in step 2.")}</p></div>
      )}

      {result && r && (
        <>
          <div className="tk-label" style={{ marginTop: 18 }}>{t("3 · DOWNLOAD THE FIXED SHEET")}</div>
          <div className={`tk-result ${r.leadsOut ? 'ok' : 'over'}`}>
            <div className="tk-big">{t("{n} leads ready to import", { n: fmt(r.leadsOut) })}</div>
            <p>{t("Headers DialerSeat recognises, 10-digit phones, 2-letter states, and no commas or quotes inside cells, which would shift columns on import.")}</p>
            <div className="tk-row">
              <button type="button" className="tk-btn" disabled={!r.leadsOut} onClick={() =>
                downloadText(`${(fileName ?? 'leads').replace(/\.[^.]+$/, '')}-dialerseat.csv`, toImportCsv(result.out))
              }>{t("DOWNLOAD FIXED CSV")}</button>
            </div>
          </div>
          <div className="tk-stats">
            <Stat value={fmt(r.rowsIn)} label="Rows in your sheet" />
            <Stat value={fmt(r.fixes.phones)} label="Phones reformatted" />
            <Stat value={fmt(r.fixes.states + r.fixes.statesFromAreaCode)} label={msg("States fixed")} />
            <Stat value={fmt(r.fixes.namesSplit)} label="Full names split" />
            <Stat value={fmt(r.fixes.namesRecased)} label="Names re-cased" />
            <Stat value={fmt(r.duplicates)} label="Duplicates removed" />
            <Stat value={fmt(r.removed.length)} label="Rows that can't be dialed" />
          </div>

          <div className="tk-label" style={{ marginTop: 16 }}>{t("Preview")}</div>
          <div className="tk-tablewrap">
            <table className="tk-table">
              <thead><tr>{result.out[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {result.out.slice(1, 51).map((row, i) => (
                  <tr key={i}>{row.map((v, j) => <td key={j}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          {(r.removed.length > 0 || r.notes.length > 0) && (
            <>
              <div className="tk-label" style={{ marginTop: 16 }}>{t("Rows to look at")}</div>
              <div className="tk-tablewrap">
                <table className="tk-table">
                  <tbody>
                    {r.removed.map((x, i) => (
                      <tr key={`r${i}`}><td>{t("Row {n}", { n: x.row })}</td><td>{x.value}</td><td><span className="tk-pill no">{t("Removed")}: {t(x.reason)}</span></td></tr>
                    ))}
                    {r.notes.map((x, i) => (
                      <tr key={`n${i}`}><td>{t("Row {n}", { n: x.row })}</td><td>{x.phone}</td><td><span className="tk-pill warn">{t(x.note, x.vars)}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <p className="tk-foot">
        {t("What it fixes: headers DialerSeat doesn't recognise, columns whose header doesn't match what's in them, phone numbers with prefixes or punctuation (p:+1, (555), dots, dashes, extensions), states typed as names, abbreviations or inside an address, full names in one column, ALL CAPS names, duplicate numbers, and commas or quotes inside cells. Anything else in your sheet is kept as its own column and shows on the lead.")}</p>
    </div>
  )
}
