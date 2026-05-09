'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

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

type DialerMode = 'preview' | 'power' | 'progressive' | 'predictive'
type ComplianceStatus = 'safe' | 'caution' | 'degraded'

interface Campaign {
  id: string
  name: string
  status: string
  total_leads: number
  called_leads: number
  dialer_mode?: DialerMode
}

interface ComplianceData {
  campaign: { id: string; name: string; dialerMode: DialerMode }
  compliance: {
    abandonRate30d: number
    abandonedCalls: number
    answeredCalls: number
    legalCap: number
    autoThrottleAt: number
    autoRecoverAt: number
    status: ComplianceStatus
    statusMessage: string
  }
  amdBreakdown: Record<string, number>
  windowDays: number
}

export default function CompliancePage() {
  const { user } = useUser()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [statsByCampaign, setStatsByCampaign] = useState<Record<string, ComplianceData>>({})
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState<Record<string, boolean>>({})
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [exportRange, setExportRange] = useState<{ campaignId: string; days: number } | null>(null)

  const loadCampaigns = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/list?user_id=${user.id}`)
      const data = await res.json()
      if (data.success) {
        setCampaigns(data.campaigns)
      }
    } catch (err) {
      console.error('Load campaigns error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadStats = useCallback(async (campaignId: string) => {
    setStatsLoading(prev => ({ ...prev, [campaignId]: true }))
    try {
      const res = await fetch(`/api/campaigns/compliance-stats?campaignId=${campaignId}`)
      const data = await res.json()
      if (data.success) {
        setStatsByCampaign(prev => ({ ...prev, [campaignId]: data }))
      }
    } catch (err) {
      console.error('Load stats error:', err)
    } finally {
      setStatsLoading(prev => ({ ...prev, [campaignId]: false }))
    }
  }, [])

  useEffect(() => {
    if (user) loadCampaigns()
  }, [user, loadCampaigns])

  // Auto-load stats for all campaigns once they're loaded
  useEffect(() => {
    if (campaigns.length === 0) return
    campaigns.forEach(c => loadStats(c.id))
  }, [campaigns, loadStats])

  const handleExport = async (campaignId: string, days: number) => {
    setExportingId(campaignId)
    try {
      const endDate = new Date().toISOString()
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      const url = `/api/campaigns/compliance-export?campaignId=${campaignId}&startDate=${startDate}&endDate=${endDate}`
      // Trigger browser download via anchor click
      const a = document.createElement('a')
      a.href = url
      a.download = ''
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setExportRange(null)
    } finally {
      setTimeout(() => setExportingId(null), 800)
    }
  }

  // Platform-wide aggregates
  const totalAnswered = Object.values(statsByCampaign).reduce((sum, d) => sum + d.compliance.answeredCalls, 0)
  const totalAbandoned = Object.values(statsByCampaign).reduce((sum, d) => sum + d.compliance.abandonedCalls, 0)
  const platformAbandonRate = totalAnswered > 0 ? totalAbandoned / totalAnswered : 0
  const degradedCount = Object.values(statsByCampaign).filter(d => d.compliance.status === 'degraded').length
  const cautionCount = Object.values(statsByCampaign).filter(d => d.compliance.status === 'caution').length

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      {/* HEADER */}
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            🛡 COMPLIANCE
          </span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
            {campaigns.length} CAMPAIGN{campaigns.length === 1 ? '' : 'S'} · 30-DAY WINDOW
          </span>
        </div>
        <Link
          href="/dialing-modes"
          target="_blank"
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${T.blue}`,
            borderRadius: 3,
            color: T.blue,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 'bold',
            textDecoration: 'none',
          }}
        >📖 METHODOLOGY</Link>
      </div>

      <div style={{
        flex: 1, padding: '16px 20px',
        maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>

        {/* CONTEXT BAR — what is this page */}
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${T.accent}`,
          borderRadius: 4,
          padding: '14px 18px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, lineHeight: 1.6, color: T.text }}>
            <strong style={{ color: T.accent, letterSpacing: 1 }}>About this page:</strong> Live monitoring of FTC TSR § 310.4(b)(4) safe-harbor compliance for every campaign you own. Abandon rates calculated over a rolling 30-day window per campaign, per FTC requirements.{' '}
            <Link href="/dialing-modes" target="_blank" style={{ color: T.blue, fontWeight: 'bold' }}>
              Read full methodology →
            </Link>
          </div>
        </div>

        {/* PLATFORM TOTALS */}
        {!loading && Object.keys(statsByCampaign).length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10, marginBottom: 18,
          }}>
            <PlatformStat
              label="ANSWERED CALLS (30D)"
              value={totalAnswered.toLocaleString()}
              accent={T.accent}
            />
            <PlatformStat
              label="ABANDONED CALLS"
              value={totalAbandoned.toLocaleString()}
              accent={totalAbandoned > 0 ? T.amber : T.green}
            />
            <PlatformStat
              label="PORTFOLIO ABANDON RATE"
              value={`${(platformAbandonRate * 100).toFixed(2)}%`}
              accent={
                platformAbandonRate >= 0.025 ? T.red :
                platformAbandonRate >= 0.020 ? T.amber : T.green
              }
            />
            <PlatformStat
              label="STATUS"
              value={degradedCount > 0 ? `${degradedCount} DEGRADED` : cautionCount > 0 ? `${cautionCount} CAUTION` : 'ALL SAFE'}
              accent={degradedCount > 0 ? T.red : cautionCount > 0 ? T.amber : T.green}
            />
          </div>
        )}

        {/* LEGAL THRESHOLDS REFERENCE */}
        <div style={{
          background: T.dark,
          color: '#c0c2ca',
          borderRadius: 4,
          padding: '12px 16px',
          marginBottom: 18,
          fontSize: 11,
          letterSpacing: 0.3,
          lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: '#8888aa', fontWeight: 'bold', marginBottom: 6 }}>
            ▸ LEGAL THRESHOLDS · FTC TSR § 310.4(b)(4)
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <span><strong style={{ color: T.green }}>0.0% – 1.9%</strong> · Safe</span>
            <span><strong style={{ color: T.amber }}>2.0% – 2.4%</strong> · Caution (auto-throttle pending)</span>
            <span><strong style={{ color: T.red }}>2.5% +</strong> · Auto-degraded to 1× lines</span>
            <span><strong style={{ color: '#ff6464' }}>3.0% +</strong> · Legal violation</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
            LOADING CAMPAIGNS...
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{
            background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 4,
            padding: '32px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🛡</div>
            <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: T.muted, marginBottom: 6 }}>
              NO CAMPAIGNS YET
            </div>
            <div style={{ fontSize: 12, color: T.muted, letterSpacing: 0.5 }}>
              Create a campaign to start tracking compliance metrics.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campaigns.map(campaign => {
              const stats = statsByCampaign[campaign.id]
              const isLoadingStats = statsLoading[campaign.id]
              const isExporting = exportingId === campaign.id
              const mode = (campaign.dialer_mode || 'power') as DialerMode

              return (
                <CampaignComplianceCard
                  key={campaign.id}
                  campaign={campaign}
                  mode={mode}
                  stats={stats}
                  isLoadingStats={isLoadingStats}
                  isExporting={isExporting}
                  exportRangeOpen={exportRange?.campaignId === campaign.id}
                  onOpenExport={() => setExportRange({ campaignId: campaign.id, days: 30 })}
                  onCloseExport={() => setExportRange(null)}
                  onExport={(days) => handleExport(campaign.id, days)}
                  onRefresh={() => loadStats(campaign.id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Campaign Card ──────────────────────────────────────────────────────────

interface CardProps {
  campaign: Campaign
  mode: DialerMode
  stats: ComplianceData | undefined
  isLoadingStats: boolean
  isExporting: boolean
  exportRangeOpen: boolean
  onOpenExport: () => void
  onCloseExport: () => void
  onExport: (days: number) => void
  onRefresh: () => void
}

function CampaignComplianceCard({
  campaign, mode, stats, isLoadingStats, isExporting,
  exportRangeOpen, onOpenExport, onCloseExport, onExport, onRefresh,
}: CardProps) {
  const c = stats?.compliance
  const status = c?.status || 'safe'
  const rate = c?.abandonRate30d || 0

  const statusColor =
    status === 'degraded' ? T.red :
    status === 'caution' ? T.amber : T.green

  const modeColor =
    mode === 'predictive' ? T.red :
    mode === 'progressive' ? T.green :
    mode === 'preview' ? T.muted : T.accent

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      {/* HEADER ROW */}
      <div style={{
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        borderBottom: `1px solid ${T.border}`,
        background: '#dde0e8',
      }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4,
          }}>
            <h3 style={{
              fontSize: 14, fontWeight: 'bold', letterSpacing: 1, color: T.text,
              margin: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{campaign.name}</h3>
            <span style={{
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5,
              color: modeColor,
              border: `1px solid ${modeColor}`,
              fontFamily: 'monospace',
            }}>{mode.toUpperCase()}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 3,
              fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5,
              color: statusColor,
              background: `${statusColor}15`,
              border: `1px solid ${statusColor}`,
              fontFamily: 'monospace',
            }}>
              {status === 'degraded' ? '⚠ DEGRADED' : status === 'caution' ? '⚠ CAUTION' : '● SAFE'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', letterSpacing: 0.5 }}>
            {campaign.called_leads.toLocaleString()} of {campaign.total_leads.toLocaleString()} leads called
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onRefresh}
            disabled={isLoadingStats}
            style={{
              padding: '6px 12px', borderRadius: 3,
              background: 'transparent', border: `1px solid ${T.border}`,
              color: T.muted, fontSize: 10, letterSpacing: 2,
              fontWeight: 'bold', cursor: isLoadingStats ? 'not-allowed' : 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
              opacity: isLoadingStats ? 0.5 : 1,
            }}
          >{isLoadingStats ? '...' : '↻ REFRESH'}</button>
          <button
            onClick={onOpenExport}
            disabled={isExporting}
            style={{
              padding: '6px 12px', borderRadius: 3,
              background: T.dark, border: 'none',
              borderTop: `2px solid ${T.blue}`,
              color: T.blue, fontSize: 10, letterSpacing: 2,
              fontWeight: 'bold', cursor: isExporting ? 'not-allowed' : 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
              opacity: isExporting ? 0.5 : 1,
            }}
          >{isExporting ? '...' : '⬇ EXPORT CSV'}</button>
        </div>
      </div>

      {/* BODY */}
      {isLoadingStats && !stats ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
          LOADING STATS...
        </div>
      ) : !stats || !c ? (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 11, letterSpacing: 2, color: T.muted }}>
          No data available
        </div>
      ) : (
        <>
          {/* STATUS MESSAGE BANNER (if not safe) */}
          {status !== 'safe' && (
            <div style={{
              padding: '10px 18px',
              background: status === 'degraded' ? '#f8e8e8' : '#fdf4e8',
              borderBottom: `1px solid ${T.border}`,
              fontSize: 11,
              color: statusColor,
              fontWeight: 'bold',
              letterSpacing: 0.5,
            }}>
              {status === 'degraded' ? '⚠ ' : '⚠ '}{c.statusMessage}
            </div>
          )}

          {/* METRICS GRID */}
          <div style={{
            padding: '14px 18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}>
            <Metric
              label="30D ABANDON RATE"
              value={`${(rate * 100).toFixed(2)}%`}
              accent={statusColor}
              fineprint={`Cap: ${(c.legalCap * 100).toFixed(1)}% · Throttle: ${(c.autoThrottleAt * 100).toFixed(1)}%`}
            />
            <Metric
              label="ABANDONED"
              value={c.abandonedCalls.toLocaleString()}
              accent={c.abandonedCalls > 0 ? T.amber : T.green}
            />
            <Metric
              label="ANSWERED"
              value={c.answeredCalls.toLocaleString()}
              accent={T.accent}
            />
            <Metric
              label="MODE"
              value={mode.toUpperCase()}
              accent={modeColor}
            />
          </div>

          {/* AMD BREAKDOWN */}
          {Object.keys(stats.amdBreakdown).length > 0 && (
            <div style={{
              padding: '0 18px 14px',
            }}>
              <div style={{
                fontSize: 9, letterSpacing: 3, color: T.muted, fontWeight: 'bold', marginBottom: 8,
              }}>▸ AMD BREAKDOWN (30D)</div>
              <div style={{
                display: 'flex', gap: 6, flexWrap: 'wrap',
              }}>
                {Object.entries(stats.amdBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, count]) => (
                    <AmdChip key={key} label={key} count={count} />
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* EXPORT RANGE PICKER */}
      {exportRangeOpen && (
        <div style={{
          padding: '14px 18px',
          borderTop: `1px solid ${T.border}`,
          background: T.bg,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>
            EXPORT WINDOW:
          </div>
          {[7, 30, 90, 365].map(days => (
            <button
              key={days}
              onClick={() => onExport(days)}
              style={{
                padding: '6px 12px', borderRadius: 3,
                background: T.surface, border: `1px solid ${T.border}`,
                color: T.text, fontSize: 10, letterSpacing: 1.5,
                fontWeight: 'bold', cursor: 'pointer',
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}
            >LAST {days} DAYS</button>
          ))}
          <button
            onClick={onCloseExport}
            style={{
              padding: '6px 12px', borderRadius: 3,
              background: 'transparent', border: 'none',
              color: T.muted, fontSize: 10, letterSpacing: 1.5,
              cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
              marginLeft: 'auto',
            }}
          >CANCEL</button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function PlatformStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `3px solid ${accent}`, borderRadius: 3,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontWeight: 'bold', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 'bold', color: accent, lineHeight: 1, fontFamily: 'monospace',
      }}>{value}</div>
    </div>
  )
}

function Metric({ label, value, accent, fineprint }: {
  label: string; value: string; accent: string; fineprint?: string
}) {
  return (
    <div style={{
      padding: '10px 12px', background: T.bg,
      border: `1px solid ${T.border}`, borderRadius: 3,
    }}>
      <div style={{
        fontSize: 8, letterSpacing: 2, color: T.muted, fontWeight: 'bold', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 'bold', fontFamily: 'monospace',
        color: accent, lineHeight: 1.1,
      }}>{value}</div>
      {fineprint && (
        <div style={{
          fontSize: 8, color: T.muted, fontFamily: 'monospace',
          letterSpacing: 0.5, marginTop: 4,
        }}>{fineprint}</div>
      )}
    </div>
  )
}

function AmdChip({ label, count }: { label: string; count: number }) {
  const isHuman = label === 'human'
  const isMachine = label.startsWith('machine_')
  const color = isHuman ? T.green : isMachine ? T.amber : T.muted
  return (
    <div style={{
      padding: '4px 10px',
      background: T.bg,
      border: `1px solid ${color}`,
      borderRadius: 3,
      fontSize: 10,
      fontFamily: 'monospace',
      color: color,
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontWeight: 'bold' }}>{count.toLocaleString()}</span>
    </div>
  )
}