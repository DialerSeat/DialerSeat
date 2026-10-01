'use client'

import { useState } from 'react'

// =============================================================================
// ABANDON RATE CALCULATOR — is a predictive campaign inside the legal limit?
// =============================================================================
// The three limits a US, UK or Canadian floor actually works under, each with
// its own measurement window. The arithmetic is trivial; what people get wrong
// is the base (answered calls, not dials) and the window, so both are stated
// next to the result rather than left to a footnote.
//
// Sources are the same as lib/countryRules: FTC TSR (16 CFR 310.4), Ofcom's
// persistent-misuse policy, and the CRTC Unsolicited Telecommunications Rules.
// =============================================================================

const RULES = {
  us: { label: 'United States (FTC TSR)', limit: 3, window: 'per campaign, each 30-day period', base: 'calls answered by a person' },
  uk: { label: 'United Kingdom (Ofcom)', limit: 3, window: 'per campaign, each 24 hours', base: 'live calls' },
  ca: { label: 'Canada (CRTC)', limit: 5, window: 'each calendar month', base: 'calls answered' },
} as const

type RuleKey = keyof typeof RULES

export default function AbandonRateCalculator() {
  const [rule, setRule] = useState<RuleKey>('us')
  const [answered, setAnswered] = useState(1200)
  const [abandoned, setAbandoned] = useState(30)

  const r = RULES[rule]
  const rate = answered > 0 ? (abandoned / answered) * 100 : 0
  const allowed = Math.floor((answered * r.limit) / 100)
  const headroom = allowed - abandoned
  const inside = rate <= r.limit

  return (
    <div className="arc">
      <style>{`
        .arc { color: #1a1c24; text-align: start; }
        .arc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .arc-field { background: #f5f7fb; border: 1px solid #d6dbe3; border-radius: 10px; padding: 14px 16px; }
        .arc-field label { display: block; font-size: 10px; font-weight: bold; letter-spacing: 2px; color: #5a6072; margin-bottom: 8px; }
        .arc-field input, .arc-field select {
          width: 100%; font: inherit; font-size: 15px; font-weight: 700; padding: 8px 10px;
          border: 1px solid #c4c8d0; border-radius: 6px; color: #1a1c24; background: #fff;
        }
        .arc-result { margin-top: 16px; border-radius: 10px; padding: 18px 20px; display: grid; grid-template-columns: auto 1fr; gap: 6px 18px; align-items: center; }
        .arc-result.ok { background: rgba(31,138,76,0.08); border: 1px solid rgba(31,138,76,0.35); }
        .arc-result.over { background: rgba(180,35,24,0.07); border: 1px solid rgba(180,35,24,0.35); }
        .arc-result b { font-size: 34px; font-variant-numeric: tabular-nums; }
        .arc-result.ok b { color: #1f8a4c; } .arc-result.over b { color: #b42318; }
        .arc .arc-result p { margin: 0; font-size: 14px; line-height: 1.55; }
        .arc .arc-foot { margin-top: 12px; font-size: 11.5px; color: #6b7182; line-height: 1.6; }
        @media (max-width: 620px) { .arc-grid { grid-template-columns: 1fr; } .arc-result { grid-template-columns: 1fr; } }
      `}</style>

      <div className="arc-grid">
        <div className="arc-field">
          <label htmlFor="arc-rule">RULE</label>
          <select id="arc-rule" value={rule} onChange={(e) => setRule(e.target.value as RuleKey)}>
            {Object.entries(RULES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="arc-field">
          <label htmlFor="arc-answered">CALLS ANSWERED BY A PERSON</label>
          <input id="arc-answered" type="number" min={0} value={answered}
            onChange={(e) => setAnswered(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div className="arc-field">
          <label htmlFor="arc-abandoned">ABANDONED CALLS</label>
          <input id="arc-abandoned" type="number" min={0} value={abandoned}
            onChange={(e) => setAbandoned(Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>

      <div className={`arc-result ${inside ? 'ok' : 'over'}`} aria-live="polite">
        <b>{rate.toFixed(2)}%</b>
        <p>
          {inside
            ? `Inside the ${r.limit}% limit. You could abandon ${headroom} more call${headroom === 1 ? '' : 's'} before crossing it.`
            : `Over the ${r.limit}% limit by ${Math.abs(headroom)} call${Math.abs(headroom) === 1 ? '' : 's'}. At ${answered.toLocaleString('en-US')} answered calls, ${allowed} abandoned is the most allowed.`}
          {' '}Measured {r.window}, as a share of {r.base}.
        </p>
      </div>

      <p className="arc-foot">
        A call is abandoned when a person answers and no agent is connected within 2 seconds (US and Canada). Divide by
        answered calls, not dials: dividing by dials understates the rate. The US rule also requires a recorded message
        with the seller’s name and number on every abandoned call, and 15 seconds of ringing before hanging up.
      </p>
    </div>
  )
}
