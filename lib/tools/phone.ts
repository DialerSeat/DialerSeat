import { msg } from '@/lib/i18n/msg'
import { normalizeToE164 } from '@/lib/phoneNormalize'
import { isImpossibleUsNumber } from '@/lib/callingWindow'
import { classifyAreaCode } from '@/lib/areaCode'
import { STATE_TIMEZONES } from '@/lib/timezones'

// =============================================================================
// PHONE HELPERS FOR THE FREE TOOLS
// =============================================================================
// Thin wrappers over the rules the dialer itself runs on (normalizeToE164,
// isImpossibleUsNumber, classifyAreaCode, STATE_TIMEZONES), so a number the
// formatter calls clean is a number DialerSeat would accept, and the time zone
// the area code tool shows is the one the dialer uses. Read-only: nothing here
// changes how the dialer behaves.
// =============================================================================

export type PhoneFormat = 'e164' | 'national' | 'dashes' | 'digits'

export type PhoneVerdict =
  | { ok: true; e164: string; areaCode: string; place: string; tz: string | null; note: string | null }
  | { ok: false; reason: string }

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', VI: 'US Virgin Islands', GU: 'Guam', MP: 'Northern Mariana Islands', AS: 'American Samoa',
}

/** States that span more than one time zone; the area code gives the main one. */
export const SPLIT_ZONE_STATES = new Set(['FL', 'TX', 'KY', 'TN', 'IN', 'MI', 'KS', 'NE', 'SD', 'ND', 'ID', 'OR', 'AK'])

/** Ten NANP digits, or null. */
export function nanpDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return d
  if (d.length === 11 && d.startsWith('1')) return d.slice(1)
  return null
}

export function formatNanp(ten: string, format: PhoneFormat): string {
  const a = ten.slice(0, 3), b = ten.slice(3, 6), c = ten.slice(6)
  switch (format) {
    case 'e164': return `+1${ten}`
    case 'national': return `(${a}) ${b}-${c}`
    case 'dashes': return `${a}-${b}-${c}`
    case 'digits': return ten
  }
}

/** Check one value the way the dialer would, and say why when it fails. */
export function checkPhone(raw: string): PhoneVerdict {
  // A label in front of the number is formatting, not data: Facebook lead ads
  // export "p:+15555550100", other tools "tel:", "cell:", "Phone:". The dialer's
  // importer strips non-digits and accepts these, so they are accepted here.
  let value = raw.trim().replace(/^(?:p|ph|phone|tel|cell|mobile|m|c|h|w|home|work)\s*[:#]\s*/i, '')
  if (!value) return { ok: false, reason: msg("Empty") }
  // What a spreadsheet does to a number column. 3175550100.0 still has every
  // digit, and so does 3.175550142E+9 once expanded, because the mantissa carries them
  // all. 3.18E+09 does not: the rest of the number no longer exists anywhere
  // in this file, and guessing it would dial a stranger.
  if (/^\d{10,11}\.0+$/.test(value)) value = value.replace(/\.0+$/, '')
  const sci = value.match(/^(\d)\.?(\d*)e\+?(\d{1,2})$/i)
  if (sci) {
    if (sci[2].length < Number(sci[3])) return { ok: false, reason: msg("Rounded by a spreadsheet: the digits are gone, use the original file") }
    value = sci[1] + sci[2]
  }
  if (/[a-zA-Z]/.test(value.replace(/\b(ext|x)\.?\s*\d+$/i, ''))) return { ok: false, reason: msg("Contains letters") }
  const e164 = normalizeToE164(value.replace(/\s*(ext|x)\.?\s*\d+$/i, ''))
  if (!e164) return { ok: false, reason: msg("Wrong number of digits") }
  if (!e164.startsWith('+1') || e164.length !== 12) return { ok: false, reason: msg("Not a US or Canadian number") }
  const ten = e164.slice(2)
  if (isImpossibleUsNumber(ten)) return { ok: false, reason: msg("Not a number the North American plan can route") }
  const areaCode = ten.slice(0, 3)
  const cls = classifyAreaCode(areaCode)
  switch (cls.kind) {
    case 'us': {
      const tz = STATE_TIMEZONES[cls.state] ?? null
      return { ok: true, e164, areaCode, place: STATE_NAMES[cls.state] ?? cls.state, tz, note: null }
    }
    case 'canada': return { ok: true, e164, areaCode, place: msg("Canada"), tz: null, note: msg("Canadian number: Canadian calling rules apply") }
    case 'toll_free': return { ok: true, e164, areaCode, place: msg("Toll-free"), tz: null, note: msg("Toll-free: a business line, not a person") }
    case 'non_geographic': return { ok: false, reason: msg("Service or non-geographic code, not a person") }
    case 'other_nanp': return { ok: true, e164, areaCode, place: msg("Caribbean / other NANP"), tz: null, note: msg("Outside the US and Canada: international rules and rates") }
    default: return { ok: true, e164, areaCode, place: msg("Unrecognised area code"), tz: null, note: msg("Area code not in our table yet: check it before dialing") }
  }
}

/**
 * Every NANP-shaped number in a block of text: (555) 555-0100, 555.555.0100,
 * +1 555 555 0100, 5555550100. Digits embedded in longer digit runs (order
 * numbers, card numbers) are not taken.
 */
export function extractNanp(text: string): string[] {
  const re = /(?<![\d+])(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?([2-9]\d{2})[\s.\-]?(\d{4})(?!\d)/g
  const out: string[] = []
  for (const m of text.matchAll(re)) out.push(`${m[1]}${m[2]}${m[3]}`)
  return out
}

/** Local time in a time zone, e.g. "2:14 PM Tue". */
export function localTime(tz: string, now = new Date(), locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: 'numeric', minute: '2-digit', weekday: 'short', hour12: true }).format(now)
}

/** Hour of day (0-23) in a time zone. */
export function localHour(tz: string, now = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now)
  return Number(h) % 24
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')).join('\n') + '\n'
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
