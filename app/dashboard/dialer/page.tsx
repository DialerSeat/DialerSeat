'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type CallStatus = 'idle' | 'calling' | 'connected' | 'ended' | 'preview_ready'
type AccessTier = 'active' | 'lapsed' | 'new' | null
type DialerMode = 'preview' | 'power' | 'progressive' | 'predictive'

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
  dialer_mode?: DialerMode
  amd_enabled?: boolean
  predictive_lines_per_agent?: number
}

interface TeamScopeCampaign {
  campaignId: string
  accessMode: 'owner_pays' | 'agent_pays' | 'public'
  campaign: { id: string; name: string; total_leads: number; called_leads: number; status: string } | null
}

interface TeamScope {
  id: string
  name: string
  viewerRole: 'owner' | 'member'
  teamCampaigns: TeamScopeCampaign[]
}

interface PacingInfo {
  activeAgents: number
  abandonRate: number
  isDegraded: boolean
  configuredLines: number
  effectiveLines: number
}

const PERSONAL_SCOPE = '__personal__'

function DialerPageInner() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [notes, setNotes] = useState('')
  const [tier, setTier] = useState<AccessTier>(null)
  const [tierLoaded, setTierLoaded] = useState(false)

  // clockTick exists purely to force re-render every second so the displayed
  // clock updates. Value is never read directly.
  const [clockTick, setClockTick] = useState(0)

  const [status, setStatus] = useState<CallStatus>('idle')
  const [manualNumber, setManualNumber] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [available, setAvailable] = useState(false)
  const [disposition, setDisposition] = useState('')
  const [showDisposition, setShowDisposition] = useState(false)
  const [currentLead, setCurrentLead] = useState<Lead | null>(null)
  const [previewLead, setPreviewLead] = useState<Lead | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [callStart, setCallStart] = useState(0)
  const [noLeads, setNoLeads] = useState(false)
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [swReady, setSwReady] = useState(false)
  const [micGranted, setMicGranted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [dialZoomed, setDialZoomed] = useState(false)
  const [sessionStats, setSessionStats] = useState({
    calls: 0, connected: 0, appointments: 0, closed: 0, dnc: 0, notInterested: 0
  })

  const [teamScopes, setTeamScopes] = useState<TeamScope[]>([])
  const [selectedScope, setSelectedScope] = useState<string>(PERSONAL_SCOPE)
  const [scopesLoaded, setScopesLoaded] = useState(false)

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [pacingInfo, setPacingInfo] = useState<PacingInfo | null>(null)
  const [amdActivity, setAmdActivity] = useState<string[]>([])

  const [tcpaBlockedAll, setTcpaBlockedAll] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activePollRef = useRef<NodeJS.Timeout | null>(null)
  const swClientRef = useRef<any>(null)
  const swCallRef = useRef<any>(null)
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const pacingPollRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const urlParamsConsumedRef = useRef(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!user) return
    fetch('/api/stripe/status')
      .then(r => r.json())
      .then(d => {
        setTier(d.tier || null)
        setTierLoaded(true)
      })
      .catch(() => {
        setTier(null)
        setTierLoaded(true)
      })
  }, [user])

  const isActive = tier === 'active'

  const currentCampaign: Campaign | undefined =
    selectedCampaign !== 'all'
      ? campaigns.find(c => c.id === selectedCampaign)
      : undefined
  const dialerMode: DialerMode = (currentCampaign?.dialer_mode as DialerMode) || 'power'
  // AMD is always on platform-wide as of May 10, 2026 — voicemail filtering is a
  // core promise of the product. The amd_enabled field is no longer the gate.
  const amdEnabled = true
  const isPredictive = dialerMode === 'predictive'
  const isProgressive = dialerMode === 'progressive'
  const isPreview = dialerMode === 'preview'
  const autoDials = isProgressive || isPredictive

  useEffect(() => {
    if (!user || !isActive) return
    let cancelled = false
    fetch('/api/teams/list?detail=owned')
      .then(r => r.json())
      .then(async data => {
        if (cancelled || !data.success) {
          setScopesLoaded(true)
          return
        }
        const scopes: TeamScope[] = []
        for (const t of data.teams.owned || []) {
          if ((t.teamCampaigns || []).length > 0) {
            scopes.push({
              id: t.id,
              name: t.name,
              viewerRole: 'owner',
              teamCampaigns: t.teamCampaigns,
            })
          }
        }
        const memberTeams = data.teams.member || []
        if (memberTeams.length > 0) {
          await Promise.all(memberTeams.map(async (t: any) => {
            try {
              const r = await fetch(`/api/teams/${t.id}/get`)
              const d = await r.json()
              if (d.success && d.team.teamCampaigns?.length > 0) {
                scopes.push({
                  id: t.id,
                  name: t.name,
                  viewerRole: 'member',
                  teamCampaigns: d.team.teamCampaigns,
                })
              }
            } catch {}
          }))
        }
        if (!cancelled) {
          setTeamScopes(scopes)
          setScopesLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setScopesLoaded(true)
      })
    return () => { cancelled = true }
  }, [user, isActive])

  useEffect(() => {
    if (!scopesLoaded || urlParamsConsumedRef.current) return
    const teamIdParam = searchParams.get('teamId')
    const campaignIdParam = searchParams.get('campaignId')
    if (teamIdParam && teamScopes.find(s => s.id === teamIdParam)) {
      setSelectedScope(teamIdParam)
    }
    if (campaignIdParam) {
      setSelectedCampaign(campaignIdParam)
    }
    urlParamsConsumedRef.current = true
  }, [scopesLoaded, teamScopes, searchParams])

  useEffect(() => {
    if (user && isActive) fetchCampaigns()
  }, [user, isActive])

  useEffect(() => {
    if (!urlParamsConsumedRef.current) return
    setSelectedCampaign('all')
  }, [selectedScope])

  // CLOCK TICK — forces re-render every second so timeStr/dateStr update
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => setClockTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isActive])

  useEffect(() => {
    if (!isActive) return
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
  }, [isActive])

  useEffect(() => {
    if (!isActive) return
    const initSW = async () => {
      try {
        const sipUsername = process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_USERNAME
        const sipPassword = process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_PASSWORD
        const sipDomain = process.env.NEXT_PUBLIC_SIGNALWIRE_SIP_DOMAIN

        if (!sipUsername || !sipPassword || !sipDomain) return

        const { UserAgent, Registerer } = await import('sip.js')
        const uri = UserAgent.makeURI(`sip:${sipUsername}@${sipDomain}`)
        if (!uri) return

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
            try {
              const { SessionState: SS } = await import('sip.js')
              invitation.stateChange.addListener((state: any) => {
                if (state === SS.Established) {
                  swCallRef.current = invitation
                  attachSIPAudio(invitation)
                } else if (state === SS.Terminated) {
                  if (swCallRef.current === invitation) swCallRef.current = null
                }
              })
              await invitation.accept({
                sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
              })
            } catch (err) {
              console.error('Error accepting SIP invite:', err)
            }
          },
        }

        await userAgent.start()
        const registerer = new Registerer(userAgent)
        await registerer.register()
        swClientRef.current = userAgent
        setSwReady(true)
      } catch (err: any) {
        console.error('SIP init error:', err?.message || err)
      }
    }
    initSW()
  }, [isActive])

  const attachSIPAudio = (session: any) => {
    const tryAttach = () => {
      try {
        const sdh = session.sessionDescriptionHandler
        if (!sdh) return false
        const pc = sdh.peerConnection
        if (!pc) return false

        pc.ontrack = (event: RTCTrackEvent) => {
          if (event.streams && event.streams[0]) {
            let audioEl = document.getElementById('sip-audio') as HTMLAudioElement
            if (!audioEl) {
              audioEl = document.createElement('audio')
              audioEl.id = 'sip-audio'
              audioEl.autoplay = true
              document.body.appendChild(audioEl)
            }
            audioEl.srcObject = event.streams[0]
            audioEl.play().catch(console.error)
          }
        }

        pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
          if (receiver.track && receiver.track.kind === 'audio') {
            const stream = new MediaStream([receiver.track])
            let audioEl = document.getElementById('sip-audio') as HTMLAudioElement
            if (!audioEl) {
              audioEl = document.createElement('audio')
              audioEl.id = 'sip-audio'
              audioEl.autoplay = true
              document.body.appendChild(audioEl)
            }
            audioEl.srcObject = stream
            audioEl.play().catch(console.error)
          }
        })
        return true
      } catch (err) {
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

  const startSession = useCallback(async (campaignId: string) => {
    try {
      const teamId = selectedScope !== PERSONAL_SCOPE ? selectedScope : undefined
      const res = await fetch('/api/dialer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, teamId }),
      })
      const data = await res.json()
      if (data.success) {
        setCurrentSessionId(data.sessionId)
        sessionIdRef.current = data.sessionId
      }
    } catch (err) {
      console.error('startSession error:', err)
    }
  }, [selectedScope])

  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      await fetch('/api/dialer/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      })
    } catch {}
    setCurrentSessionId(null)
    sessionIdRef.current = null
  }, [])

  useEffect(() => {
    if (!isActive) return
    const shouldHaveSession = available && selectedCampaign !== 'all' && currentCampaign

    if (shouldHaveSession) {
      if (!sessionIdRef.current) {
        startSession(selectedCampaign)
      }
      if (!heartbeatRef.current) {
        heartbeatRef.current = setInterval(() => {
          if (selectedCampaign !== 'all') startSession(selectedCampaign)
        }, 30000)
      }
    } else {
      if (sessionIdRef.current) endSession()
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [available, selectedCampaign, currentCampaign, isActive, startSession, endSession])

  useEffect(() => {
    const handleUnload = () => {
      const sid = sessionIdRef.current
      if (sid && navigator.sendBeacon) {
        const blob = new Blob(
          [JSON.stringify({ sessionId: sid })],
          { type: 'application/json' }
        )
        navigator.sendBeacon('/api/dialer/session-end', blob)
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      endSession()
    }
  }, [endSession])

  useEffect(() => {
    if (!isActive || !isPredictive || !available || selectedCampaign === 'all') {
      setPacingInfo(null)
      if (pacingPollRef.current) {
        clearInterval(pacingPollRef.current)
        pacingPollRef.current = null
      }
      return
    }

    const fetchPacing = async () => {
      try {
        const res = await fetch(`/api/dialer/active-agents?campaignId=${selectedCampaign}`)
        const data = await res.json()
        if (data.success) {
          setPacingInfo(prev => ({
            activeAgents: data.activeAgents,
            abandonRate: prev?.abandonRate || 0,
            isDegraded: prev?.isDegraded || false,
            configuredLines: currentCampaign?.predictive_lines_per_agent || 1.5,
            effectiveLines: prev?.isDegraded ? 1.0 : (currentCampaign?.predictive_lines_per_agent || 1.5),
          }))
        }
      } catch {}
    }

    fetchPacing()
    pacingPollRef.current = setInterval(fetchPacing, 15000)
    return () => {
      if (pacingPollRef.current) {
        clearInterval(pacingPollRef.current)
        pacingPollRef.current = null
      }
    }
  }, [isActive, isPredictive, available, selectedCampaign, currentCampaign])

  const handleSetAvailable = async () => {
    if (!micGranted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        setMicGranted(true)
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

  const isPersonalScope = selectedScope === PERSONAL_SCOPE
  const currentScope = teamScopes.find(s => s.id === selectedScope) || null

  const scopeCampaigns: { id: string; name: string; total_leads: number }[] = isPersonalScope
    ? campaigns.map(c => ({ id: c.id, name: c.name, total_leads: c.total_leads }))
    : (currentScope?.teamCampaigns
        .filter(tc => tc.campaign)
        .map(tc => ({
          id: tc.campaign!.id,
          name: tc.campaign!.name,
          total_leads: tc.campaign!.total_leads,
        })) || [])

  const fetchNextLead = async (): Promise<Lead | null> => {
    const params = new URLSearchParams({ user_id: user?.id || '' })
    if (selectedCampaign !== 'all') params.append('campaign_id', selectedCampaign)
    if (!isPersonalScope) params.append('team_id', selectedScope)
    const res = await fetch(`/api/leads/next?${params}`)
    const data = await res.json()
    if (data.success) {
      setNoLeads(false)
      setTcpaBlockedAll(false)
      return data.lead
    } else {
      setNoLeads(true)
      setTcpaBlockedAll(!!data.tcpaBlocked)
      return null
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // Reads clockTick (in deps via state) so this recomputes every second
  const now = new Date()
  const timeStr = mounted ? now.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'
  const dateStr = mounted ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
  // Silence unused-var warning — clockTick exists solely to trigger re-render
  void clockTick

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

  useEffect(() => {
    if (dialZoomed) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [dialZoomed])

  const fetchPreviewLead = async () => {
    setShowDisposition(false)
    setDisposition('')
    setNoLeads(false)
    const lead = await fetchNextLead()
    if (!lead) return
    setPreviewLead(lead)
    setStatus('preview_ready')
  }

  const dialPreviewLead = async () => {
    if (!previewLead) return
    const lead = previewLead
    setPreviewLead(null)
    setCurrentLead(lead)
    await dialLeadCall(lead)
  }

  const skipPreviewLead = async () => {
    if (!previewLead) return
    await fetch('/api/leads/dispose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: previewLead.id,
        campaign_id: previewLead.campaign_id,
        user_id: user?.id,
        disposition: 'SKIPPED',
        duration: 0,
        source: 'preview_skip',
      }),
    })
    setPreviewLead(null)
    setStatus('idle')
    fetchPreviewLead()
  }

  const dialLeadCall = async (lead: Lead) => {
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
      if (autoDials) setTimeout(() => handleDial(), 300)
      else setStatus('idle')
      return
    }

    setStatus('calling')
    setSessionStats(s => ({ ...s, calls: s.calls + 1 }))
    playInitiateBlip()

    setAmdActivity(prev => [`AMD ENABLED — analyzing pickup`, ...prev].slice(0, 5))

    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.phone,
          leadId: lead.id,
          campaignId: lead.campaign_id,
          teamId: isPersonalScope ? undefined : selectedScope,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setActiveCallSid(data.callSid)
        startCallPolling(data.callSid)
      } else {
        if (res.status === 403) {
          setTier('lapsed')
          return
        }
        if (res.status === 451) {
          console.warn('TCPA window block:', data.detail)
          await fetch('/api/leads/dispose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: lead.id,
              campaign_id: lead.campaign_id,
              disposition: 'TCPA_BLOCKED',
              duration: 0,
              notes: data.detail,
              source: 'tcpa_block',
            }),
          })
          setAmdActivity(prev => [
            `TCPA SKIP — ${data.leadState || '?'}: ${data.detail}`,
            ...prev,
          ].slice(0, 5))
          setStatus('idle')
          setCurrentLead(null)
          if (autoDials) setTimeout(() => handleDial(), 500)
          else setTimeout(() => handleDial(), 300)
          return
        }
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
        if (autoDials) setTimeout(() => handleDial(), 500)
      }
    } catch (error) {
      console.error('Call error:', error)
      setStatus('idle')
      setCurrentLead(null)
    }
  }

  const startCallPolling = (callSid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/calls/check?sid=${callSid}`)
        const statusData = await statusRes.json()

        if (statusData.status === 'in-progress') {
          clearInterval(pollInterval)
          activePollRef.current = null
          playPickup()
          setStatus('connected')
          setSessionStats(s => ({ ...s, connected: s.connected + 1 }))

          const hangupPoll = setInterval(async () => {
            try {
              const res = await fetch(`/api/calls/check?sid=${callSid}`)
              const d = await res.json()
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

          if (statusData.amd_result?.startsWith('machine_')) {
            setAmdActivity(prev =>
              [`> VOICEMAIL FILTERED — ${statusData.amd_result}`, ...prev].slice(0, 5)
            )
          }

          if (currentLead) {
            const isAmdHangup = statusData.amd_result?.startsWith('machine_')
            if (!isAmdHangup) {
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
          }
          setStatus('idle')
          setCurrentLead(null)

          if (autoDials) {
            setTimeout(() => handleDial(), 1200)
          } else {
            setTimeout(() => handleDial(), 800)
          }
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

    if (isPreview) {
      await fetchPreviewLead()
      return
    }

    const lead = await fetchNextLead()
    if (!lead) return
    setCurrentLead(lead)
    await dialLeadCall(lead)
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
          disposition: 'SKIPPED',
          duration: Math.floor((Date.now() - callStart) / 1000),
          notes: notes.trim() || undefined,
          source: 'skip',
        }),
      })
    }
    setNotes('')
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
          disposition: disp,
          duration: Math.floor((Date.now() - callStart) / 1000),
          notes: notes.trim() || undefined,
          source: 'dialer',
        }),
      })
    }

    setTimeout(async () => {
      setStatus('idle')
      setShowDisposition(false)
      setDisposition('')
      setNotes('')
      setSeconds(0)
      setCurrentLead(null)
      await handleDial()
    }, autoDials ? 800 : 600)
  }

  const handleManualDial = async () => {
    if (!manualNumber) return
    setDialZoomed(false)
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
      } else {
        if (res.status === 403) {
          setTier('lapsed')
          return
        }
        if (res.status === 451) {
          alert(`Cannot dial: ${data.detail}\n\nLocal time at destination: ${data.leadLocalTime || 'unknown'}`)
          setStatus('idle')
          return
        }
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
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement?.tagName
      if (activeEl === 'INPUT' || activeEl === 'TEXTAREA' || activeEl === 'SELECT') return
      if (e.key >= '0' && e.key <= '9') handleKeypad(e.key)
      if (e.key === '*' || e.key === '#') handleKeypad(e.key)
      if (e.key === 'Backspace') handleBackspace()
      if (e.key === 'Enter' && manualNumber) handleManualDial()
      if (e.key === 'Escape' && dialZoomed) setDialZoomed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [manualNumber, status, dialZoomed, isActive])

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

  let activeScript: string | null = null
  if (selectedCampaign !== 'all') {
    activeScript = currentCampaign?.script || null
  } else if (isPersonalScope) {
    activeScript = campaigns.find(c => c.script)?.script || null
  }

  const terminalBg = '#f0f1f4'
  const terminalSurface = '#e2e4ea'
  const terminalBorder = '#c4c8d0'
  const terminalDark = '#1a1a2e'
  const terminalText = '#1a1c24'
  const terminalMuted = '#5a5e6a'
  const terminalAccent = '#2a4a8a'
  const terminalGreen = '#1a6a1a'
  const terminalRed = '#8a1a1a'
  const terminalAmber = '#8a6a1a'

  const modeColor = isPredictive ? terminalRed
    : isProgressive ? terminalGreen
    : isPreview ? terminalMuted
    : terminalAccent

  if (tierLoaded && !isActive) {
    return (
      <div style={{
        flex: 1, background: terminalBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
      }}>
        <div style={{
          width: '100%', maxWidth: 520,
          background: terminalDark, border: `1px solid ${terminalBorder}`,
          borderTop: `3px solid #ffaa3e`, borderRadius: 4, padding: 36,
          color: '#e0e2ea', textAlign: 'center', boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.85 }}>📞</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 5, color: '#ffaa3e', marginBottom: 12 }}>
            SUBSCRIBE TO DIAL
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: '#c0c2ca', letterSpacing: 1, marginBottom: 28 }}>
            {tier === 'lapsed'
              ? 'Your subscription has lapsed. Resubscribe to restore dialing access. Your leads, recordings, and campaigns are still here waiting for you.'
              : 'An active subscription is required to make outbound calls.'}
          </div>
          <Link href="/billing" style={{
            display: 'block', padding: '16px 28px',
            background: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
            border: 'none', borderRadius: 4, color: 'white',
            fontSize: 13, fontWeight: 700, letterSpacing: 4,
            textDecoration: 'none', boxShadow: '0 0 20px rgba(74,158,255,0.3)',
            marginBottom: 16, fontFamily: 'Futura PT, Futura, sans-serif',
          }}>RESUBSCRIBE — $35/WEEK</Link>
          <div style={{ fontSize: 9, letterSpacing: 3, color: '#888a92', marginBottom: 24 }}>
            NO CONTRACTS · CANCEL ANYTIME
          </div>
          <div style={{
            paddingTop: 20, borderTop: '1px solid #2a2c34',
            display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Link href="/dashboard/leads" style={navLinkStyle}>VIEW LEADS</Link>
            <Link href="/dashboard/recordings" style={navLinkStyle}>RECORDINGS</Link>
            <Link href="/dashboard/analytics" style={navLinkStyle}>ANALYTICS</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!tierLoaded) {
    return (
      <div style={{
        flex: 1, background: terminalBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: terminalMuted }}>LOADING TERMINAL...</div>
      </div>
    )
  }

  const displayLead = previewLead || currentLead

  const ManualDialer = ({ inOverlay = false }: { inOverlay?: boolean }) => (
    <>
      <div style={{
        background: terminalDark, padding: inOverlay ? '14px 20px' : '8px 16px',
        borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: inOverlay ? '11px' : '9px', letterSpacing: '3px',
          color: '#8888aa', fontWeight: 'bold',
        }}>MANUAL DIAL</span>
        <button
          onClick={() => setDialZoomed(!inOverlay)}
          aria-label={inOverlay ? 'Close fullscreen dialer' : 'Open fullscreen dialer'}
          style={{
            background: 'transparent', border: '1px solid #4a4a5e', borderRadius: 4,
            color: '#8888aa', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 14, fontWeight: 'bold', padding: 0,
          }}
        >{inOverlay ? '×' : '⛶'}</button>
      </div>

      <div style={{
        padding: inOverlay ? '20px 24px' : '12px',
        background: terminalBg, flex: 1,
        display: 'flex', flexDirection: 'column',
        maxWidth: inOverlay ? 480 : 'none',
        margin: inOverlay ? '0 auto' : 0,
        width: inOverlay ? '100%' : 'auto',
        boxSizing: 'border-box',
        overflowY: inOverlay ? 'auto' : 'visible',
        paddingBottom: inOverlay ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 12,
      }}>
        <div style={{
          background: terminalSurface, border: `1px solid ${terminalBorder}`, borderRadius: '4px',
          padding: inOverlay ? '20px 16px' : '10px 12px',
          fontFamily: 'monospace', fontSize: inOverlay ? '32px' : '18px',
          fontWeight: 'bold', color: manualNumber ? terminalText : terminalMuted,
          letterSpacing: '3px', textAlign: 'center',
          marginBottom: inOverlay ? '20px' : '10px',
          minHeight: inOverlay ? '64px' : '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {manualNumber || '_ _ _ _ _ _ _ _'}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: inOverlay ? '12px' : '6px', marginBottom: inOverlay ? '12px' : '6px',
          flex: inOverlay ? '0 0 auto' : 1,
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
            <button key={key} onClick={() => handleKeypad(key)} style={{
              borderRadius: '3px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderBottom: `3px solid ${terminalBorder}`,
              color: terminalText, fontSize: inOverlay ? '28px' : '16px',
              fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace',
              transition: 'all 0.05s', padding: inOverlay ? '20px 0' : '12px 0',
              minHeight: inOverlay ? 64 : 'auto',
            }}>{key}</button>
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 2fr',
          gap: inOverlay ? '12px' : '6px', flexShrink: 0,
        }}>
          <button onClick={handleBackspace} style={{
            padding: inOverlay ? '20px' : '12px', borderRadius: '3px',
            background: terminalSurface, border: `1px solid ${terminalBorder}`,
            borderBottom: `3px solid ${terminalBorder}`, color: terminalMuted,
            fontSize: inOverlay ? '24px' : '16px', cursor: 'pointer',
          }}>⌫</button>
          <button onClick={handleManualDial} disabled={!manualNumber} style={{
            padding: inOverlay ? '20px' : '12px', borderRadius: '3px', border: 'none',
            background: manualNumber ? terminalDark : terminalSurface,
            borderBottom: `3px solid ${manualNumber ? '#4a9eff' : terminalBorder}`,
            color: manualNumber ? '#4a9eff' : terminalMuted,
            fontSize: inOverlay ? '14px' : '11px', fontWeight: 'bold', letterSpacing: '2px',
            cursor: manualNumber ? 'pointer' : 'not-allowed',
            fontFamily: 'Futura PT, Futura, sans-serif',
          }}>▶ DIAL</button>
        </div>
      </div>
    </>
  )

  return (
    <div className="dialer-root" style={{
      flex: 1, background: terminalBg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', minHeight: 0, position: 'relative',
    }}>
      <style>{`
        .dialer-root { height: 100vh; height: 100dvh; }
        .dialer-status-bar { display: flex; align-items: center; justify-content: space-between; }
        .dialer-status-bar-left { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .dialer-status-bar-right { display: flex; align-items: center; gap: 18px; }
        .dialer-stat-grid { grid-template-columns: repeat(3, 1fr) !important; }
        .dialer-right-sidebar {
          width: 280px; border-left: 1px solid ${terminalBorder};
          display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
        }
        .dialer-right-toggle { display: none; }
        .dialer-right-overlay { display: none; }
        .dialer-connected-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 3px 10px; background: rgba(74,158,255,0.12);
          border: 1px solid rgba(74,158,255,0.3); border-radius: 3px;
          font-family: monospace; font-size: 10px; letter-spacing: 1px;
          color: #4a9eff; font-weight: bold;
        }

        @media (max-width: 768px) {
          .dialer-root { height: calc(100vh - 64px); height: calc(100dvh - 64px); }
          .dialer-status-bar { padding: 6px 12px !important; }
          .dialer-status-bar-left { gap: 10px; }
          .dialer-status-bar-right { gap: 10px; }
          .dialer-status-bar-right .dialer-time-block { display: none !important; }
          .dialer-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dialer-right-sidebar {
            position: fixed; right: 0; top: 0; bottom: 0; z-index: 60;
            width: 280px; max-width: 85vw;
            transform: translateX(100%); transition: transform 0.25s ease;
            background: ${terminalBg}; border-left: 1px solid ${terminalBorder};
          }
          .dialer-right-sidebar.open { transform: translateX(0); }
          .dialer-right-toggle {
            display: flex; position: fixed; right: 12px;
            bottom: calc(12px + env(safe-area-inset-bottom, 0px)); z-index: 50;
            width: 48px; height: 48px; border-radius: 50%;
            background: ${terminalDark}; border: 1px solid #4a4a5e; color: #4a9eff;
            align-items: center; justify-content: center; cursor: pointer;
            font-size: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          }
          .dialer-right-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(0,0,0,0.5); z-index: 55;
            opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
          }
          .dialer-right-overlay.open { opacity: 1; pointer-events: auto; }
        }
      `}</style>

      <div className="dialer-status-bar" style={{
        background: terminalDark, padding: '8px 20px',
        borderBottom: `2px solid ${terminalAccent}`, flexShrink: 0,
      }}>
        <div className="dialer-status-bar-left">
          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '4px', color: '#4a9eff' }}>
            DIALERSEAT TERMINAL
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: available ? '#32ff7e' : '#ff6464',
              boxShadow: available ? '0 0 6px #32ff7e' : '0 0 6px #ff6464',
            }} />
            <span style={{ fontSize: '10px', letterSpacing: '2px', color: available ? '#32ff7e' : '#ff6464' }}>
              {available ? 'LIVE' : 'OFFLINE'}
            </span>
            <div onClick={handleSetAvailable} style={{
              width: '36px', height: '20px', borderRadius: '10px',
              background: available ? '#4a9eff' : '#444460',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                position: 'absolute', top: '3px', left: available ? '19px' : '3px', transition: 'left 0.2s',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: swReady ? '#4a9eff' : '#666688' }} />
            <span style={{ fontSize: '9px', letterSpacing: '2px', color: swReady ? '#4a9eff' : '#666688' }}>
              {swReady ? 'AUDIO' : '...'}
            </span>
          </div>
          {currentCampaign && (
            <div style={{
              padding: '2px 8px', borderRadius: 3,
              border: `1px solid ${modeColor}`,
              fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5,
              color: modeColor,
              fontFamily: 'monospace',
            }}>
              {dialerMode.toUpperCase()}
              <span style={{ marginLeft: 4, opacity: 0.7 }}>· AMD</span>
            </div>
          )}
        </div>
        <div className="dialer-status-bar-right">
          <div className="dialer-connected-pill" title="Connected calls this session">
            <span style={{ fontSize: 8, letterSpacing: 2, opacity: 0.75 }}>CONNECTED</span>
            <span>{sessionStats.connected}</span>
          </div>
          <div className="dialer-time-block" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8888aa', letterSpacing: '2px' }}>{dateStr}</span>
            <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: '#4a9eff', letterSpacing: '3px' }}>{timeStr}</span>
          </div>
        </div>
      </div>

      {isPredictive && pacingInfo?.isDegraded && (
        <div style={{
          padding: '8px 20px',
          background: '#f8e8e8',
          borderBottom: `2px solid ${terminalRed}`,
          color: terminalRed,
          fontSize: 11,
          letterSpacing: 1,
          textAlign: 'center',
          fontWeight: 'bold',
        }}>
          ⚠ AUTO-DEGRADED TO PROGRESSIVE — abandon rate {(pacingInfo.abandonRate * 100).toFixed(2)}% (legal cap 3%)
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto', minHeight: 0 }}>

          <div className="dialer-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', flexShrink: 0 }}>
            {[
              { label: 'STATUS', value: status === 'preview_ready' ? 'PREVIEW' : status.toUpperCase(), color: status === 'connected' ? terminalGreen : status === 'calling' ? '#8a6a1a' : status === 'preview_ready' ? terminalAccent : terminalMuted },
              { label: 'DURATION', value: status === 'connected' ? formatTime(seconds) : '--:--', color: terminalAccent },
              { label: 'MODE', value: dialerMode.toUpperCase(), color: modeColor },
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

          {isPredictive && pacingInfo && (
            <div style={{
              padding: '10px 14px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderLeft: `3px solid ${pacingInfo.isDegraded ? terminalRed : terminalAccent}`,
              borderRadius: '4px', flexShrink: 0,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>ACTIVE AGENTS</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', color: terminalText }}>
                  {pacingInfo.activeAgents}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>EFFECTIVE LINES</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', color: pacingInfo.isDegraded ? terminalRed : terminalAccent }}>
                  {pacingInfo.effectiveLines.toFixed(1)}×{pacingInfo.isDegraded && ' (degraded)'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>30D ABANDON RATE</div>
                <div style={{
                  fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace',
                  color: pacingInfo.abandonRate >= 0.025 ? terminalRed : pacingInfo.abandonRate >= 0.020 ? '#8a6a1a' : terminalGreen,
                }}>
                  {(pacingInfo.abandonRate * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {isPredictive && pacingInfo && pacingInfo.activeAgents > 0 && pacingInfo.activeAgents < 8 && !pacingInfo.isDegraded && (
            <div style={{
              padding: '8px 12px', background: 'rgba(255,170,62,0.08)',
              border: '1px solid #8a6a1a', borderLeft: '3px solid #ffaa3e',
              borderRadius: 4, fontSize: 11, color: '#8a6a1a', letterSpacing: 0.5,
            }}>
              ⚠ Predictive works best with 8+ concurrent agents. With {pacingInfo.activeAgents}, abandon-rate risk is elevated.{' '}
              <Link href="/dialing-modes" target="_blank" style={{ color: terminalAccent, fontWeight: 'bold' }}>Why? →</Link>
            </div>
          )}

          {teamScopes.length > 0 && (
            <div style={{
              padding: '10px 14px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px', flexShrink: 0,
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ SOURCE</div>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: '4px',
                  background: terminalBg, border: `1px solid ${terminalBorder}`,
                  color: terminalText, fontSize: '12px', outline: 'none',
                  fontFamily: 'monospace', cursor: 'pointer',
                }}
              >
                <option value={PERSONAL_SCOPE}>★ MY LEADS (PERSONAL)</option>
                {teamScopes.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.viewerRole === 'owner' ? '⚙ ' : '◇ '}TEAM: {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ padding: '10px 14px', background: terminalSurface, border: `1px solid ${terminalBorder}`, borderRadius: '4px', flexShrink: 0 }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ SELECT CAMPAIGN</div>
            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} style={{
              width: '100%', padding: '6px 10px', borderRadius: '4px',
              background: terminalBg, border: `1px solid ${terminalBorder}`,
              color: terminalText, fontSize: '12px', outline: 'none',
              fontFamily: 'monospace', cursor: 'pointer',
            }}>
              <option value="all">[ ALL {isPersonalScope ? 'ACTIVE' : 'TEAM'} CAMPAIGNS ]</option>
              {scopeCampaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.total_leads} leads</option>
              ))}
            </select>
            {scopeCampaigns.length === 0 && (
              <div style={{
                marginTop: '6px', padding: '5px 8px', background: '#f8e8e8',
                border: '1px solid #d0a0a0', borderRadius: '4px',
                fontSize: '10px', letterSpacing: '2px', color: terminalRed,
              }}>
                ⚠ {isPersonalScope ? 'NO ACTIVE CAMPAIGNS FOUND' : 'NO CAMPAIGNS ACCESSIBLE FROM THIS TEAM'}
              </div>
            )}
            {selectedCampaign === 'all' && (isPredictive || isProgressive || isPreview) && (
              <div style={{
                marginTop: 6, padding: '5px 8px',
                background: 'rgba(255,170,62,0.08)',
                border: '1px solid #8a6a1a', borderRadius: 4,
                fontSize: 10, color: '#8a6a1a', letterSpacing: 0.5,
              }}>
                ⚠ {dialerMode} mode requires a specific campaign selection
              </div>
            )}
          </div>

          <div style={{
            flex: 1, background: terminalSurface, border: `1px solid ${terminalBorder}`,
            borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 200,
          }}>
            <div style={{
              padding: '7px 14px', background: terminalDark, borderBottom: `1px solid ${terminalBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <span style={{ fontSize: '10px', letterSpacing: '3px', color: '#8888aa', fontWeight: 'bold' }}>
                {previewLead ? 'LEAD PREVIEW — REVIEW BEFORE DIALING' : 'LEAD PROFILE'}
              </span>
              {displayLead && (status === 'connected' || status === 'preview_ready') && (
                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#4a9eff' }}>ID: {displayLead.id.substring(0, 8)}</span>
              )}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              {(!displayLead || status === 'calling') ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px', filter: 'grayscale(1)', opacity: 0.4 }}>📋</div>
                  <p style={{ fontSize: '11px', letterSpacing: '3px', color: terminalMuted }}>
                    {noLeads ? 'NO MORE LEADS AVAILABLE' : status === 'calling' ? 'DIALING IN QUEUE...' : 'AWAITING DIAL COMMAND'}
                  </p>
                  {noLeads && (
                    <p style={{
                      fontSize: '10px',
                      color: tcpaBlockedAll ? terminalAmber : terminalRed,
                      marginTop: '8px',
                      letterSpacing: '2px',
                    }}>
                      {tcpaBlockedAll
                        ? '⏰ ALL LEADS OUTSIDE 8AM-9PM WINDOW — TRY LATER'
                        : isPersonalScope
                          ? 'UPLOAD MORE LEADS TO CONTINUE'
                          : 'NO MORE TEAM LEADS — TRY ANOTHER CAMPAIGN OR SCOPE'}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ padding: '12px', flexShrink: 0 }}>
                    <div style={{
                      padding: '10px 14px', background: terminalBg,
                      border: `2px solid ${status === 'connected' ? terminalGreen : status === 'preview_ready' ? terminalAccent : terminalBorder}`,
                      borderRadius: '4px', marginBottom: '10px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: '19px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalText, letterSpacing: '1px', marginBottom: '3px' }}>
                            {displayLead.first_name} {displayLead.last_name}
                          </div>
                          <div style={{ fontSize: '15px', fontFamily: 'monospace', color: terminalAccent, fontWeight: 'bold', letterSpacing: '2px' }}>
                            {displayLead.phone}
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 10px', borderRadius: '2px',
                          background: status === 'connected' ? '#e8f5e8' : status === 'preview_ready' ? '#e8eef8' : '#f0f0f0',
                          border: `1px solid ${status === 'connected' ? terminalGreen : status === 'preview_ready' ? terminalAccent : terminalBorder}`,
                          fontSize: '9px', letterSpacing: '2px', fontWeight: 'bold',
                          color: status === 'connected' ? terminalGreen : status === 'preview_ready' ? terminalAccent : terminalMuted,
                        }}>
                          {status === 'connected' ? '● LIVE' : status === 'preview_ready' ? '◉ PREVIEW' : '○ IDLE'}
                        </div>
                      </div>
                    </div>
                    {displayLead.extra_data && Object.keys(displayLead.extra_data).length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
                        {filteredExtraData(displayLead.extra_data).map(([key, value]) => (
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
                      display: 'flex', flexDirection: 'column', minHeight: 80,
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
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ NOTES <span style={{ opacity: 0.6 }}>(OPTIONAL)</span></div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to remember about this call..."
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px',
                  background: terminalBg, border: `1px solid ${terminalBorder}`,
                  borderRadius: 3, fontFamily: 'monospace', fontSize: 12,
                  color: terminalText, outline: 'none', resize: 'vertical',
                  marginBottom: 10, boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '8px' }}>▸ SELECT DISPOSITION</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: status === 'connected' ? '1fr 1fr' : status === 'preview_ready' ? '1fr 1fr' : '1fr', gap: '8px', flexShrink: 0 }}>
            {status === 'idle' && !available && (
              <button onClick={handleSetAvailable} style={{
                padding: '14px', borderRadius: '4px', border: 'none',
                background: terminalSurface, color: terminalMuted,
                fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                borderTop: `3px solid ${terminalBorder}`, transition: 'all 0.15s',
              }}>[ SET AVAILABLE TO DIAL ]</button>
            )}
            {status === 'idle' && available && scopeCampaigns.length === 0 && (
              <div style={{
                padding: '14px', borderRadius: '4px', background: terminalSurface, color: terminalMuted,
                fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                textAlign: 'center', borderTop: `3px solid ${terminalBorder}`,
              }}>[ NO CAMPAIGNS IN SCOPE ]</div>
            )}
            {status === 'idle' && available && scopeCampaigns.length > 0 && (
              <button onClick={handleDial} style={{
                padding: '14px', borderRadius: '4px', border: 'none',
                background: terminalDark, color: '#4a9eff',
                fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                borderTop: `3px solid #4a9eff`, transition: 'all 0.15s',
              }}>
                {isPreview ? '▶ LOAD NEXT LEAD' : '▶ INITIATE DIAL SEQUENCE'}
              </button>
            )}
            {status === 'preview_ready' && previewLead && (
              <>
                <button onClick={skipPreviewLead} style={{
                  padding: '14px', borderRadius: '4px',
                  background: '#f8f4e8', border: `1px solid #8a6a1a`,
                  borderTop: `3px solid #8a6a1a`, color: '#8a6a1a',
                  fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
                  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                }}>⏭ SKIP THIS LEAD</button>
                <button onClick={dialPreviewLead} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalDark, color: '#4a9eff',
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '3px',
                  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                  borderTop: `3px solid #4a9eff`,
                }}>▶ DIAL THIS LEAD</button>
              </>
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

        <div
          className={`dialer-right-overlay ${rightSidebarOpen ? 'open' : ''}`}
          onClick={() => setRightSidebarOpen(false)}
        />

        <aside className={`dialer-right-sidebar ${rightSidebarOpen ? 'open' : ''}`}>
          <div style={{ background: terminalDark, padding: '8px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', letterSpacing: '3px', color: '#8888aa', fontWeight: 'bold' }}>SESSION METRICS</span>
          </div>

          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
            {[
              { label: 'CONNECTED', value: sessionStats.connected, color: '#4a9eff' },
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
                YOUR SESSION&apos;S CONVERSION RATE
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalAccent }}>
                {sessionStats.calls > 0
                  ? `${(((sessionStats.appointments + sessionStats.closed) / sessionStats.calls) * 100).toFixed(1)}%`
                  : '0.0%'}
              </div>
            </div>
          </div>

          <ManualDialer />

          <div style={{ background: terminalDark, padding: '6px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0 }}>
            <span style={{ fontSize: '9px', letterSpacing: '3px', color: '#8888aa', fontWeight: 'bold' }}>SYSTEM LOG</span>
          </div>
          <div style={{ padding: '5px 12px', background: '#1a1c24', height: '88px', overflowY: 'auto', flexShrink: 0 }}>
            {[
              ...amdActivity.map(a => `> ${a}`),
              status === 'connected' && `> CONNECTED — ${currentLead?.first_name} ${currentLead?.last_name}`,
              status === 'calling' && '> DIALING IN QUEUE...',
              status === 'preview_ready' && `> PREVIEW LOADED — ${previewLead?.first_name} ${previewLead?.last_name}`,
              currentCampaign && `> MODE: ${dialerMode.toUpperCase()} + AMD`,
              isPredictive && pacingInfo && `> AGENTS: ${pacingInfo.activeAgents} · ABANDON: ${(pacingInfo.abandonRate * 100).toFixed(2)}%`,
              currentSessionId && '> SESSION ACTIVE',
              !isPersonalScope && currentScope && `> SCOPE: ${currentScope.name.toUpperCase()}`,
              swReady && '> AUDIO READY',
              available && '> AGENT STATUS: ONLINE',
            ].filter(Boolean).slice(0, 12).map((log, i) => (
              <div key={i} style={{
                fontSize: '9px', fontFamily: 'monospace',
                color: i === 0 ? '#4a9eff' : '#4a5a4a',
                letterSpacing: '1px', marginBottom: '2px',
              }}>{log as string}</div>
            ))}
          </div>
        </aside>
      </div>

      <button
        className="dialer-right-toggle"
        onClick={() => setRightSidebarOpen(true)}
        aria-label="Open metrics & dial pad"
      >☰</button>

      {dialZoomed && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: terminalBg, display: 'flex', flexDirection: 'column',
            height: '100vh', ['height' as any]: '100dvh',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialZoomed(false)
          }}
        >
          <ManualDialer inOverlay />
        </div>
      )}
    </div>
  )
}

const navLinkStyle: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent',
  border: '1px solid #2a4a8a', borderRadius: 3,
  color: '#4a9eff', fontSize: 10, fontWeight: 700, letterSpacing: 2,
  textDecoration: 'none', fontFamily: 'Futura PT, Futura, sans-serif',
}
export default function DialerPage() {
  return (
    <Suspense fallback={
      <div style={{
        flex: 1,
        background: '#f0f1f4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: '#5a5e6a' }}>
          LOADING TERMINAL...
        </div>
      </div>
    }>
      <DialerPageInner />
    </Suspense>
  )
}