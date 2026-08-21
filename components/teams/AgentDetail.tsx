'use client'

import { useEffect, useState, useCallback } from 'react'
import { LineChart } from './AnalyticsCharts'

const PANEL = 'var(--teams-panel, #232428)'
const HAIRLINE = 'var(--teams-border, #1a1b1e)'
const TEXT = 'var(--teams-text, #f2f3f5)'
const MUTED = 'var(--teams-muted, #949ba4)'
const DIM = 'var(--teams-muted, #80848e)'
const ACCENT = 'var(--teams-accent, #2563eb)'
const GREEN = '#4ade80'
const AMBER = '#fbbf24'

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const btn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${HAIRLINE}`,
  color: MUTED,
  borderRadius: 3,
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function dur(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function Stat({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
      padding: '12px 14px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
        color: MUTED, marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: accent || TEXT }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: DIM, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{
        fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
        color: MUTED, fontWeight: 600, marginBottom: 10,
      }}>{title}</div>
      {children}
    </section>
  )
}

export default function AgentDetail({
  userId, onBack, onManageMember,
}: {
  userId: string
  onBack: () => void
  onManageMember?: (memberId: string) => void
}) {
  const [range, setRange] = useState('week')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(
        `/api/teams/agent?userId=${encodeURIComponent(userId)}&range=${range}`
      ).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not load this agent')
      setData(r)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Could not load this agent')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [userId, range])

  useEffect(() => { void load() }, [load])

  if (loading && !data) {
    return <div style={{ color: DIM, fontSize: 13 }}>Loading…</div>
  }
  if (!data) {
    return (
      <div>
        <button style={btn} onClick={onBack}>← Back</button>
        <div style={{ color: '#ff6464', fontSize: 13, marginTop: 14 }}>{error}</div>
      </div>
    )
  }

  const a = data.agent
  const st = data.stats
  const live = data.liveNow

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <button style={btn} onClick={onBack}>← Back</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: TEXT }}>{a.name}</div>
          {a.email && a.email !== a.name && (
            <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>{a.email}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                ...btn,
                background: range === r.key ? ACCENT : 'transparent',
                borderColor: range === r.key ? ACCENT : HAIRLINE,
                color: range === r.key ? '#fff' : MUTED,
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {/* ── LIVE ─────────────────────────────────────────────────────────
          First, because during a shift it is the only question being asked.
          Absent rather than "offline" when they are not working — a green row
          appearing is information; a grey row saying nothing sits there every
          day and stops being read. */}
      {live && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: PANEL, border: `1px solid ${live.onCall ? GREEN : ACCENT}`,
          borderRadius: 4, padding: '11px 14px', marginBottom: 14,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: live.onCall ? GREEN : ACCENT, flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, color: TEXT }}>
            {live.onCall ? 'On a call now' : `Dialing now — ${live.state || 'ready'}`}
            {live.campaign && <span style={{ color: DIM }}> · {live.campaign}</span>}
            {live.mode && <span style={{ color: DIM }}> · {live.mode}</span>}
          </span>
        </div>
      )}

      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      }}>
        <Stat label="Calls" value={st.calls ? st.calls.toLocaleString() : '—'} sub={`last ${ago(st.lastCallAt)}`} />
        <Stat
          label="Contact rate"
          value={st.contactRate === null ? '—' : `${st.contactRate}%`}
          sub="reached a person"
        />
        <Stat
          label="Conversions"
          value={st.conversions ? String(st.conversions) : '—'}
          sub={st.conversionRate === null ? undefined : `${st.conversionRate}% of calls`}
          accent={st.conversions > 0 ? GREEN : undefined}
        />
        <Stat
          label="Talk time"
          value={dur(st.talkSeconds)}
          sub={st.avgTalkSeconds ? `avg ${dur(st.avgTalkSeconds)} /call` : 'avg — /call'}
        />
      </div>

      {/* ── WHAT THESE NUMBERS ARE, AND ARE NOT ──────────────────────────
          An agent may also dial their own leads on their own subscription.
          That work is not on a campaign this owner provided and not on a seat
          they are paying for — counting it would show an owner activity they
          have no claim to, and quietly inflate the figure they judge the seat
          by. Said out loud so nobody reads a low number as a slow agent when
          it may just be somebody who works elsewhere too. */}
      <div style={{ fontSize: 11.5, color: DIM, marginTop: 10, lineHeight: 1.7 }}>
        {st.scope}. Anything they dial on their own campaigns is not counted here.
      </div>

      <Section title={`Calls over the ${range === 'today' ? 'day' : range}`}>
        <div style={{
          background: PANEL, border: `1px solid ${HAIRLINE}`,
          borderRadius: 4, padding: '12px 14px 14px',
        }}>
          <LineChart points={data.series || []} />
        </div>
      </Section>

      <Section title="Seat">
        <div style={{ display: 'grid', gap: 8 }}>
          {data.memberships.map((m: any) => (
            <div key={m.memberId} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: PANEL,
              border: `1px solid ${m.suspended ? AMBER : HAIRLINE}`,
              borderRadius: 4, padding: '12px 14px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{m.teamName}</div>
                <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                  {m.status === 'pending'
                    ? 'Waiting on your approval'
                    : m.suspended
                    ? `Seat paused${m.suspendReason ? ` — ${m.suspendReason}` : ''}`
                    : m.pickedUp
                    ? 'You picked this seat up automatically'
                    : m.billingOverride === 'owner'
                    ? 'You pay this seat'
                    : m.billingOverride === 'agent'
                    ? 'Pays their own seat'
                    : 'Seat active'}
                  {m.joinedViaCode && (
                    <span style={{ color: '#5a6070' }}> · joined with {m.joinedViaCode}</span>
                  )}
                </div>
              </div>
              {onManageMember && (
                <button style={btn} onClick={() => onManageMember(m.memberId)}>Manage</button>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Campaigns they can dial">
        {data.campaigns.length === 0 ? (
          <div style={{ fontSize: 13, color: DIM, lineHeight: 1.7 }}>
            They are on your team but not on any campaign yet. Adding them costs
            nothing — their seat is already paid for.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {data.campaigns.map((c: any) => (
              <div key={c.campaignId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: PANEL, border: `1px solid ${HAIRLINE}`,
                borderRadius: 4, padding: '11px 14px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: c.status === 'inactive' ? DIM : TEXT }}>
                    {c.name}
                    {c.status === 'inactive' && (
                      <span style={{ color: AMBER, fontSize: 11, marginLeft: 8 }}>paused</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{c.teamName}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11.5, color: DIM }}>
                  <div style={{ color: TEXT, fontSize: 13 }}>
                    {c.calls ? c.calls.toLocaleString() : '—'}
                  </div>
                  <div>{c.conversions > 0 ? `${c.conversions} converted` : 'no conversions'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
