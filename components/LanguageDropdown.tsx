'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Globe, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useLocale } from '@/lib/i18n/client'
import {
  ENABLED_LOCALES, localeInfo, localizedPath, splitLocalePrefix, type Locale,
} from '@/lib/i18n/locales'

// ── THE LANGUAGE PICKER ─────────────────────────────────────────────
// A globe, because it is the symbol people everywhere already read as
// "language". Each language is written in its own script so a Spanish speaker
// scans for "Español", not "Spanish".
//
// It renders nothing while English is the only language: an option with one
// choice is clutter, and a language that is not finished is hidden rather than
// shown as coming soon.
//
// Choosing a language never reloads the page. The dashboard version sits under
// the dialer, and a reload there would hang up a live call; instead every
// piece of text re-renders in place and the server parts refresh.

export default function LanguageDropdown({
  opens = 'down',
  tone = 'landing',
}: {
  /** 'up' for the sidebar footer, where there is no room below. */
  opens?: 'up' | 'down'
  tone?: 'landing' | 'sidebar'
}) {
  const { locale, setLocale } = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  // The menu is portalled to <body> and positioned from the button. Inline, it
  // was trapped under the landing nav's blur layer (the announce banner painted
  // over it), and the sidebar clips its overflow.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => setAnchor(buttonRef.current?.getBoundingClientRect() ?? null)
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  if (ENABLED_LOCALES.length < 2) return null

  const choose = async (next: Locale) => {
    setOpen(false)
    if (next === locale) return
    // On a language address (/es/faq), the address is what sets the language,
    // so move to the same page at the other language's address.
    const prefixed = splitLocalePrefix(window.location.pathname)
    await setLocale(next)
    if (prefixed) {
      window.location.assign(localizedPath(next, prefixed.rest) + window.location.search + window.location.hash)
      return
    }
    router.refresh()
  }

  const onSidebar = tone === 'sidebar'

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative', flexShrink: 0,
        // In the sidebar, sit hard against the rail's right edge rather than
        // inside the profile row's 24px padding.
        ...(onSidebar ? { marginRight: '-14px' } : {}),
      }}
      // The sidebar row opens the Clerk menu on click; this must not.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className="ds-lang-btn"
        aria-label={`Language: ${localeInfo(locale).label}`}
        title={localeInfo(locale).label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1px',
          background: 'transparent',
          border: onSidebar ? 'none' : '1px solid var(--border)',
          borderRadius: onSidebar ? '6px' : '8px',
          padding: onSidebar ? '6px 4px' : '7px 6px',
          cursor: 'pointer',
          color: onSidebar ? 'var(--brand-on-sidebar-muted)' : 'var(--text-secondary)',
          lineHeight: 0,
        }}
      >
        {/* Icon only, so it fits a phone's nav bar. The chevron is what says
            "this opens a list", pointing the way the list will open. */}
        <Globe size={16} strokeWidth={1.5} />
        {opens === 'up' ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />}
      </button>

      {open && anchor && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Language"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            ...(opens === 'up'
              ? { bottom: window.innerHeight - anchor.top + 8 }
              : { top: anchor.bottom + 8 }),
            // Right edges aligned, so it opens inward from the landing nav's
            // right edge. In the sidebar the button sits at the rail's right
            // edge, so the same alignment keeps the menu over the rail. Never
            // closer than 16px to the left of the screen.
            right: Math.max(16, window.innerWidth - anchor.right),
            minWidth: '190px',
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border, #d8dce6)',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(10, 20, 50, 0.18)',
            padding: '6px',
            zIndex: 1000,
          }}
        >
          {/* Opening upward, the list runs bottom to top, so English, the
              first choice, sits nearest the button either way. */}
          {(opens === 'up' ? [...ENABLED_LOCALES].reverse() : ENABLED_LOCALES).map((code) => {
            const info = localeInfo(code)
            const selected = code === locale
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                lang={code}
                dir={info.dir}
                translate="no"
                onClick={() => choose(code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  width: '100%',
                  // 44px rows: a comfortable thumb target on a phone.
                  minHeight: '44px',
                  padding: '10px 12px',
                  background: selected ? 'rgba(74, 158, 255, 0.10)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-primary, #1a1a2e)',
                  fontSize: '14px',
                  fontWeight: selected ? 'bold' : 'normal',
                  fontFamily: 'inherit',
                  textAlign: 'start',
                }}
              >
                <span>{info.label}</span>
                {selected && <Check size={15} color="#4a9eff" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
