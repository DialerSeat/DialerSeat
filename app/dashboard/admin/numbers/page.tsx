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

export default function AdminNumbersPage() {
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'resting' | 'flagged'>('all')

  // Buy modal
  const [buyOpen, setBuyOpen] = useState(false)
  const [buyAreaCode, setBuyAreaCode] = useState('')
  const [buying, setBuying] = useState(false)
  const [buyMessage, setBuyMessage] = useState<string | null>(null)

  // Release confirm
  const [releaseConfirmId, setReleaseConfirmId] = useState<string | null>(null)
  const [releasing, setReleasing] = useState<string | null>(null)

  // Config edit
  const [configOpen, setConfigOpen] = useState(false)
  const [configEdits, setConfigEdits] = useState<Partial<PoolConfig>>({})
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMessage, setConfigMessage] = useState<string | null>(null)

  // Seed (one-time-ish)
  const [seedOpen, setSeedOpen] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMessage, setSeedMessage] = useState<string | null>(null)

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

  const handleBuy = async () => {
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
          max-width: 460px;
          width: 100%;
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
        }
        .pool-empty-cta {
          padding: 32px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          text-align: center;
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pool-btn" onClick={() => setConfigOpen(true)}>⚙ CONFIG</button>
          {poolEmpty && (
            <button className="pool-btn pool-btn-primary" onClick={() => setSeedOpen(true)}>
              ⚡ SEED 10 NUMBERS
            </button>
          )}
          <button className="pool-btn pool-btn-primary" onClick={() => setBuyOpen(true)}>+ BUY NOW</button>
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
              Click <strong>SEED 10 NUMBERS</strong> above to populate the pool with 10 numbers across major US metros.
              <br />Or use <strong>BUY NOW</strong> to add specific area codes one at a time.
            </div>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', letterSpacing: 1 }}>
              Each number costs ~$1/mo from SignalWire. 10 numbers = ~$10/mo.
            </div>
          </div>
        )}

        {/* Stats row */}
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

        {/* Growth meter */}
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

        {/* Filter pills */}
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

        {/* Numbers grid */}
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
        <div className="pool-modal-bg" onClick={() => !buying && setBuyOpen(false)}>
          <div className="pool-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', marginBottom: 12 }}>
              MANUAL BUY
            </div>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, marginBottom: 12 }}>
              Buys ONE number in the specified area code (3 digits, e.g. 212).
              Counts against daily buy cap ({config.buys_today}/{config.daily_buy_cap} used today).
            </div>
            <input
              className="pool-input"
              placeholder="Area code (e.g. 212)"
              value={buyAreaCode}
              onChange={e => setBuyAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
              maxLength={3}
              disabled={buying}
            />
            {buyMessage && (
              <div style={{
                fontSize: 10, color: buyMessage.startsWith('Bought') ? T.green : T.red,
                letterSpacing: 1, marginTop: 8,
              }}>{buyMessage}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="pool-btn pool-btn-primary" disabled={buying || buyAreaCode.length !== 3} onClick={handleBuy}>
                {buying ? 'BUYING...' : 'BUY'}
              </button>
              <button className="pool-btn" disabled={buying} onClick={() => { setBuyOpen(false); setBuyMessage(null); setBuyAreaCode('') }}>
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
              Idempotent — running twice won't double-buy.
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

            {([
              { key: 'max_pool_size', label: 'MAX POOL SIZE', help: 'Hard ceiling on total numbers (10-5000)' },
              { key: 'daily_buy_cap', label: 'DAILY BUY CAP', help: 'Max auto-buys per day (1-500)' },
              { key: 'utilization_trigger_pct', label: 'TRIGGER %', help: 'Buy when util reaches this % (30-99)' },
              { key: 'sustained_hours_required', label: 'SUSTAINED HOURS', help: 'Hours util must stay above trigger (1-24)' },
            ] as Array<{ key: keyof PoolConfig, label: string, help: string }>).map(({ key, label, help }) => {
              const current = configEdits[key] ?? config[key]
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
                    value={current as number}
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