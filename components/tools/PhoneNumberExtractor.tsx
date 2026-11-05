'use client'

import { useMemo, useState } from 'react'
import { t } from '@/lib/i18n/client'
import { checkPhone, extractNanp, formatNanp, toCsv, downloadText, type PhoneFormat } from '@/lib/tools/phone'
import { ToolStyles, SelectField, Stat, CopyButton, fmt } from './kit'

// =============================================================================
// PHONE NUMBER EXTRACTOR — every US/Canadian number in a block of text
// =============================================================================
// For the list that arrives as an email signature dump, a scraped page, a PDF
// copied as text. Finds every NANP-shaped number, checks it with the dialer's
// rules, removes duplicates. Runs in the browser; nothing is sent anywhere.
// =============================================================================

const SAMPLE = `Hi team, call Maria on (312) 555-0147 or her cell 312.555.0188.
Office: +1 646 555 0123 ext. 4 | Fax 646-555-0124
Order #4155550132998 shipped. Reach Dave at 7135550166 before Friday.
Duplicate: (312) 555-0147`

export default function PhoneNumberExtractor() {
  const [input, setInput] = useState(SAMPLE)
  const [format, setFormat] = useState<PhoneFormat>('e164')

  const r = useMemo(() => {
    const found = extractNanp(input)
    const seen = new Set<string>()
    const rows: { out: string; place: string; note: string | null; ok: boolean; reason?: string }[] = []
    for (const ten of found) {
      if (seen.has(ten)) continue
      seen.add(ten)
      const v = checkPhone(ten)
      if (v.ok) rows.push({ out: formatNanp(ten, format), place: v.place, note: v.note, ok: true })
      else rows.push({ out: formatNanp(ten, format), place: '—', note: null, ok: false, reason: v.reason })
    }
    return { found: found.length, rows, unique: seen.size }
  }, [input, format])

  const good = r.rows.filter((x) => x.ok)
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-field">
        <label htmlFor="px-input">{t("PASTE ANY TEXT: EMAILS, NOTES, A WEB PAGE")}</label>
        <textarea id="px-input" className="tk-area" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
        <div className="tk-hint">{t("Runs in this browser tab. Nothing you paste is uploaded or stored.")}</div>
      </div>
      <div className="tk-grid" style={{ ['--cols' as string]: 2, marginTop: 12 }}>
        <SelectField id="px-format" label="OUTPUT FORMAT" value={format} onChange={setFormat} options={[
          { value: 'e164', label: 'E.164: +13125550147' },
          { value: 'national', label: '(312) 555-0147' },
          { value: 'dashes', label: '312-555-0147' },
          { value: 'digits', label: '3125550147' },
        ]} />
        <div className="tk-field">
          <span className="tk-label">{t("EXPORT")}</span>
          <div className="tk-row" style={{ marginTop: 0 }}>
            <CopyButton text={good.map((g) => g.out).join('\n')} label="COPY NUMBERS" />
            <button type="button" className="tk-btn" disabled={!good.length} onClick={() =>
              downloadText('extracted-phone-numbers.csv', toCsv([['phone', 'location', 'note'], ...good.map((g) => [g.out, g.place, g.note ?? ''])]))
            }>{t("CSV")}</button>
          </div>
        </div>
      </div>
      <div className="tk-stats">
        <Stat value={fmt(r.found)} label="Numbers found" />
        <Stat value={fmt(r.unique)} label="Unique" />
        <Stat value={fmt(good.length)} label="Dialable" />
      </div>
      {r.rows.length > 0 && (
        <div className="tk-tablewrap">
          <table className="tk-table">
            <thead><tr><th>{t("Number")}</th><th>{t("Location")}</th><th>{t("Status")}</th></tr></thead>
            <tbody>
              {r.rows.map((x, i) => (
                <tr key={i}>
                  <td>{x.out}</td><td>{t(x.place)}</td>
                  <td>{x.ok ? <span className={`tk-pill ${x.note ? 'warn' : 'ok'}`}>{t(x.note ?? 'Dialable')}</span> : <span className="tk-pill no">{t(x.reason ?? '')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tk-foot">{t("Finds US and Canadian numbers written as (312) 555-0147, 312.555.0147, 312-555-0147, +1 312 555 0147 or ten digits in a row. Digits inside a longer run, like an order or card number, are left alone.")}</p>
    </div>
  )
}
