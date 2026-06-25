'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// =============================================================================
// DIALER PAGE — Pass 2 Phase C9 (mobile fixes on top of C8)
// =============================================================================
// C9 changes vs C8 (mobile-only, inside the @media (max-width:768px) block):
//   1. .dialer-right-toggle  top: 66% -> 80%  (right-edge arrow sits lower,
//      between vertical center and the bottom of the screen).
//   2. .dialer-right-sidebar gains  padding-top: env(safe-area-inset-top, 0px)
//      and  box-sizing: border-box  so "TODAY'S METRICS" clears the iOS
//      status bar / notch instead of hiding behind it. The inset MUST be on
//      the position:fixed; top:0 element itself (this sidebar), not a child —
//      a child's padding can't move the fixed parent out from under the notch.
//      On non-notch devices the inset resolves to 0, so nothing changes there.
//
// Everything else is byte-for-byte C8.
// =============================================================================

type CallStatus = 'idle' | 'calling' | 'connected' | 'ended' | 'preview_ready'
type AccessTier = 'active' | 'lapsed' | 'new' | null
type DialerMode = 'preview' | 'power' | 'progressive' | 'predictive'
type AgentState = 'ready' | 'dialing' | 'on_call' | 'wrapping' | 'paused'

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
  scripts?: { id: string; name: string; body: string }[]
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
  readyAgents: number
  dialingAgents: number
  onCallAgents: number
  abandonRate: number
  isDegraded: boolean
  isPredictiveTeam: boolean
  configuredLines: number
  effectiveLines: number
}

interface LinesPrefInfo {
  effective_lines: number
  preferred_lines: number | null
  campaign_default: number
  campaign_min: number
  campaign_max: number
  hard_cap: number
}

interface HeartbeatControllerSummary {
  fired: number
  desired: number
  inFlight: number
  effectiveLines: number
  degraded: boolean
  reason: string
  callSids?: string[]
  skipped?: number
  released?: number
  dedupedPhones?: number
}

interface IncomingRouteResponse {
  incoming: boolean
  reason?: string
  call?: {
    id: string
    sid: string
    lead_id: string | null
    phone_number: string
    started_at: string
    room_name: string | null
  }
  lead?: Lead | null
  session_state?: string
  session_id?: string
}

interface SessionStats {
  calls: number
  connected: number
  appointments: number
  closed: number
  dnc: number
  notInterested: number
}

const ZERO_STATS: SessionStats = {
  calls: 0, connected: 0, appointments: 0, closed: 0, dnc: 0, notInterested: 0,
}

const PERSONAL_SCOPE = '__personal__'
const ALL_ACTIVE = '__all_active__'
const LS_LAST_CAMPAIGN = 'dialer:lastCampaign'
const LS_LAST_SCOPE = 'dialer:lastScope'
const LS_SESSION_STATS = 'dialer:sessionStats'
const LS_ALL_ACTIVE_MODE = 'dialer:allActiveMode'

const VALID_MODES: DialerMode[] = ['preview', 'power', 'progressive', 'predictive']

const MODE_OPTIONS: { value: DialerMode; label: string; color: string }[] = [
  { value: 'preview', label: 'PREVIEW', color: '#5a5e6a' },
  { value: 'power', label: 'POWER', color: '#2a4a8a' },
  { value: 'progressive', label: 'PROGRESSIVE', color: '#1a6a1a' },
  { value: 'predictive', label: 'PREDICTIVE', color: '#8a1a1a' },
]

const HEARTBEAT_INTERVAL_MS = 5_000
const PACING_POLL_INTERVAL_MS = 10_000
const INCOMING_POLL_INTERVAL_MS = 2_000

const LINES_OPTIONS = [1, 2, 3, 4, 5]

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function DialerPageInner() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [notes, setNotes] = useState('')
  const [tier, setTier] = useState<AccessTier>(null)
  const [tierLoaded, setTierLoaded] = useState(false)

  const [clockTick, setClockTick] = useState(0)

  const [status, setStatus] = useState<CallStatus>('idle')
  const [manualNumber, setManualNumber] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [available, setAvailable] = useState(false)

  // ─── PREDICTIVE ENGINE — explicit "started" flag ──────────────────────────
  const [predictiveEngineStarted, setPredictiveEngineStarted] = useState(false)

  const [disposition, setDisposition] = useState('')
  const [showDisposition, setShowDisposition] = useState(false)
  const [currentLead, setCurrentLead] = useState<Lead | null>(null)
  const [previewLead, setPreviewLead] = useState<Lead | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [campaignsLoaded, setCampaignsLoaded] = useState(false)
  const [showSelectCampaignMsg, setShowSelectCampaignMsg] = useState(false)
  const [callStart, setCallStart] = useState(0)
  // Final whole-second duration of the call that just ended, shown on the
  // lead profile / disposition sheet after hangup.
  const [lastCallDuration, setLastCallDuration] = useState<number | null>(null)
  const [noLeads, setNoLeads] = useState(false)
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [swReady, setSwReady] = useState(false)
  const [micGranted, setMicGranted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [dialZoomed, setDialZoomed] = useState(false)

  const [sessionStats, setSessionStats] = useState<SessionStats>(ZERO_STATS)
  const [sessionStatsLoaded, setSessionStatsLoaded] = useState(false)
  const [sessionDate, setSessionDate] = useState<string>(todayKey())

  const [teamScopes, setTeamScopes] = useState<TeamScope[]>([])
  const [selectedScope, setSelectedScope] = useState<string>(PERSONAL_SCOPE)
  const [scopesLoaded, setScopesLoaded] = useState(false)

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [pacingInfo, setPacingInfo] = useState<PacingInfo | null>(null)
  const [amdActivity, setAmdActivity] = useState<string[]>([])

  const [linesPref, setLinesPref] = useState<LinesPrefInfo | null>(null)
  const [linesPrefSaving, setLinesPrefSaving] = useState(false)

  const [lastControllerSummary, setLastControllerSummary] =
    useState<HeartbeatControllerSummary | null>(null)

  const [shouldYield, setShouldYield] = useState(false)
  const [tcpaBlockedAll, setTcpaBlockedAll] = useState(false)

  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [modeSaving, setModeSaving] = useState(false)

  const [allActiveOverrideMode, setAllActiveOverrideMode] = useState<DialerMode>('power')

  const [scriptIdx, setScriptIdx] = useState(0)
  // Draggable script-tab ordering. Holds a custom order of tab keys (campaign
  // id, or '__manual__'/'__single__' for the personal-single-script case).
  // Tabs not present in this list fall back to natural order, so new campaigns
  // appear at the end until the user drags them.
  const [scriptOrder, setScriptOrder] = useState<string[]>([])
  const [scriptDragKey, setScriptDragKey] = useState<string | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activePollRef = useRef<NodeJS.Timeout | null>(null)
  const swClientRef = useRef<any>(null)
  const swCallRef = useRef<any>(null)
  // ── GHOST-DIALING LOCKDOWN ────────────────────────────────────────────────
  // The browser is a SIP endpoint. To guarantee it can NEVER be bridged to a
  // call the user didn't initiate, we keep two things:
  //   1. callIntentRef — true ONLY while the user has actively armed dialing
  //      (pressed dial / started predictive / dialing a preview lead / manual
  //      dial). onInvite REJECTS any INVITE when this is false.
  //   2. registererRef — the SIP registration handle, so we can unregister when
  //      idle and re-register when armed. While unregistered, SignalWire has no
  //      route to this browser at all.
  const callIntentRef = useRef<boolean>(false)
  const registererRef = useRef<any>(null)

  const sessionHeartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const pacingPollRef = useRef<NodeJS.Timeout | null>(null)

  const incomingPollRef = useRef<NodeJS.Timeout | null>(null)
  const lastIncomingCallSidRef = useRef<string | null>(null)

  const urlParamsConsumedRef = useRef(false)
  const currentLeadRef = useRef<Lead | null>(null)
  const lsRestoredRef = useRef(false)
  const activeCallSidRef = useRef<string | null>(null)

  // ── GHOST-DIAL PREVENTION ───────────────────────────────────────────────
  // availableRef always holds the LIVE value of `available`. setTimeout/async
  // callbacks capture stale closure values of state; a ref does not. Every
  // dial path reads this ref at the moment of execution so a dial scheduled
  // while you were available cannot fire after you've gone unavailable.
  const availableRef = useRef(false)
  // Tracks every pending auto-chain setTimeout(handleDial) so we can cancel
  // them all the instant you go unavailable (the kill switch).
  const dialChainTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => setMounted(true), [])
  useEffect(() => { currentLeadRef.current = currentLead }, [currentLead])
  useEffect(() => { activeCallSidRef.current = activeCallSid }, [activeCallSid])
  // Keep availableRef in lock-step with the available state.
  useEffect(() => { availableRef.current = available }, [available])
  const predictiveEngineStartedRef = useRef(false)
  useEffect(() => { predictiveEngineStartedRef.current = predictiveEngineStarted }, [predictiveEngineStarted])
  // On unmount (navigating away from the dialer), cancel any pending auto-chain
  // dials so a queued timer can't fire a call after you've left the page.
  useEffect(() => {
    return () => {
      for (const id of dialChainTimeoutsRef.current) clearTimeout(id)
      dialChainTimeoutsRef.current.clear()
    }
  }, [])

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

  const isAllActive = selectedCampaign === ALL_ACTIVE
  const isSpecificCampaign = !!selectedCampaign && !isAllActive

  const currentCampaign: Campaign | undefined =
    isSpecificCampaign
      ? campaigns.find(c => c.id === selectedCampaign)
      : undefined

  const dialerMode: DialerMode =
    isSpecificCampaign
      ? ((currentCampaign?.dialer_mode as DialerMode) || 'power')
      : isAllActive
        ? allActiveOverrideMode
        : 'power'

  const isPredictive = dialerMode === 'predictive'
  const isProgressive = dialerMode === 'progressive'
  const isPreview = dialerMode === 'preview'
  const isPower = dialerMode === 'power'

  // Continuous-dialing modes auto-advance to the next lead when a call ends
  // WITHOUT a human (machine drop, no-answer, busy, failed). Power and
  // progressive both keep the agent moving; preview is one-at-a-time by design
  // and predictive is server-driven, so neither auto-chains here.
  // (A HUMAN answer never auto-skips — that always shows the disposition sheet.)
  const autoChainOnFailure = isProgressive || isPower

  const modeRequiresSpecific = false

  const modeTileInteractive = isSpecificCampaign || isAllActive

  const agentState: AgentState = (() => {
    if (!available) return 'paused'
    if (status === 'connected') return 'on_call'
    if (status === 'calling') return 'dialing'
    if (showDisposition) return 'wrapping'
    return 'ready'
  })()

  type PredictiveView = 'offline' | 'available' | 'on_call' | 'wrapping'
  const predictiveView: PredictiveView = (() => {
    if (!available) return 'offline'
    if (showDisposition) return 'wrapping'
    if (status === 'connected' && currentLead) return 'on_call'
    return 'available'
  })()

  // ── SESSION METRICS PERSISTENCE ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    try {
      const today = todayKey()
      const raw = localStorage.getItem(`${LS_SESSION_STATS}:${user.id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.date === today && parsed.stats) {
          setSessionStats({ ...ZERO_STATS, ...parsed.stats })
        } else {
          setSessionStats(ZERO_STATS)
        }
      }
      setSessionDate(today)
    } catch {}
    setSessionStatsLoaded(true)
  }, [user])

  useEffect(() => {
    if (!user || !sessionStatsLoaded) return
    try {
      localStorage.setItem(
        `${LS_SESSION_STATS}:${user.id}`,
        JSON.stringify({ date: sessionDate, stats: sessionStats })
      )
    } catch {}
  }, [sessionStats, sessionDate, user, sessionStatsLoaded])

  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      const today = todayKey()
      if (today !== sessionDate) {
        setSessionStats(ZERO_STATS)
        setSessionDate(today)
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [sessionDate, user])

  useEffect(() => {
    if (!user || !lsRestoredRef.current) return
    if (selectedCampaign) {
      try { localStorage.setItem(`${LS_LAST_CAMPAIGN}:${user.id}`, selectedCampaign) } catch {}
    } else {
      try { localStorage.removeItem(`${LS_LAST_CAMPAIGN}:${user.id}`) } catch {}
    }
  }, [selectedCampaign, user])

  useEffect(() => {
    if (!user || !lsRestoredRef.current) return
    try { localStorage.setItem(`${LS_LAST_SCOPE}:${user.id}`, selectedScope) } catch {}
  }, [selectedScope, user])

  useEffect(() => {
    if (!user || !lsRestoredRef.current) return
    try { localStorage.setItem(`${LS_ALL_ACTIVE_MODE}:${user.id}`, allActiveOverrideMode) } catch {}
  }, [allActiveOverrideMode, user])

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
    if (!user || !campaignsLoaded || !scopesLoaded || lsRestoredRef.current) return

    const teamIdParam = searchParams.get('teamId')
    const campaignIdParam = searchParams.get('campaignId')

    if (teamIdParam && teamScopes.find(s => s.id === teamIdParam)) {
      setSelectedScope(teamIdParam)
    } else {
      try {
        const lastScope = localStorage.getItem(`${LS_LAST_SCOPE}:${user.id}`)
        if (lastScope && (lastScope === PERSONAL_SCOPE || teamScopes.find(s => s.id === lastScope))) {
          setSelectedScope(lastScope)
        }
      } catch {}
    }

    if (campaignIdParam && campaigns.find(c => c.id === campaignIdParam && c.status === 'active')) {
      setSelectedCampaign(campaignIdParam)
    } else {
      try {
        const lastCampaign = localStorage.getItem(`${LS_LAST_CAMPAIGN}:${user.id}`)
        if (
          lastCampaign === ALL_ACTIVE ||
          (lastCampaign && campaigns.find(c => c.id === lastCampaign && c.status === 'active'))
        ) {
          setSelectedCampaign(lastCampaign)
        }
      } catch {}
    }

    try {
      const lastAllActiveMode = localStorage.getItem(`${LS_ALL_ACTIVE_MODE}:${user.id}`)
      if (lastAllActiveMode && VALID_MODES.includes(lastAllActiveMode as DialerMode)) {
        setAllActiveOverrideMode(lastAllActiveMode as DialerMode)
      }
    } catch {}

    lsRestoredRef.current = true
    urlParamsConsumedRef.current = true
  }, [user, campaignsLoaded, scopesLoaded, teamScopes, campaigns, searchParams])

  useEffect(() => {
    if (user && isActive) fetchCampaigns()
  }, [user, isActive])

  useEffect(() => {
    if (!lsRestoredRef.current) return
    setSelectedCampaign('')
    setPredictiveEngineStarted(false)
  }, [selectedScope])

  useEffect(() => {
    setPredictiveEngineStarted(false)
    // Reset script tab state when switching campaigns — a previous campaign's
    // custom order keys don't apply here and could otherwise hide tabs.
    setScriptOrder([])
    setScriptIdx(0)
    setScriptDragKey(null)
  }, [selectedCampaign])

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
        // SECURITY: fetch SIP credentials from an authenticated server endpoint
        // instead of NEXT_PUBLIC_* env vars (which are inlined into the public
        // bundle and were removed). If this fetch is skipped, SIP never
        // registers and there is NO call audio in either direction.
        let sipUsername: string | undefined
        let sipPassword: string | undefined
        let sipDomain: string | undefined
        let iceServers: RTCIceServer[] | undefined
        try {
          const credRes = await fetch('/api/calls/sip-credentials')
          if (!credRes.ok) {
            console.error('SIP credentials fetch failed:', credRes.status)
            return
          }
          const cred = await credRes.json()
          if (!cred?.success) {
            console.error('SIP credentials unavailable:', cred?.error)
            return
          }
          sipUsername = cred.sipUsername
          sipPassword = cred.sipPassword
          sipDomain = cred.sipDomain
          iceServers = cred.iceServers
        } catch (credErr) {
          console.error('SIP credentials request error:', credErr)
          return
        }

        if (!sipUsername || !sipPassword || !sipDomain) return

        const { UserAgent, Registerer, SessionState } = await import('sip.js')
        const uri = UserAgent.makeURI(`sip:${sipUsername}@${sipDomain}`)
        if (!uri) return

        const userAgent = new UserAgent({
          uri,
          authorizationUsername: sipUsername,
          authorizationPassword: sipPassword,
          transportOptions: { server: `wss://${sipDomain}` },
          sessionDescriptionHandlerFactoryOptions: {
            // peerConnectionConfiguration.iceServers is THE audio-path fix.
            // Without STUN/TURN the browser can't find a reachable media path
            // across NAT and you get dead air after the lead picks up. Fall back
            // to public STUN if the server didn't return any (so audio still
            // works even if the endpoint shape changes).
            peerConnectionConfiguration: {
              iceServers:
                iceServers && iceServers.length > 0
                  ? iceServers
                  : [{ urls: ['stun:stun.signalwire.com:3478', 'stun:stun.l.google.com:19302'] }],
              // Pool a candidate ahead of time so gathering doesn't add latency
              // at answer. Small but helps the "pickup = hear" goal.
              iceCandidatePoolSize: 1,
            },
            constraints: { audio: true, video: false },
          },
        })

        userAgent.delegate = {
          onInvite: async (invitation: any) => {
            // GHOST-DIALING GUARD: only accept an inbound INVITE if the user has
            // actively armed dialing. Any call the user did not initiate (stale
            // fanout, late AMD redirect, leftover agent leg, another tab) is
            // hard-rejected so the user can never be bridged to audio they didn't
            // ask for. This is the strict, multi-user-safe lock.
            if (!callIntentRef.current) {
              try {
                await invitation.reject({ statusCode: 486 }) // Busy Here
                console.warn('[sip] rejected unarmed INVITE (ghost-dialing guard)')
              } catch (err) {
                console.error('[sip] failed to reject unarmed INVITE:', err)
              }
              return
            }
            try {
              invitation.stateChange.addListener((state: any) => {
                if (state === SessionState.Established) {
                  swCallRef.current = invitation
                  attachSIPAudio(invitation)
                } else if (state === SessionState.Terminated) {
                  if (swCallRef.current === invitation) swCallRef.current = null
                }
              })
              await invitation.accept({
                sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
              })
              // Attach immediately as well — don't wait only on the Established
              // event. The SDH/peer connection exists right after accept(), so
              // wiring audio now shaves the gap to first sound.
              swCallRef.current = invitation
              attachSIPAudio(invitation)
            } catch (err) {
              console.error('Error accepting SIP invite:', err)
            }
          },
        }

        await userAgent.start()
        // Keep the registerer handle so we can register/unregister with the
        // user's dialing intent (see armDialing/disarmDialing). We register now
        // so the endpoint is reachable the instant the user arms a call, but the
        // onInvite guard above still blocks anything they didn't initiate.
        const registerer = new Registerer(userAgent)
        registererRef.current = registerer
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
    // Ensure the AudioContext is running (autoplay policies can suspend it).
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    } catch {}

    const getAudioEl = (): HTMLAudioElement => {
      let audioEl = document.getElementById('sip-audio') as HTMLAudioElement | null
      if (!audioEl) {
        audioEl = document.createElement('audio')
        audioEl.id = 'sip-audio'
        audioEl.autoplay = true
        ;(audioEl as any).playsInline = true
        document.body.appendChild(audioEl)
      }
      return audioEl
    }

    const tryAttach = () => {
      try {
        const sdh = session.sessionDescriptionHandler
        if (!sdh) return false
        const pc = sdh.peerConnection
        if (!pc) return false

        pc.ontrack = (event: RTCTrackEvent) => {
          if (event.streams && event.streams[0]) {
            const audioEl = getAudioEl()
            audioEl.srcObject = event.streams[0]
            audioEl.play().catch(console.error)
          }
        }

        pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
          if (receiver.track && receiver.track.kind === 'audio') {
            const stream = new MediaStream([receiver.track])
            const audioEl = getAudioEl()
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
    const shouldHaveSession = available && isSpecificCampaign && currentCampaign

    if (shouldHaveSession) {
      if (!sessionIdRef.current) {
        startSession(selectedCampaign)
      }
      if (!sessionHeartbeatRef.current) {
        sessionHeartbeatRef.current = setInterval(() => {
          if (isSpecificCampaign) startSession(selectedCampaign)
        }, 30000)
      }
    } else {
      if (sessionIdRef.current) endSession()
      if (sessionHeartbeatRef.current) {
        clearInterval(sessionHeartbeatRef.current)
        sessionHeartbeatRef.current = null
      }
    }

    return () => {
      if (sessionHeartbeatRef.current) {
        clearInterval(sessionHeartbeatRef.current)
        sessionHeartbeatRef.current = null
      }
    }
  }, [available, selectedCampaign, currentCampaign, isActive, isSpecificCampaign, startSession, endSession])

  useEffect(() => {
    if (!isActive) return

    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/dialer/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: agentState,
            campaign_id: isSpecificCampaign ? selectedCampaign : null,
            dialer_mode: dialerMode,
            current_call_id: activeCallSid || null,
            // Server-side ghost guard: the controller only fans out lines when
            // the agent has explicitly started the predictive engine.
            predictive_armed: isPredictive && predictiveEngineStarted,
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (typeof data.should_yield === 'boolean') {
          setShouldYield(data.should_yield)
        }
        if (data.controller_invoked && data.controller) {
          setLastControllerSummary(data.controller as HeartbeatControllerSummary)
          const summary = data.controller as HeartbeatControllerSummary
          if (summary.fired > 0) {
            setAmdActivity(prev => [
              `CONTROLLER FIRED ${summary.fired} LINE${summary.fired === 1 ? '' : 'S'} (${summary.effectiveLines}x target)`,
              ...prev,
            ].slice(0, 5))
          } else if (summary.degraded) {
            setAmdActivity(prev => [
              `⚠ AUTO-DEGRADED — abandon rate trigger`,
              ...prev,
            ].slice(0, 5))
          }
        }
      } catch {
        // Network blip — next heartbeat will retry
      }
    }

    sendHeartbeat()
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [
    isActive,
    agentState,
    isSpecificCampaign,
    selectedCampaign,
    dialerMode,
    activeCallSid,
    isPredictive,
    predictiveEngineStarted,
  ])

  useEffect(() => {
    if (
      !isActive ||
      !isPredictive ||
      predictiveView !== 'available' ||
      !predictiveEngineStarted
    ) {
      if (incomingPollRef.current) {
        clearInterval(incomingPollRef.current)
        incomingPollRef.current = null
      }
      return
    }

    // The predictive engine is running and we're available — stay armed for the
    // whole duration so incoming-route humans can be bridged. The effect's deps
    // ensure this only holds while predictiveEngineStarted && available.
    armDialing()

    const pollIncoming = async () => {
      try {
        // Live guard: if you've gone unavailable since this interval was set,
        // do not attach any routed call. Prevents a predictive ghost-connect.
        if (!availableRef.current) return

        const res = await fetch('/api/calls/incoming-route')
        if (!res.ok) return
        const data = (await res.json()) as IncomingRouteResponse
        if (!data.incoming || !data.call) return

        if (lastIncomingCallSidRef.current === data.call.sid) return

        // Re-check after the await — availability may have changed while the
        // request was in flight. Never auto-attach audio to an offline agent.
        if (!availableRef.current) return

        lastIncomingCallSidRef.current = data.call.sid
        armDialing() // a human is being routed to us right now — allow the bridge

        setAmdActivity(prev => [
          `HUMAN ROUTED — ${data.lead?.first_name || ''} ${data.lead?.last_name || ''}`.trim(),
          ...prev,
        ].slice(0, 5))

        playPickup()
        setActiveCallSid(data.call.sid)
        if (data.lead) {
          setCurrentLead(data.lead)
        }
        setStatus('connected')
        setSessionStats(s => ({ ...s, calls: s.calls + 1, connected: s.connected + 1 }))

        startHangupPolling(data.call.sid)
      } catch {
        // Network blip — next poll will retry
      }
    }

    pollIncoming()
    incomingPollRef.current = setInterval(pollIncoming, INCOMING_POLL_INTERVAL_MS)

    return () => {
      if (incomingPollRef.current) {
        clearInterval(incomingPollRef.current)
        incomingPollRef.current = null
      }
    }
  }, [isActive, isPredictive, predictiveView, predictiveEngineStarted])

  useEffect(() => {
    if (!isActive || !isPredictive || !isSpecificCampaign) {
      setLinesPref(null)
      return
    }

    let cancelled = false
    fetch(`/api/predictive/prefs?campaign_id=${selectedCampaign}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) {
          setLinesPref(null)
          return
        }
        setLinesPref(d as LinesPrefInfo)
      })
      .catch(() => {
        if (!cancelled) setLinesPref(null)
      })
    return () => { cancelled = true }
  }, [isActive, isPredictive, isSpecificCampaign, selectedCampaign])

  const handleLinesChange = async (newLines: number) => {
    if (!selectedCampaign || !isPredictive) return
    setLinesPrefSaving(true)
    try {
      const res = await fetch('/api/predictive/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: selectedCampaign,
          preferred_lines: newLines,
        }),
      })
      const data = await res.json()
      if (!data.error) {
        setLinesPref(data as LinesPrefInfo)
        setAmdActivity(prev => [
          `LINES PREFERENCE → ${data.effective_lines}`,
          ...prev,
        ].slice(0, 5))
      }
    } catch (err) {
      console.error('lines pref save failed:', err)
    } finally {
      setLinesPrefSaving(false)
    }
  }

  useEffect(() => {
    const handleUnload = () => {
      // Disarm immediately and tear down SIP so a refresh/close can't leave a
      // registered endpoint that auto-answers a ghost call after reload.
      disarmDialing({ force: true })
      try { registererRef.current?.unregister?.() } catch {}
      try { swClientRef.current?.stop?.() } catch {}
      const sid = sessionIdRef.current
      if (sid && navigator.sendBeacon) {
        const blob = new Blob(
          [JSON.stringify({ sessionId: sid })],
          { type: 'application/json' }
        )
        navigator.sendBeacon('/api/dialer/session-end', blob)
      }
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob(
            [JSON.stringify({ state: 'paused' })],
            { type: 'application/json' }
          )
          navigator.sendBeacon('/api/dialer/heartbeat', blob)
        } catch {}
      }
      const callSid = activeCallSidRef.current
      if (callSid && navigator.sendBeacon) {
        try {
          const blob = new Blob(
            [JSON.stringify({ sid: callSid })],
            { type: 'application/json' }
          )
          navigator.sendBeacon('/api/calls/hangup', blob)
        } catch {}
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
    if (!isActive || !isPredictive || !available || !isSpecificCampaign) {
      setPacingInfo(null)
      if (pacingPollRef.current) {
        clearInterval(pacingPollRef.current)
        pacingPollRef.current = null
      }
      return
    }

    const fetchPacing = async () => {
      try {
        const res = await fetch(`/api/dialer/active-agents?campaign_id=${selectedCampaign}`)
        if (!res.ok) return
        const data = await res.json()
        const cp = data.campaign_pacing
        if (!cp) {
          setPacingInfo(null)
          return
        }

        const configuredLines = linesPref?.effective_lines || currentCampaign?.predictive_lines_per_agent || 3
        const abandonRateDecimal = (cp.abandon_rate_pct ?? 0) / 100
        const isDegraded = abandonRateDecimal >= 0.025

        setPacingInfo({
          activeAgents: cp.active_agents,
          readyAgents: cp.ready_agents,
          dialingAgents: cp.dialing_agents,
          onCallAgents: cp.on_call_agents,
          abandonRate: abandonRateDecimal,
          isDegraded,
          isPredictiveTeam: cp.is_predictive_team,
          configuredLines,
          effectiveLines: isDegraded ? 1.0 : configuredLines,
        })
      } catch {}
    }

    fetchPacing()
    pacingPollRef.current = setInterval(fetchPacing, PACING_POLL_INTERVAL_MS)
    return () => {
      if (pacingPollRef.current) {
        clearInterval(pacingPollRef.current)
        pacingPollRef.current = null
      }
    }
  }, [isActive, isPredictive, available, isSpecificCampaign, selectedCampaign, currentCampaign, linesPref])

  const handleSetAvailable = async () => {
    let granted = micGranted
    if (!granted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        setMicGranted(true)
        granted = true
      } catch (err) {
        console.warn('Microphone permission denied:', err)
        return
      }
    }

    const goingOffline = availableRef.current
    if (goingOffline) {
      // ── KILL SWITCH ───────────────────────────────────────────────────────
      // Going offline must stop everything immediately: disarm dialing so no
      // INVITE can ever connect, cancel every pending auto-chain dial, and hang
      // up any call currently attached. This is what makes "unavailable" mean it.
      disarmDialing({ force: true })
      cancelAllPendingDials()
      if (activeCallSidRef.current) {
        await hangupCall(activeCallSidRef.current)
      }
      setStatus('idle')
      setCurrentLead(null)
      setPreviewLead(null)
      setShowDisposition(false)
      setDisposition('')
      setSeconds(0)
      setPredictiveEngineStarted(false)
      lastIncomingCallSidRef.current = null
    }

    setAvailable(prev => !prev)
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

  // ── GHOST-DIALING ARM / DISARM ────────────────────────────────────────────
  // armDialing() must be called RIGHT BEFORE any action that legitimately causes
  // SignalWire to bridge a call to this browser (placing an outbound dial,
  // starting the predictive engine, dialing a preview lead, manual dial).
  // disarmDialing() is called whenever the user is no longer expecting audio
  // (call ended, terminated, skipped to no call, went offline). While disarmed,
  // onInvite rejects everything, so no ghost call can connect.
  const armDialing = () => { callIntentRef.current = true }
  // disarmDialing({ force }): normally we keep the browser armed while the
  // predictive engine is running, because humans route in continuously and a
  // brief disarm between calls could reject an in-flight human. The explicit
  // kill paths (Stop engine, go offline, page unload) pass force:true after
  // they've already turned the engine off.
  const disarmDialing = (opts?: { force?: boolean }) => {
    const keepForPredictive =
      !opts?.force && isPredictive && predictiveEngineStartedRef.current
    if (keepForPredictive) {
      // Engine still running — tear down the just-ended leg but stay armed so
      // the next routed human can connect.
      if (swCallRef.current) {
        try {
          if (swCallRef.current.bye) swCallRef.current.bye()
          else if (swCallRef.current.hangup) swCallRef.current.hangup()
        } catch {}
        swCallRef.current = null
      }
      return
    }
    callIntentRef.current = false
    // Proactively tear down any SIP session that may still be up so a lingering
    // leg can't keep audio flowing after the user expects silence.
    if (swCallRef.current) {
      try {
        if (swCallRef.current.bye) swCallRef.current.bye()
        else if (swCallRef.current.reject) swCallRef.current.reject()
        else if (swCallRef.current.hangup) swCallRef.current.hangup()
      } catch {}
      swCallRef.current = null
    }
  }

  const hangupCall = async (sid: string | null) => {
    // Any hangup means the user is no longer on a call they initiated — disarm
    // so a follow-on INVITE can't reconnect audio behind their back.
    disarmDialing()
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
    if (data.success) {
      setCampaigns(data.campaigns)
    }
    setCampaignsLoaded(true)
  }

  const isPersonalScope = selectedScope === PERSONAL_SCOPE
  const currentScope = teamScopes.find(s => s.id === selectedScope) || null

  const scopeCampaigns: { id: string; name: string; total_leads: number; status: string }[] = isPersonalScope
    ? campaigns.map(c => ({ id: c.id, name: c.name, total_leads: c.total_leads, status: c.status }))
    : (currentScope?.teamCampaigns
        .filter(tc => tc.campaign)
        .map(tc => ({
          id: tc.campaign!.id,
          name: tc.campaign!.name,
          total_leads: tc.campaign!.total_leads,
          status: tc.campaign!.status,
        })) || [])

  const activeScopeCampaigns = scopeCampaigns.filter(c => c.status === 'active')
  const activeCampaignsCount = activeScopeCampaigns.length

  const fetchNextLead = async (): Promise<Lead | null> => {
    const params = new URLSearchParams({ user_id: user?.id || '' })
    if (isSpecificCampaign) params.append('campaign_id', selectedCampaign)
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

  // Live timer display: H:MM:SS once the call passes an hour, else MM:SS.
  const formatTime = (s: number) => {
    const safe = Math.max(0, Math.floor(s))
    const h = Math.floor(safe / 3600)
    const m = Math.floor((safe % 3600) / 60)
    const sec = safe % 60
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // Human-readable duration for the after-call summary, e.g. "1h 4m 12s",
  // "3m 8s", "47s". Whole seconds only — never milliseconds.
  const formatDurationLong = (totalSeconds: number) => {
    const safe = Math.max(0, Math.floor(totalSeconds))
    const h = Math.floor(safe / 3600)
    const m = Math.floor((safe % 3600) / 60)
    const sec = safe % 60
    const parts: string[] = []
    if (h > 0) parts.push(`${h}h`)
    if (m > 0) parts.push(`${m}m`)
    parts.push(`${sec}s`) // always show seconds so a sub-minute call still reads
    return parts.join(' ')
  }

  const now = new Date()
  const timeStr = mounted ? now.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'
  const dateStr = mounted ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
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
    // ── HARD GUARD (final gate before SignalWire) ───────────────────────────
    // This is the last function before the POST to /api/calls/outbound. Even if
    // something reached here unexpectedly, refuse to dial unless you are
    // actively available right now. Nothing talks to SignalWire otherwise.
    if (!availableRef.current) {
      setStatus('idle')
      return
    }

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
      if (autoChainOnFailure) scheduleDial(300)
      else setStatus('idle')
      return
    }

    setStatus('calling')
    setSessionStats(s => ({ ...s, calls: s.calls + 1 }))
    playInitiateBlip()
    armDialing() // user-initiated dial — allow SignalWire to bridge to us
    setLastCallDuration(null) // clear the previous call's duration readout

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
          if (autoChainOnFailure) scheduleDial(500)
          else scheduleDial(300)
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
        if (autoChainOnFailure) scheduleDial(500)
      }
    } catch (error) {
      console.error('Call error:', error)
      setStatus('idle')
      setCurrentLead(null)
    }
  }

  const isNotHuman = (amd?: string): boolean => {
    if (!amd) return false
    return amd.startsWith('machine_') || amd === 'fax' || amd === 'unknown'
  }

  const startHangupPolling = (callSid: string) => {
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
          // Call is over. Disarm so nothing can bridge audio to us during wrap-up
          // / the disposition sheet. An auto-chained next dial re-arms itself.
          disarmDialing()

          if (isNotHuman(d.amd_result)) {
            setAmdActivity(prev =>
              [`VOICEMAIL FILTERED LATE — ${d.amd_result}`, ...prev].slice(0, 5)
            )
            setStatus('idle')
            setCurrentLead(null)
            if (autoChainOnFailure) scheduleDial(600)
          } else {
            // Snapshot the final duration before the timer effect resets it,
            // so the disposition sheet can show how long the call lasted.
            setLastCallDuration(
              callStart ? Math.max(0, Math.floor((Date.now() - callStart) / 1000)) : seconds
            )
            // Cancel any pending auto-chain dial so a new call can NEVER start
            // while you're filling out the disposition sheet. The next call only
            // begins when you submit a disposition.
            cancelAllPendingDials()
            setStatus('ended')
            setShowDisposition(true)
          }
        }
      } catch {
        clearInterval(hangupPoll)
        activePollRef.current = null
      }
    }, 2000)
    activePollRef.current = hangupPoll
  }

  const startCallPolling = (callSid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/calls/check?sid=${callSid}`)
        const statusData = await statusRes.json()

        if (statusData.status === 'in-progress') {
          clearInterval(pollInterval)
          activePollRef.current = null

          if (isNotHuman(statusData.amd_result)) {
            setAmdActivity(prev =>
              [`VOICEMAIL FILTERED — ${statusData.amd_result}`, ...prev].slice(0, 5)
            )
            setActiveCallSid(null)
            disarmDialing() // machine — drop any browser leg; next dial re-arms
            setStatus('idle')
            setCurrentLead(null)
            scheduleDial(600)
            return
          }

          playPickup()
          setStatus('connected')
          setSessionStats(s => ({ ...s, connected: s.connected + 1 }))

          startHangupPolling(callSid)

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

          if (isNotHuman(statusData.amd_result)) {
            setAmdActivity(prev =>
              [`VOICEMAIL FILTERED — ${statusData.amd_result}`, ...prev].slice(0, 5)
            )
          }

          const ld = currentLeadRef.current
          if (ld) {
            const isAmdHangup = isNotHuman(statusData.amd_result)
            if (!isAmdHangup) {
              await fetch('/api/leads/dispose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lead_id: ld.id,
                  campaign_id: ld.campaign_id,
                  user_id: user?.id,
                  disposition: 'NO_ANSWER',
                  duration: 0,
                }),
              })
            }
          }
          setStatus('idle')
          setCurrentLead(null)
          disarmDialing() // call ended without a human; next dial re-arms

          scheduleDial(800)
        }
      } catch (err) {
        clearInterval(pollInterval)
        activePollRef.current = null
      }
    }, 1500)
    activePollRef.current = pollInterval
  }

  // ── GHOST-DIAL PREVENTION: cancellable, guarded auto-chaining ────────────
  // Cancels every pending auto-chain dial. Called the moment you go offline so
  // no queued setTimeout can wake up and dial after you've stopped.
  const cancelAllPendingDials = () => {
    for (const id of dialChainTimeoutsRef.current) clearTimeout(id)
    dialChainTimeoutsRef.current.clear()
  }

  // Schedules the next auto-chain dial, but tracked so it can be cancelled, and
  // re-checks availability when it fires. Use this everywhere instead of a bare
  // setTimeout(() => handleDial(), n).
  const scheduleDial = (delayMs: number) => {
    const id = setTimeout(() => {
      dialChainTimeoutsRef.current.delete(id)
      // Final live check: if you went offline during the delay, do nothing.
      if (!availableRef.current) return
      handleDial()
    }, delayMs)
    dialChainTimeoutsRef.current.add(id)
  }

  const handleDial = async () => {
    // ── HARD GUARD ──────────────────────────────────────────────────────────
    // The single authoritative gate: a dial may only proceed if you are
    // actively available at THIS moment. This stops "ghost dialing" — calls
    // firing from stale timers or async flows after you've gone unavailable.
    // Manual keypad dials go through handleManualDial, not here, so this does
    // not affect intentional manual dialing.
    if (!availableRef.current) return

    setShowDisposition(false)
    setDisposition('')
    setNoLeads(false)

    if (!selectedCampaign) {
      setShowSelectCampaignMsg(true)
      setTimeout(() => setShowSelectCampaignMsg(false), 4000)
      return
    }

    if (isPredictive) {
      setPredictiveEngineStarted(true)
      armDialing() // predictive engine running — incoming-route may bridge a human to us
      lastIncomingCallSidRef.current = null
      setAmdActivity(prev => [
        `PREDICTIVE ENGINE STARTED`,
        ...prev,
      ].slice(0, 5))
      return
    }

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

    if (isPredictive) {
      lastIncomingCallSidRef.current = null
    } else {
      scheduleDial(300)
    }
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

      if (isPredictive) {
        lastIncomingCallSidRef.current = null
        return
      }
      await handleDial()
    }, autoChainOnFailure ? 800 : 600)
  }

  const handleManualDial = async () => {
    if (!manualNumber) return
    setDialZoomed(false)
    setStatus('calling')
    setSessionStats(s => ({ ...s, calls: s.calls + 1 }))
    playInitiateBlip()
    armDialing() // user pressed dial on the keypad — allow bridge
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

  const handleModeChange = async (newMode: DialerMode) => {
    if (newMode === dialerMode) {
      setModeDropdownOpen(false)
      return
    }

    if (isAllActive) {
      setAllActiveOverrideMode(newMode)
      setModeDropdownOpen(false)
      return
    }

    if (!currentCampaign) {
      setModeDropdownOpen(false)
      return
    }

    setModeSaving(true)
    try {
      const amd = newMode === 'progressive' || newMode === 'predictive'
      const res = await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCampaign.id,
          dialer_mode: newMode,
          amd_enabled: amd,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCampaigns(prev => prev.map(c =>
          c.id === currentCampaign.id ? { ...c, dialer_mode: newMode, amd_enabled: amd } : c
        ))
      }
    } catch (err) {
      console.error('Mode change failed:', err)
    } finally {
      setModeSaving(false)
      setModeDropdownOpen(false)
    }
  }

  useEffect(() => {
    if (!modeDropdownOpen) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.mode-tile-wrap')) {
        setModeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [modeDropdownOpen])

  const nameKeys = ['name', 'first_name', 'last_name', 'full_name', 'fname', 'lname', 'firstname', 'lastname']
  const filteredExtraData = (data: Record<string, any>) => {
    return Object.entries(data).filter(([k, v]) =>
      v && String(v).trim() && !nameKeys.some(n => k.toLowerCase().replace(/[^a-z]/g, '') === n.replace(/[^a-z]/g, ''))
    )
  }

  const dispositions = [
    { label: 'CLOSED', color: '#16a34a', bg: '#dcfce7' },
    { label: 'APPOINTMENT', color: '#2563eb', bg: '#dbeafe' },
    { label: 'NOT INTERESTED', color: '#d97706', bg: '#fef3c7' },
    { label: 'DO NOT CALL', color: '#dc2626', bg: '#fee2e2' },
    { label: 'SKIP', color: '#64748b', bg: '#f1f5f9' },
  ]

  // Build the raw set of script tabs from each campaign's enabled scripts
  // (new global-library model). Each tab key is the script id; for ALL ACTIVE
  // we show every enabled script across active campaigns. Falls back to the
  // legacy single `script` field if a campaign has no linked scripts yet.
  const campaignScriptTabs = (c: Campaign): { key: string; name: string; script: string }[] => {
    if (c.scripts && c.scripts.length > 0) {
      return c.scripts.map(s => ({ key: s.id, name: s.name, script: s.body }))
    }
    if (c.script) return [{ key: c.id, name: c.name, script: c.script }]
    return []
  }

  let rawScriptTabs: { key: string; name: string; script: string }[] = []
  if (isSpecificCampaign && currentCampaign) {
    rawScriptTabs = campaignScriptTabs(currentCampaign)
  } else if (isAllActive && isPersonalScope) {
    const seen = new Set<string>()
    for (const c of campaigns) {
      if (c.status !== 'active') continue
      for (const t of campaignScriptTabs(c)) {
        if (seen.has(t.key)) continue
        seen.add(t.key)
        rawScriptTabs.push(t)
      }
    }
  }

  // Apply the user's custom drag order: keys present in scriptOrder come first
  // (in that order), any new/unordered tabs keep their natural order at the end.
  // HARDENING: a stale scriptOrder (keys that no longer exist after a campaign
  // refresh) must never cause tabs to disappear. We always append every raw tab
  // that wasn't placed by the order, and if the result is somehow empty we fall
  // back to the raw tabs. This fixes tabs vanishing on drag/click until refresh.
  const scriptTabs = (() => {
    if (rawScriptTabs.length === 0) return rawScriptTabs
    if (scriptOrder.length === 0) return rawScriptTabs
    const byKey = new Map(rawScriptTabs.map(t => [t.key, t]))
    const ordered: typeof rawScriptTabs = []
    for (const k of scriptOrder) {
      const t = byKey.get(k)
      if (t) { ordered.push(t); byKey.delete(k) }
    }
    for (const t of rawScriptTabs) {
      if (byKey.has(t.key)) ordered.push(t)
    }
    return ordered.length > 0 ? ordered : rawScriptTabs
  })()

  const activeScriptIdx = scriptIdx < scriptTabs.length ? scriptIdx : 0
  const activeScript = scriptTabs[activeScriptIdx]?.script || null

  // Reorder helper: move the dragged tab key to the position of the target key.
  const reorderScriptTabs = (dragKey: string, targetKey: string) => {
    if (dragKey === targetKey) return
    const base = scriptTabs.map(t => t.key)
    const from = base.indexOf(dragKey)
    const to = base.indexOf(targetKey)
    if (from === -1 || to === -1) return
    const next = [...base]
    next.splice(from, 1)
    next.splice(to, 0, dragKey)
    setScriptOrder(next)
    // Keep the active tab pointing at the same script after a reorder.
    const activeKey = scriptTabs[activeScriptIdx]?.key
    if (activeKey) {
      const newIdx = next.indexOf(activeKey)
      if (newIdx !== -1) setScriptIdx(newIdx)
    }
  }

  const terminalBg = 'var(--brand-page-bg)'
  const terminalSurface = 'var(--brand-card-surface)'
  const terminalBorder = 'var(--brand-card-border)'
  const terminalDark = 'var(--brand-sidebar-bg)'
  const terminalText = 'var(--brand-on-page-bg)'
  const terminalMuted = 'var(--brand-muted-text)'
  const terminalAccent = '#2a4a8a'
  const terminalGreen = '#1a6a1a'
  const terminalRed = '#8a1a1a'
  const terminalAmber = '#8a6a1a'

  const modeColor = isPredictive ? terminalRed
    : isProgressive ? terminalGreen
    : isPreview ? terminalMuted
    : terminalAccent

  const connectedRate = sessionStats.calls > 0
    ? ((sessionStats.connected / sessionStats.calls) * 100).toFixed(0) + '%'
    : '—'

  if (tierLoaded && !isActive) {
    return (
      <div style={{
        flex: 1, background: terminalBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, minHeight: 'calc(100vh - 64px)',
        fontFamily: FUTURA,
      }}>
        <div style={{
          width: '100%', maxWidth: 520,
          background: terminalDark, border: `1px solid ${terminalBorder}`,
          borderTop: `3px solid #ffaa3e`, borderRadius: 4, padding: 36,
          color: 'var(--brand-on-sidebar)', textAlign: 'center', boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.85 }}>📞</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 5, color: '#ffaa3e', marginBottom: 12 }}>
            SUBSCRIBE TO DIAL
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--brand-on-sidebar-muted)', letterSpacing: 1, marginBottom: 28 }}>
            {tier === 'lapsed'
              ? 'Your subscription has lapsed. Resubscribe to restore dialing access. Your leads, recordings, and campaigns are still here waiting for you.'
              : 'An active subscription is required to make outbound calls.'}
          </div>
          <Link href="/billing" style={{
            display: 'block', padding: '16px 28px',
            background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 75%, black))',
            border: 'none', borderRadius: 4, color: 'var(--brand-on-primary)',
            fontSize: 13, fontWeight: 700, letterSpacing: 4,
            textDecoration: 'none', boxShadow: '0 0 20px color-mix(in srgb, var(--brand-primary) 30%, transparent)',
            marginBottom: 16, fontFamily: FUTURA,
          }}>RESUBSCRIBE — $35/WEEK</Link>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--brand-on-sidebar-muted)', marginBottom: 24 }}>
            NO CONTRACTS · CANCEL ANYTIME
          </div>
          <div style={{
            paddingTop: 20, borderTop: '1px solid var(--brand-sidebar-active-bg)',
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
        fontFamily: FUTURA,
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
          color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold',
        }}>MANUAL DIAL</span>
        <button
          onClick={() => setDialZoomed(!inOverlay)}
          aria-label={inOverlay ? 'Close fullscreen dialer' : 'Open fullscreen dialer'}
          style={{
            background: 'transparent', border: '1px solid var(--brand-sidebar-active-bg)', borderRadius: 4,
            color: 'var(--brand-on-sidebar-muted)', width: 28, height: 28,
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
            borderBottom: `3px solid ${manualNumber ? 'var(--brand-primary)' : terminalBorder}`,
            color: manualNumber ? 'var(--brand-primary)' : terminalMuted,
            fontSize: inOverlay ? '14px' : '11px', fontWeight: 'bold', letterSpacing: '2px',
            cursor: manualNumber ? 'pointer' : 'not-allowed',
            fontFamily: FUTURA,
          }}>DIAL</button>
        </div>
      </div>
    </>
  )

  const PredictiveAvailableCard = () => {
    const linesActive = lastControllerSummary?.inFlight ?? 0
    const linesTarget = linesPref?.effective_lines || pacingInfo?.configuredLines || 3
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
        background: terminalSurface,
        border: `1px solid ${terminalBorder}`,
        borderLeft: `3px solid ${terminalAccent}`,
        borderRadius: 4,
        minHeight: 280,
      }}>
        <style>{`
          @keyframes predictiveAvailablePulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 12px ${terminalAccent}; }
            50% { opacity: 0.4; box-shadow: 0 0 4px ${terminalAccent}; }
          }
          .predictive-pulse-dot {
            animation: predictiveAvailablePulse 1.4s ease-in-out infinite;
          }
        `}</style>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: terminalAccent, marginBottom: 18,
        }} className="predictive-pulse-dot" />
        <div style={{
          fontSize: 20, fontWeight: 'bold', letterSpacing: 6,
          color: terminalAccent, marginBottom: 10, textAlign: 'center',
        }}>
          AVAILABLE
        </div>
        <div style={{
          fontSize: 11, letterSpacing: 2, color: terminalMuted,
          textAlign: 'center', lineHeight: 1.7, maxWidth: 360, marginBottom: 22,
        }}>
          System is dialing in the background.
        </div>
        <div style={{
          display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: terminalMuted }}>LINES IN FLIGHT</div>
            <div style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', color: terminalText }}>
              {linesActive} / {linesTarget}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: terminalMuted }}>CONNECTED TODAY</div>
            <div style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', color: terminalAccent }}>
              {sessionStats.connected}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: terminalMuted }}>30D ABANDON</div>
            <div style={{
              fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold',
              color: pacingInfo && pacingInfo.abandonRate >= 0.025 ? terminalRed
                : pacingInfo && pacingInfo.abandonRate >= 0.020 ? terminalAmber : terminalGreen,
            }}>
              {pacingInfo ? `${(pacingInfo.abandonRate * 100).toFixed(2)}%` : '—'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dialer-root" style={{
      flex: 1, background: terminalBg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', minHeight: 0, position: 'relative',
      fontFamily: FUTURA, color: terminalText,
    }}>
      <style>{`
        .dialer-root { height: 100vh; height: 100dvh; }
        .dialer-status-bar { display: flex; align-items: center; justify-content: space-between; }
        .dialer-status-bar-left { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .dialer-status-bar-right { display: flex; align-items: center; gap: 18px; }
        .dialer-stat-grid { grid-template-columns: repeat(4, 1fr) !important; }
        .dialer-right-sidebar {
          width: 280px; border-left: 1px solid ${terminalBorder};
          display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
        }
        .dialer-right-toggle { display: none; }
        .dialer-right-overlay { display: none; }
        .dialer-connected-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 3px 10px; background: var(--brand-primary-soft);
          border: 1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent); border-radius: 3px;
          font-family: monospace; font-size: 10px; letter-spacing: 1px;
          color: var(--brand-primary); font-weight: bold;
        }
        .mode-tile-wrap { position: relative; cursor: pointer; }
        .mode-tile-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: ${terminalDark}; border: 1px solid var(--brand-sidebar-active-bg);
          border-radius: 4px; padding: 4px; z-index: 200;
          min-width: 160px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .mode-dropdown-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; cursor: pointer;
          font-size: 10px; font-weight: bold; letter-spacing: 2px;
          font-family: monospace; border-radius: 3px;
          transition: background 0.1s;
        }
        .mode-dropdown-item:hover { background: color-mix(in srgb, var(--brand-on-sidebar) 5%, transparent); }
        .mode-dropdown-item.current { background: var(--brand-primary-soft); }
        .lines-selector {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 10px; background: ${terminalBg};
          border: 1px solid ${terminalBorder}; border-radius: 3px;
        }
        .lines-selector select {
          background: transparent; border: none; outline: none;
          font-family: monospace; font-size: 12px; font-weight: bold;
          color: ${terminalText}; cursor: pointer; padding: 2px 4px;
        }

        @media (max-width: 768px) {
          .dialer-root { height: calc(100vh - 64px); height: calc(100dvh - 64px); }
          .dialer-status-bar { padding: 6px 12px !important; }
          /* Mobile script box: give it a real, bounded height so it never
             collapses, and let the body scroll inside it. The tab row wraps. */
          .dialer-script-box {
            min-height: 220px !important;
            max-height: 45vh;
          }
          .dialer-script-body {
            -webkit-overflow-scrolling: touch;
            font-size: 13px !important;
            line-height: 1.75 !important;
          }
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

          /* C9b: only the METRICS HEADER BAR gets the safe-area inset. The dark
             header (terminalDark) extends UP under the dynamic island, and its
             label text sits flush just below the island. This keeps the rest of
             the sidebar (conversion card, manual dialer, SYSTEM LOG) at their
             normal positions — they no longer get pushed down. */
          .dialer-metrics-header {
            padding-top: max(8px, env(safe-area-inset-top, 0px)) !important;
          }

          .dialer-right-toggle {
            display: flex;
            position: fixed;
            right: 0;
            top: 73%;
            transform: translateY(-50%);
            z-index: 50;
            width: 22px;
            height: 64px;
            border-radius: 8px 0 0 8px;
            background: ${terminalDark};
            border: 1px solid var(--brand-sidebar-active-bg);
            border-right: none;
            color: var(--brand-primary);
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            box-shadow: -2px 4px 12px rgba(0,0,0,0.25);
            padding: 0;
          }
          .dialer-right-toggle:active {
            background: color-mix(in srgb, var(--brand-on-sidebar) 6%, var(--brand-sidebar-bg));
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
        background: 'var(--brand-header-bg)', padding: '8px 20px',
        borderBottom: '2px solid var(--brand-header-top-accent)', flexShrink: 0,
      }}>
        <div className="dialer-status-bar-left">
          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--brand-primary)' }}>
            DIALERSEAT TERMINAL
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div onClick={handleSetAvailable} style={{
              width: '36px', height: '20px', borderRadius: '10px',
              background: available ? 'var(--brand-primary)' : 'color-mix(in srgb, var(--brand-on-header) 30%, var(--brand-header-bg))',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                position: 'absolute', top: '3px', left: available ? '19px' : '3px', transition: 'left 0.2s',
              }} />
            </div>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: available ? '#32ff7e' : '#ff6464',
              boxShadow: available ? '0 0 6px #32ff7e' : '0 0 6px #ff6464',
            }} />
            <span style={{ fontSize: '10px', letterSpacing: '2px', color: available ? '#32ff7e' : '#ff6464' }}>
              {available ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: swReady ? 'var(--brand-primary)' : 'var(--brand-on-header-muted)' }} />
            <span style={{ fontSize: '9px', letterSpacing: '2px', color: swReady ? 'var(--brand-primary)' : 'var(--brand-on-header-muted)' }}>
              {swReady ? 'AUDIO' : '...'}
            </span>
          </div>
        </div>
        <div className="dialer-status-bar-right">
          <div className="dialer-connected-pill" title="Connected calls today">
            <span style={{ fontSize: 8, letterSpacing: 2, opacity: 0.75 }}>CONNECTED TODAY</span>
            <span>{sessionStats.connected}</span>
          </div>
          <div className="dialer-time-block" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--brand-on-header-muted)', letterSpacing: '2px' }}>{dateStr}</span>
            <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--brand-primary)', letterSpacing: '3px' }}>{timeStr}</span>
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

      {isPredictive && shouldYield && !pacingInfo?.isDegraded && (
        <div style={{
          padding: '8px 20px',
          background: '#fdf4e8',
          borderBottom: `2px solid ${terminalAmber}`,
          color: terminalAmber,
          fontSize: 11,
          letterSpacing: 1,
          textAlign: 'center',
          fontWeight: 'bold',
        }}>
          ⚠ YIELDING — abandon rate approaching FTC 3% cap. Dialing paused briefly.
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto', minHeight: 0 }}>

          <div className="dialer-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', flexShrink: 0 }}>
            <div style={{
              padding: '8px 12px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px',
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px' }}>STATUS</div>
              <div style={{
                fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace',
                color: status === 'connected' ? terminalGreen : status === 'calling' ? '#8a6a1a' : status === 'preview_ready' ? terminalAccent : terminalMuted,
                letterSpacing: '1px',
              }}>{status === 'preview_ready' ? 'PREVIEW' : status.toUpperCase()}</div>
            </div>
            <div style={{
              padding: '8px 12px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px',
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px' }}>DURATION</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalAccent, letterSpacing: '1px' }}>
                {status === 'connected' ? formatTime(seconds) : '--:--'}
              </div>
            </div>
            <div style={{
              padding: '8px 12px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px',
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px' }}>CONNECTED RATE</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalAccent, letterSpacing: '1px' }}>
                {connectedRate}
              </div>
            </div>
            <div
              className="mode-tile-wrap"
              onClick={() => {
                if (!modeTileInteractive || modeSaving) return
                setModeDropdownOpen(o => !o)
              }}
              style={{
                padding: '8px 12px', background: terminalSurface,
                border: `1px solid ${modeTileInteractive ? modeColor : terminalBorder}`,
                borderRadius: '4px',
                cursor: modeTileInteractive ? 'pointer' : 'default',
                opacity: modeSaving ? 0.5 : 1,
                userSelect: 'none',
              }}
              title={
                isAllActive
                  ? 'Click to change mode for ALL ACTIVE session (does not modify individual campaign settings)'
                  : isSpecificCampaign
                    ? 'Click to change mode for this campaign'
                    : 'Select a campaign to change mode'
              }
            >
              <div style={{
                fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>MODE{isAllActive ? ' (SESSION)' : ''}</span>
                {modeTileInteractive && (
                  <span style={{ fontSize: 8, opacity: 0.7 }}>{modeDropdownOpen ? '▲' : '▼'}</span>
                )}
              </div>
              <div style={{
                fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace',
                color: modeColor, letterSpacing: '1px',
              }}>
                {dialerMode.toUpperCase()}
              </div>
              {modeDropdownOpen && modeTileInteractive && (
                <div className="mode-tile-dropdown" onClick={e => e.stopPropagation()}>
                  {MODE_OPTIONS.map(opt => (
                    <div
                      key={opt.value}
                      className={`mode-dropdown-item ${opt.value === dialerMode ? 'current' : ''}`}
                      onClick={() => handleModeChange(opt.value)}
                      style={{ color: opt.color }}
                    >
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: opt.color, flexShrink: 0,
                      }} />
                      {opt.label}
                      {opt.value === dialerMode && (
                        <span style={{ marginLeft: 'auto', color: 'var(--brand-primary)' }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isPredictive && pacingInfo && (
            <div style={{
              padding: '10px 14px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderLeft: `3px solid ${pacingInfo.isDegraded ? terminalRed : terminalAccent}`,
              borderRadius: '4px', flexShrink: 0,
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>ACTIVE AGENTS</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', color: terminalText }}>
                  {pacingInfo.activeAgents}{pacingInfo.isPredictiveTeam && (
                    <span style={{ fontSize: 9, color: terminalGreen, marginLeft: 6, letterSpacing: 1 }}>TEAM</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>MY LINES</div>
                {linesPref ? (
                  <div className="lines-selector" style={{ padding: '2px 8px', opacity: linesPrefSaving ? 0.5 : 1 }}>
                    <select
                      value={linesPref.preferred_lines ?? linesPref.campaign_default}
                      disabled={linesPrefSaving}
                      onChange={e => handleLinesChange(parseInt(e.target.value))}
                    >
                      {LINES_OPTIONS
                        .filter(n => n <= linesPref.campaign_max && n >= linesPref.campaign_min)
                        .map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                    <span style={{ fontSize: 9, color: terminalMuted, letterSpacing: 1 }}>
                      {linesPref.preferred_lines === null ? '(default)' : ''}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontFamily: 'monospace', color: terminalMuted }}>—</div>
                )}
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
                <option value={PERSONAL_SCOPE}>MY LEADS (PERSONAL)</option>
                {teamScopes.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.viewerRole === 'owner' ? 'TEAM (OWNER): ' : 'TEAM: '}{s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ padding: '10px 14px', background: terminalSurface, border: `1px solid ${terminalBorder}`, borderRadius: '4px', flexShrink: 0 }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ SELECT CAMPAIGN</div>
            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} style={{
              width: '100%', padding: '6px 10px', borderRadius: '4px',
              background: terminalBg, border: `1px solid ${selectedCampaign ? terminalBorder : '#ffaa3e'}`,
              color: selectedCampaign ? terminalText : terminalMuted,
              fontSize: '12px', outline: 'none',
              fontFamily: FUTURA, cursor: 'pointer',
            }}>
              <option value="">— SELECT A CAMPAIGN —</option>
              {activeCampaignsCount > 0 && (
                <option value={ALL_ACTIVE}>ALL ACTIVE CAMPAIGNS ({activeCampaignsCount})</option>
              )}
              {activeScopeCampaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.total_leads} leads
                </option>
              ))}
            </select>
            {activeScopeCampaigns.length === 0 && (
              <div style={{
                marginTop: '6px', padding: '5px 8px', background: '#f8e8e8',
                border: '1px solid #d0a0a0', borderRadius: '4px',
                fontSize: '10px', letterSpacing: '2px', color: terminalRed,
              }}>
                ⚠ {scopeCampaigns.length === 0
                    ? (isPersonalScope ? 'NO CAMPAIGNS FOUND' : 'NO CAMPAIGNS ACCESSIBLE FROM THIS TEAM')
                    : 'NO ACTIVE CAMPAIGNS — ACTIVATE A CAMPAIGN TO START DIALING'}
              </div>
            )}
            {showSelectCampaignMsg && (
              <div style={{
                marginTop: 6, padding: '6px 10px',
                background: '#fdf4e8',
                border: `1px solid ${terminalAmber}`,
                borderLeft: `3px solid ${terminalAmber}`,
                borderRadius: 4,
                fontSize: 11, color: terminalAmber, letterSpacing: 0.5, fontWeight: 'bold',
              }}>
                ⚠ YOU MUST SELECT A CAMPAIGN BEFORE DIALING
              </div>
            )}
          </div>

          {/* CENTER PANEL */}
          {isPredictive && predictiveView === 'available' && isSpecificCampaign && predictiveEngineStarted ? (
            <PredictiveAvailableCard />
          ) : isPredictive && (predictiveView === 'offline' || (predictiveView === 'available' && !predictiveEngineStarted)) ? (
            <div style={{
              flex: 1, background: terminalSurface, border: `1px solid ${terminalBorder}`,
              borderRadius: '4px', overflow: 'hidden', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 280, padding: 20,
            }}>
              <p style={{ fontSize: 11, letterSpacing: 3, color: terminalMuted, textAlign: 'center' }}>
                {!isSpecificCampaign
                  ? 'SELECT A CAMPAIGN TO BEGIN'
                  : !available
                    ? 'SET AVAILABLE TO BEGIN'
                    : 'CLICK INITIATE DIAL SEQUENCE TO START'}
              </p>
            </div>
          ) : (
            <div style={{
              flex: 1, background: terminalSurface, border: `1px solid ${terminalBorder}`,
              borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 200,
            }}>
              <div style={{
                padding: '7px 14px', background: terminalDark, borderBottom: `1px solid ${terminalBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
              }}>
                <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold' }}>
                  {previewLead ? 'LEAD PREVIEW — REVIEW BEFORE DIALING' : 'LEAD PROFILE'}
                </span>
                {displayLead && (status === 'connected' || status === 'preview_ready') && (
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--brand-primary)' }}>ID: {displayLead.id.substring(0, 8)}</span>
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                {(!displayLead || status === 'calling') ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
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
                          ? 'ALL LEADS OUTSIDE 8AM-9PM WINDOW — TRY LATER'
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
                            {/* Location · live timer — matches /welcome page 1 layout */}
                            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: terminalMuted, letterSpacing: '1px', marginTop: '4px' }}>
                              {[displayLead.city, displayLead.state].filter(Boolean).join(', ')}
                              {status === 'connected' && (
                                <>
                                  {(displayLead.city || displayLead.state) ? ' · ' : ''}
                                  {formatTime(seconds)}
                                </>
                              )}
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
                      <div className="dialer-script-box" style={{
                        flex: 1, margin: '0 12px 12px',
                        background: terminalBg, border: `1px solid ${terminalBorder}`,
                        borderLeft: `3px solid ${terminalAccent}`, borderRadius: '3px',
                        display: 'flex', flexDirection: 'column', minHeight: 80, overflow: 'hidden',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 0', borderBottom: `1px solid ${terminalBorder}`, flexWrap: 'wrap', flexShrink: 0 }}>
                          {scriptTabs.map((sc, i) => (
                            <button
                              key={sc.key}
                              onClick={() => setScriptIdx(i)}
                              draggable
                              onDragStart={() => setScriptDragKey(sc.key)}
                              onDragOver={(e) => { e.preventDefault() }}
                              onDrop={(e) => {
                                e.preventDefault()
                                if (scriptDragKey) reorderScriptTabs(scriptDragKey, sc.key)
                                setScriptDragKey(null)
                              }}
                              onDragEnd={() => setScriptDragKey(null)}
                              title="Drag to reorder"
                              style={{
                                padding: '5px 10px',
                                cursor: scriptDragKey ? 'grabbing' : 'grab',
                                border: 'none', borderRadius: '5px 5px 0 0',
                                background: i === activeScriptIdx ? terminalAccent : 'transparent',
                                color: i === activeScriptIdx ? '#fff' : terminalMuted,
                                fontFamily: FUTURA, fontSize: '9px', letterSpacing: '1px', fontWeight: 800,
                                opacity: scriptDragKey === sc.key ? 0.4 : 1,
                                transition: 'all 0.15s ease',
                              }}
                            >{sc.name.toUpperCase()}</button>
                          ))}
                        </div>
                        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <div style={{ fontSize: '8px', letterSpacing: '2px', color: terminalMuted, marginBottom: '6px', flexShrink: 0 }}>CALL SCRIPT</div>
                          <div className="dialer-script-body" style={{
                            fontSize: '11px', lineHeight: '1.7', color: terminalText,
                            fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowY: 'auto', flex: 1,
                          }}>{activeScript}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {showDisposition && (
            <div style={{
              padding: '10px 14px', background: terminalSurface,
              border: `2px solid ${terminalAccent}`, borderRadius: '4px', flexShrink: 0,
            }}>
              {lastCallDuration !== null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '10px', paddingBottom: '8px',
                  borderBottom: `1px solid ${terminalBorder}`,
                  fontSize: '10px', letterSpacing: '2px', color: terminalMuted,
                }}>
                  <span>⏱</span>
                  <span>CALL LASTED</span>
                  <span style={{ color: terminalAccent, fontWeight: 'bold', letterSpacing: '1px' }}>
                    {formatDurationLong(lastCallDuration)}
                  </span>
                </div>
              )}
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
              {isPredictive && (
                <div style={{
                  marginBottom: 10, padding: '6px 10px',
                  background: 'rgba(42,74,138,0.08)',
                  borderLeft: `3px solid ${terminalAccent}`,
                  fontSize: 10, color: terminalAccent, letterSpacing: 0.5,
                }}>
                  ⓘ System is still dialing in background. Next human routes automatically.
                </div>
              )}
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '8px' }}>▸ SELECT DISPOSITION</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px' }}>
                {dispositions.map((d) => (
                  <button key={d.label} onClick={() => handleDisposition(d.label)} style={{
                    padding: '10px 4px', borderRadius: '3px',
                    background: disposition === d.label ? d.color : d.bg,
                    border: `1px solid ${d.color}`,
                    color: disposition === d.label ? 'white' : d.color,
                    fontSize: '8px', fontWeight: 'bold', letterSpacing: '1px',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>{d.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* BUTTONS — predictive 4-state + non-predictive 3-state flows */}

          {isPredictive ? (
            <>
              {predictiveView === 'offline' && isSpecificCampaign && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <button onClick={handleSetAvailable} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: terminalSurface, color: terminalMuted,
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid ${terminalBorder}`, transition: 'all 0.15s',
                  }}>[ SET AVAILABLE TO DIAL ]</button>
                </div>
              )}

              {predictiveView === 'offline' && !isSpecificCampaign && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <div style={{
                    padding: '14px', borderRadius: '4px', background: terminalSurface, color: terminalMuted,
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    textAlign: 'center', borderTop: `3px solid ${terminalBorder}`,
                  }}>[ SELECT A CAMPAIGN TO BEGIN ]</div>
                </div>
              )}

              {predictiveView === 'available' && !predictiveEngineStarted && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <button onClick={handleDial} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: terminalDark, color: 'var(--brand-primary)',
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid var(--brand-primary)`, transition: 'all 0.15s',
                  }}>INITIATE DIAL SEQUENCE</button>
                </div>
              )}

              {predictiveView === 'available' && predictiveEngineStarted && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => {
                    setPredictiveEngineStarted(false)
                    predictiveEngineStartedRef.current = false
                    disarmDialing({ force: true }) // engine stopped — no more incoming routes accepted
                    lastIncomingCallSidRef.current = null
                    setAmdActivity(prev => [
                      `PREDICTIVE ENGINE STOPPED`,
                      ...prev,
                    ].slice(0, 5))
                  }} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: '#f8e8e8', color: terminalRed,
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid ${terminalRed}`,
                  }}>■ STOP DIAL SEQUENCE</button>
                </div>
              )}

              {status === 'connected' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>
                  <button onClick={handleSkip} style={{
                    padding: '14px', borderRadius: '4px',
                    background: '#f8f4e8', border: `1px solid #8a6a1a`,
                    borderTop: `3px solid #8a6a1a`, color: '#8a6a1a',
                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>SKIP / NEXT LEAD</button>
                  <button onClick={async () => {
                    setPredictiveEngineStarted(false)
                    predictiveEngineStartedRef.current = false
                    await hangupCall(activeCallSid)
                    disarmDialing({ force: true })
                    setStatus('idle')
                    setCurrentLead(null)
                    setShowDisposition(false)
                    setDisposition('')
                    setSeconds(0)
                    lastIncomingCallSidRef.current = null
                  }} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: '#f8e8e8', borderTop: `3px solid ${terminalRed}`,
                    color: terminalRed, fontSize: '11px', fontWeight: 'bold',
                    letterSpacing: '3px', cursor: 'pointer',
                    fontFamily: FUTURA,
                  }}>■ TERMINATE CALL</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: status === 'connected' ? '1fr 1fr' : status === 'preview_ready' ? '1fr 1fr' : '1fr', gap: '8px', flexShrink: 0 }}>
              {status === 'idle' && !available && (
                <button onClick={handleSetAvailable} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalSurface, color: terminalMuted,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: FUTURA,
                  borderTop: `3px solid ${terminalBorder}`, transition: 'all 0.15s',
                }}>[ SET AVAILABLE TO DIAL ]</button>
              )}
              {status === 'idle' && available && activeScopeCampaigns.length === 0 && (
                <div style={{
                  padding: '14px', borderRadius: '4px', background: terminalSurface, color: terminalMuted,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  textAlign: 'center', borderTop: `3px solid ${terminalBorder}`,
                }}>[ NO ACTIVE CAMPAIGNS IN SCOPE ]</div>
              )}
              {status === 'idle' && available && activeScopeCampaigns.length > 0 && (
                <button onClick={handleDial} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalDark, color: 'var(--brand-primary)',
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: FUTURA,
                  borderTop: `3px solid var(--brand-primary)`, transition: 'all 0.15s',
                }}>
                  {isPreview ? 'LOAD NEXT LEAD' : 'INITIATE DIAL SEQUENCE'}
                </button>
              )}
              {status === 'preview_ready' && previewLead && (
                <>
                  <button onClick={skipPreviewLead} style={{
                    padding: '14px', borderRadius: '4px',
                    background: '#f8f4e8', border: `1px solid #8a6a1a`,
                    borderTop: `3px solid #8a6a1a`, color: '#8a6a1a',
                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>SKIP THIS LEAD</button>
                  <button onClick={dialPreviewLead} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: terminalDark, color: 'var(--brand-primary)',
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid var(--brand-primary)`,
                  }}>DIAL THIS LEAD</button>
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
                  cursor: 'pointer', fontFamily: FUTURA,
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
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>SKIP / NEXT LEAD</button>
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
                    fontFamily: FUTURA,
                  }}>■ TERMINATE CALL</button>
                </>
              )}
              {status === 'ended' && !showDisposition && (
                <button onClick={handleDial} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalDark, color: 'var(--brand-primary)',
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: FUTURA,
                  borderTop: `3px solid var(--brand-primary)`,
                }}>NEXT LEAD</button>
              )}
            </div>
          )}
        </div>

        <div
          className={`dialer-right-overlay ${rightSidebarOpen ? 'open' : ''}`}
          onClick={() => setRightSidebarOpen(false)}
        />

        <aside className={`dialer-right-sidebar ${rightSidebarOpen ? 'open' : ''}`}>
          <div className="dialer-metrics-header" style={{ background: terminalDark, padding: '8px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', letterSpacing: '3px', color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold' }}>TODAY&apos;S METRICS</span>
          </div>

          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
            {[
              { label: 'CONNECTED', value: sessionStats.connected, color: 'var(--brand-primary)' },
              { label: 'CLOSED', value: sessionStats.closed, color: '#16a34a' },
              { label: 'APPOINTMENTS', value: sessionStats.appointments, color: '#2563eb' },
              { label: 'NOT INTERESTED', value: sessionStats.notInterested, color: '#d97706' },
              { label: 'DO NOT CALL', value: sessionStats.dnc, color: '#dc2626' },
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
                TODAY&apos;S CONVERSION RATE
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
            <span style={{ fontSize: '9px', letterSpacing: '3px', color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold' }}>SYSTEM LOG</span>
          </div>
          <div style={{ padding: '5px 12px', background: '#1a1c24', height: '88px', overflowY: 'auto', flexShrink: 0 }}>
            {[
              ...amdActivity.map(a => `> ${a}`),
              status === 'connected' && `> CONNECTED — ${currentLead?.first_name} ${currentLead?.last_name}`,
              status === 'calling' && '> DIALING IN QUEUE...',
              status === 'preview_ready' && `> PREVIEW LOADED — ${previewLead?.first_name} ${previewLead?.last_name}`,
              isSpecificCampaign && currentCampaign && `> CAMPAIGN MODE: ${dialerMode.toUpperCase()} + AMD`,
              isAllActive && `> ALL ACTIVE · SESSION MODE: ${dialerMode.toUpperCase()}`,
              isPredictive && pacingInfo && `> AGENTS: ${pacingInfo.activeAgents} (READY:${pacingInfo.readyAgents}/DIALING:${pacingInfo.dialingAgents}/ONCALL:${pacingInfo.onCallAgents})`,
              isPredictive && pacingInfo && `> ABANDON: ${(pacingInfo.abandonRate * 100).toFixed(2)}%`,
              isPredictive && lastControllerSummary && `> CTRL: fired=${lastControllerSummary.fired} desired=${lastControllerSummary.desired} inflight=${lastControllerSummary.inFlight}`,
              isPredictive && lastControllerSummary && lastControllerSummary.reason && `> CTRL: ${lastControllerSummary.reason}`,
              isPredictive && shouldYield && `> SERVER ASKED TO YIELD — abandon rate near cap`,
              isPredictive && pacingInfo?.isPredictiveTeam && `> TEAM PREDICTIVE — reroute on disconnect enabled`,
              currentSessionId && '> SESSION ACTIVE',
              !isPersonalScope && currentScope && `> SCOPE: ${currentScope.name.toUpperCase()}`,
              swReady && '> AUDIO READY',
              available && `> AGENT STATE: ${agentState.toUpperCase()}`,
            ].filter(Boolean).slice(0, 14).map((log, i) => (
              <div key={i} style={{
                fontSize: '9px', fontFamily: 'monospace',
                color: i === 0 ? 'var(--brand-primary)' : '#4a5a4a',
                letterSpacing: '1px', marginBottom: '2px',
              }}>{log as string}</div>
            ))}
          </div>
        </aside>
      </div>

      {/* v23: right-edge arrow tab */}
      <button
        className="dialer-right-toggle"
        onClick={() => setRightSidebarOpen(true)}
        aria-label="Open metrics & dial pad"
      >‹</button>

      {dialZoomed && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: terminalDark, display: 'flex', flexDirection: 'column',
            height: '100vh', ['height' as any]: '100dvh',
            paddingTop: 'env(safe-area-inset-top)',
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
  color: 'var(--brand-primary)', fontSize: 10, fontWeight: 700, letterSpacing: 2,
  textDecoration: 'none', fontFamily: 'Futura PT, Futura, sans-serif',
}

export default function DialerPage() {
  return (
    <Suspense fallback={
      <div style={{
        flex: 1,
        background: 'var(--brand-page-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: 'var(--brand-muted-text)' }}>
          LOADING TERMINAL...
        </div>
      </div>
    }>
      <DialerPageInner />
    </Suspense>
  )
}