import type { Locale } from '../locales'
import type { Dictionary } from '../translate'

// One JSON file per language, keyed by the English text. Each is its own
// chunk, so a visitor downloads only the language they use, and an English
// visitor downloads none.
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Dictionary }>> = {
  es: () => import('./es.json'),
  'pt-BR': () => import('./pt-BR.json'),
  fr: () => import('./fr.json'),
  ar: () => import('./ar.json'),
  it: () => import('./it.json'),
  de: () => import('./de.json'),
}

export async function loadDictionary(locale: Locale): Promise<Dictionary | null> {
  if (locale === 'en') return null
  const mod = await LOADERS[locale]()
  return mod.default
}
