'use client'

import { useEffect, useState } from 'react'

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

type TabKey = 'health' | 'pool' | 'flags' | 'test' | 'pricing'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'health', label: 'SYSTEM HEALTH', icon: '🩺' },
  { key: 'pool', label: 'NUMBER POOL', icon: '☎️' },
  { key: 'flags', label: 'FEATURE FLAGS', icon: '🚩' },
  { key: 'test', label: 'TEST ACCOUNTS', icon: '🧪' },
  { key: 'pricing', label: 'PRICING', icon: '💵' },
]

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('health')

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
          ADMIN SETTINGS
        </span>
      </div>

      <div style={{
        display: 'flex',
        gap: 2,
        background: T.surface2,
        borderBottom: `1px solid ${T.border}`,
        overflowX: 'auto',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '14px 20px',
              background: activeTab === tab.key ? T.bg : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${T.blue}` : '2px solid transparent',
              fontSize: 11,
              fontWeight: 'bold',
              letterSpacing: 2,
              color: activeTab === tab.key ? T.text : T.muted,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 24 }}>
        {activeTab === 'health' && <SystemHealthSection />}
        {activeTab === 'pool' && <NumberPoolSection />}
        {activeTab === 'flags' && <FeatureFlagsSection />}
        {activeTab === 'test' && <TestAccountsSection />}
        {activeTab === 'pricing' && <PricingSection />}
      </div>
    </div>
  )
}

type HealthStatus = {
  ok?: boolean
  services?: {
    database?: { ok: boolean; latency_ms?: number; error?: string }
    stripe?: { ok: boolean; error?: string }
    signalwire?: { ok: boolean; error?: string }
    clerk?: { ok: boolean; error?: string }
  }
  counts?: {
    users_total?: number
    users_active?: number
    campaigns_active?: number
    calls_today?: number
  }
  last_cron?: string
}

function SystemHealthSection() {
  const [data, setData] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/system-health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  if (loading && !data) return <LoadingCard />
  if (error) return <ErrorCard error={error} retry={fetchHealth} />

  const services = data?.services ?? {}
  const counts = data?.counts ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader title="System Health" subtitle="Live status of platform services" onRefresh={fetchHealth} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        <ServiceStatusCard name="Database" ok={services.database?.ok} detail={services.database?.latency_ms ? `${services.database.latency_ms}ms` : services.database?.error} />
        <ServiceStatusCard name="Stripe API" ok={services.stripe?.ok} detail={services.stripe?.error} />
        <ServiceStatusCard name="SignalWire" ok={services.signalwire?.ok} detail={services.signalwire?.error} />
        <ServiceStatusCard name="Clerk Auth" ok={services.clerk?.ok} detail={services.clerk?.error} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginTop: 8,
      }}>
        <StatTile label="TOTAL USERS" value={counts.users_total ?? '—'} />
        <StatTile label="ACTIVE USERS" value={counts.users_active ?? '—'} />
        <StatTile label="ACTIVE CAMPAIGNS" value={counts.campaigns_active ?? '—'} />
        <StatTile label="CALLS TODAY" value={counts.calls_today ?? '—'} />
      </div>

      {data?.last_cron && (
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 4,
          padding: 16,
          fontSize: 11,
          letterSpacing: 1,
          color: T.muted,
        }}>
          LAST CRON RUN: <strong style={{ color: T.text }}>{new Date(data.last_cron).toLocaleString()}</strong>
        </div>
      )}
    </div>
  )
}

function ServiceStatusCard({ name, ok, detail }: { name: string; ok?: boolean; detail?: string }) {
  const status = ok === undefined ? 'unknown' : ok ? 'up' : 'down'
  const color = status === 'up' ? T.green : status === 'down' ? T.red : T.muted
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 4,
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 2, color: T.text }}>{name.toUpperCase()}</span>
        <span style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 2, color, padding: '2px 8px', background: 'rgba(0,0,0,0.04)', borderRadius: 3 }}>
          {status.toUpperCase()}
        </span>
      </div>
      {detail && <div style={{ fontSize: 11, color: T.muted, letterSpacing: 0.5 }}>{detail}</div>}
    </div>
  )
}

type PoolStatus = {
  pool_cap?: number
  in_pool?: number
  in_use?: number
  available?: number
  registered?: number
  unregistered?: number
}

function NumberPoolSection() {
  const [data, setData] = useState<PoolStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPool = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/pool/status')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPool()
  }, [])

  if (loading && !data) return <LoadingCard />
  if (error) return <ErrorCard error={error} retry={fetchPool} note="If /api/admin/pool/status does not exist yet, wire it up to return { pool_cap, in_pool, in_use, available, registered, unregistered }." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader title="Number Pool" subtitle="Outbound number allocation and registry status" onRefresh={fetchPool} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
      }}>
        <StatTile label="POOL CAP" value={data?.pool_cap ?? '—'} />
        <StatTile label="IN POOL" value={data?.in_pool ?? '—'} />
        <StatTile label="IN USE" value={data?.in_use ?? '—'} />
        <StatTile label="AVAILABLE" value={data?.available ?? '—'} />
        <StatTile label="REGISTERED" value={data?.registered ?? '—'} color={T.green} />
        <StatTile label="UNREGISTERED" value={data?.unregistered ?? '—'} color={T.amber} />
      </div>

      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        padding: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: T.text, marginBottom: 12 }}>
          REGISTRATION COST TRACKING
        </div>
        <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, margin: 0 }}>
          Per-number monthly upkeep tracking and cost graph not yet wired. To enable: add
          <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 3, margin: '0 4px' }}>monthly_cost</code>
          and
          <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 3, margin: '0 4px' }}>registered_at</code>
          columns to
          <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 3, margin: '0 4px' }}>phone_numbers</code>,
          create
          <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 3, margin: '0 4px' }}>/api/admin/numbers/costs</code>,
          then this section will render a month-over-month cost line graph.
        </p>
      </div>

      <a
        href="/dashboard/admin/numbers"
        style={{
          padding: '12px 20px',
          background: T.dark,
          color: 'white',
          fontSize: 11,
          fontWeight: 'bold',
          letterSpacing: 2,
          textDecoration: 'none',
          borderRadius: 4,
          textAlign: 'center',
        }}
      >
        MANAGE NUMBERS →
      </a>
    </div>
  )
}

type FeatureFlag = {
  key: string
  enabled: boolean
  description?: string
}

function FeatureFlagsSection() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchFlags = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/feature-flags')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setFlags(Array.isArray(json) ? json : (json.flags ?? []))
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const toggleFlag = async (key: string, current: boolean) => {
    setUpdating(key)
    const prev = flags
    setFlags(flags.map(f => f.key === key ? { ...f, enabled: !current } : f))
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled: !current }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e: any) {
      setFlags(prev)
      alert(`Failed to toggle ${key}: ${e?.message ?? 'unknown'}`)
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    fetchFlags()
  }, [])

  if (loading && flags.length === 0) return <LoadingCard />
  if (error && flags.length === 0) return <ErrorCard error={error} retry={fetchFlags} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader title="Feature Flags" subtitle="Toggle features on/off without redeploying" onRefresh={fetchFlags} />

      {flags.length === 0 ? (
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 4,
          padding: 24,
          textAlign: 'center',
          color: T.muted,
          fontSize: 13,
        }}>
          No feature flags defined yet. Insert rows into the <code>feature_flags</code> table to manage them here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flags.map((flag) => (
            <div
              key={flag.key}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderLeft: `4px solid ${flag.enabled ? T.green : T.muted}`,
                borderRadius: 4,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: T.text, marginBottom: 4 }}>
                  {flag.key}
                </div>
                {flag.description && (
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                    {flag.description}
                  </div>
                )}
              </div>
              <ToggleSwitch
                enabled={flag.enabled}
                onChange={() => toggleFlag(flag.key, flag.enabled)}
                disabled={updating === flag.key}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type ExcludedUser = {
  id: string
  email?: string
  first_name?: string
  last_name?: string
  exclude_from_analytics: boolean
  created_at?: string
}

function TestAccountsSection() {
  const [users, setUsers] = useState<ExcludedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const list: ExcludedUser[] = Array.isArray(json) ? json : (json.users ?? [])
      setUsers(list)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const toggleExclude = async (userId: string, current: boolean) => {
    setUpdating(userId)
    const prev = users
    setUsers(users.map(u => u.id === userId ? { ...u, exclude_from_analytics: !current } : u))
    try {
      const res = await fetch('/api/admin/users/exclude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, excluded: !current }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e: any) {
      setUsers(prev)
      alert(`Failed to update: ${e?.message ?? 'unknown'}`)
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filtered = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (u.email?.toLowerCase().includes(q) || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q))
  })

  const excludedCount = users.filter(u => u.exclude_from_analytics).length

  if (loading && users.length === 0) return <LoadingCard />
  if (error && users.length === 0) return <ErrorCard error={error} retry={fetchUsers} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        title="Test Accounts"
        subtitle={`${excludedCount} of ${users.length} users excluded from analytics`}
        onRefresh={fetchUsers}
      />

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by email or name..."
        style={{
          padding: '10px 14px',
          fontSize: 13,
          border: `1px solid ${T.border}`,
          borderRadius: 4,
          background: 'white',
          color: T.text,
          fontFamily: 'inherit',
          letterSpacing: 0.5,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            padding: 24,
            textAlign: 'center',
            color: T.muted,
            fontSize: 13,
          }}>
            {search ? 'No users match.' : 'No users yet.'}
          </div>
        ) : filtered.map((u) => (
          <div
            key={u.id}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderLeft: `4px solid ${u.exclude_from_analytics ? T.amber : T.border}`,
              borderRadius: 4,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: T.text, letterSpacing: 0.5 }}>
                {u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '(no name)'}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{u.email ?? u.id}</div>
            </div>
            {u.exclude_from_analytics && (
              <span style={{
                fontSize: 9,
                letterSpacing: 1.5,
                fontWeight: 'bold',
                color: T.amber,
                padding: '3px 8px',
                background: 'rgba(138,106,26,0.1)',
                borderRadius: 3,
              }}>
                EXCLUDED
              </span>
            )}
            <ToggleSwitch
              enabled={u.exclude_from_analytics}
              onChange={() => toggleExclude(u.id, u.exclude_from_analytics)}
              disabled={updating === u.id}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PricingSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader title="Pricing" subtitle="Current Stripe configuration (read-only)" />

      <div style={{
        background: T.surface,
        border: `1px solid ${T.blue}`,
        borderRadius: 4,
        padding: 28,
        display: 'flex',
        alignItems: 'baseline',
        gap: 16,
      }}>
        <span style={{ fontSize: 48, fontWeight: 'bold', color: T.text, letterSpacing: -1 }}>$35</span>
        <span style={{ fontSize: 14, color: T.muted, letterSpacing: 1 }}>per seat / week (≈ $140/month)</span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        <StatTile label="BILLING INTERVAL" value="WEEK" />
        <StatTile label="CURRENCY" value="USD" />
        <StatTile label="TRIAL" value="NONE" />
        <StatTile label="ANNUAL CONTRACT" value="NO" />
      </div>

      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        padding: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: T.text, marginBottom: 12 }}>
          ACTIVE COUPONS
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: T.text }}>
          <li style={{ padding: '8px 0', borderBottom: `1px dashed ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>owner_free</strong> — 100% off forever</span>
            <span style={{ color: T.green, fontSize: 11, letterSpacing: 1 }}>ACTIVE</span>
          </li>
          <li style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>JC_FOUNDER</strong> — founder discount</span>
            <span style={{ color: T.muted, fontSize: 11, letterSpacing: 1 }}>PENDING</span>
          </li>
        </ul>
      </div>

      <p style={{ fontSize: 11, color: T.muted, letterSpacing: 1, lineHeight: 1.6, margin: 0 }}>
        Pricing changes must be made in the Stripe dashboard. Update
        <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 3, margin: '0 4px' }}>STRIPE_PRICE_ID</code>
        env var in Vercel after creating a new price. Customer migration to a new price requires updating active subscriptions via the Stripe API.
      </p>
    </div>
  )
}

function SectionHeader({ title, subtitle, onRefresh }: { title: string; subtitle?: string; onRefresh?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 'bold', color: T.text, margin: 0, letterSpacing: -0.5 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 12, color: T.muted, margin: '4px 0 0 0', letterSpacing: 0.5 }}>{subtitle}</p>}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          style={{
            padding: '8px 14px',
            background: 'transparent',
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            fontSize: 10,
            letterSpacing: 2,
            color: T.muted,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 'bold',
          }}
        >
          ↻ REFRESH
        </button>
      )}
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 4,
      padding: 16,
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: T.muted, marginBottom: 6, fontWeight: 'bold' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 'bold', color: color ?? T.text, letterSpacing: -0.5 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: enabled ? T.blue : T.border,
        border: 'none',
        cursor: disabled ? 'wait' : 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
      aria-pressed={enabled}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: enabled ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  )
}

function LoadingCard() {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 4,
      padding: 40,
      textAlign: 'center',
      color: T.muted,
      fontSize: 13,
      letterSpacing: 1,
    }}>
      LOADING...
    </div>
  )
}

function ErrorCard({ error, retry, note }: { error: string; retry: () => void; note?: string }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.red}`,
      borderLeft: `4px solid ${T.red}`,
      borderRadius: 4,
      padding: 24,
    }}>
      <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: T.red, marginBottom: 8 }}>
        ERROR
      </div>
      <div style={{ fontSize: 13, color: T.text, marginBottom: 12 }}>{error}</div>
      {note && (
        <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, marginBottom: 12 }}>{note}</div>
      )}
      <button
        onClick={retry}
        style={{
          padding: '8px 16px',
          background: T.dark,
          color: 'white',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          letterSpacing: 2,
          fontWeight: 'bold',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        RETRY
      </button>
    </div>
  )
}