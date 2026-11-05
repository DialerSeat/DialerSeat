import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENABLED_LOCALES } from '@/lib/i18n/locales'

// =============================================================================
// A CHARACTER FROM THE WRONG ALPHABET
// =============================================================================
// The Japanese for "states" came out as 명記 — a Hangul syllable followed by
// the right kanji. One character, in the middle of a 60-character sentence, on
// a page about trust. Nothing caught it: batch.mjs checks placeholders, the
// brand name and a length ratio, and a single substituted character changes
// none of those. The coverage test only asks whether a translation exists.
//
// Only a Japanese reader would ever have noticed, which on this site means
// nobody would have, because the dictionaries are written here and read by
// customers.
//
// So: assert that each dictionary contains no characters from a script that
// language does not use. Latin stays allowed everywhere, because brand names,
// product names and US legal terms are deliberately left in Latin script by
// lib/i18n/GLOSSARY.md.
// =============================================================================

const DICTS = join(process.cwd(), 'lib', 'i18n', 'dictionaries')

const SCRIPTS = {
  Hangul: /[가-힯ᄀ-ᇿ㄰-㆏]/,
  CJK: /[一-鿿぀-ゟ゠-ヿ]/,
  Cyrillic: /[Ѐ-ӿ]/,
  Devanagari: /[ऀ-ॿ]/,
  Arabic: /[؀-ۿ]/,
  Hebrew: /[֐-׿]/,
  Thai: /[฀-๿]/,
} as const

type ScriptName = keyof typeof SCRIPTS

/** The scripts each language legitimately writes in. */
const ALLOWED: Record<string, ScriptName[]> = {
  ar: ['Arabic'],
  he: ['Hebrew'],
  hi: ['Devanagari'],
  ja: ['CJK'],
  'zh-CN': ['CJK'],
  es: [], 'pt-BR': [], fr: [], it: [], de: [], fil: [],
}

describe('every dictionary is written in its own alphabet', () => {
  for (const locale of ENABLED_LOCALES.filter((l) => l !== 'en')) {
    it(`${locale} has no characters from another script`, () => {
      const allowed = new Set<ScriptName>(ALLOWED[locale] ?? [])
      expect(ALLOWED[locale], `${locale} is not listed in ALLOWED`).toBeDefined()

      const dict: Record<string, string> = JSON.parse(
        readFileSync(join(DICTS, `${locale}.json`), 'utf8')
      )

      const strays: string[] = []
      for (const [name, pattern] of Object.entries(SCRIPTS) as [ScriptName, RegExp][]) {
        if (allowed.has(name)) continue
        for (const [english, translated] of Object.entries(dict)) {
          const hit = pattern.exec(translated)
          if (!hit) continue
          // The English key identifies the entry; the excerpt shows the slip.
          const at = Math.max(0, hit.index - 10)
          strays.push(`${name} in "${english.slice(0, 50)}" → …${translated.slice(at, hit.index + 10)}…`)
        }
      }
      expect(strays.slice(0, 5), `${strays.length} entries use the wrong script`).toEqual([])
    })
  }
})
