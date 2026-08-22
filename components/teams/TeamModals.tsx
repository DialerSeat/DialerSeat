'use client'

import { useEffect, useState, useRef } from 'react'

// =============================================================================
// CREATE TEAM / CREATE CAMPAIGN
// =============================================================================
// A campaign cannot exist outside a team, so the team picker is the first field
// rather than a detail further down — the form asks for the thing that scopes
// everything else before it asks for anything else. When the dialog is opened
// from inside a team the picker is pre-filled, because the answer is already
// known and re-asking is just a chance to get it wrong.
// =============================================================================

const PANEL = 'var(--teams-panel, #232428)'
const HAIRLINE = 'var(--teams-border, #1a1b1e)'
const TEXT = 'var(--teams-text, #f2f3f5)'
const MUTED = 'var(--teams-muted, #949ba4)'
const DIM = 'var(--teams-muted, #80848e)'
const ACCENT = 'var(--teams-accent, #2563eb)'

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

  // ── CLOSING ON THE BACKDROP MUST NOT CATCH A DRAG ─────────────────────
  // A click fires on the nearest common ancestor of where the press started
  // and where it ended. So selecting text in a field and releasing past the
  // edge of the dialog — which is what highlighting a name to replace it
  // looks like — landed a click on the backdrop and closed the box, throwing
  // away what had been typed.
  //
  // The press has to START on the backdrop for it to count. Tracked on
  // mousedown, because that is the half of the gesture that says what the
  // person meant: pressing on the backdrop is dismissing, pressing on a field
  // and dragging is selecting, and the release position tells you neither.
  const pressStartedOnBackdrop = useRef(false)

  return (
    <div
      onMouseDown={e => { pressStartedOnBackdrop.current = e.target === e.currentTarget }}
      onClick={e => {
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose()
        pressStartedOnBackdrop.current = false
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, background: 'var(--teams-page-bg, #1e1f22)',
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
  borderRadius: 4, border: `1px solid ${HAIRLINE}`, background: 'var(--teams-inset, #111214)',
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

// ── ONE MODAL FOR BOTH ────────────────────────────────────────────────────
// Renaming a team and renaming a campaign are the same act on different
// nouns, and both endpoints already existed and already checked ownership —
// only the way in was missing. A shared modal keeps the wording and the
// validation identical, so the two cannot drift into behaving differently
// for no reason.
//
// Seeded with the current name and selected on open, because a rename is
// almost always an edit of what is there rather than a fresh answer.
export function RenameModal({ kind, currentName, onClose, onSave, busy }: {
  kind: 'team' | 'campaign' | 'member'
  currentName: string
  onClose: () => void
  onSave: (name: string) => void
  busy?: boolean
}) {
  const [name, setName] = useState(currentName)
  const isMember = kind === 'member'
  const noun = kind === 'team' ? 'Team' : kind === 'member' ? 'Nickname' : 'Campaign'
  const trimmed = name.trim()
  const unchanged = trimmed === currentName.trim()
  // A nickname may be emptied — that is how somebody goes back to their real
  // name. A team or a campaign with no name at all is just broken, so those
  // two still require one.
  const canSave = (isMember || !!trimmed) && !unchanged && !busy

  return (
    <Shell
      title={isMember ? 'Set Nickname' : `Rename ${noun}`}
      subtitle={
        kind === 'team'
          ? 'Everyone on this team sees the new name, including agents already dialing.'
          : kind === 'member'
            ? 'What you call them on this team. It does not change their account, ' +
              'and it does not follow them to another team. Clear it to go back to their real name.'
            : 'Agents see the new name in the dialer straight away. Nothing about the leads or settings changes.'
      }
      onClose={onClose}
      footer={
        <>
          <button style={btn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }}
            disabled={!canSave}
            onClick={() => onSave(trimmed)}
          >{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <div>
        <label style={label}>{isMember ? 'Nickname' : `${noun} Name`}</label>
        <input
          autoFocus
          style={field}
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={e => e.currentTarget.select()}
          onKeyDown={e => {
            if (e.key === 'Enter' && canSave) onSave(trimmed)
          }}
          maxLength={isMember ? 60 : 100}
          placeholder={currentName}
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
          background: 'var(--teams-inset, #111214)', border: `1px solid ${HAIRLINE}`,
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
export function CreateCodeModal({
  teamName, campaigns, defaultCampaignId, onClose, onCreate, busy,
}: {
  teamName: string
  campaigns: Array<{ id: string; name: string }>
  /** Minting from a campaign row: the dialog opens as a campaign code for it. */
  defaultCampaignId?: string
  onClose: () => void
  onCreate: (input: {
    codeType: 'recruit' | 'seat'
    campaignId?: string
    payer: 'owner' | 'agent'
    joinMode: 'instant' | 'approval'
    maxUses?: number
  }) => void
  busy?: boolean
}) {
  const [codeType, setCodeType] = useState<'recruit' | 'seat'>(
    defaultCampaignId ? 'seat' : 'recruit'
  )
  const [campaignId, setCampaignId] = useState(defaultCampaignId || campaigns[0]?.id || '')
  const [payer, setPayer] = useState<'owner' | 'agent'>('owner')
  const [joinMode, setJoinMode] = useState<'instant' | 'approval'>('instant')
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
              joinMode,
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

      {/* Decides admission AND when the seat is charged, which is why it is one
          control rather than two: an owner letting someone in immediately is
          agreeing to pay for them immediately. */}
      <div style={{ marginBottom: 16 }}>
        <label style={label}>Joining</label>
        <select
          style={field}
          value={joinMode}
          onChange={e => setJoinMode(e.target.value as 'instant' | 'approval')}
        >
          <option value="approval">Hold for my approval</option>
          <option value="instant">Let them straight in</option>
        </select>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: DIM, lineHeight: 1.6 }}>
          {joinMode === 'instant'
            ? 'They can dial as soon as they redeem it, and the seat is charged then.'
            : 'They land in Requests and can look around read-only until you accept them. The seat is charged on approval.'}
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

// =============================================================================
// MANAGE A MEMBER
// =============================================================================
// Everything an owner can do to one person's place in a team, in one place:
// see who pays, pause or resume the seat, or remove them entirely.
//
// Pausing and removing are different acts and are presented as such. A pause
// stops the billing and the access while keeping the person — they come back
// with one click. Removing ends the membership. Conflating them behind one
// "deactivate" is how owners accidentally destroy a relationship they only
// meant to interrupt.
// =============================================================================
export function ManageMemberModal({
  member, teamName, onClose, onSeatAction, onRemove, busy,
}: {
  member: {
    memberId: string
    name: string
    email?: string | null
    seatPaidBy?: 'owner' | 'agent'
    seatSuspendedAt?: string | null
    campaignCount: number
  }
  teamName: string
  onClose: () => void
  onSeatAction: (memberId: string, action: 'pause' | 'resume') => void
  onRemove: (memberId: string) => void
  busy?: boolean
}) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const suspended = !!member.seatSuspendedAt

  return (
    <Shell
      title={member.name}
      subtitle={`${member.email || 'No email on file'} · ${teamName}`}
      onClose={onClose}
      footer={<button style={btn} onClick={onClose}>Close</button>}
    >
      <div style={{
        display: 'grid', gap: 10, marginBottom: 18,
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
      }}>
        <div style={{ background: 'var(--teams-inset, #111214)', borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ ...label, marginBottom: 4 }}>Seat</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: suspended ? '#fbbf24' : '#4ade80' }}>
            {suspended ? 'Paused' : 'Active'}
          </div>
        </div>
        <div style={{ background: 'var(--teams-inset, #111214)', borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ ...label, marginBottom: 4 }}>Paid By</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {member.seatPaidBy === 'agent' ? 'Them' : 'You'}
          </div>
        </div>
        <div style={{ background: 'var(--teams-inset, #111214)', borderRadius: 4, padding: '10px 12px' }}>
          <div style={{ ...label, marginBottom: 4 }}>Campaigns</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{member.campaignCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <button
          style={{ ...btn, textAlign: 'left', opacity: busy ? 0.5 : 1 }}
          disabled={busy}
          onClick={() => onSeatAction(member.memberId, suspended ? 'resume' : 'pause')}
        >
          <div style={{ fontWeight: 600 }}>{suspended ? 'Resume seat' : 'Pause seat'}</div>
          <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
            {suspended
              ? 'They can dial again and billing restarts.'
              : 'They keep their place but cannot dial, and the seat stops being billed.'}
          </div>
        </button>

        {!confirmRemove ? (
          <button
            style={{ ...btn, textAlign: 'left', borderColor: '#7f1d1d', opacity: busy ? 0.5 : 1 }}
            disabled={busy}
            onClick={() => setConfirmRemove(true)}
          >
            <div style={{ fontWeight: 600, color: '#fca5a5' }}>Remove from team</div>
            <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
              Ends the membership and every campaign grant that came with it.
            </div>
          </button>
        ) : (
          <div style={{
            border: '1px solid #7f1d1d', background: '#2a1113',
            borderRadius: 4, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 13, color: '#fecaca', lineHeight: 1.6, marginBottom: 10 }}>
              Remove <strong>{member.name}</strong> from {teamName}? Their call history
              stays; their access does not.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btn} disabled={busy} onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...btn, background: '#da373c', borderColor: '#da373c',
                  color: '#fff', fontWeight: 600, opacity: busy ? 0.5 : 1,
                }}
                disabled={busy}
                onClick={() => onRemove(member.memberId)}
              >{busy ? 'Removing…' : 'Remove'}</button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
