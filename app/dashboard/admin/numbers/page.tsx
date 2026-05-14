'use client'
import { useEffect, useState, useMemo } from 'react'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
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

interface PoolNumber {
  id: string
  phone_number: string
  area_code: string
  state: string | null
  region: string | null
  signalwire_sid: string
  status: 'active' | 'resting' | 'flagged' | 'released'
  daily_call_count: number
  daily_cap: number
  lifetime_call_count: number
  last_called_at: string | null
  last_flagged_at: string | null
  flag_reason: string | null
  monthly_cost_cents: number
  acquired_at: string
}

interface PoolConfig {
  max_pool_size: number
  daily_buy_cap: number
  utilization_trigger_pct: number
  sustained_hours_required: number
  buys_today: number
  buys_today_date: string
}

interface PoolData {
  numbers: PoolNumber[]
  config: PoolConfig
  stats: {
    total: number
    active: number
    resting: number
    flagged: number
    utilizationPct: number
    totalDailyCalls: number
  }
  liveUtilization: {
    pct: number
    dailyCalls: number
    dailyCapacity: number
    triggerPct: number
    pctUntilTrigger: number
  }
}

// Common US area codes by state — used for the "specific states" batch buy.
// Pick a representative metro code per state so the buy actually targets the right area.
const STATE_AREA_CODES: Array<{ state: string; name: string; areaCodes: string[] }> = [
  { state: 'AL', name: 'Alabama', areaCodes: ['205', '251', '256', '334', '938'] },
  { state: 'AK', name: 'Alaska', areaCodes: ['907'] },
  { state: 'AZ', name: 'Arizona', areaCodes: ['480', '520', '602', '623', '928'] },
  { state: 'AR', name: 'Arkansas', areaCodes: ['479', '501', '870'] },
  { state: 'CA', name: 'California', areaCodes: ['213', '310', '408', '415', '510', '619', '714', '818', '925', '949'] },
  { state: 'CO', name: 'Colorado', areaCodes: ['303', '719', '720', '970'] },
  { state: 'CT', name: 'Connecticut', areaCodes: ['203', '475', '860', '959'] },
  { state: 'DE', name: 'Delaware', areaCodes: ['302'] },
  { state: 'FL', name: 'Florida', areaCodes: ['305', '321', '352', '386', '407', '561', '727', '813', '850', '904', '954'] },
  { state: 'GA', name: 'Georgia', areaCodes: ['229', '404', '470', '478', '678', '706', '770', '912'] },
  { state: 'HI', name: 'Hawaii', areaCodes: ['808'] },
  { state: 'ID', name: 'Idaho', areaCodes: ['208', '986'] },
  { state: 'IL', name: 'Illinois', areaCodes: ['217', '224', '309', '312', '331', '618', '630', '708', '773', '815', '847', '872'] },
  { state: 'IN', name: 'Indiana', areaCodes: ['219', '260', '317', '463', '574', '765', '812'] },
  { state: 'IA', name: 'Iowa', areaCodes: ['319', '515', '563', '641', '712'] },
  { state: 'KS', name: 'Kansas', areaCodes: ['316', '620', '785', '913'] },
  { state: 'KY', name: 'Kentucky', areaCodes: ['270', '364', '502', '606', '859'] },
  { state: 'LA', name: 'Louisiana', areaCodes: ['225', '318', '337', '504', '985'] },
  { state: 'ME', name: 'Maine', areaCodes: ['207'] },
  { state: 'MD', name: 'Maryland', areaCodes: ['240', '301', '410', '443', '667'] },
  { state: 'MA', name: 'Massachusetts', areaCodes: ['339', '351', '413', '508', '617', '774', '781', '857', '978'] },
  { state: 'MI', name: 'Michigan', areaCodes: ['231', '248', '269', '313', '517', '586', '616', '734', '810', '906', '947', '989'] },
  { state: 'MN', name: 'Minnesota', areaCodes: ['218', '320', '507', '612', '651', '763', '952'] },
  { state: 'MS', name: 'Mississippi', areaCodes: ['228', '601', '662', '769'] },
  { state: 'MO', name: 'Missouri', areaCodes: ['314', '417', '573', '636', '660', '816'] },
  { state: 'MT', name: 'Montana', areaCodes: ['406'] },
  { state: 'NE', name: 'Nebraska', areaCodes: ['308', '402', '531'] },
  { state: 'NV', name: 'Nevada', areaCodes: ['702', '725', '775'] },
  { state: 'NH', name: 'New Hampshire', areaCodes: ['603'] },
  { state: 'NJ', name: 'New Jersey', areaCodes: ['201', '551', '609', '732', '848', '856', '862', '908', '973'] },
  { state: 'NM', name: 'New Mexico', areaCodes: ['505', '575'] },
  { state: 'NY', name: 'New York', areaCodes: ['212', '315', '347', '516', '518', '585', '607', '631', '646', '716', '718', '845', '914', '917', '929', '934'] },
  { state: 'NC', name: 'North Carolina', areaCodes: ['252', '336', '704', '743', '828', '910', '919', '980', '984'] },
  { state: 'ND', name: 'North Dakota', areaCodes: ['701'] },
  { state: 'OH', name: 'Ohio', areaCodes: ['216', '234', '330', '380', '419', '440', '513', '567', '614', '740', '937'] },
  { state: 'OK', name: 'Oklahoma', areaCodes: ['405', '539', '580', '918'] },
  { state: 'OR', name: 'Oregon', areaCodes: ['458', '503', '541', '971'] },
  { state: 'PA', name: 'Pennsylvania', areaCodes: ['215', '223', '267', '272', '412', '484', '570', '610', '717', '724', '814', '878'] },
  { state: 'RI', name: 'Rhode Island', areaCodes: ['401'] },
  { state: 'SC', name: 'South Carolina', areaCodes: ['803', '843', '854', '864'] },
  { state: 'SD', name: 'South Dakota', areaCodes: ['605'] },
  { state: 'TN', name: 'Tennessee', areaCodes: ['423', '615', '629', '731', '865', '901', '931'] },
  { state: 'TX', name: 'Texas', areaCodes: ['210', '214', '254', '281', '325', '346', '361', '409', '430', '432', '469', '512', '682', '713', '726', '737', '806', '817', '830', '832', '903', '915', '936', '940', '956', '972', '979'] },
  { state: 'UT', name: 'Utah', areaCodes: ['385', '435', '801'] },
  { state: 'VT', name: 'Vermont', areaCodes: ['802'] },
  { state: 'VA', name: 'Virginia', areaCodes: ['276', '434', '540', '571', '703', '757', '804'] },
  { state: 'WA', name: 'Washington', areaCodes: ['206', '253', '360', '425', '509', '564'] },
  { state: 'WV', name: 'West Virginia', areaCodes: ['304', '681'] },
  { state: 'WI', name: 'Wisconsin', areaCodes: ['262', '414', '534', '608', '715', '920'] },
  { state: 'WY', name: 'Wyoming', areaCodes: ['307'] },
]

function formatPhone(p: string) {
  const d = p.replace(/\D/g, '')
  if (d.length === 11) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

function timeAgo(iso: string | null) {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

const STATUS_COLORS = {
  active: T.green,
  resting: T.amber,
  flagged: T.red,
  released: T.muted,
}

const CONFIG_FIELDS: Array<{ key: keyof PoolConfig, label: string, help: string }> = [
  { key: 'max_pool_size', label: 'MAX POOL SIZE', help: 'Hard ceiling on total numbers (10-50000)' },
  { key: 'daily_buy_cap', label: 'DAILY BUY CAP', help: 'Max auto-buys per day (1-500)' },
  { key: 'utilization_trigger_pct', label: 'TRIGGER %', help: 'Buy when util reaches this % (30-99)' },
  { key: 'sustained_hours_required', label: 'SUSTAINED HOURS', help: 'Hours util must stay above trigger (1-24)' },
]

export default function AdminNumbersPage() {
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'resting' | 'flagged'>('all')

  // Buy modal
  const [buyOpen, setBuyOpen] = useState(false)
  const [buyMode, setBuyMode] = useState<'single' | 'random' | 'states'>('single')
  const [buyAreaCode, setBuyAreaCode] = useState('')
  const [buyQty, setBuyQty] = useState(5)
  const [buySelectedStates, setBuySelectedStates] = useState<Set<string>>(new Set())
  const [buying, setBuying] = useState(false)
  const [buyMessage, setBuyMessage] = useState<string | null>(null)
  const [buyProgress, setBuyProgress] = useState<{ done: number; total: number } | null>(null)

  const [releaseConfirmId, setReleaseConfirmId] = useState<string | null>(null)
  const [releasing, setReleasing] = useState<string | null>(null)

  const [configOpen, setConfigOpen] = useState(false)
  const [configEdits, setConfigEdits] = useState<Partial<PoolConfig>>({})
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMessage, setConfigMessage] = useState<string | null>(null)

  const [seedOpen, setSeedOpen] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)

  const load = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/pool/list')
      if (res.status === 403) throw new Error('Forbidden — admin only')
      if (res.status === 401) throw new Error('Not signed in')
      const d = await res.json()
      if (d.success) setData(d)
      else setError(d.error || 'Failed to load')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    const id = setInterval(() => load(false), 30_000)
    return () => clearInterval(id)
  }, [])

  const filteredNumbers = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.numbers
    return data.numbers.filter(n => n.status === filter)
  }, [data, filter])

  const resetBuyModal = () => {
    setBuyOpen(false)
    setBuyMessage(null)
    setBuyAreaCode('')
    setBuyQty(5)
    setBuySelectedStates(new Set())
    setBuyMode('single')
    setBuyProgress(null)
  }

  // Single-area-code buy
  const handleBuySingle = async () => {
    if (!/^\d{3}$/.test(buyAreaCode)) {
      setBuyMessage('Area code must be exactly 3 digits')
      return
    }
    setBuying(true)
    setBuyMessage(null)
    try {
      const res = await fetch('/api/admin/pool/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaCode: buyAreaCode }),
      })
      const d = await res.json()
      if (d.success) {
        setBuyMessage(`Bought ${d.number.phone_number}`)
        setBuyAreaCode('')
        await load(false)
      } else {
        setBuyMessage(`Failed: ${d.error}`)
      }
    } catch (err: any) {
      setBuyMessage(`Error: ${err.message}`)
    } finally {
      setBuying(false)
    }
  }

  // Pick `qty` area codes from a flat list, no duplicates, weighted by metro size
  // (which is approximated by the order they appear in the array — first one
  // per state is the largest metro).
  const sampleAreaCodes = (sourceCodes: string[], qty: number): string[] => {
    const picks: string[] = []
    const pool = [...sourceCodes]
    for (let i = 0; i < qty && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      picks.push(pool[idx])
      pool.splice(idx, 1)
    }
    return picks
  }

  // Random states or specific states batch buy
  const handleBuyBatch = async () => {
    const qty = Math.max(1, Math.min(buyQty, 100))
    let pickFrom: string[] = []

    if (buyMode === 'random') {
      // All US area codes — flatten everything
      pickFrom = STATE_AREA_CODES.flatMap(s => s.areaCodes)
    } else {
      // Specific states
      if (buySelectedStates.size === 0) {
        setBuyMessage('Pick at least one state')
        return
      }
      pickFrom = STATE_AREA_CODES
        .filter(s => buySelectedStates.has(s.state))
        .flatMap(s => s.areaCodes)
    }

    if (pickFrom.length === 0) {
      setBuyMessage('No area codes match selection')
      return
    }

    setBuying(true)
    setBuyMessage(null)
    setBuyProgress({ done: 0, total: qty })

    const codes = sampleAreaCodes(pickFrom, qty)
    let success = 0
    let failed = 0
    const failures: string[] = []

    // Fire purchases sequentially so we don't blow past daily_buy_cap or
    // race against config limits
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]
      try {
        const res = await fetch('/api/admin/pool/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ areaCode: code }),
        })
        const d = await res.json()
        if (d.success) {
          success++
        } else {
          failed++
          failures.push(`${code}: ${d.error}`)
        }
      } catch (err: any) {
        failed++
        failures.push(`${code}: ${err.message}`)
      }
      setBuyProgress({ done: i + 1, total: qty })
    }

    setBuyMessage(`Batch complete: ${success} bought, ${failed} failed${failures.length > 0 ? ` (${failures.slice(0, 3).join('; ')}${failures.length > 3 ? '...' : ''})` : ''}`)
    setBuying(false)
    setBuyProgress(null)
    await load(false)
  }

  const handleSeed = async () => {
    setSeeding(true)
    setSeedMessage(null)
    try {
      const res = await fetch('/api/admin/pool/seed', { method: 'POST' })
      const d = await res.json()
      if (d.success) {
        const { purchased, skipped, failed, total } = d.summary
        setSeedMessage(`Seed complete: ${purchased} purchased, ${skipped} already in pool, ${failed} failed (of ${total})`)
        await load(false)
      } else {
        setSeedMessage(`Seed failed: ${d.error}`)
      }
    } catch (err: any) {
      setSeedMessage(`Error: ${err.message}`)
    } finally {
      setSeeding(false)
    }
  }

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/pool/sync', { method: 'POST' })
      const d = await res.json()
      if (d.success) {
        const { imported, already_in_pool, orphans } = d.summary
        const orphanNote = orphans > 0
          ? `, ${orphans} orphaned (in pool but not in SignalWire)`
          : ''
        alert(`Sync complete: ${imported} imported, ${already_in_pool} already tracked${orphanNote}`)
        await load(false)
      } else {
        alert(`Sync failed: ${d.error}`)
      }
    } catch (e: any) {
      alert(`Sync error: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleRelease = async (id: string) => {
    setReleasing(id)
    try {
      const res = await fetch('/api/admin/pool/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numberId: id, confirm: 'release' }),
      })
      const d = await res.json()
      if (d.success) {
        await load(false)
      } else {
        alert(`Release failed: ${d.error}`)
      }
    } catch (err: any) {
      alert(`Release error: ${err.message}`)
    } finally {
      setReleasing(null)
      setReleaseConfirmId(null)
    }
  }

  const handleConfigSave = async () => {
    if (Object.keys(configEdits).length === 0) {
      setConfigOpen(false)
      return
    }
    setSavingConfig(true)
    setConfigMessage(null)
    try {
      const res = await fetch('/api/admin/pool/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configEdits),
      })
      const d = await res.json()
      if (d.success) {
        setConfigEdits({})
        setConfigOpen(false)
        await load(false)
      } else {
        setConfigMessage(`Failed: ${d.error}`)
      }
    } catch (err: any) {
      setConfigMessage(`Error: ${err.message}`)
    } finally {
      setSavingConfig(false)
    }
  }

  const toggleState = (state: string) => {
    setBuySelectedStates(prev => {
      const next = new Set(prev)
      if (next.has(state)) next.delete(state)
      else next.add(state)
      return next
    })
  }

  const selectAllStates = () => {
    setBuySelectedStates(new Set(STATE_AREA_CODES.map(s => s.state)))
  }

  const clearAllStates = () => {
    setBuySelectedStates(new Set())
  }

  if (loading && !data) {
    return (
      <div style={{
        flex: 1, background: T.bg, padding: 40, textAlign: 'center',
        fontSize: 11, letterSpacing: 3, color: T.muted,
      }}>LOADING POOL...</div>
    )
  }

  if (error) {
    return (
      <div style={{
        flex: 1, background: T.bg, padding: 40, textAlign: 'center',
        fontSize: 12, letterSpacing: 2, color: T.red,
      }}>{error}</div>
    )
  }

  if (!data) return null

  const { config, stats, liveUtilization } = data
  const poolCount = data.numbers.length
  const utilizationDelta = liveUtilization.triggerPct - liveUtilization.pct
  const willTriggerSoon = utilizationDelta <= 10 && utilizationDelta > 0
  const triggerHit = liveUtilization.pct >= liveUtilization.triggerPct
  const poolEmpty = poolCount === 0

  return (
    <div style={{
      flex: 1, background: T.bg, minHeight: 'calc(100vh - 64px)',
      display: 'flex', flexDirection: 'column', overflow: 'auto',
    }}>
      <style>{`
        .pool-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .pool-content { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .pool-stat-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .pool-stat-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .pool-stat-card {
          padding: 14px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          border-top: 3px solid ${T.blue};
        }
        .pool-stat-label {
          font-size: 9px; letter-spacing: 2px; color: ${T.muted};
          font-weight: bold; margin-bottom: 6px;
        }
        .pool-stat-value {
          font-size: 26px; font-weight: bold; font-family: monospace;
          color: ${T.text}; letter-spacing: -1px; line-height: 1;
        }
        .pool-stat-sub {
          font-size: 10px; color: ${T.muted}; margin-top: 5px;
          letter-spacing: 1px; font-family: monospace;
        }
        .pool-section {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 16px;
        }
        .pool-section-title {
          font-size: 10px; letter-spacing: 3px; color: ${T.muted};
          font-weight: bold; margin-bottom: 12px;
        }
        .pool-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .pool-card {
          padding: 14px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          border-left: 3px solid ${T.blue};
        }
        .pool-card.status-active { border-left-color: ${T.green}; }
        .pool-card.status-resting { border-left-color: ${T.amber}; }
        .pool-card.status-flagged { border-left-color: ${T.red}; }
        .pool-meter-bg {
          height: 6px;
          background: ${T.border};
          border-radius: 3px;
          overflow: hidden;
          margin-top: 8px;
        }
        .pool-meter-fill {
          height: 100%;
          transition: width 0.3s;
        }
        .pool-pill {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 2px;
          font-size: 8px;
          letter-spacing: 1px;
          font-weight: bold;
          font-family: 'Futura PT', sans-serif;
        }
        .pool-btn {
          padding: 6px 12px;
          background: transparent;
          border: 1px solid ${T.blue};
          border-radius: 3px;
          color: ${T.blue};
          font-size: 10px;
          letter-spacing: 1px;
          font-weight: bold;
          cursor: pointer;
          font-family: 'Futura PT', sans-serif;
        }
        .pool-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pool-btn-danger { border-color: ${T.red}; color: ${T.red}; }
        .pool-btn-primary {
          background: ${T.dark};
          color: ${T.blue};
          border-color: ${T.blue};
        }
        .pool-modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .pool-modal {
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 24px;
          max-width: 560px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .pool-input {
          padding: 8px 10px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-family: monospace;
          font-size: 13px;
          color: ${T.text};
          outline: none;
          width: 100%;
          box-sizing: border-box;
        }
        .pool-empty-cta {
          padding: 32px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          text-align: center;
        }
        .buy-mode-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          border-bottom: 1px solid ${T.border};
        }
        .buy-mode-tab {
          padding: 8px 14px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: ${T.muted};
          font-size: 10px;
          letter-spacing: 1.5px;
          font-weight: bold;
          font-family: 'Futura PT', sans-serif;
          cursor: pointer;
          margin-bottom: -1px;
        }
        .buy-mode-tab.active {
          color: ${T.blue};
          border-bottom-color: ${T.blue};
        }
        .state-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 4px;
          max-height: 280px;
          overflow-y: auto;
          padding: 8px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          margin-bottom: 12px;
        }
        .state-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          font-size: 10px;
          color: ${T.text};
          cursor: pointer;
          border-radius: 3px;
          font-family: monospace;
          letter-spacing: 1px;
        }
        .state-checkbox:hover { background: ${T.bg}; }
        .state-checkbox input {
          margin: 0;
          accent-color: ${T.blue};
        }
        .state-checkbox.checked {
          background: rgba(74,158,255,0.12);
          color: ${T.blue};
          font-weight: bold;
        }
      `}</style>

      <div className="pool-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            DIALER POOL
          </span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
            {poolCount} OF {config.max_pool_size} MAX · LIVE UTIL {liveUtilization.pct}%
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="pool-btn pool-btn-primary" onClick={() => setBuyOpen(true)}>+ BUY NOW</button>
          <button className="pool-btn" onClick={() => setConfigOpen(true)}>⚙ CONFIG</button>
          <button className="pool-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? '⟳ SYNCING...' : '⟳ SYNC'}
          </button>
          {poolEmpty && (
            <button className="pool-btn pool-btn-primary" onClick={() => setSeedOpen(true)}>
              ⚡ SEED 10 NUMBERS
            </button>
          )}
        </div>
      </div>

      <div className="pool-content">
        {poolEmpty && (
          <div className="pool-empty-cta">
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>📞</div>
            <div style={{
              fontSize: 13, letterSpacing: 3, fontWeight: 'bold',
              color: T.text, marginBottom: 8,
            }}>POOL IS EMPTY</div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Click <strong>SYNC</strong> to import any numbers you already own,
              <br />or <strong>SEED 10 NUMBERS</strong> to populate with 10 across major US metros,
              <br />or <strong>BUY NOW</strong> to add specific area codes or batches.
            </div>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', letterSpacing: 1 }}>
              Each number costs ~$1/mo from SignalWire.
            </div>
          </div>
        )}

        <div className="pool-stat-grid">
          <div className="pool-stat-card">
            <div className="pool-stat-label">POOL SIZE</div>
            <div className="pool-stat-value">{poolCount}</div>
            <div className="pool-stat-sub">OF {config.max_pool_size} MAX</div>
          </div>
          <div className="pool-stat-card" style={{ borderTopColor: T.green }}>
            <div className="pool-stat-label">ACTIVE</div>
            <div className="pool-stat-value" style={{ color: T.green }}>{stats.active}</div>
            <div className="pool-stat-sub">IN ROTATION</div>
          </div>
          <div className="pool-stat-card" style={{ borderTopColor: T.amber }}>
            <div className="pool-stat-label">RESTING</div>
            <div className="pool-stat-value" style={{ color: T.amber }}>{stats.resting}</div>
            <div className="pool-stat-sub">HIT DAILY CAP</div>
          </div>
          <div className="pool-stat-card" style={{ borderTopColor: T.red }}>
            <div className="pool-stat-label">FLAGGED</div>
            <div className="pool-stat-value" style={{ color: T.red }}>{stats.flagged}</div>
            <div className="pool-stat-sub">PENDING RETIRE</div>
          </div>
          <div className="pool-stat-card" style={{ borderTopColor: T.accent }}>
            <div className="pool-stat-label">CALLS TODAY</div>
            <div className="pool-stat-value" style={{ color: T.accent }}>
              {liveUtilization.dailyCalls.toLocaleString()}
            </div>
            <div className="pool-stat-sub">OF {liveUtilization.dailyCapacity.toLocaleString()} CAP</div>
          </div>
        </div>

        <div className="pool-section">
          <div className="pool-section-title">▸ GROWTH METER</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 32, fontWeight: 'bold', fontFamily: 'monospace',
              color: triggerHit ? T.red : willTriggerSoon ? T.amber : T.green,
              letterSpacing: -1, lineHeight: 1,
            }}>
              {liveUtilization.pct}%
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 4 }}>
                {poolEmpty
                  ? 'Pool is empty — no utilization data yet'
                  : triggerHit
                  ? `▲ AT TRIGGER — auto-buy will fire next cron run (top of hour)`
                  : willTriggerSoon
                  ? `▲ ${utilizationDelta}% under trigger — auto-buy approaching`
                  : `${utilizationDelta}% under trigger — pool comfortable`}
              </div>
              <div style={{ position: 'relative', height: 24 }}>
                <div className="pool-meter-bg" style={{ height: 24, position: 'relative' }}>
                  <div className="pool-meter-fill" style={{
                    width: `${Math.min(100, liveUtilization.pct)}%`,
                    background: triggerHit ? T.red : willTriggerSoon ? T.amber : T.green,
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: `${liveUtilization.triggerPct}%`,
                    top: -4,
                    bottom: -4,
                    width: 2,
                    background: T.dark,
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: `${liveUtilization.triggerPct}%`,
                    top: 26,
                    fontSize: 8,
                    color: T.dark,
                    fontWeight: 'bold',
                    letterSpacing: 1,
                    transform: 'translateX(-50%)',
                  }}>TRIGGER {liveUtilization.triggerPct}%</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8,
            fontSize: 10, color: T.muted, fontFamily: 'monospace', letterSpacing: 1,
            marginTop: 18,
          }}>
            <div>BUYS TODAY: <strong style={{ color: T.text }}>{config.buys_today}/{config.daily_buy_cap}</strong></div>
            <div>POOL HEAD: <strong style={{ color: T.text }}>{config.max_pool_size - poolCount} SLOTS</strong></div>
            <div>SUSTAINED: <strong style={{ color: T.text }}>{config.sustained_hours_required}h</strong></div>
          </div>
        </div>

        {!poolEmpty && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(['all', 'active', 'resting', 'flagged'] as const).map(f => (
              <button
                key={f}
                className="pool-btn"
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? T.dark : 'transparent',
                  color: filter === f ? T.blue : T.muted,
                  borderColor: filter === f ? T.blue : T.border,
                }}
              >
                {f.toUpperCase()} · {
                  f === 'all' ? poolCount
                  : f === 'active' ? stats.active
                  : f === 'resting' ? stats.resting
                  : stats.flagged
                }
              </button>
            ))}
          </div>
        )}

        <div className="pool-grid">
          {filteredNumbers.map(n => {
            const usagePct = n.daily_cap > 0
              ? Math.round((n.daily_call_count / n.daily_cap) * 100)
              : 0
            const isConfirming = releaseConfirmId === n.id
            const isReleasing = releasing === n.id

            return (
              <div key={n.id} className={`pool-card status-${n.status}`}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: 8, marginBottom: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'monospace', fontWeight: 'bold', fontSize: 13,
                      color: T.text, letterSpacing: 1,
                    }}>{formatPhone(n.phone_number)}</div>
                    <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1, marginTop: 2 }}>
                      {n.area_code} · {n.state || '?'} · {n.region?.toUpperCase() || 'UNKNOWN'}
                    </div>
                  </div>
                  <span className="pool-pill" style={{
                    background: `${STATUS_COLORS[n.status]}22`,
                    color: STATUS_COLORS[n.status],
                    border: `1px solid ${STATUS_COLORS[n.status]}`,
                  }}>{n.status.toUpperCase()}</span>
                </div>

                <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 4 }}>
                  TODAY: <strong style={{ color: T.text, fontFamily: 'monospace' }}>
                    {n.daily_call_count}/{n.daily_cap}
                  </strong> ({usagePct}%)
                </div>
                <div className="pool-meter-bg">
                  <div className="pool-meter-fill" style={{
                    width: `${Math.min(100, usagePct)}%`,
                    background: usagePct >= 90 ? T.red : usagePct >= 70 ? T.amber : T.green,
                  }} />
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
                  fontSize: 9, color: T.muted, letterSpacing: 1, fontFamily: 'monospace',
                  marginTop: 10, marginBottom: 10,
                }}>
                  <div>LIFETIME: {n.lifetime_call_count.toLocaleString()}</div>
                  <div>LAST: {timeAgo(n.last_called_at)}</div>
                  <div>ADDED: {formatDate(n.acquired_at)}</div>
                  <div>${(n.monthly_cost_cents / 100).toFixed(2)}/mo</div>
                </div>

                {n.flag_reason && (
                  <div style={{
                    fontSize: 9, color: T.red, letterSpacing: 1,
                    padding: 6, background: '#f8e8e8', borderRadius: 2, marginBottom: 8,
                  }}>
                    ⚠ {n.flag_reason}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 4 }}>
                  {!isConfirming ? (
                    <button
                      className="pool-btn pool-btn-danger"
                      style={{ flex: 1 }}
                      onClick={() => setReleaseConfirmId(n.id)}
                    >🗑 RELEASE</button>
                  ) : (
                    <>
                      <button
                        className="pool-btn pool-btn-danger"
                        style={{ flex: 1, background: T.red, color: '#fff' }}
                        disabled={isReleasing}
                        onClick={() => handleRelease(n.id)}
                      >{isReleasing ? '...' : '✓ CONFIRM'}</button>
                      <button
                        className="pool-btn"
                        style={{ flex: 1 }}
                        disabled={isReleasing}
                        onClick={() => setReleaseConfirmId(null)}
                      >CANCEL</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {!poolEmpty && filteredNumbers.length === 0 && (
          <div style={{
            padding: 60, textAlign: 'center', color: T.muted,
            fontSize: 11, letterSpacing: 3,
          }}>
            NO MATCHES IN THIS FILTER
          </div>
        )}
      </div>

      {/* Buy Modal */}
      {buyOpen && (
        <div className="pool-modal-bg" onClick={() => !buying && resetBuyModal()}>
          <div className="pool-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', marginBottom: 12 }}>
              BUY NUMBERS
            </div>

            <div className="buy-mode-tabs">
              <button
                className={`buy-mode-tab ${buyMode === 'single' ? 'active' : ''}`}
                onClick={() => { setBuyMode('single'); setBuyMessage(null) }}
              >SINGLE</button>
              <button
                className={`buy-mode-tab ${buyMode === 'random' ? 'active' : ''}`}
                onClick={() => { setBuyMode('random'); setBuyMessage(null) }}
              >RANDOM STATES</button>
              <button
                className={`buy-mode-tab ${buyMode === 'states' ? 'active' : ''}`}
                onClick={() => { setBuyMode('states'); setBuyMessage(null) }}
              >SPECIFIC STATES</button>
            </div>

            {buyMode === 'single' && (
              <>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 12 }}>
                  Buys ONE number in the specified area code. Counts against daily buy cap
                  ({config.buys_today}/{config.daily_buy_cap} used today).
                </div>
                <input
                  className="pool-input"
                  placeholder="Area code (e.g. 212)"
                  value={buyAreaCode}
                  onChange={e => setBuyAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                  disabled={buying}
                />
              </>
            )}

            {buyMode === 'random' && (
              <>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 12, lineHeight: 1.6 }}>
                  Buys <strong>{buyQty}</strong> numbers picked randomly from across all US area codes.
                  Each purchase counts against daily buy cap
                  ({config.buys_today}/{config.daily_buy_cap} used today).
                </div>
                <label style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontWeight: 'bold', display: 'block', marginBottom: 6 }}>
                  QUANTITY (1-100)
                </label>
                <input
                  className="pool-input"
                  type="number"
                  value={buyQty}
                  onChange={e => setBuyQty(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                  min={1}
                  max={100}
                  disabled={buying}
                />
                <div style={{
                  fontSize: 10, color: T.amber, letterSpacing: 1, marginTop: 10,
                  padding: '8px 10px', background: 'rgba(138,106,26,0.08)',
                  border: `1px solid ${T.amber}`, borderRadius: 3,
                }}>
                  ⚠ Estimated cost: ~${buyQty}.00/mo recurring + ${buyQty}.00 one-time.
                </div>
              </>
            )}

            {buyMode === 'states' && (
              <>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 8, lineHeight: 1.6 }}>
                  Pick states, then specify how many total numbers to buy.
                  System distributes randomly across area codes in selected states.
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button className="pool-btn" onClick={selectAllStates} style={{ fontSize: 9 }}>SELECT ALL</button>
                  <button className="pool-btn" onClick={clearAllStates} style={{ fontSize: 9 }}>CLEAR</button>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, color: T.muted,
                    fontFamily: 'monospace', letterSpacing: 1, alignSelf: 'center',
                  }}>
                    {buySelectedStates.size} STATES SELECTED
                  </span>
                </div>
                <div className="state-grid">
                  {STATE_AREA_CODES.map(s => {
                    const checked = buySelectedStates.has(s.state)
                    return (
                      <label
                        key={s.state}
                        className={`state-checkbox ${checked ? 'checked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleState(s.state)}
                          disabled={buying}
                        />
                        {s.state}
                      </label>
                    )
                  })}
                </div>
                <label style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontWeight: 'bold', display: 'block', marginBottom: 6 }}>
                  TOTAL QUANTITY (1-100)
                </label>
                <input
                  className="pool-input"
                  type="number"
                  value={buyQty}
                  onChange={e => setBuyQty(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                  min={1}
                  max={100}
                  disabled={buying}
                />
                <div style={{
                  fontSize: 10, color: T.amber, letterSpacing: 1, marginTop: 10,
                  padding: '8px 10px', background: 'rgba(138,106,26,0.08)',
                  border: `1px solid ${T.amber}`, borderRadius: 3,
                }}>
                  ⚠ Estimated cost: ~${buyQty}.00/mo recurring + ${buyQty}.00 one-time.
                </div>
              </>
            )}

            {buyProgress && (
              <div style={{
                marginTop: 12, padding: '8px 10px',
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3,
                fontSize: 11, color: T.text, letterSpacing: 1,
              }}>
                BUYING... {buyProgress.done}/{buyProgress.total}
                <div className="pool-meter-bg" style={{ marginTop: 4 }}>
                  <div className="pool-meter-fill" style={{
                    width: `${(buyProgress.done / buyProgress.total) * 100}%`,
                    background: T.blue,
                  }} />
                </div>
              </div>
            )}

            {buyMessage && (
              <div style={{
                fontSize: 10, color: buyMessage.includes('failed') || buyMessage.includes('Failed') || buyMessage.includes('Error') ? T.red : T.green,
                letterSpacing: 1, marginTop: 12, lineHeight: 1.5,
              }}>{buyMessage}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {buyMode === 'single' ? (
                <button
                  className="pool-btn pool-btn-primary"
                  disabled={buying || buyAreaCode.length !== 3}
                  onClick={handleBuySingle}
                >
                  {buying ? 'BUYING...' : 'BUY'}
                </button>
              ) : (
                <button
                  className="pool-btn pool-btn-primary"
                  disabled={buying || (buyMode === 'states' && buySelectedStates.size === 0)}
                  onClick={handleBuyBatch}
                >
                  {buying ? `BUYING ${buyProgress?.done || 0}/${buyProgress?.total || buyQty}...` : `BUY ${buyQty}`}
                </button>
              )}
              <button className="pool-btn" disabled={buying} onClick={resetBuyModal}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seed Modal */}
      {seedOpen && (
        <div className="pool-modal-bg" onClick={() => !seeding && setSeedOpen(false)}>
          <div className="pool-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', marginBottom: 12 }}>
              SEED INITIAL POOL
            </div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 12, lineHeight: 1.6 }}>
              Auto-buys 10 numbers across these US metros:
              <br /><br />
              212 NYC · 213 LA · 312 Chicago · 281 Houston · 602 Phoenix
              <br />
              215 Philadelphia · 210 San Antonio · 619 San Diego · 214 Dallas · 408 San Jose
              <br /><br />
              Cost: ~<strong>$10 one-time SignalWire charge</strong> + ~$10/mo recurring.
              <br /><br />
              Idempotent — running twice won&apos;t double-buy.
            </div>
            {seedMessage && (
              <div style={{
                fontSize: 10, color: seedMessage.startsWith('Seed complete') ? T.green : T.red,
                letterSpacing: 1, marginBottom: 8,
              }}>{seedMessage}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="pool-btn pool-btn-primary" disabled={seeding} onClick={handleSeed}>
                {seeding ? 'SEEDING (1-2 MIN)...' : 'CONFIRM SEED'}
              </button>
              <button className="pool-btn" disabled={seeding} onClick={() => { setSeedOpen(false); setSeedMessage(null) }}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {configOpen && (
        <div className="pool-modal-bg" onClick={() => !savingConfig && setConfigOpen(false)}>
          <div className="pool-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', marginBottom: 12 }}>
              POOL CONFIGURATION
            </div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 16 }}>
              Edit caps and triggers without redeploying. Changes apply on next cron run.
            </div>

            {CONFIG_FIELDS.map(({ key, label, help }) => {
              const editValue = configEdits[key]
              const currentValue: number = editValue !== undefined
                ? Number(editValue)
                : Number(config[key])
              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    marginBottom: 4,
                  }}>
                    <label style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>{label}</label>
                    <span style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>{help}</span>
                  </div>
                  <input
                    className="pool-input"
                    type="number"
                    value={currentValue}
                    onChange={e => setConfigEdits(prev => ({
                      ...prev,
                      [key]: parseInt(e.target.value, 10) || 0,
                    }))}
                    disabled={savingConfig}
                  />
                </div>
              )
            })}

            {configMessage && (
              <div style={{ fontSize: 10, color: T.red, letterSpacing: 1, marginTop: 8 }}>
                {configMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="pool-btn pool-btn-primary" disabled={savingConfig} onClick={handleConfigSave}>
                {savingConfig ? 'SAVING...' : 'SAVE'}
              </button>
              <button className="pool-btn" disabled={savingConfig} onClick={() => { setConfigOpen(false); setConfigEdits({}); setConfigMessage(null) }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}