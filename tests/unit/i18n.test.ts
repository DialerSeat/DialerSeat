import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NEVER_TRANSLATED, translate } from '@/lib/i18n/translate'
import {
  ENABLED_LOCALES, LOCALES, localeFromAcceptLanguage, localeHref, localizedPath,
} from '@/lib/i18n/locales'

describe('translate', () => {
  it('returns English untouched when there is no dictionary', () => {
    expect(translate(null, 'Start dialing')).toBe('Start dialing')
    expect(translate(null, 'Price is {amount} {weird')).toBe('Price is {amount} {weird')
  })

  it('falls back to English for a missing entry', () => {
    expect(translate({ Hello: 'Hola' }, 'Goodbye')).toBe('Goodbye')
    expect(translate({ Hello: 'Hola' }, 'Hello')).toBe('Hola')
  })

  it('fills placeholders only when values are passed', () => {
    expect(translate(null, '{n} leads', { n: 3 })).toBe('3 leads')
    expect(translate({ '{n} leads': '{n} prospectos' }, '{n} leads', { n: 3 })).toBe('3 prospectos')
    expect(translate(null, '{n} and {m}', { n: 1 })).toBe('1 and {m}')
  })
})

describe('languages', () => {
  it('English is always enabled and first', () => {
    expect(ENABLED_LOCALES[0]).toBe('en')
    expect(LOCALES[0].code).toBe('en')
  })

  it('reads the device language, letting an English first choice win', () => {
    expect(localeFromAcceptLanguage('es-CO,es;q=0.9,en;q=0.8')).toBe('es')
    expect(localeFromAcceptLanguage('pt-BR,pt;q=0.9')).toBe('pt-BR')
    expect(localeFromAcceptLanguage('en-US,en;q=0.9,es;q=0.8')).toBeNull()
    expect(localeFromAcceptLanguage('')).toBeNull()
    expect(localeFromAcceptLanguage('ja,zh;q=0.5')).toBeNull()
  })

  it('English keeps its existing, unprefixed addresses', () => {
    expect(localizedPath('en', '/faq/billing')).toBe('/faq/billing')
    expect(localizedPath('es', '/faq/billing')).toBe('/es/faq/billing')
    expect(localizedPath('es', '/')).toBe('/es')
    expect(localizedPath('pt-BR', '/vs')).toBe('/pt-br/vs')
  })

  it("internal links stay in the page's language, only where a language version exists", () => {
    // English pages render exactly as before.
    expect(localeHref('/pricing', 'en')).toBe('/pricing')
    expect(localeHref('/pricing', 'es')).toBe('/es/pricing')
    expect(localeHref('/', 'de')).toBe('/de')
    expect(localeHref('/pricing#faq', 'fr')).toBe('/fr/pricing#faq')
    expect(localeHref('/vs/mojo?ref=rail', 'pt-BR')).toBe('/pt-br/vs/mojo?ref=rail')
    expect(localeHref('/faq/dialer-for-solar', 'ar')).toBe('/ar/faq/dialer-for-solar')
    // No language version: sign-up, the app, status, the llms files.
    expect(localeHref('/sign-up', 'es')).toBe('/sign-up')
    expect(localeHref('/dashboard', 'es')).toBe('/dashboard')
    expect(localeHref('/status', 'it')).toBe('/status')
    expect(localeHref('/llms.txt', 'it')).toBe('/llms.txt')
    // Not a site path.
    expect(localeHref('https://example.com/pricing', 'es')).toBe('https://example.com/pricing')
    expect(localeHref('//cdn.example.com/x', 'es')).toBe('//cdn.example.com/x')
    expect(localeHref('#top', 'es')).toBe('#top')
    expect(localeHref('mailto:hello@dialerseat.com', 'es')).toBe('mailto:hello@dialerseat.com')
  })
})

describe('dictionaries', () => {
  const dir = path.resolve(__dirname, '../../lib/i18n/dictionaries')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))

  it('never translate the DialerSeat name', () => {
    // Collected and asserted once: an expect per string made this the slowest
    // test in the suite once several full dictionaries existed.
    const bad: string[] = []
    for (const f of files) {
      const dict = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string>
      for (const [en, tr] of Object.entries(dict)) {
        for (const name of NEVER_TRANSLATED) {
          const count = (s: string) => s.split(name).length - 1
          if (count(tr) !== count(en)) bad.push(`${f}: "${en}" must keep "${name}"`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('keep every {placeholder}', () => {
    // A placeholder glued to a word (lead{value}, where value is '' or 's') is an
    // English plural ending. Arabic and other languages do not pluralise by suffix,
    // so a translation may leave that one out. Every other placeholder must stay,
    // and a translation may never invent one.
    const bad: string[] = []
    for (const f of files) {
      const dict = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string>
      for (const [en, tr] of Object.entries(dict)) {
        const all = (s: string) => new Set(s.match(/\{\w+\}/g) ?? [])
        const suffix = new Set([...en.matchAll(/[A-Za-z](\{\w+\})/g)].map((m) => m[1]))
        const need = [...all(en)].filter((v) => !suffix.has(v)).sort().join(',')
        const got = [...all(tr)].filter((v) => !suffix.has(v)).sort().join(',')
        if (got !== need) bad.push(`${f}: "${en}" has ${got || 'none'}, needs ${need || 'none'}`)
        for (const v of all(tr)) if (!all(en).has(v)) bad.push(`${f}: invented ${v} in "${en}"`)
      }
    }
    expect(bad).toEqual([])
  })
})
