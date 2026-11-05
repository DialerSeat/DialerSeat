'use client'

import { useMemo, useState } from 'react'
import { t } from '@/lib/i18n/client'
import { ToolStyles, SelectField, TextField, CopyButton } from './kit'

// =============================================================================
// COLD CALL SCRIPT + SALES VOICEMAIL GENERATORS
// =============================================================================
// Templates, not AI: the same inputs always give the same script, so a
// manager can hand it to a floor and know what every agent is saying. Each
// industry carries its own reason for calling, questions and the objections
// that actually come up on those calls. Every script ends the way a
// compliant call has to when someone asks not to be called again.
// =============================================================================

type Industry = 'real_estate' | 'insurance' | 'mortgage' | 'solar' | 'b2b' | 'recruiting' | 'general'

interface Pack {
  label: string
  offer: string
  reason: string
  questions: string[]
  objections: [string, string][]
}

const PACKS: Record<Industry, Pack> = {
  real_estate: {
    label: 'Real estate',
    offer: 'helping homeowners in {area} sell without guessing at the price',
    reason: "I'm calling because a few homes near you sold recently, and some owners nearby want to know what that means for theirs.",
    questions: ['Have you thought about what your home would sell for today?', "If you did move, where would you go next?", 'Is there anything that would make selling worth it for you this year?'],
    objections: [
      ["I'm not selling.", "Totally fair. Most people I call aren't, today. Would it still be useful to know what your place is worth, so you have the number when it matters?"],
      ['I already have an agent.', "Good, then you're in safe hands. If anything changes with them, would it be all right if I checked in after the spring?"],
      ['Just send me something.', "Happy to. So I send the right thing: is it a price range you want, or what similar homes sold for?"],
    ],
  },
  insurance: {
    label: 'Insurance',
    offer: 'reviewing coverage so families in {area} are not overpaying or underinsured',
    reason: "I'm calling because you asked about coverage options, and I want to make sure you got real answers rather than a brochure.",
    questions: ['What made you look into coverage in the first place?', 'Is there anyone who depends on your income?', "What's your monthly budget so we only look at what fits?"],
    objections: [
      ["I'm not interested.", "I understand. Before I go, can I ask: is it the cost, or that you're already covered?"],
      ['I already have a policy.', "Great. When was it last reviewed? Prices and needs change, and a ten-minute check often finds money."],
      ["I can't afford it.", "That's exactly why I'd look first: some options cost less than people expect. What would a comfortable number be?"],
    ],
  },
  mortgage: {
    label: 'Mortgage',
    offer: 'helping homeowners in {area} see whether refinancing or a new purchase makes sense this year',
    reason: "I'm calling because you looked into home financing, and rates have moved since, so the numbers may look different now.",
    questions: ['What rate are you on now, roughly?', 'Are you looking to lower the payment, take cash out, or buy something new?', 'How long do you plan to stay in the home?'],
    objections: [
      ["Rates are too high.", "They might be for some people. Can I run your numbers so you know for sure, instead of guessing?"],
      ['I already have a lender.', "Makes sense. Would a second set of numbers be useful, just to know you're getting a fair deal?"],
      ['Not right now.', "No problem. When would be a better time to look, so I don't call you before you're ready?"],
    ],
  },
  solar: {
    label: 'Solar',
    offer: 'showing homeowners in {area} what solar would actually save on their electric bill',
    reason: "I'm calling because homes on your street have been comparing their electric bills against solar, and I wanted to offer you the same numbers.",
    questions: ['Roughly what is your electric bill in summer?', 'Do you own the home?', 'Does your roof get sun most of the day?'],
    objections: [
      ["It's too expensive.", "That's the most common worry. A lot of people pay nothing upfront. Can I show you your own numbers before you decide?"],
      ["I'm renting.", "Thanks for telling me, then it isn't something you can decide on. I'll take you off my list."],
      ['Send me information.', "Sure. The useful version is your own estimate. Would 15 minutes this week work to go through it?"],
    ],
  },
  b2b: {
    label: 'B2B / SDR',
    offer: 'helping {area} teams like yours {result}',
    reason: "I'm calling because I work with teams like yours on {result}, and I wanted to see if it's on your radar this quarter.",
    questions: ['How are you handling that today?', "What's working, and what isn't?", 'If you could fix one part of it this quarter, which would it be?'],
    objections: [
      ['Not interested.', "Fair enough. Is that because it's not a priority right now, or because you've already solved it?"],
      ['Send me an email.', "Will do. So it's worth reading: what would you want it to answer?"],
      ["We're happy with what we have.", "Glad to hear it. What do you like most about it? I'll only follow up if we can genuinely do better there."],
    ],
  },
  recruiting: {
    label: 'Recruiting',
    offer: 'connecting people in {area} with roles that pay better than the one they are in',
    reason: "I'm calling because your background lines up with a role I'm filling, and I'd rather ask you directly than send a generic message.",
    questions: ["What would make a move worth it for you?", 'Are you open to hearing about roles right now, or happy where you are?', "What's the right salary range for your next step?"],
    objections: [
      ["I'm happy where I am.", "That's great to hear. Would you want to know if something came up that was clearly better?"],
      ["I'm too busy.", "Understood. When's a better time for ten minutes, evenings or a lunch break?"],
      ['Just email it.', "Sure. What's the best address, and what would make you open it?"],
    ],
  },
  general: {
    label: 'General sales',
    offer: '{result}',
    reason: "I'm calling because we help people with {result}, and I wanted to see if that's useful to you.",
    questions: ['How are you handling that at the moment?', "What would you change about it if you could?", 'Who else would be part of a decision like this?'],
    objections: [
      ['Not interested.', "Fair enough. Can I ask what you're using now, so I know whether to call back later?"],
      ['Send me info.', "Happy to. What would you want it to cover?"],
      ["I'm busy.", "Understood. When's a better time for five minutes?"],
    ],
  },
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k) => v[k] || `[${k}]`)

function useInputs() {
  const [industry, setIndustry] = useState<Industry>('real_estate')
  const [name, setName] = useState('Alex')
  const [company, setCompany] = useState('Northside Realty')
  const [area, setArea] = useState('Austin')
  const [result, setResult] = useState('book more qualified meetings')
  return { industry, setIndustry, name, setName, company, setCompany, area, setArea, result, setResult }
}

function Inputs(p: ReturnType<typeof useInputs>) {
  return (
    <div className="tk-grid">
      <SelectField id="sg-ind" label="Industry" value={p.industry} onChange={p.setIndustry}
        options={(Object.keys(PACKS) as Industry[]).map((k) => ({ value: k, label: PACKS[k].label }))} />
      <TextField id="sg-name" label="Your first name" value={p.name} onChange={p.setName} />
      <TextField id="sg-co" label="Company" value={p.company} onChange={p.setCompany} />
      <TextField id="sg-area" label="Area or market" value={p.area} onChange={p.setArea} />
      {(p.industry === 'b2b' || p.industry === 'general') && (
        <TextField id="sg-res" label="What you help with" value={p.result} onChange={p.setResult} />
      )}
    </div>
  )
}

export function ColdCallScriptGenerator() {
  const s = useInputs()
  const pack = PACKS[s.industry]
  const v = { area: s.area, result: s.result, name: s.name, company: s.company }
  const script = useMemo(() => {
    const parts = [
      ['OPENER', `Hi, is this [first name]? This is ${s.name || '[your name]'} with ${s.company || '[company]'}. I'll be quick, do you have 30 seconds?`],
      ['REASON FOR THE CALL', fill(pack.reason, v)],
      ['WHAT YOU DO', `We focus on ${fill(pack.offer, v)}.`],
      ['QUESTIONS', pack.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')],
      ['ASK FOR THE APPOINTMENT', "Based on what you've told me, it's worth 15 minutes to go through it properly. Does [day] at [time] work, or is [day] better?"],
      ['OBJECTIONS', pack.objections.map(([o, r]) => `"${o}"\n→ ${r}`).join('\n\n')],
      ['"HOW DID YOU GET MY NUMBER?"', 'Answer honestly and specifically: name where the number came from (the form they filled in, the list you bought, the referral). A vague answer ends the call.'],
      ['IF THEY ASK NOT TO BE CALLED', `"Understood, I'll take you off our list right now. Sorry to bother you." Then add them to your do-not-call list before the next call.`],
    ] as const
    return parts.map(([h, b]) => `${h}\n${b}`).join('\n\n')
  }, [s.name, s.company, s.area, s.result, s.industry]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tk">
      <ToolStyles />
      <Inputs {...s} />
      <div className="tk-row"><CopyButton text={script} label="COPY SCRIPT" /></div>
      <div className="tk-out">{script}</div>
      <p className="tk-foot">{t("Read it out loud before the first call and change anything that doesn't sound like you. A script that sounds read is worse than none. Put your own words in the brackets.")}</p>
    </div>
  )
}

export function VoicemailScriptGenerator() {
  const s = useInputs()
  const [callback, setCallback] = useState('(512) 555-0100')
  const pack = PACKS[s.industry]
  const v = { area: s.area, result: s.result }
  const offer = fill(pack.offer, v)
  const mails = [
    ['FIRST TOUCH', `Hi [first name], it's ${s.name} with ${s.company}. I'm calling about ${offer}. I've got a quick question for you, nothing long. Call me back at ${callback}. Again, ${s.name}, ${callback}.`],
    ['FOLLOW-UP', `Hi [first name], ${s.name} again from ${s.company}. I left a message earlier in the week about ${offer}. If it's useful, I'm at ${callback}. If not, no problem at all. ${callback}.`],
    ['LAST ONE', `Hi [first name], ${s.name} from ${s.company}, last message from me, I promise. If ${offer} ever becomes a priority, my number is ${callback}. Have a good week.`],
  ] as const
  const all = mails.map(([h, b]) => `${h}\n${b}`).join('\n\n')
  return (
    <div className="tk">
      <ToolStyles />
      <Inputs {...s} />
      <div className="tk-grid" style={{ marginTop: 12, ['--cols' as string]: 2 }}>
        <TextField id="vm-cb" label="Callback number" value={callback} onChange={setCallback} />
      </div>
      <div className="tk-row"><CopyButton text={all} label="COPY ALL THREE" /></div>
      {mails.map(([h, b]) => {
        const words = b.split(/\s+/).length
        const secs = Math.round((words / 150) * 60)
        return (
          <div key={h} className="tk-out">
            <h4>{t(h)} · {t("{w} words, about {s} seconds", { w: words, s: secs })}</h4>
            {b}
          </div>
        )
      })}
      <p className="tk-foot">{t("Under 30 seconds each at a normal speaking pace (about 150 words a minute). Say the number twice, slowly. Three messages is enough: after that, a voicemail stops being a reminder and starts being a reason to block you.")}</p>
    </div>
  )
}
