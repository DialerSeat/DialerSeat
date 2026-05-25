'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// =============================================================================
// NOTES APP
// =============================================================================
// iCloud-style notes: sidebar list on the left, editor on the right.
//
// BEHAVIOR:
//   - On mount: GET /api/admin/notes → populate sidebar, select most recent
//   - "+ New" button: POST /api/admin/notes → adds empty note, selects it
//   - Title or body change → debounce 1s → PATCH /api/admin/notes/:id
//   - Delete button (with confirm) → DELETE → remove from sidebar
//   - Editing rules: title = first non-empty line if user hasn't set one
//     (we don't auto-set the title; sidebar derives a preview if title empty)
//
// SAVE-STATUS UX:
//   "Saved" / "Saving…" / "Save failed" badge in the editor toolbar so the
//   admin knows the autosave is working. Goes silent after 2s of "Saved".
// =============================================================================

interface Note {
  id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Local edit buffer for the selected note. Kept separate from `notes` so
  // typing doesn't trigger sidebar re-renders mid-keystroke.
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  // Debounce timer for autosave
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track which note the editor buffer currently corresponds to. Prevents
  // stale debounced saves from clobbering a newly-selected note.
  const editingNoteIdRef = useRef<string | null>(null)
  // Hide the "Saved" pill after a moment
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── INITIAL LOAD ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/notes', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ notes: Note[] }>
      })
      .then((d) => {
        if (cancelled) return
        setNotes(d.notes)
        if (d.notes.length > 0) {
          selectNote(d.notes[0], d.notes)
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e?.message || 'Failed to load notes')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── SELECT NOTE ──────────────────────────────────────────────────────────
  // Loads the note's content into the edit buffer. Flushes any pending save
  // for the previously-selected note FIRST so we don't lose changes.
  const selectNote = useCallback((note: Note, fromList?: Note[]) => {
    flushPendingSave()
    setSelectedId(note.id)
    setEditTitle(note.title)
    setEditBody(note.body)
    editingNoteIdRef.current = note.id
    setSaveStatus('idle')
    // fromList is used only during initial mount to avoid stale `notes`
    void fromList
  }, [])

  // ── AUTOSAVE (debounced 1s) ──────────────────────────────────────────────
  // Triggers whenever the edit buffer changes. Skips if there's no selected
  // note or if buffer matches the stored version.
  useEffect(() => {
    if (!selectedId) return
    if (editingNoteIdRef.current !== selectedId) return

    const stored = notes.find((n) => n.id === selectedId)
    if (!stored) return
    if (stored.title === editTitle && stored.body === editBody) return

    // Clear any previous timer
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      void saveNote(selectedId, editTitle, editBody)
    }, 1000)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTitle, editBody, selectedId])

  // ── FLUSH PENDING SAVE ───────────────────────────────────────────────────
  // Fires any debounced save immediately. Used on note-switch and unmount.
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      const idAtFlush = editingNoteIdRef.current
      if (idAtFlush) {
        void saveNote(idAtFlush, editTitle, editBody)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTitle, editBody])

  // Flush on unmount (e.g. window close)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        // Synchronously fire a fetch — best effort, may not complete on
        // tab close, but worth trying.
        const id = editingNoteIdRef.current
        if (id) {
          fetch(`/api/admin/notes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: editTitle, body: editBody }),
            keepalive: true, // makes the request survive tab-close
          }).catch(() => {})
        }
      }
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── SAVE ─────────────────────────────────────────────────────────────────
  const saveNote = async (id: string, title: string, body: string) => {
    setSaveStatus('saving')
    try {
      const r = await fetch(`/api/admin/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const { note } = (await r.json()) as { note: Note | null }
      if (note) {
        // Update the sidebar copy
        setNotes((prev) => {
          const next = prev.map((n) => (n.id === id ? note : n))
          // Re-sort so the just-edited note bubbles to the top
          next.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          return next
        })
      }
      setSaveStatus('saved')
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
      savedHideTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      console.error('[NotesApp save]', e)
      setSaveStatus('error')
    }
  }

  // ── CREATE ───────────────────────────────────────────────────────────────
  const createNote = async () => {
    flushPendingSave()
    try {
      const r = await fetch('/api/admin/notes', { method: 'POST' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const { note } = (await r.json()) as { note: Note }
      setNotes((prev) => [note, ...prev])
      selectNote(note)
    } catch (e) {
      console.error('[NotesApp create]', e)
      alert("Couldn't create a new note. Check your connection and try again.")
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  const deleteNote = async () => {
    if (!selectedId) return
    if (!confirm('Delete this note? This cannot be undone.')) return
    // Clear any pending save BEFORE delete — don't want it to recreate state
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const idToDelete = selectedId
    try {
      const r = await fetch(`/api/admin/notes/${idToDelete}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== idToDelete)
        // Select the next note (or clear if list is now empty)
        if (next.length > 0) {
          selectNote(next[0])
        } else {
          setSelectedId(null)
          setEditTitle('')
          setEditBody('')
          editingNoteIdRef.current = null
        }
        return next
      })
    } catch (e) {
      console.error('[NotesApp delete]', e)
      alert("Couldn't delete that note. Check your connection and try again.")
    }
  }

  // ── PREVIEW HELPER (sidebar) ─────────────────────────────────────────────
  const previewFor = (n: Note): { title: string; snippet: string } => {
    const liveTitle = n.id === selectedId ? editTitle : n.title
    const liveBody = n.id === selectedId ? editBody : n.body
    // If title is empty, derive one from the first line of the body
    const lines = liveBody.split('\n').filter((l) => l.trim())
    let title = liveTitle?.trim() || lines[0]?.slice(0, 60) || 'New Note'
    if (title.length > 60) title = title.slice(0, 60) + '…'
    const snippet = lines.slice(liveTitle ? 0 : 1).join(' ').slice(0, 120) || 'No additional text'
    return { title, snippet }
  }

  return (
    <div style={S.root}>
      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.sidebarTitle}>Notes</div>
          <button onClick={createNote} style={S.newBtn} title="New note">
            + New
          </button>
        </div>

        <div style={S.sidebarList}>
          {loading && <div style={S.message}>Loading…</div>}
          {loadError && <div style={{ ...S.message, color: '#c02020' }}>{loadError}</div>}
          {!loading && !loadError && notes.length === 0 && (
            <div style={S.message}>
              No notes yet.
              <br />
              <br />
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
                <div style={{ ...S.sidebarItemTitle, color: isSelected ? '#1a1c24' : '#1a1c24' }}>
                  {title}
                </div>
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
      <div style={S.editor}>
        {selectedId ? (
          <>
            <div style={S.editorToolbar}>
              <SaveBadge status={saveStatus} />
              <button onClick={deleteNote} style={S.deleteBtn} title="Delete note">
                Delete
              </button>
            </div>

            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              style={S.titleInput}
              maxLength={500}
            />

            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
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
  )
}

// =============================================================================
// SAVE BADGE
// =============================================================================

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return <div style={{ flex: 1 }} />

  const map = {
    saving: { text: 'Saving…', color: '#5a5e6a', bg: '#f0f1f4' },
    saved: { text: '✓ Saved', color: '#1a6a1a', bg: '#e4f5e8' },
    error: { text: '⚠ Save failed', color: '#c02020', bg: '#fae0e0' },
  } as const

  const s = map[status]
  return (
    <div
      style={{
        flex: 1,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          padding: '3px 8px',
          background: s.bg,
          color: s.color,
          borderRadius: 3,
          letterSpacing: 0.3,
        }}
      >
        {s.text}
      </span>
    </div>
  )
}

// =============================================================================
// FORMATTERS
// =============================================================================

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
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: '2-digit' })
}

// =============================================================================
// STYLES
// =============================================================================

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    width: '100%',
    height: '100%',
    background: '#f5f9fd',
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
    color: '#1a1c24',
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
    fontSize: 13,
    lineHeight: 1.55,
    color: '#1a1c24',
    fontFamily: 'inherit',
    background: 'transparent',
  },
  editorEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: '#8a8e96',
    fontSize: 12,
  },
  message: {
    padding: 20,
    fontSize: 11,
    color: '#5a4500',
    textAlign: 'center',
  },
}