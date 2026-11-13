'use client'

// Light or dark for the inside of dev.dialerseat.com (the landing page is
// always dark). The choice lives on the .dv root's data-theme attribute and in
// localStorage; app/developers/layout.tsx applies it before first paint, so a
// dark-mode visitor never sees a white flash.

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

export type DevTheme = 'light' | 'dark'
const KEY = 'dv-theme'
const EVENT = 'dv-theme'

function root(): HTMLElement | null {
  return typeof document === 'undefined' ? null : (document.querySelector('.dv') as HTMLElement | null)
}

function current(): DevTheme {
  return root()?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function setDevTheme(t: DevTheme) {
  root()?.setAttribute('data-theme', t)
  try { localStorage.setItem(KEY, t) } catch { /* private mode: this visit only */ }
  window.dispatchEvent(new Event(EVENT))
}

export function useDevTheme(): DevTheme {
  return useSyncExternalStore(
    cb => { window.addEventListener(EVENT, cb); return () => window.removeEventListener(EVENT, cb) },
    current,
    () => 'light',
  )
}

// The before-paint script lives in app/developers/layout.tsx: a value exported
// from this 'use client' file would reach a server component as a client
// reference, not as the string.

export function ThemeToggle({ label = false }: { label?: boolean }) {
  const t = useDevTheme()
  const next: DevTheme = t === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" className="dv-btn dv-btn-ghost" onClick={() => setDevTheme(next)}
      aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      style={{ width: label ? undefined : 36, padding: label ? undefined : 0, color: 'var(--dv-muted)' }}>
      {t === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      {label && <span>{t === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}
