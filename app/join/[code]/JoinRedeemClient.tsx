'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const FUTURA = "'Futura PT', Futura, sans-serif"

type Phase = 'loading' | 'confirm' | 'own_team' | 'already_member' | 'redeeming' | 'pending' | 'error'

interface Preview {
  success: boolean
  error?: string
  isOwnTeam?: boolean
  alreadyMember?: boolean
  memberStatus?: 'active' | 'pending'
  team?: { id: string; name: string }
  brand?: { name: string; logoUrl: string | null } | null
  codeType?: 'seat' | 'recruit'
  payer?: 'owner' | 'agent'
  campaignNames?: string[]
  instant?: boolean
  requiresApproval?: boolean
  requiresPayment?: boolean
  seatCents?: number | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}










export default function JoinRedeemClient({ code }: { code: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/teams/redeem/preview?code=${encodeURIComponent(code)}`)
        const data: Preview = await res.json()
        if (cancelled) return

        if (!data.success) {
          setError(data.error || 'This invite link is invalid or has expired.')
          setPhase('error')
          return
        }

        setPreview(data)
        if (data.isOwnTeam) setPhase('own_team')
        else if (data.alreadyMember) setPhase('already_member')
        else setPhase('confirm')
      } catch {
        if (!cancelled) {
          setError('Something went wrong loading this invite.')
          setPhase('error')
        }
      }
    })()
    return () => { cancelled = true }
  }, [code])

  const handleJoin = async () => {
    setPhase('redeeming')
    try {
      const res = await fetch('/api/teams/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()

      if (!data.success) {
        setError(data.error || 'This link could not be redeemed.')
        setPhase('error')
        return
      }

      if (data.nextStep === 'redirect_to_billing') {
        setMessage(`Joined ${data.team?.name || 'the team'}. Taking you to billing…`)
        // Carry the code through. They are paying for their own seat, so the
        // code that brought them here is what the promo field wants — and
        // asking them to dig it back out of an email would be the product
        // losing something it was already holding.
        const promoParam = `promo=${encodeURIComponent(code)}`
        const billingUrl = data.member?.id
          ? `/billing?teamMemberId=${encodeURIComponent(data.member.id)}&${promoParam}`
          : `/billing?${promoParam}`
        setTimeout(() => router.push(billingUrl), 1000)
      } else if (data.nextStep === 'awaiting_owner_approval') {
        setPhase('pending')
        setMessage(`You've requested to join ${data.team?.name || 'the team'}. The owner needs to approve your seat before you can dial.`)
      } else {
        // redirect_to_dialer — straight to work, not a stats page. Scoped
        // to the team, and to the campaign directly when there's exactly
        // one to dial.
        setMessage(`You're in. Taking you to the dialer…`)
        const params = new URLSearchParams({ teamId: data.team.id })
        if (data.firstCampaignId) params.set('campaignId', data.firstCampaignId)
        setTimeout(() => router.push(`/dashboard/dialer?${params.toString()}`), 1000)
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong redeeming this link.')
      setPhase('error')
    }
  }

  const brandName = preview?.brand?.name || preview?.team?.name || 'DialerSeat'

  const branded = !!preview?.brand
  const C = branded
    ? {
        page: 'var(--brand-page-bg)',
        inset: 'var(--brand-page-bg)',
        card: 'var(--brand-card-surface)',
        border: 'var(--brand-card-border)',
        primary: 'var(--brand-primary)',
        onPrimary: 'var(--brand-on-primary)',
        text: 'var(--brand-on-page-bg)',
        muted: 'var(--brand-muted-text)',
      }
    : {
        page: '#0d0e14',
        inset: '#12141a',
        card: '#1a1c24',
        border: '#2a2c34',
        primary: '#4a9eff',
        onPrimary: '#06080c',
        text: '#e0e2ea',
        muted: '#888a92',
      }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.page,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: FUTURA,
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderTop: `3px solid ${C.primary}`,
        borderRadius: 6, padding: 32, textAlign: 'center',
        color: C.text,
      }}>
        {phase === 'loading' && (
          <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted }}>
            Loading invite…
          </div>
        )}

        {phase === 'confirm' && preview && (
          <>
            <div style={{
              width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
              background: C.primary, color: C.onPrimary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, overflow: 'hidden',
            }}>
              {preview.brand?.logoUrl
                ? <img src={preview.brand.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials(brandName)}
            </div>

            <div style={{ fontSize: 11, letterSpacing: 3, fontWeight: 'bold', color: C.primary, marginBottom: 8 }}>
              YOU&apos;VE BEEN INVITED
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
              Join {preview.team?.name}?
            </div>

            <div style={{
              background: C.inset,
              border: `1px solid ${C.border}`,
              borderRadius: 6, padding: 16, textAlign: 'left', marginBottom: 20,
              fontSize: 13, lineHeight: 1.7,
            }}>
              {preview.codeType === 'recruit' ? (
                <div>You&apos;ll be added to the roster. The team owner assigns campaign access afterward.</div>
              ) : preview.campaignNames && preview.campaignNames.length > 0 ? (
                <div><strong>Campaign access:</strong> {preview.campaignNames.join(', ')}</div>
              ) : (
                <div>No campaigns are attached to this team yet.</div>
              )}

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                {preview.requiresPayment ? (
                  <span>
                    <strong>Cost:</strong> ${((preview.seatCents ?? 3500) / 100).toFixed(2)}/week, billed to you —
                    you&apos;ll set up billing after joining.
                  </span>
                ) : (
                  <span><strong>Cost to you:</strong> $0 — the team owner covers this seat.</span>
                )}
              </div>

              {preview.requiresApproval && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, color: C.muted }}>
                  The owner reviews and approves new members before access turns on.
                </div>
              )}
            </div>

            <button
              onClick={handleJoin}
              style={{
                width: '100%', padding: '14px 24px', background: C.primary, color: C.onPrimary,
                border: 'none', borderRadius: 4, fontSize: 12, letterSpacing: 2, fontWeight: 'bold',
                cursor: 'pointer', fontFamily: FUTURA, marginBottom: 10,
              }}
            >JOIN {preview.team?.name?.toUpperCase()}</button>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                width: '100%', padding: '10px 24px', background: 'transparent', color: C.muted,
                border: 'none', fontSize: 11, letterSpacing: 1, cursor: 'pointer', fontFamily: FUTURA,
              }}
            >Not now</button>
          </>
        )}

        {phase === 'own_team' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: C.primary, marginBottom: 14 }}>
              THIS IS YOUR OWN INVITE
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, marginBottom: 20 }}>
              This invite link is for {preview?.team?.name} — a team you own. Share it with the agent
              you want to add instead.
            </div>
            <button onClick={() => router.push('/dashboard/teams')} style={goToTeamsBtn(C)}>GO TO TEAMS</button>
          </>
        )}

        {phase === 'already_member' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: C.primary, marginBottom: 14 }}>
              {preview?.memberStatus === 'active' ? 'YOU\u2019RE ALREADY IN' : 'ALREADY REQUESTED'}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, marginBottom: 20 }}>
              {preview?.memberStatus === 'active'
                ? `You're already an active member of ${preview?.team?.name}.`
                : `You've already requested to join ${preview?.team?.name} — waiting on the owner's approval.`}
            </div>
            <button
              onClick={() => router.push(preview?.memberStatus === 'active' ? '/dashboard/dialer' : '/dashboard/teams')}
              style={goToTeamsBtn(C)}
            >{preview?.memberStatus === 'active' ? 'GO TO DIALER' : 'GO TO TEAMS'}</button>
          </>
        )}

        {phase === 'redeeming' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: C.primary, marginBottom: 14 }}>
              JOINING…
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted }}>
              {message || 'Setting up your seat — one moment.'}
            </div>
          </>
        )}

        {phase === 'pending' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: '#ffaa3e', marginBottom: 14 }}>
              PENDING APPROVAL
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, marginBottom: 20 }}>
              {message}
            </div>
            <button onClick={() => router.push('/dashboard/teams')} style={goToTeamsBtn(C)}>GO TO TEAMS</button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: '#ff6464', marginBottom: 14 }}>
              COULDN&apos;T JOIN
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, marginBottom: 20 }}>
              {error}
            </div>
            <button
              onClick={() => router.push('/dashboard/teams')}
              style={{
                padding: '12px 24px', background: 'transparent', color: C.primary,
                border: '1px solid var(--brand-primary, #4a9eff)', borderRadius: 4,
                fontSize: 11, letterSpacing: 3, fontWeight: 'bold',
                cursor: 'pointer', fontFamily: FUTURA,
              }}
            >GO TO TEAMS</button>
          </>
        )}
      </div>
    </div>
  )
}

// Takes the palette rather than closing over module scope: which colours this
// button wears depends on whether the invite is tenant-branded, and that is
// only known per render.
const goToTeamsBtn = (C: { primary: string; onPrimary: string }): React.CSSProperties => ({
  padding: '12px 24px', background: C.primary, color: C.onPrimary,
  border: 'none', borderRadius: 4, fontSize: 11, letterSpacing: 3, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: FUTURA,
})