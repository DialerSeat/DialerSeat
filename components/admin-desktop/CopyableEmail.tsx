'use client'

import { useState } from 'react'

// =============================================================================
// COPYABLE EMAIL
// =============================================================================
// Shared by every admin surface that shows a customer's address, so copying
// one behaves identically wherever you happen to be looking.
//
// Three details that are easy to get wrong:
//
//   stopPropagation — these sit inside rows whose own click expands a detail
//   panel. Without it, copying an address also toggles the row, which reads as
//   the click having done something other than what you asked.
//
//   A <button>, not a <div> — it is an interactive control, so it should be
//   keyboard-reachable and announced as a button rather than as text that
//   mysteriously reacts to clicks.
//
//   The execCommand fallback — navigator.clipboard is undefined outside a
//   secure context, and the admin desktop gets opened over plain http on a
//   local network often enough for that to matter.
// =============================================================================

export default function CopyableEmail({ email, className, style }: {
  email: string
  className?: string
  style?: React.CSSProperties
}) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(email)
        ok = true
      }
    } catch {
      ok = false
    }

    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = email
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }

    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : `Copy ${email}`}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        // Dotted rather than solid: hints that it does something without
        // dressing an address up as a link to somewhere else.
        borderBottom: '1px dotted currentColor',
        ...style,
      }}
    >
      {copied ? 'COPIED' : email}
    </button>
  )
}
