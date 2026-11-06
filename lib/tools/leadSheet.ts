import { msg } from '@/lib/i18n/msg'
import { normalizeState } from '@/lib/normalizeState'
import { classifyAreaCode } from '@/lib/areaCode'
import { checkPhone, STATE_NAMES } from '@/lib/tools/phone'

// =============================================================================
// LEAD SHEET → DIALERSEAT IMPORT FORMAT
// =============================================================================
// Mirrors what app/api/leads/upload and lib/parseLeadsFile actually accept, so
// a sheet that comes out of here imports with nothing lost:
//
//   - Headers are read ignoring case and punctuation there (lib/leadHeaders.ts),
//     but it only knows what a header says, not what the column holds. Output
//     maps columns by their contents to first_name, last_name, phone, email,
//     state, which always match.
//   - The importer splits rows on every comma and strips quotes; it does not
//     understand quoted fields. A comma inside a cell shifts every column
//     after it. Output cells therefore carry no commas, quotes, tabs or line
//     breaks.
//   - Phones are reduced to digits and must be 10, or 11 starting with 1.
//     Output is 10 digits. Duplicates in one file are rejected there, so they
//     are removed here and counted.
//   - State drives the calling window (lib/callingWindow): explicit state
//     first, area code as the fallback. Output is a 2-letter code, or the
//     area code's state when the sheet's value cannot be read.
//   - Everything else rides along as extra columns, which the importer keeps
//     on the lead (extra_data) for the agent to see.
//
// Pure functions; the page runs them in the browser and uploads nothing.
// =============================================================================

export type FieldType =
  | 'first_name' | 'last_name' | 'full_name' | 'phone' | 'email' | 'state'
  | 'city' | 'zip' | 'address' | 'notes'
  | 'consent_date' | 'consent_source' | 'consent_description'
  | 'custom' | 'skip'

export const FIELD_LABELS: Record<FieldType, string> = {
  first_name: msg("First name"), last_name: msg("Last name"), full_name: msg("Full name (split it)"), phone: msg("Phone"),
  email: msg("Email"), state: msg("State"), city: msg("City"), zip: msg("ZIP code"), address: msg("Address"), notes: msg("Notes"),
  consent_date: msg("Consent date"), consent_source: msg("Consent source"), consent_description: msg("Consent text"),
  custom: msg("Keep as its own column"), skip: msg("Leave out"),
}

const ALIASES: Partial<Record<FieldType, string[]>> = {
  phone: ['phone', 'phonenumber', 'phone1', 'primaryphone', 'mobile', 'mobilephone', 'cell', 'cellphone', 'telephone', 'tel', 'contactnumber', 'number', 'phoneno', 'wireless', 'landline'],
  first_name: ['firstname', 'fname', 'givenname', 'first'],
  last_name: ['lastname', 'lname', 'surname', 'familyname', 'last'],
  full_name: ['name', 'fullname', 'contactname', 'leadname', 'clientname', 'customername', 'ownername'],
  email: ['email', 'emailaddress', 'mail'],
  state: ['state', 'province', 'region', 'st', 'statecode'],
  city: ['city', 'town', 'locality'],
  zip: ['zip', 'zipcode', 'postalcode', 'postcode'],
  address: ['address', 'address1', 'addressline1', 'street', 'streetaddress', 'mailingaddress'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
  consent_date: ['consentdate', 'optindate', 'optedinat', 'consenttimestamp'],
  consent_source: ['consentsource', 'optinsource', 'leadsource', 'source'],
  consent_description: ['consentdescription', 'optintext', 'tcpalanguage', 'disclosure', 'consenttext'],
}

const keyOf = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')
/** A column name both the importer and a spreadsheet read cleanly: lower_snake_case. */
const slug = (h: string) => h.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

// ── CSV IN ─────────────────────────────────────────────────────────────

/**
 * Excel keeps a phone number as a number and only displays it as 3.18E+09. The
 * full value is still in the cell, so write that out instead of the display
 * text, which would throw the digits away. Dates are small serial numbers and
 * keep their formatting.
 */
export function keepFullNumbers(sheet: Record<string, unknown>): void {
  for (const [ref, cell] of Object.entries(sheet)) {
    if (ref.startsWith('!')) continue
    const c = cell as { t?: string; v?: unknown; w?: string }
    if (c.t === 'n' && typeof c.v === 'number' && Number.isInteger(c.v) && Math.abs(c.v) >= 1e9) c.w = String(c.v)
  }
}

/** RFC 4180 parsing with comma, tab or semicolon, whichever the first line uses. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const counts = { ',': (firstLine.match(/,/g) || []).length, '\t': (firstLine.match(/\t/g) || []).length, ';': (firstLine.match(/;/g) || []).length }
  const delim = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ',') as string
  const rows: string[][] = []
  let row: string[] = [], cell = '', inQ = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQ) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQ = false
      else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows.map((r) => r.map((c) => c.trim()))
}

/** The importer's own test: a first row with no 10-digit value is headers. */
export function looksLikeHeader(row: string[]): boolean {
  return !row.some((v) => v.replace(/\D/g, '').length >= 10)
}

// ── STATE ──────────────────────────────────────────────────────────────

const NAME_LIST = Object.entries(STATE_NAMES)
  .filter(([c]) => c.length === 2)
  .map(([code, name]) => ({ code, name: name.toLowerCase(), compact: name.toLowerCase().replace(/[^a-z]/g, '') }))
  .sort((a, b) => b.name.length - a.name.length)
const SHORT: Record<string, string> = {
  mich: 'MI', calif: 'CA', cali: 'CA', penn: 'PA', penna: 'PA', mass: 'MA', minn: 'MN', wisc: 'WI', tenn: 'TN',
  ariz: 'AZ', colo: 'CO', conn: 'CT', fla: 'FL', ill: 'IL', ind: 'IN', kans: 'KS', okla: 'OK', oreg: 'OR', wash: 'WA',
  nev: 'NV', nebr: 'NE', wyo: 'WY', mont: 'MT', miss: 'MS', ala: 'AL', ark: 'AR', del: 'DE', ga: 'GA', tex: 'TX', ny: 'NY', nyc: 'NY',
}

export type StateFix = { code: string; how: 'clean' | 'fixed' | 'from_area_code' } | null

/** Best reading of a state cell; null when nothing in it names a state. */
export function readState(raw: string): { code: string; fixed: boolean } | null {
  const v = (raw || '').trim()
  if (!v) return null
  const direct = normalizeState(v)
  if (direct) return { code: direct, fixed: direct !== v }
  const lower = v.toLowerCase()
  const compact = lower.replace(/[^a-z]/g, '')
  for (const s of NAME_LIST) if (compact === s.compact) return { code: s.code, fixed: true }
  if (SHORT[compact]) return { code: SHORT[compact], fixed: true }
  // "litchfield Maine 04350", "cleveland .ohio": a state name inside the text
  for (const s of NAME_LIST) if (new RegExp(`(^|[^a-z])${s.name.replace(/ /g, '\\s*')}([^a-z]|$)`).test(lower)) return { code: s.code, fixed: true }
  // "m0", "0H": a zero typed for an O
  const letters = v.replace(/0/g, 'O').replace(/[^a-zA-Z]/g, '').toUpperCase()
  if (letters.length === 2) { const n = normalizeState(letters); if (n) return { code: n, fixed: true } }
  return null
}

// ── COLUMN DETECTION ───────────────────────────────────────────────────

export interface ColumnGuess {
  index: number
  header: string
  type: FieldType
  customName: string
  /** Why the header was overruled, shown to the user. */
  warning: string | null
  warningVars?: Record<string, string>
  sample: string[]
}

const isPhoneish = (v: string) => { const d = v.replace(/\D/g, ''); return d.length === 10 || (d.length === 11 && d.startsWith('1')) }
// (the "p:" label Facebook exports is fine here: only digits are counted)
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const isZip = (v: string) => /^\d{5}(-\d{4})?$/.test(v)
const isAgeish = (v: string) => /^(\d{1,3}\+?|\d{2}\s*-\s*\d{2}|\d{1,3}\s*(years?( old)?|yrs?|y\/?o))$/i.test(v.trim()) || /\b\d{2,3}\b/.test(v) && /(years|yrs|old|be \d)/i.test(v)
const isNameish = (v: string) => /^[A-Za-z][A-Za-z.'\- ]{0,60}$/.test(v) && v.trim().split(/\s+/).length <= 5

function share(values: string[], test: (v: string) => boolean) {
  return values.length ? values.filter(test).length / values.length : 0
}

export function guessColumns(header: string[] | null, rows: string[][]): ColumnGuess[] {
  const width = Math.max(header?.length ?? 0, ...rows.slice(0, 200).map((r) => r.length))
  const guesses: ColumnGuess[] = []
  for (let i = 0; i < width; i++) {
    const values = rows.slice(0, 300).map((r) => (r[i] ?? '').trim()).filter(Boolean)
    const h = (header?.[i] ?? '').trim()
    const k = keyOf(h)
    const distinct = new Set(values.map((v) => v.toLowerCase())).size
    const categorical = values.length >= 8 && distinct / values.length < 0.25
    const s = {
      phone: share(values, isPhoneish), email: share(values, isEmail), state: share(values, (v) => !!readState(v)),
      zip: share(values, isZip), age: share(values, isAgeish), name: categorical ? 0 : share(values, isNameish),
    }
    let byHeader: FieldType | null = null
    for (const [type, list] of Object.entries(ALIASES) as [FieldType, string[]][]) if (list.includes(k)) { byHeader = type; break }

    const agrees: Partial<Record<FieldType, boolean>> = {
      phone: s.phone >= 0.6, email: s.email >= 0.6, state: s.state >= 0.5, zip: s.zip >= 0.6,
      first_name: s.name >= 0.6, last_name: s.name >= 0.6, full_name: s.name >= 0.6,
    }
    let type: FieldType
    let warning: string | null = null
    let warningVars: Record<string, string> | undefined
    if (byHeader && (agrees[byHeader] ?? true)) type = byHeader
    else {
      if (s.phone >= 0.6) type = 'phone'
      else if (s.email >= 0.6) type = 'email'
      else if (s.zip >= 0.6) type = 'zip'
      else if (s.state >= 0.7 && !categorical) type = 'state'
      else type = 'custom'
      if (byHeader && type !== byHeader) {
        const eg = values.slice(0, 3).join(', ')
        warning = msg("The header says \"{header}\", but the values look different ({sample}). Mapped by what the column actually holds.")
        warningVars = { header: h, sample: eg }
      }
    }
    let customName = h ? slug(h) : ''
    if (type === 'custom') {
      if (!h || (byHeader && warning)) customName = s.age >= 0.6 ? 'age' : `field_${i + 1}`
    }
    guesses.push({ index: i, header: h, type, customName: customName || `field_${i + 1}`, warning, warningVars, sample: values.slice(0, 3) })
  }
  // One name column holding "First Last" for most rows, and no last-name
  // column: that is a full name and should be split.
  const firsts = guesses.filter((g) => g.type === 'first_name')
  if (firsts.length === 1 && !guesses.some((g) => g.type === 'last_name')) {
    const col = rows.slice(0, 300).map((r) => (r[firsts[0].index] ?? '').trim()).filter(Boolean)
    if (share(col, (v) => /\s/.test(v)) >= 0.4) firsts[0].type = 'full_name'
  }
  // Only the first column of a kind feeds the field; later ones stay as their own columns.
  const seen = new Set<FieldType>()
  for (const g of guesses) {
    if (g.type === 'custom' || g.type === 'skip') continue
    if (seen.has(g.type)) { g.type = 'custom'; g.customName = g.customName || `field_${g.index + 1}` }
    seen.add(g.type)
  }
  return guesses
}

// ── CLEANING ───────────────────────────────────────────────────────────

export interface CleanOptions { fixCase: boolean; dedupe: boolean; stateFromAreaCode: boolean }

export interface CleanReport {
  rowsIn: number
  leadsOut: number
  removed: { row: number; value: string; reason: string }[]
  duplicates: number
  fixes: { phones: number; states: number; statesFromAreaCode: number; namesSplit: number; namesRecased: number; cellsCleaned: number }
  notes: { row: number; phone: string; note: string; vars?: Record<string, string> }[]
}

/** Strip what the importer would misread: commas, quotes, tabs, line breaks. */
function safeCell(v: string): { v: string; changed: boolean } {
  const out = v.replace(/[\r\n\t]+/g, ' ').replace(/"/g, '').replace(/\s*,\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
  return { v: out, changed: out !== v.trim() }
}

function recase(name: string): { v: string; changed: boolean } {
  if (!name) return { v: name, changed: false }
  const letters = name.replace(/[^A-Za-z]/g, '')
  if (!letters || (letters !== letters.toUpperCase() && letters !== letters.toLowerCase())) return { v: name, changed: false }
  const v = name.toLowerCase().replace(/(^|[\s\-'.])([a-z])/g, (_m, p, c) => p + c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_m, c) => 'Mc' + c.toUpperCase())
  return { v, changed: v !== name }
}

export function cleanLeads(rows: string[][], cols: ColumnGuess[], o: CleanOptions, rowOffset: number) {
  const fixes = { phones: 0, states: 0, statesFromAreaCode: 0, namesSplit: 0, namesRecased: 0, cellsCleaned: 0 }
  const removed: CleanReport['removed'] = []
  const notes: CleanReport['notes'] = []
  const seen = new Set<string>()
  let duplicates = 0

  const col = (t: FieldType) => cols.find((c) => c.type === t)
  const customs = cols.filter((c) => c.type === 'custom' && c.customName.trim())
  const extras: FieldType[] = ['city', 'zip', 'address', 'notes', 'consent_date', 'consent_source', 'consent_description']
  const extraCols = extras.map((t) => col(t)).filter(Boolean) as ColumnGuess[]
  const reserved = new Set(['first_name', 'last_name', 'phone', 'email', 'state', ...extras])
  const usedNames = new Set<string>()
  const customHeaders = customs.map((c) => {
    let n = slug(c.customName) || `field_${c.index + 1}`
    if (reserved.has(n)) n = `${n}_original`
    while (usedNames.has(n)) n = `${n}_2`
    usedNames.add(n)
    return n
  })
  const header = ['first_name', 'last_name', 'phone', 'email', 'state', ...extraCols.map((c) => c.type), ...customHeaders]
  const out: string[][] = [header]

  const phoneCol = col('phone')
  rows.forEach((r, i) => {
    const rowNo = i + rowOffset
    const get = (c?: ColumnGuess) => (c ? (r[c.index] ?? '').trim() : '')
    const rawPhone = phoneCol ? get(phoneCol) : (r.find((v) => isPhoneish(v)) ?? '')
    const p = checkPhone(rawPhone)
    if (!p.ok) { removed.push({ row: rowNo, value: rawPhone || '(empty)', reason: p.reason }); return }
    const ten = p.e164.slice(2)
    if (o.dedupe && seen.has(ten)) { duplicates++; return }
    seen.add(ten)
    if (rawPhone.replace(/\D/g, '') !== ten) fixes.phones++
    if (p.note) notes.push({ row: rowNo, phone: ten, note: p.note })

    let first = get(col('first_name')), last = get(col('last_name'))
    const full = get(col('full_name'))
    if (full && !first && !last) {
      const parts = full.split(/\s+/)
      first = parts[0] ?? ''
      last = parts.slice(1).join(' ')
      if (last) fixes.namesSplit++
    }
    if (o.fixCase) {
      const a = recase(first), b = recase(last)
      if (a.changed || b.changed) fixes.namesRecased++
      first = a.v; last = b.v
    }

    const rawState = get(col('state'))
    let state = ''
    const rs = readState(rawState)
    if (rs) { state = rs.code; if (rs.fixed) fixes.states++ }
    else if (o.stateFromAreaCode) {
      const c = classifyAreaCode(ten.slice(0, 3))
      if (c.kind === 'us') {
        state = c.state; fixes.statesFromAreaCode++
        if (rawState) notes.push({ row: rowNo, phone: ten, note: msg("State \"{value}\" not readable: used the area code's state ({code})"), vars: { value: rawState, code: c.state } })
      }
    } else if (rawState) state = rawState

    const cells = [first, last, ten, get(col('email')), state, ...extraCols.map((c) => get(c)), ...customs.map((c) => get(c))]
    out.push(cells.map((v) => { const s = safeCell(v); if (s.changed) fixes.cellsCleaned++; return s.v }))
  })

  const report: CleanReport = { rowsIn: rows.length, leadsOut: out.length - 1, removed, duplicates, fixes, notes }
  return { out, report }
}

/** Plain comma-joined: cells are already free of commas and quotes. */
export function toImportCsv(table: string[][]): string {
  return table.map((r) => r.join(',')).join('\r\n') + '\r\n'
}

export const TEMPLATE_CSV =
  'first_name,last_name,phone,email,state,city,zip,notes,consent_date,consent_source\r\n' +
  'Jane,Doe,4155550132,jane@example.com,CA,San Francisco,94105,Asked for a callback after 3pm,2026-10-01,Website form\r\n'
