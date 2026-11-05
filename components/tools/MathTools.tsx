'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n/client'
import { extractNanp } from '@/lib/tools/phone'
import { ToolStyles, NumField, Stat, fmt, pct, money } from './kit'

// =============================================================================
// THE CALCULATORS — call center math and sales math
// =============================================================================
// Each is one small component with its formula written next to the result, so
// a manager can check the arithmetic rather than trust it. No inputs leave the
// page. Grouped in one file because each is a few dozen lines of the same
// shape; each page imports only the one it shows.
// =============================================================================

// ── ERLANG C ───────────────────────────────────────────────────────────
/** Erlang C probability of waiting, via the stable Erlang B recursion. */
function erlangC(agents: number, traffic: number): number {
  if (agents <= traffic) return 1
  let b = 1
  for (let n = 1; n <= agents; n++) b = (traffic * b) / (n + traffic * b)
  return (agents * b) / (agents - traffic * (1 - b))
}

export function ErlangCCalculator() {
  const [calls, setCalls] = useState(200)
  const [interval, setInterval] = useState(30)
  const [aht, setAht] = useState(240)
  const [target, setTarget] = useState(80)
  const [answerIn, setAnswerIn] = useState(20)
  const [shrink, setShrink] = useState(30)

  const traffic = (calls * aht) / (interval * 60)
  let agents = Math.max(1, Math.floor(traffic) + 1)
  let sl = 0, pw = 1
  for (let i = 0; i < 2000; i++) {
    pw = erlangC(agents, traffic)
    sl = 1 - pw * Math.exp(-(agents - traffic) * (answerIn / aht))
    if (sl >= target / 100) break
    agents++
  }
  const asa = (pw * aht) / (agents - traffic)
  const occupancy = traffic / agents
  const scheduled = Math.ceil(agents / Math.max(0.01, 1 - shrink / 100))
  const valid = calls > 0 && aht > 0 && interval > 0

  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid">
        <NumField id="ec-calls" label="Calls in the interval" value={calls} onChange={setCalls} />
        <NumField id="ec-int" label="Interval (minutes)" value={interval} onChange={setInterval} min={1} />
        <NumField id="ec-aht" label="Average handle time (seconds)" value={aht} onChange={setAht} min={1} />
        <NumField id="ec-target" label="Service level target (%)" value={target} onChange={setTarget} min={1} max={99} />
        <NumField id="ec-ans" label="Answered within (seconds)" value={answerIn} onChange={setAnswerIn} min={1} />
        <NumField id="ec-shrink" label="Shrinkage (%)" value={shrink} onChange={setShrink} max={90} hint="Breaks, training, absence: time paid but not on calls." />
      </div>
      {valid && (
        <>
          <div className="tk-result ok" aria-live="polite">
            <div className="tk-big">{t("{n} agents on the phones", { n: fmt(agents) })}</div>
            <p>{t("{s} scheduled once {sh}% shrinkage is allowed for. That answers {sl} of calls within {sec} seconds.", { s: fmt(scheduled), sh: shrink, sl: pct(sl), sec: answerIn })}</p>
          </div>
          <div className="tk-stats">
            <Stat value={fmt(traffic, 2)} label="Traffic (Erlangs)" />
            <Stat value={pct(sl)} label="Service level" />
            <Stat value={`${fmt(asa, 1)}s`} label="Average speed of answer" />
            <Stat value={pct(occupancy)} label="Occupancy" />
            <Stat value={pct(pw)} label="Calls that wait" />
          </div>
        </>
      )}
      <p className="tk-foot">{t("Erlang C: traffic = calls × handle time ÷ interval length. The probability a call waits comes from the Erlang C formula; service level = 1 − P(wait) × e^(−(agents − traffic) × target seconds ÷ handle time). It assumes callers don't hang up while waiting, so it slightly overstates the agents a queue with abandons needs. Occupancy above about 85% for long stretches burns agents out.")}</p>
    </div>
  )
}

// ── AVERAGE HANDLE TIME ────────────────────────────────────────────────
export function AhtCalculator() {
  const [calls, setCalls] = useState(120)
  const [talk, setTalk] = useState(360)
  const [hold, setHold] = useState(40)
  const [wrap, setWrap] = useState(90)
  const [rate, setRate] = useState(18)
  const per = { talk: calls ? (talk * 60) / calls : 0, hold: calls ? (hold * 60) / calls : 0, wrap: calls ? (wrap * 60) / calls : 0 }
  const aht = per.talk + per.hold + per.wrap
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const costPerCall = (aht / 3600) * rate
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid">
        <NumField id="ah-calls" label="Calls handled" value={calls} onChange={setCalls} />
        <NumField id="ah-talk" label="Total talk time (minutes)" value={talk} onChange={setTalk} />
        <NumField id="ah-hold" label="Total hold time (minutes)" value={hold} onChange={setHold} />
        <NumField id="ah-wrap" label="Total after-call work (minutes)" value={wrap} onChange={setWrap} />
        <NumField id="ah-rate" label="Agent cost per hour ($)" value={rate} onChange={setRate} step={0.5} />
      </div>
      {calls > 0 && (
        <>
          <div className="tk-result ok" aria-live="polite">
            <div className="tk-big">{t("AHT {m}", { m: mmss(aht) })}</div>
            <p>{t("{s} seconds per call: {a} talking, {b} on hold, {c} wrapping up. At ${r} an hour that is {cost} of agent time per call.", { s: fmt(aht), a: mmss(per.talk), b: mmss(per.hold), c: mmss(per.wrap), r: rate, cost: money(costPerCall) })}</p>
          </div>
          <div className="tk-stats">
            <Stat value={pct(aht ? per.talk / aht : 0)} label="Share talking" />
            <Stat value={pct(aht ? per.hold / aht : 0)} label="Share on hold" />
            <Stat value={pct(aht ? per.wrap / aht : 0)} label="Share wrapping up" />
            <Stat value={fmt(aht ? 3600 / aht : 0, 1)} label="Calls per agent hour" />
          </div>
        </>
      )}
      <p className="tk-foot">{t("AHT = (talk time + hold time + after-call work) ÷ calls handled. Hold and wrap-up are the parts a process change shortens without rushing a conversation.")}</p>
    </div>
  )
}

// ── CALLS PER HOUR ─────────────────────────────────────────────────────
export function CallsPerHourCalculator() {
  const [dials, setDials] = useState(240)
  const [hours, setHours] = useState(4)
  const [answer, setAnswer] = useState(12)
  const [talk, setTalk] = useState(150)
  const [wrap, setWrap] = useState(20)
  const [ring, setRing] = useState(25)
  const measured = hours > 0 ? dials / hours : 0
  const a = answer / 100
  // One line: every dial costs its ring time; answered ones add talk and wrap.
  const perDialOne = ring + a * (talk + wrap)
  // N lines: unanswered ring time overlaps; the agent's time is the answered calls.
  const projected = (lines: number) => {
    const ringShare = (ring * (1 - a)) / lines
    const busy = a * (talk + wrap) + ringShare
    return busy > 0 ? 3600 / busy : 0
  }
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-label">{t("What you're doing now")}</div>
      <div className="tk-grid" style={{ ['--cols' as string]: 2 }}>
        <NumField id="cp-d" label="Dials made" value={dials} onChange={setDials} />
        <NumField id="cp-h" label="Hours on the phone" value={hours} onChange={setHours} step={0.25} />
      </div>
      <div className="tk-result ok" aria-live="polite">
        <div className="tk-big">{t("{n} dials an hour", { n: fmt(measured, 1) })}</div>
        <p>{t("Calls per hour = dials ÷ hours spent dialing.")}</p>
      </div>
      <div className="tk-label" style={{ marginTop: 18 }}>{t("What more lines would do")}</div>
      <div className="tk-grid">
        <NumField id="cp-a" label="Answer rate (%)" value={answer} onChange={setAnswer} max={100} />
        <NumField id="cp-t" label="Talk time per answered call (s)" value={talk} onChange={setTalk} />
        <NumField id="cp-w" label="Wrap-up per answered call (s)" value={wrap} onChange={setWrap} />
        <NumField id="cp-r" label="Ring time before giving up (s)" value={ring} onChange={setRing} min={1} />
      </div>
      <div className="tk-stats">
        <Stat value={fmt(perDialOne > 0 ? 3600 / perDialOne : 0)} label="1 line: dials / hour" />
        <Stat value={fmt(projected(2))} label="2 lines: dials / hour" />
        <Stat value={fmt(projected(3))} label="3 lines: dials / hour" />
        <Stat value={fmt((perDialOne > 0 ? 3600 / perDialOne : 0) * a, 1)} label="1 line: conversations / hour" />
        <Stat value={fmt(projected(3) * a, 1)} label="3 lines: conversations / hour" />
      </div>
      <p className="tk-foot">{t("An estimate, not a promise: one line spends every unanswered call's ring time waiting; with more lines, unanswered rings overlap and the agent's hour goes to conversations. Real numbers depend on how fast answers are routed and the abandon limit (3% of answered calls in the US), which caps how far lines can be pushed.")}</p>
    </div>
  )
}

// ── ANSWER / CONNECT / CONTACT RATE ────────────────────────────────────
export function ContactRateCalculator() {
  const [dials, setDials] = useState(1000)
  const [rang, setRang] = useState(940)
  const [answered, setAnswered] = useState(160)
  const [humans, setHumans] = useState(95)
  const [conversations, setConversations] = useState(60)
  const base = rang || 0
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid">
        <NumField id="cr-d" label="Dials" value={dials} onChange={setDials} hint="Every attempt, whatever happened." />
        <NumField id="cr-r" label="Dials that rang" value={rang} onChange={setRang} hint="Reached a phone. Failed-to-connect dials are left out." />
        <NumField id="cr-a" label="Answered" value={answered} onChange={setAnswered} hint="Picked up, by a person or a voicemail." />
        <NumField id="cr-h" label="Answered by a person" value={humans} onChange={setHumans} />
        <NumField id="cr-c" label="Right-party conversations" value={conversations} onChange={setConversations} hint="Spoke to the person you meant to reach." />
      </div>
      <div className="tk-stats">
        <Stat value={pct(base ? answered / base : NaN)} label="Answer rate" />
        <Stat value={pct(base ? humans / base : NaN)} label="Connect rate" />
        <Stat value={pct(base ? conversations / base : NaN)} label="Contact rate" />
        <Stat value={pct(dials ? (dials - rang) / dials : NaN)} label="Dials that never rang" />
      </div>
      <p className="tk-foot">{t("Answer rate = answered ÷ dials that rang. Connect rate = answered by a person ÷ dials that rang. Contact rate = right-party conversations ÷ dials that rang. Dividing by dials that rang, not every dial, keeps a technical failure from being blamed on your list. Dials that never rang still count in your dial totals and costs.")}</p>
    </div>
  )
}

// ── COLD CALLS PER DAY ─────────────────────────────────────────────────
export function ColdCallsPerDayCalculator() {
  const [sales, setSales] = useState(8)
  const [close, setClose] = useState(25)
  const [setRate, setSetRate] = useState(15)
  const [contact, setContact] = useState(8)
  const [days, setDays] = useState(20)
  const appts = close > 0 ? sales / (close / 100) : NaN
  const convos = setRate > 0 ? appts / (setRate / 100) : NaN
  const dials = contact > 0 ? convos / (contact / 100) : NaN
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid">
        <NumField id="cd-s" label="Sales you want this month" value={sales} onChange={setSales} />
        <NumField id="cd-c" label="Appointments that close (%)" value={close} onChange={setClose} max={100} />
        <NumField id="cd-a" label="Conversations that book (%)" value={setRate} onChange={setSetRate} max={100} />
        <NumField id="cd-r" label="Dials that reach the person (%)" value={contact} onChange={setContact} max={100} />
        <NumField id="cd-d" label="Calling days this month" value={days} onChange={setDays} min={1} />
      </div>
      <div className="tk-result ok" aria-live="polite">
        <div className="tk-big">{t("{n} dials a day", { n: fmt(Math.ceil(dials / days)) })}</div>
        <p>{t("{d} dials this month → {c} conversations → {a} appointments → {s} sales. One sale takes about {per} dials.", { d: fmt(Math.ceil(dials)), c: fmt(Math.ceil(convos)), a: fmt(Math.ceil(appts)), s: fmt(sales), per: fmt(Math.ceil(dials / Math.max(1, sales))) })}</p>
      </div>
      <p className="tk-foot">{t("Worked backwards: sales ÷ close rate = appointments; appointments ÷ booking rate = conversations; conversations ÷ contact rate = dials. Use your own rates from the last month if you have them; the defaults are placeholders, not benchmarks.")}</p>
    </div>
  )
}

// ── COST PER LEAD ──────────────────────────────────────────────────────
export function CostPerLeadCalculator() {
  const [spend, setSpend] = useState(1500)
  const [leads, setLeads] = useState(300)
  const [appts, setAppts] = useState(24)
  const [sales, setSales] = useState(6)
  const [value, setValue] = useState(900)
  const revenue = sales * value
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid">
        <NumField id="cl-s" label="Total spend ($)" value={spend} onChange={setSpend} hint="Leads, dialer, ads: whatever you want to count." />
        <NumField id="cl-l" label="Leads" value={leads} onChange={setLeads} />
        <NumField id="cl-a" label="Appointments (optional)" value={appts} onChange={setAppts} />
        <NumField id="cl-x" label="Sales (optional)" value={sales} onChange={setSales} />
        <NumField id="cl-v" label="Revenue per sale ($, optional)" value={value} onChange={setValue} />
      </div>
      <div className="tk-result ok" aria-live="polite">
        <div className="tk-big">{t("{c} per lead", { c: money(leads ? spend / leads : NaN) })}</div>
        <p>{t("Cost per lead = spend ÷ leads.")}</p>
      </div>
      <div className="tk-stats">
        <Stat value={money(appts ? spend / appts : NaN)} label="Cost per appointment" />
        <Stat value={money(sales ? spend / sales : NaN)} label="Cost per sale" />
        <Stat value={pct(leads ? sales / leads : NaN)} label="Lead to sale" />
        <Stat value={revenue ? `${fmt(revenue / Math.max(1, spend), 2)}×` : '—'} label="Return on spend" />
      </div>
    </div>
  )
}

// ── DO NOT CALL REGISTRY COST ──────────────────────────────────────────
// telemarketing.donotcall.gov, read 24 Sept 2026 (see the scrub page):
// first five area codes free, $85 each after that from 1 Oct 2026,
// capped at $23,425 for the whole registry.
const DNC = { free: 5, each: 85, cap: 23425 }

export function DncCostCalculator() {
  const [codes, setCodes] = useState(12)
  const [list, setList] = useState('')
  const fromList = list ? new Set(extractNanp(list).map((n) => n.slice(0, 3))).size : 0
  const n = list ? fromList : codes
  const cost = Math.min(DNC.cap, Math.max(0, n - DNC.free) * DNC.each)
  return (
    <div className="tk">
      <ToolStyles />
      <div className="tk-grid" style={{ ['--cols' as string]: 2 }}>
        <NumField id="dn-c" label="Area codes you call" value={codes} onChange={(v) => { setCodes(v); setList('') }} />
        <div className="tk-field">
          <label htmlFor="dn-l">{t("Or paste your numbers")}</label>
          <textarea id="dn-l" className="tk-area" style={{ minHeight: 90 }} value={list} onChange={(e) => setList(e.target.value)} placeholder="(512) 555-0100" />
          <div className="tk-hint">{t("Counted in your browser; nothing is uploaded.")}</div>
        </div>
      </div>
      <div className={`tk-result ${cost === 0 ? 'ok' : ''}`} aria-live="polite">
        <div className="tk-big">{cost === 0 ? t("Free") : money(cost, 0)}</div>
        <p>{t("{n} area code{s}: the first {f} are free, then ${e} each, capped at {cap} for every area code.", { n: fmt(n), s: n === 1 ? '' : 's', f: DNC.free, e: DNC.each, cap: money(DNC.cap, 0) })}</p>
      </div>
      <p className="tk-foot">{t("Fees from telemarketing.donotcall.gov for access from 1 October 2026. The Telemarketing Sales Rule's safe harbor needs a copy of the registry no more than 31 days old when you call, so scrub again at least monthly.")}</p>
    </div>
  )
}
