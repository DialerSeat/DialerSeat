'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'














type Phase = 'redeeming' | 'pending' | 'error'

export default function JoinRedeemClient({ code }: { code: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('redeeming')
  const [message, setMessage] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return // guard against double-invoke in strict mode
    ranRef.current = true

    ;(async () => {
      try {
        const res = await fetch('/api/teams/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data = await res.json()

        if (!data.success) {
          setPhase('error')
          setMessage(data.error || 'This link could not be redeemed.')
          return
        }

        setTeamName(data.team?.name || '')

        if (data.nextStep === 'redirect_to_billing') {
          setMessage(`Joined ${data.team?.name || 'the team'}. Taking you to billing…`)
          const billingUrl = data.member?.id
            ? `/billing?teamMemberId=${encodeURIComponent(data.member.id)}`
            : '/billing'
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
        setPhase('error')
        setMessage(err?.message || 'Something went wrong redeeming this link.')
      }
    })()
  }, [code, router])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--brand-page-bg, #f0f1f4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Futura PT', Futura, sans-serif",
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: 'var(--brand-card-surface, #e2e4ea)',
        border: '1px solid var(--brand-card-border, #c4c8d0)',
        borderTop: '3px solid var(--brand-primary, #2a4a8a)',
        borderRadius: 6, padding: 32, textAlign: 'center',
        color: 'var(--brand-on-page-bg, #1a1c24)',
      }}>
        {phase === 'redeeming' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: 'var(--brand-primary, #2a4a8a)', marginBottom: 14 }}>
              JOINING…
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--brand-muted-text, #5a5e6a)' }}>
              {message || 'Setting up your seat — one moment.'}
            </div>
          </>
        )}

        {phase === 'pending' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: '#8a6a1a', marginBottom: 14 }}>
              PENDING APPROVAL
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--brand-muted-text, #5a5e6a)', marginBottom: 20 }}>
              {message}
            </div>
            <button
              onClick={() => router.push('/dashboard/teams')}
              style={{
                padding: '12px 24px', background: 'var(--brand-primary, #2a4a8a)', color: 'white',
                border: 'none', borderRadius: 4, fontSize: 11, letterSpacing: 3, fontWeight: 'bold',
                cursor: 'pointer', fontFamily: "'Futura PT', Futura, sans-serif",
              }}
            >GO TO TEAMS</button>
          </>
        )}

        {phase === 'error' && (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 'bold', color: '#8a1a1a', marginBottom: 14 }}>
              COULDN&apos;T JOIN
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--brand-muted-text, #5a5e6a)', marginBottom: 20 }}>
              {message}
            </div>
            <button
              onClick={() => router.push('/dashboard/teams')}
              style={{
                padding: '12px 24px', background: 'transparent', color: 'var(--brand-primary, #2a4a8a)',
                border: '1px solid var(--brand-primary, #2a4a8a)', borderRadius: 4,
                fontSize: 11, letterSpacing: 3, fontWeight: 'bold',
                cursor: 'pointer', fontFamily: "'Futura PT', Futura, sans-serif",
              }}
            >GO TO TEAMS</button>
          </>
        )}
      </div>
    </div>
  )
}