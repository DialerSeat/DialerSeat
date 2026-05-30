'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

// =============================================================================
// CAMPAIGNS PAGE — v24 GRID REDESIGN
// =============================================================================
// Replaces the v23 horizontal-row list with a Google-Docs-style grid of
// cards. Each card has a preview thumbnail showing the campaign's actual
// call script (the "document content"), color-themed by dialer mode, with
// a circular SVG progress ring representing called/total leads.
//
// Card actions:
//   - Click card → /dashboard/dialer?campaignId=X
//   - ⋯ menu → toggle status, mode settings, scripts, csv upload, delete
//
// All existing modals (create / mode / scripts) preserved unchanged.
// =============================================================================

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  surface2: '#d4d7df',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

type AccessTier = 'active' | 'lapsed' | 'new' | null
type DialerMode = 'preview' | 'power' | 'progressive' | 'predictive'

interface Campaign {
  id: string
  name: string
  total_leads: number
  called_leads: number
  status: string
  created_at: string
  updated_at?: string
  script?: string
  dialer_mode?: DialerMode
  amd_enabled?: boolean
  predictive_lines_per_agent?: number
  voicemail_drop_url?: string | null
}

interface CampaignScript {
  id: string
  name: string
  body: string
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const MODE_INFO: Record<DialerMode, {
  label: string
  tagline: string
  speed: string
  abandons: string
  color: string
  bgGradient: string  // CSS gradient for card preview background
}> = {
  preview: {
    label: 'PREVIEW',
    tagline: 'Review the lead, then click to dial.',
    speed: 'Slowest',
    abandons: 'Zero',
    color: '#5a5e6a',
    bgGradient: 'linear-gradient(135deg, #f0f0f4 0%, #d8dce2 100%)',
  },
  power: {
    label: 'POWER',
    tagline: 'Click to dial. One call at a time. You handle voicemails.',
    speed: 'Moderate',
    abandons: 'Zero',
    color: '#2a4a8a',
    bgGradient: 'linear-gradient(135deg, #e8eef8 0%, #c8d4ec 100%)',
  },
  progressive: {
    label: 'PROGRESSIVE',
    tagline: 'Auto-dials next lead. AMD skips voicemails. Humans only.',
    speed: 'Fast',
    abandons: 'Zero',
    color: '#1a6a1a',
    bgGradient: 'linear-gradient(135deg, #e8f5e8 0%, #c8e4c8 100%)',
  },
  predictive: {
    label: 'PREDICTIVE',
    tagline: 'Multi-line dialing. Pacing algorithm. Designed for 8+ concurrent agents.',
    speed: 'Fastest',
    abandons: 'Capped at 3% by law',
    color: '#8a1a1a',
    bgGradient: 'linear-gradient(135deg, #f8e8e8 0%, #ecc4c4 100%)',
  },
}

// ──────────────────────────────────────────────────────────────────────────
// "Modified X ago" helper — Google Docs-style relative time
// ──────────────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.floor(day / 7)
  if (wk < 4) return `${wk}w ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.floor(day / 365)
  return `${yr}y ago`
}

// ──────────────────────────────────────────────────────────────────────────
// CIRCULAR PROGRESS RING — SVG donut showing called/total percent
// ──────────────────────────────────────────────────────────────────────────
function ProgressRing({
  percent,
  color,
  size = 56,
  thickness = 5,
}: {
  percent: number
  color: string
  size?: number
  thickness?: number
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={thickness}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy="0.35em"
        style={{
          fontSize: 11,
          fontWeight: 700,
          fill: color,
          fontFamily: 'monospace',
          letterSpacing: 0,
        }}
      >
        {Math.round(percent)}%
      </text>
    </svg>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// SCRIPT PREVIEW — renders a snippet of the active script as faux-doc
// thumbnail content. Lines wrap, overflow clipped. If no script, show
// a friendly placeholder. This is the "image preview" of the card.
// ──────────────────────────────────────────────────────────────────────────
function ScriptThumbnail({ script, accentColor }: { script: string | null | undefined; accentColor: string }) {
  if (!script || !script.trim()) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 6,
        opacity: 0.5,
      }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>📝</div>
        <div style={{
          fontSize: 9, letterSpacing: 2, color: T.muted,
          fontWeight: 'bold', textAlign: 'center',
        }}>NO SCRIPT YET</div>
      </div>
    )
  }

  // Trim and split. The CSS line-clamp does the rest. Keep first ~600 chars
  // so we don't ship the entire script as DOM text.
  const trimmed = script.trim().slice(0, 600)

  return (
    <div style={{
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
      padding: '14px 16px 8px',
      background: 'rgba(255,255,255,0.85)',
      borderRadius: 6,
      borderLeft: `3px solid ${accentColor}`,
      fontSize: 10,
      lineHeight: 1.5,
      color: '#3a3d48',
      fontFamily: '"Georgia", "Times New Roman", serif',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {trimmed}
      {/* Fade-out gradient at bottom to indicate truncation */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 28,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}

export default function CampaignsPage() {
  const { user } = useUser()
  const [tier, setTier] = useState<AccessTier>(null)
  const [showModal, setShowModal] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [dragging, setDragging] = useState(false)
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvName, setCsvName] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteTyped, setDeleteTyped] = useState('')

  // Per-card dropdown menu state — only one open at a time
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // SCRIPTS MODAL (multi-script manager)
  const [scriptsModal, setScriptsModal] = useState<Campaign | null>(null)
  const [scripts, setScripts] = useState<CampaignScript[]>([])
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null)
  const [scriptsLoading, setScriptsLoading] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [editingBody, setEditingBody] = useState('')
  const [savingScript, setSavingScript] = useState(false)
  const [dirtyScript, setDirtyScript] = useState(false)

  // Tab drag-reorder state. Uses pointer events so it works on touch and mouse.
  const [tabDrag, setTabDrag] = useState<{
    draggedId: string
    pointerId: number
    targetId: string | null
  } | null>(null)
  const tabsRowRef = useRef<HTMLDivElement | null>(null)

  const [modeModal, setModeModal] = useState<Campaign | null>(null)
  const [modeChoice, setModeChoice] = useState<DialerMode>('power')
  const [amdEnabled, setAmdEnabled] = useState(false)
  const [linesPerAgent, setLinesPerAgent] = useState(1.5)
  const [modeSaving, setModeSaving] = useState(false)
  const [modeError, setModeError] = useState<string | null>(null)

  const [createMode, setCreateMode] = useState<DialerMode>('power')

  const fileRef = useRef<HTMLInputElement>(null)

  const isLapsed = tier === 'lapsed' || tier === 'new'

  // Click-outside handler closes the open card menu
  useEffect(() => {
    if (!openMenuId) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-card-menu]')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [openMenuId])

  useEffect(() => {
    if (user) {
      fetchCampaigns()
      fetch('/api/stripe/status')
        .then(r => r.json())
        .then(d => setTier(d.tier || null))
        .catch(() => setTier(null))
    }
  }, [user])

  const fetchCampaigns = async () => {
    setFetching(true)
    try {
      const res = await fetch(`/api/campaigns/list?user_id=${user?.id}`)
      const data = await res.json()
      if (data.success) setCampaigns(data.campaigns)
    } catch (error) {
      console.error(error)
    } finally {
      setFetching(false)
    }
  }

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter(line => line.trim())
    if (lines.length === 0) return []
    const firstLine = lines[0]
    const delimiter = firstLine.includes('\t') ? '\t' : ','
    const firstRowValues = firstLine.split(delimiter).map(v => v.trim().replace(/"/g, ''))
    const hasPhone = firstRowValues.some(v => v.replace(/\D/g, '').length >= 10)
    const hasHeaders = !hasPhone
    if (hasHeaders) {
      const headers = firstRowValues
      return lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''))
        return headers.reduce((obj: any, header, i) => {
          obj[header] = values[i] || ''
          return obj
        }, {})
      })
    } else {
      return lines.map(line => line.split(delimiter).map(v => v.trim().replace(/"/g, '')))
    }
  }

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) return
    setCsvName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvData(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleCreate = async () => {
    if (!campaignName || !user) return
    setLoading(true)
    try {
      const amd = createMode === 'progressive' || createMode === 'predictive'
      const res = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          dialer_mode: createMode,
          amd_enabled: amd,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        if (res.status === 403) setTier('lapsed')
        throw new Error(data.error)
      }
      if (csvData.length > 0) {
        await fetch('/api/leads/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: data.campaign.id, leads: csvData }),
        })
      }
      setCampaignName('')
      setCsvData([])
      setCsvName('')
      setCreateMode('power')
      setShowModal(false)
      fetchCampaigns()
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    setCampaigns(campaigns.map(c => c.id === id ? { ...c, status: newStatus } : c))
    setOpenMenuId(null)
    await fetch('/api/campaigns/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  const handleDelete = async (id: string, leadCount: number) => {
    if (leadCount >= 100 && deleteTyped.toLowerCase().trim() !== 'delete') return
    await fetch('/api/campaigns/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCampaigns(campaigns.filter(c => c.id !== id))
    setDeleteConfirm(null)
    setDeleteTyped('')
  }

  const handleUploadMore = async (campaignId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      const res = await fetch('/api/leads/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, leads: parsed }),
      })
      if (res.status === 403) setTier('lapsed')
      fetchCampaigns()
    }
    reader.readAsText(file)
  }

  const startDelete = (id: string) => {
    setDeleteConfirm(id)
    setDeleteTyped('')
    setOpenMenuId(null)
  }

  // ── SCRIPTS MODAL ──────────────────────────────────────────────────────

  const openScriptsModal = async (campaign: Campaign) => {
    setOpenMenuId(null)
    setScriptsModal(campaign)
    setScripts([])
    setActiveScriptId(null)
    setScriptsLoading(true)
    setDirtyScript(false)
    try {
      const res = await fetch(`/api/campaigns/scripts/list?campaign_id=${campaign.id}`)
      const data = await res.json()
      if (data.success) {
        setScripts(data.scripts || [])
        if (data.scripts && data.scripts.length > 0) {
          const def = data.scripts.find((s: CampaignScript) => s.is_default) || data.scripts[0]
          setActiveScriptId(def.id)
          setEditingName(def.name)
          setEditingBody(def.body)
        }
      }
    } catch (err) {
      console.error('Load scripts failed:', err)
    } finally {
      setScriptsLoading(false)
    }
  }

  const closeScriptsModal = () => {
    if (dirtyScript && !confirm('You have unsaved changes. Discard?')) return
    setScriptsModal(null)
    setScripts([])
    setActiveScriptId(null)
    setEditingName('')
    setEditingBody('')
    setDirtyScript(false)
    setTabDrag(null)
  }

  const switchActiveScript = (id: string) => {
    if (dirtyScript && !confirm('You have unsaved changes on this script. Switch anyway?')) return
    const s = scripts.find(x => x.id === id)
    if (!s) return
    setActiveScriptId(id)
    setEditingName(s.name)
    setEditingBody(s.body)
    setDirtyScript(false)
  }

  const handleAddScript = async () => {
    if (!scriptsModal) return
    const name = prompt('Name this script (e.g. "Cold open", "Voicemail leave-behind", "Objection: too expensive")')
    if (!name || !name.trim()) return
    setSavingScript(true)
    try {
      const res = await fetch('/api/campaigns/scripts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: scriptsModal.id,
          name: name.trim(),
          body: '',
        }),
      })
      const data = await res.json()
      if (data.success && data.script) {
        const updated = [...scripts, data.script].sort((a, b) => a.sort_order - b.sort_order)
        setScripts(updated)
        setActiveScriptId(data.script.id)
        setEditingName(data.script.name)
        setEditingBody(data.script.body)
        setDirtyScript(false)
      }
    } catch (err) {
      console.error('Create script failed:', err)
    } finally {
      setSavingScript(false)
    }
  }

  const handleSaveActive = async () => {
    if (!activeScriptId) return
    setSavingScript(true)
    try {
      const res = await fetch('/api/campaigns/scripts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeScriptId,
          name: editingName.trim() || 'Untitled',
          body: editingBody,
        }),
      })
      const data = await res.json()
      if (data.success && data.script) {
        setScripts(prev => prev.map(s => s.id === data.script.id ? data.script : s))
        setDirtyScript(false)
        if (data.script.is_default && scriptsModal) {
          setCampaigns(prev => prev.map(c =>
            c.id === scriptsModal.id ? { ...c, script: data.script.body } : c
          ))
        }
      }
    } catch (err) {
      console.error('Save script failed:', err)
    } finally {
      setSavingScript(false)
    }
  }

  const handleMakeDefault = async () => {
    if (!activeScriptId) return
    setSavingScript(true)
    try {
      const res = await fetch('/api/campaigns/scripts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeScriptId, is_default: true }),
      })
      const data = await res.json()
      if (data.success) {
        setScripts(prev => prev.map(s => ({
          ...s,
          is_default: s.id === activeScriptId,
        })))
        if (scriptsModal && data.script) {
          setCampaigns(prev => prev.map(c =>
            c.id === scriptsModal.id ? { ...c, script: data.script.body } : c
          ))
        }
      }
    } catch (err) {
      console.error('Make default failed:', err)
    } finally {
      setSavingScript(false)
    }
  }

  const handleDeleteScript = async () => {
    if (!activeScriptId) return
    if (!confirm('Delete this script? This cannot be undone.')) return
    setSavingScript(true)
    try {
      const res = await fetch('/api/campaigns/scripts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeScriptId }),
      })
      const data = await res.json()
      if (data.success) {
        const remaining = scripts.filter(s => s.id !== activeScriptId)
        setScripts(remaining)
        if (remaining.length > 0) {
          const next = remaining[0]
          setActiveScriptId(next.id)
          setEditingName(next.name)
          setEditingBody(next.body)
        } else {
          setActiveScriptId(null)
          setEditingName('')
          setEditingBody('')
        }
        setDirtyScript(false)
      }
    } catch (err) {
      console.error('Delete script failed:', err)
    } finally {
      setSavingScript(false)
    }
  }

  // ── TAB REORDER (pointer events — works on touch + mouse) ──────────────

  const persistScriptOrder = async (orderedIds: string[]) => {
    if (!scriptsModal) return
    try {
      await fetch('/api/campaigns/scripts/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: scriptsModal.id,
          order: orderedIds,
        }),
      })
    } catch (err) {
      console.error('Reorder failed:', err)
    }
  }

  const onTabHandlePointerDown = (e: React.PointerEvent<HTMLSpanElement>, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setTabDrag({ draggedId: id, pointerId: e.pointerId, targetId: null })
  }

  const onTabHandlePointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!tabDrag || e.pointerId !== tabDrag.pointerId) return
    const row = tabsRowRef.current
    if (!row) return
    const tabs = row.querySelectorAll<HTMLElement>('[data-tab-id]')
    let targetId: string | null = null
    for (const tab of Array.from(tabs)) {
      const rect = tab.getBoundingClientRect()
      if (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      ) {
        targetId = tab.getAttribute('data-tab-id')
        break
      }
    }
    if (targetId !== tabDrag.targetId) {
      setTabDrag({ ...tabDrag, targetId })
    }
  }

  const onTabHandlePointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!tabDrag || e.pointerId !== tabDrag.pointerId) return
    const { draggedId, targetId } = tabDrag
    setTabDrag(null)
    if (!targetId || draggedId === targetId) return
    const draggedIdx = scripts.findIndex(s => s.id === draggedId)
    const targetIdx = scripts.findIndex(s => s.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1) return
    const reordered = [...scripts]
    const [moved] = reordered.splice(draggedIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }))
    setScripts(withOrder)
    persistScriptOrder(withOrder.map(s => s.id))
  }

  const onTabHandlePointerCancel = () => {
    setTabDrag(null)
  }

  // ── MODE MODAL ─────────────────────────────────────────────────────────

  const openModeModal = (campaign: Campaign) => {
    setOpenMenuId(null)
    setModeModal(campaign)
    setModeChoice(campaign.dialer_mode || 'power')
    setAmdEnabled(campaign.amd_enabled ?? false)
    setLinesPerAgent(campaign.predictive_lines_per_agent ?? 1.5)
    setModeError(null)
  }

  const handleModeSelect = (newMode: DialerMode) => {
    setModeChoice(newMode)
    if (newMode === 'progressive' || newMode === 'predictive') {
      setAmdEnabled(true)
    } else if (newMode === 'preview' || newMode === 'power') {
      setAmdEnabled(false)
    }
  }

  const handleSaveMode = async () => {
    if (!modeModal) return
    setModeSaving(true)
    setModeError(null)
    try {
      const res = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: modeModal.id,
          dialer_mode: modeChoice,
          amd_enabled: amdEnabled,
          predictive_lines_per_agent: linesPerAgent,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setModeError(data.error || 'Failed to save')
        return
      }
      setCampaigns(campaigns.map(c => c.id === modeModal.id ? {
        ...c,
        dialer_mode: modeChoice,
        amd_enabled: amdEnabled,
        predictive_lines_per_agent: linesPerAgent,
      } : c))
      setModeModal(null)
    } catch (err: any) {
      setModeError(err.message || 'Failed to save')
    } finally {
      setModeSaving(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────

  return (
    <div className="campaigns-root" style={{
      flex: 1,
      padding: '40px',
      overflowY: 'auto',
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <style>{`
        .campaigns-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; gap: 16px; flex-wrap: wrap; }

        /* ── CARD GRID ───────────────────────────────────────────────────── */
        .campaigns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        /* ── CARD ────────────────────────────────────────────────────────── */
        .card {
          background: white;
          border: 1px solid ${T.border};
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
          position: relative;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.10);
          border-color: ${T.blue};
        }
        .card.inactive { opacity: 0.72; }
        .card.inactive:hover { opacity: 1; }

        /* ── PREVIEW (top of card) ───────────────────────────────────────── */
        .card-preview {
          height: 200px;
          padding: 14px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .card-preview-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-shrink: 0;
        }
        .card-preview-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          min-width: 0;
        }
        .card-status-pill {
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 9px;
          letter-spacing: 1.5px;
          font-weight: bold;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(8px);
          white-space: nowrap;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .card-amd-pill {
          padding: 3px 7px;
          border-radius: 3px;
          font-size: 8px;
          letter-spacing: 1.5px;
          font-weight: bold;
          background: rgba(255,255,255,0.7);
          color: ${T.muted};
          font-family: monospace;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .card-menu-btn {
          width: 28px;
          height: 28px;
          border-radius: 14px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0,0,0,0.08);
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          color: ${T.text};
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .card-menu-btn:hover { background: white; }
        .card-preview-bottom {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
          margin-top: auto;
          flex-shrink: 0;
        }
        .card-mode-label {
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: bold;
          font-family: monospace;
        }
        .card-mode-leads {
          font-size: 9px;
          letter-spacing: 1px;
          color: ${T.muted};
          margin-top: 3px;
          font-family: monospace;
        }

        /* ── FOOTER (bottom of card) ─────────────────────────────────────── */
        .card-footer {
          padding: 12px 14px;
          background: white;
          border-top: 1px solid ${T.border};
          flex-shrink: 0;
        }
        .card-name {
          font-size: 13px;
          font-weight: bold;
          letter-spacing: 0.5px;
          color: ${T.text};
          margin: 0 0 4px 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .card-meta {
          font-size: 10px;
          letter-spacing: 0.5px;
          color: ${T.muted};
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ── DROPDOWN MENU ───────────────────────────────────────────────── */
        .card-menu {
          position: absolute;
          top: 48px;
          right: 14px;
          z-index: 30;
          min-width: 200px;
          background: white;
          border: 1px solid ${T.border};
          border-radius: 8px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.18);
          overflow: hidden;
          padding: 4px;
        }
        .card-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          font-size: 11px;
          letter-spacing: 1px;
          font-weight: bold;
          color: ${T.text};
          cursor: pointer;
          border-radius: 4px;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .card-menu-item:hover { background: ${T.bg}; }
        .card-menu-item.danger { color: #c44; }
        .card-menu-item.danger:hover { background: #fae8e8; }
        .card-menu-divider {
          height: 1px;
          background: ${T.border};
          margin: 4px 0;
        }
        .card-menu-icon { font-size: 13px; line-height: 1; width: 16px; text-align: center; }

        /* ── "NEW CAMPAIGN" CARD ─────────────────────────────────────────── */
        .new-card {
          background: white;
          border: 2px dashed ${T.border};
          border-radius: 10px;
          min-height: 274px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.15s;
          padding: 24px;
          text-align: center;
        }
        .new-card:hover {
          border-color: ${T.blue};
          background: rgba(74,158,255,0.04);
        }
        .new-card-plus {
          font-size: 36px;
          color: ${T.muted};
          line-height: 1;
          font-weight: 300;
        }
        .new-card:hover .new-card-plus { color: ${T.blue}; }
        .new-card-label {
          font-size: 11px;
          letter-spacing: 3px;
          font-weight: bold;
          color: ${T.muted};
        }
        .new-card:hover .new-card-label { color: ${T.blue}; }

        /* ── INLINE DELETE CONFIRMATION ─────────────────────────────────── */
        .delete-confirm-overlay {
          position: absolute;
          inset: 0;
          background: rgba(255,68,68,0.95);
          backdrop-filter: blur(4px);
          z-index: 40;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
          color: white;
          border-radius: 10px;
        }
        .delete-confirm-title {
          font-size: 13px;
          letter-spacing: 2px;
          font-weight: bold;
          margin: 0;
        }
        .delete-confirm-text {
          font-size: 11px;
          line-height: 1.5;
          margin: 0;
          opacity: 0.9;
        }
        .delete-confirm-input {
          padding: 8px 10px;
          border-radius: 4px;
          background: white;
          border: none;
          color: ${T.text};
          font-size: 11px;
          font-family: monospace;
          outline: none;
          letter-spacing: 1px;
        }
        .delete-confirm-actions { display: flex; gap: 8px; }
        .delete-confirm-actions button {
          flex: 1;
          padding: 8px;
          border-radius: 4px;
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          font-family: 'Futura PT', Futura, sans-serif;
        }

        /* ── MODALS ──────────────────────────────────────────────────────── */
        .campaign-modal {
          width: 100%;
          max-width: 500px;
          padding: 48px;
          border-radius: 24px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          max-height: 90vh;
          max-height: 90dvh;
          overflow-y: auto;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(10px);
          padding: 16px;
          height: 100vh;
          height: 100dvh;
        }
        .scripts-modal {
          width: 100%;
          max-width: 880px;
          max-height: 90vh;
          max-height: 90dvh;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .scripts-modal-header {
          padding: 18px 22px;
          padding-top: max(18px, env(safe-area-inset-top));
          border-bottom: 1px solid ${T.border};
          flex-shrink: 0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          background: ${T.surface};
        }
        .scripts-modal-header-text { min-width: 0; flex: 1; }
        .scripts-modal-title {
          font-size: 17px;
          font-weight: bold;
          letter-spacing: 3px;
          color: ${T.text};
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .scripts-modal-subtitle {
          font-size: 11px;
          letter-spacing: 1px;
          color: ${T.muted};
          margin-top: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .scripts-modal-close {
          background: transparent;
          border: 1px solid ${T.border};
          color: ${T.muted};
          width: 36px;
          height: 36px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 18px;
          flex-shrink: 0;
        }
        .scripts-tabs {
          display: flex;
          gap: 4px;
          padding: 12px 16px 0;
          border-bottom: 1px solid ${T.border};
          overflow-x: auto;
          background: ${T.surface2};
          flex-shrink: 0;
          touch-action: pan-x;
        }
        .scripts-tab {
          padding: 8px 14px 8px 8px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          color: ${T.muted};
          font-size: 11px;
          letter-spacing: 1.5px;
          font-weight: bold;
          font-family: 'Futura PT', Futura, sans-serif;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .scripts-tab:hover { background: ${T.surface}; color: ${T.text}; }
        .scripts-tab.active {
          background: ${T.bg};
          color: ${T.blue};
          border-color: ${T.blue};
          border-bottom-color: ${T.bg};
          margin-bottom: -1px;
        }
        .scripts-tab.dragging { opacity: 0.4; }
        .scripts-tab.drag-over {
          border-color: ${T.blue};
          background: rgba(74,158,255,0.15);
        }
        .scripts-tab-handle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 22px;
          font-size: 12px;
          color: ${T.muted};
          cursor: grab;
          touch-action: none;
          user-select: none;
          line-height: 1;
          letter-spacing: -2px;
          font-weight: bold;
        }
        .scripts-tab-handle:active { cursor: grabbing; }
        .scripts-tab-default-badge {
          font-size: 8px;
          padding: 1px 5px;
          background: ${T.green};
          color: white;
          border-radius: 2px;
          letter-spacing: 1px;
        }
        .scripts-add-btn {
          padding: 8px 14px;
          background: transparent;
          border: 1px dashed ${T.border};
          border-bottom: none;
          border-radius: 6px 6px 0 0;
          color: ${T.muted};
          font-size: 11px;
          letter-spacing: 1.5px;
          font-weight: bold;
          font-family: 'Futura PT', Futura, sans-serif;
          cursor: pointer;
          white-space: nowrap;
        }
        .scripts-add-btn:hover { color: ${T.blue}; border-color: ${T.blue}; }
        .scripts-modal-body {
          flex: 1;
          overflow: auto;
          padding: 22px;
          -webkit-overflow-scrolling: touch;
        }
        .scripts-modal-footer {
          padding: 14px 20px;
          padding-bottom: max(14px, env(safe-area-inset-bottom));
          border-top: 1px solid ${T.border};
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          background: ${T.surface2};
        }
        .scripts-modal-footer-left { display: flex; gap: 8px; flex-wrap: wrap; }
        .scripts-modal-footer-right { display: flex; gap: 10px; flex-wrap: wrap; }
        .scripts-modal-tip {
          padding: 8px 12px;
          margin-bottom: 14px;
          background: rgba(74,158,255,0.08);
          border: 1px dashed rgba(74,158,255,0.3);
          border-radius: 6px;
          font-size: 10px;
          color: ${T.muted};
          letter-spacing: 1px;
          line-height: 1.5;
        }

        /* ── MOBILE BREAKPOINT ──────────────────────────────────────────── */
        @media (max-width: 768px) {
          .campaigns-root { padding: 20px !important; }
          .campaigns-header h1 { font-size: 20px !important; letter-spacing: 3px !important; }
          .new-campaign-btn { width: 100%; }
          .campaigns-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .card-preview { height: 180px; }
          .card-menu { right: 14px; left: 14px; min-width: 0; }
          .campaign-modal {
            padding: 24px !important;
            border-radius: 0 !important;
            max-height: 100vh !important;
            max-height: 100dvh !important;
            min-height: 100vh;
            min-height: 100dvh;
            padding-top: max(24px, env(safe-area-inset-top)) !important;
            padding-bottom: max(24px, env(safe-area-inset-bottom)) !important;
          }
          .scripts-modal {
            border-radius: 0 !important;
            max-height: 100vh !important;
            max-height: 100dvh !important;
            min-height: 100vh;
            min-height: 100dvh;
          }
          .modal-overlay { padding: 0 !important; }
          .scripts-modal-header {
            padding: 14px 16px;
            padding-top: max(14px, env(safe-area-inset-top));
          }
          .scripts-modal-title { font-size: 14px; letter-spacing: 2px; }
          .scripts-modal-subtitle { font-size: 10px; }
          .scripts-modal-close { width: 44px; height: 44px; font-size: 20px; }
          .scripts-tabs { padding: 10px 12px 0; }
          .scripts-tab { padding: 10px 12px 10px 6px; font-size: 10px; }
          .scripts-tab-handle { width: 22px; height: 28px; font-size: 14px; }
          .scripts-modal-body { padding: 16px; }
          .scripts-modal-footer {
            padding: 12px 14px;
            padding-bottom: max(12px, env(safe-area-inset-bottom));
            gap: 8px;
          }
          .scripts-modal-footer-left,
          .scripts-modal-footer-right { width: 100%; justify-content: stretch; }
          .scripts-modal-footer-left button,
          .scripts-modal-footer-right button { flex: 1; }
        }
      `}</style>

      <div className="campaigns-header">
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '4px', color: T.text, marginBottom: '8px' }}>CAMPAIGNS</h1>
          <p style={{ fontSize: '12px', letterSpacing: '2px', color: T.muted }}>
            {isLapsed ? 'READ-ONLY · RESUBSCRIBE TO CREATE OR DIAL' : 'YOUR LEAD LISTS AND DIALING CAMPAIGNS.'}
          </p>
        </div>
        {!isLapsed ? (
          <button onClick={() => setShowModal(true)} className="new-campaign-btn" style={{
            padding: '14px 28px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
            border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(74,158,255,0.3)',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}>+ NEW CAMPAIGN</button>
        ) : (
          <Link href="/billing" className="new-campaign-btn" style={{
            padding: '14px 28px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #ffaa3e, #ff8a1a)',
            color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
            border: 'none', cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
            textDecoration: 'none',
            display: 'inline-block',
          }}>↻ RESUBSCRIBE</Link>
        )}
      </div>

      {isLapsed && (
        <div style={{
          padding: '16px 20px',
          marginBottom: 24,
          background: 'rgba(255,170,62,0.06)',
          border: '1px solid #8a6a1a',
          borderLeft: '3px solid #ffaa3e',
          borderRadius: 6,
          fontSize: 12,
          color: T.text,
          letterSpacing: 1,
          lineHeight: 1.6,
        }}>
          <strong style={{ color: '#ffaa3e', fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>
            ▸ READ-ONLY MODE
          </strong>
          <div style={{ marginTop: 6 }}>
            Your campaigns are still here. You can pause or unpause them, but creating, deleting, importing, and dialing require an active subscription.
          </div>
        </div>
      )}

      {fetching ? (
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <p style={{ fontSize: '12px', letterSpacing: '3px', color: T.muted }}>LOADING CAMPAIGNS...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '100px 20px', borderRadius: '20px',
          background: T.surface, border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>📋</div>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '4px', color: T.text, marginBottom: '12px' }}>NO CAMPAIGNS YET</h2>
          <p style={{ fontSize: '13px', color: T.muted, marginBottom: '32px', lineHeight: '1.7' }}>
            {isLapsed
              ? <>Resubscribe to create your first campaign,<br />upload leads, and start dialing.</>
              : <>Create your first campaign, upload your leads CSV,<br />and start dialing in minutes.</>}
          </p>
          {!isLapsed ? (
            <button onClick={() => setShowModal(true)} style={{
              padding: '14px 36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
              color: 'white', fontSize: '11px', fontWeight: 'bold',
              letterSpacing: '2px', border: 'none', cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
            }}>CREATE FIRST CAMPAIGN</button>
          ) : (
            <Link href="/billing" style={{
              display: 'inline-block',
              padding: '14px 36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #ffaa3e, #ff8a1a)',
              color: 'white', fontSize: '11px', fontWeight: 'bold',
              letterSpacing: '2px', border: 'none', cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
              textDecoration: 'none',
            }}>RESUBSCRIBE — $35/WEEK</Link>
          )}
        </div>
      ) : (
        <div className="campaigns-grid">
          {/* "+ NEW CAMPAIGN" card — only when subscribed */}
          {!isLapsed && (
            <div className="new-card" onClick={() => setShowModal(true)}>
              <div className="new-card-plus">+</div>
              <div className="new-card-label">NEW CAMPAIGN</div>
            </div>
          )}

          {campaigns.map((campaign) => {
            const mode = (campaign.dialer_mode || 'power') as DialerMode
            const modeInfo = MODE_INFO[mode]
            const isActive = campaign.status === 'active'
            const percent = campaign.total_leads > 0
              ? (campaign.called_leads / campaign.total_leads) * 100
              : 0
            const isMenuOpen = openMenuId === campaign.id
            const isDeleting = deleteConfirm === campaign.id
            const lastUpdated = campaign.updated_at || campaign.created_at

            return (
              <div
                key={campaign.id}
                className={`card ${!isActive ? 'inactive' : ''}`}
                onClick={(e) => {
                  // Don't navigate if clicking on menu/menu items/delete confirm/etc.
                  const target = e.target as HTMLElement
                  if (target.closest('[data-card-menu]') || target.closest('.delete-confirm-overlay')) return
                  if (isLapsed) return
                  window.location.href = `/dashboard/dialer?campaignId=${campaign.id}`
                }}
              >
                {/* PREVIEW (top) */}
                <div className="card-preview" style={{ background: modeInfo.bgGradient }}>
                  <div className="card-preview-top">
                    <div className="card-preview-badges">
                      <span className="card-status-pill" style={{
                        color: isActive ? T.blue : T.muted,
                        borderColor: isActive ? 'rgba(74,158,255,0.4)' : 'rgba(0,0,0,0.08)',
                      }}>
                        {isActive ? '● ACTIVE' : '○ INACTIVE'}
                      </span>
                      {campaign.amd_enabled && (
                        <span className="card-amd-pill">AMD</span>
                      )}
                    </div>
                    <div data-card-menu style={{ position: 'relative' }}>
                      <button
                        className="card-menu-btn"
                        aria-label="Campaign options"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(isMenuOpen ? null : campaign.id)
                        }}
                      >⋯</button>
                      {isMenuOpen && (
                        <div className="card-menu">
                          {!isLapsed && (
                            <button
                              className="card-menu-item"
                              onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/dialer?campaignId=${campaign.id}` }}
                            >
                              <span className="card-menu-icon">📞</span>
                              <span>OPEN IN DIALER</span>
                            </button>
                          )}
                          {!isLapsed && (
                            <button
                              className="card-menu-item"
                              onClick={(e) => { e.stopPropagation(); toggleStatus(campaign.id, campaign.status) }}
                            >
                              <span className="card-menu-icon">{isActive ? '⏸' : '▶'}</span>
                              <span>{isActive ? 'DEACTIVATE' : 'ACTIVATE'}</span>
                            </button>
                          )}
                          {!isLapsed && <div className="card-menu-divider" />}
                          {!isLapsed && (
                            <button
                              className="card-menu-item"
                              onClick={(e) => { e.stopPropagation(); openModeModal(campaign) }}
                            >
                              <span className="card-menu-icon">⚙</span>
                              <span>DIALER MODE</span>
                            </button>
                          )}
                          {!isLapsed && (
                            <button
                              className="card-menu-item"
                              onClick={(e) => { e.stopPropagation(); openScriptsModal(campaign) }}
                            >
                              <span className="card-menu-icon">📝</span>
                              <span>EDIT SCRIPTS</span>
                            </button>
                          )}
                          {!isLapsed && (
                            <label
                              className="card-menu-item"
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="card-menu-icon">+</span>
                              <span>UPLOAD CSV</span>
                              <input type="file" accept=".csv" style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleUploadMore(campaign.id, file)
                                    setOpenMenuId(null)
                                  }
                                }} />
                            </label>
                          )}
                          {!isLapsed && <div className="card-menu-divider" />}
                          {!isLapsed && (
                            <button
                              className="card-menu-item danger"
                              onClick={(e) => { e.stopPropagation(); startDelete(campaign.id) }}
                            >
                              <span className="card-menu-icon">🗑</span>
                              <span>DELETE CAMPAIGN</span>
                            </button>
                          )}
                          {isLapsed && (
                            <div style={{ padding: 12, fontSize: 10, color: T.muted, letterSpacing: 1, textAlign: 'center' }}>
                              READ-ONLY — RESUBSCRIBE TO EDIT
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Script thumbnail — the "image preview" — shows actual document content */}
                  <ScriptThumbnail script={campaign.script} accentColor={modeInfo.color} />

                  <div className="card-preview-bottom">
                    <div style={{ minWidth: 0 }}>
                      <div className="card-mode-label" style={{ color: modeInfo.color }}>
                        {modeInfo.label}
                      </div>
                      <div className="card-mode-leads">
                        {campaign.total_leads.toLocaleString()} LEADS · {campaign.called_leads.toLocaleString()} CALLED
                      </div>
                    </div>
                    <ProgressRing percent={percent} color={modeInfo.color} size={50} thickness={4} />
                  </div>
                </div>

                {/* FOOTER (bottom) */}
                <div className="card-footer">
                  <h3 className="card-name">{campaign.name}</h3>
                  <p className="card-meta">
                    Modified {relativeTime(lastUpdated)}
                  </p>
                </div>

                {/* DELETE CONFIRMATION OVERLAY */}
                {isDeleting && (
                  <div className="delete-confirm-overlay" onClick={(e) => e.stopPropagation()}>
                    <p className="delete-confirm-title">DELETE CAMPAIGN?</p>
                    <p className="delete-confirm-text">
                      &quot;{campaign.name}&quot;{campaign.total_leads >= 100
                        ? ` has ${campaign.total_leads.toLocaleString()} leads. Type "delete" to confirm.`
                        : '. This cannot be undone.'}
                    </p>
                    {campaign.total_leads >= 100 && (
                      <input
                        type="text"
                        placeholder='type "delete"'
                        value={deleteTyped}
                        onChange={e => setDeleteTyped(e.target.value)}
                        autoFocus
                        className="delete-confirm-input"
                      />
                    )}
                    <div className="delete-confirm-actions">
                      <button
                        onClick={() => { setDeleteConfirm(null); setDeleteTyped('') }}
                        style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}
                      >CANCEL</button>
                      <button
                        onClick={() => handleDelete(campaign.id, campaign.total_leads)}
                        disabled={campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete'}
                        style={{
                          background: 'white', border: 'none', color: '#c44',
                          opacity: campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete' ? 0.4 : 1,
                          cursor: campaign.total_leads >= 100 && deleteTyped.toLowerCase().trim() !== 'delete' ? 'not-allowed' : 'pointer',
                        }}
                      >DELETE</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {!isLapsed && showModal && (
        <div className="modal-overlay">
          <div className="campaign-modal" style={{ maxWidth: 580 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '4px', color: T.text, marginBottom: '8px' }}>NEW CAMPAIGN</h2>
            <p style={{ fontSize: '12px', letterSpacing: '1px', color: T.muted, marginBottom: '32px' }}>
              Name your campaign, choose a dialer mode, and upload your leads CSV.
            </p>

            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '3px', color: T.muted, marginBottom: '8px' }}>CAMPAIGN NAME</label>
            <input
              type="text" placeholder="Medicare Leads May"
              value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: '10px',
                background: T.surface2, border: `1px solid ${T.border}`,
                color: T.text, fontSize: '14px', outline: 'none',
                marginBottom: '24px', fontFamily: 'Futura PT, Futura, sans-serif', boxSizing: 'border-box',
              }} />

            <label style={{ display: 'block', fontSize: '10px', letterSpacing: '3px', color: T.muted, marginBottom: '8px' }}>
              DIALER MODE
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
              marginBottom: 8,
            }}>
              {(Object.keys(MODE_INFO) as DialerMode[]).map(m => {
                const info = MODE_INFO[m]
                const selected = createMode === m
                return (
                  <button
                    key={m}
                    onClick={() => setCreateMode(m)}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      background: selected ? '#dde0e8' : T.surface2,
                      border: `1px solid ${selected ? info.color : T.border}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontFamily: 'Futura PT, Futura, sans-serif',
                    }}
                  >
                    <div style={{
                      fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
                      color: selected ? info.color : T.text, marginBottom: 4,
                    }}>{info.label}</div>
                    <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.4 }}>
                      {info.tagline}
                    </div>
                  </button>
                )
              })}
            </div>
            <p style={{
              fontSize: 10, letterSpacing: 0.5, color: T.muted, lineHeight: 1.5, marginBottom: 24,
            }}>
              Not sure? Start with <strong>POWER</strong>. You can change anytime.{' '}
              <Link href="/dialing-modes" target="_blank" rel="noopener" style={{ color: T.blue }}>
                Compare modes →
              </Link>
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '40px', borderRadius: '12px', cursor: 'pointer', marginBottom: '32px',
                border: `2px dashed ${dragging ? T.blue : csvData.length > 0 ? T.blue : T.border}`,
                background: dragging ? 'rgba(74,158,255,0.05)' : csvData.length > 0 ? 'rgba(74,158,255,0.03)' : T.surface2,
                textAlign: 'center', transition: 'all 0.2s',
              }}>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
              {csvData.length > 0 ? (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                  <p style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', color: T.blue, marginBottom: '4px' }}>
                    {csvData.length.toLocaleString()} LEADS LOADED
                  </p>
                  <p style={{ fontSize: '11px', color: T.muted }}>{csvName}</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📂</div>
                  <p style={{ fontSize: '12px', letterSpacing: '2px', color: T.muted, marginBottom: '4px' }}>DROP YOUR CSV HERE</p>
                  <p style={{ fontSize: '11px', color: T.muted, opacity: 0.6 }}>or click to browse files</p>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowModal(false); setCampaignName(''); setCsvData([]); setCsvName(''); setCreateMode('power') }} style={{
                flex: 1, padding: '14px', borderRadius: '10px',
                background: 'transparent', border: `1px solid ${T.border}`,
                color: T.muted, fontSize: '11px', letterSpacing: '2px',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>CANCEL</button>
              <button onClick={handleCreate} disabled={!campaignName || loading} style={{
                flex: 2, padding: '14px', borderRadius: '10px', border: 'none',
                background: campaignName ? 'linear-gradient(135deg, #4a9eff, #2a6eff)' : T.border,
                color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
                cursor: campaignName ? 'pointer' : 'not-allowed',
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}>{loading ? 'CREATING...' : 'CREATE CAMPAIGN →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODE MODAL */}
      {!isLapsed && modeModal && (
        <div className="modal-overlay">
          <div className="campaign-modal" style={{ maxWidth: 640 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '4px', color: T.text, marginBottom: '8px' }}>
              DIALER MODE
            </h2>
            <p style={{ fontSize: '12px', letterSpacing: '1px', color: T.muted, marginBottom: '20px' }}>
              {modeModal.name} — Choose how this campaign should dial.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 8,
              marginBottom: 24,
            }}>
              {(Object.keys(MODE_INFO) as DialerMode[]).map(m => {
                const info = MODE_INFO[m]
                const selected = modeChoice === m
                return (
                  <button
                    key={m}
                    onClick={() => handleModeSelect(m)}
                    style={{
                      padding: '14px 16px',
                      textAlign: 'left',
                      background: selected ? '#dde0e8' : T.surface2,
                      border: `1px solid ${selected ? info.color : T.border}`,
                      borderLeft: `3px solid ${info.color}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontFamily: 'Futura PT, Futura, sans-serif',
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 8, marginBottom: 6, flexWrap: 'wrap',
                    }}>
                      <div style={{
                        fontSize: 13, fontWeight: 'bold', letterSpacing: 2,
                        color: selected ? info.color : T.text,
                      }}>{info.label}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{
                          fontSize: 9, letterSpacing: 1, color: T.muted,
                          fontFamily: 'monospace',
                        }}>{info.speed.toUpperCase()}</span>
                        <span style={{ fontSize: 9, color: T.muted }}>·</span>
                        <span style={{
                          fontSize: 9, letterSpacing: 1, color: T.muted,
                          fontFamily: 'monospace',
                        }}>{info.abandons.toUpperCase()}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
                      {info.tagline}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              marginBottom: 12,
              gap: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: T.text, marginBottom: 4 }}>
                  ANSWERING MACHINE DETECTION (AMD)
                </div>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
                  When a voicemail picks up, automatically end the call without routing to the agent.
                  {(modeChoice === 'progressive' || modeChoice === 'predictive') && (
                    <span style={{ color: T.amber, fontWeight: 'bold' }}>
                      {' '}Required for {modeChoice}.
                    </span>
                  )}
                </div>
              </div>
              <div
                onClick={() => {
                  if (modeChoice === 'progressive' || modeChoice === 'predictive') return
                  setAmdEnabled(v => !v)
                }}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: amdEnabled ? T.blue : T.border,
                  position: 'relative',
                  cursor: (modeChoice === 'progressive' || modeChoice === 'predictive') ? 'not-allowed' : 'pointer',
                  opacity: (modeChoice === 'progressive' || modeChoice === 'predictive') ? 0.7 : 1,
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'white', position: 'absolute', top: 3,
                  left: amdEnabled ? 23 : 3, transition: 'left 0.15s',
                }} />
              </div>
            </div>

            {modeChoice === 'predictive' && (
              <div style={{
                padding: '14px 16px',
                background: 'rgba(138,26,26,0.05)',
                border: `1px solid ${T.red}`,
                borderRadius: 8,
                marginBottom: 12,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10, gap: 8,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: T.text }}>
                    LINES PER AGENT
                  </div>
                  <div style={{
                    fontSize: 16, fontWeight: 'bold', color: T.red,
                    fontFamily: 'monospace',
                  }}>{linesPerAgent.toFixed(1)}×</div>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={3.0}
                  step={0.1}
                  value={linesPerAgent}
                  onChange={e => setLinesPerAgent(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: T.red,
                  }}
                />
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 9, color: T.muted, fontFamily: 'monospace',
                  letterSpacing: 1, marginTop: 4,
                }}>
                  <span>1.0× SAFE</span>
                  <span>1.5× DEFAULT</span>
                  <span>3.0× AGGRESSIVE</span>
                </div>
                <p style={{
                  fontSize: 10, color: T.muted, lineHeight: 1.5, marginTop: 10, marginBottom: 0,
                }}>
                  Higher multipliers connect more humans per agent but raise abandon risk.
                  System auto-throttles to 1× if abandon rate approaches the 3% legal cap.
                </p>
              </div>
            )}

            {modeError && (
              <div style={{
                padding: '10px 12px',
                background: '#f8e8e8',
                border: `1px solid ${T.red}`,
                color: T.red,
                fontSize: 11,
                letterSpacing: 1,
                borderRadius: 6,
                marginBottom: 12,
              }}>{modeError}</div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setModeModal(null)} disabled={modeSaving} style={{
                flex: 1, padding: '14px', borderRadius: '10px',
                background: 'transparent', border: `1px solid ${T.border}`,
                color: T.muted, fontSize: '11px', letterSpacing: '2px',
                cursor: modeSaving ? 'not-allowed' : 'pointer',
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}>CANCEL</button>
              <button onClick={handleSaveMode} disabled={modeSaving} style={{
                flex: 2, padding: '14px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                color: 'white', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
                cursor: modeSaving ? 'not-allowed' : 'pointer',
                opacity: modeSaving ? 0.6 : 1,
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}>{modeSaving ? 'SAVING...' : 'SAVE MODE →'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SCRIPTS MODAL */}
      {!isLapsed && scriptsModal && (
        <div className="modal-overlay">
          <div className="scripts-modal">
            <div className="scripts-modal-header">
              <div className="scripts-modal-header-text">
                <div className="scripts-modal-title">CALL SCRIPTS</div>
                <div className="scripts-modal-subtitle">
                  {scriptsModal.name} — switch between scripts mid-call from the dialer.
                </div>
              </div>
              <button
                className="scripts-modal-close"
                onClick={closeScriptsModal}
                aria-label="Close"
              >×</button>
            </div>

            <div className="scripts-tabs" ref={tabsRowRef}>
              {scripts.map(s => {
                const isActive = activeScriptId === s.id
                const isDragging = tabDrag?.draggedId === s.id
                const isDragOver = tabDrag?.targetId === s.id && tabDrag?.draggedId !== s.id
                return (
                  <div
                    key={s.id}
                    data-tab-id={s.id}
                    className={`scripts-tab ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    onClick={() => switchActiveScript(s.id)}
                  >
                    {scripts.length > 1 && (
                      <span
                        className="scripts-tab-handle"
                        onPointerDown={(e) => onTabHandlePointerDown(e, s.id)}
                        onPointerMove={onTabHandlePointerMove}
                        onPointerUp={onTabHandlePointerUp}
                        onPointerCancel={onTabHandlePointerCancel}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Drag to reorder"
                        title="Drag to reorder"
                      >⋮⋮</span>
                    )}
                    {s.name || 'Untitled'}
                    {s.is_default && <span className="scripts-tab-default-badge">DEFAULT</span>}
                  </div>
                )
              })}
              <button className="scripts-add-btn" onClick={handleAddScript} disabled={savingScript}>
                + ADD SCRIPT
              </button>
            </div>

            <div className="scripts-modal-body">
              {scriptsLoading ? (
                <div style={{ textAlign: 'center', padding: 60, fontSize: 12, color: T.muted, letterSpacing: 3 }}>
                  LOADING SCRIPTS...
                </div>
              ) : scripts.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '60px 20px',
                  background: T.surface2, border: `1px dashed ${T.border}`, borderRadius: 8,
                }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>📝</div>
                  <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: T.text, marginBottom: 8 }}>
                    NO SCRIPTS YET
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>
                    Create scripts for different scenarios:<br />
                    cold open, voicemail leave-behind, common objections, closing pitches.
                  </div>
                  <button
                    onClick={handleAddScript}
                    disabled={savingScript}
                    style={{
                      padding: '12px 24px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                      color: 'white', fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
                      cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                    }}
                  >+ CREATE FIRST SCRIPT</button>
                </div>
              ) : activeScriptId ? (
                <>
                  {scripts.length > 1 && (
                    <div className="scripts-modal-tip">
                      ⋮⋮ <strong>TIP:</strong> Drag the handle on any tab to reorder. Order shows up the same way on the dialer.
                    </div>
                  )}
                  <label style={{ display: 'block', fontSize: 10, letterSpacing: 3, color: T.muted, marginBottom: 6 }}>
                    SCRIPT NAME
                  </label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => { setEditingName(e.target.value); setDirtyScript(true) }}
                    placeholder="e.g. Cold open, Voicemail leave-behind, Objection: too expensive"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      background: T.surface2, border: `1px solid ${T.border}`,
                      color: T.text, fontSize: 13, outline: 'none',
                      marginBottom: 16, fontFamily: 'Futura PT, Futura, sans-serif',
                      boxSizing: 'border-box',
                    }}
                  />

                  <label style={{ display: 'block', fontSize: 10, letterSpacing: 3, color: T.muted, marginBottom: 6 }}>
                    SCRIPT BODY
                  </label>
                  <textarea
                    value={editingBody}
                    onChange={e => { setEditingBody(e.target.value); setDirtyScript(true) }}
                    placeholder="Hi [Name], my name is [Agent] and I'm calling from..."
                    rows={14}
                    style={{
                      width: '100%', padding: 16, borderRadius: 8, boxSizing: 'border-box',
                      background: T.surface2, border: `1px solid ${T.border}`,
                      color: T.text, fontSize: 14, lineHeight: 1.7,
                      outline: 'none', resize: 'vertical',
                      fontFamily: 'Futura PT, Futura, sans-serif',
                    }}
                  />
                </>
              ) : null}
            </div>

            {activeScriptId && (
              <div className="scripts-modal-footer">
                <div className="scripts-modal-footer-left">
                  {!scripts.find(s => s.id === activeScriptId)?.is_default && (
                    <button
                      onClick={handleMakeDefault}
                      disabled={savingScript}
                      style={{
                        padding: '10px 14px', borderRadius: 6,
                        background: 'transparent', border: `1px solid ${T.green}`,
                        color: T.green, fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                        cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                      }}
                    >★ MAKE DEFAULT</button>
                  )}
                  <button
                    onClick={handleDeleteScript}
                    disabled={savingScript}
                    style={{
                      padding: '10px 14px', borderRadius: 6,
                      background: 'transparent', border: '1px solid rgba(255,68,68,0.4)',
                      color: '#ff4444', fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                      cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                    }}
                  >🗑 DELETE SCRIPT</button>
                </div>
                <div className="scripts-modal-footer-right">
                  <button
                    onClick={closeScriptsModal}
                    disabled={savingScript}
                    style={{
                      padding: '10px 20px', borderRadius: 6,
                      background: 'transparent', border: `1px solid ${T.border}`,
                      color: T.muted, fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                      cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                    }}
                  >CLOSE</button>
                  <button
                    onClick={handleSaveActive}
                    disabled={savingScript || !dirtyScript}
                    style={{
                      padding: '10px 24px', borderRadius: 6, border: 'none',
                      background: dirtyScript ? 'linear-gradient(135deg, #4a9eff, #2a6eff)' : T.border,
                      color: 'white', fontSize: 10, letterSpacing: 2, fontWeight: 'bold',
                      cursor: dirtyScript ? 'pointer' : 'not-allowed',
                      opacity: dirtyScript ? 1 : 0.6,
                      fontFamily: 'Futura PT, Futura, sans-serif',
                    }}
                  >{savingScript ? 'SAVING...' : dirtyScript ? '💾 SAVE CHANGES' : 'SAVED'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}