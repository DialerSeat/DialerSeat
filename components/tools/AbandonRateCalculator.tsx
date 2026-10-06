'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n/client'
import { msg } from '@/lib/i18n/msg'
import { useWebMcpTool } from '@/lib/useWebMcpTool'
import { ABANDON_RATE_RULES, ABANDON_RATE_TOOL } from '@/lib/webmcpTools'

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
  us: { label: msg("United States (FTC TSR)"), limit: 3, window: msg("per campaign, each 30-day period"), base: msg("calls answered by a person") },
  uk: { label: msg("United Kingdom (Ofcom)"), limit: 3, window: msg("per campaign, each 24 hours"), base: msg("live calls") },
  ca: { label: msg("Canada (CRTC)"), limit: 5, window: msg("each calendar month"), base: msg("calls answered") },
} as const

type RuleKey = keyof typeof RULES
const RULE_KEYS: readonly RuleKey[] = ABANDON_RATE_RULES

// One calculation for the page and for the WebMCP tool below.
function assess(rule: RuleKey, answered: number, abandoned: number) {
  const r = RULES[rule]
  const rate = answered > 0 ? (abandoned / answered) * 100 : 0
  const allowed = Math.floor((answered * r.limit) / 100)
  return { r, rate, allowed, headroom: allowed - abandoned, inside: rate <= r.limit }
}

const count = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0))

export default function AbandonRateCalculator() {
  const [rule, setRule] = useState<RuleKey>('us')
  const [answered, setAnswered] = useState(1200)
  const [abandoned, setAbandoned] = useState(30)

  const { r, rate, allowed, headroom, inside } = assess(rule, answered, abandoned)

  // An AI agent in the browser can run the same check (lib/useWebMcpTool).
  useWebMcpTool({
    ...ABANDON_RATE_TOOL,
    execute: (input) => {
      const k = RULE_KEYS.includes(input.rule as RuleKey) ? (input.rule as RuleKey) : 'us'
      const a = count(input.answered), x = count(input.abandoned)
      setRule(k); setAnswered(a); setAbandoned(x)
      const res = assess(k, a, x)
      return {
        rule: res.r.label,
        limitPercent: res.r.limit,
        measured: `${res.r.window}, as a share of ${res.r.base}`,
        ratePercent: Number(res.rate.toFixed(2)),
        mostAbandonedAllowed: res.allowed,
        headroom: res.headroom,
        insideLimit: res.inside,
        source: 'https://dialerseat.com/tools/abandon-rate-calculator',
      }
    },
  })

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
          <label htmlFor="arc-rule">{t("RULE")}</label>
          <select id="arc-rule" value={rule} onChange={(e) => setRule(e.target.value as RuleKey)}>
            {Object.entries(RULES).map(([k, v]) => (
              <option key={k} value={k}>{t(v.label)}</option>
            ))}
          </select>
        </div>
        <div className="arc-field">
          <label htmlFor="arc-answered">{t("CALLS ANSWERED BY A PERSON")}</label>
          <input id="arc-answered" type="number" min={0} value={answered}
            onChange={(e) => setAnswered(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div className="arc-field">
          <label htmlFor="arc-abandoned">{t("ABANDONED CALLS")}</label>
          <input id="arc-abandoned" type="number" min={0} value={abandoned}
            onChange={(e) => setAbandoned(Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </div>

      <div className={`arc-result ${inside ? 'ok' : 'over'}`} aria-live="polite">
        <b>{rate.toFixed(2)}%</b>
        <p>
          {inside
            ? t("Inside the {limit}% limit. You could abandon {headroom} more call{value} before crossing it.", { limit: r.limit, headroom, value: headroom === 1 ? '' : 's' })
            : t("Over the {limit}% limit by {over} call{value}. At {answered} answered calls, {allowed} abandoned is the most allowed.", { limit: r.limit, over: Math.abs(headroom), value: Math.abs(headroom) === 1 ? '' : 's', answered: answered.toLocaleString('en-US'), allowed })}
          {' '}
          {t("Measured {window}, as a share of {base}.", { window: t(r.window), base: t(r.base) })}</p>
      </div>

      <p className="arc-foot">
        {t("A call is abandoned when a person answers and no agent is connected within 2 seconds (US and Canada). Divide by answered calls, not dials: dividing by dials understates the rate. The US rule also requires a recorded message with the seller’s name and number on every abandoned call, and 15 seconds of ringing before hanging up.")}</p>
    </div>
  )
}
