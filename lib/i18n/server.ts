import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, isEnabledLocale, type Locale,
} from './locales'
import { translate, type Dictionary, type Vars } from './translate'
import { loadDictionary } from './dictionaries'

/**
 * The language for this request. English unless something says otherwise.
 * A language address (/es/…) wins over the cookie: it is what a search result
 * linked to.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const h = await headers()
  const fromUrl = h.get(LOCALE_HEADER)
  if (isEnabledLocale(fromUrl)) return fromUrl
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isEnabledLocale(fromCookie)) return fromCookie
  return DEFAULT_LOCALE
})

/** True when this request came in through a language address like /es/faq. */
export const getUrlLocale = cache(async (): Promise<Locale | null> => {
  const fromUrl = (await headers()).get(LOCALE_HEADER)
  return isEnabledLocale(fromUrl) ? fromUrl : null
})

export const getDictionary = cache(async (): Promise<Dictionary | null> =>
  loadDictionary(await getLocale()),
)

/** For server components: `const t = await getT()`. */
export async function getT(): Promise<(text: string, vars?: Vars) => string> {
  const dict = await getDictionary()
  return (text, vars) => translate(dict, text, vars)
}
