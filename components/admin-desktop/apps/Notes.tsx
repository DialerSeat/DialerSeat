'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// =============================================================================
// NOTES APP — v21 rewrite
// =============================================================================
// iCloud-style notes: sidebar list on the left, editor on the right.
//
// v20 BUG: save was failing silently — UI showed "Saved" badge briefly even
// when PATCH returned an error, because we didn't await the JSON parse before
// flipping status. v21 fixes:
//   1. Errors from PATCH/POST/DELETE now show a persistent red banner with
//      the actual response body, not a silent failure.
//   2. Autosave uses a ref-based "latest pending" snapshot, so rapid edits
//      don't lose data to closure staleness.
//   3. Mobile layout: sidebar collapses to a top bar with a hamburger that
//      slides the sidebar over the editor.
//   4. Save status is reflected accurately — "Saving…" stays until the
//      response is parsed and confirmed, "Saved" shows briefly then idles.
// =============================================================================

interface Note {
  id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const MOBILE_BREAKPOINT = 720

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Mobile sidebar visibility
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Local edit buffer for the selected note
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  // Save infrastructure — refs for stable access inside async/timer callbacks
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingNoteIdRef = useRef<string | null>(null)
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Snapshot of "what should be saved on next flush" — updated synchronously
  // on every keystroke, so the debounced flush always sees the LATEST values
  // even if the closure was captured earlier.
  const pendingRef = useRef<{ id: string; title: string; body: string } | null>(null)

  // ── MOBILE DETECTION ───────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const m = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(m)
      if (!m) setSidebarOpen(true) // desktop always shows sidebar
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── INITIAL LOAD ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/notes', { cache: 'no-store' })
      .then(async (r) => {
        const text = await r.text()
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`)
        try {
          return JSON.parse(text) as { notes: Note[] }
        } catch {
          throw new Error(`Bad JSON from /api/admin/notes: ${text.slice(0, 200)}`)
        }
      })
      .then((d) => {
        if (cancelled) return
        const list = Array.isArray(d.notes) ? d.notes : []
        setNotes(list)
        if (list.length > 0) {
          selectNoteInternal(list[0])
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e?.message || 'Failed to load notes')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── INTERNAL SELECT (no flush) ──────────────────────────────────────────
  // Loads a note into the edit buffer. Does NOT flush — caller is
  // responsible for flushing first if needed.
  const selectNoteInternal = useCallback((note: Note) => {
    setSelectedId(note.id)
    setEditTitle(note.title)
    setEditBody(note.body)
    editingNoteIdRef.current = note.id
    pendingRef.current = { id: note.id, title: note.title, body: note.body }
    setSaveStatus('idle')
    setSaveError(null)
  }, [])

  // ── USER-INITIATED SELECT (flushes pending save first) ──────────────────
  const selectNote = useCallback((note: Note) => {
    // Flush any pending save BEFORE switching, synchronously fire-and-forget
    flushPendingSave()
    selectNoteInternal(note)
    if (isMobile) setSidebarOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, selectNoteInternal])

  // ── ON-TYPE: update buffer + schedule debounced save ────────────────────
  // Every keystroke updates pendingRef synchronously so the debounced flush
  // always sees the LATEST text, not a closure-captured stale value.
  const onTitleChange = (value: string) => {
    setEditTitle(value)
    if (selectedId) {
      pendingRef.current = { id: selectedId, title: value, body: editBody }
      scheduleSave()
    }
  }
  const onBodyChange = (value: string) => {
    setEditBody(value)
    if (selectedId) {
      pendingRef.current = { id: selectedId, title: editTitle, body: value }
      scheduleSave()
    }
  }

  // ── SCHEDULE SAVE — 800ms debounce ──────────────────────────────────────
  const scheduleSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(() => {
      void flushPendingSave()
    }, 800)
  }

  // ── FLUSH PENDING SAVE — does the actual PATCH ──────────────────────────
  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const pending = pendingRef.current
    if (!pending) return

    setSaveStatus('saving')
    setSaveError(null)

    try {
      const r = await fetch(`/api/admin/notes/${pending.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pending.title, body: pending.body }),
      })
      const text = await r.text()
      if (!r.ok) {
        // Surface the actual error so we can debug
        throw new Error(`PATCH failed (${r.status}): ${text.slice(0, 300)}`)
      }
      let data: { note: Note | null } = { note: null }
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Bad JSON from PATCH: ${text.slice(0, 300)}`)
      }

      if (data.note) {
        // Update the sidebar copy with the server's confirmed row
        setNotes((prev) => {
          const next = prev.map((n) => (n.id === pending.id ? (data.note as Note) : n))
          next.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          return next
        })
      }

      setSaveStatus('saved')
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
      savedHideTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (e: any) {
      console.error('[NotesApp save]', e)
      setSaveStatus('error')
      setSaveError(e?.message || 'Save failed')
    }
  }, [])

  // ── FLUSH ON UNMOUNT (best-effort) ──────────────────────────────────────
  useEffect(() => {
    return () => {
      const pending = pendingRef.current
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
      if (pending) {
        // Fire-and-forget save with keepalive so it survives tab close
        fetch(`/api/admin/notes/${pending.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: pending.title, body: pending.body }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [])

  // ── CREATE NOTE ─────────────────────────────────────────────────────────
  const createNote = async () => {
    await flushPendingSave()
    try {
      const r = await fetch('/api/admin/notes', { method: 'POST' })
      const text = await r.text()
      if (!r.ok) throw new Error(`POST failed (${r.status}): ${text.slice(0, 300)}`)
      let data: { note: Note }
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Bad JSON from POST: ${text.slice(0, 300)}`)
      }
      setNotes((prev) => [data.note, ...prev])
      selectNoteInternal(data.note)
      if (isMobile) setSidebarOpen(false)
    } catch (e: any) {
      console.error('[NotesApp create]', e)
      alert(`Couldn't create a new note.\n\n${e?.message || 'Unknown error'}`)
    }
  }

  // ── DELETE NOTE ─────────────────────────────────────────────────────────
  const deleteNote = async () => {
    if (!selectedId) return
    if (!confirm('Delete this note? This cannot be undone.')) return
    // Cancel any pending save so it doesn't fight with the delete
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    pendingRef.current = null
    const idToDelete = selectedId

    try {
      const r = await fetch(`/api/admin/notes/${idToDelete}`, { method: 'DELETE' })
      const text = await r.text()
      if (!r.ok) throw new Error(`DELETE failed (${r.status}): ${text.slice(0, 300)}`)

      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== idToDelete)
        if (next.length > 0) {
          selectNoteInternal(next[0])
        } else {
          setSelectedId(null)
          setEditTitle('')
          setEditBody('')
          editingNoteIdRef.current = null
          pendingRef.current = null
        }
        return next
      })
    } catch (e: any) {
      console.error('[NotesApp delete]', e)
      alert(`Couldn't delete that note.\n\n${e?.message || 'Unknown error'}`)
    }
  }

  // ── SIDEBAR PREVIEW HELPER ──────────────────────────────────────────────
  const previewFor = (n: Note): { title: string; snippet: string } => {
    const liveTitle = n.id === selectedId ? editTitle : n.title
    const liveBody = n.id === selectedId ? editBody : n.body
    const lines = liveBody.split('\n').filter((l) => l.trim())
    let title = liveTitle?.trim() || lines[0]?.slice(0, 60) || 'New Note'
    if (title.length > 60) title = title.slice(0, 60) + '…'
    const snippet = lines.slice(liveTitle ? 0 : 1).join(' ').slice(0, 120) || 'No additional text'
    return { title, snippet }
  }

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {/* Mobile-only top bar with hamburger toggle */}
      {isMobile && (
        <div style={S.mobileTopBar}>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={S.hamburger}
            aria-label="Toggle notes list"
          >
            ☰ Notes ({notes.length})
          </button>
          <button onClick={createNote} style={S.newBtnMobile}>+ New</button>
        </div>
      )}

      <div style={S.inner}>
        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <div
          style={{
            ...S.sidebar,
            ...(isMobile ? S.sidebarMobile : {}),
            ...(isMobile && !sidebarOpen ? S.sidebarHidden : {}),
          }}
        >
          {!isMobile && (
            <div style={S.sidebarHeader}>
              <div style={S.sidebarTitle}>Notes</div>
              <button onClick={createNote} style={S.newBtn} title="New note">
                + New
              </button>
            </div>
          )}

          <div style={S.sidebarList}>
            {loading && <div style={S.message}>Loading…</div>}
            {loadError && (
              <div style={{ ...S.message, color: '#c02020', textAlign: 'left' }}>
                <strong>Error loading notes:</strong>
                <div style={{ marginTop: 6, fontSize: 10, opacity: 0.9 }}>{loadError}</div>
              </div>
            )}
            {!loading && !loadError && notes.length === 0 && (
              <div style={S.message}>
                No notes yet.<br /><br />
                Click <strong>+ New</strong> to start.
              </div>
            )}
            {notes.map((n) => {
              const { title, snippet } = previewFor(n)
              const isSelected = n.id === selectedId
              return (
                <button
                  key={n.id}
                  onClick={() => selectNote(n)}
                  style={{
                    ...S.sidebarItem,
                    background: isSelected ? '#ffd96a' : 'transparent',
                    borderLeft: '3px solid ' + (isSelected ? '#d4a020' : 'transparent'),
                  }}
                >
                  <div style={S.sidebarItemTitle}>{title}</div>
                  <div style={S.sidebarItemMeta}>
                    <span style={S.sidebarItemDate}>{formatShortDate(new Date(n.updated_at))}</span>
                    <span style={S.sidebarItemSnippet}>{snippet}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── EDITOR ──────────────────────────────────────────────────── */}
        <div style={{
          ...S.editor,
          ...(isMobile && sidebarOpen ? S.editorHiddenOnMobile : {}),
        }}>
          {selectedId ? (
            <>
              <div style={S.editorToolbar}>
                <SaveBadge status={saveStatus} />
                <button onClick={deleteNote} style={S.deleteBtn} title="Delete note">
                  Delete
                </button>
              </div>

              {saveError && (
                <div style={S.saveErrorBanner}>
                  <strong>Save failed:</strong> {saveError}
                  <button
                    onClick={() => { setSaveError(null); void flushPendingSave() }}
                    style={S.retryBtn}
                  >
                    Retry
                  </button>
                </div>
              )}

              <input
                value={editTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Title"
                style={S.titleInput}
                maxLength={500}
              />

              <textarea
                value={editBody}
                onChange={(e) => onBodyChange(e.target.value)}
                placeholder="Start typing..."
                style={S.bodyInput}
                maxLength={100_000}
              />
            </>
          ) : (
            <div style={S.editorEmpty}>
              {notes.length === 0 ? 'Create a note to get started' : 'Select a note from the sidebar'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SAVE BADGE ──────────────────────────────────────────────────────────
function SaveBadge({ status }: { status: SaveStatus }) {
  const map = {
    idle: null,
    saving: { text: 'Saving…', color: '#5a5e6a', bg: '#f0f1f4' },
    saved: { text: '✓ Saved', color: '#1a6a1a', bg: '#e4f5e8' },
    error: { text: '⚠ Error — see below', color: '#c02020', bg: '#fae0e0' },
  } as const
  const s = map[status]
  return (
    <div style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>
      {s && (
        <span style={{
          padding: '3px 8px',
          background: s.bg,
          color: s.color,
          borderRadius: 3,
          letterSpacing: 0.3,
        }}>
          {s.text}
        </span>
      )}
    </div>
  )
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────
function formatShortDate(d: Date): string {
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(
    undefined,
    sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: '2-digit' },
  )
}

// ─── STYLES ──────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#f5f9fd',
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
    color: '#1a1c24',
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
    position: 'relative',
  },

  // Mobile top bar
  mobileTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'linear-gradient(to bottom, #ffd96a, #d4a020)',
    borderBottom: '1px solid #b48a18',
    flexShrink: 0,
  },
  hamburger: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid #8a6a00',
    background: '#fffaf0',
    color: '#3a2a00',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  newBtnMobile: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid #8a6a00',
    background: '#fffaf0',
    color: '#5a4500',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // ── Sidebar ────────────────────────────────────────────────────────
  sidebar: {
    width: 260,
    flexShrink: 0,
    background: '#ffe27a',
    borderRight: '1px solid #d4a020',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarMobile: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: '85%',
    maxWidth: 320,
    zIndex: 5,
    boxShadow: '4px 0 16px rgba(0,0,0,0.18)',
    transition: 'transform 0.18s ease',
  },
  sidebarHidden: {
    transform: 'translateX(-100%)',
  },
  sidebarHeader: {
    padding: '10px 12px',
    background: 'linear-gradient(to bottom, #ffd96a, #d4a020)',
    borderBottom: '1px solid #b48a18',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: '#3a2a00',
  },
  newBtn: {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid #8a6a00',
    background: '#fffaf0',
    color: '#5a4500',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  sidebarList: {
    flex: 1,
    overflowY: 'auto',
  },
  sidebarItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    border: 'none',
    borderBottom: '1px solid rgba(180,138,24,0.3)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    color: '#1a1c24',
  },
  sidebarItemTitle: {
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  sidebarItemMeta: {
    display: 'flex',
    gap: 6,
    fontSize: 10,
    color: '#5a4500',
  },
  sidebarItemDate: {
    flexShrink: 0,
    fontWeight: 600,
  },
  sidebarItemSnippet: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    opacity: 0.8,
  },

  // ── Editor ─────────────────────────────────────────────────────────
  editor: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    minWidth: 0,
  },
  editorHiddenOnMobile: {
    // When sidebar is open on mobile, editor is technically still there
    // behind the sidebar — let the sidebar overlay it
  },
  editorToolbar: {
    padding: '8px 14px',
    borderBottom: '1px solid #e2e4ea',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#f8fafd',
    flexShrink: 0,
  },
  saveErrorBanner: {
    padding: '10px 14px',
    background: '#fae0e0',
    borderBottom: '1px solid #c02020',
    color: '#5a0000',
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    lineHeight: 1.4,
  },
  retryBtn: {
    marginLeft: 'auto',
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid #c02020',
    background: '#fff',
    color: '#c02020',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'inherit',
    flexShrink: 0,
  },
  deleteBtn: {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid #c02020',
    background: '#fff',
    color: '#c02020',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  titleInput: {
    padding: '14px 18px 4px',
    border: 'none',
    outline: 'none',
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1c24',
    fontFamily: 'inherit',
    background: 'transparent',
  },
  bodyInput: {
    flex: 1,
    padding: '8px 18px 18px',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: 14,
    lineHeight: 1.55,
    color: '#1a1c24',
    fontFamily: 'inherit',
    background: 'transparent',
    minHeight: 0,
  },
  editorEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: '#8a8e96',
    fontSize: 12,
    padding: 20,
    textAlign: 'center',
  },
  message: {
    padding: 20,
    fontSize: 11,
    color: '#5a4500',
    textAlign: 'center',
  },
}