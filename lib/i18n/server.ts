import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, isEnabledLocale, type Locale,
} from './locales'
import { translate, type Dictionary, type Vars } from './translate'
import { loadDictionary } from './dictionaries'
import es from './dictionaries/es.json'
import ptBR from './dictionaries/pt-BR.json'
import fr from './dictionaries/fr.json'
import ar from './dictionaries/ar.json'
import it from './dictionaries/it.json'
import de from './dictionaries/de.json'
import zhCN from './dictionaries/zh-CN.json'
import he from './dictionaries/he.json'
import ja from './dictionaries/ja.json'

// On the server every dictionary is bundled, so a lookup never waits on I/O.
const DICTS: Record<Locale, Dictionary | null> = {
  en: null, es, 'pt-BR': ptBR, fr, ar, it, de, 'zh-CN': zhCN, he, ja,
}

/**
 * The language for this request. English unless something says otherwise.
 * A language address (/es/…) wins over the cookie: it is what a search result
 * linked to.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const h = await headers()
  const fromUrl = h.get(LOCALE_HEADER)
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale: Locale = isEnabledLocale(fromUrl)
    ? fromUrl
    : isEnabledLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE
  requestLocale().current = locale
  return locale
})

/** True when this request came in through a language address like /es/faq. */
export const getUrlLocale = cache(async (): Promise<Locale | null> => {
  const fromUrl = (await headers()).get(LOCALE_HEADER)
  return isEnabledLocale(fromUrl) ? fromUrl : null
})

/** The full dictionary, for anything rendered or computed on the server. */
export const getDictionary = cache(async (): Promise<Dictionary | null> =>
  DICTS[await getLocale()],
)

/** The client subset, for handing to LocaleProvider in the browser. */
export const getClientDictionary = cache(async (): Promise<Dictionary | null> =>
  loadDictionary(await getLocale()),
)

/** For server components: `const t = await getT()`. */
export async function getT(): Promise<(text: string, vars?: Vars) => string> {
  const dict = await getDictionary()
  return (text, vars) => translate(dict, text, vars)
}

// The request's language, held in React's per-request cache so t() can read
// it synchronously — including after an await inside an async page, where a
// hook like use() would no longer work. Filled by getLocale(); every page
// calls primeLocale() first, because on a client-side navigation the root
// layout does not re-render and so cannot be relied on to fill it.
const requestLocale = cache((): { current: Locale | null } => ({ current: null }))

/**
 * The language primeLocale() stored for this request, or English. Synchronous,
 * for helpers that build text outside JSX (structured data in lib/schema.ts).
 */
export function currentLocale(): Locale {
  return requestLocale().current ?? DEFAULT_LOCALE
}

/** First line of every server page that shows text: `await primeLocale()`. */
export async function primeLocale(): Promise<void> {
  await getLocale()
}

/**
 * For server components, used inline in JSX exactly like the client `t()`.
 * Reads the language primeLocale() stored for this request; if nothing
 * primed it, that is English — it never throws. For generateMetadata and
 * route handlers, use getT().
 */
export function t(text: string, vars?: Vars): string
/** Anything that is not a string (undefined, a number, JSX) passes through. */
export function t<T>(value: T): T
export function t(text: unknown, vars?: Vars): unknown {
  if (typeof text !== 'string') return text
  return translate(DICTS[requestLocale().current ?? DEFAULT_LOCALE], text, vars)
}
