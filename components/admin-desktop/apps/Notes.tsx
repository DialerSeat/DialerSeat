'use client'
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

  // keep latest edit values in refs so flush uses fresh data
  const titleRef = useRef(editTitle)
  const bodyRef = useRef(editBody)
  useEffect(() => { titleRef.current = editTitle }, [editTitle])
  useEffect(() => { bodyRef.current = editBody }, [editBody])

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

  // ── selection ───────────────────────────────────────────────────────────
  const selectNote = useCallback((n: Note) => {
    // flush any pending save for the previously-edited note before switching
    flushPendingSave()
    setSelectedId(n.id)
    editingIdRef.current = n.id
    setEditTitle(n.title)
    setEditBody(n.body)
    setChecklistAddInput('')
    if (isMobile) setSidebarOpen(false)
  }, [flushPendingSave, isMobile])

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

  const selected = notes.find((n) => n.id === selectedId) || null
  const selectedChecklist = selected ? parseChecklist(editBody) : null

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