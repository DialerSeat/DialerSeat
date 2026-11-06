import { msg } from '@/lib/i18n/msg'

// =============================================================================
// THE COLD CALL AND VOICEMAIL TEMPLATES
// =============================================================================
// Templates, not AI: the same inputs always give the same script, so a manager
// can hand it to a floor and know what every agent is saying. Each industry
// carries its own reason for calling, questions and the objections that come up
// on those calls. Every script ends the way a compliant call has to when someone
// asks not to be called again.
//
// Kept out of components/ on purpose, and in English in every language: agents
// read these to US leads, the same reason the dialer demos stay in English. Only
// the labels around them are translated (the msg() calls here).
// =============================================================================

export type Industry = 'real_estate' | 'insurance' | 'mortgage' | 'solar' | 'b2b' | 'recruiting' | 'general'

interface Pack {
  label: string
  offer: string
  reason: string
  questions: string[]
  objections: [string, string][]
}

export const PACKS: Record<Industry, Pack> = {
  real_estate: {
    label: msg("Real estate"),
    offer: 'helping homeowners in {area} sell without guessing at the price',
    reason: "I'm calling to offer you a free estimate of what your home could sell for today.",
    questions: ['Have you thought about what your home would sell for today?', "If you did move, where would you go next?", 'Is there anything that would make selling worth it for you this year?'],
    objections: [
      ["I'm not selling.", "Totally fair. Most people I call aren't, today. Would it still be useful to know what your place is worth, so you have the number when it matters?"],
      ['I already have an agent.', "Good, then you're in safe hands. If anything changes with them, would it be all right if I checked in after the spring?"],
      ['Just send me something.', "Happy to. So I send the right thing: is it a price range you want, or what similar homes sold for?"],
    ],
  },
  insurance: {
    label: msg("Insurance"),
    offer: 'reviewing coverage so families in {area} are not overpaying or underinsured',
    reason: "I'm calling to see whether your coverage still fits, and whether you're paying more than you need to.",
    questions: ['What made you look into coverage in the first place?', 'Is there anyone who depends on your income?', "What's your monthly budget so we only look at what fits?"],
    objections: [
      ["I'm not interested.", "I understand. Before I go, can I ask: is it the cost, or that you're already covered?"],
      ['I already have a policy.', "Great. When was it last reviewed? Prices and needs change, and a ten-minute check tells you either way."],
      ["I can't afford it.", "That's exactly why I'd look first, so you know for sure. What would a comfortable number be?"],
    ],
  },
  mortgage: {
    label: msg("Mortgage"),
    offer: 'helping homeowners in {area} see whether refinancing or a new purchase makes sense this year',
    reason: "I'm calling about home financing, to see whether the numbers could work better for you.",
    questions: ['What rate are you on now, roughly?', 'Are you looking to lower the payment, take cash out, or buy something new?', 'How long do you plan to stay in the home?'],
    objections: [
      ["Rates are too high.", "They might be for some people. Can I run your numbers so you know for sure, instead of guessing?"],
      ['I already have a lender.', "Makes sense. Would a second set of numbers be useful, just to know you're getting a fair deal?"],
      ['Not right now.', "No problem. When would be a better time to look, so I don't call you before you're ready?"],
    ],
  },
  solar: {
    label: msg("Solar"),
    offer: 'showing homeowners in {area} what solar would actually save on their electric bill',
    reason: "I'm calling to offer you a free estimate of what solar would do to your electric bill.",
    questions: ['Roughly what is your electric bill in summer?', 'Do you own the home?', 'Does your roof get sun most of the day?'],
    objections: [
      ["It's too expensive.", "That's fair to worry about. Can I show you your own numbers, so you're deciding on the real cost rather than a guess?"],
      ["I'm renting.", "Thanks for telling me, then it isn't something you can decide on. I'll take you off my list."],
      ['Send me information.', "Sure. The useful version is your own estimate. Would 15 minutes this week work to go through it?"],
    ],
  },
  b2b: {
    label: msg("B2B / SDR"),
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
    label: msg("Recruiting"),
    offer: 'connecting people in {area} with roles worth moving for',
    reason: "I'm calling because your background lines up with a role I'm filling, and I'd rather ask you directly than send a generic message.",
    questions: ["What would make a move worth it for you?", 'Are you open to hearing about roles right now, or happy where you are?', "What's the right salary range for your next step?"],
    objections: [
      ["I'm happy where I am.", "That's great to hear. Would you want to know if something came up that was clearly better?"],
      ["I'm too busy.", "Understood. When's a better time for ten minutes, evenings or a lunch break?"],
      ['Just email it.', "Sure. What's the best address, and what would make you open it?"],
    ],
  },
  general: {
    label: msg("General sales"),
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

export interface ScriptInputs {
  industry: Industry
  name: string
  company: string
  area: string
  result: string
}

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k) => v[k] || `[${k}]`)

export function buildColdCallScript(i: ScriptInputs): string {
  const pack = PACKS[i.industry]
  const v = { area: i.area, result: i.result, name: i.name, company: i.company }
  const parts = [
    ['OPENER', `Hi, is this [first name]? This is ${i.name || '[your name]'} with ${i.company || '[company]'}. I'll be quick, do you have 30 seconds?`],
    ['REASON FOR THE CALL', fill(pack.reason, v)],
    ['WHAT YOU DO', `We focus on ${fill(pack.offer, v)}.`],
    ['QUESTIONS', pack.questions.map((q, n) => `${n + 1}. ${q}`).join('\n')],
    ['ASK FOR THE APPOINTMENT', "Based on what you've told me, it's worth 15 minutes to go through it properly. Does [day] at [time] work, or is [day] better?"],
    ['OBJECTIONS', pack.objections.map(([o, r]) => `"${o}"\n→ ${r}`).join('\n\n')],
    ['"HOW DID YOU GET MY NUMBER?"', 'Answer honestly and specifically: name where the number came from (the form they filled in, the list you bought, the referral). A vague answer ends the call.'],
    ['IF THEY ASK NOT TO BE CALLED', `"Understood, I'll take you off our list right now. Sorry to bother you." Then add them to your do-not-call list before the next call.`],
  ] as const
  return parts.map(([h, b]) => `${h}\n${b}`).join('\n\n')
}

/** Heading is shown translated; the message itself stays in English. */
export function buildVoicemails(i: ScriptInputs, callback: string): { heading: string; plain: string; body: string }[] {
  const offer = fill(PACKS[i.industry].offer, { area: i.area, result: i.result })
  return [
    { heading: msg("FIRST TOUCH"), plain: 'FIRST TOUCH', body: `Hi [first name], it's ${i.name} with ${i.company}. I'm calling about ${offer}. I've got a quick question for you, nothing long. Call me back at ${callback}. Again, ${i.name}, ${callback}.` },
    { heading: msg("FOLLOW-UP"), plain: 'FOLLOW-UP', body: `Hi [first name], ${i.name} again from ${i.company}. I left a message earlier in the week about ${offer}. If it's useful, I'm at ${callback}. If not, no problem at all. ${callback}.` },
    { heading: msg("LAST ONE"), plain: 'LAST ONE', body: `Hi [first name], ${i.name} from ${i.company}, last message from me, I promise. If ${offer} ever becomes a priority, my number is ${callback}. Have a good week.` },
  ]
}
