'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'

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

type Tab = 'health' | 'pool' | 'test' | 'flags' | 'pricing'

interface SystemHealth {
  checkedAt: string
  supabase: { ok: boolean; latencyMs: number; error: string | null }
  stripe: {
    ok: boolean
    latencyMs: number
    error: string | null
    availableCents: number | null
    pendingCents: number | null
    currency: string
  }
  stripeLastEvent: { ok: boolean; lastEventAt: string | null; type: string | null; error: string | null }
  signalwire: {
    ok: boolean
    latencyMs: number
    error: string | null
    balanceUsd: number | null
    currency: string
  }
  subscriptionActivity: { ok: boolean; lastSubUpdateAt: string | null; lastStatus: string | null; error: string | null }
}

interface PoolConfig {
  max_pool_size: number
  daily_buy_cap: number
  utilization_trigger_pct: number
  sustained_hours_required: number
  buys_today?: number
}

interface ExcludedUser {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  is_admin: boolean
  exclude_from_analytics: boolean
  created_at: string
}

interface AdminUser {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  is_admin: boolean
}

interface FeatureFlag {
  key: string
  enabled: boolean
  description: string
  updated_at: string
}

const POOL_FIELDS: Array<{ key: keyof PoolConfig; label: string; help: string; min: number; max: number }> = [
  { key: 'max_pool_size', label: 'MAX POOL SIZE', help: 'Hard ceiling on total pool numbers', min: 10, max: 50000 },
  { key: 'daily_buy_cap', label: 'DAILY BUY CAP', help: 'Max auto-buys per day', min: 1, max: 500 },
  { key: 'utilization_trigger_pct', label: 'UTILIZATION TRIGGER %', help: 'Buy when utilization reaches this %', min: 30, max: 99 },
  { key: 'sustained_hours_required', label: 'SUSTAINED HOURS', help: 'Hours util must stay above trigger before buying', min: 1, max: 24 },
]

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'health', label: 'SYSTEM HEALTH', icon: '◉' },
  { id: 'pool', label: 'POOL CONFIG', icon: '◆' },
  { id: 'test', label: 'TEST ACCOUNTS', icon: '⊘' },
  { id: 'flags', label: 'FEATURE FLAGS', icon: '⚑' },
  { id: 'pricing', label: 'PRICING', icon: '$' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

function formatMoney(cents: number | null, currency = 'USD'): string {
  if (cents === null || cents === undefined) return '—'
  return `${currency.toUpperCase()} $${(cents / 100).toFixed(2)}`
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('health')

  // ── SYSTEM HEALTH ────────────────────────────────────────────
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError(null)
    try {
      const res = await fetch('/api/admin/system-health')
      if (res.status === 403) throw new Error('Admin only')
      const d = await res.json()
      if (d.success) setHealth(d)
      else setHealthError(d.error || 'Failed to load')
    } catch (err: any) {
      setHealthError(err.message)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  // ── POOL CONFIG ──────────────────────────────────────────────
  const [poolConfig, setPoolConfig] = useState<PoolConfig | null>(null)
  const [poolEdits, setPoolEdits] = useState<Partial<PoolConfig>>({})
  const [poolSaving, setPoolSaving] = useState(false)
  const [poolMsg, setPoolMsg] = useState<string | null>(null)
  const [poolLoading, setPoolLoading] = useState(false)

  const loadPool = useCallback(async () => {
    setPoolLoading(true)
    try {
      const res = await fetch('/api/admin/pool/list')
      const d = await res.json()
      if (d.success) {
        setPoolConfig(d.config)
        setPoolEdits({})
      }
    } catch (err: any) {
      setPoolMsg(`Load failed: ${err.message}`)
    } finally {
      setPoolLoading(false)
    }
  }, [])

  const handlePoolSave = async () => {
    if (Object.keys(poolEdits).length === 0) return
    setPoolSaving(true)
    setPoolMsg(null)
    try {
      const res = await fetch('/api/admin/pool/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poolEdits),
      })
      const d = await res.json()
      if (d.success) {
        setPoolMsg('Saved.')
        setPoolEdits({})
        await loadPool()
        setTimeout(() => setPoolMsg(null), 3000)
      } else {
        setPoolMsg(`Failed: ${d.error}`)
      }
    } catch (err: any) {
      setPoolMsg(`Error: ${err.message}`)
    } finally {
      setPoolSaving(false)
    }
  }

  // ── TEST ACCOUNTS ────────────────────────────────────────────
  const [excludedUsers, setExcludedUsers] = useState<ExcludedUser[]>([])
  const [allUsers, setAllUsers] = useState<AdminUser[]>([])
  const [testLoading, setTestLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [excludeBusy, setExcludeBusy] = useState<Set<string>>(new Set())
  const [testMsg, setTestMsg] = useState<string | null>(null)

  const loadTest = useCallback(async () => {
    setTestLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/users/exclude'),
        fetch('/api/admin/users'),
      ])
      const d1 = await r1.json()
      const d2 = await r2.json()
      if (d1.success) setExcludedUsers(d1.users)
      if (d2.success) setAllUsers(d2.users)
    } catch (err: any) {
      setTestMsg(`Load failed: ${err.message}`)
    } finally {
      setTestLoading(false)
    }
  }, [])

  const handleToggleExclude = async (clerkId: string, email: string, exclude: boolean) => {
    if (excludeBusy.has(clerkId)) return
    setExcludeBusy(prev => new Set(prev).add(clerkId))
    setTestMsg(null)
    try {
      const res = await fetch('/api/admin/users/exclude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId, exclude }),
      })
      const d = await res.json()
      if (d.success) {
        await loadTest()
        setTestMsg(exclude ? `Flagged ${email} as test account.` : `Removed ${email} from test accounts.`)
        setTimeout(() => setTestMsg(null), 3000)
      } else {
        setTestMsg(`Failed: ${d.error}`)
      }
    } catch (err: any) {
      setTestMsg(`Error: ${err.message}`)
    } finally {
      setExcludeBusy(prev => {
        const s = new Set(prev)
        s.delete(clerkId)
        return s
      })
    }
  }

  const excludedClerkIds = useMemo(
    () => new Set(excludedUsers.map(u => u.clerk_id)),
    [excludedUsers]
  )

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return allUsers
      .filter(u => !u.is_admin)               // admins are always excluded; no need to flag them
      .filter(u => !excludedClerkIds.has(u.clerk_id))  // already flagged — hide
      .filter(u =>
        u.email.toLowerCase().includes(q) ||
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q)
      )
      .slice(0, 20)
  }, [allUsers, searchQuery, excludedClerkIds])

  // ── FEATURE FLAGS ────────────────────────────────────────────
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [flagsLoading, setFlagsLoading] = useState(false)
  const [flagBusy, setFlagBusy] = useState<Set<string>>(new Set())

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true)
    try {
      const res = await fetch('/api/admin/feature-flags')
      const d = await res.json()
      if (d.success) setFlags(d.flags)
    } finally {
      setFlagsLoading(false)
    }
  }, [])

  const handleToggleFlag = async (key: string, enabled: boolean) => {
    if (flagBusy.has(key)) return
    setFlagBusy(prev => new Set(prev).add(key))

    // Optimistic update
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f))

    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      })
      const d = await res.json()
      if (!d.success) {
        // Revert
        setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !enabled } : f))
        alert(`Failed: ${d.error}`)
      }
    } catch (err: any) {
      setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !enabled } : f))
      alert(`Error: ${err.message}`)
    } finally {
      setFlagBusy(prev => {
        const s = new Set(prev)
        s.delete(key)
        return s
      })
    }
  }

  // ── TAB ACTIVATION + REFRESH ─────────────────────────────────
  useEffect(() => {
    if (activeTab === 'health' && !health) loadHealth()
    if (activeTab === 'pool' && !poolConfig) loadPool()
    if (activeTab === 'test' && allUsers.length === 0) loadTest()
    if (activeTab === 'flags' && flags.length === 0) loadFlags()
  }, [activeTab, health, poolConfig, allUsers.length, flags.length, loadHealth, loadPool, loadTest, loadFlags])

  useEffect(() => {
    if (activeTab !== 'health') return
    const id = setInterval(() => loadHealth(), 30_000)
    return () => clearInterval(id)
  }, [activeTab, loadHealth])

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <style>{`
        .stg-tabs {
          display: flex;
          gap: 2px;
          background: ${T.surface};
          border-bottom: 1px solid ${T.border};
          padding: 0 12px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .stg-tab {
          padding: 11px 16px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: ${T.muted};
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          font-family: 'Futura PT', sans-serif;
          cursor: pointer;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .stg-tab.active {
          color: ${T.blue};
          border-bottom-color: ${T.blue};
        }
        .stg-tab:hover:not(.active) { color: ${T.text}; }
        .stg-tab .icon { font-size: 11px; opacity: 0.8; }

        .stg-content { flex: 1; overflow-y: auto; padding: 20px; }
        .stg-section {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          margin-bottom: 16px;
          max-width: 920px;
        }
        .stg-section-header {
          padding: 12px 16px;
          background: ${T.dark};
          border-bottom: 1px solid ${T.border};
          color: ${T.blue};
          font-size: 11px;
          letter-spacing: 3px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .stg-section-body { padding: 16px; }
        .stg-section-desc {
          font-size: 11px;
          color: ${T.muted};
          letter-spacing: 0.5px;
          line-height: 1.6;
          margin-bottom: 14px;
        }
        .stg-field { margin-bottom: 14px; }
        .stg-field-label {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 4px;
          gap: 12px;
        }
        .stg-field-label .lbl {
          font-size: 9px;
          letter-spacing: 2px;
          color: ${T.muted};
          font-weight: bold;
        }
        .stg-field-label .help {
          font-size: 9px;
          color: ${T.muted};
          letter-spacing: 0.5px;
          text-align: right;
        }
        .stg-input {
          padding: 9px 12px;
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
        .stg-input:focus { border-color: ${T.blue}; }
        .stg-input.changed {
          border-color: ${T.amber};
          background: rgba(138,106,26,0.05);
        }
        .stg-btn {
          padding: 9px 16px;
          background: transparent;
          border: 1px solid ${T.blue};
          border-radius: 3px;
          color: ${T.blue};
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          font-family: 'Futura PT', sans-serif;
        }
        .stg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .stg-btn-primary { background: ${T.dark}; }
        .stg-btn-danger {
          border-color: ${T.red};
          color: ${T.red};
        }
        .stg-btn-danger:hover:not(:disabled) {
          background: ${T.red};
          color: white;
        }
        .stg-btn-success {
          border-color: ${T.green};
          color: ${T.green};
        }
        .stg-btn-success:hover:not(:disabled) {
          background: ${T.green};
          color: white;
        }
        .stg-pill {
          padding: 4px 10px;
          border-radius: 3px;
          font-size: 9px;
          letter-spacing: 1.5px;
          font-weight: bold;
          font-family: 'Futura PT', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .stg-pill.ok {
          background: rgba(26,106,26,0.1);
          color: ${T.green};
          border: 1px solid ${T.green};
        }
        .stg-pill.err {
          background: rgba(138,26,26,0.1);
          color: ${T.red};
          border: 1px solid ${T.red};
        }
        .stg-pill.warn {
          background: rgba(138,106,26,0.1);
          color: ${T.amber};
          border: 1px solid ${T.amber};
        }
        .stg-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .stg-dot.green { background: #32ff7e; box-shadow: 0 0 6px #32ff7e; }
        .stg-dot.red { background: #ff6464; }
        .stg-dot.amber { background: #ffbb55; }

        .stg-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 10px 12px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          margin-bottom: 6px;
        }
        .stg-row .row-main { min-width: 0; }
        .stg-row .row-title {
          font-family: monospace;
          font-size: 12px;
          font-weight: bold;
          color: ${T.text};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stg-row .row-sub {
          font-size: 10px;
          color: ${T.muted};
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        .stg-toggle {
          width: 40px;
          height: 22px;
          border-radius: 11px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
          border: none;
          padding: 0;
        }
        .stg-toggle.on { background: ${T.blue}; }
        .stg-toggle.off { background: #888a92; }
        .stg-toggle:disabled { opacity: 0.4; cursor: wait; }
        .stg-toggle-knob {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          position: absolute;
          top: 3px;
          transition: left 0.2s;
        }
        .stg-toggle.on .stg-toggle-knob { left: 21px; }
        .stg-toggle.off .stg-toggle-knob { left: 3px; }

        .stg-health-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .stg-health-card {
          padding: 14px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          border-top: 3px solid ${T.muted};
        }
        .stg-health-card.ok { border-top-color: ${T.green}; }
        .stg-health-card.err { border-top-color: ${T.red}; }
        .stg-health-card.warn { border-top-color: ${T.amber}; }
        .stg-health-svc {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .stg-health-svc-name {
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: bold;
          color: ${T.text};
        }
        .stg-health-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: ${T.muted};
          font-family: monospace;
          letter-spacing: 0.5px;
          padding: 3px 0;
        }
        .stg-health-row .v {
          color: ${T.text};
          font-weight: bold;
        }
        .stg-health-row .v.red { color: ${T.red}; }

        .stg-msg {
          padding: 8px 12px;
          border-radius: 3px;
          font-size: 11px;
          letter-spacing: 0.5px;
          margin-top: 12px;
        }
        .stg-msg.ok {
          background: rgba(26,106,26,0.08);
          border: 1px solid ${T.green};
          color: ${T.green};
        }
        .stg-msg.err {
          background: rgba(138,26,26,0.08);
          border: 1px solid ${T.red};
          color: ${T.red};
        }

        .stg-search-results {
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          max-height: 280px;
          overflow-y: auto;
          margin-top: 6px;
        }
        .stg-search-item {
          padding: 8px 12px;
          border-bottom: 1px solid ${T.border};
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          cursor: pointer;
        }
        .stg-search-item:last-child { border-bottom: none; }
        .stg-search-item:hover { background: ${T.surface}; }
      `}</style>

      {/* Header */}
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
          ADMIN SETTINGS
        </span>
      </div>

      {/* Tab bar */}
      <div className="stg-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`stg-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="stg-content">

        {/* ═════════ SYSTEM HEALTH ═════════ */}
        {activeTab === 'health' && (
          <div className="stg-section">
            <div className="stg-section-header">
              <span>▸ SYSTEM HEALTH</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {health && (
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
                    UPDATED {timeAgo(health.checkedAt)}
                  </span>
                )}
                <button
                  className="stg-btn"
                  onClick={loadHealth}
                  disabled={healthLoading}
                  style={{ padding: '5px 10px', fontSize: 9 }}
                >
                  {healthLoading ? '⟳ CHECKING...' : '⟳ REFRESH'}
                </button>
              </div>
            </div>
            <div className="stg-section-body">
              <p className="stg-section-desc">
                Live pings to Supabase, Stripe, and SignalWire. Auto-refreshes every 30s while
                this tab is open.
              </p>

              {healthError && (
                <div className="stg-msg err">⚠ {healthError}</div>
              )}

              {!health && !healthError && (
                <div style={{ padding: 30, textAlign: 'center', color: T.muted, fontSize: 11, letterSpacing: 2 }}>
                  LOADING HEALTH CHECKS...
                </div>
              )}

              {health && (
                <div className="stg-health-grid">
                  {/* Supabase */}
                  <div className={`stg-health-card ${health.supabase.ok ? 'ok' : 'err'}`}>
                    <div className="stg-health-svc">
                      <span className="stg-health-svc-name">SUPABASE</span>
                      <span className={`stg-pill ${health.supabase.ok ? 'ok' : 'err'}`}>
                        <span className={`stg-dot ${health.supabase.ok ? 'green' : 'red'}`} />
                        {health.supabase.ok ? 'OK' : 'DOWN'}
                      </span>
                    </div>
                    <div className="stg-health-row"><span>LATENCY</span><span className="v">{health.supabase.latencyMs}ms</span></div>
                    {health.supabase.error && (
                      <div className="stg-health-row"><span>ERROR</span><span className="v red" style={{ fontSize: 9 }}>{health.supabase.error.slice(0, 50)}</span></div>
                    )}
                  </div>

                  {/* Stripe */}
                  <div className={`stg-health-card ${health.stripe.ok ? 'ok' : 'err'}`}>
                    <div className="stg-health-svc">
                      <span className="stg-health-svc-name">STRIPE</span>
                      <span className={`stg-pill ${health.stripe.ok ? 'ok' : 'err'}`}>
                        <span className={`stg-dot ${health.stripe.ok ? 'green' : 'red'}`} />
                        {health.stripe.ok ? 'OK' : 'DOWN'}
                      </span>
                    </div>
                    <div className="stg-health-row"><span>LATENCY</span><span className="v">{health.stripe.latencyMs}ms</span></div>
                    <div className="stg-health-row"><span>AVAILABLE</span><span className="v">{formatMoney(health.stripe.availableCents, health.stripe.currency)}</span></div>
                    <div className="stg-health-row"><span>PENDING</span><span className="v">{formatMoney(health.stripe.pendingCents, health.stripe.currency)}</span></div>
                  </div>

                  {/* Stripe webhook activity */}
                  <div className={`stg-health-card ${health.stripeLastEvent.ok ? 'ok' : 'warn'}`}>
                    <div className="stg-health-svc">
                      <span className="stg-health-svc-name">STRIPE EVENTS</span>
                      <span className={`stg-pill ${health.stripeLastEvent.lastEventAt ? 'ok' : 'warn'}`}>
                        <span className={`stg-dot ${health.stripeLastEvent.lastEventAt ? 'green' : 'amber'}`} />
                        {health.stripeLastEvent.lastEventAt ? 'ACTIVE' : 'IDLE'}
                      </span>
                    </div>
                    <div className="stg-health-row">
                      <span>LAST EVENT</span>
                      <span className="v">{timeAgo(health.stripeLastEvent.lastEventAt)}</span>
                    </div>
                    <div className="stg-health-row">
                      <span>TYPE</span>
                      <span className="v" style={{ fontSize: 9 }}>{health.stripeLastEvent.type || '—'}</span>
                    </div>
                    <div className="stg-health-row">
                      <span>LAST SUB UPDATE</span>
                      <span className="v">{timeAgo(health.subscriptionActivity.lastSubUpdateAt)}</span>
                    </div>
                  </div>

                  {/* SignalWire */}
                  <div className={`stg-health-card ${health.signalwire.ok ? 'ok' : 'err'}`}>
                    <div className="stg-health-svc">
                      <span className="stg-health-svc-name">SIGNALWIRE</span>
                      <span className={`stg-pill ${health.signalwire.ok ? 'ok' : 'err'}`}>
                        <span className={`stg-dot ${health.signalwire.ok ? 'green' : 'red'}`} />
                        {health.signalwire.ok ? 'OK' : 'DOWN'}
                      </span>
                    </div>
                    <div className="stg-health-row"><span>LATENCY</span><span className="v">{health.signalwire.latencyMs}ms</span></div>
                    <div className="stg-health-row">
                      <span>BALANCE</span>
                      <span className="v">
                        {health.signalwire.balanceUsd !== null
                          ? `${health.signalwire.currency} $${health.signalwire.balanceUsd.toFixed(2)}`
                          : '—'}
                      </span>
                    </div>
                    {health.signalwire.error && (
                      <div className="stg-health-row"><span>ERROR</span><span className="v red" style={{ fontSize: 9 }}>{health.signalwire.error.slice(0, 50)}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════ POOL CONFIG ═════════ */}
        {activeTab === 'pool' && (
          <div className="stg-section">
            <div className="stg-section-header">▸ POOL CONFIGURATION</div>
            <div className="stg-section-body">
              <p className="stg-section-desc">
                Auto-buy logic for the dialer phone pool. Changes apply on the next cron run
                (top of every hour). Same fields as the modal on the admin numbers page —
                edit here for global config, there for in-context tweaks.
              </p>

              {poolLoading && !poolConfig && (
                <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 11, letterSpacing: 2 }}>
                  LOADING POOL CONFIG...
                </div>
              )}

              {poolConfig && (
                <>
                  {POOL_FIELDS.map(({ key, label, help, min, max }) => {
                    const editVal = poolEdits[key]
                    const current = editVal !== undefined
                      ? Number(editVal)
                      : Number(poolConfig[key])
                    const changed = editVal !== undefined && editVal !== poolConfig[key]
                    return (
                      <div key={key} className="stg-field">
                        <div className="stg-field-label">
                          <span className="lbl">{label}</span>
                          <span className="help">{help} · range {min}-{max}</span>
                        </div>
                        <input
                          className={`stg-input ${changed ? 'changed' : ''}`}
                          type="number"
                          min={min}
                          max={max}
                          value={current}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10)
                            setPoolEdits(prev => ({ ...prev, [key]: isNaN(v) ? 0 : v }))
                          }}
                          disabled={poolSaving}
                        />
                      </div>
                    )
                  })}

                  <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
                    <button
                      className="stg-btn stg-btn-primary"
                      onClick={handlePoolSave}
                      disabled={poolSaving || Object.keys(poolEdits).length === 0}
                    >
                      {poolSaving ? 'SAVING...' : `SAVE ${Object.keys(poolEdits).length || ''} CHANGE${Object.keys(poolEdits).length === 1 ? '' : 'S'}`}
                    </button>
                    {Object.keys(poolEdits).length > 0 && (
                      <button
                        className="stg-btn"
                        onClick={() => setPoolEdits({})}
                        disabled={poolSaving}
                      >
                        DISCARD
                      </button>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: T.muted, fontFamily: 'monospace', letterSpacing: 1 }}>
                      BUYS TODAY: {poolConfig.buys_today ?? 0}/{poolConfig.daily_buy_cap}
                    </span>
                  </div>

                  {poolMsg && (
                    <div className={`stg-msg ${poolMsg.toLowerCase().includes('saved') ? 'ok' : 'err'}`}>
                      {poolMsg}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ═════════ TEST ACCOUNTS ═════════ */}
        {activeTab === 'test' && (
          <div className="stg-section">
            <div className="stg-section-header">▸ TEST ACCOUNTS</div>
            <div className="stg-section-body">
              <p className="stg-section-desc">
                Users flagged here are excluded from all admin analytics — signups, MRR/WRR,
                heatmap, churn, cohort splits, the works. Admins are excluded automatically and
                don&apos;t need to be flagged. Use this for dev/test accounts you don&apos;t
                want polluting business metrics.
              </p>

              {/* Search to add */}
              <div className="stg-field">
                <div className="stg-field-label">
                  <span className="lbl">ADD TEST ACCOUNT</span>
                  <span className="help">Search by email or name</span>
                </div>
                <input
                  className="stg-input"
                  placeholder="Search users to flag..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  disabled={testLoading}
                />
                {searchQuery.trim() && searchResults.length > 0 && (
                  <div className="stg-search-results">
                    {searchResults.map(u => (
                      <div key={u.clerk_id} className="stg-search-item">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', color: T.text }}>
                            {`${u.first_name || ''} ${u.last_name || ''}`.trim() || '(no name)'}
                          </div>
                          <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{u.email}</div>
                        </div>
                        <button
                          className="stg-btn stg-btn-success"
                          style={{ padding: '6px 10px', fontSize: 9 }}
                          disabled={excludeBusy.has(u.clerk_id)}
                          onClick={() => handleToggleExclude(u.clerk_id, u.email, true)}
                        >
                          {excludeBusy.has(u.clerk_id) ? '...' : '+ FLAG'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.trim() && searchResults.length === 0 && !testLoading && (
                  <div style={{ marginTop: 6, padding: 10, fontSize: 10, color: T.muted, letterSpacing: 1, fontFamily: 'monospace' }}>
                    NO MATCHES (admins and already-flagged users are hidden)
                  </div>
                )}
              </div>

              {testMsg && (
                <div className={`stg-msg ${testMsg.toLowerCase().includes('fail') || testMsg.toLowerCase().includes('error') ? 'err' : 'ok'}`}>
                  {testMsg}
                </div>
              )}

              {/* Currently flagged */}
              <div style={{ marginTop: 18 }}>
                <div className="stg-field-label">
                  <span className="lbl">CURRENTLY FLAGGED ({excludedUsers.length})</span>
                  <span className="help">{testLoading ? 'LOADING...' : 'EXCLUDED FROM ALL METRICS'}</span>
                </div>

                {excludedUsers.length === 0 && !testLoading && (
                  <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: T.muted, letterSpacing: 2 }}>
                    NO TEST ACCOUNTS FLAGGED
                  </div>
                )}

                {excludedUsers.map(u => (
                  <div key={u.clerk_id} className="stg-row">
                    <div className="row-main">
                      <div className="row-title">
                        {`${u.first_name || ''} ${u.last_name || ''}`.trim() || '(no name)'}
                        {u.is_admin && (
                          <span style={{
                            marginLeft: 8, fontSize: 8, letterSpacing: 1.5, padding: '2px 6px',
                            background: 'rgba(74,158,255,0.12)', color: T.blue,
                            border: `1px solid ${T.blue}`, borderRadius: 2,
                          }}>ADMIN</span>
                        )}
                      </div>
                      <div className="row-sub">{u.email}</div>
                    </div>
                    <button
                      className="stg-btn stg-btn-danger"
                      style={{ padding: '6px 10px', fontSize: 9 }}
                      disabled={excludeBusy.has(u.clerk_id)}
                      onClick={() => handleToggleExclude(u.clerk_id, u.email, false)}
                    >
                      {excludeBusy.has(u.clerk_id) ? '...' : '✕ REMOVE'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═════════ FEATURE FLAGS ═════════ */}
        {activeTab === 'flags' && (
          <div className="stg-section">
            <div className="stg-section-header">▸ FEATURE FLAGS</div>
            <div className="stg-section-body">
              <p className="stg-section-desc">
                DB-backed runtime toggles. Read with{' '}
                <code style={{ background: T.bg, padding: '1px 4px', borderRadius: 2 }}>SELECT enabled FROM feature_flags WHERE key = ?</code>{' '}
                on the server; wire each flag into its code path as you build the gated feature.
                Changes are immediate — no redeploy needed.
              </p>

              {flagsLoading && flags.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: T.muted, fontSize: 11, letterSpacing: 2 }}>
                  LOADING FLAGS...
                </div>
              )}

              {flags.map(f => (
                <div key={f.key} className="stg-row">
                  <div className="row-main">
                    <div className="row-title" style={{ fontFamily: 'monospace' }}>{f.key}</div>
                    <div className="row-sub">{f.description}</div>
                    <div style={{ fontSize: 9, color: T.muted, marginTop: 3, letterSpacing: 0.5, fontFamily: 'monospace' }}>
                      UPDATED {timeAgo(f.updated_at)}
                    </div>
                  </div>
                  <button
                    className={`stg-toggle ${f.enabled ? 'on' : 'off'}`}
                    onClick={() => handleToggleFlag(f.key, !f.enabled)}
                    disabled={flagBusy.has(f.key)}
                    aria-label={`Toggle ${f.key}`}
                  >
                    <span className="stg-toggle-knob" />
                  </button>
                </div>
              ))}

              {flags.length === 0 && !flagsLoading && (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: T.muted, letterSpacing: 2 }}>
                  NO FLAGS DEFINED · RUN THE SETUP SQL TO SEED
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════ PRICING ═════════ */}
        {activeTab === 'pricing' && (
          <div className="stg-section">
            <div className="stg-section-header">▸ PRICING (READ-ONLY)</div>
            <div className="stg-section-body">
              <p className="stg-section-desc">
                Current pricing config. Live changes aren&apos;t possible from here — Stripe
                price IDs are env-bound and would require both a Stripe dashboard change and
                a redeploy. Eventually this becomes editable via a pricing config table.
              </p>

              <div className="stg-row">
                <div className="row-main">
                  <div className="row-title">WEEKLY PRICE</div>
                  <div className="row-sub">Per-seat subscription rate (hardcoded in app + Stripe)</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 'bold', color: T.text }}>
                  $35.00
                </div>
              </div>

              <div className="stg-row">
                <div className="row-main">
                  <div className="row-title">BILLING CYCLE</div>
                  <div className="row-sub">Stripe charges weekly via subscription</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: T.text }}>WEEKLY</div>
              </div>

              <div className="stg-row">
                <div className="row-main">
                  <div className="row-title">CURRENCY</div>
                  <div className="row-sub">Placeholder for international expansion</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: T.text }}>USD</div>
              </div>

              <div className="stg-row">
                <div className="row-main">
                  <div className="row-title">STRIPE PRICE ID</div>
                  <div className="row-sub">Env var STRIPE_PRICE_ID — change via Stripe dashboard + Vercel</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: T.muted }}>
                  price_1TT8Pi…hywAtFzK
                </div>
              </div>

              <div style={{
                marginTop: 16, padding: 12,
                background: '#fdf4e8', border: `1px solid ${T.amber}`, borderLeft: `3px solid ${T.amber}`,
                borderRadius: 3, fontSize: 11, color: T.amber, letterSpacing: 0.5, lineHeight: 1.6,
              }}>
                <strong>TO CHANGE PRICING:</strong>
                <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>Create new Price in Stripe Dashboard (Products → Prices)</li>
                  <li>Update <code>STRIPE_PRICE_ID</code> env var in Vercel</li>
                  <li>Redeploy</li>
                  <li>Existing subscribers stay on the old price until they resubscribe</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}