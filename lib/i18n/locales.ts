// ── INTERFACE LANGUAGES ─────────────────────────────────────────────
// English is the source. Every other language is a translation of the English
// text, keyed by that text, and a language only appears in the dropdown once
// it is in ENABLED_LOCALES. Nothing here decides what an English visitor sees:
// with no cookie, no account setting and no click, the answer is English.
//
// This module is plain data with no React and no Next imports, so the server
// layout, the client provider, the proxy and the tests can all share it.

export const LOCALES = [
  { code: 'en', label: 'English', short: 'EN', dir: 'ltr' },
  { code: 'es', label: 'Español', short: 'ES', dir: 'ltr' },
  { code: 'pt-BR', label: 'Português (Brasil)', short: 'PT', dir: 'ltr' },
  { code: 'fr', label: 'Français', short: 'FR', dir: 'ltr' },
  { code: 'ar', label: 'العربية', short: 'AR', dir: 'rtl' },
  { code: 'it', label: 'Italiano', short: 'IT', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', short: 'DE', dir: 'ltr' },
  { code: 'zh-CN', label: '简体中文', short: '中文', dir: 'ltr' },
  { code: 'he', label: 'עברית', short: 'HE', dir: 'rtl' },
  { code: 'ja', label: '日本語', short: 'JA', dir: 'ltr' },
] as const

export type Locale = (typeof LOCALES)[number]['code']

export const DEFAULT_LOCALE: Locale = 'en'

// Hidden until translated. A language goes in here only when its dictionary
// covers every string in the catalog — tests/unit/i18nCoverage.test.ts fails
// the build otherwise — because a half-translated screen reads as broken.
export const ENABLED_LOCALES: readonly Locale[] = ['en', 'es', 'pt-BR', 'fr', 'ar', 'it', 'de']

export const LOCALE_COOKIE = 'ds_lang'
// Set once the visitor has answered the language prompt either way, so it
// never asks twice.
export const PROMPT_COOKIE = 'ds_lang_prompted'

// Set by proxy.ts on requests that came in through a language address, so the
// server knows the language and the unprefixed path of the page.
export const LOCALE_HEADER = 'x-ds-locale'
export const LOCALE_PATH_HEADER = 'x-ds-path'

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && LOCALES.some((l) => l.code === v)
}

export function isEnabledLocale(v: unknown): v is Locale {
  return isLocale(v) && ENABLED_LOCALES.includes(v)
}

export function localeInfo(code: Locale) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0]
}

export function localeDir(code: Locale): 'ltr' | 'rtl' {
  return localeInfo(code).dir
}

// ── WHICH LANGUAGE TO OFFER ─────────────────────────────────────────
// The prompt only ever asks, and only offers a language that is enabled.
//
// The device's own language comes first: a Spanish-speaking agent in Texas has
// a Spanish phone and a US IP, and the phone is the one that knows what they
// read. Location is the fallback for the common offshore case — a Colombian
// agent on a phone left in English — and it is deliberately silent for places
// where call-centre work is done in English (the Philippines, India, Jamaica),
// which simply have no entry below.

const COUNTRY_LOCALE: Record<string, Locale> = {
  // Spanish
  MX: 'es', CO: 'es', DO: 'es', GT: 'es', SV: 'es', HN: 'es', NI: 'es',
  CR: 'es', PA: 'es', PE: 'es', EC: 'es', VE: 'es', BO: 'es', CL: 'es',
  AR: 'es', UY: 'es', PY: 'es', ES: 'es', PR: 'es', CU: 'es',
  // Portuguese
  BR: 'pt-BR', PT: 'pt-BR', AO: 'pt-BR', MZ: 'pt-BR',
  // French — Moroccan and Tunisian centres work in French
  FR: 'fr', MA: 'fr', TN: 'fr', DZ: 'fr', SN: 'fr', CI: 'fr', MG: 'fr',
  CM: 'fr', BE: 'fr', HT: 'fr',
  // Arabic
  EG: 'ar', SA: 'ar', AE: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
  JO: 'ar', LB: 'ar', IQ: 'ar',
  // Italian
  IT: 'it', AL: 'it',
  // German
  DE: 'de', AT: 'de', CH: 'de',
  // Mandarin, in simplified characters
  CN: 'zh-CN', SG: 'zh-CN',
  // Hebrew
  IL: 'he',
  // Japanese
  JP: 'ja',
}

/** The first non-English enabled language in an Accept-Language header. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 }
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of tags) {
    // The device's top choice being English settles it: do not dig past it
    // for a secondary language the person did not put first.
    if (tag === 'en' || tag.startsWith('en-')) return null
    const base = tag.split('-')[0]
    // Chinese devices say zh-CN, zh-Hans or plain zh; older Android still
    // sends Hebrew under its retired code, iw.
    const match: Locale | null =
      base === 'pt' ? 'pt-BR' : base === 'zh' ? 'zh-CN' : base === 'iw' ? 'he' : isLocale(base) ? base : null
    if (match && match !== 'en') return match
  }
  return null
}

/**
 * The language worth offering this visitor, or null to not ask at all.
 * Never English — English is what they already have.
 */
export function suggestLocale(
  country: string | null | undefined,
  acceptLanguage: string | null | undefined,
): Locale | null {
  const fromDevice = localeFromAcceptLanguage(acceptLanguage)
  if (fromDevice) return isEnabledLocale(fromDevice) ? fromDevice : null
  // An English (or absent) device falls through to location, because offshore
  // centres routinely leave their phones in English.
  const fromCountry = country ? COUNTRY_LOCALE[country.toUpperCase()] : undefined
  return fromCountry && isEnabledLocale(fromCountry) ? fromCountry : null
}

// ── LANGUAGE ADDRESSES FOR SEARCH ───────────────────────────────────
// A search engine indexes URLs, not cookies. So every public page also exists
// at /es/…, /pt-br/… and so on, rendered in that language, and each page lists
// the others as hreflang alternates. That is how a search in Spanish finds the
// Spanish page. English keeps its existing, unprefixed URLs — nothing moves.

const URL_SLUG: Record<Exclude<Locale, 'en'>, string> = {
  es: 'es',
  'pt-BR': 'pt-br',
  fr: 'fr',
  ar: 'ar',
  it: 'it',
  de: 'de',
  'zh-CN': 'zh-cn',
  he: 'he',
  ja: 'ja',
}

/** The URL prefix for a language, e.g. "/es". Empty for English. */
export function localePrefix(locale: Locale): string {
  return locale === 'en' ? '' : `/${URL_SLUG[locale]}`
}

/** "/faq" in Spanish is "/es/faq"; "/" is "/es". */
export function localizedPath(locale: Locale, path: string): string {
  const prefix = localePrefix(locale)
  if (!prefix) return path
  return path === '/' ? prefix : `${prefix}${path}`
}

/**
 * An internal link as a reader of `locale` should follow it: "/pricing#faq"
 * on a Spanish page is "/es/pricing#faq". Untouched in English, for anything
 * that is not a site path, and for paths with no language version.
 */
export function localeHref(href: string, locale: Locale): string {
  if (locale === 'en' || !href.startsWith('/') || href.startsWith('//')) return href
  const cut = href.search(/[?#]/)
  const path = (cut === -1 ? href : href.slice(0, cut)) || '/'
  if (!isLocalizablePath(path)) return href
  return localizedPath(locale, path) + (cut === -1 ? '' : href.slice(cut))
}

/**
 * Splits "/es/faq" into { locale: 'es', rest: '/faq' }. Only enabled languages
 * count: a prefix for a language that is not live yet is just a path, and
 * 404s like any other unknown one.
 */
export function splitLocalePrefix(pathname: string): { locale: Locale; rest: string } | null {
  for (const [locale, slug] of Object.entries(URL_SLUG) as [Locale, string][]) {
    if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
      if (!isEnabledLocale(locale)) return null
      return { locale, rest: pathname.slice(slug.length + 1) || '/' }
    }
  }
  return null
}

// Stripe Elements' own locale codes (docs.stripe.com/js/appendix/supported_locales).
// Spanish is es-419, Latin American. English returns undefined so the
// payment form keeps the options it has always had.
const STRIPE_LOCALE: Record<Exclude<Locale, 'en'>, 'es-419' | 'pt-BR' | 'fr' | 'ar' | 'it' | 'de' | 'zh' | 'he' | 'ja'> = {
  es: 'es-419', 'pt-BR': 'pt-BR', fr: 'fr', ar: 'ar', it: 'it', de: 'de', 'zh-CN': 'zh', he: 'he', ja: 'ja',
}
export function stripeLocale(locale: Locale) {
  return locale === 'en' ? undefined : STRIPE_LOCALE[locale]
}

// The public pages that have language addresses. Mirrors MARKETING_ONLY_PATHS
// in proxy.ts, which is what actually serves /es/… — keep the two in step.
export function isLocalizablePath(path: string): boolean {
  return path === '/' ||
    /^\/(faq|vs|dialing-modes|data|tools|managers|white-label)(\/|$)/.test(path) ||
    /^\/(pricing|features|about|resources|terms|privacy)$/.test(path)
}
