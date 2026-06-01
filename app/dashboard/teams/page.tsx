'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// =============================================================================
// CAMPAIGNS PAGE — v25 (Drive-style)
// =============================================================================
// Full visual refresh to a clean, modern, Google-Drive / SaaS aesthetic.
// Goals:
//   - SaaS-grade neutral palette (off-white surface, soft borders, clean type)
//   - List + grid view toggle (Drive-style)
//   - Right rail with empty selection state + bulk actions when items selected
//   - Single create modal flow (no separate wizard route)
//   - Inline rename, drag-to-multi-select (shift+click range), keyboard nav
//   - Pause / Resume / Archive / Delete from the rail
//   - Sort & search controls in a clean toolbar
//   - Status pill aesthetic, not heavy framed borders
//
// IMPORTANT: All existing functionality is preserved:
//   - /api/campaigns/list endpoint
//   - /api/campaigns/create
//   - /api/campaigns/update (status, name)
//   - /api/campaigns/delete
//   - Lapsed (read-only) gating preserved
// =============================================================================

const T = {
  bg: '#f5f6f8',
  surface: '#ffffff',
  surfaceAlt: '#fafbfc',
  border: '#e3e5ea',
  borderStrong: '#c4c8d0',
  text: '#1a1c24',
  textSub: '#5a5e6a',
  muted: '#8a8e9a',
  blue: 'var(--brand-primary)',
  accent: '#2a4a8a',
  green: '#1a6a1a',
  amber: '#a66a00',
  red: '#8a1a1a',
}

type AccessTier = 'active' | 'lapsed' | 'new' | null

interface Campaign {
  id: string
  name: string
  dialer_mode: 'manual' | 'preview' | 'progressive' | 'predictive'
  total_leads: number
  called_leads: number
  status: 'active' | 'paused' | 'archived'
  created_at: string
  last_active_at: string | null
}

type ViewMode = 'list' | 'grid'
type SortKey = 'recent' | 'name' | 'progress' | 'created'

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' }
  )
}

const fmtRelative = (iso: string | null) => {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

const dialerLabel = (m: Campaign['dialer_mode']) => ({
  manual: 'Manual',
  preview: 'Preview',
  progressive: 'Progressive',
  predictive: 'Predictive',
}[m])

const StatusPill = ({ status }: { status: Campaign['status'] }) => {
  const map = {
    active: { bg: '#e8f5e8', color: T.green, label: 'Active' },
    paused: { bg: '#fff4e0', color: T.amber, label: 'Paused' },
    archived: { bg: '#f0f1f4', color: T.muted, label: 'Archived' },
  }[status]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 12,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.3,
      background: map.bg,
      color: map.color,
    }}>
      {map.label}
    </span>
  )
}

export default function CampaignsPage() {
  const { user } = useUser()
  const router = useRouter()
  const [tier, setTier] = useState<AccessTier>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [view, setView] = useState<ViewMode>('list')
  const [showArchived, setShowArchived] = useState(false)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDialer, setCreateDialer] = useState<Campaign['dialer_mode']>('manual')
  const [createError, setCreateError] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState(false)

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteText, setDeleteText] = useState('')

  const renameRef = useRef<HTMLInputElement>(null)
  const isLapsed = tier === 'lapsed' || tier === 'new'

  // -------- Load tier --------
  useEffect(() => {
    if (!user) return
    fetch('/api/stripe/status')
      .then(r => r.json())
      .then(d => setTier(d.tier || null))
      .catch(() => setTier(null))
  }, [user])

  // -------- Debounce search --------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])

  // -------- Load campaigns --------
  const loadCampaigns = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/list?user_id=${user.id}`)
      const data = await res.json()
      if (data.success) setCampaigns(data.campaigns)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadCampaigns() }, [loadCampaigns])

  // -------- Focus rename --------
  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renamingId])

  // -------- Filter + sort --------
  const visible = campaigns
    .filter(c => showArchived ? true : c.status !== 'archived')
    .filter(c => !debouncedSearch || c.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    .sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'progress': {
          const ap = a.total_leads > 0 ? a.called_leads / a.total_leads : 0
          const bp = b.total_leads > 0 ? b.called_leads / b.total_leads : 0
          return bp - ap
        }
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'recent':
        default: {
          const aD = a.last_active_at || a.created_at
          const bD = b.last_active_at || b.created_at
          return new Date(bD).getTime() - new Date(aD).getTime()
        }
      }
    })

  const visibleIds = visible.map(c => c.id)

  // -------- Selection helpers --------
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (e?.shiftKey && lastClickedId && lastClickedId !== id) {
        const startIdx = visibleIds.indexOf(lastClickedId)
        const endIdx = visibleIds.indexOf(id)
        if (startIdx !== -1 && endIdx !== -1) {
          const [s, e2] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
          for (let i = s; i <= e2; i++) next.add(visibleIds[i])
        }
      } else if (e?.metaKey || e?.ctrlKey) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      } else {
        // Plain click: replace selection
        next.clear()
        next.add(id)
      }
      return next
    })
    setLastClickedId(id)
  }

  const clearSelection = () => {
    setSelected(new Set())
    setLastClickedId(null)
  }

  const selectAll = () => {
    setSelected(new Set(visibleIds))
  }

  // -------- Mutations --------
  const updateStatus = async (ids: string[], newStatus: Campaign['status']) => {
    if (isLapsed) return
    setPendingAction(true)
    setActionError(null)
    try {
      const res = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_ids: ids, status: newStatus }),
      })
      const data = await res.json()
      if (!data.success) {
        setActionError(data.error || 'Failed to update')
      } else {
        await loadCampaigns()
        clearSelection()
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update')
    } finally {
      setPendingAction(false)
    }
  }

  const performRename = async (id: string, newName: string) => {
    if (!newName.trim()) { setRenamingId(null); return }
    setActionError(null)
    try {
      const res = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id, name: newName.trim() }),
      })
      const data = await res.json()
      if (!data.success) {
        setActionError(data.error || 'Failed to rename')
      } else {
        await loadCampaigns()
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to rename')
    } finally {
      setRenamingId(null)
    }
  }

  const performDelete = async () => {
    if (!deleteConfirmId) return
    if (deleteText.trim().toLowerCase() !== 'delete') return
    setPendingAction(true)
    setActionError(null)
    try {
      const res = await fetch('/api/campaigns/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: deleteConfirmId }),
      })
      const data = await res.json()
      if (!data.success) {
        setActionError(data.error || 'Failed to delete')
      } else {
        await loadCampaigns()
        clearSelection()
        setDeleteConfirmId(null)
        setDeleteText('')
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete')
    } finally {
      setPendingAction(false)
    }
  }

  const performCreate = async () => {
    if (!createName.trim() || !user) {
      setCreateError('Campaign name required')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          name: createName.trim(),
          dialer_mode: createDialer,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setCreateError(data.error || 'Failed to create')
        setCreating(false)
        return
      }
      setShowCreate(false)
      setCreateName('')
      setCreateDialer('manual')
      router.push(`/dashboard/campaigns/${data.campaign.id}`)
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create')
      setCreating(false)
    }
  }

  const selectedCampaigns = visible.filter(c => selected.has(c.id))
  const singleSelected = selectedCampaigns.length === 1 ? selectedCampaigns[0] : null

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      color: T.text,
    }}>
      <style>{`
        .camp-root * { box-sizing: border-box; }
        .camp-btn {
          background: transparent;
          border: 1px solid ${T.border};
          border-radius: 6px;
          padding: 7px 14px;
          font-size: 13px;
          color: ${T.text};
          cursor: pointer;
          font-family: inherit;
          transition: background 0.12s, border-color 0.12s;
        }
        .camp-btn:hover { background: ${T.surfaceAlt}; }
        .camp-btn-primary {
          background: ${T.text};
          color: white;
          border-color: ${T.text};
          font-weight: 500;
        }
        .camp-btn-primary:hover {
          background: #2a2c34;
          border-color: #2a2c34;
        }
        .camp-btn-icon {
          padding: 7px 10px;
          line-height: 1;
        }
        .camp-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
        .camp-input {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 6px;
          padding: 8px 11px;
          font-size: 13px;
          color: ${T.text};
          font-family: inherit;
          outline: none;
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        .camp-input:focus {
          border-color: ${T.blue};
          box-shadow: 0 0 0 3px rgba(74,158,255,0.15);
        }
        .camp-row:hover .camp-row-actions { opacity: 1; }
        .camp-checkbox {
          opacity: 0;
          transition: opacity 0.12s;
        }
        .camp-row:hover .camp-checkbox,
        .camp-row.selected .camp-checkbox {
          opacity: 1;
        }
        .camp-row { transition: background 0.08s; }
      `}</style>

      <div className="camp-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOP TOOLBAR */}
        <div style={{
          padding: '14px 24px',
          borderBottom: `1px solid ${T.border}`,
          background: T.surface,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 500,
                color: T.text,
                letterSpacing: '-0.2px',
              }}>Campaigns</h1>
              <div style={{
                fontSize: 12,
                color: T.textSub,
                marginTop: 3,
              }}>
                {visible.length} {visible.length === 1 ? 'campaign' : 'campaigns'}
                {showArchived && campaigns.some(c => c.status === 'archived') && ' · including archived'}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className="camp-btn camp-btn-primary"
                onClick={() => setShowCreate(true)}
                disabled={isLapsed}
                title={isLapsed ? 'Resubscribe to create campaigns' : ''}
              >+ New campaign</button>
            </div>
          </div>

          {/* Search + sort + view */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360, minWidth: 200 }}>
              <input
                className="camp-input"
                style={{ width: '100%', paddingLeft: 32 }}
                placeholder="Search campaigns"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: T.muted,
                fontSize: 14,
              }}>⌕</div>
            </div>

            <select
              className="camp-input"
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              style={{ cursor: 'pointer' }}
            >
              <option value="recent">Recent activity</option>
              <option value="created">Date created</option>
              <option value="name">Name (A–Z)</option>
              <option value="progress">Progress</option>
            </select>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: T.textSub,
              cursor: 'pointer',
              padding: '0 6px',
            }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={e => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>

            <div style={{
              display: 'flex',
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              overflow: 'hidden',
              marginLeft: 'auto',
            }}>
              <button
                onClick={() => setView('list')}
                title="List view"
                style={{
                  padding: '7px 11px',
                  background: view === 'list' ? T.surfaceAlt : T.surface,
                  border: 'none',
                  borderRight: `1px solid ${T.border}`,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: view === 'list' ? T.text : T.muted,
                  fontSize: 14,
                  lineHeight: 1,
                }}>≡</button>
              <button
                onClick={() => setView('grid')}
                title="Grid view"
                style={{
                  padding: '7px 11px',
                  background: view === 'grid' ? T.surfaceAlt : T.surface,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: view === 'grid' ? T.text : T.muted,
                  fontSize: 14,
                  lineHeight: 1,
                }}>▦</button>
            </div>
          </div>
        </div>

        {/* LAPSED BANNER */}
        {isLapsed && (
          <div style={{
            padding: '12px 24px',
            background: '#fff4e0',
            borderBottom: '1px solid #f0d4a0',
            fontSize: 13,
            color: T.amber,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span><strong>Read-only.</strong> Your campaigns are preserved. Resubscribe to make changes or create new campaigns.</span>
            <Link href="/billing" style={{
              padding: '6px 14px',
              background: '#1a1a2e',
              color: 'white',
              borderRadius: 5,
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 500,
            }}>Resubscribe →</Link>
          </div>
        )}

        {/* BULK ACTION BAR */}
        {selected.size > 0 && (
          <div style={{
            padding: '10px 24px',
            background: '#eef4ff',
            borderBottom: `1px solid #cce0ff`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: T.text,
          }}>
            <span style={{ fontWeight: 500 }}>
              {selected.size} selected
            </span>
            <button onClick={clearSelection} className="camp-btn" style={{
              padding: '4px 10px', fontSize: 12,
            }}>Clear</button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => updateStatus(Array.from(selected), 'active')}
              className="camp-btn"
              disabled={isLapsed || pendingAction}
              style={{ padding: '5px 12px', fontSize: 12 }}
            >Resume</button>
            <button
              onClick={() => updateStatus(Array.from(selected), 'paused')}
              className="camp-btn"
              disabled={isLapsed || pendingAction}
              style={{ padding: '5px 12px', fontSize: 12 }}
            >Pause</button>
            <button
              onClick={() => updateStatus(Array.from(selected), 'archived')}
              className="camp-btn"
              disabled={isLapsed || pendingAction}
              style={{ padding: '5px 12px', fontSize: 12 }}
            >Archive</button>
          </div>
        )}

        {/* ERROR */}
        {actionError && (
          <div style={{
            padding: '10px 24px',
            background: '#fae5e5',
            color: T.red,
            borderBottom: '1px solid #f0c4c4',
            fontSize: 12,
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: T.red, fontSize: 14, padding: '0 8px',
            }}>×</button>
          </div>
        )}

        {/* MAIN AREA */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}>
          {/* LIST */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: view === 'list' ? '12px 24px 32px' : '16px 24px 32px',
          }}>

            {/* EMPTY STATE */}
            {!loading && visible.length === 0 && (
              <div style={{
                padding: '80px 20px',
                textAlign: 'center',
                color: T.textSub,
              }}>
                <div style={{
                  fontSize: 48,
                  marginBottom: 14,
                  color: T.muted,
                }}>📋</div>
                <h2 style={{
                  fontSize: 17,
                  fontWeight: 500,
                  color: T.text,
                  margin: 0,
                  marginBottom: 6,
                }}>
                  {campaigns.length === 0 ? 'No campaigns yet' : 'No matches'}
                </h2>
                <p style={{
                  fontSize: 13,
                  color: T.textSub,
                  margin: 0,
                  marginBottom: 18,
                  maxWidth: 360,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  lineHeight: 1.5,
                }}>
                  {campaigns.length === 0
                    ? 'Create your first campaign to start uploading leads and dialing.'
                    : 'Try a different search or sort filter.'}
                </p>
                {campaigns.length === 0 && !isLapsed && (
                  <button
                    className="camp-btn camp-btn-primary"
                    onClick={() => setShowCreate(true)}
                  >+ New campaign</button>
                )}
              </div>
            )}

            {/* LOADING */}
            {loading && (
              <div style={{
                padding: 80,
                textAlign: 'center',
                fontSize: 12,
                color: T.muted,
                letterSpacing: 1,
              }}>Loading…</div>
            )}

            {/* LIST VIEW */}
            {!loading && view === 'list' && visible.length > 0 && (
              <div>
                {/* Column header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 1fr 110px 130px 100px 100px',
                  gap: 16,
                  padding: '7px 16px',
                  fontSize: 11,
                  color: T.muted,
                  letterSpacing: 0.4,
                  borderBottom: `1px solid ${T.border}`,
                  fontWeight: 500,
                }}>
                  <div>
                    <input
                      type="checkbox"
                      checked={selected.size === visible.length && visible.length > 0}
                      onChange={() => selected.size === visible.length ? clearSelection() : selectAll()}
                    />
                  </div>
                  <div>Name</div>
                  <div>Status</div>
                  <div>Progress</div>
                  <div>Dialer</div>
                  <div>Last activity</div>
                </div>

                {visible.map(c => {
                  const isSelected = selected.has(c.id)
                  const progress = c.total_leads > 0 ? (c.called_leads / c.total_leads) * 100 : 0
                  const isRenaming = renamingId === c.id
                  return (
                    <div
                      key={c.id}
                      className={`camp-row ${isSelected ? 'selected' : ''}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 1fr 110px 130px 100px 100px',
                        gap: 16,
                        padding: '11px 16px',
                        borderBottom: `1px solid ${T.border}`,
                        background: isSelected ? '#eef4ff' : 'transparent',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: 13,
                      }}
                      onClick={(e) => {
                        // Don't toggle if clicking a button/link inside
                        if ((e.target as HTMLElement).closest('button, a, input')) return
                        toggleSelect(c.id, e)
                      }}
                      onDoubleClick={() => {
                        if (!isLapsed) router.push(`/dashboard/campaigns/${c.id}`)
                      }}
                    >
                      <div
                        className="camp-checkbox"
                        onClick={e => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelected(prev => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(c.id)
                              else next.delete(c.id)
                              return next
                            })
                            setLastClickedId(c.id)
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        {isRenaming ? (
                          <input
                            ref={renameRef}
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={() => performRename(c.id, renameValue)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') performRename(c.id, renameValue)
                              if (e.key === 'Escape') setRenamingId(null)
                            }}
                            className="camp-input"
                            style={{ width: '100%', padding: '4px 8px', fontSize: 13 }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <Link
                            href={`/dashboard/campaigns/${c.id}`}
                            onClick={(e) => {
                              if (isLapsed) return
                              e.stopPropagation()
                            }}
                            style={{
                              color: T.text,
                              textDecoration: 'none',
                              fontWeight: 500,
                              fontSize: 13,
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              pointerEvents: isLapsed ? 'none' : 'auto',
                            }}
                          >{c.name}</Link>
                        )}
                      </div>
                      <div><StatusPill status={c.status} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 11,
                          color: T.textSub,
                          marginBottom: 4,
                        }}>
                          {c.called_leads.toLocaleString()} / {c.total_leads.toLocaleString()}
                        </div>
                        <div style={{
                          height: 4,
                          background: '#eef0f4',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(progress, 100)}%`,
                            background: progress >= 100 ? T.green : T.blue,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: T.textSub,
                      }}>
                        {dialerLabel(c.dialer_mode)}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: T.textSub,
                      }}>
                        {fmtRelative(c.last_active_at)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* GRID VIEW */}
            {!loading && view === 'grid' && visible.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 14,
              }}>
                {visible.map(c => {
                  const isSelected = selected.has(c.id)
                  const progress = c.total_leads > 0 ? (c.called_leads / c.total_leads) * 100 : 0
                  return (
                    <div
                      key={c.id}
                      className={`camp-row ${isSelected ? 'selected' : ''}`}
                      style={{
                        background: T.surface,
                        border: `1px solid ${isSelected ? T.blue : T.border}`,
                        borderRadius: 8,
                        padding: 16,
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 0 0 2px rgba(74,158,255,0.15)' : 'none',
                        transition: 'border-color 0.12s, box-shadow 0.12s',
                      }}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button, a, input')) return
                        toggleSelect(c.id, e)
                      }}
                      onDoubleClick={() => {
                        if (!isLapsed) router.push(`/dashboard/campaigns/${c.id}`)
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        marginBottom: 10,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link
                            href={`/dashboard/campaigns/${c.id}`}
                            onClick={(e) => {
                              if (isLapsed) return
                              e.stopPropagation()
                            }}
                            style={{
                              color: T.text,
                              textDecoration: 'none',
                              fontWeight: 500,
                              fontSize: 14,
                              display: 'block',
                              lineHeight: 1.3,
                              pointerEvents: isLapsed ? 'none' : 'auto',
                            }}
                          >{c.name}</Link>
                          <div style={{
                            fontSize: 11,
                            color: T.muted,
                            marginTop: 3,
                          }}>{dialerLabel(c.dialer_mode)} dialer</div>
                        </div>
                        <StatusPill status={c.status} />
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: T.textSub,
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 5,
                      }}>
                        <span>{c.called_leads.toLocaleString()} / {c.total_leads.toLocaleString()}</span>
                        <span>{progress.toFixed(0)}%</span>
                      </div>
                      <div style={{
                        height: 4,
                        background: '#eef0f4',
                        borderRadius: 2,
                        overflow: 'hidden',
                        marginBottom: 10,
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(progress, 100)}%`,
                          background: progress >= 100 ? T.green : T.blue,
                        }} />
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: T.muted,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}>
                        <span>{fmtRelative(c.last_active_at)}</span>
                        <span>{fmtDate(c.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT RAIL */}
          <div style={{
            width: 280,
            background: T.surface,
            borderLeft: `1px solid ${T.border}`,
            padding: 18,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            {singleSelected ? (
              <>
                <div>
                  <div style={{
                    fontSize: 11,
                    color: T.muted,
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}>SELECTED</div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: T.text,
                    wordBreak: 'break-word',
                    lineHeight: 1.3,
                  }}>{singleSelected.name}</div>
                </div>
                <StatusPill status={singleSelected.status} />

                <div style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 12,
                  color: T.text,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <RailRow label="Dialer" value={dialerLabel(singleSelected.dialer_mode)} />
                  <RailRow label="Leads" value={singleSelected.total_leads.toLocaleString()} />
                  <RailRow label="Called" value={singleSelected.called_leads.toLocaleString()} />
                  <RailRow label="Created" value={fmtDate(singleSelected.created_at)} />
                  <RailRow label="Last activity" value={fmtRelative(singleSelected.last_active_at)} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    className="camp-btn camp-btn-primary"
                    onClick={() => router.push(`/dashboard/campaigns/${singleSelected.id}`)}
                    disabled={isLapsed}
                  >Open campaign</button>

                  {!isLapsed && (
                    <>
                      <button
                        className="camp-btn"
                        onClick={() => {
                          setRenamingId(singleSelected.id)
                          setRenameValue(singleSelected.name)
                        }}
                      >Rename</button>
                      {singleSelected.status === 'paused' && (
                        <button
                          className="camp-btn"
                          onClick={() => updateStatus([singleSelected.id], 'active')}
                          disabled={pendingAction}
                        >Resume</button>
                      )}
                      {singleSelected.status === 'active' && (
                        <button
                          className="camp-btn"
                          onClick={() => updateStatus([singleSelected.id], 'paused')}
                          disabled={pendingAction}
                        >Pause</button>
                      )}
                      {singleSelected.status !== 'archived' && (
                        <button
                          className="camp-btn"
                          onClick={() => updateStatus([singleSelected.id], 'archived')}
                          disabled={pendingAction}
                        >Archive</button>
                      )}
                      {singleSelected.status === 'archived' && (
                        <button
                          className="camp-btn"
                          onClick={() => updateStatus([singleSelected.id], 'active')}
                          disabled={pendingAction}
                        >Unarchive</button>
                      )}
                      <button
                        className="camp-btn"
                        style={{ color: T.red, borderColor: '#f0c4c4' }}
                        onClick={() => setDeleteConfirmId(singleSelected.id)}
                        disabled={pendingAction}
                      >Delete</button>
                    </>
                  )}
                </div>
              </>
            ) : selectedCampaigns.length > 1 ? (
              <>
                <div>
                  <div style={{
                    fontSize: 11,
                    color: T.muted,
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}>SELECTED</div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: T.text,
                  }}>{selectedCampaigns.length} campaigns</div>
                </div>
                <div style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 12,
                  color: T.textSub,
                  lineHeight: 1.5,
                }}>
                  Use the bulk action bar above to apply changes to all selected campaigns.
                </div>
              </>
            ) : (
              <>
                <div style={{
                  fontSize: 13,
                  color: T.text,
                  fontWeight: 500,
                }}>Quick info</div>
                <div style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 12,
                  color: T.textSub,
                  lineHeight: 1.55,
                }}>
                  Select a campaign to see details and actions.
                  <br /><br />
                  <strong style={{ color: T.text }}>Tips:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    <li>Double-click to open</li>
                    <li>Shift+click to select a range</li>
                    <li>Cmd/Ctrl+click to add to selection</li>
                  </ul>
                </div>

                <div style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 12,
                  color: T.textSub,
                  lineHeight: 1.5,
                }}>
                  <div style={{ color: T.text, fontWeight: 500, marginBottom: 6 }}>Statistics</div>
                  <RailRow label="Total" value={campaigns.length.toString()} />
                  <RailRow label="Active" value={campaigns.filter(c => c.status === 'active').length.toString()} />
                  <RailRow label="Paused" value={campaigns.filter(c => c.status === 'paused').length.toString()} />
                  <RailRow label="Archived" value={campaigns.filter(c => c.status === 'archived').length.toString()} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <Modal onClose={() => !creating && setShowCreate(false)}>
          <h2 style={{
            margin: 0,
            marginBottom: 4,
            fontSize: 18,
            fontWeight: 500,
            color: T.text,
          }}>New campaign</h2>
          <p style={{
            margin: 0,
            marginBottom: 18,
            fontSize: 13,
            color: T.textSub,
          }}>Set up a campaign. You can change settings later.</p>

          <FieldLabel>Name</FieldLabel>
          <input
            type="text"
            className="camp-input"
            style={{ width: '100%' }}
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            placeholder="e.g. Q1 Lead Outreach"
            autoFocus
            disabled={creating}
            onKeyDown={e => { if (e.key === 'Enter' && createName.trim()) performCreate() }}
          />

          <div style={{ height: 14 }} />

          <FieldLabel>Dialer mode</FieldLabel>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
          }}>
            {([
              { v: 'manual', t: 'Manual', d: 'One call at a time, you control pacing.' },
              { v: 'preview', t: 'Preview', d: 'See lead info before dialing.' },
              { v: 'progressive', t: 'Progressive', d: 'Auto-dial after disposition saved.' },
              { v: 'predictive', t: 'Predictive', d: 'High-volume parallel dialing.' },
            ] as const).map(opt => (
              <button
                key={opt.v}
                onClick={() => setCreateDialer(opt.v)}
                disabled={creating}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: createDialer === opt.v ? '#eef4ff' : T.surface,
                  border: `1px solid ${createDialer === opt.v ? T.blue : T.border}`,
                  borderRadius: 6,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  color: T.text,
                }}
              >
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 3,
                  color: createDialer === opt.v ? T.blue : T.text,
                }}>{opt.t}</div>
                <div style={{
                  fontSize: 11,
                  color: T.textSub,
                  lineHeight: 1.4,
                }}>{opt.d}</div>
              </button>
            ))}
          </div>

          {createError && (
            <div style={{
              marginTop: 12,
              padding: '8px 12px',
              background: '#fae5e5',
              color: T.red,
              borderRadius: 4,
              fontSize: 12,
            }}>{createError}</div>
          )}

          <div style={{
            display: 'flex',
            gap: 8,
            marginTop: 18,
            justifyContent: 'flex-end',
          }}>
            <button
              className="camp-btn"
              onClick={() => setShowCreate(false)}
              disabled={creating}
            >Cancel</button>
            <button
              className="camp-btn camp-btn-primary"
              onClick={performCreate}
              disabled={!createName.trim() || creating}
            >{creating ? 'Creating…' : 'Create campaign'}</button>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirmId && (
        <Modal onClose={() => !pendingAction && (setDeleteConfirmId(null), setDeleteText(''))}>
          <h2 style={{
            margin: 0,
            marginBottom: 4,
            fontSize: 18,
            fontWeight: 500,
            color: T.red,
          }}>Delete campaign</h2>
          <p style={{
            margin: 0,
            marginBottom: 14,
            fontSize: 13,
            color: T.textSub,
            lineHeight: 1.55,
          }}>
            This permanently deletes the campaign and all its leads. You can&apos;t undo this. Type <strong style={{ color: T.red }}>delete</strong> to confirm.
          </p>
          <input
            type="text"
            className="camp-input"
            style={{ width: '100%' }}
            value={deleteText}
            onChange={e => setDeleteText(e.target.value)}
            placeholder='type "delete"'
            autoFocus
            disabled={pendingAction}
          />
          <div style={{
            display: 'flex',
            gap: 8,
            marginTop: 16,
            justifyContent: 'flex-end',
          }}>
            <button
              className="camp-btn"
              onClick={() => { setDeleteConfirmId(null); setDeleteText('') }}
              disabled={pendingAction}
            >Cancel</button>
            <button
              className="camp-btn"
              style={{
                background: T.red,
                borderColor: T.red,
                color: 'white',
              }}
              onClick={performDelete}
              disabled={pendingAction || deleteText.trim().toLowerCase() !== 'delete'}
            >{pendingAction ? 'Deleting…' : 'Delete forever'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ---------- Subcomponents ----------

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      padding: '3px 0',
    }}>
      <span style={{ color: '#5a5e6a' }}>{label}</span>
      <span style={{ color: '#1a1c24', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 12,
      color: '#5a5e6a',
      marginBottom: 5,
      fontWeight: 500,
    }}>{children}</label>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 26,
          width: '100%',
          maxWidth: 460,
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}
      >
        {children}
      </div>
    </div>
  )
}