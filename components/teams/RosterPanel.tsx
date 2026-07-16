'use client'

interface TeamUser {
  email: string | null
  first_name: string | null
  last_name: string | null
}
interface MemberCampaignAccess {
  id: string
  campaignId: string
  payer: 'owner' | 'agent' | 'free'
  accessSource: string | null
  createdAt: string
}
interface TeamMember {
  id: string
  team_id: string
  user_id: string
  status: 'active' | 'pending' | 'removed'
  accepted_at: string | null
  removed_at: string | null
  joined_via_code: string | null
  created_at: string
  user: TeamUser
  campaignAccess: MemberCampaignAccess[]
}
interface TeamCode {
  id: string
  code: string
  code_type: 'seat' | 'recruit'
  campaign_id: string | null
  payer: 'owner' | 'agent'
  max_uses: number | null
  use_count: number
  seat_price_override_cents: number | null
  is_active: boolean
  created_at: string
}
interface TeamCampaignRef {
  campaignId: string
  campaign: { id: string; name: string } | null
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
const DEFAULT_SEAT_CENTS = 3500

function displayName(u: TeamUser, fallback: string): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
  return full || u.email || fallback
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function campaignNameFor(refs: TeamCampaignRef[], campaignId: string): string {
  return refs.find(r => r.campaignId === campaignId)?.campaign?.name || 'Unknown campaign'
}

export default function RosterPanel({
  pendingMembers,
  activeMembers,
  codes,
  teamCampaigns,
  actioningId,
  onAccept,
  onReject,
  onKick,
  onReinstate,
  onAddCampaign,
  onRevokeAccess,
}: {
  pendingMembers: TeamMember[]
  activeMembers: TeamMember[]
  codes: TeamCode[]
  teamCampaigns: TeamCampaignRef[]
  actioningId: string | null
  onAccept: (m: TeamMember) => void
  onReject: (m: TeamMember) => void
  onKick: (m: TeamMember) => void
  onReinstate: (m: TeamMember) => void
  onAddCampaign: (m: TeamMember) => void
  onRevokeAccess: (m: TeamMember, access: MemberCampaignAccess, campaignName: string) => void
}) {
  return (
    <div style={{ fontFamily: FUTURA, color: T.text }}>
      {pendingMembers.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 'bold', color: T.amber, marginBottom: 10 }}>
            ▸ PENDING REQUESTS ({pendingMembers.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingMembers.map(m => {
              const code = codes.find(c => c.code === m.joined_via_code)
              const isOwnerPays = code?.payer === 'owner'
              const seatCents = code?.seat_price_override_cents ?? DEFAULT_SEAT_CENTS
              const name = displayName(m.user, m.user_id.slice(0, 12))
              const busy = actioningId === m.id
              return (
                <div key={m.id} style={rowStyle(T.amber)}>
                  <Avatar name={name} />
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold' }}>{name}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                      via {m.joined_via_code || 'unknown'} · {fmtDate(m.created_at)}
                      {isOwnerPays && (
                        <span style={{ color: T.amber, fontWeight: 'bold' }}>
                          {' · '}accepting charges you {fmtMoney(seatCents)}/wk
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onAccept(m)} disabled={busy} style={primaryBtnStyle(busy)}>
                      {busy ? '…' : 'ACCEPT'}
                    </button>
                    <button onClick={() => onReject(m)} disabled={busy} style={dangerBtnStyle(busy)}>REJECT</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, letterSpacing: 2, fontWeight: 'bold', color: T.muted, marginBottom: 10 }}>
        ▸ ROSTER ({activeMembers.length})
      </div>
      {activeMembers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: T.muted, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 6 }}>
          No active members yet. Share a seat link to get someone dialing.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeMembers.map(m => {
            const name = displayName(m.user, m.user_id.slice(0, 12))
            const hasAccess = m.campaignAccess.length > 0
            const accessibleIds = new Set(m.campaignAccess.map(a => a.campaignId))
            const canAddMore = teamCampaigns.some(tc => !accessibleIds.has(tc.campaignId))
            const busy = actioningId === m.id
            return (
              <div key={m.id} style={{ ...rowStyle(hasAccess ? T.green : T.amber), flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Avatar name={name} />
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {name}
                      {!hasAccess && <Badge color={T.amber}>NO ACCESS</Badge>}
                    </div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                      joined {fmtDate(m.accepted_at || m.created_at)}
                      {m.joined_via_code && ` · via ${m.joined_via_code}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!hasAccess && teamCampaigns.length > 0 && (
                      <button onClick={() => onReinstate(m)} disabled={busy} style={primaryBtnStyle(busy)}>
                        {busy ? '…' : '↻ REINSTATE'}
                      </button>
                    )}
                    {hasAccess && canAddMore && (
                      <button onClick={() => onAddCampaign(m)} style={subtleBtnStyle(false, T.primary)}>+ ADD CAMPAIGN</button>
                    )}
                    <button onClick={() => onKick(m)} disabled={busy} style={subtleBtnStyle(busy, T.red)}>KICK</button>
                  </div>
                </div>

                {hasAccess && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    {m.campaignAccess.map(a => {
                      const cName = campaignNameFor(teamCampaigns, a.campaignId)
                      const payerLabel = a.payer === 'owner' ? 'OWNER PAYS' : a.payer === 'agent' ? 'AGENT PAYS' : 'FREE'
                      const payerColor = a.payer === 'owner' ? T.green : a.payer === 'agent' ? T.amber : T.primary
                      return (
                        <div key={a.id} style={{
                          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3,
                          padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                        }}>
                          <span style={{ flex: '1 1 120px', minWidth: 0, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cName}</span>
                          <Badge color={payerColor}>{payerLabel}</Badge>
                          <button onClick={() => onRevokeAccess(m, a, cName)} style={subtleBtnStyle(false, T.red)}>REVOKE</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
      background: T.primary, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 800,
    }}>{initials(name)}</div>
  )
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ fontSize: 9, letterSpacing: 1, fontWeight: 'bold', color, padding: '3px 7px', borderRadius: 2, border: `1px solid ${color}` }}>
      {children}
    </span>
  )
}

function rowStyle(accent: string): React.CSSProperties {
  return {
    background: T.bg, border: `1px solid ${T.border}`, borderLeft: `3px solid ${accent}`,
    borderRadius: 3, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
  }
}

function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', background: T.primary, color: 'white', border: 'none', borderRadius: 3,
    fontSize: 10, letterSpacing: 1, fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer',
    fontFamily: FUTURA, opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
  }
}

function dangerBtnStyle(busy: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', background: 'transparent', color: T.red, border: `1px solid ${T.red}`, borderRadius: 3,
    fontSize: 10, letterSpacing: 1, fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer',
    fontFamily: FUTURA, opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
  }
}

function subtleBtnStyle(busy: boolean, color: string): React.CSSProperties {
  return {
    padding: '6px 10px', background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 3,
    fontSize: 9, letterSpacing: 1, fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer',
    fontFamily: FUTURA, opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
  }
}
