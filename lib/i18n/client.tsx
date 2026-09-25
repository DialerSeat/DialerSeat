'use client'

// ── CLIENT TRANSLATION ──────────────────────────────────────────────
// `t()` is a plain function, not a hook, so it can be dropped into any client
// component — in JSX, in a toast, in a confirm() — without restructuring it.
//
// How it stays correct:
//  - While React is rendering, t() reads the language through context with
//    use(). That makes it per-request during server rendering (no visitor ever
//    sees another visitor's language), and it subscribes the component, so
//    choosing a language re-renders every component that shows text without
//    remounting anything. The dialer keeps its call.
//  - Outside rendering (click handlers, effects), there is one person in one
//    browser, so it reads the module-level copy the provider keeps in step.
//  - English has no dictionary, so every path returns the English unchanged.

import * as React from 'react'
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE, LOCALE_COOKIE, PROMPT_COOKIE, isEnabledLocale, localeDir, type Locale,
} from './locales'
import { translate, type Dictionary, type Vars } from './translate'
import { loadDictionary } from './dictionaries'

interface I18nState {
  locale: Locale
  dict: Dictionary | null
}

interface I18nContextValue extends I18nState {
  setLocale: (next: Locale, opts?: { persist?: boolean }) => Promise<void>
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  dict: null,
  setLocale: async () => {},
})

// The browser's copy, for t() calls made outside rendering. Never written on
// the server, where many visitors share one module.
let browserState: I18nState = { locale: DEFAULT_LOCALE, dict: null }

type Internals = { H: unknown } | undefined
const internals = (React as unknown as {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: Internals
}).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

function currentState(): I18nState {
  // No dispatcher means React is not rendering: an event handler or effect.
  if (internals && internals.H == null) return browserState
  // use() is the one hook allowed outside a component's top level, and here
  // it only ever reads context, which never suspends. The try is a backstop
  // for a dispatcher that exists but is not rendering; it does not catch a
  // suspension, because there is none to catch.
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return use(I18nContext)
  } catch {
    return browserState
  }
}

/** Translate English text into the visitor's language. English is returned as-is. */
export function t(text: string, vars?: Vars): string {
  return translate(currentState().dict, text, vars)
}

export function useLocale() {
  return use(I18nContext)
}

function writeCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
  } catch {}
}

// English pages keep exactly the <html lang="en"> they always had: no dir
// attribute is added unless the language actually reads right to left.
function applyDocumentLanguage(locale: Locale) {
  const el = document.documentElement
  el.lang = locale
  if (localeDir(locale) === 'rtl') el.dir = 'rtl'
  else el.removeAttribute('dir')
}

// Account persistence is registered by LocaleAccountSync, which lives inside
// ClerkProvider; the provider itself stays free of auth.
let persistToAccount: ((locale: Locale) => Promise<void>) | null = null
export function registerAccountPersistence(fn: ((locale: Locale) => Promise<void>) | null) {
  persistToAccount = fn
}

export function LocaleProvider({
  initialLocale,
  initialDict,
  children,
}: {
  initialLocale: Locale
  initialDict: Dictionary | null
  children: React.ReactNode
}) {
  const [state, setState] = useState<I18nState>({ locale: initialLocale, dict: initialDict })

  // Kept in step during render, not in an effect, so a child's mount effect
  // that calls t() already sees the right language. Idempotent: it only ever
  // copies the current state, and never runs on the server.
  // eslint-disable-next-line react-hooks/globals
  if (typeof window !== 'undefined') browserState = state

  const setLocale = useCallback(async (next: Locale, opts?: { persist?: boolean }) => {
    if (!isEnabledLocale(next)) return
    const dict = await loadDictionary(next)
    writeCookie(LOCALE_COOKIE, next)
    writeCookie(PROMPT_COOKIE, '1')
    browserState = { locale: next, dict }
    setState({ locale: next, dict })
    applyDocumentLanguage(next)
    if (opts?.persist !== false && persistToAccount) {
      try { await persistToAccount(next) } catch {}
    }
  }, [])

  useEffect(() => { applyDocumentLanguage(state.locale) }, [state.locale])

  const value = useMemo(() => ({ ...state, setLocale }), [state, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
