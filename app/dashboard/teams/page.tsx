'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SeatLinksPanel from '@/components/teams/SeatLinksPanel'
import RosterPanel from '@/components/teams/RosterPanel'

















const T = {
  bg: 'var(--brand-page-bg)',
  surface: 'var(--brand-card-surface)',
  border: 'var(--brand-card-border)',
  dark: 'var(--brand-sidebar-bg)',
  text: 'var(--brand-on-page-bg)',
  muted: 'var(--brand-muted-text)',
  accent: '#2a4a8a',
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

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
  team_id: string
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
interface OwnedTeam {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  viewerRole: 'owner'
  members: TeamMember[]
  pendingMembers: TeamMember[]
  codes: TeamCode[]
  teamCampaigns: TeamCampaignRow[]
}
interface MemberTeam {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  viewerRole: 'member'
}
type Team = OwnedTeam | MemberTeam

interface TeamsResponse {
  success: boolean
  teams: { owned: OwnedTeam[]; member: MemberTeam[] }
}

interface Campaign {
  id: string
  name: string
  status: string
}

type AccessMode = 'owner_pays' | 'agent_pays' | 'public' | 'free'

const SURFACE_LIFT = 'color-mix(in srgb, var(--brand-card-surface) 85%, var(--brand-on-page-bg) 15%)'

function displayName(u: TeamUser, fallback: string): string {
  const fn = (u.first_name || '').trim()
  const ln = (u.last_name || '').trim()
  const full = [fn, ln].filter(Boolean).join(' ')
  if (full) return full
  if (u.email) return u.email
  return fallback
}

export default function TeamsPage() {
  const { user } = useUser()
  const router = useRouter()

  const [ownedTeams, setOwnedTeams] = useState<OwnedTeam[]>([])
  const [memberTeams, setMemberTeams] = useState<MemberTeam[]>([])
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

  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({})
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editTeam, setEditTeam] = useState<OwnedTeam | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteTeamStage, setDeleteTeamStage] = useState<{
    team: OwnedTeam
    stage: 'confirm' | 'type'
  } | null>(null)
  const [deleteTypedConfirm, setDeleteTypedConfirm] = useState('')
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const [attachModalTeam, setAttachModalTeam] = useState<OwnedTeam | null>(null)
  const [attachCampaignId, setAttachCampaignId] = useState<string>('')
  const [attachAccessMode, setAttachAccessMode] = useState<AccessMode>('owner_pays')
  const [attachCampaigns, setAttachCampaigns] = useState<Campaign[]>([])
  const [attachSubmitting, setAttachSubmitting] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)

  const [grantTarget, setGrantTarget] = useState<{ team: OwnedTeam; member: TeamMember } | null>(null)
  const [grantCampaignId, setGrantCampaignId] = useState('')
  const [grantPayer, setGrantPayer] = useState<'owner' | 'agent' | 'free'>('owner')
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  const [confirmState, setConfirmState] = useState<{
    title: string
    body: string
    confirmWord: string
    danger: boolean
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/teams/list?detail=owned')
      const data: TeamsResponse = await res.json()
      if (data.success) {
        const owned = data.teams.owned || []
        setOwnedTeams(owned)
        setMemberTeams(data.teams.member || [])
        if (owned.length === 1) {
          setExpandedTeams({ [owned[0].id]: true })
        }
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

  const loadCampaigns = useCallback(async (): Promise<Campaign[]> => {
    try {
      const res = await fetch('/api/campaigns/list')
      const data = await res.json()
      if (data.success && Array.isArray(data.campaigns)) {
        return data.campaigns.map((c: any) => ({ id: c.id, name: c.name, status: c.status }))
      }
    } catch (err) {
      console.error('Load campaigns error:', err)
    }
    return []
  }, [])

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
        setRedeemMessage({ type: 'info', text: `Joined ${data.team.name}. Redirecting to billing to complete your subscription...` })
        setTimeout(() => router.push('/billing'), 1200)
      } else if (data.nextStep === 'awaiting_owner_approval') {
        setRedeemMessage({ type: 'success', text: `Code redeemed for ${data.team.name}. Your request is pending approval from the team owner.` })
        setRedeemCode('')
        loadTeams()
      } else if (data.nextStep === 'redirect_to_team') {
        setRedeemMessage({ type: 'success', text: `Joined ${data.team.name}. Redirecting...` })
        setTimeout(() => router.push(`/dashboard/teams/${data.team.id}/analytics`), 1000)
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
      router.push(`/dashboard/teams/${data.team.id}/analytics`)
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create team')
      setCreating(false)
    }
  }

  const toggleExpanded = (teamId: string) => {
    setExpandedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }))
  }

  const acceptMember = async (m: TeamMember) => {
    setActioningId(m.id)
    setActionError(null)
    try {
      const res = await fetch('/api/teams/members/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: m.id }),
      })
      const data = await res.json()
      if (!data.success) {
        if (res.status === 402) {
          setActionError('A payment method is required on file before accepting an owner-paid seat. Add a card in /billing first.')
        } else {
          setActionError(data.error || 'Failed to accept')
        }
        return
      }
      await loadTeams()
    } catch (err: any) {
      setActionError(err.message || 'Failed to accept')
    } finally {
      setActioningId(null)
    }
  }

  const rejectMember = async (m: TeamMember) => {
    setActioningId(m.id)
    setActionError(null)
    try {
      const res = await fetch('/api/teams/members/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: m.id }),
      })
      const data = await res.json()
      if (!data.success) {
        setActionError(data.error || 'Failed to reject')
        return
      }
      await loadTeams()
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject')
    } finally {
      setActioningId(null)
    }
  }

  const removeMember = (m: TeamMember) => {
    setConfirmState({
      title: 'KICK MEMBER',
      body: `Remove ${displayName(m.user, 'this member')} from the team? They lose all campaign access and any owner-paid subs end at period close. Refunds for partial periods are only available via dispute through the cardholder's bank. Type "remove" to confirm.`,
      confirmWord: 'remove',
      danger: true,
      onConfirm: async () => {
        const res = await fetch('/api/teams/members/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: m.id, confirm: 'remove' }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Failed to remove')
        await loadTeams()
      },
    })
  }

  const payerForMode = (mode: AccessMode): 'owner' | 'agent' | 'free' => {
    if (mode === 'owner_pays') return 'owner'
    if (mode === 'free') return 'free'
    return 'agent'
  }

  const openGrantModal = (team: OwnedTeam, member: TeamMember) => {
    const memberAccessIds = new Set(member.campaignAccess.map(a => a.campaignId))
    const firstAvailable = team.teamCampaigns.find(tc => !memberAccessIds.has(tc.campaignId))
    setGrantTarget({ team, member })
    setGrantCampaignId(firstAvailable?.campaignId || '')
    if (firstAvailable) {
      setGrantPayer(payerForMode(firstAvailable.accessMode))
    } else {
      setGrantPayer('owner')
    }
    setGrantError(null)
  }

  const submitGrant = async () => {
    if (!grantTarget || !grantCampaignId) {
      setGrantError('Select a campaign')
      return
    }
    setGrantSubmitting(true)
    setGrantError(null)
    try {
      const res = await fetch('/api/teams/access/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: grantTarget.member.id,
          campaignId: grantCampaignId,
          payer: grantPayer,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        if (res.status === 402) {
          setGrantError('No payment method on file. Add a card in /billing, then try again.')
        } else if (res.status === 409) {
          setGrantError('This member already has access to that campaign.')
        } else {
          setGrantError(data.error || 'Failed to grant access')
        }
        return
      }
      setGrantTarget(null)
      setGrantCampaignId('')
      await loadTeams()
    } catch (err: any) {
      setGrantError(err.message || 'Failed to grant access')
    } finally {
      setGrantSubmitting(false)
    }
  }

  const reinstateMember = (team: OwnedTeam, member: TeamMember) => {
    if (team.teamCampaigns.length === 1) {
      const tc = team.teamCampaigns[0]
      const payer = payerForMode(tc.accessMode)
      doInstantGrant(member, tc.campaignId, payer)
      return
    }
    openGrantModal(team, member)
  }

  const doInstantGrant = async (member: TeamMember, campaignId: string, payer: 'owner' | 'agent' | 'free') => {
    setActioningId(member.id)
    setActionError(null)
    try {
      const res = await fetch('/api/teams/access/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, campaignId, payer }),
      })
      const data = await res.json()
      if (!data.success) {
        if (res.status === 402) {
          setActionError('No payment method on file. Add a card in /billing, then try again.')
        } else {
          setActionError(data.error || 'Failed to reinstate')
        }
        return
      }
      await loadTeams()
    } catch (err: any) {
      setActionError(err.message || 'Failed to reinstate')
    } finally {
      setActioningId(null)
    }
  }

  const revokeAccess = (team: OwnedTeam, member: TeamMember, access: MemberCampaignAccess, campaignName: string) => {
    setConfirmState({
      title: 'REVOKE CAMPAIGN ACCESS',
      body: `Revoke ${displayName(member.user, 'this member')}'s access to "${campaignName}"? Their seat sub for this campaign ends at period close. They stay on the team and can be reinstated anytime. Refunds for partial periods are only available via dispute through the cardholder's bank. Type "remove" to confirm.`,
      confirmWord: 'remove',
      danger: true,
      onConfirm: async () => {
        const res = await fetch('/api/teams/access/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: team.id,
            memberId: member.id,
            campaignId: access.campaignId,
            confirm: 'remove',
          }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Failed to revoke')
        await loadTeams()
      },
    })
  }

  const openAttachModal = async (team: OwnedTeam) => {
    setAttachModalTeam(team)
    setAttachCampaignId('')
    setAttachAccessMode('owner_pays')
    setAttachError(null)
    const list = await loadCampaigns()
    const attachedIds = new Set(team.teamCampaigns.map(tc => tc.campaignId))
    setAttachCampaigns(list.filter(c => !attachedIds.has(c.id)))
  }

  const submitAttach = async () => {
    if (!attachModalTeam || !attachCampaignId) {
      setAttachError('Select a campaign')
      return
    }
    setAttachSubmitting(true)
    setAttachError(null)
    try {
      const res = await fetch('/api/teams/campaigns/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: attachModalTeam.id,
          campaignId: attachCampaignId,
          accessMode: attachAccessMode,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setAttachError(data.error || 'Failed to attach campaign')
        return
      }
      setAttachModalTeam(null)
      await loadTeams()
    } catch (err: any) {
      setAttachError(err.message || 'Failed to attach campaign')
    } finally {
      setAttachSubmitting(false)
    }
  }

  const updateCampaignAccess = async (
    teamId: string,
    campaignId: string,
    accessMode: AccessMode
  ) => {
    setActioningId(`${teamId}:${campaignId}`)
    setActionError(null)
    try {
      const res = await fetch('/api/teams/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, campaignId, accessMode }),
      })
      const data = await res.json()
      if (!data.success) {
        setActionError(data.error || 'Failed to update access')
        return
      }
      await loadTeams()
    } catch (err: any) {
      setActionError(err.message || 'Failed to update access')
    } finally {
      setActioningId(null)
    }
  }

  const detachCampaign = (teamId: string, campaignId: string, campaignName: string) => {
    setConfirmState({
      title: 'DETACH CAMPAIGN',
      body: `Detach "${campaignName}" from this team? Member access to this campaign will be revoked. Owner-paid seat subs tied to this campaign end at period close. Refunds for partial periods are only available via dispute through the cardholder's bank. Type "remove" to confirm.`,
      confirmWord: 'remove',
      danger: true,
      onConfirm: async () => {
        const res = await fetch('/api/teams/campaigns/detach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId, campaignId, confirm: 'remove' }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Failed to detach')
        await loadTeams()
      },
    })
  }

  const submitConfirm = async () => {
    if (!confirmState) return
    if (confirmInput.trim().toLowerCase() !== confirmState.confirmWord.toLowerCase()) return
    setConfirmSubmitting(true)
    setActionError(null)
    try {
      await confirmState.onConfirm()
      setConfirmState(null)
      setConfirmInput('')
    } catch (err: any) {
      setActionError(err.message || 'Action failed')
    } finally {
      setConfirmSubmitting(false)
    }
  }

  const openEditModal = (team: OwnedTeam) => {
    setEditTeam(team)
    setEditName(team.name)
    setEditDesc(team.description || '')
    setEditError(null)
  }

  const submitEdit = async () => {
    if (!editTeam) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/teams/${editTeam.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      })
      const data = await res.json()
      if (!data.success) {
        setEditError(data.error || 'Failed to update')
        return
      }
      setEditTeam(null)
      await loadTeams()
    } catch (err: any) {
      setEditError(err.message || 'Failed to update')
    } finally {
      setEditSubmitting(false)
    }
  }

  const startDeleteTeam = (team: OwnedTeam) => {
    setDeleteTeamStage({ team, stage: 'confirm' })
    setDeleteTypedConfirm('')
  }

  const proceedToDeleteType = () => {
    if (!deleteTeamStage) return
    setDeleteTeamStage({ ...deleteTeamStage, stage: 'type' })
  }

  const submitDeleteTeam = async () => {
    if (!deleteTeamStage) return
    if (deleteTypedConfirm.trim().toLowerCase() !== 'delete') return
    setDeleteSubmitting(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/teams/${deleteTeamStage.team.id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'remove' }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to delete')
      setDeleteTeamStage(null)
      setDeleteTypedConfirm('')
      await loadTeams()
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const allTeams: Team[] = [...ownedTeams, ...memberTeams]
  const hasAnyTeam = allTeams.length > 0
  const totalPending = ownedTeams.reduce((sum, t) => sum + t.pendingMembers.length, 0)

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      fontFamily: FUTURA,
      color: T.text,
    }}>
      {/* C6: header strip bound to var(--brand-header-bg); stats to var(--brand-on-header-muted) */}
      <div style={{
        background: 'var(--brand-header-bg)',
        padding: '12px 20px',
        borderBottom: '2px solid var(--brand-header-top-accent)',
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
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--brand-on-header-muted)', letterSpacing: 1 }}>
            {ownedTeams.length} OWNED · {memberTeams.length} MEMBER
            {totalPending > 0 && ` · ${totalPending} PENDING`}
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
        >+ CREATE A TEAM</button>
      </div>

      <div style={{ flex: 1, padding: '16px 20px', maxWidth: 1000, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* REDEEM CODE */}
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderTop: `3px solid ${T.blue}`,
          borderRadius: 4,
          padding: '16px 20px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: T.muted, fontWeight: 'bold', marginBottom: 8 }}>▸ HAVE A CODE?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Enter team code"
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') handleRedeem() }}
              disabled={redeeming}
              style={{
                flex: '1 1 200px', minWidth: 0, padding: '14px 16px',
                background: T.bg, border: `1px solid ${T.border}`, borderRadius: 3,
                fontFamily: 'monospace', fontSize: 18, color: T.text, outline: 'none',
                letterSpacing: 2, textTransform: 'uppercase', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleRedeem}
              disabled={!redeemCode.trim() || redeeming}
              style={{
                padding: '14px 24px', background: T.dark, border: 'none', borderRadius: 3,
                borderTop: `3px solid ${T.blue}`, color: T.blue,
                fontSize: 13, fontWeight: 'bold', letterSpacing: 3,
                cursor: !redeemCode.trim() || redeeming ? 'not-allowed' : 'pointer',
                opacity: !redeemCode.trim() || redeeming ? 0.5 : 1,
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}
            >{redeeming ? '...' : 'REDEEM'}</button>
          </div>
          {redeemMessage && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 3, fontSize: 11, letterSpacing: 1,
              background:
                redeemMessage.type === 'success' ? '#e8f5e8' :
                redeemMessage.type === 'error' ? '#f8e8e8' : '#e8eef8',
              border: `1px solid ${
                redeemMessage.type === 'success' ? T.green :
                redeemMessage.type === 'error' ? T.red : T.accent
              }`,
              color:
                redeemMessage.type === 'success' ? T.green :
                redeemMessage.type === 'error' ? T.red : T.accent,
            }}>{redeemMessage.text}</div>
          )}
        </div>

        {actionError && (
          <div style={{
            background: '#f8e8e8', border: `1px solid ${T.red}`, color: T.red,
            padding: '10px 14px', borderRadius: 3, fontSize: 12, letterSpacing: 1,
            marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} style={{
              background: 'transparent', border: 'none', color: T.red,
              cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
            }}>×</button>
          </div>
        )}

        {memberTeams.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, letterSpacing: 3, color: T.muted, fontWeight: 'bold',
              marginBottom: 10, paddingLeft: 4,
            }}>▸ TEAMS YOU&apos;VE JOINED</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {memberTeams.map(team => (
                <Link key={team.id} href={`/dashboard/teams/${team.id}/analytics`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderLeft: `3px solid ${T.accent}`, borderRadius: 3,
                    padding: '14px 16px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12, cursor: 'pointer',
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
                      padding: '3px 10px', borderRadius: 3, fontSize: 9, fontWeight: 'bold', letterSpacing: 2,
                      background: 'rgba(42,74,138,0.12)', color: T.accent, border: `1px solid ${T.accent}`,
                      whiteSpace: 'nowrap',
                    }}>MEMBER</div>
                    <div style={{ fontSize: 16, color: T.muted }}>›</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {ownedTeams.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, letterSpacing: 3, color: T.muted, fontWeight: 'bold',
              marginBottom: 10, paddingLeft: 4,
            }}>▸ TEAMS YOU OWN</div>

            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 11, letterSpacing: 2, color: T.muted }}>
                LOADING...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ownedTeams.map(team => {
                  const isExpanded = !!expandedTeams[team.id]
                  const pendingCount = team.pendingMembers.length
                  const memberCount = team.members.length
                  const codeCount = team.codes.length
                  const campaignCount = team.teamCampaigns.length

                  return (
                    <div key={team.id} style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderLeft: `3px solid ${T.blue}`, borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div
                        onClick={() => toggleExpanded(team.id)}
                        style={{
                          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                          cursor: 'pointer', userSelect: 'none',
                          background: isExpanded ? SURFACE_LIFT : T.surface,
                          borderBottom: isExpanded ? `1px solid ${T.border}` : 'none',
                        }}
                      >
                        <div style={{
                          fontSize: 14, color: T.muted,
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                        }}>›</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 'bold', color: T.text,
                            letterSpacing: 1, marginBottom: 3,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{team.name}</div>
                          <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, fontFamily: 'monospace' }}>
                            {memberCount} MEMBER{memberCount === 1 ? '' : 'S'} · {codeCount} CODE{codeCount === 1 ? '' : 'S'} · {campaignCount} CAMPAIGN{campaignCount === 1 ? '' : 'S'}
                            {pendingCount > 0 && (
                              <span style={{ color: T.amber, fontWeight: 'bold' }}> · {pendingCount} PENDING</span>
                            )}
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/teams/${team.id}/analytics`}
                          onClick={e => e.stopPropagation()}
                          style={{
                            padding: '5px 10px', background: 'transparent', border: `1px solid ${T.border}`,
                            borderRadius: 3, color: T.muted,
                            fontSize: 9, fontWeight: 'bold', letterSpacing: 2,
                            textDecoration: 'none', whiteSpace: 'nowrap',
                          }}
                        >OPEN ›</Link>
                        <div style={{
                          padding: '3px 10px', borderRadius: 3, fontSize: 9, fontWeight: 'bold', letterSpacing: 2,
                          background: 'var(--brand-primary-soft)', color: T.blue, border: `1px solid ${T.blue}`,
                          whiteSpace: 'nowrap',
                        }}>OWNER</div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '16px 18px', background: T.surface }}>

                          <Section title="ROSTER" accent={T.accent}>
                            <RosterPanel
                              pendingMembers={team.pendingMembers}
                              activeMembers={team.members}
                              codes={team.codes}
                              teamCampaigns={team.teamCampaigns}
                              actioningId={actioningId}
                              onAccept={acceptMember}
                              onReject={rejectMember}
                              onKick={removeMember}
                              onReinstate={m => reinstateMember(team, m)}
                              onAddCampaign={m => openGrantModal(team, m)}
                              onRevokeAccess={(m, a, cName) => revokeAccess(team, m, a, cName)}
                            />
                          </Section>

                          <Section
                            title={`ATTACHED CAMPAIGNS (${campaignCount})`}
                            accent={T.accent}
                            action={(
                              <button onClick={() => openAttachModal(team)} style={btnPrimary(false)}>+ ATTACH</button>
                            )}
                          >
                            {campaignCount === 0 ? (
                              <EmptyHint text="No campaigns attached. Attach a campaign to grant team members access to its leads." />
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {team.teamCampaigns.map(tc => {
                                  const busy = actioningId === `${team.id}:${tc.campaignId}`
                                  return (
                                    <div key={tc.campaignId} style={{
                                      background: T.bg, border: `1px solid ${T.border}`, borderRadius: 3,
                                      padding: '8px 12px', display: 'flex', alignItems: 'center',
                                      gap: 10, flexWrap: 'wrap',
                                    }}>
                                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                        <div style={{
                                          fontSize: 12, fontWeight: 'bold', color: T.text, letterSpacing: 0.5,
                                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>
                                          {tc.campaign?.name || '(deleted campaign)'}
                                        </div>
                                        {tc.campaign && (
                                          <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', marginTop: 2 }}>
                                            {tc.campaign.called_leads} / {tc.campaign.total_leads} called
                                          </div>
                                        )}
                                      </div>
                                      <select
                                        value={tc.accessMode}
                                        onChange={e => updateCampaignAccess(team.id, tc.campaignId, e.target.value as AccessMode)}
                                        disabled={busy}
                                        style={{
                                          padding: '5px 8px', background: T.surface,
                                          border: `1px solid ${T.border}`, borderRadius: 3,
                                          fontSize: 10, fontFamily: 'monospace', letterSpacing: 1,
                                          color: T.text, cursor: busy ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        <option value="owner_pays">OWNER PAYS</option>
                                        <option value="agent_pays">AGENT PAYS</option>
                                        <option value="public">PUBLIC</option>
                                        <option value="free">FREE</option>
                                      </select>
                                      <button
                                        onClick={() => detachCampaign(team.id, tc.campaignId, tc.campaign?.name || 'this campaign')}
                                        disabled={busy}
                                        style={btnSubtle(busy, T.red)}
                                      >DETACH</button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </Section>

                          <Section title={`SEAT LINKS (${codeCount})`} accent={T.accent}>
                            <SeatLinksPanel
                              teamId={team.id}
                              codes={team.codes}
                              teamCampaigns={team.teamCampaigns}
                              onChanged={loadTeams}
                            />
                          </Section>

                          <div style={{
                            marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.border}`,
                            display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap',
                          }}>
                            <button onClick={() => openEditModal(team)} style={btnSubtle(false, T.muted)}>
                              EDIT TEAM
                            </button>
                            <button onClick={() => startDeleteTeam(team)} style={btnSubtle(false, T.red)}>
                              DELETE TEAM
                            </button>
                          </div>

                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!loading && !hasAnyTeam && (
          <div style={{
            background: T.surface, border: `1px dashed ${T.border}`,
            borderRadius: 4, padding: '32px 24px', textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: T.muted, marginBottom: 6 }}>
              NO TEAMS YET
            </div>
            <div style={{ fontSize: 12, color: T.muted, letterSpacing: 0.5 }}>
              Redeem a code above to join a team, or create your own.
            </div>
          </div>
        )}

        {/* ── ▸ WHAT IS A DIALERSEAT TEAM? — header row with FAQ link top-right ── */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${T.blue}`, borderRadius: 4,
          padding: '28px 32px', marginBottom: 16,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}>
            <div style={{
              fontSize: 13, letterSpacing: 4, color: T.muted, fontWeight: 'bold',
            }}>▸ WHAT IS A DIALERSEAT TEAM?</div>
            <Link
              href="/faq/dialerseat-teams"
              target="_blank"
              rel="noopener"
              style={{
                padding: '8px 16px',
                background: T.dark,
                border: 'none',
                borderTop: `3px solid ${T.blue}`,
                borderRadius: 3,
                color: T.blue,
                fontSize: 10,
                letterSpacing: 2.5,
                fontWeight: 'bold',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                fontFamily: FUTURA,
              }}
            >READ THE FULL FAQ →</Link>
          </div>

          <p style={{
            fontSize: 18, lineHeight: 1.7, color: T.text, marginBottom: 24, marginTop: 0,
          }}>
            DialerSeat Teams lets lead vendors and agency owners distribute their premium lead campaign access to other agents on the platform. There are two ways teams work:
          </p>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 'bold', color: T.blue, letterSpacing: 2, marginBottom: 10 }}>
              ▸ AS AN AGENT
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: T.text, margin: 0 }}>
              A team owner can give you access to their lead campaigns by sending you a code. Some team owners pay your $35 weekly seat for you. Others require you to subscribe yourself for $35 to access their leads. Either way, you join with a code from the team owner.
            </p>
          </div>

          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 'bold', color: T.blue, letterSpacing: 2, marginBottom: 10 }}>
              ▸ AS AN OWNER
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: T.text, margin: 0 }}>
              You generate your own leads and want to give other agents access to them — usually because you charge them above-cost as a lead vendor or agency. Build teams, attach your campaigns, generate codes for your agents. You decide per code: do you pay the $35 weekly seat for them, or do they pay it themselves?
            </p>
          </div>

          <div style={{
            background: T.bg, border: `1px solid ${T.border}`, borderRadius: 3,
            padding: '14px 18px', marginTop: 22,
          }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: T.muted, letterSpacing: 2, marginBottom: 8 }}>
              COST
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: T.text, margin: 0 }}>
              <strong>$35 per active seat per week</strong>, paid to DialerSeat. Whether you (the owner) pay or your agent pays is up to you per agent and per campaign. Codes you create can be set to either payer.
            </p>
          </div>
        </div>
      </div>

      {/* SUB GATE MODAL */}
      {showSubGate && (
        <div onClick={() => setShowSubGate(false)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{
            ...modalShellStyle, background: T.dark, borderTop: `3px solid #ffaa3e`,
            color: 'var(--brand-on-sidebar)', textAlign: 'center', maxWidth: 440,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 4, color: '#ffaa3e', marginBottom: 12 }}>
              SUBSCRIPTION REQUIRED
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--brand-on-sidebar-muted)', letterSpacing: 1, marginBottom: 24 }}>
              Creating teams requires an active personal subscription. Subscribe for $35/week to upload your own leads, build teams, and start selling seats to other agents.
            </p>
            <Link href="/billing" style={{
              display: 'block', padding: '14px 24px',
              background: 'transparent',
              border: `1px solid #ffaa3e`, borderRadius: 4, color: '#ffaa3e',
              fontSize: 12, fontWeight: 'bold', letterSpacing: 4, textDecoration: 'none', marginBottom: 10,
              fontFamily: FUTURA,
            }}>SUBSCRIBE — $35/WEEK</Link>
            <button onClick={() => setShowSubGate(false)} style={{
              background: 'transparent', border: 'none', color: 'var(--brand-on-sidebar-muted)',
              fontSize: 11, letterSpacing: 2, cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif', padding: 8,
            }}>CLOSE</button>
          </div>
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {showCreateModal && (
        <div onClick={() => !creating && setShowCreateModal(false)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalShellStyle, borderTop: `3px solid ${T.blue}` }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: T.blue, marginBottom: 16 }}>+ CREATE A TEAM</div>
            <FieldLabel>TEAM NAME</FieldLabel>
            <input
              type="text" value={createName} onChange={e => setCreateName(e.target.value)}
              placeholder="Premium Leads" disabled={creating} autoFocus style={modalInput}
            />
            <div style={{ height: 12 }} />
            <FieldLabel>DESCRIPTION</FieldLabel>
            <textarea
              value={createDesc} onChange={e => setCreateDesc(e.target.value)}
              placeholder="What's this team for?" disabled={creating} rows={3}
              style={{ ...modalInput, fontSize: 12, resize: 'vertical' }}
            />
            {createError && <ErrorInline text={createError} />}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowCreateModal(false)} disabled={creating} style={modalCancelBtn(creating)}>CANCEL</button>
              <button onClick={handleCreateSubmit} disabled={!createName.trim() || creating} style={modalConfirmBtn(!createName.trim() || creating, T.blue)}>
                {creating ? '...' : '▶ CREATE TEAM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editTeam && (
        <div onClick={() => !editSubmitting && setEditTeam(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalShellStyle, borderTop: `3px solid ${T.blue}` }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: T.blue, marginBottom: 16 }}>EDIT TEAM</div>
            <FieldLabel>TEAM NAME</FieldLabel>
            <input
              type="text" value={editName} onChange={e => setEditName(e.target.value)}
              disabled={editSubmitting} autoFocus style={modalInput}
            />
            <div style={{ height: 12 }} />
            <FieldLabel>DESCRIPTION</FieldLabel>
            <textarea
              value={editDesc} onChange={e => setEditDesc(e.target.value)}
              disabled={editSubmitting} rows={3}
              style={{ ...modalInput, fontSize: 12, resize: 'vertical' }}
            />
            {editError && <ErrorInline text={editError} />}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setEditTeam(null)} disabled={editSubmitting} style={modalCancelBtn(editSubmitting)}>CANCEL</button>
              <button onClick={submitEdit} disabled={!editName.trim() || editSubmitting} style={modalConfirmBtn(!editName.trim() || editSubmitting, T.blue)}>
                {editSubmitting ? '...' : '▶ SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TWO-STAGE DELETE TEAM MODAL */}
      {deleteTeamStage && (
        <div onClick={() => !deleteSubmitting && (setDeleteTeamStage(null), setDeleteTypedConfirm(''))} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalShellStyle, borderTop: `3px solid ${T.red}` }}>
            {deleteTeamStage.stage === 'confirm' ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: T.red, marginBottom: 14 }}>
                  DELETE TEAM
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: T.text, margin: '0 0 8px 0' }}>
                  Are you sure you want to delete <strong>{deleteTeamStage.team.name}</strong>?
                </p>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: T.muted, margin: '0 0 16px 0' }}>
                  All members lose access. Owner-paid seat subscriptions end at period close. Refunds for partial periods are only available via dispute through the cardholder&apos;s bank. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setDeleteTeamStage(null)} style={modalCancelBtn(false)}>NO, KEEP TEAM</button>
                  <button onClick={proceedToDeleteType} style={modalConfirmBtn(false, T.red)}>YES, DELETE →</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: T.red, marginBottom: 14 }}>
                  CONFIRM DELETE
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: T.text, margin: '0 0 14px 0' }}>
                  Type <strong style={{ color: T.red, fontFamily: 'monospace' }}>delete</strong> to permanently remove <strong>{deleteTeamStage.team.name}</strong>.
                </p>
                <input
                  type="text" value={deleteTypedConfirm}
                  onChange={e => setDeleteTypedConfirm(e.target.value)}
                  placeholder='type "delete"' autoFocus disabled={deleteSubmitting}
                  style={modalInput}
                />
                {actionError && <ErrorInline text={actionError} />}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => { setDeleteTeamStage(null); setDeleteTypedConfirm('') }} disabled={deleteSubmitting} style={modalCancelBtn(deleteSubmitting)}>
                    CANCEL
                  </button>
                  <button
                    onClick={submitDeleteTeam}
                    disabled={deleteSubmitting || deleteTypedConfirm.trim().toLowerCase() !== 'delete'}
                    style={modalConfirmBtn(deleteSubmitting || deleteTypedConfirm.trim().toLowerCase() !== 'delete', T.red)}
                  >{deleteSubmitting ? '...' : '▶ DELETE FOREVER'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* NEW CODE MODAL */}
      {/* ATTACH CAMPAIGN MODAL */}
      {attachModalTeam && (
        <div onClick={() => !attachSubmitting && setAttachModalTeam(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalShellStyle, borderTop: `3px solid ${T.blue}` }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: T.blue, marginBottom: 4 }}>+ ATTACH CAMPAIGN</div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 18, letterSpacing: 1 }}>
              to {attachModalTeam.name}
            </div>

            {attachCampaigns.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, padding: '16px 0' }}>
                You have no remaining campaigns to attach. Either all your campaigns are already attached, or you haven&apos;t created any yet.{' '}
                <Link href="/dashboard/campaigns" style={{ color: T.blue }}>Go to campaigns →</Link>
              </div>
            ) : (
              <>
                <FieldLabel>CAMPAIGN</FieldLabel>
                <select
                  value={attachCampaignId}
                  onChange={e => setAttachCampaignId(e.target.value)}
                  disabled={attachSubmitting}
                  style={{ ...modalInput, fontSize: 12, padding: '10px 12px', marginBottom: 14 }}
                >
                  <option value="">Select a campaign…</option>
                  {attachCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <FieldLabel>ACCESS MODE</FieldLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {([
                    { v: 'owner_pays', t: 'OWNER PAYS', d: 'You pay $35/wk per agent who joins. Agents dial without paying.' },
                    { v: 'agent_pays', t: 'AGENT PAYS', d: 'Agents must have their own $35/wk sub to access.' },
                    { v: 'public', t: 'PUBLIC', d: 'Any active subscriber can access without a code.' },
                    { v: 'free', t: 'FREE', d: 'No per-seat fee for owner or agents. Members still need their own $35/wk DialerSeat sub to dial — free here means free campaign access, not free platform access.' },
                  ] as const).map(opt => (
                    <label key={opt.v} style={{
                      display: 'flex', gap: 10, padding: '10px 12px',
                      background: attachAccessMode === opt.v ? SURFACE_LIFT : T.surface,
                      border: `1px solid ${attachAccessMode === opt.v ? T.blue : T.border}`,
                      borderRadius: 3, cursor: 'pointer',
                    }}>
                      <input
                        type="radio" name="access_mode" value={opt.v}
                        checked={attachAccessMode === opt.v}
                        onChange={() => setAttachAccessMode(opt.v)}
                        style={{ marginTop: 2 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 2, color: T.text }}>{opt.t}</div>
                        <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{opt.d}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            {attachError && <ErrorInline text={attachError} />}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAttachModalTeam(null)} disabled={attachSubmitting} style={modalCancelBtn(attachSubmitting)}>CANCEL</button>
              {attachCampaigns.length > 0 && (
                <button
                  onClick={submitAttach}
                  disabled={attachSubmitting || !attachCampaignId}
                  style={modalConfirmBtn(attachSubmitting || !attachCampaignId, T.blue)}
                >{attachSubmitting ? '...' : '▶ ATTACH'}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GRANT/ADD-CAMPAIGN MODAL */}
      {grantTarget && (() => {
        const accessibleIds = new Set(grantTarget.member.campaignAccess.map(a => a.campaignId))
        const remaining = grantTarget.team.teamCampaigns.filter(tc => !accessibleIds.has(tc.campaignId))
        const selectedTC = remaining.find(t => t.campaignId === grantCampaignId)
        const selectedMode: AccessMode | undefined = selectedTC?.accessMode
        return (
          <div onClick={() => !grantSubmitting && setGrantTarget(null)} style={overlayStyle}>
            <div onClick={e => e.stopPropagation()} style={{ ...modalShellStyle, borderTop: `3px solid ${T.blue}` }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: T.blue, marginBottom: 4 }}>
                + ADD CAMPAIGN ACCESS
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 18, letterSpacing: 1 }}>
                for {displayName(grantTarget.member.user, grantTarget.member.user_id.slice(0, 12))}
              </div>

              {remaining.length === 0 ? (
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, padding: '12px 0' }}>
                  This member already has access to all campaigns attached to this team.
                </div>
              ) : (
                <>
                  <FieldLabel>CAMPAIGN</FieldLabel>
                  <select
                    value={grantCampaignId}
                    onChange={e => {
                      setGrantCampaignId(e.target.value)
                      const tc = remaining.find(t => t.campaignId === e.target.value)
                      if (tc) setGrantPayer(payerForMode(tc.accessMode))
                    }}
                    disabled={grantSubmitting}
                    style={{ ...modalInput, fontSize: 12, padding: '10px 12px', marginBottom: 14 }}
                  >
                    <option value="">Select a campaign…</option>
                    {remaining.map(tc => (
                      <option key={tc.campaignId} value={tc.campaignId}>
                        {tc.campaign?.name || tc.campaignId}
                        {tc.accessMode === 'free' ? ' — FREE' : ''}
                      </option>
                    ))}
                  </select>

                  {selectedMode === 'free' ? (
                    <div style={{
                      padding: '10px 12px',
                      background: 'rgba(42,74,138,0.08)',
                      border: `1px solid ${T.accent}`, borderRadius: 3,
                      fontSize: 11, color: T.accent, lineHeight: 1.5,
                    }}>
                      ▸ FREE campaign — no per-seat charge to you or the agent. Agent still needs their own $35/wk DialerSeat sub to dial.
                    </div>
                  ) : (
                    <>
                      <FieldLabel>WHO PAYS THE $35/WEEK?</FieldLabel>
                      <SegmentedTwo
                        left={{ label: 'OWNER PAYS', value: 'owner', desc: 'Charged to your card immediately.' }}
                        right={{ label: 'AGENT PAYS', value: 'agent', desc: 'Uses their existing $35/wk sub.' }}
                        value={grantPayer === 'free' ? 'owner' : grantPayer}
                        onChange={v => setGrantPayer(v as 'owner' | 'agent')}
                      />

                      {grantPayer === 'owner' && (
                        <div style={{
                          marginTop: 12, padding: '8px 12px',
                          background: 'rgba(255,170,62,0.1)',
                          border: `1px solid ${T.amber}`, borderRadius: 3,
                          fontSize: 11, color: T.amber, lineHeight: 1.5,
                        }}>
                          ⚠ This will start a $35/wk charge on your card on file at the next billing cycle.
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {grantError && <ErrorInline text={grantError} />}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={() => setGrantTarget(null)} disabled={grantSubmitting} style={modalCancelBtn(grantSubmitting)}>
                  CANCEL
                </button>
                {remaining.length > 0 && (
                  <button
                    onClick={submitGrant}
                    disabled={grantSubmitting || !grantCampaignId}
                    style={modalConfirmBtn(grantSubmitting || !grantCampaignId, T.blue)}
                  >{grantSubmitting ? '...' : '▶ GRANT ACCESS'}</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* GENERIC TYPED CONFIRM MODAL */}
      {confirmState && (
        <div onClick={() => !confirmSubmitting && (setConfirmState(null), setConfirmInput(''))} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{
            ...modalShellStyle,
            borderTop: `3px solid ${confirmState.danger ? T.red : T.blue}`,
          }}>
            <div style={{
              fontSize: 12, fontWeight: 'bold', letterSpacing: 4,
              color: confirmState.danger ? T.red : T.blue, marginBottom: 14,
            }}>{confirmState.title}</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: T.text, margin: '0 0 16px 0' }}>{confirmState.body}</p>
            <input
              type="text" value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
              placeholder={`type "${confirmState.confirmWord}"`}
              autoFocus disabled={confirmSubmitting} style={modalInput}
            />
            {actionError && <ErrorInline text={actionError} />}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => { setConfirmState(null); setConfirmInput('') }} disabled={confirmSubmitting} style={modalCancelBtn(confirmSubmitting)}>
                CANCEL
              </button>
              <button
                onClick={submitConfirm}
                disabled={confirmSubmitting || confirmInput.trim().toLowerCase() !== confirmState.confirmWord.toLowerCase()}
                style={modalConfirmBtn(
                  confirmSubmitting || confirmInput.trim().toLowerCase() !== confirmState.confirmWord.toLowerCase(),
                  confirmState.danger ? T.red : T.blue
                )}
              >{confirmSubmitting ? '...' : '▶ CONFIRM'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, accent, action, children }: {
  title: string; accent: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: accent, fontWeight: 'bold' }}>▸ {title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      background: 'var(--brand-page-bg)', border: '1px dashed var(--brand-card-border)', borderRadius: 3,
      padding: '12px 14px', fontSize: 11, color: 'var(--brand-muted-text)',
      letterSpacing: 0.5, lineHeight: 1.5,
    }}>{text}</div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 9, letterSpacing: 2, color: 'var(--brand-muted-text)',
      fontWeight: 'bold', marginBottom: 6,
    }}>{children}</label>
  )
}

function SegmentedTwo({ left, right, value, onChange }: {
  left: { label: string; value: string; desc: string }
  right: { label: string; value: string; desc: string }
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[left, right].map(opt => {
        const selected = value === opt.value
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            flex: 1, padding: '10px 12px', textAlign: 'left',
            background: selected
              ? 'color-mix(in srgb, var(--brand-card-surface) 85%, var(--brand-on-page-bg) 15%)'
              : 'var(--brand-card-surface)',
            border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--brand-card-border)'}`,
            borderRadius: 3, cursor: 'pointer',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
              color: selected ? 'var(--brand-primary)' : 'var(--brand-on-page-bg)', marginBottom: 4,
            }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: 'var(--brand-muted-text)', lineHeight: 1.4 }}>{opt.desc}</div>
          </button>
        )
      })}
    </div>
  )
}

function ErrorInline({ text }: { text: string }) {
  return (
    <div style={{
      background: '#f8e8e8', border: `1px solid ${T.red}`, color: T.red,
      padding: '8px 12px', borderRadius: 3, fontSize: 11, letterSpacing: 1, marginTop: 8,
    }}>{text}</div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 20,
}

const modalShellStyle: React.CSSProperties = {
  background: 'var(--brand-page-bg)', border: '1px solid var(--brand-card-border)',
  borderRadius: 4, padding: 28, maxWidth: 480, width: '100%',
  fontFamily: 'Futura PT, Futura, sans-serif',
}

const modalInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--brand-card-surface)', border: '1px solid var(--brand-card-border)', borderRadius: 3,
  fontFamily: 'monospace', fontSize: 13, color: 'var(--brand-on-page-bg)',
  outline: 'none', boxSizing: 'border-box',
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', background: 'var(--brand-sidebar-bg)', border: 'none', borderRadius: 3,
    borderTop: '2px solid var(--brand-primary)', color: 'var(--brand-primary)',
    fontSize: 10, fontWeight: 'bold', letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontFamily: 'Futura PT, Futura, sans-serif', whiteSpace: 'nowrap',
  }
}

function btnDanger(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', background: 'transparent', border: '1px solid #8a1a1a',
    borderRadius: 3, color: '#8a1a1a',
    fontSize: 10, fontWeight: 'bold', letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontFamily: 'Futura PT, Futura, sans-serif', whiteSpace: 'nowrap',
  }
}

function btnSubtle(disabled: boolean, color: string): React.CSSProperties {
  return {
    padding: '5px 10px', background: 'transparent', border: `1px solid ${color}`,
    borderRadius: 3, color,
    fontSize: 9, fontWeight: 'bold', letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontFamily: 'Futura PT, Futura, sans-serif', whiteSpace: 'nowrap',
  }
}

function modalCancelBtn(disabled: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '10px', background: 'transparent', border: '1px solid var(--brand-card-border)',
    borderRadius: 3, color: 'var(--brand-muted-text)',
    fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Futura PT, Futura, sans-serif',
  }
}

function modalConfirmBtn(disabled: boolean, accent: string): React.CSSProperties {
  return {
    flex: 2, padding: '10px', background: 'var(--brand-sidebar-bg)', border: 'none', borderRadius: 3,
    borderTop: `3px solid ${accent}`, color: accent,
    fontSize: 11, fontWeight: 'bold', letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontFamily: 'Futura PT, Futura, sans-serif',
  }
}