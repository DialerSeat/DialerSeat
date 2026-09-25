import 'server-only'
import type { Metadata } from 'next'
import { ENABLED_LOCALES, localizedPath, type Locale } from './locales'
import { getDictionary, getLocale, getUrlLocale } from './server'
import { translate, type Dictionary } from './translate'

// ── PAGE METADATA IN EVERY LANGUAGE ─────────────────────────────────
// For a search in Spanish to land on the Spanish page, the Spanish page has
// to say so: its own canonical URL, hreflang links to every language version
// (and back to English as x-default), and a title and description in Spanish.
//
// While English is the only enabled language this returns the page's metadata
// untouched, so nothing a crawler sees changes until a language goes live.

const APEX = 'https://dialerseat.com'
const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US', es: 'es_LA', 'pt-BR': 'pt_BR', fr: 'fr_FR', ar: 'ar_AR', it: 'it_IT', de: 'de_DE',
}

function pathOf(canonical: unknown): string | null {
  const raw = typeof canonical === 'string' ? canonical : canonical instanceof URL ? canonical.href : null
  if (!raw) return null
  try {
    const u = new URL(raw, APEX)
    return u.host === 'dialerseat.com' ? u.pathname || '/' : null
  } catch {
    return null
  }
}

function tr(v: unknown, dict: Dictionary | null): unknown {
  if (typeof v === 'string') return translate(dict, v)
  if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof URL)) {
    const o = v as Record<string, unknown>
    // Next's title object: { default, template, absolute }
    const out: Record<string, unknown> = { ...o }
    for (const k of ['default', 'absolute', 'template']) if (typeof o[k] === 'string') out[k] = translate(dict, o[k] as string)
    return out
  }
  return v
}

export async function localizeMetadata(meta: Metadata): Promise<Metadata> {
  if (ENABLED_LOCALES.length < 2) return meta
  const path = pathOf(meta.alternates?.canonical)
  if (!path) return meta

  const locale = await getLocale()
  const urlLocale = await getUrlLocale()
  const dict = locale === 'en' ? null : await getDictionary()

  const languages: Record<string, string> = {}
  for (const l of ENABLED_LOCALES) languages[l] = APEX + localizedPath(l, path)
  languages['x-default'] = APEX + path

  const canonical = urlLocale ? APEX + localizedPath(urlLocale, path) : meta.alternates?.canonical

  const out: Metadata = {
    ...meta,
    alternates: { ...meta.alternates, canonical, languages },
  }
  if (dict) {
    out.title = tr(meta.title, dict) as Metadata['title']
    if (meta.description) out.description = translate(dict, meta.description)
    if (meta.openGraph) {
      out.openGraph = {
        ...meta.openGraph,
        ...(meta.openGraph.title ? { title: tr(meta.openGraph.title, dict) as string } : {}),
        ...(meta.openGraph.description ? { description: translate(dict, meta.openGraph.description) } : {}),
        locale: OG_LOCALE[locale],
        ...(urlLocale ? { url: APEX + localizedPath(urlLocale, path) } : {}),
      }
    }
    if (meta.twitter) {
      out.twitter = {
        ...meta.twitter,
        ...(meta.twitter.title ? { title: tr(meta.twitter.title, dict) as string } : {}),
        ...(meta.twitter.description ? { description: translate(dict, meta.twitter.description) } : {}),
      }
    }
  }
  return out
}

/**
 * The root layout's defaults: the description and the Open Graph / Twitter
 * card every page inherits unless it sets its own. There is no canonical here,
 * so no language addresses; this only translates the words, and sets the Open
 * Graph locale, so a shared Spanish page does not preview in English.
 */
export async function localizeSiteMetadata(meta: Metadata): Promise<Metadata> {
  if (ENABLED_LOCALES.length < 2) return meta
  const locale = await getLocale()
  if (locale === 'en') return meta
  const dict = await getDictionary()
  return {
    ...meta,
    title: tr(meta.title, dict) as Metadata['title'],
    ...(meta.description ? { description: translate(dict, meta.description) } : {}),
    ...(meta.openGraph ? {
      openGraph: {
        ...meta.openGraph,
        ...(meta.openGraph.title ? { title: tr(meta.openGraph.title, dict) as string } : {}),
        ...(meta.openGraph.description ? { description: translate(dict, meta.openGraph.description) } : {}),
        locale: OG_LOCALE[locale],
      },
    } : {}),
    ...(meta.twitter ? {
      twitter: {
        ...meta.twitter,
        ...(meta.twitter.title ? { title: tr(meta.twitter.title, dict) as string } : {}),
        ...(meta.twitter.description ? { description: translate(dict, meta.twitter.description) } : {}),
      },
    } : {}),
  }
}
