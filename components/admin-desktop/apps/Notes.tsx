'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// =============================================================================
// NOTES APP — v22.d
// =============================================================================
// Changes from v22:
//   1. SYNC button removed — was solving a problem that didn't exist for a
//      single-admin setup. Refresh handles re-sync now.
//   2. CHECKLIST NOTE TYPE added. The same notes table holds both types;
//      checklists are differentiated by the `body` column containing JSON
//      with shape:
//        { "type": "checklist", "items": [{"text": "...", "done": false}, ...] }
//      Anything that doesn't parse as that shape is treated as a regular
//      text note (backwards compatible — all existing notes stay text notes).
//   3. Toolbar has TWO create buttons: "+ Note" and "+ Checklist". Selecting
//      a checklist row in the sidebar shows the checklist editor on the
//      right; selecting a text note shows the standard textarea.
//   4. Mobile scroll bug — fixed at the AppWindow layer (v22.1), which
//      now uses `overflow: hidden` on the window body and lets each app
//      manage its own scroll containers. So Notes' inner scroll regions
//      (sidebar list, body textarea, checklist items list) work properly
//      on iPhone without competing scroll boundaries.
// =============================================================================

interface Note {
  id: string
  title: string
  body: string  // For checklists this is a JSON string. For text notes, raw text.
  created_at: string
  updated_at: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface ChecklistItem {
  text: string
  done: boolean
}

interface ChecklistPayload {
  type: 'checklist'
  items: ChecklistItem[]
}

const MOBILE_BREAKPOINT = 720
const CHECKLIST_MARKER = '"type":"checklist"'  // quick string check before parsing

// ── CHECKLIST <-> JSON helpers ─────────────────────────────────────────────
// We round-trip the items array through the body string. A checklist's
// "title" stays in the title field same as a text note.
function parseChecklist(body: string): ChecklistPayload | null {
  // Cheap pre-check — avoids JSON.parse on the 99% of notes that are text
  if (!body || !body.includes(CHECKLIST_MARKER)) return null
  try {
    const parsed = JSON.parse(body)
    if (parsed?.type === 'checklist' && Array.isArray(parsed.items)) {
      return {
        type: 'checklist',
        items: parsed.items
          .filter((i: any) => typeof i?.text === 'string')
          .map((i: any) => ({
            text: String(i.text),
            done: !!i.done,
          })),
      }
    }
  } catch {
    return null
  }
  return null
}

function serializeChecklist(items: ChecklistItem[]): string {
  const payload: ChecklistPayload = { type: 'checklist', items }
  return JSON.stringify(payload)
}

// Splits a comma-pasted string into items. Trims, drops blanks. Used
// both for the initial paste-into-input and the add-more flow.
function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// ============================================================================

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Edit buffers
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')              // for text notes
  const [editItems, setEditItems] = useState<ChecklistItem[]>([])  // for checklists
  const [addItemsInput, setAddItemsInput] = useState('')    // "type more items, comma-separated"

  // What note type is currently being edited
  const [editingKind, setEditingKind] = useState<'text' | 'checklist' | null>(null)

  // Save infra
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Snapshot of what to save on next flush — updated synchronously so the
  // debounced flush sees latest values
  const pendingRef = useRef<{
    id: string
    title: string
    body: string  // either raw text or serialized JSON; whatever ends up in DB
  } | null>(null)

  // ── MOBILE DETECTION ─────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const m = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(m)
      if (!m) setSidebarOpen(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── LOAD NOTES ───────────────────────────────────────────────────────────
  const loadNotes = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch('/api/admin/notes', { cache: 'no-store' })
      const text = await r.text()
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`)
      let d: { notes: Note[] }
      try {
        d = JSON.parse(text)
      } catch {
        throw new Error(`Bad JSON from /api/admin/notes: ${text.slice(0, 200)}`)
      }
      const list = Array.isArray(d.notes) ? d.notes : []
      setNotes(list)
      if (list.length > 0 && !selectedId) {
        selectNoteInternal(list[0])
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load notes')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── SELECT NOTE — populates the right edit buffer based on note type ────
  const selectNoteInternal = useCallback((note: Note) => {
    setSelectedId(note.id)
    setEditTitle(note.title)
    setSaveStatus('idle')
    setSaveError(null)
    setAddItemsInput('')

    const checklist = parseChecklist(note.body)
    if (checklist) {
      setEditingKind('checklist')
      setEditBody('')
      setEditItems(checklist.items)
      pendingRef.current = {
        id: note.id,
        title: note.title,
        body: serializeChecklist(checklist.items),
      }
    } else {
      setEditingKind('text')
      setEditBody(note.body)
      setEditItems([])
      pendingRef.current = {
        id: note.id,
        title: note.title,
        body: note.body,
      }
    }
  }, [])

  const selectNote = useCallback((note: Note) => {
    flushPendingSave()
    selectNoteInternal(note)
    if (isMobile) setSidebarOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, selectNoteInternal])

  // ── EDIT HANDLERS ───────────────────────────────────────────────────────

  const onTitleChange = (value: string) => {
    setEditTitle(value)
    if (!selectedId || !pendingRef.current) return
    pendingRef.current = {
      id: selectedId,
      title: value,
      body: pendingRef.current.body,
    }
    scheduleSave()
  }

  const onBodyChange = (value: string) => {
    setEditBody(value)
    if (!selectedId) return
    pendingRef.current = {
      id: selectedId,
      title: editTitle,
      body: value,
    }
    scheduleSave()
  }

  // Mutating items always reserializes and schedules a save
  const updateItems = (next: ChecklistItem[]) => {
    setEditItems(next)
    if (!selectedId) return
    pendingRef.current = {
      id: selectedId,
      title: editTitle,
      body: serializeChecklist(next),
    }
    scheduleSave()
  }

  const toggleItem = (idx: number) => {
    const next = editItems.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    )
    updateItems(next)
  }

  const removeItem = (idx: number) => {
    const next = editItems.filter((_, i) => i !== idx)
    updateItems(next)
  }

  const editItemText = (idx: number, text: string) => {
    const next = editItems.map((item, i) =>
      i === idx ? { ...item, text } : item
    )
    updateItems(next)
  }

  const addItemsFromInput = () => {
    const additions = parseCommaList(addItemsInput).map((text) => ({
      text,
      done: false,
    }))
    if (additions.length === 0) return
    updateItems([...editItems, ...additions])
    setAddItemsInput('')
  }

  // ── SAVE ─────────────────────────────────────────────────────────────────

  const scheduleSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(() => {
      void flushPendingSave()
    }, 800)
  }

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
        throw new Error(`PATCH failed (${r.status}): ${text.slice(0, 300)}`)
      }
      let data: { note: Note | null } = { note: null }
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(`Bad JSON from PATCH: ${text.slice(0, 300)}`)
      }

      if (data.note) {
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

  // Best-effort flush on unmount (e.g. tab close)
  useEffect(() => {
    return () => {
      const pending = pendingRef.current
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedHideTimerRef.current) clearTimeout(savedHideTimerRef.current)
      if (pending) {
        fetch(`/api/admin/notes/${pending.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: pending.title, body: pending.body }),
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [])

  // ── CREATE ───────────────────────────────────────────────────────────────

  const createNote = async (kind: 'text' | 'checklist') => {
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

      // If checklist, immediately PATCH the new note with the checklist
      // payload so its body is the JSON form from row zero. Otherwise the
      // existing body (likely empty) stays as plain text.
      let newNote = data.note
      if (kind === 'checklist') {
        const initialBody = serializeChecklist([])
        try {
          const pr = await fetch(`/api/admin/notes/${newNote.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Checklist', body: initialBody }),
          })
          if (pr.ok) {
            const pd = await pr.json()
            if (pd?.note) newNote = pd.note
          }
        } catch {
          // Non-fatal — note still exists, body will be set on first edit
        }
      }

      setNotes((prev) => [newNote, ...prev])
      selectNoteInternal(newNote)
      if (isMobile) setSidebarOpen(false)
    } catch (e: any) {
      console.error('[NotesApp create]', e)
      alert(`Couldn't create. ${e?.message || 'Unknown error'}`)
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────

  const deleteNote = async () => {
    if (!selectedId) return
    if (!confirm('Delete this? This cannot be undone.')) return
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
          setEditItems([])
          setEditingKind(null)
          pendingRef.current = null
        }
        return next
      })
    } catch (e: any) {
      console.error('[NotesApp delete]', e)
      alert(`Couldn't delete. ${e?.message || 'Unknown error'}`)
    }
  }

  // ── SIDEBAR PREVIEW HELPER ──────────────────────────────────────────────
  // For checklists: title from title field, snippet = "3 / 7 done" + first items.
  // For text notes: title fallback + body snippet (same as before).
  const previewFor = (n: Note): {
    title: string
    snippet: string
    badge: string
    isChecklist: boolean
  } => {
    const liveTitle = n.id === selectedId ? editTitle : n.title

    // Try checklist first
    const liveBody = n.id === selectedId
      ? (editingKind === 'checklist' ? serializeChecklist(editItems) : editBody)
      : n.body
    const checklist = parseChecklist(liveBody)

    if (checklist) {
      const done = checklist.items.filter((i) => i.done).length
      const total = checklist.items.length
      const title = liveTitle?.trim() || 'Checklist'
      const snippet = total === 0
        ? 'Empty'
        : `${done} / ${total} done` + (total > 0 ? ' — ' + checklist.items.slice(0, 3).map((i) => i.text).join(', ') : '')
      return {
        title: title.length > 60 ? title.slice(0, 60) + '…' : title,
        snippet: snippet.slice(0, 120),
        badge: '☑',
        isChecklist: true,
      }
    }

    // Text note
    const lines = liveBody.split('\n').filter((l) => l.trim())
    let title = liveTitle?.trim() || lines[0]?.slice(0, 60) || 'New Note'
    if (title.length > 60) title = title.slice(0, 60) + '…'
    const snippet = lines.slice(liveTitle ? 0 : 1).join(' ').slice(0, 120) || 'No additional text'
    return {
      title,
      snippet,
      badge: '📝',
      isChecklist: false,
    }
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      {isMobile && (
        <div style={S.mobileTopBar}>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={S.hamburger}
            aria-label="Toggle list"
          >
            ☰ {notes.length}
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => createNote('text')} style={S.newBtnMobile}>+ Note</button>
            <button onClick={() => createNote('checklist')} style={S.newBtnMobile}>+ List</button>
          </div>
        </div>
      )}

      <div style={S.inner}>
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
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => createNote('text')} style={S.newBtn} title="New text note">
                  + Note
                </button>
                <button onClick={() => createNote('checklist')} style={S.newBtn} title="New checklist">
                  + List
                </button>
              </div>
            </div>
          )}

          <div style={S.sidebarList}>
            {loading && !notes.length && <div style={S.message}>Loading…</div>}
            {loadError && (
              <div style={{ ...S.message, color: '#c02020', textAlign: 'left' }}>
                <strong>Error loading:</strong>
                <div style={{ marginTop: 6, fontSize: 10, opacity: 0.9 }}>{loadError}</div>
              </div>
            )}
            {!loading && !loadError && notes.length === 0 && (
              <div style={S.message}>
                Nothing yet.<br /><br />
                Click <strong>+ Note</strong> or <strong>+ List</strong> to start.
              </div>
            )}
            {notes.map((n) => {
              const { title, snippet, badge } = previewFor(n)
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
                  <div style={S.sidebarItemTitle}>
                    <span style={S.sidebarItemBadge}>{badge}</span>
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

        <div style={S.editor}>
          {selectedId ? (
            <>
              <div style={S.editorToolbar}>
                <SaveBadge status={saveStatus} />
                <button onClick={deleteNote} style={S.deleteBtn} title="Delete">
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
                placeholder={editingKind === 'checklist' ? 'Checklist title' : 'Title'}
                style={S.titleInput}
                maxLength={500}
              />

              {editingKind === 'checklist' ? (
                <ChecklistEditor
                  items={editItems}
                  onToggle={toggleItem}
                  onRemove={removeItem}
                  onEditText={editItemText}
                  addInput={addItemsInput}
                  setAddInput={setAddItemsInput}
                  onAddItems={addItemsFromInput}
                />
              ) : (
                <textarea
                  value={editBody}
                  onChange={(e) => onBodyChange(e.target.value)}
                  placeholder="Start typing..."
                  style={S.bodyInput}
                  maxLength={100_000}
                />
              )}
            </>
          ) : (
            <div style={S.editorEmpty}>
              {notes.length === 0
                ? 'Create a note or checklist to get started'
                : 'Select something from the sidebar'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// CHECKLIST EDITOR
// =============================================================================
function ChecklistEditor({
  items,
  onToggle,
  onRemove,
  onEditText,
  addInput,
  setAddInput,
  onAddItems,
}: {
  items: ChecklistItem[]
  onToggle: (idx: number) => void
  onRemove: (idx: number) => void
  onEditText: (idx: number, text: string) => void
  addInput: string
  setAddInput: (s: string) => void
  onAddItems: () => void
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onAddItems()
    }
  }

  return (
    <div style={S.checklistRoot}>
      <div style={S.checklistList}>
        {items.length === 0 ? (
          <div style={S.checklistEmpty}>
            No items yet. Paste comma-separated items below to add (e.g., <em>eggs, milk, bread</em>).
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              style={{
                ...S.checklistRow,
                opacity: item.done ? 0.55 : 1,
              }}
            >
              <button
                onClick={() => onToggle(idx)}
                style={{
                  ...S.checkbox,
                  background: item.done ? '#2d7a2d' : '#ffffff',
                  borderColor: item.done ? '#2d7a2d' : '#8a6a00',
                  color: item.done ? '#fff' : 'transparent',
                }}
                aria-label={item.done ? 'Mark not done' : 'Mark done'}
              >
                ✓
              </button>
              <input
                type="text"
                value={item.text}
                onChange={(e) => onEditText(idx, e.target.value)}
                style={{
                  ...S.checklistText,
                  textDecoration: item.done ? 'line-through' : 'none',
                  color: item.done ? '#5a4500' : '#1a1c24',
                }}
                maxLength={300}
              />
              <button
                onClick={() => onRemove(idx)}
                style={S.removeBtn}
                aria-label="Remove item"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div style={S.checklistAddRow}>
        <input
          type="text"
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add items, comma-separated (eggs, milk, bread)"
          style={S.checklistAddInput}
          maxLength={2000}
        />
        <button
          onClick={onAddItems}
          disabled={!addInput.trim()}
          style={{
            ...S.checklistAddBtn,
            opacity: addInput.trim() ? 1 : 0.5,
            cursor: addInput.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          + Add
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// SAVE BADGE
// =============================================================================
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
  return d.toLocaleDateString(
    undefined,
    sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: '2-digit' },
  )
}

// =============================================================================
// STYLES
// =============================================================================
// Notes manages its own scroll containers. AppWindow's body wrapper is
// `overflow: hidden` (v22.1) so we don't fight with it. Every flex parent
// that has a scrolling child gets `minHeight: 0` to keep iOS from growing
// past the visible area.
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
    minHeight: 0,
  },
  inner: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },

  mobileTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'linear-gradient(to bottom, #ffd96a, #d4a020)',
    borderBottom: '1px solid #b48a18',
    flexShrink: 0,
    gap: 8,
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
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 700,
    border: '1px solid #8a6a00',
    background: '#fffaf0',
    color: '#5a4500',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },

  sidebar: {
    width: 260,
    flexShrink: 0,
    background: '#ffe27a',
    borderRight: '1px solid #d4a020',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
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
    gap: 8,
  },
  sidebarTitle: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: '#3a2a00',
  },
  newBtn: {
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 700,
    border: '1px solid #8a6a00',
    background: '#fffaf0',
    color: '#5a4500',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  sidebarList: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
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
  sidebarItemBadge: {
    display: 'inline-block',
    marginRight: 6,
    opacity: 0.7,
    fontSize: 11,
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

  editor: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
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
    flexShrink: 0,
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
    WebkitOverflowScrolling: 'touch',
    overflowY: 'auto',
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

  // ── CHECKLIST EDITOR ────────────────────────────────────────────────────
  checklistRoot: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  checklistList: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    minHeight: 0,
    padding: '8px 14px',
  },
  checklistEmpty: {
    padding: '12px 4px',
    fontSize: 12,
    color: '#8a8e96',
    fontStyle: 'italic',
  },
  checklistRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 4px',
    borderBottom: '1px solid #f0eddd',
    transition: 'opacity 0.15s',
  },
  checkbox: {
    width: 22,
    height: 22,
    minWidth: 22,
    border: '2px solid #8a6a00',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    fontFamily: 'inherit',
    transition: 'background 0.12s, border-color 0.12s',
  },
  checklistText: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 14,
    lineHeight: 1.4,
    fontFamily: 'inherit',
    padding: '4px 2px',
    minWidth: 0,
  },
  removeBtn: {
    width: 22,
    height: 22,
    minWidth: 22,
    border: '1px solid #c8b070',
    background: 'transparent',
    color: '#8a6a00',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    fontFamily: 'inherit',
  },
  checklistAddRow: {
    flexShrink: 0,
    padding: '10px 14px',
    borderTop: '1px solid #e2e4ea',
    background: '#f8fafd',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  checklistAddInput: {
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    fontSize: 13,
    border: '1px solid #c4c8d0',
    borderRadius: 4,
    fontFamily: 'inherit',
    outline: 'none',
    background: '#ffffff',
    color: '#1a1c24',
  },
  checklistAddBtn: {
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid #8a6a00',
    background: '#fffaf0',
    color: '#5a4500',
    borderRadius: 4,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
}'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import type { CSSProperties, DragEvent } from 'react'

// =============================================================================
// NOTES APP — v23
// =============================================================================
// iCloud-style notes: sidebar list + editor. Supports two note kinds:
//   - text note  (body is plain text)
//   - checklist  (body is JSON: {"type":"checklist","items":[{text,done}]})
//
// v23 ADDS:
//   - Star toggle (☆/★) on each sidebar row.
//   - Starred notes pin to the TOP in a "Pinned" group, draggable to reorder
//     among themselves (HTML5 drag-and-drop). Reorder persists via
//     POST /api/admin/notes/reorder { orderedIds }.
//   - Unstarred notes render below under "Notes", sorted by recency, not
//     draggable.
//   - Server returns notes already ordered (starred → pin_order → updated_at),
//     so we mostly trust server order and only re-sort optimistically on
//     local star/drag actions.
//
// RETAINED FROM v22:
//   - Checklist note type with comma-paste add, check/uncheck, inline edit,
//     remove.
//   - Mobile layout: hamburger drawer sidebar, full-width editor, momentum
//     scroll fixes (minHeight:0 on flex parents, WebkitOverflowScrolling).
//   - 1s debounced autosave for title/body.
//   - Sync button REMOVED in a prior v23 step (per request); not re-added.
// =============================================================================

interface Note {
  id: string
  title: string
  body: string
  starred: boolean
  pin_order: number | null
  created_at: string
  updated_at: string
}

interface ChecklistItem {
  text: string
  done: boolean
}

const CHECKLIST_MARKER = 'checklist'

function parseChecklist(body: string): ChecklistItem[] | null {
  if (!body) return null
  try {
    const parsed = JSON.parse(body)
    if (parsed && parsed.type === CHECKLIST_MARKER && Array.isArray(parsed.items)) {
      return parsed.items.map((it: any) => ({
        text: String(it.text ?? ''),
        done: !!it.done,
      }))
    }
  } catch {
    // not JSON → plain text note
  }
  return null
}

function serializeChecklist(items: ChecklistItem[]): string {
  return JSON.stringify({ type: CHECKLIST_MARKER, items })
}

function isChecklistNote(n: Note): boolean {
  return parseChecklist(n.body) !== null
}

function checklistPreview(items: ChecklistItem[]): string {
  const done = items.filter((i) => i.done).length
  const names = items.map((i) => i.text).filter(Boolean).slice(0, 4).join(', ')
  return `${done} / ${items.length} done${names ? ' — ' + names : ''}`
}

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [checklistAddInput, setChecklistAddInput] = useState('')

  // drag state for pinned reorder
  const dragIdRef = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingIdRef = useRef<string | null>(null)

  // ── mobile detection ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const probe = () => {
      const m = window.innerWidth < 720
      setIsMobile(m)
      setSidebarOpen(!m) // open by default on desktop, closed on mobile
    }
    probe()
    window.addEventListener('resize', probe)
    return () => window.removeEventListener('resize', probe)
  }, [])

  // ── load notes ────────────────────────────────────────────────────────
  const loadNotes = useCallback(async (selectFirst = false) => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/admin/notes', { cache: 'no-store' })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error || `HTTP ${r.status}`)
        setNotes([])
        return
      }
      const list: Note[] = data.notes ?? []
      setNotes(list)
      if (selectFirst && list.length > 0 && !selectedId) {
        selectNote(list[0])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    loadNotes(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── selection ───────────────────────────────────────────────────────────
  const selectNote = (n: Note) => {
    // flush any pending save for the previously-edited note before switching
    flushPendingSave()
    setSelectedId(n.id)
    editingIdRef.current = n.id
    setEditTitle(n.title)
    setEditBody(n.body)
    setChecklistAddInput('')
    if (isMobile) setSidebarOpen(false)
  }

  const selected = notes.find((n) => n.id === selectedId) || null
  const selectedChecklist = selected ? parseChecklist(editBody) : null

  // ── autosave (debounced) ─────────────────────────────────────────────────
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const id = editingIdRef.current
    if (!id) return
    // fire and forget; loadNotes not needed since we update local state
    const titleNow = titleRef.current
    const bodyNow = bodyRef.current
    fetch(`/api/admin/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleNow, body: bodyNow }),
    }).catch(() => {})
  }, [])

  // keep latest edit values in refs so flush uses fresh data
  const titleRef = useRef(editTitle)
  const bodyRef = useRef(editBody)
  useEffect(() => { titleRef.current = editTitle }, [editTitle])
  useEffect(() => { bodyRef.current = editBody }, [editBody])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const id = editingIdRef.current
      if (!id) return
      const titleNow = titleRef.current
      const bodyNow = bodyRef.current
      fetch(`/api/admin/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleNow, body: bodyNow }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.note) {
            setNotes((prev) =>
              prev.map((n) => (n.id === d.note.id ? { ...n, ...d.note } : n))
            )
          }
        })
        .catch(() => {})
    }, 1000)
  }, [])

  const onTitleChange = (v: string) => {
    setEditTitle(v)
    scheduleSave()
  }
  const onBodyChange = (v: string) => {
    setEditBody(v)
    scheduleSave()
  }

  // flush on unmount
  useEffect(() => {
    return () => { flushPendingSave() }
  }, [flushPendingSave])

  // ── create ────────────────────────────────────────────────────────────
  const createNote = async (asChecklist: boolean) => {
    try {
      const r = await fetch('/api/admin/notes', { method: 'POST' })
      const data = await r.json()
      if (!r.ok || !data.note) {
        setError(data.error || 'Create failed')
        return
      }
      let note: Note = data.note
      if (asChecklist) {
        const body = serializeChecklist([])
        const r2 = await fetch(`/api/admin/notes/${note.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Checklist', body }),
        })
        const d2 = await r2.json()
        if (d2.note) note = d2.note
      }
      setNotes((prev) => [note, ...prev])
      selectNote(note)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // ── delete ──────────────────────────────────────────────────────────────
  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note? This cannot be undone.')) return
    try {
      const r = await fetch(`/api/admin/notes/${id}`, { method: 'DELETE' })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'Delete failed')
        return
      }
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (selectedId === id) {
        setSelectedId(null)
        editingIdRef.current = null
        setEditTitle('')
        setEditBody('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // ── star toggle ──────────────────────────────────────────────────────────
  const toggleStar = async (n: Note) => {
    const nextStarred = !n.starred
    // optimistic
    setNotes((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, starred: nextStarred } : x))
    )
    try {
      const r = await fetch(`/api/admin/notes/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: nextStarred }),
      })
      const d = await r.json()
      if (d.note) {
        setNotes((prev) => {
          const updated = prev.map((x) => (x.id === d.note.id ? { ...x, ...d.note } : x))
          return sortNotes(updated)
        })
      } else {
        // re-sync from server if shape unexpected
        loadNotes()
      }
    } catch {
      loadNotes()
    }
  }

  // ── pinned drag reorder ──────────────────────────────────────────────────
  const onDragStart = (id: string) => {
    dragIdRef.current = id
  }
  const onDragOver = (e: DragEvent, overId: string) => {
    e.preventDefault()
    if (dragIdRef.current && dragIdRef.current !== overId) {
      setDragOverId(overId)
    }
  }
  const onDrop = (overId: string) => {
    const dragId = dragIdRef.current
    dragIdRef.current = null
    setDragOverId(null)
    if (!dragId || dragId === overId) return

    const pinned = sortNotes(notes).filter((n) => n.starred)
    const fromIdx = pinned.findIndex((n) => n.id === dragId)
    const toIdx = pinned.findIndex((n) => n.id === overId)
    if (fromIdx < 0 || toIdx < 0) return

    const reordered = [...pinned]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    // optimistic local pin_order assignment
    const orderedIds = reordered.map((n) => n.id)
    setNotes((prev) => {
      const orderMap = new Map(orderedIds.map((id, i) => [id, i]))
      const next = prev.map((n) =>
        orderMap.has(n.id) ? { ...n, pin_order: orderMap.get(n.id)!, starred: true } : n
      )
      return sortNotes(next)
    })

    // persist (option B — one call)
    fetch('/api/admin/notes/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    }).catch(() => loadNotes())
  }

  // ── checklist ops ─────────────────────────────────────────────────────────
  const updateChecklist = (items: ChecklistItem[]) => {
    const body = serializeChecklist(items)
    setEditBody(body)
    scheduleSave()
  }

  const addChecklistItems = () => {
    const raw = checklistAddInput.trim()
    if (!raw || !selectedChecklist) return
    const newItems = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: false }))
    if (newItems.length === 0) return
    updateChecklist([...selectedChecklist, ...newItems])
    setChecklistAddInput('')
  }

  const toggleChecklistItem = (idx: number) => {
    if (!selectedChecklist) return
    const next = selectedChecklist.map((it, i) =>
      i === idx ? { ...it, done: !it.done } : it
    )
    updateChecklist(next)
  }
  const editChecklistItem = (idx: number, text: string) => {
    if (!selectedChecklist) return
    const next = selectedChecklist.map((it, i) => (i === idx ? { ...it, text } : it))
    updateChecklist(next)
  }
  const removeChecklistItem = (idx: number) => {
    if (!selectedChecklist) return
    updateChecklist(selectedChecklist.filter((_, i) => i !== idx))
  }

  // ── derived lists ─────────────────────────────────────────────────────────
  const sorted = sortNotes(notes)
  const pinned = sorted.filter((n) => n.starred)
  const unpinned = sorted.filter((n) => !n.starred)

  // ── render row ─────────────────────────────────────────────────────────────
  const renderRow = (n: Note, draggable: boolean) => {
    const checklist = parseChecklist(n.body)
    const preview = checklist
      ? checklistPreview(checklist)
      : (n.body || '').replace(/\s+/g, ' ').slice(0, 80)
    const isSel = n.id === selectedId
    const isDragTarget = dragOverId === n.id
    return (
      <div
        key={n.id}
        draggable={draggable}
        onDragStart={() => draggable && onDragStart(n.id)}
        onDragOver={(e) => draggable && onDragOver(e, n.id)}
        onDrop={() => draggable && onDrop(n.id)}
        onClick={() => selectNote(n)}
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #eef0f3',
          cursor: 'pointer',
          background: isSel ? '#e8f0fe' : isDragTarget ? '#fff7e0' : '#fff',
          borderTop: isDragTarget ? '2px solid #f5b400' : '2px solid transparent',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleStar(n)
          }}
          title={n.starred ? 'Unpin' : 'Pin to top'}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: 15,
            lineHeight: 1,
            color: n.starred ? '#f5b400' : '#bbb',
            padding: 0,
            marginTop: 1,
            flexShrink: 0,
          }}
        >
          {n.starred ? '★' : '☆'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#222',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12 }}>{checklist ? '☑' : '📝'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {n.title || '(untitled)'}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#888',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {preview || 'No content'}
          </div>
        </div>
        {draggable && (
          <span style={{ color: '#ccc', fontSize: 14, flexShrink: 0, marginTop: 1 }} aria-hidden>
            ⠿
          </span>
        )}
      </div>
    )
  }

  // ── sidebar ─────────────────────────────────────────────────────────────
  const sidebar = (
    <div style={sidebarStyle(isMobile, sidebarOpen)}>
      <div style={sidebarHeaderStyle}>
        <button onClick={() => createNote(false)} style={newBtnStyle}>＋ Note</button>
        <button onClick={() => createNote(true)} style={newBtnStyle}>＋ List</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {loading && <div style={emptyStyle}>Loading…</div>}
        {error && <div style={{ ...emptyStyle, color: '#c44' }}>Error: {error}</div>}
        {!loading && notes.length === 0 && <div style={emptyStyle}>No notes yet</div>}

        {pinned.length > 0 && (
          <>
            <div style={groupHeaderStyle}>Pinned</div>
            {pinned.map((n) => renderRow(n, true))}
          </>
        )}
        {unpinned.length > 0 && (
          <>
            {pinned.length > 0 && <div style={groupHeaderStyle}>Notes</div>}
            {unpinned.map((n) => renderRow(n, false))}
          </>
        )}
      </div>
    </div>
  )

  // ── editor ───────────────────────────────────────────────────────────────
  const editor = (
    <div style={editorStyle}>
      {isMobile && (
        <div style={mobileBarStyle}>
          <button onClick={() => setSidebarOpen(true)} style={iconBtnStyle}>☰ Notes</button>
          {selected && (
            <button onClick={() => deleteNote(selected.id)} style={{ ...iconBtnStyle, color: '#c44' }}>
              Delete
            </button>
          )}
        </div>
      )}

      {!selected ? (
        <div style={editorEmptyStyle}>Select or create a note</div>
      ) : (
        <>
          <div style={editorHeaderStyle}>
            <input
              value={editTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Title"
              style={titleInputStyle}
            />
            <button
              onClick={() => toggleStar(selected)}
              title={selected.starred ? 'Unpin' : 'Pin to top'}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 20,
                color: selected.starred ? '#f5b400' : '#bbb',
                flexShrink: 0,
              }}
            >
              {selected.starred ? '★' : '☆'}
            </button>
            {!isMobile && (
              <button
                onClick={() => deleteNote(selected.id)}
                style={{ ...iconBtnStyle, color: '#c44', flexShrink: 0 }}
              >
                Delete
              </button>
            )}
          </div>

          {selectedChecklist ? (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 14, WebkitOverflowScrolling: 'touch' }}>
              {selectedChecklist.length === 0 && (
                <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
                  Empty checklist. Add items below — separate multiple with commas.
                </div>
              )}
              {selectedChecklist.map((item, idx) => (
                <div key={idx} style={checklistRowStyle}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleChecklistItem(idx)}
                    style={{ width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <input
                    value={item.text}
                    onChange={(e) => editChecklistItem(idx, e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      color: item.done ? '#999' : '#222',
                      textDecoration: item.done ? 'line-through' : 'none',
                      background: 'transparent',
                    }}
                  />
                  <button
                    onClick={() => removeChecklistItem(idx)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#c44', fontSize: 16, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input
                  value={checklistAddInput}
                  onChange={(e) => setChecklistAddInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItems() }}
                  placeholder="Add item(s) — comma-separated"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    border: '1px solid #d0d4d8',
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <button onClick={addChecklistItems} style={addBtnStyle}>Add</button>
              </div>
            </div>
          ) : (
            <textarea
              value={editBody}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Start writing…"
              style={bodyTextareaStyle}
            />
          )}
        </>
      )}
    </div>
  )

  return (
    <div style={shellStyle}>
      {sidebar}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={mobileBackdropStyle} />
      )}
      {editor}
    </div>
  )
}

// ── server returns sorted, but we re-sort locally after optimistic edits ──
function sortNotes(list: Note[]): Note[] {
  return [...list].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    if (a.starred && b.starred) {
      const ao = a.pin_order ?? Number.MAX_SAFE_INTEGER
      const bo = b.pin_order ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

// =============================================================================
// STYLES
// =============================================================================
const shellStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'row',
  background: '#fff',
  fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
  overflow: 'hidden',
}

function sidebarStyle(isMobile: boolean, open: boolean): CSSProperties {
  const base: CSSProperties = {
    width: 280,
    flexShrink: 0,
    background: '#f6f8fa',
    borderRight: '1px solid #d0d4d8',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }
  if (!isMobile) return base
  return {
    ...base,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    width: 'min(82%, 320px)',
    transform: open ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.22s ease',
    boxShadow: open ? '4px 0 20px rgba(0,0,0,0.18)' : 'none',
  }
}

const sidebarHeaderStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: 10,
  borderBottom: '1px solid #e5e8eb',
  background: '#fff',
}

const newBtnStyle: CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  background: '#1a73e8',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const groupHeaderStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: '#8a90a0',
  padding: '10px 12px 4px',
  background: '#f6f8fa',
}

const emptyStyle: CSSProperties = {
  padding: 20,
  textAlign: 'center',
  color: '#888',
  fontSize: 13,
}

const editorStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  background: '#fff',
  position: 'relative',
}

const mobileBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 8,
  borderBottom: '1px solid #e5e8eb',
  background: '#fafafa',
  flexShrink: 0,
}

const iconBtnStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #d0d4d8',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#333',
}

const editorEmptyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#888',
  fontSize: 13,
}

const editorHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 12,
  borderBottom: '1px solid #e5e8eb',
  flexShrink: 0,
}

const titleInputStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 18,
  fontWeight: 600,
  color: '#222',
  fontFamily: 'inherit',
  background: 'transparent',
}

const bodyTextareaStyle: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  resize: 'none',
  padding: 16,
  fontSize: 14,
  lineHeight: 1.6,
  color: '#222',
  fontFamily: 'inherit',
  minHeight: 0,
  WebkitOverflowScrolling: 'touch',
}

const checklistRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 0',
  borderBottom: '1px solid #f0f0f0',
}

const addBtnStyle: CSSProperties = {
  padding: '8px 16px',
  background: '#1a73e8',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
}

const mobileBackdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.3)',
  zIndex: 15,
}