// ─────────────────────────────────────────────────────────────────────────
// NORMALISING A LEAD FROM SOMEBODY ELSE'S CRM
//
// Nobody's CRM uses our field names. A vendor exporting from GoHighLevel sends
// `phone`, from HubSpot `properties.phone`, from a Google Sheet whatever the
// column header happened to say. Rejecting a payload because it said
// "Phone Number" instead of "phone" is the single most common way an
// integration dies during setup — the sender has no idea what we wanted, and
// tries twice before giving up.
//
// So this accepts what people actually send. Everything unrecognised is kept in
// extra_data rather than discarded, because a field we did not anticipate is
// usually the one the agent needs on screen.
// ─────────────────────────────────────────────────────────────────────────

const ALIASES: Record<string, string[]> = {
  phone: [
    'phone', 'phone_number', 'phonenumber', 'phone1', 'primary_phone',
    'mobile', 'mobile_phone', 'cell', 'cell_phone', 'telephone', 'tel',
    'contact_number', 'number',
  ],
  first_name: ['first_name', 'firstname', 'fname', 'given_name', 'first'],
  last_name: ['last_name', 'lastname', 'lname', 'surname', 'family_name', 'last'],
  email: ['email', 'email_address', 'emailaddress', 'e_mail'],
  address: ['address', 'address1', 'address_line_1', 'street', 'street_address'],
  city: ['city', 'town', 'locality'],
  state: ['state', 'province', 'region', 'st'],
  zip: ['zip', 'zipcode', 'zip_code', 'postal_code', 'postcode'],
  notes: ['notes', 'note', 'comments', 'comment', 'description'],
  consent_source: ['consent_source', 'opt_in_source', 'lead_source', 'source'],
  consent_description: ['consent_description', 'opt_in_text', 'tcpa_language', 'disclosure'],
  consent_date: ['consent_date', 'opt_in_date', 'opted_in_at', 'consent_timestamp'],
}

/** "First Name", "first-name" and "FIRSTNAME" are the same field. */
function normaliseKey(k: string): string {
  return k.toLowerCase().replace(/[\s\-.]+/g, '_').replace(/[^a-z0-9_]/g, '')
}

/** A full name in one field is extremely common. Split on the first space so
 *  "Mary Jane Watson" becomes Mary / Jane Watson rather than being dropped. */
function splitFullName(v: string): { first: string; last: string } {
  const parts = String(v).trim().split(/\s+/)
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/**
 * US ten-digit normalisation.
 *
 * Returns null rather than guessing when the digits do not describe a dialable
 * US number. A lead we cannot call is not a lead, and inserting it means an
 * agent eventually reaches it in the queue and burns a turn on a number that
 * was never going to connect.
 */
export function normalisePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

export interface NormalisedLead {
  phone: string
  first_name: string | null
  last_name: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  consent_source: string | null
  consent_description: string | null
  consent_date: string | null
  extra_data: Record<string, any>
}

export function normaliseLead(input: any): NormalisedLead | null {
  if (!input || typeof input !== 'object') return null

  // Flatten one level. HubSpot and friends nest everything under `properties`,
  // and a payload that arrives shaped differently is not a payload that should
  // be rejected.
  const flat: Record<string, any> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, any>)) {
        if (v2 !== null && typeof v2 !== 'object') flat[normaliseKey(k2)] = v2
      }
    } else {
      flat[normaliseKey(k)] = v
    }
  }

  const pick = (field: string): any => {
    for (const alias of ALIASES[field] || []) {
      if (flat[alias] !== undefined && flat[alias] !== null && flat[alias] !== '') {
        return flat[alias]
      }
    }
    return null
  }

  const phone = normalisePhone(pick('phone'))
  if (!phone) return null

  let first = pick('first_name')
  let last = pick('last_name')
  if (!first && !last) {
    const full = flat['name'] || flat['full_name'] || flat['fullname'] || flat['contact_name']
    if (full) {
      const s = splitFullName(String(full))
      first = s.first
      last = s.last || null
    }
  }

  // Anything we did not map is kept. A vendor sending `policy_type` or
  // `lead_score` is sending it because it matters to their closers, and
  // silently dropping it makes the integration look lossy.
  const known = new Set<string>(['name', 'full_name', 'fullname', 'contact_name'])
  for (const list of Object.values(ALIASES)) for (const a of list) known.add(a)
  const extra: Record<string, any> = {}
  for (const [k, v] of Object.entries(flat)) {
    if (!known.has(k) && v !== null && v !== '' && String(v).length < 500) extra[k] = v
  }

  const str = (v: any, max = 200): string | null => {
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    return s ? s.slice(0, max) : null
  }

  let consentDate: string | null = null
  const rawConsent = pick('consent_date')
  if (rawConsent) {
    const d = new Date(rawConsent)
    if (!isNaN(d.getTime())) consentDate = d.toISOString()
  }

  return {
    phone,
    first_name: str(first, 80),
    last_name: str(last, 80),
    email: str(pick('email'), 200),
    address: str(pick('address'), 200),
    city: str(pick('city'), 100),
    state: str(pick('state'), 60),
    zip: str(pick('zip'), 20),
    notes: str(pick('notes'), 1000),
    consent_source: str(pick('consent_source'), 120),
    consent_description: str(pick('consent_description'), 1000),
    consent_date: consentDate,
    extra_data: extra,
  }
}

/** Payloads arrive as one lead, an array, or wrapped in a container key —
 *  all three are what real senders produce, so all three are accepted. */
export function extractLeads(body: any): any[] {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return []
  for (const key of ['leads', 'data', 'records', 'items', 'rows', 'contacts']) {
    if (Array.isArray(body[key])) return body[key]
  }
  return [body]
}
