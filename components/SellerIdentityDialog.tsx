'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { t as tr } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// PREDICTIVE'S TWO DETAILS, ASKED FOR WHERE PREDICTIVE IS PICKED
// =============================================================================
// Opened by the dialer, the campaign editor and the team campaign page when
// someone chooses predictive and the campaign owner has not yet given the
// business name and callback number its recorded message needs
// (lib/sellerIdentity). Two ways out, as Joshua asked: fill them in and carry
// on with predictive, or go back to progressive.
//
// An agent dialing someone else's campaign cannot give the OWNER's business
// details, so for them this only explains who has to, and offers progressive
// where they are allowed to switch.
// =============================================================================

const FUTURA = 'Futura PT, Futura, "Trebuchet MS", sans-serif'
const SURFACE = 'color-mix(in srgb, var(--brand-sidebar-bg) 88%, var(--brand-on-sidebar) 12%)'
const BORDER = 'color-mix(in srgb, var(--brand-sidebar-bg) 75%, var(--brand-on-sidebar) 25%)'

interface Props {
  open: boolean
  /** False when the campaign belongs to someone else, whose details these are. */
  ownerIsYou: boolean
  /** Saved and complete: carry on with predictive. */
  onSaved: () => void
  /** Leave predictive. Absent when the viewer cannot change the mode. */
  onUseProgressive?: () => void
  /** Close without choosing, for the case where there is nothing to switch. */
  onClose?: () => void
}

// Mounted only while open, so every opening starts with fresh fields and no
// error left over from the last one. State that outlives the popup is how a
// stale "could not save" greets somebody who reopens it a minute later.
export default function SellerIdentityDialog(props: Props) {
  if (!props.open) return null
  return <SellerIdentityDialogBody {...props} />
}

function SellerIdentityDialogBody({ ownerIsYou, onSaved, onUseProgressive, onClose }: Props) {
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement | null>(null)

  // Prefill whatever is already on the account, so a half-filled pair is
  // finished rather than retyped.
  useEffect(() => {
    let cancelled = false
    fetch('/api/account/seller-identity')
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d?.success) return
        setName(d.name || '')
        setNumber(d.callbackNumber || '')
      })
      .catch(() => {})
    const t = setTimeout(() => firstField.current?.focus(), 50)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  const leave = onUseProgressive ?? onClose

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) leave?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, leave])

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/account/seller-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, callbackNumber: number }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.success) {
        setError(d?.error || msg("Could not save. Try again."))
        return
      }
      if (!d.ready) {
        setError(msg("Enter both your business name and a callback number."))
        return
      }
      onSaved()
    } catch {
      setError(msg("Could not save. Check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-identity-title"
        style={{
          width: '100%', maxWidth: 440, boxSizing: 'border-box',
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 4, padding: 24,
          color: 'var(--brand-on-sidebar)', fontFamily: FUTURA,
        }}
      >
        <div
          id="seller-identity-title"
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: 'var(--brand-primary)', marginBottom: 12 }}
        >
          {ownerIsYou ? tr("PREDICTIVE NEEDS TWO DETAILS") : tr("PREDICTIVE ISN’T SET UP ON THIS CAMPAIGN")}
        </div>

        {ownerIsYou ? (
          <>
            <p style={bodyStyle}>
              {tr("Predictive dials more than one line at a time. When two people answer at once and no agent is free, the law requires a short recorded message with your business name and a number they can call back.")}</p>
            <p style={bodyStyle}>
              {tr("Enter them once. They apply to all your campaigns, and you can change them in Settings.")}</p>

            <label htmlFor="seller-identity-name" style={labelStyle}>{tr("BUSINESS NAME")}</label>
            <input
              id="seller-identity-name"
              ref={firstField}
              type="text"
              value={name}
              maxLength={80}
              placeholder={tr("Your Company")}
              autoComplete="organization"
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />

            <label htmlFor="seller-identity-number" style={labelStyle}>{tr("CALLBACK NUMBER")}</label>
            <input
              id="seller-identity-number"
              type="tel"
              value={number}
              maxLength={24}
              placeholder="(800) 555-1234"
              autoComplete="tel"
              onChange={e => setNumber(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void save() }}
              style={inputStyle}
            />

            {error && (
              <div role="alert" style={{ fontSize: 12, color: '#ff8888', letterSpacing: 0.5, marginBottom: 12 }}>
                {tr(error)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => void save()} disabled={saving} style={primaryButton(saving)}>
                {saving ? tr("SAVING…") : tr("SAVE AND USE PREDICTIVE")}
              </button>
              {leave && (
                <button type="button" onClick={leave} disabled={saving} style={secondaryButton}>
                  {onUseProgressive ? tr("USE PROGRESSIVE INSTEAD") : tr("CANCEL")}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p style={bodyStyle}>
              {tr("Predictive needs the campaign owner's business name and callback number for its recorded message. The owner adds them once in Settings.")}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {leave && (
                <button type="button" onClick={leave} style={primaryButton(false)}>
                  {onUseProgressive ? tr("USE PROGRESSIVE INSTEAD") : tr("OK")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * For screens where the viewer owns what they are switching: call
 * requirePredictive(onReady, onProgressive) when predictive is picked, and
 * render `dialog`. Already set up -> onReady runs at once. Not -> the popup
 * asks, then runs onReady once saved, or onProgressive if they back out.
 */
export function usePredictiveGate() {
  const [gate, setGate] = useState<{ onReady: () => void; onProgressive: () => void } | null>(null)

  const requirePredictive = useCallback(async (onReady: () => void, onProgressive: () => void) => {
    try {
      const d = await fetch('/api/account/seller-identity').then(r => r.json())
      if (d?.success && d.ready) { onReady(); return }
    } catch {
      // Unknown is treated as missing: the popup costs a click, a wrong
      // "ready" costs a save the server then refuses.
    }
    setGate({ onReady, onProgressive })
  }, [])

  const dialog = (
    <SellerIdentityDialog
      open={!!gate}
      ownerIsYou
      onSaved={() => { const g = gate; setGate(null); g?.onReady() }}
      onUseProgressive={() => { const g = gate; setGate(null); g?.onProgressive() }}
    />
  )

  return { dialog, requirePredictive }
}

const bodyStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: 1.6, letterSpacing: 0.3,
  color: 'var(--brand-on-sidebar-muted)', margin: '0 0 12px',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: 2, fontWeight: 700,
  color: 'var(--brand-on-sidebar-muted)', margin: '14px 0 6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
  background: 'var(--brand-sidebar-bg)', color: 'var(--brand-on-sidebar)',
  border: `1px solid ${BORDER}`, borderRadius: 3,
  fontSize: 13, fontFamily: FUTURA, marginBottom: 4,
}

// The canonical primary button (docs/PALETTE.md): a dark face with the brand
// colour as a stripe and as the text, not a filled block. A solid brand-blue
// button glowed on this dark dialog in a way nothing else in the product does.
function primaryButton(busy: boolean): React.CSSProperties {
  return {
    flex: '1 1 180px', padding: 12,
    background: 'var(--brand-header-bg)', color: 'var(--brand-primary)',
    border: 'none', borderTop: '3px solid var(--brand-primary)', borderRadius: 3,
    fontSize: 11, fontWeight: 700, letterSpacing: 3, fontFamily: FUTURA,
    cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
    marginTop: 12,
  }
}

const secondaryButton: React.CSSProperties = {
  flex: '1 1 180px', padding: 12,
  background: 'transparent', color: 'var(--brand-on-sidebar)',
  border: `1px solid ${BORDER}`, borderRadius: 3,
  fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: FUTURA,
  cursor: 'pointer', marginTop: 12,
}
