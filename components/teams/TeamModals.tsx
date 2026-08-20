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

export function CreateCampaignModal({
  teams, defaultTeamId, existingCampaigns = [], onClose, onCreate, busy,
}: {
  teams: Array<{ id: string; name: string }>
  defaultTeamId?: string
  /** Campaigns the owner already has, so one can be attached instead of made. */
  existingCampaigns?: Array<{ id: string; name: string }>
  onClose: () => void
  onCreate: (input: {
    teamId: string
    name: string
    dialerMode: string
    accessMode: string
    /** Set when attaching rather than creating. */
    existingCampaignId?: string
  }) => void
  busy?: boolean
}) {
  const [teamId, setTeamId] = useState(defaultTeamId || teams[0]?.id || '')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [existingId, setExistingId] = useState('')
  const [name, setName] = useState('')
  const [dialerMode, setDialerMode] = useState('agent_choice')
  const [accessMode, setAccessMode] = useState('owner_pays')

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

  const blockedSubmit = !teamId || (mode === 'new' ? !name.trim() : !existingId)

  return (
    <Shell
      title="Create New Campaign"
      subtitle="Campaigns hold leads and belong to one team. Who can work it is set here and changed any time."
      onClose={onClose}
      footer={
        <>
          <button style={btn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: blockedSubmit || busy ? 0.5 : 1 }}
            disabled={blockedSubmit || busy}
            onClick={() => onCreate({
              teamId,
              name: mode === 'new' ? name.trim() : '',
              dialerMode,
              accessMode,
              existingCampaignId: mode === 'existing' ? existingId : undefined,
            })}
          >{busy ? 'Saving…' : mode === 'new' ? 'Create Campaign' : 'Add To Team'}</button>
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

      {/* ── BUILD ONE, OR BRING ONE IN ─────────────────────────────────────
          Most campaigns already exist on the Campaigns page. Forcing a new one
          every time would mean duplicate lists and split history, so attaching
          an existing campaign is offered first-class rather than as a separate
          screen somewhere else. */}
      <div style={{ marginBottom: 16 }}>
        <label style={label}>Campaign</label>
        <select
          style={field}
          value={mode}
          onChange={e => setMode(e.target.value as 'new' | 'existing')}
        >
          <option value="new">Create a new campaign</option>
          <option value="existing">Add one of my existing campaigns</option>
        </select>
      </div>

      {mode === 'new' ? (
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
      ) : (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Which Campaign</label>
          {existingCampaigns.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
              You have no campaigns yet. Create one here or on the Campaigns page.
            </p>
          ) : (
            <select
              style={field}
              value={existingId}
              onChange={e => setExistingId(e.target.value)}
            >
              <option value="">Choose a campaign…</option>
              {existingCampaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: DIM, lineHeight: 1.6 }}>
            Its leads and history come with it. Adding it to a team does not move
            it — it stays on your Campaigns page.
          </p>
        </div>
      )}

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

      {/* The four values the attach endpoint actually accepts. Each one decides
          both who may dial and who is billed, because on this platform those
          are the same decision — a seat is what makes dialing possible. */}
      <div>
        <label style={label}>Access &amp; Seats</label>
        <select style={field} value={accessMode} onChange={e => setAccessMode(e.target.value)}>
          <option value="free">Free to the whole team — no seat charged</option>
          <option value="owner_pays">Whitelisted agents — you pay their seats</option>
          <option value="agent_pays">Whitelisted agents — they pay their own</option>
          <option value="public">Public — anyone in the team, seat still required</option>
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: DIM, lineHeight: 1.6 }}>
          {accessMode === 'free'
            ? 'Every member dials it, nobody is billed for it.'
            : accessMode === 'owner_pays'
              ? 'You add agents one by one and cover their seats.'
              : accessMode === 'agent_pays'
                ? 'You add agents one by one; each pays for their own seat.'
                : 'Open to the team, but each agent still needs a paid seat.'}
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
          Access without a seat offers no campaign usage. An agent can only dial
          once their seat is paid — by you or by them.
        </p>
      </div>
    </Shell>
  )
}

// =============================================================================
// CREATE JOIN CODE
// =============================================================================
// The two choices an owner is really making here are what the code admits you
// to and who pays for the seat, so those lead and everything else follows. Each
// is explained in a line, because picking between them is a business decision
// rather than a setting — an owner running a recruiting drive and one adding a
// known agent to one campaign want opposite answers.
// =============================================================================
export function CreateCodeModal({ teamName, campaigns, onClose, onCreate, busy }: {
  teamName: string
  campaigns: Array<{ id: string; name: string }>
  onClose: () => void
  onCreate: (input: {
    codeType: 'recruit' | 'seat'
    campaignId?: string
    payer: 'owner' | 'agent'
    maxUses?: number
  }) => void
  busy?: boolean
}) {
  const [codeType, setCodeType] = useState<'recruit' | 'seat'>('recruit')
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || '')
  const [payer, setPayer] = useState<'owner' | 'agent'>('owner')
  const [limited, setLimited] = useState(false)
  const [maxUses, setMaxUses] = useState('1')

  const needsCampaign = codeType === 'seat'
  const blocked = needsCampaign && !campaignId

  return (
    <Shell
      title="New Join Code"
      subtitle={`Anyone with this code joins ${teamName}. You can regenerate it later without removing whoever already used it.`}
      onClose={onClose}
      footer={
        <>
          <button style={btn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: blocked || busy ? 0.5 : 1 }}
            disabled={blocked || busy}
            onClick={() => onCreate({
              codeType,
              campaignId: needsCampaign ? campaignId : undefined,
              payer,
              maxUses: limited ? Math.max(1, parseInt(maxUses, 10) || 1) : undefined,
            })}
          >{busy ? 'Creating…' : 'Create Code'}</button>
        </>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <label style={label}>What It Admits To</label>
        <select
          style={field}
          value={codeType}
          onChange={e => setCodeType(e.target.value as 'recruit' | 'seat')}
        >
          <option value="recruit">Team only — add them to campaigns yourself</option>
          <option value="seat">A campaign — joins the team and that campaign at once</option>
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: DIM, lineHeight: 1.6 }}>
          {codeType === 'recruit'
            ? 'They land in the team with access to nothing until you grant it, or to any campaign already open to everyone.'
            : 'Fastest route for someone you already know is working one list.'}
        </p>
      </div>

      {needsCampaign && (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Campaign</label>
          {campaigns.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
              This team has no campaigns yet. Create one first, or make a team-only code.
            </p>
          ) : (
            <select style={field} value={campaignId} onChange={e => setCampaignId(e.target.value)}>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={label}>Who Pays The Seat</label>
        <select
          style={field}
          value={payer}
          onChange={e => setPayer(e.target.value as 'owner' | 'agent')}
        >
          <option value="owner">You pay for their seat</option>
          <option value="agent">They pay for their own seat</option>
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: DIM, lineHeight: 1.6 }}>
          Nobody can dial without a paid seat, whichever way round it is.
        </p>
      </div>

      {/* A limit is what makes a leaked code survivable, so it is offered here
          rather than buried in an edit screen afterwards. */}
      <div>
        <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={limited}
            onChange={e => setLimited(e.target.checked)}
            style={{ accentColor: ACCENT }}
          />
          Limit how many times it can be used
        </label>
        {limited && (
          <input
            style={{ ...field, marginTop: 6 }}
            type="number"
            min={1}
            value={maxUses}
            onChange={e => setMaxUses(e.target.value)}
          />
        )}
      </div>
    </Shell>
  )
}
