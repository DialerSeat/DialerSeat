'use client'

import { useEffect, useMemo, useState } from 'react'
import { t, useLocale } from '@/lib/i18n/client'
import { classifyAreaCode } from '@/lib/areaCode'
import { STATE_TIMEZONES } from '@/lib/timezones'
import { STATE_NAMES, SPLIT_ZONE_STATES, localTime, localHour } from '@/lib/tools/phone'
import { ToolStyles } from './kit'

// =============================================================================
// AREA CODE LOOKUP — state, time zone and local time for any area code
// =============================================================================
// The table is the dialer's own (lib/areaCode.ts), the one that decides which
// time zone a lead is called in, so the answer here is the answer DialerSeat
// uses. Unknown codes say so rather than guessing a state.
// =============================================================================

const ZONE_LABEL: Record<string, string> = {
  'America/New_York': 'Eastern', 'America/Detroit': 'Eastern', 'America/Indiana/Indianapolis': 'Eastern',
  'America/Chicago': 'Central', 'America/Denver': 'Mountain', 'America/Boise': 'Mountain', 'America/Phoenix': 'Mountain (Arizona, no DST)',
  'America/Los_Angeles': 'Pacific', 'America/Anchorage': 'Alaska', 'Pacific/Honolulu': 'Hawaii',
  'America/Puerto_Rico': 'Atlantic', 'America/St_Thomas': 'Atlantic', 'Pacific/Guam': 'Chamorro', 'Pacific/Saipan': 'Chamorro', 'Pacific/Pago_Pago': 'Samoa',
}

/** Every area code the dialer places in a US state or territory, by state. */
function usCodesByState(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (let n = 200; n <= 999; n++) {
    const code = String(n)
    const c = classifyAreaCode(code)
    if (c.kind === 'us') (out[c.state] ??= []).push(code)
  }
  return out
}

function describe(code: string) {
  const c = classifyAreaCode(code)
  if (c.kind === 'us') {
    const tz = STATE_TIMEZONES[c.state] ?? null
    return { kind: 'us' as const, state: c.state, name: STATE_NAMES[c.state] ?? c.state, tz }
  }
  const text: Record<string, string> = {
    canada: 'Canada. Same dialing plan as the US, but Canadian telemarketing rules apply (CRTC).',
    toll_free: 'Toll-free (800, 833, 844, 855, 866, 877, 888). Not tied to a place, and usually a business line.',
    non_geographic: 'A service or non-geographic code (N11, 900, 710, 5XX), not a place.',
    other_nanp: 'A Caribbean or other North American Numbering Plan country outside the US and Canada.',
    unknown: 'Not an area code we can place. It may be newly assigned, or not in use.',
  }
  return { kind: c.kind, text: text[c.kind] }
}

export default function AreaCodeLookup() {
  const { locale } = useLocale()
  const [q, setQ] = useState('512')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(id) }, [])

  const digits = q.replace(/\D/g, '')
  const code = digits.length >= 11 && digits.startsWith('1') ? digits.slice(1, 4) : digits.slice(0, 3)
  const info = code.length === 3 ? describe(code) : null
  const byState = useMemo(() => usCodesByState(), [])
  const states = Object.keys(byState).sort((a, b) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b))

  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-field">
        <label htmlFor="ac-q">{t("AREA CODE OR FULL PHONE NUMBER")}</label>
        <input id="ac-q" type="text" inputMode="tel" value={q} onChange={(e) => setQ(e.target.value)} placeholder="512 or (512) 555-0100" />
      </div>

      {info && info.kind === 'us' && (() => {
        const hour = info.tz ? localHour(info.tz, now) : null
        const open = hour != null && hour >= 8 && hour < 21
        return (
          <div className={`tk-result ${open ? 'ok' : 'over'}`} aria-live="polite">
            <div className="tk-big">{code} · {t(info.name)}</div>
            <p>
              {info.tz ? <>{t("Time zone")}: <b>{t(ZONE_LABEL[info.tz] ?? info.tz)}</b> ({info.tz}). {t("Local time there now")}: <b>{localTime(info.tz, now, locale)}</b>.</> : t("No time zone on file for this state.")}
            </p>
            <p>
              {open
                ? t("Inside the federal telemarketing window (8 a.m. to 9 p.m. local time).")
                : t("Outside the federal telemarketing window (8 a.m. to 9 p.m. local time). Some states are stricter: see the calling hours tool.")}
              {SPLIT_ZONE_STATES.has(info.state) && ' ' + t("{state} spans more than one time zone; this is the zone most of it uses.", { state: t(info.name) })}
            </p>
            <p>{t("Other area codes in {state}", { state: t(info.name) })}: {(byState[info.state] ?? []).filter((c) => c !== code).join(', ') || '—'}</p>
          </div>
        )
      })()}
      {info && info.kind !== 'us' && (
        <div className="tk-result" aria-live="polite">
          <div className="tk-big">{code}</div>
          <p>{t(info.text ?? '')}</p>
        </div>
      )}

      <div className="tk-label" style={{ marginTop: 18 }}>{t("Every US area code, by state")}</div>
      <div className="tk-tablewrap">
        <table className="tk-table">
          <thead><tr><th>{t("State")}</th><th>{t("Area codes")}</th><th>{t("Time zone")}</th><th>{t("Local time")}</th></tr></thead>
          <tbody>
            {states.map((s) => {
              const tz = STATE_TIMEZONES[s]
              return (
                <tr key={s}>
                  <td><b>{t(STATE_NAMES[s] ?? s)}</b></td>
                  <td>{byState[s].join(', ')}</td>
                  <td>{tz ? t(ZONE_LABEL[tz] ?? tz) : '—'}</td>
                  <td>{tz ? localTime(tz, now, locale) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="tk-foot">{t("An area code tells you where a number was issued, not where the person is today: mobile numbers keep their area code when people move. States that span two time zones are shown in the zone most of the state uses.")}</p>
    </div>
  )
}
