'use client'

import { useEffect, useState, useCallback } from 'react'

const PANEL = 'var(--teams-panel, #232428)'
const HAIRLINE = 'var(--teams-border, #1a1b1e)'
const TEXT = 'var(--teams-text, #f2f3f5)'
const MUTED = 'var(--teams-muted, #949ba4)'
const DIM = 'var(--teams-muted, #80848e)'
const ACCENT = 'var(--teams-accent, #2563eb)'

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
  ingestEnabled: boolean
  ingestToken: string | null
  lastLeadAddedAt: string | null
  createdAt: string
}

interface CandidateRow {
  memberId: string
  userId: string
  name: string
  email: string | null
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
  onRename,
  reloadToken,
}: {
  campaignId: string
  onBack: () => void
  onChanged?: () => void
  /** Opens the shared rename dialog, owned by the page. Passing the handler
   *  up rather than hosting a second modal here is what keeps renaming a
   *  campaign identical to renaming a team. */
  onRename?: (kind: 'team' | 'campaign', id: string, currentName: string) => void
  /** Bumped by the page after a rename lands, so this panel refetches and
   *  shows the new name instead of the one it loaded with. */
  reloadToken?: number
}) {
  const [data, setData] = useState<CampaignDetailData | null>(null)
  const [team, setTeam] = useState<{ id: string; name: string; accessMode: string | null } | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [available, setAvailable] = useState<CandidateRow[]>([])
  const [ingestLog, setIngestLog] = useState<any[]>([])
  // Only the campaign's creator may change its settings — /api/campaigns/update
  // enforces that server-side. Showing the controls to a team owner who did not
  // create it means offering a switch that answers 403 when flipped.
  const [isCampaignOwner, setIsCampaignOwner] = useState(true)
  // 'member' means the viewer dials this campaign but does not run it. The
  // endpoint returns a deliberately narrow payload in that case — their own
  // figures and nothing about anybody else.
  const [viewerRole, setViewerRole] = useState<'owner' | 'member'>('owner')
  const [myStats, setMyStats] = useState<{
    calls: number; talkSeconds: number; appointments: number
    closed: number; notInterested: number; dnc: number
  } | null>(null)
  const [myScripts, setMyScripts] = useState<Array<{ id: string; name: string; body: string }>>([])
  const [myRecent, setMyRecent] = useState<Array<{
    id: string; at: string; disposition: string | null; seconds: number
    hasRecording: boolean; recordingSeconds: number
  }>>([])
  const [canDial, setCanDial] = useState(true)
  const [myDaily, setMyDaily] = useState<Array<{ day: string; calls: number }>>([])
  const [memberRecording, setMemberRecording] = useState(false)
  const [openScript, setOpenScript] = useState<string | null>(null)
  // The viewer's own scripts on this campaign. Nobody else can read these —
  // not other agents, not the campaign owner. See /api/scripts/personal.
  const [myScriptsPersonal, setMyScriptsPersonal] = useState<Array<{
    id: string; name: string; body: string
  }>>([])
  const [editingScript, setEditingScript] = useState<{ id?: string; name: string; body: string } | null>(null)
  const [scriptBusy, setScriptBusy] = useState(false)
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
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
      setAvailable(r.availableMembers || [])
      setIngestLog(r.ingestLog || [])
      setIsCampaignOwner(r.isCampaignOwner !== false)
      setViewerRole(r.viewerRole === 'member' ? 'member' : 'owner')
      setMyStats(r.myStats || null)
      setMyScripts(Array.isArray(r.scripts) ? r.scripts : [])
      setMyRecent(Array.isArray(r.myRecentCalls) ? r.myRecentCalls : [])
      setMyDaily(Array.isArray(r.myDailyCalls) ? r.myDailyCalls : [])
      setMemberRecording(!!r.recordingEnabled)
      setCanDial(r.canDial !== false)
      if (r.viewerRole === 'member') void loadPersonalScripts()
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Could not load campaign')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load, reloadToken])

  // Read on the client — touching window during render breaks SSR.
  useEffect(() => { setOrigin(window.location.origin) }, [])

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

  const addPicked = async () => {
    if (picked.size === 0 || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/teams/access/grant-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, memberIds: Array.from(picked) }),
      }).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not add those people')
      setPicked(new Set())
      setPickerOpen(false)
      await load()
      onChanged?.()
    } catch (e: any) {
      setError(e.message || 'Could not add those people')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Open the campaign to the whole team.
   *
   * Different in kind from ticking every name: this is a standing rule, so
   * somebody who joins the team tomorrow gets it too. Picking everyone by hand
   * only covers the people who exist right now, and the difference matters most
   * to exactly the person using it — a vendor onboarding a floor over weeks.
   */
  const setOpenToTeam = async (open: boolean) => {
    if (!team || busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/teams/campaigns/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          campaignId,
          accessMode: open ? 'free' : 'owner_pays',
        }),
      }).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not change access')
      await load()
      onChanged?.()
    } catch (e: any) {
      setError(e.message || 'Could not change access')
    } finally {
      setBusy(false)
    }
  }

  const setIngest = async (action: 'enable' | 'disable' | 'rotate') => {
    if (busy) return
    setBusy(true)
    try {
      const r = await fetch('/api/teams/campaigns/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, action }),
      }).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not change lead drip')
      await load()
    } catch (e: any) {
      setError(e.message || 'Could not change lead drip')
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

  const loadPersonalScripts = async () => {
    try {
      const r = await fetch(
        `/api/scripts/personal?campaign_id=${encodeURIComponent(campaignId)}`
      ).then(x => x.json())
      if (r.success) setMyScriptsPersonal(r.scripts || [])
    } catch {
      // A private note failing to load must not take the page down with it.
    }
  }

  const savePersonalScript = async () => {
    if (!editingScript || scriptBusy) return
    const name = editingScript.name.trim()
    if (!name) return
    setScriptBusy(true)
    try {
      const isEdit = !!editingScript.id
      const r = await fetch('/api/scripts/personal', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? { id: editingScript.id, name, body: editingScript.body }
            : { campaignId, name, body: editingScript.body }
        ),
      }).then(x => x.json())
      if (!r.success) throw new Error(r.error || 'Could not save that script')
      setEditingScript(null)
      await loadPersonalScripts()
    } catch (e: any) {
      setError(e?.message || 'Could not save that script')
    } finally {
      setScriptBusy(false)
    }
  }

  const deletePersonalScript = async (id: string) => {
    if (scriptBusy) return
    setScriptBusy(true)
    try {
      await fetch(`/api/scripts/personal?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      await loadPersonalScripts()
    } finally {
      setScriptBusy(false)
    }
  }

  // ── WHAT A CAMPAIGN LOOKS LIKE TO SOMEBODY WHO DIALS IT ────────────────
  // Previously this screen answered an agent with red text saying the campaign
  // was not theirs. Ownership decides what somebody may CHANGE; it should not
  // decide whether they can see the work they are doing.
  //
  // So: their own figures, how much list is left, and a way back to dialling.
  // No other agent appears here, no lead data, no settings, no codes. The
  // absence is the design, not an oversight — widening it later would turn a
  // personal scorecard into a leaderboard nobody asked to be on.
  if (viewerRole === 'member') {
    const mins = myStats ? Math.round(myStats.talkSeconds / 60) : 0
    const stat = (label: string, value: string | number) => (
      <div key={label} style={{
        background: PANEL, border: `1px solid ${HAIRLINE}`,
        borderRadius: 4, padding: '12px 14px',
      }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: DIM, marginBottom: 6 }}>
          {label.toUpperCase()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: TEXT, fontFamily: 'monospace' }}>
          {value}
        </div>
      </div>
    )

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
            <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>
              {team?.name ? `${team.name} · ` : ''}
              {canDial
                ? 'You dial this campaign'
                : 'Not opened to you yet'}
            </div>
          </div>
          {!paused && canDial && (
            <a
              href={`/dashboard/dialer?campaign=${encodeURIComponent(data.id)}`}
              style={{
                ...btn, textDecoration: 'none',
                borderColor: ACCENT, color: '#fff', background: ACCENT,
              }}
            >Dial</a>
          )}
        </div>

        {!canDial && (
          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`,
            borderLeft: '3px solid #fbbf24',
            borderRadius: 4, padding: '12px 14px', marginBottom: 20,
            fontSize: 12.5, color: DIM, lineHeight: 1.7,
          }}>
            This campaign belongs to your team, but you have not been added to it
            yet. Whoever runs the team can open it to you.
          </div>
        )}

        <div style={{ fontSize: 11, letterSpacing: 2, color: DIM, marginBottom: 10 }}>
          YOUR NUMBERS ON THIS CAMPAIGN
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 8, marginBottom: 20,
        }}>
          {/* A dash, never a zero invented to fill the box: no calls yet is a
              different statement from nothing recorded. */}
          {stat('Calls', myStats ? myStats.calls.toLocaleString() : '—')}
          {stat('Talk time', myStats ? `${mins}m` : '—')}
          {stat('Appointments', myStats ? myStats.appointments : '—')}
          {stat('Closed', myStats ? myStats.closed : '—')}
          {stat('Not interested', myStats ? myStats.notInterested : '—')}
        </div>

        {/* ── THE WEEK, THEIR OWN ─────────────────────────────────────
            Empty days are drawn, not skipped. A sparse list of only the
            days they worked reads as missing data; a day off is a real
            answer and should look like one. */}
        {myDaily.length > 0 && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 2, color: DIM, marginBottom: 10 }}>
              YOUR LAST 7 DAYS
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 6, height: 64,
              background: PANEL, border: `1px solid ${HAIRLINE}`,
              borderRadius: 4, padding: '10px 12px', marginBottom: 20,
            }}>
              {(() => {
                const peak = Math.max(...myDaily.map(d => d.calls), 1)
                return myDaily.map(d => (
                  <div key={d.day} style={{ flex: 1, textAlign: 'center' }}>
                    <div
                      title={`${d.calls} call${d.calls === 1 ? '' : 's'} on ${d.day}`}
                      style={{
                        height: `${Math.round((d.calls / peak) * 34)}px`,
                        minHeight: d.calls > 0 ? 3 : 1,
                        background: d.calls > 0 ? ACCENT : HAIRLINE,
                        borderRadius: 2,
                      }}
                    />
                    <div style={{ fontSize: 9, color: DIM, marginTop: 5 }}>
                      {new Date(d.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </div>
                  </div>
                ))
              })()}
            </div>
          </>
        )}

        {/* Scripts they already see mid-call, somewhere they can read them
            before the phone is ringing. */}
        {myScripts.length > 0 && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 2, color: DIM, marginBottom: 10 }}>
              SCRIPTS
            </div>
            <div style={{ display: 'grid', gap: 6, marginBottom: 20 }}>
              {myScripts.map(sc => (
                <div key={sc.id} style={{
                  background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
                }}>
                  <button
                    onClick={() => setOpenScript(openScript === sc.id ? null : sc.id)}
                    style={{
                      width: '100%', textAlign: 'left', background: 'transparent',
                      border: 0, color: TEXT, fontSize: 13.5, padding: '12px 14px',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {openScript === sc.id ? '▾' : '▸'} {sc.name}
                  </button>
                  {openScript === sc.id && (
                    <div style={{
                      padding: '0 14px 14px', fontSize: 13, lineHeight: 1.7,
                      color: DIM, whiteSpace: 'pre-wrap',
                    }}>{sc.body}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Their own calls. Outcome and duration only — no lead name or
            number, because a record of your own work does not require
            handing back the list. */}
        {myRecent.length > 0 && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 2, color: DIM, marginBottom: 10 }}>
              YOUR RECENT CALLS
            </div>
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`,
              borderRadius: 4, marginBottom: 20,
            }}>
              {myRecent.map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 14px',
                  borderTop: i === 0 ? 'none' : `1px solid ${HAIRLINE}`,
                  fontSize: 12.5,
                }}>
                  <span style={{ color: TEXT }}>{c.disposition || 'No disposition'}</span>
                  <span style={{ color: DIM, fontFamily: 'monospace', fontSize: 11.5 }}>
                    {Math.floor(c.seconds / 60)}:{String(c.seconds % 60).padStart(2, '0')}
                    {'  ·  '}
                    {new Date(c.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.7, marginBottom: 22 }}>
          {memberRecording && (
            <>Calls on this campaign are recorded.{' '}</>
          )}
          How this campaign dials, what it records, and who else is on it are set
          by whoever runs it. If something here looks wrong, they are the ones
          who can change it.
        </div>

        {/* ── THEIR OWN SCRIPTS ────────────────────────────────────────────
            Separate from the campaign's scripts above, and deliberately so.
            Those belong to whoever runs the campaign; these belong to the
            person reading the page. Nobody else can see them — not the other
            agents on the campaign, not the owner.

            Said out loud on screen rather than left to be inferred. An agent
            who suspects their manager can read their notes will not write
            anything worth keeping in them. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{ fontSize: 11, letterSpacing: 2, color: DIM }}>
            YOUR OWN SCRIPTS
          </span>
          {!editingScript && (
            <button
              style={{ ...btn, padding: '5px 10px', fontSize: 11.5 }}
              onClick={() => setEditingScript({ name: '', body: '' })}
            >+ Add</button>
          )}
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11.5, color: DIM, lineHeight: 1.6, marginBottom: 10 }}>
            Only you can see these. Not the other agents on this campaign, and
            not whoever runs it.
          </div>

          {editingScript && (
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`,
              borderRadius: 4, padding: 12, marginBottom: 8,
            }}>
              <input
                autoFocus
                value={editingScript.name}
                onChange={e => setEditingScript({ ...editingScript, name: e.target.value })}
                placeholder="What is this for? e.g. Gatekeeper"
                maxLength={100}
                style={{
                  width: '100%', boxSizing: 'border-box', marginBottom: 8,
                  background: 'var(--teams-field, #0d0f13)', color: TEXT, fontSize: 13,
                  border: `1px solid ${HAIRLINE}`, borderRadius: 3,
                  padding: '8px 10px', fontFamily: 'inherit',
                }}
              />
              <textarea
                value={editingScript.body}
                onChange={e => setEditingScript({ ...editingScript, body: e.target.value })}
                placeholder="Write it how you would say it."
                rows={6}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: 'var(--teams-field, #0d0f13)', color: TEXT, fontSize: 13, lineHeight: 1.6,
                  border: `1px solid ${HAIRLINE}`, borderRadius: 3,
                  padding: '8px 10px', fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  style={{
                    ...btn, borderColor: ACCENT, color: '#fff', background: ACCENT,
                    opacity: !editingScript.name.trim() || scriptBusy ? 0.5 : 1,
                  }}
                  disabled={!editingScript.name.trim() || scriptBusy}
                  onClick={savePersonalScript}
                >{scriptBusy ? 'Saving…' : 'Save'}</button>
                <button style={btn} onClick={() => setEditingScript(null)}>Cancel</button>
                {editingScript.id && (
                  <button
                    style={{ ...btn, marginLeft: 'auto', borderColor: '#7f1d1d', color: '#ff6464' }}
                    disabled={scriptBusy}
                    onClick={async () => {
                      const id = editingScript.id!
                      setEditingScript(null)
                      await deletePersonalScript(id)
                    }}
                  >Delete</button>
                )}
              </div>
            </div>
          )}

          {myScriptsPersonal.length === 0 && !editingScript ? (
            <div style={{
              background: PANEL, border: `1px dashed ${HAIRLINE}`, borderRadius: 4,
              padding: 14, fontSize: 12.5, color: DIM, lineHeight: 1.7,
            }}>
              Nothing here yet. Keep your own opener, a rebuttal that keeps
              working, or a note about this list — whatever you want in front of
              you when the call connects.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {myScriptsPersonal.map(sc => (
                <div key={sc.id} style={{
                  background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      onClick={() => setOpenScript(openScript === sc.id ? null : sc.id)}
                      style={{
                        flex: 1, textAlign: 'left', background: 'transparent',
                        border: 0, color: TEXT, fontSize: 13.5, padding: '12px 14px',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{openScript === sc.id ? '▾' : '▸'} {sc.name}</button>
                    <button
                      onClick={() => setEditingScript({ id: sc.id, name: sc.name, body: sc.body })}
                      style={{
                        background: 'transparent', border: 0, color: DIM,
                        fontSize: 11.5, padding: '12px 14px', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >Edit</button>
                  </div>
                  {openScript === sc.id && (
                    <div style={{
                      padding: '0 14px 14px', fontSize: 13, lineHeight: 1.7,
                      color: DIM, whiteSpace: 'pre-wrap',
                    }}>{sc.body || <span style={{ opacity: 0.6 }}>Empty</span>}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── EVERYTHING THEY HAVE DONE HERE ───────────────────────────────
            The full log rather than the last handful: an agent checking their
            own work wants to find a specific call, and "recent" is only useful
            if the one you want happens to be recent.

            A recording is offered only where audio actually exists.
            recording_status 'pending' means one was owed and never began,
            which is a different fact from "not recorded" and must not render
            as a play button that does nothing. */}
        <div style={{ fontSize: 11, letterSpacing: 2, color: DIM, marginBottom: 10 }}>
          YOUR ACTIVITY ON THIS CAMPAIGN
        </div>
        {myRecent.length === 0 ? (
          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
            padding: '16px', fontSize: 12.5, color: DIM, lineHeight: 1.7,
          }}>
            You have not dialed anything on this campaign yet. Calls you make
            will show up here with their outcome, and the recording where there
            is one.
          </div>
        ) : (
          <div style={{
            background: PANEL, border: `1px solid ${HAIRLINE}`,
            borderRadius: 4, maxHeight: 420, overflowY: 'auto',
          }}>
            {myRecent.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '10px 14px',
                borderTop: i === 0 ? 'none' : `1px solid ${HAIRLINE}`,
                fontSize: 12.5,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: TEXT }}>{c.disposition || 'No disposition'}</div>
                  <div style={{ color: DIM, fontSize: 11, marginTop: 2 }}>
                    {new Date(c.at).toLocaleString(undefined, {
                      month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                    {' · '}
                    {Math.floor(c.seconds / 60)}:{String(c.seconds % 60).padStart(2, '0')}
                  </div>
                </div>
                {c.hasRecording ? (
                  <a
                    href={`/dashboard/recordings?campaign_id=${encodeURIComponent(data.id)}`}
                    style={{
                      fontSize: 11.5, color: ACCENT, textDecoration: 'none',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >▶ Recording</a>
                ) : (
                  <span style={{ fontSize: 11, color: DIM, flexShrink: 0 }}>—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

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
        {/* ── STATE, NOT INSTRUCTION ──────────────────────────────────────
            This read "Pause" / "Activate" — what the click would DO. Every
            other status chip in the product names what IS, so the same word in
            the same place meant two opposite things depending on which screen
            you were on. Now it reports the state and clicking flips it: green
            ACTIVE, amber INACTIVE. One click, no dialog — reversible, and
            something an owner does between calls. */}
        <button
          style={{
            ...btn,
            color: paused ? '#fbbf24' : '#4ade80',
            borderColor: paused ? '#fbbf24' : '#4ade80',
            letterSpacing: 0.6,
          }}
          disabled={busy}
          onClick={() => patch({ status: paused ? 'active' : 'inactive' })}
        >{paused ? 'Inactive' : 'Active'}</button>
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
        {/* No "Remaining" box. It was total minus dialed, sitting beside both
            of them, and the same number is stated twice more below — in the
            progress bar's percentage and in the Leads section's "N left to
            dial". Three ways to read one figure is not three pieces of
            information. */}
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

      {!isCampaignOwner && (
        // Said once, at the top of the settings, rather than repeated on every
        // disabled control — and rather than silently hiding them, which makes
        // a page look like it is missing features instead of scoped to you.
        <div style={{
          background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
          padding: '11px 14px', marginTop: 26,
          fontSize: 12.5, color: DIM, lineHeight: 1.7,
        }}>
          This campaign belongs to whoever created it, so its settings are theirs
          to change. You can still manage who on your team dials it.
        </div>
      )}

      {/* Three sections share this gate, so it needs a fragment — a bare
          conditional can only wrap one element. */}
      {/* Renaming sits with the other things only the campaign's creator may
          change. A prompt rather than a modal here: this panel has no modal
          host of its own, and adding one for a single text field would be
          more machinery than the job needs. */}
      {isCampaignOwner && onRename && (
        <div style={{ marginBottom: 18 }}>
          <button
            style={btn}
            onClick={() => onRename('campaign', data.id, data.name)}
            disabled={busy}
          >Rename campaign</button>
        </div>
      )}

      {isCampaignOwner && (<>
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
                background: 'var(--teams-field, #0d0f13)', color: TEXT, fontSize: 12,
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

          {/* ── AND A WAY TO ACTUALLY HEAR THEM ──────────────────────────
              Recording was a switch with no destination. An owner could turn
              it on and had no route from here to the audio it produced —
              they had to know the Recordings page existed, open it, and find
              this campaign in a dropdown of all of them.

              Deep-linked to this campaign, so it opens on these calls rather
              than the whole floor. Shown only once recording is on: a link to
              an empty page is a worse answer than no link. */}
          {data.recordingEnabled && (
            <a
              href={`/dashboard/recordings?campaign_id=${encodeURIComponent(data.id)}`}
              style={{
                display: 'inline-block', marginTop: 10,
                fontSize: 12.5, color: ACCENT, textDecoration: 'none',
              }}
            >Listen to this campaign&apos;s recordings →</a>
          )}
        </div>
      </Section>

      {/* ── LEAD DRIP ─────────────────────────────────────────────────────
          A webhook rather than a connector per CRM. Every CRM, every lead
          vendor and every automation tool already speaks "POST some JSON to a
          URL" — building a GoHighLevel connector, then a HubSpot one, then a
          Salesforce one is three integrations that each break on somebody
          else's release schedule. */}
      <Section title="Lead Drip">
        {!data.ingestEnabled ? (
          <div>
            <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.75, marginBottom: 10 }}>
              Give your lead source a URL and leads land here as they come in —
              including in the middle of a live session. Agents already dialing
              this campaign will reach them without restarting anything.
              <br />
              Works with any CRM, Zapier, Make, a Google Sheet, or a script.
            </div>
            <button
              style={{ ...btn, borderColor: ACCENT, color: '#fff', background: ACCENT }}
              disabled={busy}
              onClick={() => setIngest('enable')}
            >Turn on lead drip</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{
              background: PANEL, border: `1px solid ${HAIRLINE}`,
              borderRadius: 4, padding: '12px 14px',
            }}>
              <div style={{
                fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                color: MUTED, marginBottom: 6,
              }}>Send leads here</div>
              {data.ingestToken ? (
                <>
                  <code style={{
                    display: 'block', fontSize: 11.5, color: TEXT,
                    background: 'var(--teams-inset, #111214)', padding: '9px 11px', borderRadius: 3,
                    wordBreak: 'break-all', lineHeight: 1.6,
                  }}>{origin}/api/ingest/leads/{data.ingestToken}</code>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      style={btn}
                      onClick={() => {
                        navigator.clipboard?.writeText(`${origin}/api/ingest/leads/${data.ingestToken}`)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 1600)
                      }}
                    >{copied ? 'Copied' : 'Copy URL'}</button>
                    {/* Rotating is how you cut off a vendor you have stopped
                        working with. Named for what it does to them, not for
                        what it does to the string. */}
                    <button style={btn} disabled={busy} onClick={() => setIngest('rotate')}>
                      New URL
                    </button>
                    <button style={btn} disabled={busy} onClick={() => setIngest('disable')}>
                      Turn off
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: DIM, marginTop: 9, lineHeight: 1.7 }}>
                    Treat this URL as a password — anyone holding it can add leads
                    to this campaign. <strong style={{ color: MUTED }}>New URL</strong>{' '}
                    stops the old one working immediately, which is how you cut off
                    a source you have finished with.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.7 }}>
                  Lead drip is on for this campaign. Only the person who created
                  the campaign can see the URL.
                </div>
              )}
            </div>

            {data.ingestToken && (
              <div style={{
                background: PANEL, border: `1px solid ${HAIRLINE}`,
                borderRadius: 4, padding: '12px 14px',
                fontSize: 11.5, color: DIM, lineHeight: 1.75,
              }}>
                <div style={{
                  fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                  color: MUTED, marginBottom: 6,
                }}>What to send</div>
                <code style={{
                  display: 'block', fontSize: 11, color: TEXT,
                  background: 'var(--teams-inset, #111214)', padding: '9px 11px', borderRadius: 3,
                  whiteSpace: 'pre', overflowX: 'auto', lineHeight: 1.7,
                }}>{`{ "phone": "5551234567",
  "first_name": "Jane",
  "last_name": "Doe",
  "state": "TX" }`}</code>
                {/* Said plainly because it is the thing that stops setup
                    failing: most senders assume our field names must match
                    theirs exactly, and give up on the second rejection. */}
                <div style={{ marginTop: 8 }}>
                  Only the phone number is required. Field names are matched
                  loosely — <code>Phone Number</code>, <code>mobile</code> and{' '}
                  <code>cell</code> all work, as do <code>firstName</code> and{' '}
                  <code>First Name</code>. Anything we do not recognise is kept
                  on the lead rather than dropped. Send one lead, an array, or{' '}
                  <code>{'{"leads":[...]}'}</code> — up to 500 at a time.
                </div>
                <div style={{ marginTop: 6 }}>
                  Repeat numbers already on this campaign are ignored, so a source
                  that resends will not call anyone twice.
                </div>
              </div>
            )}

            {ingestLog.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                  color: MUTED, margin: '4px 0 6px',
                }}>Recent deliveries</div>
                <div style={{ display: 'grid', gap: 5 }}>
                  {ingestLog.map((e: any) => (
                    <div key={e.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: PANEL,
                      border: `1px solid ${e.ok ? HAIRLINE : '#b45309'}`,
                      borderRadius: 4, padding: '8px 12px', fontSize: 11.5,
                    }}>
                      <span style={{ color: e.ok ? '#4ade80' : '#fbbf24' }}>
                        {e.ok ? '✓' : '!'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, color: TEXT }}>
                        {e.message}
                        {e.duplicates > 0 && (
                          <span style={{ color: DIM }}> · {e.duplicates} already here</span>
                        )}
                        {e.rejected > 0 && (
                          <span style={{ color: DIM }}> · {e.rejected} unusable</span>
                        )}
                      </span>
                      <span style={{ color: DIM, flexShrink: 0 }}>
                        {new Date(e.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
      </>)}

      <Section
        title="Who Can Dial It"
        action={team ? (
          <button
            style={{ ...btn, borderColor: ACCENT, color: '#fff', background: ACCENT }}
            onClick={() => setPickerOpen(true)}
          >+ Add People</button>
        ) : undefined}
      >
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

      {pickerOpen && team && (
        <div
          onClick={() => setPickerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.62)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 460, maxHeight: '80vh', display: 'flex',
              flexDirection: 'column',
              background: 'var(--teams-page-bg, #1e1f22)', border: `1px solid ${HAIRLINE}`,
              borderRadius: 6, padding: '20px 22px',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 600, color: TEXT }}>Add people</div>
            <div style={{ fontSize: 12, color: DIM, marginTop: 3, marginBottom: 14 }}>
              Adding somebody costs nothing — their seat is already paid for.
            </div>

            {/* The standing rule sits above the name list, because if it is what
                they want then the list below is beside the point. */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
              padding: '11px 13px', marginBottom: 12, cursor: busy ? 'wait' : 'pointer',
            }}>
              <input
                type="checkbox"
                checked={team.accessMode === 'free'}
                disabled={busy}
                onChange={e => setOpenToTeam(e.target.checked)}
                style={{ accentColor: ACCENT, marginTop: 2 }}
              />
              <span>
                <span style={{ display: 'block', fontSize: 13, color: TEXT }}>
                  Anyone who joins {team.name} can use it
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: DIM, marginTop: 3, lineHeight: 1.6 }}>
                  A standing rule, not a one-off — people who join later get it
                  automatically. Ticking every name below only covers the people
                  who are here today.
                </span>
              </span>
            </label>

            {team.accessMode === 'free' ? (
              <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.7 }}>
                This campaign is open to the whole team, so there is nobody left
                to add individually.
              </div>
            ) : available.length === 0 ? (
              <div style={{ fontSize: 12.5, color: DIM, lineHeight: 1.7 }}>
                Everyone on {team.name} is already on this campaign.
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 11.5, color: DIM, marginBottom: 6,
                }}>
                  <span>{available.length} on {team.name}</span>
                  <button
                    onClick={() => setPicked(
                      picked.size === available.length
                        ? new Set()
                        : new Set(available.map(m => m.memberId))
                    )}
                    style={{
                      background: 'transparent', border: 'none', color: ACCENT,
                      fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{picked.size === available.length ? 'Clear all' : 'Select all'}</button>
                </div>

                <div style={{ overflowY: 'auto', display: 'grid', gap: 5, minHeight: 0 }}>
                  {available.map(m => {
                    const on = picked.has(m.memberId)
                    return (
                      <label
                        key={m.memberId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: PANEL,
                          border: `1px solid ${on ? ACCENT : HAIRLINE}`,
                          borderRadius: 4, padding: '9px 12px', cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setPicked(prev => {
                            const next = new Set(prev)
                            if (next.has(m.memberId)) next.delete(m.memberId)
                            else next.add(m.memberId)
                            return next
                          })}
                          style={{ accentColor: ACCENT }}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13, color: TEXT }}>{m.name}</span>
                          {m.email && m.email !== m.name && (
                            <span style={{ display: 'block', fontSize: 11, color: DIM }}>{m.email}</span>
                          )}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={btn} onClick={() => { setPickerOpen(false); setPicked(new Set()) }}>
                Close
              </button>
              {team.accessMode !== 'free' && available.length > 0 && (
                <button
                  onClick={addPicked}
                  disabled={picked.size === 0 || busy}
                  style={{
                    ...btn,
                    borderColor: picked.size === 0 || busy ? HAIRLINE : ACCENT,
                    background: picked.size === 0 || busy ? 'transparent' : ACCENT,
                    color: picked.size === 0 || busy ? DIM : '#fff',
                    cursor: picked.size === 0 || busy ? 'not-allowed' : 'pointer',
                  }}
                >{busy ? 'Adding…' : `Add ${picked.size || ''}`.trim()}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
