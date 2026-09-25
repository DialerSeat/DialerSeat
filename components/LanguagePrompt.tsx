'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { useLocale } from '@/lib/i18n/client'
import { PROMPT_COOKIE, localeInfo, type Locale } from '@/lib/i18n/locales'

// ── ASK ONCE, IN THEIR LANGUAGE ─────────────────────────────────────
// The server decides whether to ask (layout.tsx: no language chosen yet, never
// asked before, and the device language or location points somewhere other
// than English). This only renders the question.
//
// It is written in the language it offers, since that is the one the visitor
// can read, with the English underneath. Nothing changes until they click Yes;
// either answer is remembered and the question never comes back.
//
// The copy lives here rather than in the dictionaries because it has to be in
// the offered language while the page is still in English.

const COPY: Record<Exclude<Locale, 'en'>, { ask: string; yes: string; no: string; en: string }> = {
  es: { ask: '¿Ver DialerSeat en español?', yes: 'Sí', no: 'No, seguir en inglés', en: 'View DialerSeat in Spanish?' },
  'pt-BR': { ask: 'Ver o DialerSeat em português?', yes: 'Sim', no: 'Não, continuar em inglês', en: 'View DialerSeat in Portuguese?' },
  fr: { ask: 'Afficher DialerSeat en français ?', yes: 'Oui', no: 'Non, rester en anglais', en: 'View DialerSeat in French?' },
  ar: { ask: 'هل تريد عرض DialerSeat باللغة العربية؟', yes: 'نعم', no: 'لا، البقاء على الإنجليزية', en: 'View DialerSeat in Arabic?' },
  it: { ask: 'Vuoi vedere DialerSeat in italiano?', yes: 'Sì', no: 'No, resta in inglese', en: 'View DialerSeat in Italian?' },
  de: { ask: 'DialerSeat auf Deutsch anzeigen?', yes: 'Ja', no: 'Nein, auf Englisch bleiben', en: 'View DialerSeat in German?' },
}

function remember() {
  try {
    document.cookie = `${PROMPT_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
  } catch {}
}

export default function LanguagePrompt({ suggested }: { suggested: Locale | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const { locale, setLocale } = useLocale()
  const [dismissed, setDismissed] = useState(false)

  if (!suggested || suggested === 'en' || dismissed || locale !== 'en') return null
  // Never over the dialer: a modal there could sit on top of a live call.
  if (pathname?.startsWith('/dashboard/dialer')) return null

  const copy = COPY[suggested]
  const info = localeInfo(suggested)

  const answer = async (yes: boolean) => {
    remember()
    setDismissed(true)
    if (yes) {
      await setLocale(suggested)
      router.refresh()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ds-lang-prompt-q"
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(10, 14, 30, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        lang={suggested}
        dir={info.dir}
        style={{
          width: '100%', maxWidth: '380px',
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, #d8dce6)',
          borderTop: '3px solid #4a9eff',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(10, 20, 50, 0.3)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <Globe size={28} color="#4a9eff" style={{ display: 'block', margin: '0 auto 12px' }} />
        <div id="ds-lang-prompt-q" style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary, #1a1a2e)', marginBottom: '6px' }}>
          {copy.ask}
        </div>
        <div lang="en" dir="ltr" style={{ fontSize: '13px', color: 'var(--text-secondary, #5a5e6a)', marginBottom: '20px' }}>
          {copy.en}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => answer(true)}
            style={{
              padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: '#4a9eff', color: '#ffffff', fontSize: '14px', fontWeight: 'bold', fontFamily: 'inherit',
            }}
          >
            {copy.yes}
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            style={{
              padding: '12px', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border, #d8dce6)',
              color: 'var(--text-primary, #1a1a2e)', fontSize: '14px', fontFamily: 'inherit',
            }}
          >
            {copy.no}
          </button>
        </div>
      </div>
    </div>
  )
}
