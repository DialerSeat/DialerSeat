'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// =============================================================================
// VOICEMAIL MESSAGES — the user's own recordings, dropped when AMD hits a machine
// =============================================================================
// The agent is released the instant AMD says machine and is already on the next
// lead. The lead's line stays up, waits for the beep, plays one of these, and
// hangs up. What was a five-second click becomes a message the lead can act on.
//
// The message is always theirs, never ours. FCC rules require a prerecorded
// telemarketing message to identify the business and give a callback number, so
// a generic "someone tried to call you" clip carries MORE exposure than a real
// one, not less. The example copy below exists to make the compliant shape
// obvious rather than something to look up.
// =============================================================================

const MAX_MESSAGES = 20

// The face of every control in DialerSeat.
const FUTURA = 'Futura PT, Futura, sans-serif'

const EXAMPLE_SCRIPT =
  '"Hey, this is John Doe with Blue Check, just giving a call back about the ' +
  'inspection status. Reach out any time between 9am and 7pm — my number is ' +
  '555-555-5555. Thank you."'

export interface VoicemailMessage {
  id: string
  name: string
  audio_url: string
  duration_seconds: number | null
  created_at: string
}

interface Theme {
  surface: string
  border: string
  text: string
  muted: string
  blue: string
  green: string
  red: string
}

export default function VoicemailMessages({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const T = theme
  const [messages, setMessages] = useState<VoicemailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  // Recording state
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [preview, setPreview] = useState<{ blob: Blob; url: string; seconds: number } | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/voicemail-messages')
      const data = await res.json()
      if (data.success) setMessages(data.messages || [])
      else setError(data.error || 'Could not load your voicemail messages.')
    } catch {
      setError('Could not load your voicemail messages.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Every acquired resource released on unmount: a live microphone stream that
  // outlives this panel leaves the browser's recording indicator on, which
  // reads as the app listening after you closed it.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (preview?.url) URL.revokeObjectURL(preview.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      // No mimeType is forced. Safari and Chrome disagree about what they can
      // produce, and asking for one they do not support throws instead of
      // falling back — the server accepts whichever they pick.
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        setPreview({ blob, url: URL.createObjectURL(blob), seconds: elapsed })
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      recorderRef.current = rec
      rec.start()
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } catch {
      setError('Microphone access was blocked. Allow it in your browser, or upload a file instead.')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const save = async (blob: Blob, seconds: number, filename: string) => {
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', blob, filename)
      fd.append('name', name.trim() || `Voicemail ${messages.length + 1}`)
      fd.append('duration_seconds', String(seconds))
      const res = await fetch('/api/voicemail-messages', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Could not save that recording.'); return }
      setMessages(m => [data.message, ...m])
      setName('')
      if (preview?.url) URL.revokeObjectURL(preview.url)
      setPreview(null)
      setElapsed(0)
    } catch {
      setError('Could not save that recording.')
    } finally {
      setBusy(false)
    }
  }

  const onUpload = async (file: File) => {
    if (messages.length >= MAX_MESSAGES) {
      setError(`You've saved the maximum of ${MAX_MESSAGES}. Delete one to add another.`)
      return
    }
    await save(file, 0, file.name)
  }

  const rename = async (id: string, next: string, previous: string) => {
    const name = next.trim()
    // Nothing to do, and an empty name would leave an unlabelled row in the
    // campaign picker that nobody can identify.
    if (!name || name === previous) return
    // Optimistic: the input already shows the new text, so re-rendering it
    // from state would only make it flicker.
    setMessages(m => m.map(x => (x.id === id ? { ...x, name } : x)))
    try {
      const res = await fetch('/api/voicemail-messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      })
      const data = await res.json()
      if (!data.success) {
        setMessages(m => m.map(x => (x.id === id ? { ...x, name: previous } : x)))
        setError(data.error || 'Could not rename that message.')
      }
    } catch {
      setMessages(m => m.map(x => (x.id === id ? { ...x, name: previous } : x)))
      setError('Could not rename that message.')
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/voicemail-messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) setMessages(m => m.filter(x => x.id !== id))
      else setError(data.error || 'Could not delete that message.')
    } finally {
      setBusy(false)
    }
  }

  const atCap = messages.length >= MAX_MESSAGES
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14,
          width: '100%', maxWidth: 640,
          // The panel scrolls, not the page behind it. maxHeight plus a
          // min-height:0 body is what keeps this usable on a phone, where the
          // compliance copy alone is taller than the viewport.
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 'bold', letterSpacing: 4,
              color: T.blue, fontFamily: FUTURA,
            }}>
              CUSTOM VOICEMAILS
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
              {messages.length} of {MAX_MESSAGES} saved
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 3,
            color: T.muted, cursor: 'pointer', padding: '6px 14px',
            fontSize: 10, letterSpacing: 2, fontWeight: 'bold', fontFamily: FUTURA,
          }}>CLOSE</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', minHeight: 0 }}>
          {/* ── WHY THIS IS WORTH TURNING ON ─────────────────────────────── */}
          <div style={{
            background: 'var(--brand-page-bg)', border: `1px solid ${T.border}`,
            borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 12,
            lineHeight: 1.7, color: T.text,
          }}>
            {/* Its own block, not a lead-in sentence. The claim and the
                explanation are two different thoughts and ran together. */}
            <div style={{ marginBottom: 8 }}>
              <strong>Add one of these to a campaign and every lead who doesn&apos;t
              pick up gets a voicemail from you.</strong>
            </div>
            Your dialer moves straight to the next lead — you never wait through it —
            while the message finishes on its own. Leads then call you back on your own
            phone when they&apos;re free, which is where a lot of conversions actually
            come from.
            <div style={{ marginTop: 10, color: T.muted, fontStyle: 'italic' }}>
              Example: {EXAMPLE_SCRIPT}
            </div>
          </div>

          {/* ── COMPLIANCE ───────────────────────────────────────────────── */}
          <div style={{
            background: 'var(--brand-page-bg)', border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.red}`,
            borderRadius: 10, padding: 14, marginBottom: 18, fontSize: 11.5,
            lineHeight: 1.7, color: T.text,
          }}>
            <div style={{ fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>
              BEFORE YOU RECORD
            </div>
            A prerecorded voicemail left on a mobile number for sales or marketing is
            regulated. Federal rules require your message to <strong>say who you
            are</strong> — your name and business — and give a <strong>callback
            number</strong>. Keep it truthful and identify yourself in the first
            sentence.
            <div style={{ marginTop: 8, color: T.muted }}>
              A message that identifies nobody is more exposed than a real one, not
              less. Leaving prerecorded messages for telemarketing generally requires
              prior express written consent from the person you&apos;re calling —
              confirm your own obligations for your industry and state before turning
              this on.
            </div>
          </div>

          {error && (
            <div style={{
              background: '#fee2e2', color: '#8a1a1a', border: '1px solid #fca5a5',
              borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 14,
            }}>{error}</div>
          )}

          {/* ── RECORD / UPLOAD ──────────────────────────────────────────── */}
          {atCap ? (
            <div style={{
              border: `1px dashed ${T.border}`, borderRadius: 10, padding: 16,
              fontSize: 12, color: T.muted, marginBottom: 18, textAlign: 'center',
            }}>
              You&apos;ve saved all {MAX_MESSAGES}. Delete one to record another.
            </div>
          ) : (
            <div style={{
              border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 18,
            }}>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name it — e.g. Inspection follow-up"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                  border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13,
                  marginBottom: 12, background: T.surface, color: T.text,
                }}
              />

              {preview ? (
                <div>
                  <audio src={preview.url} controls style={{ width: '100%', marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      disabled={busy}
                      onClick={() => save(preview.blob, preview.seconds, 'voicemail.webm')}
                      style={{
                        flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: 3,
                        background: 'transparent', border: `1px solid ${T.green}`,
                        color: T.green, fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                        cursor: busy ? 'wait' : 'pointer', fontFamily: FUTURA,
                      }}
                    >{busy ? 'SAVING…' : 'SAVE MESSAGE'}</button>
                    <button
                      disabled={busy}
                      onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); setElapsed(0) }}
                      style={{
                        padding: '10px 14px', borderRadius: 3,
                        border: `1px solid ${T.border}`, background: 'transparent',
                        color: T.muted, fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                        cursor: 'pointer', fontFamily: FUTURA,
                      }}
                    >DISCARD</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Outline treatment, matching every other control in
                      DialerSeat — transparent fill, coloured border and text,
                      Futura, wide letter spacing. These were solid blocks of
                      colour and looked like they belonged to a different app. */}
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    style={{
                      flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 3,
                      background: 'transparent',
                      border: `1px solid ${recording ? T.red : T.blue}`,
                      color: recording ? T.red : T.blue,
                      fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                      cursor: 'pointer', fontFamily: FUTURA,
                    }}
                  >{recording ? `■ STOP — ${mmss(elapsed)}` : 'RECORD MESSAGE'}</button>

                  <label style={{
                    padding: '10px 14px', borderRadius: 3,
                    border: `1px solid ${T.border}`, background: 'transparent',
                    color: T.muted, fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>
                    UPLOAD FILE
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) onUpload(f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── SAVED MESSAGES ───────────────────────────────────────────── */}
          {loading ? (
            <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', padding: 20 }}>
              LOADING…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ fontSize: 12, color: T.muted, textAlign: 'center', padding: 20 }}>
              No voicemail messages saved yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.map(m => (
                <div key={m.id} style={{
                  border: `1px solid ${T.border}`, borderRadius: 10, padding: 12,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, marginBottom: 8,
                  }}>
                    {/* Editable in place. A name chosen while recording is a
                        guess at what the message will be for; being stuck with
                        it forever means the campaign picker fills up with
                        "Voicemail 3" and nobody can tell them apart. Saves on
                        blur or Enter, reverts on Escape. */}
                    <input
                      defaultValue={m.name}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') {
                          ;(e.target as HTMLInputElement).value = m.name
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      onBlur={e => rename(m.id, e.target.value, m.name)}
                      style={{
                        flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600,
                        color: T.text, background: 'transparent',
                        border: '1px solid transparent', borderRadius: 3,
                        padding: '3px 6px', fontFamily: 'inherit',
                      }}
                      onFocus={e => { e.target.style.borderColor = T.border }}
                    />
                    <button
                      disabled={busy}
                      onClick={() => remove(m.id)}
                      style={{
                        background: 'transparent', border: `1px solid ${T.red}`,
                        borderRadius: 3, color: T.red, cursor: 'pointer',
                        padding: '4px 10px', fontSize: 10, letterSpacing: 2,
                        fontWeight: 'bold', fontFamily: FUTURA,
                      }}
                    >DELETE</button>
                  </div>
                  <audio src={m.audio_url} controls style={{ width: '100%' }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, color: T.muted, marginTop: 16, lineHeight: 1.6 }}>
            To use one, open a campaign&apos;s settings and pick it under Voicemail
            Drop. It only plays when the dialer reaches an answering machine, and
            each lead receives it once — never twice, however many times you dial
            them.
          </div>
        </div>
      </div>
    </div>
  )
}
