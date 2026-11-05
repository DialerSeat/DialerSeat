// ─────────────────────────────────────────────────────────────────────────
// READING A SPREADSHEET ROW BY WHAT ITS HEADERS MEAN
//
// The upload route used to look headers up by exact spelling: 'First Name'
// matched, 'FIRST NAME' did not. A customer's sheet imported with every name
// blank for that reason alone, with the data sitting right there in extra_data,
// and they had to take the file to an AI to rename the columns.
//
// Worse than blank names: a phone column the list didn't recognise ('Cell
// Phone', 'Telephone') fell through to "the first value with 10 or more digits",
// which in a CRM export can be the lead ID, and that is the number that got
// dialed. Recognising the header is what stops that.
//
// Matching ignores case, spaces and punctuation, so 'FIRST NAME', 'first-name'
// and 'First_Name' are one header. Each list runs most specific first, and the
// spellings the route has always accepted stay ahead of the ones added here, so
// a file that already imported correctly reads the same way it did.
//
// Deliberately still no positional guessing: a column with no recognised header
// stays blank and rides along in extra_data. A name is better missing than
// wrong. `number` and `region` are left out because they mean too many other
// things; a phone under `Number` is still found by the digit fallback below.
//
// lib/leadIngest.ts does the same job for CRM webhooks, whose payloads are
// shaped differently (nested objects, no full-row extra_data).
// ─────────────────────────────────────────────────────────────────────────

const FIRST_NAME = [
  'firstname', 'first', 'name',
  'fname', 'givenname', 'fullname', 'contactname', 'leadname', 'customername',
  'clientname', 'ownername',
]

const LAST_NAME = ['lastname', 'last', 'lname', 'surname', 'familyname']

const PHONE = [
  'phone', 'phonenumber', 'mobile', 'cell',
  'cellphone', 'cellnumber', 'mobilephone', 'mobilenumber', 'wireless',
  'wirelessphone', 'telephone', 'telephonenumber', 'tel', 'phone1',
  'phonenumber1', 'phoneno', 'phonenum', 'primaryphone', 'bestphone',
  'contactnumber', 'contactphone', 'leadphone', 'homephone', 'workphone',
  'landline',
]

const EMAIL = ['email', 'emailaddress', 'email1', 'primaryemail', 'mail']

const STATE = [
  'state', 'st', 'statecode', 'stateabbr', 'stateabbreviation',
  'stateprovince', 'stateorprovince', 'province',
]

/** 'FIRST NAME', 'first-name' and 'First_Name' all become 'firstname'. */
export function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface LeadFields {
  first_name: unknown
  last_name: unknown
  phone: string
  email: unknown
  state: unknown
}

/** The standard fields of one header-keyed row, as the file wrote them. */
export function readLeadFields(row: Record<string, unknown>): LeadFields {
  // First non-empty value wins, so an empty 'Phone' beside a filled 'phone'
  // can't blank the row.
  const byKey = new Map<string, unknown>()
  for (const [header, value] of Object.entries(row)) {
    const key = headerKey(header)
    if (value && !byKey.has(key)) byKey.set(key, value)
  }
  const pick = (aliases: string[]): unknown => {
    for (const alias of aliases) {
      const value = byKey.get(alias)
      if (value) return value
    }
    return ''
  }

  return {
    first_name: pick(FIRST_NAME),
    last_name: pick(LAST_NAME),
    // No recognised phone header at all: the first value holding a number.
    phone: (pick(PHONE) || Object.values(row).find((v) =>
      typeof v === 'string' && v.replace(/\D/g, '').length >= 10
    ) || '') as string,
    email: pick(EMAIL),
    state: pick(STATE),
  }
}
