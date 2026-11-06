'use client'

import { useEffect, useState } from 'react'
import { t, useLocale } from '@/lib/i18n/client'
import { classifyAreaCode } from '@/lib/areaCode'
import { STATE_TIMEZONES } from '@/lib/timezones'
import { STATE_NAMES, SPLIT_ZONE_STATES, localTime, localHour } from '@/lib/tools/phone'
import { ToolStyles, SelectField } from './kit'

// =============================================================================
// TELEMARKETING CALLING HOURS — can you call this state right now?
// =============================================================================
// THE LAW, NOT DIALERSEAT'S POLICY. The federal window is 8 a.m. to 9 p.m. in
// the called person's local time (47 CFR 64.1200(c)(1), 16 CFR 310.4(c)).
// Florida ends at 8 p.m. (Fla. Stat. 501.616(6)(a)), the one state rule this
// repo has checked against its statute (lib/timezones.ts). Other states can be
// stricter; this tool says so instead of naming rules nobody here has
// verified. DialerSeat itself dials a narrower 9 a.m. to 9 p.m. (8 p.m. in
// Florida), stated separately below.
// =============================================================================

const RULES: Record<string, { start: number; end: number; source: string }> = {
  FL: { start: 8, end: 20, source: 'Fla. Stat. 501.616(6)(a)' },
}
const FEDERAL = { start: 8, end: 21, source: '47 CFR 64.1200(c)(1); 16 CFR 310.4(c)' }
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'a.m.' : 'p.m.'}`

export default function CallingHoursChecker() {
  const { locale } = useLocale()
  const [state, setState] = useState('TX')
  const [code, setCode] = useState('')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(id) }, [])

  const fromCode = code.replace(/\D/g, '').slice(-10).slice(0, 3)
  const cls = fromCode.length === 3 ? classifyAreaCode(fromCode) : null
  const active = cls && cls.kind === 'us' ? cls.state : state
  const tz = STATE_TIMEZONES[active]
  const rule = RULES[active] ?? FEDERAL
  const hour = tz ? localHour(tz, now) : null
  const open = hour != null && hour >= rule.start && hour < rule.end
  const states = Object.keys(STATE_TIMEZONES).sort((a, b) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b))

  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid" style={{ ['--cols' as string]: 2 }}>
        <SelectField id="ch-state" label="STATE" value={state} onChange={(v) => { setState(v); setCode('') }}
          options={states.map((s) => ({ value: s, label: STATE_NAMES[s] ?? s }))} />
        <div className="tk-field">
          <label htmlFor="ch-code">{t("OR AN AREA CODE / PHONE NUMBER")}</label>
          <input id="ch-code" type="text" inputMode="tel" value={code} onChange={(e) => setCode(e.target.value)} placeholder="(305) 555-0100" />
          {cls && cls.kind !== 'us' && <div className="tk-hint">{t("Not a US area code. Canada and other countries have their own rules.")}</div>}
        </div>
      </div>

      {tz && (
        <div className={`tk-result ${open ? 'ok' : 'over'}`} aria-live="polite">
          <div className="tk-big">{open ? t("You can call now") : t("Don't call now")}</div>
          <p>
            {t("It is {time} in {state}.", { time: localTime(tz, now, locale), state: t(STATE_NAMES[active] ?? active) })}{' '}
            {t("Telemarketing calls are allowed from {start} to {end} local time", { start: hourLabel(rule.start), end: hourLabel(rule.end) })}
            {' '}({rule.source}).
            {SPLIT_ZONE_STATES.has(active) && ' ' + t("This state spans two time zones; check the lead's own zone near the edges of the window.")}
          </p>
        </div>
      )}

      <div className="tk-label" style={{ marginTop: 18 }}>{t("Every state, right now")}</div>
      <div className="tk-tablewrap">
        <table className="tk-table">
          <thead><tr><th>{t("State")}</th><th>{t("Local time")}</th><th>{t("Window")}</th><th>{t("Now")}</th></tr></thead>
          <tbody>
            {states.map((s) => {
              const z = STATE_TIMEZONES[s]
              const r = RULES[s] ?? FEDERAL
              const h = localHour(z, now)
              const ok = h >= r.start && h < r.end
              return (
                <tr key={s}>
                  <td><b>{t(STATE_NAMES[s] ?? s)}</b></td>
                  <td>{localTime(z, now, locale)}</td>
                  <td>{hourLabel(r.start)}–{hourLabel(r.end)}{RULES[s] ? ' *' : ''}</td>
                  <td><span className={`tk-pill ${ok ? 'ok' : 'no'}`}>{ok ? t("Open") : t("Closed")}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="tk-foot">
        {t("* Florida's statute ends telemarketing at 8 p.m. Every other row shows the federal window, which is the floor everywhere: some states set narrower hours, weekend or holiday limits, so check your state's own law before relying on the federal window. The time zone comes from the state's main zone. Not legal advice.")}</p>
    </div>
  )
}
