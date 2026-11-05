import { describe, expect, it } from 'vitest'
import { parseDelimited, looksLikeHeader, guessColumns, cleanLeads, toImportCsv, readState } from '@/lib/tools/leadSheet'
import { checkPhone, extractNanp } from '@/lib/tools/phone'
import { parseCSVText } from '@/lib/parseLeadsFile'
import { normalizeState } from '@/lib/normalizeState'

// The lead list cleaner promises a sheet that imports with nothing lost, so
// these tests run its output through the real parser the dashboard uses and
// read it with the header names app/api/leads/upload actually matches.
// All names and numbers are fictional (reserved 555-01xx).

const BROKEN = `FIRST NAME,Last name,Email,phone_number,state
Sam T. Example,veteran,74,p:+12145550101,TX
JORDAN SAMPLE,veteran,87,p:+13175550102,Indiana
Avery Placeholder,spouse_of_veteran,62,p:+14175550103,m0
Riley Testcase,spouse_of_veteran,82,p:+12075550104,somewhere Maine 04000
casey demo,widow_of_veteran,92,p:+19735550105,newjersey
Morgan Fictional,veteran,70,p:+18085550106,Yes
Taylor Sue Example,spouse_of_veteran,69 years old,p:+19185550107,Oklahoma
Taylor Sue Example,spouse_of_veteran,69 years old,p:+19185550107,Oklahoma
Short Number,veteran,70,555-0108,NY
Pat Filler,veteran,71,p:+12145550109,TX
Lee Stand In,veteran,72,p:+12145550110,TX`

function run(text: string) {
  const rows = parseDelimited(text)
  const hasHeader = looksLikeHeader(rows[0])
  const body = hasHeader ? rows.slice(1) : rows
  const cols = guessColumns(hasHeader ? rows[0] : null, body)
  const { out, report } = cleanLeads(body, cols, { fixCase: true, dedupe: true, stateFromAreaCode: true }, hasHeader ? 2 : 1)
  return { cols, out, report, csv: toImportCsv(out) }
}

describe('lead list cleaner', () => {
  it('sees through headers that do not match their columns', () => {
    const { cols } = run(BROKEN)
    expect(cols[0].type).toBe('full_name')
    expect(cols[1].type).toBe('custom')
    expect(cols[1].warning).toContain('Last name')
    expect(cols[2].type).toBe('custom')
    expect(cols[2].customName).toBe('age')
    expect(cols[3].type).toBe('phone')
    expect(cols[4].type).toBe('state')
  })

  it('produces a file the real importer reads with every name, phone and state', () => {
    const { csv, report } = run(BROKEN)
    const leads = parseCSVText(csv) as Record<string, string>[]
    expect(leads).toHaveLength(report.leadsOut)
    for (const l of leads) {
      expect(l['first_name']).toBeTruthy()
      expect(l['phone']).toMatch(/^\d{10}$/)
      expect(normalizeState(l['state'])).toBe(l['state'])
    }
  })

  it('reports what it removed and why', () => {
    const { report } = run(BROKEN)
    expect(report.duplicates).toBe(1)
    expect(report.removed).toHaveLength(1)
    expect(report.removed[0].value).toBe('555-0108')
    expect(report.fixes.namesSplit).toBeGreaterThan(0)
  })

  it('splits names and fixes only all-caps or all-lowercase ones', () => {
    const { out } = run(BROKEN)
    const firsts = out.slice(1).map((r) => `${r[0]}|${r[1]}`)
    expect(firsts).toContain('Jordan|Sample')
    expect(firsts).toContain('Casey|Demo')
    expect(firsts).toContain('Sam|T. Example')
  })

  it('never leaves a comma or quote in a cell, which the importer would misread', () => {
    const { csv } = run(`name,phone,state,notes\n"Doe, Jane",2145550111,TX,"said ""call back"", after 3pm"`)
    const leads = parseCSVText(csv) as Record<string, string>[]
    expect(leads[0]['state']).toBe('TX')
    expect(leads[0]['phone']).toBe('2145550111')
    expect(csv).not.toContain('"')
  })

  it('reads states typed every way, and fills from the area code when it must', () => {
    expect(readState('pa.')?.code).toBe('PA')
    expect(readState('m0')?.code).toBe('MO')
    expect(readState('Mich')?.code).toBe('MI')
    expect(readState('newjersey')?.code).toBe('NJ')
    expect(readState('NewYork')?.code).toBe('NY')
    expect(readState('cleveland .ohio')?.code).toBe('OH')
    expect(readState('Yes')).toBeNull()
    const { out, report } = run(BROKEN)
    expect(out.slice(1).find((r) => r[2] === '8085550106')?.[4]).toBe('HI')
    expect(report.notes.some((n) => n.note.includes('Yes'))).toBe(true)
  })

  it('handles a sheet with no header row', () => {
    const { out } = run('Dana Example,2145550112,TX\nRobin Sample,3175550113,IN')
    expect(out[0].slice(0, 3)).toEqual(['first_name', 'last_name', 'phone'])
    expect(out).toHaveLength(3)
  })
})

describe('phone helpers', () => {
  it('accepts labelled numbers and rejects impossible ones', () => {
    expect(checkPhone('p:+12145550101').ok).toBe(true)
    expect(checkPhone('tel: (214) 555-0101').ok).toBe(true)
    expect(checkPhone('(011) 555-0199').ok).toBe(false)
    expect(checkPhone('John Smith 617 555 0143').ok).toBe(false)
  })

  it('extracts numbers from text without taking digits out of longer runs', () => {
    expect(extractNanp('Call (312) 555-0147 or 312.555.0188. Order #4155550132998')).toEqual(['3125550147', '3125550188'])
  })
})
