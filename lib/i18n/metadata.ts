import 'server-only'
import type { Metadata } from 'next'
import { ENABLED_LOCALES, isLocalizablePath, localizedPath, type Locale } from './locales'
import { shareImageUrl } from '@/lib/shareImage'
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
  en: 'en_US', es: 'es_LA', 'pt-BR': 'pt_BR', fr: 'fr_FR', ar: 'ar_AR', it: 'it_IT', de: 'de_DE', 'zh-CN': 'zh_CN', he: 'he_IL', ja: 'ja_JP',
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

function textOf(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of ['absolute', 'default']) if (typeof o[k] === 'string') return o[k] as string
  }
  return null
}

/**
 * What every page's metadata gets, in every language:
 *
 * - A share image carrying the page's own title (lib/shareImage). A page's
 *   openGraph object replaces the layout's wholesale, so without this the
 *   layout's image was lost on every page that set its own card.
 * - og:site_name and og:locale, lost the same way.
 * - No meta keywords. Google ignores the tag; Bing has said it reads it only
 *   as a spam signal, and advised five to seven terms at most. Pages here
 *   carried 16 on average and the layout 40, competitor names included.
 */
export function withShareImage(meta: Metadata, locale: Locale = 'en'): Metadata {
  const out: Metadata = { ...meta }
  delete out.keywords
  const title = textOf(meta.openGraph?.title) ?? textOf(meta.twitter?.title) ?? textOf(meta.title)
  const url = shareImageUrl(title, locale)
  out.openGraph = {
    siteName: 'DialerSeat',
    locale: OG_LOCALE[locale],
    ...meta.openGraph,
    images: meta.openGraph?.images ?? [{ url, width: 1200, height: 630, alt: title ?? 'DialerSeat' }],
  }
  out.twitter = {
    card: 'summary_large_image',
    ...meta.twitter,
    images: meta.twitter?.images ?? [url],
  }
  return out
}

export async function localizeMetadata(meta: Metadata): Promise<Metadata> {
  const path = pathOf(meta.alternates?.canonical)
  // Language addresses exist only for the paths proxy.ts serves in other
  // languages. Listing hreflang for any other page sent crawlers to 404s.
  if (ENABLED_LOCALES.length < 2 || !path || !isLocalizablePath(path)) return withShareImage(meta, 'en')

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
  return withShareImage(out, locale)
}

/**
 * The root layout's defaults: the description and the Open Graph / Twitter
 * card every page inherits unless it sets its own. There is no canonical here,
 * so no language addresses; this only translates the words, and sets the Open
 * Graph locale, so a shared Spanish page does not preview in English.
 */
export async function localizeSiteMetadata(meta: Metadata): Promise<Metadata> {
  const base: Metadata = { ...meta }
  delete base.keywords
  if (ENABLED_LOCALES.length < 2) return base
  const locale = await getLocale()
  if (locale === 'en') return base
  const dict = await getDictionary()
  return {
    ...base,
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
