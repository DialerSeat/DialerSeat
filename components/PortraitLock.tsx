'use client'

import { useEffect } from 'react'

/**
 * Keeps the app in portrait on phones.
 *
 * There is no way for a web page to actually forbid rotation in a normal
 * browser tab — the Screen Orientation API's lock() is only granted to
 * installed/fullscreen contexts, and everywhere else it rejects. So this does
 * both halves of the job:
 *
 *   1. Asks for a real lock. Succeeds when DialerSeat is installed to the home
 *      screen (the manifest also declares portrait-primary) or running
 *      fullscreen — there, the device genuinely will not rotate.
 *   2. Falls back to refusing to render sideways. On a phone-sized landscape
 *      viewport the app is covered by a "rotate back" panel. The page keeps
 *      running underneath — no state is lost, nothing unmounts — it simply
 *      isn't usable until the phone is upright again.
 *
 * The fallback is deliberately gated on HEIGHT, not just orientation: a laptop
 * or a tablet in landscape is a perfectly good way to use the dialer and must
 * never see this. Only a viewport short enough to be a phone on its side does.
 */
export default function PortraitLock() {
  useEffect(() => {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined
    if (!orientation?.lock) return

    // Rejects with a NotSupportedError/SecurityError in a plain browser tab.
    // That is the expected case, not a fault — the CSS below covers it.
    orientation.lock('portrait').catch(() => {})

    return () => {
      try { orientation.unlock?.() } catch { /* not supported */ }
    }
  }, [])

  return (
    <div className="ds-rotate-gate" aria-live="polite">
      <style>{`
        .ds-rotate-gate { display: none; }
        @media (orientation: landscape) and (max-height: 500px) {
          .ds-rotate-gate {
            position: fixed;
            inset: 0;
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
            padding: 24px;
            text-align: center;
            background: var(--brand-sidebar-bg, #111118);
            color: var(--brand-on-sidebar, #f2f3f7);
            font-family: 'Futura PT', Futura, 'Trebuchet MS', sans-serif;
          }
        }
        .ds-rotate-gate-icon {
          font-size: 34px;
          line-height: 1;
          animation: ds-rotate-hint 2.4s ease-in-out infinite;
        }
        @keyframes ds-rotate-hint {
          0%, 45%, 100% { transform: rotate(0deg); }
          60%, 85%      { transform: rotate(-90deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ds-rotate-gate-icon { animation: none; }
        }
        .ds-rotate-gate-title {
          font-size: 13px; font-weight: bold; letter-spacing: 3px;
        }
        .ds-rotate-gate-body {
          font-size: 11px; letter-spacing: 1px; line-height: 1.7;
          max-width: 380px;
          color: var(--brand-on-sidebar-muted, #8b8fa3);
        }
      `}</style>
      <div className="ds-rotate-gate-icon">📱</div>
      <div className="ds-rotate-gate-title">ROTATE TO PORTRAIT</div>
      <div className="ds-rotate-gate-body">
        DialerSeat runs upright on a phone. Turn your device back and you&apos;ll
        pick up exactly where you left off — nothing was lost.
      </div>
    </div>
  )
}
