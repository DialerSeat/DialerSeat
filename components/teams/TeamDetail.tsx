'use client'

import { useEffect, useState } from 'react'

// =============================================================================
// TEAM DETAIL — what a team looks like when you click it
// =============================================================================
// Three things an owner needs in one place: how the team is doing, what
// campaigns it runs, and who is in it. Codes sit at the top because handing one
// out is the most frequent action here, and burying the thing you do daily
// under the thing you read weekly is how admin pages get slow to use.
// =============================================================================

const PANEL = '#232428'
const HAIRLINE = '#1a1b1e'
const TEXT = '#f2f3f5'
const MUTED = '#949ba4'
const DIM = '#80848e'
const ACCENT = '#2563eb'

export interface TeamDetailCampaign {
  id: string
  name: string
  openToTeam?: boolean
  agentCount: number
  totalLeads?: number
  calledLeads?: number
  /** 'active' or 'inactive'. An inactive campaign is dialable by nobody. */
  status?: string
}

export interface TeamDetailMember {
  id: string
  name: string
  email?: string | null
  seatPaidBy?: 'owner' | 'agent'
  campaignCount: number
}

export interface TeamDetailCode {
  id: string
  code: string
  /** 'recruit' admits to the TEAM only. 'seat' admits to the team AND the
   *  campaign it names, in one step. */
  code_type: 'recruit' | 'seat' | string
  campaign_id?: string | null
  payer?: 'owner' | 'agent' | string | null
  max_uses?: number | null
  use_count?: number | null
  is_active?: boolean | null
}

export interface TeamDetailData {
  id: string
  name: string
  isOwner?: boolean
  codes: TeamDetailCode[]
  campaigns: TeamDetailCampaign[]
  members: TeamDetailMember[]
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
      padding: '12px 14px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
        color: MUTED, marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: TEXT }}>{value}</div>
    </div>
  )
}

function Section({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
      }}>
        <h3 style={{
          margin: 0, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
          color: MUTED, fontWeight: 600,
        }}>{title}</h3>
        <div style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </section>
  )
}

export default function TeamDetail({
  team, onNewCampaign, onNewCode, onRegenerateCode, onManageUser, onToggleCampaign,
  seatTier,
}: {
  team: TeamDetailData
  /** Volume standing, counted across every team this owner runs — see
   *  lib/seatTiers. Absent for a member viewing somebody else's team, who has
   *  no bill and no business seeing one. */
  seatTier?: {
    /** Whole roster, however funded — badges and the sales handoff. */
    totalSeats: number
    /** Seats the owner is billed for — the discount, and only the discount. */
    ownerPaidSeats: number
    percentOff: number
    salesHandoff: boolean
    tier: { key: string; label: string; badge: string | null; salesHandoff: boolean }
    next: { tier: { label: string; minSeats: number; percentOff: number | null }; seatsAway: number } | null
    badges: string[]
  } | null
  onNewCampaign?: (teamId: string) => void
  /** campaignId set means "a code for this campaign", which joins the team and
   *  that campaign at once. Omitted means a team-only code. */
  onNewCode?: (teamId: string, campaignId?: string) => void
  /** Flip a campaign between active and inactive. */
  onToggleCampaign?: (campaignId: string, nextStatus: 'active' | 'inactive') => void
  /** Takes the CODE id, not the team id — a team has several. */
  onRegenerateCode?: (codeId: string) => void
  onManageUser?: (userId: string) => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  // Read once on the client. Touching window during render would break SSR.
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  // Copy confirms in place rather than by toast. The button is where the eye
  // already is, and a notification for something this small is a bigger
  // interruption than the action was worth.
  const copy = async (value: string, key: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1600)
    } catch {}
  }

  const btn: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${HAIRLINE}`, background: PANEL, color: TEXT,
    fontSize: 12, fontFamily: 'inherit', whiteSpace: 'nowrap',
  }

  const totalLeads = team.campaigns.reduce((n, c) => n + (c.totalLeads || 0), 0)
  const calledLeads = team.campaigns.reduce((n, c) => n + (c.calledLeads || 0), 0)

  return (
    <div>
      <div style={{
        display: 'grid', gap: 12, marginBottom: 4,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      }}>
        <Stat label="Members" value={String(team.members.length)} />
        <Stat label="Campaigns" value={String(team.campaigns.length)} />
        <Stat label="Total Leads" value={totalLeads ? totalLeads.toLocaleString() : '—'} />
        <Stat label="Dialed" value={calledLeads ? calledLeads.toLocaleString() : '—'} />
      </div>

      {team.isOwner && (
        <Section
          title="Join Codes"
          action={
            <button
              style={{ ...btn, borderColor: ACCENT, color: '#fff', background: ACCENT }}
              onClick={() => onNewCode?.(team.id)}
            >+ New Code</button>
          }
        >
          {team.codes.length === 0 ? (
            <div style={{ color: DIM, fontSize: 13, lineHeight: 1.7 }}>
              No codes yet. A <strong style={{ color: MUTED }}>team code</strong> lets
              someone join the team; a <strong style={{ color: MUTED }}>campaign code</strong> puts
              them straight onto one campaign and into the team at the same time.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {team.codes.map(c => {
                const isTeamCode = c.code_type === 'recruit'
                const link = origin ? `${origin}/join/${c.code}` : ''
                const campaignName = c.campaign_id
                  ? team.campaigns.find(x => x.id === c.campaign_id)?.name
                  : null
                const uses = typeof c.use_count === 'number' ? c.use_count : 0
                return (
                  <div key={c.id} style={{
                    background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
                    padding: '12px 14px', opacity: c.is_active === false ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <code style={{
                        fontSize: 16, letterSpacing: 2, color: TEXT,
                        background: '#111214', padding: '5px 11px', borderRadius: 3,
                      }}>{c.code}</code>
                      <span style={{
                        fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase',
                        color: DIM, border: `1px solid ${HAIRLINE}`,
                        borderRadius: 3, padding: '2px 6px',
                      }}>{isTeamCode ? 'Team' : 'Campaign'}</span>
                      <div style={{ flex: 1 }} />
                      <button style={btn} onClick={() => copy(c.code, `c-${c.id}`)}>
                        {copied === `c-${c.id}` ? 'Copied' : 'Copy Code'}
                      </button>
                      <button style={btn} onClick={() => copy(link, `l-${c.id}`)}>
                        {copied === `l-${c.id}` ? 'Copied' : 'Copy Link'}
                      </button>
                      <button style={btn} onClick={() => onRegenerateCode?.(c.id)}>Regenerate</button>
                    </div>
                    {/* Terms in one line, because an owner handing out three
                        codes needs to tell them apart at a glance. */}
                    <div style={{ fontSize: 11.5, color: DIM, marginTop: 8 }}>
                      {/* A team code grants no campaign on its own — it puts
                          someone on the roster and stops there. Saying only
                          "Team only" left owners expecting a joiner to be able
                          to dial, then reading an empty campaign list as a
                          bug. It is not a bug; it is the next step, so the
                          code says so. */}
                      {campaignName
                        ? `${campaignName} · `
                        : 'Team code — joins the team only, until you add them to a campaign · '}
                      {c.payer === 'agent' ? 'agent pays their seat' : 'you pay the seat'}
                      {' · '}
                      {c.max_uses ? `${uses}/${c.max_uses} used` : `${uses} used`}
                      {c.is_active === false ? ' · inactive' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: DIM, marginTop: 10, lineHeight: 1.6 }}>
            Regenerating a code stops the old one working immediately and does not
            remove anyone who already joined with it.
          </div>
        </Section>
      )}

      <Section
        title="Campaigns"
        action={
          team.isOwner ? (
            <button
              style={{ ...btn, borderColor: ACCENT, color: '#fff', background: ACCENT }}
              onClick={() => onNewCampaign?.(team.id)}
            >+ New Campaign</button>
          ) : undefined
        }
      >
        {team.campaigns.length === 0 ? (
          <div style={{ color: DIM, fontSize: 13 }}>No campaigns in this team yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {team.campaigns.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: PANEL, border: `1px solid ${HAIRLINE}`,
                borderRadius: 4, padding: '12px 14px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500,
                    color: c.status === 'inactive' ? DIM : TEXT,
                  }}>
                    {c.name}
                    {c.status === 'inactive' && (
                      <span style={{ color: '#fbbf24', fontSize: 11, marginLeft: 8 }}>paused</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                    {c.agentCount} {c.agentCount === 1 ? 'agent' : 'agents'}
                    {c.totalLeads ? ` · ${c.totalLeads.toLocaleString()} leads` : ''}
                  </div>
                </div>
                {c.openToTeam && (
                  <span style={{
                    fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase',
                    color: DIM, border: `1px solid ${HAIRLINE}`,
                    borderRadius: 3, padding: '2px 6px',
                  }}>Open to team</span>
                )}
                {/* Each campaign can mint its own code. Someone joining with it
                    lands in the team AND on this campaign in one step, which is
                    the common case when a vendor is staffing one specific list
                    — asking them to make a team code and then grant access
                    separately is two jobs for one intention. */}
                {/* One click, no dialog. Pausing a campaign is something an
                    owner does between calls — a list runs dry, a compliance
                    question comes up, a client asks them to stop for the day —
                    and it is fully reversible, so asking "are you sure" would
                    cost more than the mistake. The label states what will
                    happen, not what is true now. */}
                {team.isOwner && (
                  <button
                    style={{
                      ...btn,
                      color: c.status === 'inactive' ? '#4ade80' : '#fbbf24',
                    }}
                    onClick={() => onToggleCampaign?.(
                      c.id, c.status === 'inactive' ? 'active' : 'inactive'
                    )}
                  >{c.status === 'inactive' ? 'Activate' : 'Pause'}</button>
                )}
                {team.isOwner && (
                  <button style={btn} onClick={() => onNewCode?.(team.id, c.id)}>
                    + Code
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Members">
        {/* ── VOLUME STANDING ──────────────────────────────────────────────
            Owner-only, and only once there is something true to say. A team
            with three seats does not need a discount ladder in their face —
            that reads as an upsell. Once they are within reach of a rung it
            becomes information they can act on, so that is when it appears.

            Counted across every team they own, and it says so: an owner
            running three teams would otherwise read this as a per-team number
            and conclude the discount is broken.

            Weekly, never monthly — seats bill weekly and cancel anytime. */}
        {team.isOwner && seatTier && (seatTier.percentOff > 0 || seatTier.salesHandoff || (seatTier.next && seatTier.next.seatsAway <= 5)) && (
          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
            padding: '10px 14px', marginBottom: 10,
            fontSize: 11.5, color: DIM, lineHeight: 1.7,
          }}>
            {seatTier.badges.length > 0 && (
              <span style={{ display: 'inline-flex', gap: 6, marginRight: 8, verticalAlign: 'middle' }}>
                {seatTier.badges.map(b => (
                  <span key={b} style={{
                    fontSize: 9, letterSpacing: 1, fontWeight: 700, color: ACCENT,
                    border: `1px solid ${ACCENT}`, borderRadius: 3, padding: '2px 6px',
                  }}>{b}</span>
                ))}
              </span>
            )}
            {/* Both numbers, always, when they differ. An owner shown "18
                seats" beside "5% off" would reasonably expect the discount to
                track 18, and seeing it track 6 later reads as a billing bug.
                Naming the funded count up front is cheaper than that email. */}
            <strong style={{ color: TEXT }}>
              {seatTier.totalSeats} active {seatTier.totalSeats === 1 ? 'seat' : 'seats'}
            </strong>
            {' across your teams'}
            {seatTier.ownerPaidSeats !== seatTier.totalSeats && (
              <> · <strong style={{ color: TEXT }}>{seatTier.ownerPaidSeats}</strong> you pay for</>
            )}
            {seatTier.percentOff > 0 && (
              <> · <span style={{ color: '#32ff7e' }}>
                {seatTier.percentOff}% off your weekly seat cost
              </span></>
            )}

            {seatTier.salesHandoff ? (
              <div style={{ marginTop: 4 }}>
                You are past fifty seats — rates at this size are set individually.
                Email <strong style={{ color: TEXT }}>sales@dialerseat.com</strong> and
                we will put together a partnership that fits how you actually run.
              </div>
            ) : seatTier.next ? (
              <div style={{ marginTop: 4 }}>
                {/* Deliberately says "seats you pay for". The rung only moves on
                    funded seats, so counting self-funded ones toward it would be
                    the panel promising a discount billing will not apply. */}
                {seatTier.next.seatsAway} more{' '}
                {seatTier.next.seatsAway === 1 ? 'seat' : 'seats'} you pay for reaches{' '}
                <strong style={{ color: TEXT }}>{seatTier.next.tier.label}</strong>
                {typeof seatTier.next.tier.percentOff === 'number'
                  ? ` — ${seatTier.next.tier.percentOff}% off weekly.`
                  : ' — a rate we set with you directly. Email sales@dialerseat.com.'}
              </div>
            ) : null}

            {/* A vendor whose agents all self-fund earns no discount by design,
                and would otherwise see nothing here but a threshold they have
                no reason to chase. What they have built is still worth saying
                out loud, and the reward for it is a conversation. */}
            {!seatTier.salesHandoff
              && seatTier.percentOff === 0
              && seatTier.totalSeats >= 10
              && seatTier.ownerPaidSeats < 10 && (
              <div style={{ marginTop: 4 }}>
                Most of your seats are paid for by the agents themselves, so the
                weekly discount does not apply — it only reduces what{' '}
                <em style={{ color: MUTED }}>you</em> are billed. A roster this size is
                worth talking about directly: email{' '}
                <strong style={{ color: TEXT }}>sales@dialerseat.com</strong>.
              </div>
            )}
          </div>
        )}

        {team.members.length === 0 ? (
          <div style={{ color: DIM, fontSize: 13 }}>No members yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {team.members.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: PANEL, border: `1px solid ${HAIRLINE}`,
                borderRadius: 4, padding: '12px 14px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                    {m.campaignCount} {m.campaignCount === 1 ? 'campaign' : 'campaigns'}
                    {m.seatPaidBy ? ` · seat paid by ${m.seatPaidBy}` : ''}
                  </div>
                </div>
                {team.isOwner && (
                  <button style={btn} onClick={() => onManageUser?.(m.id)}>Manage</button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
