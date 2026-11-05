import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import AreaCodeLookup from '@/components/tools/AreaCodeLookup'
import { msg } from '@/lib/i18n/msg'

// /tools/area-code-lookup: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/area-code-lookup'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "Area Code Lookup: State, Time Zone & Local Time",
  description: "Look up any US area code or phone number: the state, the time zone, the local time there now and whether it’s inside calling hours. Every area code listed.",
  social: "Area code lookup with time zone",
})

const FAQS = [
  { question: msg("How do I find the time zone of an area code?"), answer: msg("Every US area code belongs to a state, and the state gives the time zone. A few states span two zones, so near the edges of a calling window check the person’s own city.") },
  { question: msg("Does an area code show where someone lives?"), answer: msg("It shows where the number was issued. Mobile numbers keep their area code when people move, so treat it as a strong hint, not an address.") },
  { question: msg("What are toll-free area codes?"), answer: msg("800, 833, 844, 855, 866, 877 and 888. They are not tied to a place and usually reach a business, not a person.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Area code lookup with time zone")}
      eyebrow={msg("▸ FREE TOOL · AREA CODE LOOKUP")}
      h1={msg("What time is it")}
      h1Second={msg("in that area code?")}
      answer={msg("Type an area code or a full phone number to see the state it belongs to, its time zone, the local time there right now, and whether it is inside the federal telemarketing window of 8 a.m. to 9 p.m. Below it, every US area code is listed by state with the current local time.")}
      tool={<AreaCodeLookup />}
      toolIcon="phone"
      faqs={FAQS}
      related={[{ href: "/tools/telemarketing-calling-hours", label: msg("CALLING HOURS BY STATE") }, { href: "/faq/local-presence-dialing", label: msg("LOCAL PRESENCE DIALING") }]}
      pitch={msg("DialerSeat uses this same table to call each lead in their own time zone, and dials with local presence by default. $35 a week per seat.")}
      embedHeight={820}
    />
  )
}
