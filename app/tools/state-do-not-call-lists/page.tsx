import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import StateDncTable from '@/components/tools/StateDncTable'
import { msg } from '@/lib/i18n/msg'

// /tools/state-do-not-call-lists: autocomplete on 2026-11-05 finishes "state do
// not call list" with "texas", "florida", "indiana", "pa" and more, and the
// answers online are years-old vendor pages that disagree. Each row here was
// read from the state's own site. Layout: components/tools/ToolPage.

const ROUTE = '/tools/state-do-not-call-lists'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "State Do Not Call Lists: Who Runs Them, What They Cost",
  description: "Eleven states with their own do not call rules, checked on each state's site: who runs the list, what telemarketers pay and how often it changes.",
  social: "State do not call lists, checked on each state's own site",
})

const FAQS = [
  { question: msg("Do states have their own Do Not Call lists?"), answer: msg("Some do. The table covers the eleven that compliance vendors usually name. Ten have a list of their own and Wyoming’s law points at a private one. The National Do Not Call Registry applies in every state whatever the state does.") },
  { question: msg("Is scrubbing the national registry enough?"), answer: msg("Not where a state keeps its own list, because that list is a separate obligation with its own fee and its own schedule. Check the state’s page for each state you call, including when you are calling from somewhere else.") },
  { question: msg("My state isn’t in the table. Am I in the clear?"), answer: msg("Not necessarily. We checked these eleven, not all fifty, so a missing state means we have not confirmed anything about it. Ask that state’s attorney general.") },
  { question: msg("Does DialerSeat scrub state lists?"), answer: msg("No. DialerSeat does not scrub against the national registry or any state list. You buy the lists and scrub before you upload.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("State Do Not Call lists")}
      eyebrow={msg("▸ FREE REFERENCE · STATE DO NOT CALL LISTS")}
      h1={msg("Which states run")}
      h1Second={msg("their own list?")}
      answer={msg("The national registry is not the only list. These eleven states are the ones compliance vendors usually name, and each row was read from the state’s own site: who runs the list, what a telemarketer pays and how often it changes. Where the state did not publish a current price, the row says that rather than quoting an old one.")}
      tool={<StateDncTable />}
      toolIcon="list"
      faqs={FAQS}
      related={[{ href: "/tools/dnc-registry-cost-calculator", label: msg("NATIONAL REGISTRY COST") }, { href: "/faq/how-to-scrub-the-do-not-call-registry", label: msg("HOW TO SCRUB THE REGISTRY") }]}
      pitch={msg("Scrubbed list ready? DialerSeat dials it at $35 a week per seat, in each lead’s calling window.")}
      embedHeight={900}
    />
  )
}
