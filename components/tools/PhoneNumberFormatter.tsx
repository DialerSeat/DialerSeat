'use client'

import { useMemo, useState } from 'react'
import { t } from '@/lib/i18n/client'
import { checkPhone, formatNanp, toCsv, downloadText, type PhoneFormat } from '@/lib/tools/phone'
import { ToolStyles, SelectField, Stat, CopyButton, fmt } from './kit'

// =============================================================================
// PHONE NUMBER FORMATTER / CLEANER — runs entirely in the browser
// =============================================================================
// Paste a column or open a CSV. Every value is checked with the dialer's own
// rules (lib/tools/phone.ts), formatted, de-duplicated, and the ones that
// cannot be dialed are listed with the reason. The list is never sent
// anywhere: there is no network request in this component, which anyone can
// confirm in their browser's network tab.
// =============================================================================

const SAMPLE = `(415) 555-0132
415.555.0132
+1 212 555 0198
2125550198
1-305-555-0177 ext 12
555-0101
800-555-0123
(011) 555-0199
John Smith 617 555 0143`

/** Pull the phone-looking field out of a CSV line, or take the line as it is. */
function phoneField(line: string): string {
  if (!line.includes(',') && !line.includes('\t')) return line
  const cells = line.split(/,|\t/).map((c) => c.replace(/^"|"$/g, '').trim())
  return cells.find((c) => (c.replace(/\D/g, '').length >= 10 && c.replace(/\D/g, '').length <= 11)) ?? line
}

export default function PhoneNumberFormatter() {
  const [input, setInput] = useState(SAMPLE)
  const [format, setFormat] = useState<PhoneFormat>('e164')
  const [dedupe, setDedupe] = useState('yes')

  const r = useMemo(() => {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const seen = new Set<string>()
    const good: { out: string; place: string; tz: string | null; note: string | null }[] = []
    const bad: { value: string; reason: string }[] = []
    let dupes = 0
    for (const line of lines) {
      const value = phoneField(line)
      const v = checkPhone(value)
      if (!v.ok) { bad.push({ value: line, reason: v.reason }); continue }
      const ten = v.e164.slice(2)
      if (dedupe === 'yes' && seen.has(ten)) { dupes++; continue }
      seen.add(ten)
      good.push({ out: formatNanp(ten, format), place: v.place, tz: v.tz, note: v.note })
    }
    return { total: lines.length, good, bad, dupes }
  }, [input, format, dedupe])

  const outText = r.good.map((g) => g.out).join('\n')

  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid" style={{ ['--cols' as string]: 2 }}>
        <SelectField id="pf-format" label="OUTPUT FORMAT" value={format} onChange={setFormat} options={[
          { value: 'e164', label: 'E.164: +14155550132' },
          { value: 'national', label: '(415) 555-0132' },
          { value: 'dashes', label: '415-555-0132' },
          { value: 'digits', label: '4155550132' },
        ]} />
        <SelectField id="pf-dedupe" label="DUPLICATES" value={dedupe} onChange={setDedupe} options={[
          { value: 'yes', label: 'Remove duplicates' },
          { value: 'no', label: 'Keep duplicates' },
        ]} />
      </div>

      <div className="tk-field" style={{ marginTop: 12 }}>
        <label htmlFor="pf-input">{t("PASTE NUMBERS, ONE PER LINE, OR OPEN A CSV")}</label>
        <textarea id="pf-input" className="tk-area" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <div className="tk-row">
          <label className="tk-btn ghost" style={{ display: 'inline-block' }}>
            {t("OPEN CSV OR TXT")}
            <input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) f.text().then(setInput)
            }} />
          </label>
          <button type="button" className="tk-btn ghost" onClick={() => setInput('')}>{t("CLEAR")}</button>
        </div>
        <div className="tk-hint">{t("Your list stays in this browser tab. Nothing is uploaded: open your browser's network tab while you use it and you will see no requests.")}</div>
      </div>

      <div className="tk-stats">
        <Stat value={fmt(r.total)} label="Rows read" />
        <Stat value={fmt(r.good.length)} label="Ready to dial" />
        <Stat value={fmt(r.dupes)} label="Duplicates removed" />
        <Stat value={fmt(r.bad.length)} label="Can't be dialed" />
      </div>

      <div className="tk-row">
        <CopyButton text={outText} label="COPY CLEAN LIST" />
        <button type="button" className="tk-btn" disabled={!r.good.length} onClick={() =>
          downloadText('clean-phone-numbers.csv', toCsv([['phone', 'location', 'time_zone', 'note'], ...r.good.map((g) => [g.out, g.place, g.tz ?? '', g.note ?? ''])]))
        }>{t("DOWNLOAD CSV")}</button>
      </div>

      {r.good.length > 0 && (
        <div className="tk-tablewrap">
          <table className="tk-table">
            <thead><tr><th>{t("Number")}</th><th>{t("Location")}</th><th>{t("Time zone")}</th><th>{t("Note")}</th></tr></thead>
            <tbody>
              {r.good.slice(0, 500).map((g, i) => (
                <tr key={i}><td>{g.out}</td><td>{t(g.place)}</td><td>{g.tz ?? '—'}</td><td>{g.note ? <span className="tk-pill warn">{t(g.note)}</span> : ''}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {r.bad.length > 0 && (
        <>
          <div className="tk-label" style={{ marginTop: 16 }}>{t("Rows that can't be dialed, and why")}</div>
          <div className="tk-tablewrap">
            <table className="tk-table">
              <tbody>
                {r.bad.slice(0, 500).map((b, i) => (
                  <tr key={i}><td style={{ fontFamily: 'ui-monospace, monospace' }}>{b.value}</td><td><span className="tk-pill no">{t(b.reason)}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="tk-foot">
        {t("US and Canadian numbers (the North American Numbering Plan). The checks are the ones DialerSeat runs before dialing: 10 digits, an area code and exchange that can't start with 0 or 1, no N11 service codes, no letters. Location comes from the area code, which shows where a number was issued; mobile numbers keep their area code when people move.")}</p>
    </div>
  )
}
