'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { registerAccountPersistence, useLocale } from '@/lib/i18n/client'
import { isEnabledLocale, splitLocalePrefix, type Locale } from '@/lib/i18n/locales'

// ── THE LANGUAGE FOLLOWS THE ACCOUNT ────────────────────────────────
// The choice is saved on the Clerk user (unsafeMetadata.locale, which the
// browser may write for its own user), so signing in on a new phone or
// computer brings the language with it. The cookie is only the fast path the
// server reads on the first paint.
//
// Renders nothing.

export default function LocaleAccountSync() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { locale, setLocale } = useLocale()
  const router = useRouter()
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      registerAccountPersistence(null)
      return
    }
    registerAccountPersistence(async (next: Locale) => {
      if (user.unsafeMetadata?.locale === next) return
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, locale: next } })
    })
    return () => registerAccountPersistence(null)
  }, [isLoaded, isSignedIn, user])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    if (syncedFor.current === user.id) return
    syncedFor.current = user.id

    // A language address (/es/faq) is an explicit page, not a preference to
    // override.
    if (splitLocalePrefix(window.location.pathname)) return

    const saved = user.unsafeMetadata?.locale
    if (isEnabledLocale(saved)) {
      if (saved !== locale) {
        setLocale(saved, { persist: false }).then(() => router.refresh())
      }
    } else if (locale !== 'en') {
      // Picked on the landing page before signing in: keep it on the account.
      user.update({ unsafeMetadata: { ...user.unsafeMetadata, locale } }).catch(() => {})
    }
  }, [isLoaded, isSignedIn, user, locale, setLocale, router])

  return null
}
