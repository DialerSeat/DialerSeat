import { beforeEach, describe, expect, it, vi } from 'vitest'

// Every chained query resolves to an empty result except the two the route
// reads back; inserts are captured so the test sees exactly what would be saved.
type Row = Record<string, unknown>
const inserted: Row[] = []
const builder = () => {
  const b = {
    select: () => b, eq: () => b, in: () => b, update: () => b,
    maybeSingle: async () => ({ data: { id: 'c1', user_id: 'u1', total_leads: 0 } }),
    insert: async (rows: Row[]) => { inserted.push(...rows); return { error: null } },
    then: (ok: (r: Row) => void) => ok({ data: [], error: null, count: 0 }),
  }
  return b
}
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => builder() } }))
vi.mock('@/lib/subscription', () => ({ requireActive: async () => null }))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'u1' }) }))

import { POST } from '@/app/api/leads/upload/route'
import { parseCSVText } from '@/lib/parseLeadsFile'
import { headerKey, readLeadFields } from '@/lib/leadHeaders'

// All names and numbers are fictional (reserved 555-01xx).
async function upload(csv: string) {
  const res = await POST(new Request('http://x/api/leads/upload', {
    method: 'POST',
    body: JSON.stringify({ campaign_id: 'c1', leads: parseCSVText(csv) }),
  }))
  return { status: res.status, body: await res.json() }
}

describe('uploading a sheet, through the real parser and route', () => {
  beforeEach(() => { inserted.length = 0 })

  it('fills names from headers in any case: the sheet that imported blank', async () => {
    const { body } = await upload('FIRST NAME,Last name,E-MAIL,PHONE NUMBER,STATE\nJane,Doe,jane@example.com,p:+12145550101,TX')
    expect(body.success).toBe(true)
    expect(inserted[0]).toMatchObject({
      first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', phone: '12145550101', state: 'TX',
    })
  })

  it('dials the Cell Phone column, not a lead ID that happens to come first', async () => {
    await upload('Lead ID,Full Name,Cell Phone\n9998887777,Sam Roe,(317) 555-0102')
    expect(inserted[0].phone).toBe('3175550102')
    expect(inserted[0].first_name).toBe('Sam Roe')
  })

  it('keeps the whole row in extra_data under the headers the file used', async () => {
    await upload('FIRST NAME,Phone,Policy Type\nJane,2145550103,Term')
    expect(inserted[0].extra_data).toEqual({ 'FIRST NAME': 'Jane', Phone: '2145550103', 'Policy Type': 'Term' })
  })

  it('still rejects a bad number with its reason rather than hunting for another', async () => {
    const { body } = await upload('Name,Phone,Lead ID\nJane,555-0108,2145550104')
    expect(inserted).toHaveLength(0)
    expect(body.rejections[0].reason).toBe('phone_too_short')
  })
})

describe('readLeadFields', () => {
  it('reads every spelling the route has always accepted, the same way', () => {
    for (const h of ['first_name', 'First Name', 'firstname', 'FirstName', 'first', 'First', 'name', 'Name']) {
      expect(readLeadFields({ [h]: 'X' }).first_name).toBe('X')
    }
    for (const h of ['last_name', 'Last Name', 'lastname', 'LastName', 'last', 'Last']) {
      expect(readLeadFields({ [h]: 'X' }).last_name).toBe('X')
    }
    for (const h of ['phone', 'Phone', 'phone_number', 'Phone Number', 'PHONE', 'mobile', 'Mobile', 'cell', 'Cell']) {
      expect(readLeadFields({ [h]: '123' }).phone).toBe('123')
    }
    for (const h of ['email', 'Email', 'EMAIL']) expect(readLeadFields({ [h]: 'X' }).email).toBe('X')
    for (const h of ['state', 'State', 'STATE']) expect(readLeadFields({ [h]: 'X' }).state).toBe('X')
  })

  it('prefers a specific first name to a Name column, and a Phone to a Mobile, as before', () => {
    expect(readLeadFields({ Name: 'Whole', 'FIRST NAME': 'Part' }).first_name).toBe('Part')
    expect(readLeadFields({ Mobile: '2', PHONE: '1' }).phone).toBe('1')
  })

  it('skips an empty column for a filled one with the same meaning', () => {
    expect(readLeadFields({ Phone: '', 'PHONE NUMBER': '2145550105' }).phone).toBe('2145550105')
  })

  it('falls back to the first value with a number when no phone header is recognised', () => {
    expect(readLeadFields({ Name: 'Jane', Number: '2145550106' }).phone).toBe('2145550106')
  })

  it('never guesses a name from an unrecognised column', () => {
    const f = readLeadFields({ Veteran: 'yes', Age: '74', Phone: '2145550107' })
    expect(f.first_name).toBe('')
    expect(f.last_name).toBe('')
  })

  it('normalises case, spaces and punctuation', () => {
    expect(headerKey(' First-Name: ')).toBe('firstname')
    expect(headerKey('﻿Phone #')).toBe('phone')
  })
})
