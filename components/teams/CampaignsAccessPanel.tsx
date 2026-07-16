'use client'
import { useEffect, useState } from 'react'

interface TeamCampaignRow {
  campaignId: string
  accessMode: 'owner_pays' | 'agent_pays' | 'public' | 'free'
  createdAt: string
  campaign: {
    id: string
    name: string
    total_leads: number
    called_leads: number
    status: string
  } | null
}
interface MemberCampaignAccess {
  id: string
  campaignId: string
  payer: 'owner' | 'agent' | 'free'
  accessSource: string | null
  createdAt: string
}
interface TeamMemberLite {
  id: string
  campaignAccess: MemberCampaignAccess[]
}
type AccessMode = 'owner_pays' | 'agent_pays' | 'public' | 'free'

interface AgentSummary {
  user_id: string
  state: string
  campaign_id: string | null
}

const FUTURA = "'Futura PT', Futura, sans-serif"
const T = {
  bg: 'var(--brand-page-bg, #f0f1f4)',
  surface: 'var(--brand-card-surface, #e2e4ea)',
  border: 'var(--brand-card-border, #c4c8d0)',
  text: 'var(--brand-on-page-bg, #1a1c24)',
  muted: 'var(--brand-muted-text, #5a5e6a)',
  primary: 'var(--brand-primary, #2a4a8a)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  owner_pays: 'OWNER PAYS',
  agent_pays: 'AGENT PAYS',
  public: 'PUBLIC',
  free: 'FREE',
}

export default function CampaignsAccessPanel({
  teamId,
  teamCampaigns,
  activeMembers,
  actioningId,
  onAttach,
  onAccessModeChange,
  onDetach,
}: {
  teamId: string
  teamCampaigns: TeamCampaignRow[]
  activeMembers: TeamMemberLite[]
  actioningId: string | null
  onAttach: () => void
  onAccessModeChange: (campaignId: string, mode: AccessMode) => void
  onDetach: (campaignId: string, campaignName: string) => void
}) {
  const [agents, setAgents] = useState<AgentSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/dialer/active-agents?team_id=${encodeURIComponent(teamId)}`)
        const data = await res.json()
        if (!cancelled && Array.isArray(data.agents)) setAgents(data.agents)
      } catch {}
    }
    load()
    const interval = setInterval(load, 15_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [teamId])

  const memberCountFor = (campaignId: string): number =>
    activeMembers.filter(m => m.campaignAccess.some(a => a.campaignId === campaignId)).length

  const poolFor = (campaignId: string) => {
    if (!agents) return null
    const onCampaign = agents.filter(a => a.campaign_id === campaignId)
    if (onCampaign.length === 0) return null
    return {
      total: onCampaign.length,
      ready: onCampaign.filter(a => a.state === 'ready').length,
      dialing: onCampaign.filter(a => a.state === 'dialing').length,
      onCall: onCampaign.filter(a => a.state === 'on_call').length,
    }
  }

  return (
    <div style={{ fontFamily: FUTURA, color: T.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 'bold', color: T.muted }}>
          ▸ CAMPAIGNS ({teamCampaigns.length})
        </div>
        <button onClick={onAttach} style={primaryBtnStyle}>+ ATTACH CAMPAIGN</button>
      </div>

      {teamCampaigns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: T.muted, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 6 }}>
          No campaigns attached. Attach one to give the team something to dial.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {teamCampaigns.map(tc => {
            const busy = actioningId === `${teamId}:${tc.campaignId}`
            const pool = poolFor(tc.campaignId)
            const memberCount = memberCountFor(tc.campaignId)
            const progressPct = tc.campaign && tc.campaign.total_leads > 0
              ? Math.min(100, (tc.campaign.called_leads / tc.campaign.total_leads) * 100)
              : 0

            return (
              <div key={tc.campaignId} style={{
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {tc.campaign?.name || '(deleted campaign)'}
                    </div>
                    {tc.campaign && (
                      <>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>
                          {tc.campaign.called_leads.toLocaleString()} / {tc.campaign.total_leads.toLocaleString()} called
                          {' · '}{memberCount} member{memberCount === 1 ? '' : 's'} with access
                        </div>
                        <div style={{ width: '100%', maxWidth: 220, height: 4, borderRadius: 4, background: T.bg, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${progressPct}%`, height: '100%', background: T.primary, borderRadius: 4 }} />
                        </div>
                      </>
                    )}
                  </div>

                  <select
                    value={tc.accessMode}
                    onChange={e => onAccessModeChange(tc.campaignId, e.target.value as AccessMode)}
                    disabled={busy}
                    style={selectStyle(busy)}
                  >
                    {(Object.keys(ACCESS_MODE_LABELS) as AccessMode[]).map(mode => (
                      <option key={mode} value={mode}>{ACCESS_MODE_LABELS[mode]}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => onDetach(tc.campaignId, tc.campaign?.name || 'this campaign')}
                    disabled={busy}
                    style={subtleBtnStyle(busy, T.red)}
                  >DETACH</button>
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, fontSize: 11 }}>
                  {pool ? (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: T.green, fontWeight: 'bold' }}>● LIVE — {pool.total} dialing now</span>
                      <span style={{ color: T.muted }}>{pool.ready} ready</span>
                      <span style={{ color: T.muted }}>{pool.dialing} dialing out</span>
                      <span style={{ color: T.muted }}>{pool.onCall} on a call</span>
                      {pool.total >= 2 && (
                        <span style={{ color: T.primary }}>predictive pool active — surplus calls route to any ready agent</span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: T.muted }}>No one dialing this campaign right now.</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 16px', background: T.primary, color: 'white', border: 'none', borderRadius: 4,
  fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold', cursor: 'pointer', fontFamily: FUTURA, whiteSpace: 'nowrap',
}

function subtleBtnStyle(busy: boolean, color: string): React.CSSProperties {
  return {
    padding: '8px 12px', background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 4,
    fontSize: 10, letterSpacing: 1, fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer',
    fontFamily: FUTURA, opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
  }
}

function selectStyle(busy: boolean): React.CSSProperties {
  return {
    padding: '8px 10px', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4,
    fontSize: 10, letterSpacing: 1, color: T.text, fontFamily: FUTURA,
    cursor: busy ? 'not-allowed' : 'pointer',
  }
}
