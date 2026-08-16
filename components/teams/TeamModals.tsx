'use client'

import { useEffect, useState } from 'react'

// =============================================================================
// CREATE TEAM / CREATE CAMPAIGN
// =============================================================================
// A campaign cannot exist outside a team, so the team picker is the first field
// rather than a detail further down — the form asks for the thing that scopes
// everything else before it asks for anything else. When the dialog is opened
// from inside a team the picker is pre-filled, because the answer is already
// known and re-asking is just a chance to get it wrong.
// =============================================================================

const PANEL = '#232428'
const HAIRLINE = '#1a1b1e'
const TEXT = '#f2f3f5'
const MUTED = '#949ba4'
const DIM = '#80848e'
const ACCENT = '#2563eb'

function Shell({ title, subtitle, onClose, children, footer }: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  // Escape closes. A modal that can only be dismissed by hitting a small target
  // is a modal people feel trapped by.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, background: '#1e1f22',
          border: `1px solid ${HAIRLINE}`, borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)', color: TEXT,
        }}
      >
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${HAIRLINE}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: DIM, lineHeight: 1.6 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ padding: '18px 20px' }}>{children}</div>
        <div style={{
          padding: '14px 20px', borderTop: `1px solid ${HAIRLINE}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>{footer}</div>
      </div>
    </div>
  )
}

const label: React.CSSProperties = {
  display: 'block', fontSize: 11, letterSpacing: 1.1,
  textTransform: 'uppercase', color: MUTED, marginBottom: 6,
}
const field: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px',
  borderRadius: 4, border: `1px solid ${HAIRLINE}`, background: '#111214',
  color: TEXT, fontSize: 13.5, fontFamily: 'inherit',
}
const btn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 4, cursor: 'pointer',
  border: `1px solid ${HAIRLINE}`, background: PANEL, color: TEXT,
  fontSize: 13, fontFamily: 'inherit',
}
const btnPrimary: React.CSSProperties = {
  ...btn, background: ACCENT, borderColor: ACCENT, color: '#fff', fontWeight: 600,
}

export function CreateTeamModal({ onClose, onCreate, busy }: {
  onClose: () => void
  onCreate: (name: string, description: string) => void
  busy?: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  return (
    <Shell
      title="Create New Team"
      subtitle="A team owns campaigns and the agents who work them. You can invite people once it exists."
      onClose={onClose}
      footer={
        <>
          <button style={btn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: !name.trim() || busy ? 0.5 : 1 }}
            disabled={!name.trim() || busy}
            onClick={() => onCreate(name.trim(), description.trim())}
          >{busy ? 'Creating…' : 'Create Team'}</button>
        </>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <label style={label}>Team Name</label>
        <input
          autoFocus
          style={field}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Alias Agency"
        />
      </div>
      <div>
        <label style={label}>Description <span style={{ color: DIM }}>(optional)</span></label>
        <input
          style={field}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What this team works"
        />
      </div>
    </Shell>
  )
}

export function CreateCampaignModal({ teams, defaultTeamId, onClose, onCreate, busy }: {
  teams: Array<{ id: string; name: string }>
  defaultTeamId?: string
  onClose: () => void
  onCreate: (input: { teamId: string; name: string; dialerMode: string; accessMode: string }) => void
  busy?: boolean
}) {
  const [teamId, setTeamId] = useState(defaultTeamId || teams[0]?.id || '')
  const [name, setName] = useState('')
  const [dialerMode, setDialerMode] = useState('progressive')
  const [accessMode, setAccessMode] = useState('restricted')

  // No teams, no campaign. Saying so plainly beats a disabled form that gives
  // no reason.
  if (teams.length === 0) {
    return (
      <Shell
        title="Create New Campaign"
        subtitle="A campaign has to belong to a team."
        onClose={onClose}
        footer={<button style={btn} onClick={onClose}>Close</button>}
      >
        <p style={{ margin: 0, fontSize: 13.5, color: MUTED, lineHeight: 1.7 }}>
          You do not have a team yet. Create one first, then add campaigns to it.
        </p>
      </Shell>
    )
  }

  return (
    <Shell
      title="Create New Campaign"
      subtitle="Campaigns hold leads and belong to one team. Who can work it is set here and changed any time."
      onClose={onClose}
      footer={
        <>
          <button style={btn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: !name.trim() || !teamId || busy ? 0.5 : 1 }}
            disabled={!name.trim() || !teamId || busy}
            onClick={() => onCreate({ teamId, name: name.trim(), dialerMode, accessMode })}
          >{busy ? 'Creating…' : 'Create Campaign'}</button>
        </>
      }
    >
      {/* Team first: it scopes everything below it. */}
      <div style={{ marginBottom: 16 }}>
        <label style={label}>Team</label>
        <select style={field} value={teamId} onChange={e => setTeamId(e.target.value)}>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={label}>Campaign Name</label>
        <input
          autoFocus
          style={field}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Fresh Lead Campaign"
        />
      </div>

      {/* Two ways to run a campaign: let the agent pick how they dial, or fix
          it. Fixing it is what an owner does when the script, the list or the
          compliance posture depends on the mode. */}
      <div style={{ marginBottom: 16 }}>
        <label style={label}>Dialer Mode</label>
        <select style={field} value={dialerMode} onChange={e => setDialerMode(e.target.value)}>
          <option value="agent_choice">Agent chooses their own mode</option>
          <option value="preview">Force Preview — see the lead, then dial</option>
          <option value="progressive">Force Progressive — one at a time, automatic</option>
          <option value="power">Force Power — continuous single line</option>
          <option value="predictive">Force Predictive — multiple lines (beta)</option>
        </select>
      </div>

      <div>
        <label style={label}>Who Can Work It</label>
        <select style={field} value={accessMode} onChange={e => setAccessMode(e.target.value)}>
          <option value="free">Everyone in the team</option>
          <option value="restricted">Whitelisted agents only</option>
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: DIM, lineHeight: 1.6 }}>
          {accessMode === 'free'
            ? 'Every member of the team can dial this — no per-agent setup.'
            : 'Only agents you add to the whitelist can dial this.'}
        </p>
        {/* The rule that overrides both settings, said once and plainly. Access
            is permission to dial; a seat is what makes dialing possible. An
            agent with access and no paid seat cannot work the campaign either
            way, so it belongs here rather than as a surprise later. */}
        <p style={{
          margin: '10px 0 0', padding: '9px 11px', borderRadius: 4,
          background: '#111214', border: `1px solid ${HAIRLINE}`,
          fontSize: 11.5, color: MUTED, lineHeight: 1.6,
        }}>
          Either way, an agent can only dial if their seat is paid — by you or by
          them. Access without a seat does nothing.
        </p>
      </div>
    </Shell>
  )
}
