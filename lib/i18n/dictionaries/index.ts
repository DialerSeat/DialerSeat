import type { Locale } from '../locales'
import type { Dictionary } from '../translate'

// What the browser downloads: only the strings client components render
// (see scripts/i18n/client-dicts.mjs). Each language is its own chunk, so a
// visitor downloads only the language they use, and an English visitor
// downloads none. The server keeps the full dictionaries (lib/i18n/server.ts).
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Dictionary }>> = {
  es: () => import('./client/es.json'),
  'pt-BR': () => import('./client/pt-BR.json'),
  fr: () => import('./client/fr.json'),
  ar: () => import('./client/ar.json'),
  it: () => import('./client/it.json'),
  de: () => import('./client/de.json'),
}

export async function loadDictionary(locale: Locale): Promise<Dictionary | null> {
  if (locale === 'en') return null
  const mod = await LOADERS[locale]()
  return mod.default
}
