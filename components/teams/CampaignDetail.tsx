'use client'

import { useEffect, useState, useCallback } from 'react'

const PANEL = '#232428'
const HAIRLINE = '#1a1b1e'
const TEXT = '#f2f3f5'
const MUTED = '#949ba4'
const DIM = '#80848e'
const ACCENT = '#2563eb'

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

const DIALER_MODES = ['preview', 'power', 'progressive', 'predictive'] as const

interface CampaignDetailData {
  id: string
  name: string
  status: string
  dialerMode: string
  totalLeads: number
  calledLeads: number
  remainingLeads: number
  amdEnabled: boolean
  recordingEnabled: boolean
  predictiveLines: number | null
  maskLeadNumbers: boolean
  agentPicksMode: boolean
  createdAt: string
}

interface AgentRow {
  accessId: string
  memberId: string
  userId: string | null
  name: string
  email: string | null
  payer: string | null
  suspended: boolean
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
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
    </div>
  )
}

function Section({ title, action, children }: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
          color: MUTED, fontWeight: 600,
        }}>{title}</div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * A toggle that says what it controls, not just that it is on.
 *
 * Every setting here changes how somebody's calls behave or who can see a lead
 * list. A bare switch labelled "Masking" makes an owner guess; the consequence
 * is written out so nobody has to test it on a live campaign to find out.
 */
function Toggle({ label, hint, on, busy, onChange }: {
  label: string
  hint: string
  on: boolean
  busy: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
      padding: '12px 14px', cursor: busy ? 'wait' : 'pointer',
      opacity: busy ? 0.6 : 1,
    }}>
      <input
        type="checkbox"
        checked={on}
        disabled={busy}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: ACCENT, marginTop: 2, cursor: busy ? 'wait' : 'pointer' }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, color: TEXT }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: DIM, marginTop: 3, lineHeight: 1.6 }}>
          {hint}
        </span>
      </span>
    </label>
  )
}

export default function CampaignDetail({
  campaignId,
  onBack,
  onChanged,
}: {
  campaignId: string
  onBack: () => void
  onChanged?: () => void
}) {
  const [data, setData] = useState<CampaignDetailData | null>(null)
  const [team, setTeam] = useState<{ id: string; name: string; accessMode: string | null } | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/teams/campaigns/detail?campaignId=${encodeURIComponent(campaignId)}`)
        .then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not load campaign')
      setData(r.campaign)
      setTeam(r.team)
      setAgents(r.agents || [])
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Could not load campaign')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  // Errors clear themselves. A stale failure sitting over the panel long after
  // it stopped being true is worse than no message at all.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 7000)
    return () => clearTimeout(t)
  }, [error])

  const patch = async (fields: Record<string, any>) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaignId, ...fields }),
      }).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not save')
      await load()
      onChanged?.()
    } catch (e: any) {
      setError(e.message || 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const removeAgent = async (memberId: string) => {
    if (busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/teams/access/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, campaignId }),
      }).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not remove access')
      await load()
      onChanged?.()
    } catch (e: any) {
      setError(e.message || 'Could not remove access')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return <div style={{ color: DIM, fontSize: 13 }}>Loading campaign…</div>
  }

  if (!data) {
    return (
      <div>
        <button style={btn} onClick={onBack}>← Back</button>
        <div style={{ color: '#ff6464', fontSize: 13, marginTop: 14 }}>
          {error || 'Campaign not available.'}
        </div>
      </div>
    )
  }

  const paused = data.status === 'inactive'
  const pct = data.totalLeads > 0
    ? Math.round((data.calledLeads / data.totalLeads) * 100)
    : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button style={btn} onClick={onBack}>← Back</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: TEXT }}>
            {data.name}
            {paused && (
              <span style={{ color: '#fbbf24', fontSize: 12, marginLeft: 10 }}>paused</span>
            )}
          </div>
          {team && (
            <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>on {team.name}</div>
          )}
        </div>
        {/* One click, no dialog — pausing is reversible and something an owner
            does between calls. The label states what will happen, not what is
            true now. */}
        <button
          style={{ ...btn, color: paused ? '#4ade80' : '#fbbf24' }}
          disabled={busy}
          onClick={() => patch({ status: paused ? 'active' : 'inactive' })}
        >{paused ? 'Activate' : 'Pause'}</button>
        <a
          href={`/dashboard/dialer?campaign=${encodeURIComponent(data.id)}`}
          style={{ ...btn, textDecoration: 'none', borderColor: ACCENT, color: '#fff', background: ACCENT }}
        >Dial</a>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#ff6464', marginBottom: 12 }}>{error}</div>
      )}

      <div style={{
        display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      }}>
        <Stat label="Agents" value={String(agents.length)} />
        <Stat label="Total Leads" value={data.totalLeads ? data.totalLeads.toLocaleString() : '—'} />
        <Stat label="Dialed" value={data.calledLeads ? data.calledLeads.toLocaleString() : '—'} />
        <Stat
          label="Remaining"
          value={data.remainingLeads ? data.remainingLeads.toLocaleString() : '—'}
          accent={data.totalLeads > 0 && data.remainingLeads === 0 ? '#fbbf24' : undefined}
        />
      </div>

      {data.totalLeads > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            height: 4, background: HAIRLINE, borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{ width: `${pct}%`, height: '100%', background: ACCENT }} />
          </div>
          <div style={{ fontSize: 11, color: DIM, marginTop: 5 }}>
            {pct}% dialed
            {data.remainingLeads === 0 && ' — this list is finished. Add leads or pause it.'}
          </div>
        </div>
      )}

      <Section
        title="Leads"
        action={
          <a
            href={`/dashboard/campaigns?edit=${encodeURIComponent(data.id)}`}
            style={{ ...btn, textDecoration: 'none' }}
          >Manage campaign</a>
        }
      >
        <div style={{ color: DIM, fontSize: 12.5, lineHeight: 1.7 }}>
          {data.remainingLeads === 0 && data.totalLeads > 0
            ? 'Every lead here has been dialed. Adding a fresh list starts the queue again without touching call history.'
            : `${data.remainingLeads.toLocaleString()} left to dial.`}
        </div>
      </Section>

      <Section title="How It Dials">
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ flex: 1, fontSize: 13.5, color: TEXT }}>Dialer mode</span>
            <select
              value={data.dialerMode}
              disabled={busy}
              onChange={e => patch({ dialer_mode: e.target.value })}
              style={{
                background: '#0d0f13', color: TEXT, fontSize: 12,
                border: `1px solid ${HAIRLINE}`, borderRadius: 3,
                padding: '6px 8px', fontFamily: 'inherit',
              }}
            >
              {DIALER_MODES.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* A separate flag rather than a fifth mode. The stored mode drives
              AMD, number pooling and the abandonment rules on the call path —
              a value meaning "ask the browser" would hand a compliance decision
              to the client. This lets the agent pick their own workflow on top
              of a mode that still governs the call. */}
          <Toggle
            label="Let the agent choose their own mode"
            hint={`Agents can switch between preview, power, progressive and predictive on this campaign. ${data.dialerMode} stays the default they start on, and still governs answering-machine detection and compliance.`}
            on={data.agentPicksMode}
            busy={busy}
            onChange={v => patch({ agent_picks_mode: v })}
          />

          <Toggle
            label="Answering machine detection"
            hint="Holds the line briefly to work out whether a person or a machine picked up, then drops voicemails back into the queue instead of burning an agent on them."
            on={data.amdEnabled}
            busy={busy}
            onChange={v => patch({ amd_enabled: v })}
          />

          <Toggle
            label="Record calls"
            hint="Stores audio for every connected call on this campaign. Check your own obligations before turning this on — consent rules vary by state."
            on={data.recordingEnabled}
            busy={busy}
            onChange={v => patch({ recording_enabled: v })}
          />
        </div>
      </Section>

      <Section title="Protecting The List">
        {/* The reason a lead vendor asks for this is specific and worth naming:
            they are handing a list to closers they do not employ, and a visible
            phone number is a list that can walk out the door. Saying so is the
            difference between a setting people find and one they never trust. */}
        <Toggle
          label="Hide phone numbers until the lead answers"
          hint="Agents see the lead's name and details but not the number, and it only appears once the lead answers. Blocks CSV export for everyone except you. Use this when you are handing a list to people you do not employ."
          on={data.maskLeadNumbers}
          busy={busy}
          onChange={v => patch({ mask_lead_numbers: v })}
        />
      </Section>

      <Section title="Who Can Dial It">
        {agents.length === 0 ? (
          <div style={{ color: DIM, fontSize: 13, lineHeight: 1.7 }}>
            Nobody yet. Select people under All Users and use Add to campaign — it
            costs nothing extra, their seats are already paid for.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {agents.map(a => (
              <div key={a.accessId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: PANEL, border: `1px solid ${HAIRLINE}`,
                borderRadius: 4, padding: '12px 14px',
                opacity: a.suspended ? 0.55 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                    {a.suspended
                      ? 'Seat paused — cannot dial'
                      : a.payer === 'owner'
                      ? 'You pay this seat'
                      : a.payer === 'agent'
                      ? 'Pays their own seat'
                      : 'Added at no extra cost'}
                  </div>
                </div>
                <button
                  style={btn}
                  disabled={busy}
                  onClick={() => removeAgent(a.memberId)}
                >Remove</button>
              </div>
            ))}
          </div>
        )}
      </Section>

    </div>
  )
}
