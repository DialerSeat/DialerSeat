import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { TcpaChecklist } from '@/components/tools/TrackerAndChecklist'
import { msg } from '@/lib/i18n/msg'

// /tools/tcpa-compliance-checklist: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/tcpa-compliance-checklist'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "TCPA Compliance Checklist for Outbound Calling",
  description: "The TCPA and Telemarketing Sales Rule requirements an outbound campaign has to meet, each with its regulation: DNC, consent, hours, 3% abandons, caller ID.",
  social: "TCPA compliance checklist",
})

const FAQS = [
  { question: msg("What does TCPA compliance require?"), answer: msg("For outbound telemarketing: scrubbing Do Not Call lists, consent for autodialed or prerecorded calls to mobiles, calling only between 8 a.m. and 9 p.m. local time, and honoring opt-outs. The FTC’s Telemarketing Sales Rule adds the abandoned-call and caller ID rules.") },
  { question: msg("What is the 3% abandon rule?"), answer: msg("No more than 3% of calls answered by a person may be abandoned, per campaign, over each 30-day period. A call is abandoned when nobody is connected within 2 seconds of the greeting.") },
  { question: msg("Is this legal advice?"), answer: msg("No. It is a checklist of federal rules with their citations. States add their own, and a lawyer who handles TCPA work should review anything a campaign depends on.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("TCPA compliance checklist")}
      eyebrow={msg("▸ FREE TOOL · TCPA COMPLIANCE CHECKLIST")}
      h1={msg("Is your campaign")}
      h1Second={msg("actually compliant?")}
      answer={msg("Tick off what your outbound campaign already does: Do Not Call scrubbing, consent for autodialed calls to mobiles, calling hours in the lead’s time zone, the 3% abandoned-call limit, caller ID and the disclosures at the start of each call. Each item names the regulation it comes from. What stays unticked is your to-do list.")}
      tool={<TcpaChecklist />}
      toolIcon="shield"
      faqs={FAQS}
      related={[{ href: "/tools/abandon-rate-calculator", label: msg("ABANDON RATE CALCULATOR") }, { href: "/faq/how-we-keep-compliance", label: msg("HOW DIALERSEAT ENFORCES IT") }]}
      pitch={msg("DialerSeat enforces the calling window and the 3% limit in software on every call. Scrubbing and consent stay with you, and we say so.")}
      embedHeight={1100}
    />
  )
}
