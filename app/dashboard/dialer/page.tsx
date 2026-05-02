'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'

type CallStatus = 'idle' | 'calling' | 'connected' | 'ended'

interface Lead {
  id: string
  first_name: string
  last_name: string
  phone: string
  city: string
  state: string
  campaign_id: string
  dial_attempts?: number
  extra_data: Record<string, any>
}

interface Campaign {
  id: string
  name: string
  status: string
  total_leads: number
  script?: string
}

export default function DialerPage() {
  const { user } = useUser()
  const [status, setStatus] = useState<CallStatus>('idle')
  const [manualNumber, setManualNumber] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [available, setAvailable] = useState(false)
  const [disposition, setDisposition] = useState('')
  const [showDisposition, setShowDisposition] = useState(false)
  const [currentLead, setCurrentLead] = useState<Lead | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [callStart, setCallStart] = useState(0)
  const [noLeads, setNoLeads] = useState(false)
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [swReady, setSwReady] = useState(false)
  const [micGranted, setMicGranted] = useState(false)
  const [sessionStats, setSessionStats] = useState({
    calls: 0, appointments: 0, closed: 0, dnc: 0, notInterested: 0
  })
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activePollRef = useRef<NodeJS.Timeout | null>(null)
  const swClientRef = useRef<any>(null)
  const swCallRef = useRef<any>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (user) fetchCampaigns()
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const warmUp = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        const buffer = audioCtxRef.current.createBuffer(1, 1, 22050)
        const source = audioCtxRef.current.createBufferSource()
        source.buffer = buffer
        source.connect(audioCtxRef.current.destination)
        source.start()
      }
      window.removeEventListener('click', warmUp)
      window.removeEventListener('keydown', warmUp)
    }
    window.addEventListener('click', warmUp)
    window.addEventListener('keydown', warmUp)
    return () => {
      window.removeEventListener('click', warmUp)
      window.removeEventListener('keydown', warmUp)
    }
  }, [])

  useEffect(() => {
    const initSW = async () => {
      try {
        const sipUsername = process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_USERNAME
        const sipPassword = process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_PASSWORD
        const sipDomain = process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_DOMAIN

        if (!sipUsername || !sipPassword || !sipDomain) {
          console.warn('SignalWire SIP credentials not configured')
          return
        }

        const { UserAgent, Registerer } = await import('sip.js')
        const uri = UserAgent.makeURI(`sip:${sipUsername}@${sipDomain}`)
        if (!uri) { console.error('Failed to create SIP URI'); return }

        const userAgent = new UserAgent({
          uri,
          authorizationUsername: sipUsername,
          authorizationPassword: sipPassword,
          transportOptions: { server: `wss://${sipDomain}` },
          sessionDescriptionHandlerFactoryOptions: {
            constraints: { audio: true, video: false },
          },
        })

        userAgent.delegate = {
          onInvite: async (invitation: any) => {
            console.log('> Incoming SIP INVITE received from SignalWire!')
            try {
              const { SessionState: SS } = await import('sip.js')

              // Listen for state changes BEFORE accepting
              invitation.stateChange.addListener((state: any) => {
                console.log('> Incoming call state:', state)
                if (state === SS.Established) {
                  console.log('> Call ESTABLISHED — attaching audio')
                  swCallRef.current = invitation
                  attachSIPAudio(invitation)
                } else if (state === SS.Terminated) {
                  console.log('> SIP call terminated')
                  if (swCallRef.current === invitation) swCallRef.current = null
                }
              })

              await invitation.accept({
                sessionDescriptionHandlerOptions: {
                  constraints: { audio: true, video: false },
                },
              })
              console.log('> Accepted incoming SIP invite')
            } catch (err) {
              console.error('Error accepting SIP invite:', err)
            }
          },
        }

        await userAgent.start()
        console.log('> SIP UserAgent started')

        const registerer = new Registerer(userAgent)
        await registerer.register()
        console.log('> SIP registered successfully!')

        swClientRef.current = userAgent
        setSwReady(true)
        console.log('> SignalWire browser audio ready — waiting for incoming calls')
      } catch (err: any) {
        console.error('SignalWire init error:', err?.message || err)
      }
    }
    initSW()
  }, [])

  const attachSIPAudio = (session: any) => {
    const tryAttach = () => {
      try {
        const sdh = session.sessionDescriptionHandler
        if (!sdh) return false
        const pc = sdh.peerConnection
        if (!pc) return false

        pc.ontrack = (event: RTCTrackEvent) => {
          console.log('> Got remote audio track!')
          if (event.streams && event.streams[0]) {
            let audioEl = document.getElementById('sip-audio') as HTMLAudioElement
            if (!audioEl) {
              audioEl = document.createElement('audio')
              audioEl.id = 'sip-audio'
              audioEl.autoplay = true
              document.body.appendChild(audioEl)
            }
            audioEl.srcObject = event.streams[0]
            audioEl.play().then(() => console.log('> Audio playing!')).catch(console.error)
          }
        }

        pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
          if (receiver.track && receiver.track.kind === 'audio') {
            console.log('> Found existing audio track!')
            const stream = new MediaStream([receiver.track])
            let audioEl = document.getElementById('sip-audio') as HTMLAudioElement
            if (!audioEl) {
              audioEl = document.createElement('audio')
              audioEl.id = 'sip-audio'
              audioEl.autoplay = true
              document.body.appendChild(audioEl)
            }
            audioEl.srcObject = stream
            audioEl.play().then(() => console.log('> Existing audio playing!')).catch(console.error)
          }
        })

        console.log('> Audio listener attached to peer connection')
        return true
      } catch (err) {
        console.error('attachSIPAudio error:', err)
        return false
      }
    }

    if (!tryAttach()) {
      setTimeout(() => tryAttach(), 500)
      setTimeout(() => tryAttach(), 1500)
      setTimeout(() => tryAttach(), 3000)
    } else {
      setTimeout(() => tryAttach(), 1000)
    }
  }

  const handleSetAvailable = async () => {
    if (!micGranted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        setMicGranted(true)
        console.log('> Microphone permission granted')
      } catch (err) {
        console.warn('Microphone permission denied:', err)
      }
    }
    setAvailable(v => !v)
  }

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return audioCtxRef.current
  }

  const playInitiateBlip = () => {
    const ctx = getAudioCtx()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    gain.connect(ctx.destination)
    const osc = ctx.createOscillator()
    osc.frequency.value = 660
    osc.connect(gain)
    osc.start()
    osc.stop(ctx.currentTime + 0.18)
  }

  const playDTMF = (key: string) => {
    const freqs: Record<string, [number, number]> = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
    }
    const ctx = getAudioCtx()
    const pair = freqs[key]
    if (!pair) return
    const duration = 0.4
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    gainNode.connect(ctx.destination)
    pair.forEach(freq => {
      const osc = ctx.createOscillator()
      osc.frequency.value = freq
      osc.connect(gainNode)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    })
  }

  const playPickup = () => {
    const ctx = getAudioCtx()
    ;[0, 0.11].forEach((delay, i) => {
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, ctx.currentTime + delay)
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + delay + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3)
      gain.connect(ctx.destination)
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = i === 0 ? 1046 : 1318
      osc.connect(gain)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.3)
    })
  }

  const hangupCall = async (sid: string | null) => {
    if (!sid) return
    if (activePollRef.current) clearInterval(activePollRef.current)
    activePollRef.current = null
    if (swCallRef.current) {
      try {
        if (swCallRef.current.bye) await swCallRef.current.bye()
        else if (swCallRef.current.hangup) await swCallRef.current.hangup()
      } catch {}
      swCallRef.current = null
    }
    await fetch('/api/calls/hangup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid }),
    })
    setActiveCallSid(null)
  }

  const fetchCampaigns = async () => {
    const res = await fetch(`/api/campaigns/list?user_id=${user?.id}`)
    const data = await res.json()
    if (data.success) setCampaigns(data.campaigns.filter((c: Campaign) => c.status === 'active'))
  }

  const fetchNextLead = async () => {
    const params = new URLSearchParams({ user_id: user?.id || '' })
    if (selectedCampaign !== 'all') params.append('campaign_id', selectedCampaign)
    const res = await fetch(`/api/leads/next?${params}`)
    const data = await res.json()
    console.log('fetchNextLead result:', data)
    if (data.success) {
      setCurrentLead(data.lead)
      setNoLeads(false)
      return data.lead
    } else {
      setNoLeads(true)
      return null
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const now = new Date()
  const timeStr = mounted ? now.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'
  const dateStr = mounted ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''

  useEffect(() => {
    if (status === 'connected') {
      setCallStart(Date.now())
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (status !== 'calling') setSeconds(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  const startCallPolling = (callSid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/calls/check?sid=${callSid}`)
        const statusData = await statusRes.json()
        console.log('Call status:', statusData.status)

        if (statusData.status === 'in-progress') {
          clearInterval(pollInterval)
          activePollRef.current = null
          playPickup()
          setStatus('connected')

          const hangupPoll = setInterval(async () => {
            try {
              const res = await fetch(`/api/calls/check?sid=${callSid}`)
              const d = await res.json()
              console.log('Connected status check:', d.status)
              if (d.status === 'completed' || d.status === 'canceled' || d.status === 'failed') {
                clearInterval(hangupPoll)
                activePollRef.current = null
                setActiveCallSid(null)
                if (swCallRef.current) {
                  try { await swCallRef.current.bye() } catch {}
                  swCallRef.current = null
                }
                setStatus('ended')
                setShowDisposition(true)
              }
            } catch {
              clearInterval(hangupPoll)
              activePollRef.current = null
            }
          }, 2000)
          activePollRef.current = hangupPoll

        } else if (
          statusData.status === 'completed' ||
          statusData.status === 'busy' ||
          statusData.status === 'failed' ||
          statusData.status === 'no-answer' ||
          statusData.status === 'canceled'
        ) {
          clearInterval(pollInterval)
          activePollRef.current = null
          setActiveCallSid(null)
          if (currentLead) {
            await fetch('/api/leads/dispose', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lead_id: currentLead.id,
                campaign_id: currentLead.campaign_id,
                user_id: user?.id,
                disposition: 'NO_ANSWER',
                duration: 0,
              }),
            })
          }
          setStatus('idle')
          setCurrentLead(null)
          setTimeout(() => handleDial(), 800)
        }
      } catch (err) {
        clearInterval(pollInterval)
        activePollRef.current = null
      }
    }, 1500)
    activePollRef.current = pollInterval
  }

  const handleDial = async () => {
    setShowDisposition(false)
    setDisposition('')
    setNoLeads(false)
    const lead = await fetchNextLead()
    if (!lead) return

    const rawPhone = lead.phone?.replace(/\D/g, '')
    if (!rawPhone || rawPhone.length < 10) {
      await fetch('/api/leads/dispose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          campaign_id: lead.campaign_id,
          user_id: user?.id,
          disposition: 'SKIPPED',
          duration: 0,
        }),
      })
      setCurrentLead(null)
      setTimeout(() => handleDial(), 300)
      return
    }

    setStatus('calling')
    setSessionStats(s => ({ ...s, calls: s.calls + 1 }))
    playInitiateBlip()

    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: lead.phone }),
      })
      const data = await res.json()
      console.log('Call initiated:', data)

      if (data.success) {
        setActiveCallSid(data.callSid)
        startCallPolling(data.callSid)
        // No more dialIntoConference — SignalWire will INVITE us via the SIP credential
        // and our onInvite handler will auto-accept it.
      } else {
        console.error('Call failed:', data.error)
        await fetch('/api/leads/dispose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            campaign_id: lead.campaign_id,
            user_id: user?.id,
            disposition: 'SKIPPED',
            duration: 0,
          }),
        })
        setStatus('idle')
        setCurrentLead(null)
        setTimeout(() => handleDial(), 500)
      }
    } catch (error) {
      console.error('Call error:', error)
      setStatus('idle')
      setCurrentLead(null)
    }
  }

  const handleSkip = async () => {
    if (activePollRef.current) clearInterval(activePollRef.current)
    if (activeCallSid) await hangupCall(activeCallSid)
    if (currentLead) {
      await fetch('/api/leads/dispose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: currentLead.id,
          campaign_id: currentLead.campaign_id,
          user_id: user?.id,
          disposition: 'SKIPPED',
          duration: Math.floor((Date.now() - callStart) / 1000),
        }),
      })
    }
    setCurrentLead(null)
    setStatus('idle')
    setTimeout(() => handleDial(), 300)
  }

  const handleDisposition = async (disp: string) => {
    if (disp === 'SKIP') { handleSkip(); return }
    setDisposition(disp)
    setSessionStats(s => ({
      ...s,
      appointments: disp === 'APPOINTMENT' ? s.appointments + 1 : s.appointments,
      closed: disp === 'CLOSED' ? s.closed + 1 : s.closed,
      dnc: disp === 'DO NOT CALL' ? s.dnc + 1 : s.dnc,
      notInterested: disp === 'NOT INTERESTED' ? s.notInterested + 1 : s.notInterested,
    }))
    if (currentLead) {
      await fetch('/api/leads/dispose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: currentLead.id,
          campaign_id: currentLead.campaign_id,
          user_id: user?.id,
          disposition: disp,
          duration: Math.floor((Date.now() - callStart) / 1000),
        }),
      })
    }
    setTimeout(async () => {
      setStatus('idle')
      setShowDisposition(false)
      setDisposition('')
      setSeconds(0)
      setCurrentLead(null)
      await handleDial()
    }, 600)
  }

  const handleManualDial = async () => {
    if (!manualNumber) return
    setStatus('calling')
    setSessionStats(s => ({ ...s, calls: s.calls + 1 }))
    playInitiateBlip()
    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: manualNumber }),
      })
      const data = await res.json()
      if (data.success) {
        setActiveCallSid(data.callSid)
        startCallPolling(data.callSid)
        // No more dialIntoConference — SignalWire INVITEs us, onInvite handles it
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  const handleKeypad = (key: string) => {
    if (manualNumber.length < 14) {
      setManualNumber(prev => prev + key)
      playDTMF(key)
    }
  }

  const handleBackspace = () => setManualNumber(prev => prev.slice(0, -1))

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement?.tagName
      if (activeEl === 'INPUT' || activeEl === 'TEXTAREA' || activeEl === 'SELECT') return
      if (e.key >= '0' && e.key <= '9') handleKeypad(e.key)
      if (e.key === '*' || e.key === '#') handleKeypad(e.key)
      if (e.key === 'Backspace') handleBackspace()
      if (e.key === 'Enter' && manualNumber) handleManualDial()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [manualNumber, status])

  const nameKeys = ['name', 'first_name', 'last_name', 'full_name', 'fname', 'lname', 'firstname', 'lastname']
  const filteredExtraData = (data: Record<string, any>) => {
    return Object.entries(data).filter(([k, v]) =>
      v && String(v).trim() && !nameKeys.some(n => k.toLowerCase().replace(/[^a-z]/g, '') === n.replace(/[^a-z]/g, ''))
    )
  }

  const dispositions = [
    { label: 'CLOSED', color: '#2d7a2d', bg: '#e8f5e8' },
    { label: 'APPOINTMENT', color: '#1a4a8a', bg: '#e8eef8' },
    { label: 'NOT INTERESTED', color: '#8a6a1a', bg: '#f8f4e8' },
    { label: 'DO NOT CALL', color: '#8a1a1a', bg: '#f8e8e8' },
    { label: 'SKIP', color: '#5a5e6a', bg: '#f0f0f4' },
  ]

  const currentCampaign = campaigns.find(c => c.id === selectedCampaign)
  const activeScript = currentCampaign?.script || (selectedCampaign === 'all' ? campaigns.find(c => c.script)?.script : null)
  const attemptNumber = (currentLead?.dial_attempts || 0) + 1

  const terminalBg = '#f0f1f4'
  const terminalSurface = '#e2e4ea'
  const terminalBorder = '#c4c8d0'
  const terminalDark = '#1a1a2e'
  const terminalText = '#1a1c24'
  const terminalMuted = '#5a5e6a'
  const terminalAccent = '#2a4a8a'
  const terminalGreen = '#1a6a1a'
  const terminalRed = '#8a1a1a'

  return (
    <main style={{ height: '100vh', background: 'var(--background)', display: 'flex', overflow: 'hidden' }}>
      <div style={{
        width: '260px', height: '100vh', background: 'var(--surface)',
        borderRight: '1px solid var(--border)', display: 'flex',
        flexDirection: 'column', padding: '32px 0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px', marginBottom: '48px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>D</span>
          </div>
          <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--text-primary)' }}>DIALERSEAT</span>
        </div>

        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { icon: '📊', label: 'DASHBOARD', href: '/dashboard' },
            { icon: '📞', label: 'DIALER', href: '/dashboard/dialer', active: true },
            { icon: '📋', label: 'CAMPAIGNS', href: '/dashboard/campaigns' },
            { icon: '👥', label: 'LEADS', href: '/dashboard/leads' },
            { icon: '📈', label: 'ANALYTICS', href: '/dashboard/analytics' },
            { icon: '🏢', label: 'TEAM', href: '/dashboard/team' },
            { icon: '⚙️', label: 'SETTINGS', href: '/dashboard/settings' },
          ].map((item) => (
            <a key={item.label} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              borderRadius: '10px', cursor: 'pointer', textDecoration: 'none',
              background: item.active ? 'rgba(74,158,255,0.1)' : 'transparent',
              border: item.active ? '1px solid rgba(74,158,255,0.2)' : '1px solid transparent',
            }}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span style={{
                fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold',
                color: item.active ? 'var(--accent-blue)' : 'var(--text-secondary)',
              }}>{item.label}</span>
            </a>
          ))}
        </nav>

        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{
              fontSize: '10px', letterSpacing: '3px', fontWeight: 'bold',
              color: available ? 'var(--accent-blue)' : 'var(--text-secondary)',
            }}>{available ? '● AVAILABLE' : '○ OFFLINE'}</span>
            <div onClick={handleSetAvailable} style={{
              width: '44px', height: '24px', borderRadius: '12px',
              background: available ? 'var(--accent-blue)' : 'var(--border)',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
            }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                position: 'absolute', top: '3px', left: available ? '23px' : '3px', transition: 'left 0.2s',
              }} />
            </div>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
            {micGranted ? '🎤 Mic ready' : 'Toggle to go available'}
          </p>
        </div>
      </div>

      <div style={{ flex: 1, background: terminalBg, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh' }}>
        <div style={{
          background: terminalDark, padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `2px solid ${terminalAccent}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '4px', color: '#4a9eff' }}>
              DIALERSEAT TERMINAL v1.0
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: available ? '#32ff7e' : '#ff6464',
                boxShadow: available ? '0 0 6px #32ff7e' : '0 0 6px #ff6464',
              }} />
              <span style={{ fontSize: '10px', letterSpacing: '2px', color: available ? '#32ff7e' : '#ff6464' }}>
                {available ? 'AGENT LIVE' : 'AGENT OFFLINE'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: swReady ? '#4a9eff' : '#666688' }} />
              <span style={{ fontSize: '9px', letterSpacing: '2px', color: swReady ? '#4a9eff' : '#666688' }}>
                {swReady ? 'AUDIO READY' : 'AUDIO INIT...'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: micGranted ? '#32ff7e' : '#666688' }} />
              <span style={{ fontSize: '9px', letterSpacing: '2px', color: micGranted ? '#32ff7e' : '#666688' }}>
                {micGranted ? 'MIC OK' : 'MIC PENDING'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8888aa', letterSpacing: '2px' }}>{dateStr}</span>
            <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: '#4a9eff', letterSpacing: '3px' }}>{timeStr}</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', flexShrink: 0 }}>
              {[
                { label: 'STATUS', value: status.toUpperCase(), color: status === 'connected' ? terminalGreen : status === 'calling' ? '#8a6a1a' : terminalMuted },
                { label: 'DURATION', value: status === 'connected' ? formatTime(seconds) : '--:--', color: terminalAccent },
                { label: 'CAMPAIGN', value: currentCampaign?.name?.substring(0, 12) || 'ALL', color: terminalText },
                { label: 'ATTEMPT', value: status !== 'idle' && currentLead ? `${attemptNumber} OF 3` : '---', color: attemptNumber >= 3 ? terminalRed : attemptNumber === 2 ? '#8a6a1a' : terminalText },
              ].map((item) => (
                <div key={item.label} style={{
                  padding: '8px 12px', background: terminalSurface,
                  border: `1px solid ${terminalBorder}`, borderRadius: '4px',
                }}>
                  <div style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: item.color, letterSpacing: '1px' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 14px', background: terminalSurface, border: `1px solid ${terminalBorder}`, borderRadius: '4px', flexShrink: 0 }}>
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ SELECT CAMPAIGN</div>
              <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} style={{
                width: '100%', padding: '6px 10px', borderRadius: '4px',
                background: terminalBg, border: `1px solid ${terminalBorder}`,
                color: terminalText, fontSize: '12px', outline: 'none', fontFamily: 'monospace', cursor: 'pointer',
              }}>
                <option value="all">[ ALL ACTIVE CAMPAIGNS ]</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.total_leads} leads</option>
                ))}
              </select>
              {campaigns.length === 0 && (
                <div style={{
                  marginTop: '6px', padding: '5px 8px', background: '#f8e8e8',
                  border: '1px solid #d0a0a0', borderRadius: '4px',
                  fontSize: '10px', letterSpacing: '2px', color: terminalRed,
                }}>⚠ NO ACTIVE CAMPAIGNS FOUND</div>
              )}
            </div>

            <div style={{
              flex: 1, background: terminalSurface, border: `1px solid ${terminalBorder}`,
              borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              <div style={{
                padding: '7px 14px', background: terminalDark, borderBottom: `1px solid ${terminalBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
              }}>
                <span style={{ fontSize: '10px', letterSpacing: '3px', color: '#8888aa', fontWeight: 'bold' }}>LEAD PROFILE</span>
                {currentLead && status === 'connected' && (
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#4a9eff' }}>ID: {currentLead.id.substring(0, 8)}</span>
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {(!currentLead || status === 'calling') ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px', filter: 'grayscale(1)', opacity: 0.4 }}>📋</div>
                    <p style={{ fontSize: '11px', letterSpacing: '3px', color: terminalMuted }}>
                      {noLeads ? 'NO MORE LEADS AVAILABLE' : status === 'calling' ? 'DIALING IN QUEUE...' : 'AWAITING DIAL COMMAND'}
                    </p>
                    {noLeads && (
                      <p style={{ fontSize: '10px', color: terminalRed, marginTop: '8px', letterSpacing: '2px' }}>
                        UPLOAD MORE LEADS TO CONTINUE
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '12px', flexShrink: 0 }}>
                      <div style={{
                        padding: '10px 14px', background: terminalBg,
                        border: `2px solid ${status === 'connected' ? terminalGreen : terminalBorder}`,
                        borderRadius: '4px', marginBottom: '10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '19px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalText, letterSpacing: '1px', marginBottom: '3px' }}>
                              {currentLead.first_name} {currentLead.last_name}
                            </div>
                            <div style={{ fontSize: '15px', fontFamily: 'monospace', color: terminalAccent, fontWeight: 'bold', letterSpacing: '2px' }}>
                              {currentLead.phone}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <div style={{
                              padding: '4px 10px', borderRadius: '2px',
                              background: status === 'connected' ? '#e8f5e8' : '#f0f0f0',
                              border: `1px solid ${status === 'connected' ? terminalGreen : terminalBorder}`,
                              fontSize: '9px', letterSpacing: '2px', fontWeight: 'bold',
                              color: status === 'connected' ? terminalGreen : terminalMuted,
                            }}>
                              {status === 'connected' ? '● LIVE' : '○ IDLE'}
                            </div>
                            {(currentLead.dial_attempts || 0) > 0 && (
                              <div style={{
                                padding: '3px 8px', borderRadius: '2px',
                                background: '#f8f4e8', border: '1px solid #8a6a1a',
                                fontSize: '8px', letterSpacing: '2px', fontWeight: 'bold', color: '#8a6a1a',
                              }}>RETRY {attemptNumber}/3</div>
                            )}
                          </div>
                        </div>
                      </div>
                      {currentLead.extra_data && Object.keys(currentLead.extra_data).length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
                          {filteredExtraData(currentLead.extra_data).map(([key, value]) => (
                            <div key={key} style={{ padding: '7px 10px', background: terminalBg, border: `1px solid ${terminalBorder}`, borderRadius: '3px' }}>
                              <div style={{ fontSize: '8px', letterSpacing: '2px', color: terminalMuted, marginBottom: '2px', textTransform: 'uppercase' }}>{key}</div>
                              <div style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalText }}>{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {activeScript && (
                      <div style={{
                        flex: 1, margin: '0 12px 12px', padding: '10px 12px',
                        background: terminalBg, border: `1px solid ${terminalBorder}`,
                        borderLeft: `3px solid ${terminalAccent}`, borderRadius: '3px',
                        display: 'flex', flexDirection: 'column', minHeight: 0,
                      }}>
                        <div style={{ fontSize: '8px', letterSpacing: '2px', color: terminalMuted, marginBottom: '6px', flexShrink: 0 }}>CALL SCRIPT</div>
                        <div style={{
                          fontSize: '11px', lineHeight: '1.7', color: terminalText,
                          fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowY: 'auto', flex: 1,
                        }}>{activeScript}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {showDisposition && (
              <div style={{
                padding: '10px 14px', background: terminalSurface,
                border: `2px solid ${terminalAccent}`, borderRadius: '4px', flexShrink: 0,
              }}>
                <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '8px' }}>▸ SELECT DISPOSITION</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {dispositions.map((d) => (
                    <button key={d.label} onClick={() => handleDisposition(d.label)} style={{
                      padding: '10px 4px', borderRadius: '3px',
                      background: disposition === d.label ? d.color : d.bg,
                      border: `1px solid ${d.color}`,
                      color: disposition === d.label ? 'white' : d.color,
                      fontSize: '8px', fontWeight: 'bold', letterSpacing: '1px',
                      cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                    }}>{d.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: status === 'connected' ? '1fr 1fr' : '1fr', gap: '8px', flexShrink: 0 }}>
              {status === 'idle' && !available && (
                <button onClick={handleSetAvailable} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalSurface, color: terminalMuted,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                  borderTop: `3px solid ${terminalBorder}`, transition: 'all 0.15s',
                }}>[ SET AVAILABLE TO DIAL ]</button>
              )}
              {status === 'idle' && available && campaigns.length === 0 && (
                <div style={{
                  padding: '14px', borderRadius: '4px', background: terminalSurface, color: terminalMuted,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  textAlign: 'center', borderTop: `3px solid ${terminalBorder}`,
                }}>[ NO ACTIVE CAMPAIGNS ]</div>
              )}
              {status === 'idle' && available && campaigns.length > 0 && (
                <button onClick={handleDial} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalDark, color: '#4a9eff',
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                  borderTop: `3px solid #4a9eff`, transition: 'all 0.15s',
                }}>▶ INITIATE DIAL SEQUENCE</button>
              )}
              {status === 'calling' && (
                <button onClick={async () => {
                  await hangupCall(activeCallSid)
                  setStatus('idle')
                  setCurrentLead(null)
                }} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: '#f8e8e8', color: terminalRed,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                  borderTop: `3px solid ${terminalRed}`,
                }}>■ ABORT CALL</button>
              )}
              {status === 'connected' && (
                <>
                  <button onClick={handleSkip} style={{
                    padding: '14px', borderRadius: '4px',
                    background: '#f8f4e8', border: `1px solid #8a6a1a`,
                    borderTop: `3px solid #8a6a1a`, color: '#8a6a1a',
                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                  }}>⏭ SKIP / NEXT LEAD</button>
                  <button onClick={async () => {
                    await hangupCall(activeCallSid)
                    setStatus('idle')
                    setCurrentLead(null)
                    setShowDisposition(false)
                    setDisposition('')
                    setSeconds(0)
                  }} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: '#f8e8e8', borderTop: `3px solid ${terminalRed}`,
                    color: terminalRed, fontSize: '11px', fontWeight: 'bold',
                    letterSpacing: '3px', cursor: 'pointer',
                    fontFamily: 'Futura PT, Futura, sans-serif',
                  }}>■ TERMINATE CALL</button>
                </>
              )}
              {status === 'ended' && !showDisposition && (
                <button onClick={handleDial} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalDark, color: '#4a9eff',
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                  borderTop: `3px solid #4a9eff`,
                }}>▶ NEXT LEAD</button>
              )}
            </div>
          </div>

          <div style={{
            width: '280px', borderLeft: `1px solid ${terminalBorder}`,
            display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
          }}>
            <div style={{ background: terminalDark, padding: '8px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0 }}>
              <span style={{ fontSize: '9px', letterSpacing: '3px', color: '#8888aa', fontWeight: 'bold' }}>SESSION METRICS</span>
            </div>

            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
              {[
                { label: 'TOTAL CALLS', value: sessionStats.calls, color: terminalText },
                { label: 'CLOSED', value: sessionStats.closed, color: terminalGreen },
                { label: 'APPOINTMENTS', value: sessionStats.appointments, color: '#1a4a8a' },
                { label: 'NOT INTERESTED', value: sessionStats.notInterested, color: '#8a6a1a' },
                { label: 'DO NOT CALL', value: sessionStats.dnc, color: terminalRed },
              ].map((stat) => (
                <div key={stat.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: terminalSurface,
                  border: `1px solid ${terminalBorder}`, borderRadius: '3px',
                  borderLeft: `3px solid ${stat.color}`,
                }}>
                  <span style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted }}>{stat.label}</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: stat.color }}>{stat.value}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
              <div style={{
                padding: '10px 12px', background: terminalSurface,
                border: `1px solid ${terminalBorder}`, borderRadius: '3px',
                borderTop: `3px solid ${terminalAccent}`,
              }}>
                <div style={{ fontSize: '8px', letterSpacing: '1px', color: terminalMuted, marginBottom: '3px' }}>
                  YOUR SESSION'S CONVERSION RATE
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalAccent }}>
                  {sessionStats.calls > 0
                    ? `${(((sessionStats.appointments + sessionStats.closed) / sessionStats.calls) * 100).toFixed(1)}%`
                    : '0.0%'}
                </div>
              </div>
            </div>

            <div style={{ background: terminalDark, padding: '8px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0 }}>
              <span style={{ fontSize: '9px', letterSpacing: '3px', color: '#8888aa', fontWeight: 'bold' }}>MANUAL DIAL</span>
            </div>

            <div style={{ padding: '12px', background: terminalBg, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                background: terminalSurface, border: `1px solid ${terminalBorder}`,
                borderRadius: '4px', padding: '10px 12px',
                fontFamily: 'monospace', fontSize: '18px', fontWeight: 'bold',
                color: manualNumber ? terminalText : terminalMuted,
                letterSpacing: '3px', textAlign: 'center',
                marginBottom: '10px', minHeight: '44px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {manualNumber || '_ _ _ _ _ _ _ _'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '6px', flex: 1 }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                  <button key={key} onClick={() => handleKeypad(key)} style={{
                    borderRadius: '3px', background: terminalSurface,
                    border: `1px solid ${terminalBorder}`, borderBottom: `3px solid ${terminalBorder}`,
                    color: terminalText, fontSize: '16px', fontWeight: 'bold',
                    cursor: 'pointer', fontFamily: 'monospace', transition: 'all 0.05s',
                  }}>{key}</button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '6px' }}>
                <button onClick={handleBackspace} style={{
                  padding: '12px', borderRadius: '3px',
                  background: terminalSurface, border: `1px solid ${terminalBorder}`,
                  borderBottom: `3px solid ${terminalBorder}`,
                  color: terminalMuted, fontSize: '16px', cursor: 'pointer',
                }}>⌫</button>
                <button onClick={handleManualDial} disabled={!manualNumber} style={{
                  padding: '12px', borderRadius: '3px', border: 'none',
                  background: manualNumber ? terminalDark : terminalSurface,
                  borderBottom: `3px solid ${manualNumber ? '#4a9eff' : terminalBorder}`,
                  color: manualNumber ? '#4a9eff' : terminalMuted,
                  fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px',
                  cursor: manualNumber ? 'pointer' : 'not-allowed',
                  fontFamily: 'Futura PT, Futura, sans-serif',
                }}>▶ DIAL</button>
              </div>
            </div>

            <div style={{ background: terminalDark, padding: '6px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0 }}>
              <span style={{ fontSize: '9px', letterSpacing: '3px', color: '#8888aa', fontWeight: 'bold' }}>SYSTEM LOG</span>
            </div>
            <div style={{ padding: '5px 12px', background: '#1a1c24', height: '36px', overflowY: 'auto', flexShrink: 0 }}>
              {[
                status === 'connected' && `> CONNECTED — ${currentLead?.first_name} ${currentLead?.last_name}`,
                status === 'calling' && '> DIALING IN QUEUE...',
                swReady && '> AUDIO READY',
                micGranted && '> MIC READY',
                available && '> AGENT STATUS: ONLINE',
                `> SESSION STARTED ${dateStr}`,
                '> DIALERSEAT TERMINAL READY',
              ].filter(Boolean).map((log, i) => (
                <div key={i} style={{
                  fontSize: '9px', fontFamily: 'monospace',
                  color: i === 0 ? '#4a9eff' : '#4a5a4a',
                  letterSpacing: '1px', marginBottom: '2px',
                }}>{log as string}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}