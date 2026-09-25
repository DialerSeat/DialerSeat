import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NEVER_TRANSLATED, translate } from '@/lib/i18n/translate'
import {
  ENABLED_LOCALES, LOCALES, localeFromAcceptLanguage, localizedPath,
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
})

describe('dictionaries', () => {
  const dir = path.resolve(__dirname, '../../lib/i18n/dictionaries')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))

  it('never translate the DialerSeat name', () => {
    for (const f of files) {
      const dict = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string>
      for (const [en, tr] of Object.entries(dict)) {
        for (const name of NEVER_TRANSLATED) {
          const count = (s: string) => s.split(name).length - 1
          expect(count(tr), `${f}: "${en}" must keep "${name}"`).toBe(count(en))
        }
      }
    }
  })

  it('keep every {placeholder}', () => {
    for (const f of files) {
      const dict = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, string>
      for (const [en, tr] of Object.entries(dict)) {
        const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
        expect(vars(tr), `${f}: "${en}"`).toBe(vars(en))
      }
    }
  })
})
