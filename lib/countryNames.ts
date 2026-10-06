import { msg } from '@/lib/i18n/msg'
import type { CountryRule } from '@/lib/countryRules'

// Country names are one or two words, which the catalog extractor does not
// take as text, so they are listed here to be found and translated. Kept out
// of lib/countryRules.ts, which the markdown mirrors and llms files read and
// which stays free of i18n calls like the other data files.
const COUNTRY_NAMES = new Set<string>([
  msg('United States'), msg('Canada'), msg('United Kingdom'), msg('Australia'), msg('South Africa'),
  msg('Mexico'), msg('Colombia'), msg('Chile'), msg('Brazil'), msg('Spain'), msg('France'),
  msg('Germany'), msg('Italy'), msg('Philippines'), msg('India'),
])

/** The country's name through a translator (t() in render, getT() in metadata). */
export function countryName(tr: (s: string) => string, c: Pick<CountryRule, 'name'>): string {
  return COUNTRY_NAMES.has(c.name) ? tr(c.name) : c.name
}
