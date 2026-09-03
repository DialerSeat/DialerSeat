'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SITE } from '@/lib/siteTheme'
import { inter } from '@/lib/fonts'

// =============================================================================
// THE "ASK US DIRECTLY" BOX
// =============================================================================
// This replaced a mailto: link. A mailto: works for the shrinking number of
// people with a configured desktop mail client and silently does nothing for
// everyone else — and even when it does work, the reply lands in an inbox with
// no record on our side of what was asked or whether anyone answered.
//
// Everything here is optional except the message. Asking for a name and a
// company before someone can tell you your pricing page is confusing is how
// you stop hearing that your pricing page is confusing.
// =============================================================================

const KINDS: { value: string; label: string }[] = [
  { value: 'question', label: 'A question' },
  { value: 'suggestion', label: 'A suggestion' },
  { value: 'comparison', label: 'A dialer to compare' },
  { value: 'other', label: 'Something else' },
]

export default function SuggestionModal({
  open,
  onClose,
  title = 'Ask us directly',
  intro = 'A real person reads these. Leave an email if you want an answer back.',
  defaultKind = 'question',
}: {
  open: boolean
  onClose: () => void
  title?: string
  intro?: string
  defaultKind?: string
}) {
  const pathname = usePathname()
  const [kind, setKind] = useState(defaultKind)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  /**
   * Closing clears the form, but only after a completed send.
   *
   * Losing a half-typed message because somebody tapped outside the dialog
   * would be worse than showing it again, so an in-progress draft survives a
   * close and is still there on reopen.
   */
  const close = useCallback(() => {
    if (state === 'sent') {
      setState('idle')
      setMessage('')
      setEmail('')
      setKind(defaultKind)
    }
    onClose()
  }, [state, defaultKind, onClose])

  // Escape closes, and the page behind stops scrolling while it is open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus the thing they came here to type in, not the first tabbable element.
    const t = setTimeout(() => textareaRef.current?.focus(), 40)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      clearTimeout(t)
    }
  }, [open, close])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    if (!message.trim()) {
      setError('Please write a message.')
      setState('error')
      return
    }
    setState('sending')
    setError('')
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, email, sourcePath: pathname }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setError('Could not reach the server. Please try again.')
      setState('error')
    }
  }

  return (
    <div
      className="sg-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <style>{`
        .sg-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(14,14,22,0.55);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          font-family: ${inter.style.fontFamily};
        }
        .sg-dialog {
          background: ${SITE.surface};
          border: 1px solid ${SITE.border};
          border-radius: 14px;
          width: 100%; max-width: 520px;
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          box-shadow: 0 24px 64px rgba(14,14,22,0.28);
        }
        .sg-head {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 22px 24px 0;
        }
        .sg-head h2 {
          margin: 0; flex: 1;
          font-size: 21px; font-weight: 800; letter-spacing: -0.4px;
          color: ${SITE.text};
        }
        .sg-close {
          flex-shrink: 0;
          width: 32px; height: 32px;
          display: grid; place-items: center;
          border: 1px solid ${SITE.borderSoft};
          border-radius: 8px;
          background: ${SITE.bg};
          color: ${SITE.muted};
          font-size: 17px; line-height: 1;
          cursor: pointer;
        }
        .sg-close:hover { color: ${SITE.text}; border-color: ${SITE.border}; }
        .sg-intro {
          margin: 8px 24px 0;
          font-size: 14px; line-height: 1.6; color: ${SITE.muted};
        }
        .sg-body { padding: 18px 24px 24px; }
        .sg-label {
          display: block;
          font-size: 10px; font-weight: bold; letter-spacing: 2.5px;
          color: ${SITE.muted};
          margin: 16px 0 8px;
        }
        .sg-kinds { display: flex; flex-wrap: wrap; gap: 8px; }
        .sg-kind {
          padding: 8px 13px;
          border: 1px solid #dde6fb;
          background: #f5f8ff;
          border-radius: 7px;
          font-family: inherit; font-size: 13.5px; font-weight: 600;
          color: #2a6eff;
          cursor: pointer;
        }
        .sg-kind[aria-pressed="true"] {
          background: #2a6eff; border-color: #2a6eff; color: #fff;
        }
        .sg-input, .sg-textarea {
          width: 100%;
          border: 1px solid ${SITE.border};
          border-radius: 9px;
          background: ${SITE.bg};
          font-family: inherit; font-size: 15px; color: ${SITE.text};
          padding: 12px 14px;
          outline: none;
        }
        .sg-input:focus, .sg-textarea:focus { border-color: #2a6eff; background: ${SITE.surface}; }
        .sg-textarea { min-height: 132px; resize: vertical; line-height: 1.6; }
        .sg-count { margin-top: 6px; font-size: 12px; color: ${SITE.muted}; text-align: right; }
        .sg-hint { margin-top: 6px; font-size: 12.5px; color: ${SITE.muted}; }
        .sg-error {
          margin-top: 14px; padding: 11px 14px;
          background: rgba(138,26,26,0.07);
          border: 1px solid rgba(138,26,26,0.3);
          border-radius: 8px;
          font-size: 13.5px; color: #8a1a1a;
        }
        .sg-actions { display: flex; gap: 10px; margin-top: 20px; }
        .sg-submit {
          flex: 1;
          background: #2a6eff; color: #fff;
          border: none; border-radius: 9px;
          font-family: inherit; font-size: 14.5px; font-weight: bold;
          padding: 13px;
          cursor: pointer;
        }
        .sg-submit:hover:not(:disabled) { background: ${SITE.deep}; }
        .sg-submit:disabled { opacity: 0.6; cursor: default; }
        .sg-cancel {
          background: transparent; color: ${SITE.muted};
          border: 1px solid ${SITE.border}; border-radius: 9px;
          font-family: inherit; font-size: 14px; font-weight: 600;
          padding: 13px 20px;
          cursor: pointer;
        }
        .sg-sent { padding: 30px 24px 26px; text-align: center; }
        .sg-sent-mark {
          width: 46px; height: 46px; margin: 0 auto 14px;
          display: grid; place-items: center;
          border-radius: 999px;
          background: #e6f4ec; color: #16875a;
          font-size: 22px; font-weight: bold;
        }
        .sg-sent h3 {
          margin: 0 0 8px;
          font-size: 19px; font-weight: 800; color: ${SITE.text};
        }
        .sg-sent p { margin: 0 0 20px; font-size: 14.5px; line-height: 1.6; color: ${SITE.muted}; }

        @media (max-width: 560px) {
          .sg-backdrop { padding: 0; align-items: flex-end; }
          .sg-dialog { max-width: none; border-radius: 14px 14px 0 0; max-height: 92vh; }
        }
      `}</style>

      <div
        ref={dialogRef}
        className="sg-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {state === 'sent' ? (
          <div className="sg-sent">
            <div className="sg-sent-mark" aria-hidden>✓</div>
            <h3>Got it.</h3>
            <p>
              {email
                ? "We read every one of these. If it needs an answer, you'll get one at that address."
                : 'We read every one of these. Thanks for taking the time.'}
            </p>
            <button type="button" className="sg-submit" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="sg-head">
              <h2>{title}</h2>
              <button type="button" className="sg-close" onClick={close} aria-label="Close">
                ×
              </button>
            </div>
            <p className="sg-intro">{intro}</p>

            <form className="sg-body" onSubmit={submit}>
              <span className="sg-label">WHAT IS THIS?</span>
              <div className="sg-kinds">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    className="sg-kind"
                    aria-pressed={kind === k.value}
                    onClick={() => setKind(k.value)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <label className="sg-label" htmlFor="sg-message">
                YOUR MESSAGE
              </label>
              <textarea
                id="sg-message"
                ref={textareaRef}
                className="sg-textarea"
                value={message}
                maxLength={4000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask anything, or tell us what's missing."
              />
              <div className="sg-count">{message.length}/4000</div>

              <label className="sg-label" htmlFor="sg-email">
                EMAIL (OPTIONAL)
              </label>
              <input
                id="sg-email"
                className="sg-input"
                type="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              <p className="sg-hint">Only used to reply. Leave it blank to stay anonymous.</p>

              {state === 'error' && error && <div className="sg-error">{error}</div>}

              <div className="sg-actions">
                <button type="submit" className="sg-submit" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Sending…' : 'Send it'}
                </button>
                <button type="button" className="sg-cancel" onClick={close}>
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
