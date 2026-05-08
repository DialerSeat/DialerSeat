'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

interface Team {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  viewerRole: 'owner' | 'member'
}

interface TeamsResponse {
  success: boolean
  teams: { owned: Team[]; member: Team[] }
}

export default function TeamsPage() {
  const { user } = useUser()
  const router = useRouter()

  const [ownedTeams, setOwnedTeams] = useState<Team[]>([])
  const [memberTeams, setMemberTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)

  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMessage, setRedeemMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [showSubGate, setShowSubGate] = useState(false)

  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/teams/list')
      const data: TeamsResponse = await res.json()
      if (data.success) {
        setOwnedTeams(data.teams.owned || [])
        setMemberTeams(data.teams.member || [])
      }
    } catch (err) {
      console.error('Load teams error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) loadTeams()
  }, [user, loadTeams])

  const handleRedeem = async () => {
    const code = redeemCode.trim()
    if (!code) return
    setRedeeming(true)
    setRedeemMessage(null)
    try {
      const res = await fetch('/api/teams/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!data.success) {
        setRedeemMessage({ type: 'error', text: data.error || 'Redemption failed' })
        setRedeeming(false)
        return
      }

      if (data.nextStep === 'redirect_to_billing') {
        setRedeemMessage({
          type: 'info',
          text: `Joined ${data.team.name}. Redirecting to billing to complete your subscription...`,
        })
        setTimeout(() => router.push('/billing'), 1200)
      } else if (data.nextStep === 'awaiting_owner_approval') {
        setRedeemMessage({
          type: 'success',
          text: `Code redeemed for ${data.team.name}. Your request is pending approval from the team owner.`,
        })
        setRedeemCode('')
        loadTeams()
      } else if (data.nextStep === 'redirect_to_team') {
        setRedeemMessage({
          type: 'success',
          text: `Joined ${data.team.name}. Redirecting...`,
        })
        setTimeout(() => router.push(`/dashboard/teams/${data.team.id}`), 1000)
      } else {
        setRedeemMessage({ type: 'success', text: 'Code redeemed.' })
        setRedeemCode('')
        loadTeams()
      }
    } catch (err: any) {
      setRedeemMessage({ type: 'error', text: err.message || 'Redemption failed' })
    } finally {
      setRedeeming(false)
    }
  }

  const handleCreateTeamClick = async () => {
    try {
      const res = await fetch('/api/stripe/status')
      const data = await res.json()
      if (data.tier !== 'active') {
        setShowSubGate(true)
        return
      }
    } catch {
      setShowSubGate(true)
      return
    }
    setShowCreateModal(true)
  }

  const handleCreateSubmit = async () => {
    const name = createName.trim()
    if (!name) {
      setCreateError('Team name required')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/teams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: createDesc.trim() || undefined }),
      })
      const data = await res.json()
      if (!data.success) {
        if (data.reason === 'self_sub_required') {
          setShowCreateModal(false)
          setShowSubGate(true)
        } else {
          setCreateError(data.error || 'Failed to create team')
        }
        setCreating(false)
        return
      }
      setShowCreateModal(false)
      setCreateName('')
      setCreateDesc('')
      router.push(`/dashboard/teams/${data.team.id}`)
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create team')
      setCreating(false)
    }
  }

  const allTeams = [...ownedTeams, ...memberTeams]
  const hasAnyTeam = allTeams.length > 0

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            TEAMS
          </span>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1,
          }}>
            {ownedTeams.length} OWNED · {memberTeams.length} MEMBER
          </span>
        </div>
        <button
          onClick={handleCreateTeamClick}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: `1px solid ${T.blue}`,
            borderRadius: 3,
            color: T.blue,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}
        >
          + CREATE A TEAM
        </button>
      </div>

      <div style={{ flex: 1, padding: '16px 20px', maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderTop: `3px solid ${T.blue}`,
          borderRadius: 4,
          padding: '16px 20px',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: 3, color: T.muted, fontWeight: 'bold', marginBottom: 8,
          }}>▸ HAVE A CODE?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Enter team code"
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') handleRedeem() }}
              disabled={redeeming}
              style={{
                flex: '1 1 200px',
                minWidth: 0,
                padding: '14px 16px',
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 3,
                fontFamily: 'monospace',
                fontSize: 18,
                color: T.text,
                outline: 'none',
                letterSpacing: 2,
                textTransform: 'uppercase',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleRedeem}
              disabled={!redeemCode.trim() || redeeming}
              style={{
                padding: '14px 24px',
                background: T.dark,
                border: 'none',
                borderRadius: 3,
                borderTop: `3px solid ${T.blue}`,
                color: T.blue,
                fontSize: 13,
                fontWeight: 'bold',
                letterSpacing: 3,
                cursor: !redeemCode.trim() || redeeming ? 'not-allowed' : 'pointer',
                opacity: !redeemCode.trim() || redeeming ? 0.5 : 1,
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}
            >
              {redeeming ? '...' : 'REDEEM'}
            </button>
          </div>
          {redeemMessage && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 3,
              fontSize: 11,
              letterSpacing: 1,
              background:
                redeemMessage.type === 'success' ? '#e8f5e8' :
                redeemMessage.type === 'error' ? '#f8e8e8' :
                '#e8eef8',
              border: `1px solid ${
                redeemMessage.type === 'success' ? T.green :
                redeemMessage.type === 'error' ? T.red :
                T.accent
              }`,
              color:
                redeemMessage.type === 'success' ? T.green :
                redeemMessage.type === 'error' ? T.red :
                T.accent,
            }}>{redeemMessage.text}</div>
          )}
        </div>

        {hasAnyTeam && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, letterSpacing: 3, color: T.muted, fontWeight: 'bold',
              marginBottom: 10, paddingLeft: 4,
            }}>▸ YOUR TEAMS</div>
            {loading ? (
              <div style={{
                padding: 20, textAlign: 'center', fontSize: 11, letterSpacing: 2, color: T.muted,
              }}>LOADING...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allTeams.map(team => (
                  <Link
                    key={team.id}
                    href={`/dashboard/teams/${team.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderLeft: `3px solid ${team.viewerRole === 'owner' ? T.blue : T.accent}`,
                      borderRadius: 3,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 'bold', color: T.text,
                          letterSpacing: 1, marginBottom: 3,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{team.name}</div>
                        {team.description && (
                          <div style={{
                            fontSize: 11, color: T.muted, letterSpacing: 0.5,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{team.description}</div>
                        )}
                      </div>
                      <div style={{
                        padding: '3px 10px',
                        borderRadius: 3,
                        fontSize: 9,
                        fontWeight: 'bold',
                        letterSpacing: 2,
                        background: team.viewerRole === 'owner' ? 'rgba(74,158,255,0.12)' : 'rgba(42,74,138,0.12)',
                        color: team.viewerRole === 'owner' ? T.blue : T.accent,
                        border: `1px solid ${team.viewerRole === 'owner' ? T.blue : T.accent}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {team.viewerRole === 'owner' ? 'OWNER' : 'MEMBER'}
                      </div>
                      <div style={{ fontSize: 16, color: T.muted }}>›</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WHAT IS A DIALERSEAT TEAM — bigger fonts */}
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${T.accent}`,
          borderRadius: 4,
          padding: '28px 32px',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 13, letterSpacing: 4, color: T.muted, fontWeight: 'bold', marginBottom: 22,
          }}>▸ WHAT IS A DIALERSEAT TEAM?</div>

          <p style={{
            fontSize: 18, lineHeight: 1.7, color: T.text, marginBottom: 24, marginTop: 0,
          }}>
            DialerSeat Teams lets lead vendors and agency owners distribute their premium lead campaign access to other agents on the platform. There are two ways teams work:
          </p>

          <div style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 15, fontWeight: 'bold', color: T.accent, letterSpacing: 2, marginBottom: 10,
            }}>▸ AS AN AGENT</div>
            <p style={{
              fontSize: 16, lineHeight: 1.7, color: T.text, margin: 0,
            }}>
              A team owner can give you access to their lead campaigns by sending you a code. Some team owners pay your $35 weekly seat for you (you dial their leads for free). Others require you to subscribe yourself for $35 to access their leads. Either way, you join with a code from the team owner.
            </p>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 15, fontWeight: 'bold', color: T.accent, letterSpacing: 2, marginBottom: 10,
            }}>▸ AS AN OWNER</div>
            <p style={{
              fontSize: 16, lineHeight: 1.7, color: T.text, margin: 0,
            }}>
              You generate your own leads and want to give other agents access to them — usually because you charge them above-cost as a lead vendor or agency. Build teams, attach your campaigns, generate codes for your agents. You decide per code: do you pay the $35 weekly seat for them, or do they pay it themselves?
            </p>
          </div>

          <div style={{
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 3,
            padding: '14px 18px',
            marginTop: 22,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 'bold', color: T.muted, letterSpacing: 2, marginBottom: 8,
            }}>COST</div>
            <p style={{
              fontSize: 15, lineHeight: 1.6, color: T.text, margin: 0,
            }}>
              <strong>$35 per active seat per week</strong>, paid to DialerSeat. Whether you (the owner) pay or your agent pays is up to you per agent and per campaign. Codes you create can be set to either payer.
            </p>
          </div>
        </div>
      </div>

      {showSubGate && (
        <div
          onClick={() => setShowSubGate(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.dark,
              border: `1px solid ${T.border}`,
              borderTop: `3px solid #ffaa3e`,
              borderRadius: 4,
              padding: 32,
              maxWidth: 440,
              width: '100%',
              color: '#e0e2ea',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{
              fontSize: 14, fontWeight: 'bold', letterSpacing: 4, color: '#ffaa3e', marginBottom: 12,
            }}>SUBSCRIPTION REQUIRED</div>
            <p style={{
              fontSize: 12, lineHeight: 1.7, color: '#c0c2ca', letterSpacing: 1, marginBottom: 24,
            }}>
              Creating teams requires an active personal subscription. Subscribe for $35/week to upload your own leads, build teams, and start selling seats to other agents.
            </p>
            <Link
              href="/billing"
              style={{
                display: 'block',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                fontSize: 12,
                fontWeight: 'bold',
                letterSpacing: 4,
                textDecoration: 'none',
                marginBottom: 10,
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}
            >SUBSCRIBE — $35/WEEK</Link>
            <button
              onClick={() => setShowSubGate(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#888a92',
                fontSize: 11,
                letterSpacing: 2,
                cursor: 'pointer',
                fontFamily: 'Futura PT, Futura, sans-serif',
                padding: 8,
              }}
            >CLOSE</button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div
          onClick={() => !creating && setShowCreateModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderTop: `3px solid ${T.blue}`,
              borderRadius: 4,
              padding: 28,
              maxWidth: 480,
              width: '100%',
              fontFamily: 'Futura PT, Futura, sans-serif',
            }}
          >
            <div style={{
              fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: T.blue, marginBottom: 16,
            }}>+ CREATE A TEAM</div>

            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', fontSize: 9, letterSpacing: 2, color: T.muted,
                fontWeight: 'bold', marginBottom: 6,
              }}>TEAM NAME</label>
              <input
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder="Premium Leads"
                disabled={creating}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: T.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block', fontSize: 9, letterSpacing: 2, color: T.muted,
                fontWeight: 'bold', marginBottom: 6,
              }}>DESCRIPTION (OPTIONAL)</label>
              <textarea
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                placeholder="What's this team for?"
                disabled={creating}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: T.text,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {createError && (
              <div style={{
                background: '#f8e8e8',
                border: `1px solid ${T.red}`,
                color: T.red,
                padding: '8px 12px',
                borderRadius: 3,
                fontSize: 11,
                letterSpacing: 1,
                marginBottom: 14,
              }}>{createError}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'transparent',
                  border: `1px solid ${T.border}`,
                  borderRadius: 3,
                  color: T.muted,
                  fontSize: 11,
                  fontWeight: 'bold',
                  letterSpacing: 2,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontFamily: 'Futura PT, Futura, sans-serif',
                }}
              >CANCEL</button>
              <button
                onClick={handleCreateSubmit}
                disabled={!createName.trim() || creating}
                style={{
                  flex: 2,
                  padding: '10px',
                  background: T.dark,
                  border: 'none',
                  borderRadius: 3,
                  borderTop: `3px solid ${T.blue}`,
                  color: T.blue,
                  fontSize: 11,
                  fontWeight: 'bold',
                  letterSpacing: 2,
                  cursor: !createName.trim() || creating ? 'not-allowed' : 'pointer',
                  opacity: !createName.trim() || creating ? 0.5 : 1,
                  fontFamily: 'Futura PT, Futura, sans-serif',
                }}
              >{creating ? '...' : '▶ CREATE TEAM'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}