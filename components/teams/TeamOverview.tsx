'use client'
import { useEffect, useState } from 'react'

// =============================================================================
// TEAM OVERVIEW — the command-center strip at the top of an owned team
// =============================================================================
// Two jobs, in this order:
//
//   1. Answer "what is this team doing and what is it costing me" without the
//      owner expanding anything. Previously all of that lived inside collapsed
//      accordions, so the default view of a team was its name and nothing else.
//
//   2. Get a seat link into someone's hands in ONE click, and a pending person
//      onto the roster in ONE click. Selling a seat is the product; it should
//      not route through a form and a confirmation dialog to happen.
//
// Deliberately NO confirmation step before accepting a member, even though
// accepting an owner-pays member starts a charge. That was a considered call:
// the owner generated the link, set the payer on it, and sent it themselves —
// they already decided. A dialog restating a price they chose is friction on
// the one action the business depends on.
//
// EVERY NUMBER IS REAL OR ABSENT. /api/teams/[id]/overview returns null for
// figures with no data behind them and this renders a dash. It does not read
// team_analytics, whose rows are seeded (see that route's header).
// =============================================================================

const FUTURA = "'Futura PT', Futura, sans-serif"
const T = {
  bg: 'var(--brand-page-bg, #f0f1f4)',
  surface: 'var(--brand-card-surface, #e2e4ea)',
  border: 'var(--brand-card-border, #c4c8d0)',
  text: 'var(--brand-on-page-bg, #1a1c24)',
  muted: 'var(--brand-muted-text, #5a5e6a)',
  primary: 'var(--brand-primary, #2a4a8a)',
  green: '#1a6a1a',
  amber: '#8a6a1a',
}

interface Overview {
  live: { online: number; dialing: number; onCall: number; ready: number; callsLastHour: number }
  spend: { weeklyCents: number; seatCount: number; lifetimePaidCents: number }
  seats: { active: number; pending: number }
  calls: { total: number; answered: number; connectRatePct: number | null; talkMinutes: number }
  lookbackDays: number
}

interface PendingLite {
  id: string
  label: string
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function TeamOverview({
  teamId,
  pending,
  onAccept,
  onChanged,
  acceptingId,
}: {
  teamId: string
  pending: PendingLite[]
  onAccept: (memberId: string) => void
  onChanged: () => void
  acceptingId: string | null
}) {
  const [data, setData] = useState<Overview | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [generating, setGenerating] = useState<'owner' | 'agent' | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  // Bumped to force an immediate refetch after an action that changes the
  // numbers, instead of waiting out the poll interval.
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/overview`)
        const json = await res.json()
        if (cancelled) return
        if (json.success) {
          setData(json.overview)
          setFailed(false)
        } else {
          setFailed(true)
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    load()
    // Live agent state goes stale fast; spend and seat counts don't, but
    // they're in the same payload and the query is cheap.
    const iv = setInterval(load, 20_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [teamId, refreshKey])

  // One click: mint a seat link and put it on the clipboard. No modal, no form.
  // The two buttons ARE the only decision — who pays — because that's the only
  // field that changes what happens when someone redeems it.
  const quickLink = async (payer: 'owner' | 'agent') => {
    setGenerating(payer)
    setGenError(null)
    try {
      const res = await fetch('/api/teams/codes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, codeType: 'seat', payer, singleUse: false }),
      })
      const json = await res.json()
      if (!json.success || !json.code) {
        setGenError(json.error || 'Could not create a link')
        return
      }
      const url = `${window.location.origin}/join/${json.code.code}`
      try {
        await navigator.clipboard.writeText(url)
        setCopied(url)
      } catch {
        // Clipboard can be blocked by permissions policy. The link still
        // exists — show it so it can be copied by hand rather than silently
        // appearing to do nothing.
        setCopied(url)
      }
      setRefreshKey(k => k + 1)
      onChanged()
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGenerating(null)
    }
  }

  const live = data?.live
  const isLive = (live?.online ?? 0) > 0

  return (
    <div style={{ fontFamily: FUTURA, color: T.text, marginBottom: 18 }}>
      <style>{`
        @keyframes tov-blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
        .tov-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }
        .tov-btn {
          padding: 9px 14px; border-radius: 4px; font-size: 10.5px; letter-spacing: 1.2px;
          font-weight: bold; font-family: ${FUTURA}; cursor: pointer; white-space: nowrap;
          border: 1px solid ${T.primary}; background: transparent; color: ${T.primary};
        }
        .tov-btn:hover:not(:disabled) { background: ${T.primary}; color: #fff; }
        .tov-btn:disabled { opacity: .55; cursor: default; }
        .tov-btn.is-solid { background: ${T.primary}; color: #fff; }
        .tov-btn.is-solid:hover:not(:disabled) { filter: brightness(1.12); }
      `}</style>

      {/* ── METRICS ─────────────────────────────────────────────────────── */}
      <div className="tov-grid">
        <Tile
          label="LIVE NOW"
          value={live ? String(live.online) : '—'}
          suffix={live && live.online === 1 ? 'agent' : 'agents'}
          accent={isLive ? T.green : undefined}
          blink={isLive}
          detail={
            live && live.online > 0
              ? `${live.ready} ready · ${live.dialing} dialing · ${live.onCall} on a call`
              : 'nobody dialing right now'
          }
        />
        <Tile
          label="THIS WEEK"
          value={data ? money(data.spend.weeklyCents) : '—'}
          detail={
            data
              ? data.spend.seatCount > 0
                ? `${data.spend.seatCount} paid seat${data.spend.seatCount === 1 ? '' : 's'}`
                : 'no seats billing yet'
              : ''
          }
        />
        <Tile
          label="ROSTER"
          value={data ? String(data.seats.active) : '—'}
          suffix={data && data.seats.active === 1 ? 'agent' : 'agents'}
          detail={
            data && data.seats.pending > 0
              ? `${data.seats.pending} waiting to be let in`
              : 'nobody waiting'
          }
          accent={data && data.seats.pending > 0 ? T.amber : undefined}
        />
        <Tile
          label={`CONNECT RATE · ${data?.lookbackDays ?? 7}D`}
          // A dash, not 0%. No calls means unknown, and a confident 0% would
          // read as a broken dialer rather than an idle one.
          value={data?.calls.connectRatePct !== null && data?.calls.connectRatePct !== undefined
            ? `${data.calls.connectRatePct}%`
            : '—'}
          detail={
            data && data.calls.total > 0
              ? `${data.calls.answered.toLocaleString()} of ${data.calls.total.toLocaleString()} answered`
              : 'no calls in this window'
          }
        />
      </div>

      {/* ── SELL A SEAT ─────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 10, padding: '12px 14px', background: T.surface,
        border: `1px solid ${T.border}`, borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 'bold', color: T.muted }}>
          SEAT LINK
        </span>
        <button
          className="tov-btn is-solid"
          disabled={generating !== null}
          onClick={() => quickLink('owner')}
        >
          {generating === 'owner' ? 'CREATING…' : 'I PAY — COPY LINK'}
        </button>
        <button
          className="tov-btn"
          disabled={generating !== null}
          onClick={() => quickLink('agent')}
        >
          {generating === 'agent' ? 'CREATING…' : 'THEY PAY — COPY LINK'}
        </button>
        <span style={{ fontSize: 10.5, color: T.muted }}>
          Reusable. Send it to anyone — they land on a join page and they&apos;re in.
        </span>

        {copied && (
          <div style={{
            flexBasis: '100%', marginTop: 4, fontSize: 11, color: T.green,
            wordBreak: 'break-all',
          }}>
            ✓ Copied — {copied}
          </div>
        )}
        {genError && (
          <div style={{ flexBasis: '100%', marginTop: 4, fontSize: 11, color: '#8a1a1a' }}>
            {genError}
          </div>
        )}
      </div>

      {/* ── ONE-TAP ADMITS ──────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div style={{
          marginTop: 10, padding: '12px 14px',
          background: 'color-mix(in srgb, var(--brand-card-surface, #e2e4ea) 82%, #8a6a1a 18%)',
          border: `1px solid ${T.border}`, borderRadius: 6,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 'bold', color: T.muted, marginBottom: 8 }}>
            WAITING TO JOIN ({pending.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                fontSize: 12,
              }}>
                <span style={{ flex: '1 1 160px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.label}
                </span>
                <button
                  className="tov-btn is-solid"
                  disabled={acceptingId === p.id}
                  onClick={() => onAccept(p.id)}
                >
                  {acceptingId === p.id ? 'ADDING…' : 'ADD TO TEAM'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {failed && !data && (
        <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>
          Couldn&apos;t load this team&apos;s numbers. Everything below still works.
        </div>
      )}
    </div>
  )
}

function Tile({
  label, value, suffix, detail, accent, blink,
}: {
  label: string
  value: string
  suffix?: string
  detail?: string
  accent?: string
  blink?: boolean
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 6, padding: '11px 13px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 9, letterSpacing: 1.5, fontWeight: 'bold', color: T.muted,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {accent && blink ? (
          <span style={{ color: accent, animation: 'tov-blink 1.6s ease-in-out infinite' }}>● </span>
        ) : null}
        {label}
      </div>
      <div style={{
        marginTop: 5, fontSize: 23, fontWeight: 'bold', lineHeight: 1.1,
        color: accent || T.text,
      }}>
        {value}
        {suffix ? (
          <span style={{ fontSize: 11, fontWeight: 'normal', color: T.muted, marginLeft: 5 }}>
            {suffix}
          </span>
        ) : null}
      </div>
      {detail ? (
        <div style={{ marginTop: 4, fontSize: 10.5, color: T.muted }}>{detail}</div>
      ) : null}
    </div>
  )
}
