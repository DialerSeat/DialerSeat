'use client'

import { useState } from 'react'

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
}

export interface TeamDetailMember {
  id: string
  name: string
  email?: string | null
  seatPaidBy?: 'owner' | 'agent'
  campaignCount: number
}

export interface TeamDetailData {
  id: string
  name: string
  isOwner?: boolean
  code?: string | null
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
  team, onNewCampaign, onRegenerateCode, onManageUser,
}: {
  team: TeamDetailData
  onNewCampaign?: (teamId: string) => void
  onRegenerateCode?: (teamId: string) => void
  onManageUser?: (userId: string) => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const code = team.code || '—'
  const signupLink = typeof window !== 'undefined' && team.code
    ? `${window.location.origin}/join/${team.code}`
    : ''

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
        <Stat label="Campaigns" value={String(team.campaigns.length)} />
        <Stat label="Members" value={String(team.members.length)} />
        <Stat label="Total Leads" value={totalLeads ? totalLeads.toLocaleString() : '—'} />
        <Stat label="Called" value={calledLeads ? calledLeads.toLocaleString() : '—'} />
      </div>

      {team.isOwner && (
        <Section
          title="Invite"
          action={
            <button style={btn} onClick={() => onRegenerateCode?.(team.id)}>
              Regenerate
            </button>
          }
        >
          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
            padding: '14px 16px', display: 'flex', alignItems: 'center',
            gap: 10, flexWrap: 'wrap',
          }}>
            <code style={{
              fontSize: 18, letterSpacing: 2, color: TEXT,
              background: '#111214', padding: '6px 12px', borderRadius: 3,
            }}>{code}</code>
            <div style={{ flex: 1 }} />
            <button style={btn} onClick={() => copy(code, 'code')}>
              {copied === 'code' ? 'Copied' : 'Copy Code'}
            </button>
            <button style={btn} onClick={() => copy(signupLink, 'link')}>
              {copied === 'link' ? 'Copied' : 'Copy Signup Link'}
            </button>
            <a
              style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}
              href={`mailto:?subject=${encodeURIComponent(`Join ${team.name} on DialerSeat`)}&body=${encodeURIComponent(`Use this link to join:\n\n${signupLink || code}`)}`}
            >Email Invite</a>
          </div>
          <div style={{ fontSize: 11.5, color: DIM, marginTop: 8, lineHeight: 1.6 }}>
            Anyone with this code joins the team. Regenerating it stops the old one
            working immediately and does not remove anyone already in.
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
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
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
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Members">
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
