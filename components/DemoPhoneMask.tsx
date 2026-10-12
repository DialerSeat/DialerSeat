'use client'
import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

// =============================================================================
// DISPLAY-ONLY PHONE MASK, FOR FILMING ON A DEMO ACCOUNT
// =============================================================================
// When the signed-in account has users.demo_phone_mask (John Doe, for ad
// b-roll), every phone number on screen reads 555-555-5555: leads, the
// dialer, caller ID, recordings, everything. It rewrites what is DRAWN and
// nothing else. The data, the API responses and what the dialer actually
// dials are untouched, and no other account runs any of this.
//
// Done at the DOM rather than in each component because "every number on
// every page" is dozens of components; one observer covers all of them,
// including ones added later. React writing a real number back is just
// another mutation, and it gets masked again.
// =============================================================================

const MASK = '555-555-5555'
const FLAG_KEY = 'ds:demo-phone-mask'

// US numbers as the app prints them: +12282500946, (228) 250-0946,
// 228-250-0946, 228.250.0946, 2282500946. Not part of a longer digit run, so
// ids, counts and timestamps are left alone.
const PHONE = /(?<![\d])(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}(?![\d])/g

const mask = (s: string) => s.replace(PHONE, MASK)

function maskNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = node.nodeValue
    if (v) {
      const m = mask(v)
      if (m !== v) node.nodeValue = m
    }
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return
  maskElement(el)
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n = walker.nextNode()
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) maskNode(n)
    else maskElement(n as Element)
    n = walker.nextNode()
  }
}

function maskElement(el: Element) {
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    const v = el.getAttribute(attr)
    if (v) {
      const m = mask(v)
      if (m !== v) el.setAttribute(attr, m)
    }
  }
  // Inputs show their value, not a text node. Left alone while focused so
  // typing into one still works.
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      && el !== document.activeElement) {
    const m = mask(el.value)
    if (m !== el.value) el.value = m
  }
}

function startMasking(): () => void {
  maskNode(document.body)
  const obs = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'characterData') maskNode(r.target)
      else if (r.type === 'attributes') maskElement(r.target as Element)
      else r.addedNodes.forEach(maskNode)
    }
  })
  obs.observe(document.body, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder', 'value'],
  })
  // Typed or programmatic input values do not show up as mutations.
  const id = setInterval(() => document.querySelectorAll('input, textarea').forEach(maskElement), 500)
  return () => { obs.disconnect(); clearInterval(id) }
}

export default function DemoPhoneMask() {
  const { isSignedIn, user } = useUser()
  const userId = user?.id

  useEffect(() => {
    if (!isSignedIn || !userId) return
    let stop: (() => void) | null = null
    let cancelled = false

    // Remembered per account, so a reload masks on the first frame instead of
    // waiting on the request below and flashing the real numbers.
    const key = `${FLAG_KEY}:${userId}`
    try { if (localStorage.getItem(key) === '1') stop = startMasking() } catch { /* storage off */ }

    fetch('/api/users/me', { cache: 'no-store' })
      .then(r => r.json())
      .then((me: { demo_phone_mask?: boolean }) => {
        if (cancelled) return
        try {
          if (me.demo_phone_mask) localStorage.setItem(key, '1')
          else localStorage.removeItem(key)
        } catch { /* storage off */ }
        if (me.demo_phone_mask && !stop) stop = startMasking()
        if (!me.demo_phone_mask && stop) { stop(); stop = null; window.location.reload() }
      })
      .catch(() => {})

    return () => { cancelled = true; if (stop) stop() }
  }, [isSignedIn, userId])

  return null
}
