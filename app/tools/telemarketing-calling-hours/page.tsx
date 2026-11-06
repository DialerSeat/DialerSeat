import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import CallingHoursChecker from '@/components/tools/CallingHoursChecker'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/telemarketing-calling-hours: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/telemarketing-calling-hours'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Telemarketing Calling Hours by State: Can I Call Now?"),
  description: msg("What time can telemarketers call? 8 a.m. to 9 p.m. in the person’s local time. See every state’s local time and whether it’s inside the window right now."),
  social: msg("Telemarketing calling hours by state"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("What time can telemarketers call?"), answer: msg("Between 8 a.m. and 9 p.m. in the time zone of the person being called (47 CFR 64.1200(c)(1) and 16 CFR 310.4(c)). Some states set narrower hours; Florida’s ends at 8 p.m.") },
  { question: msg("Can telemarketers call on Sundays or holidays?"), answer: msg("Federal rules do not ban Sunday or holiday calls, as long as they fall inside the hours. Some states restrict them, so check the law in the states you call before dialing on those days.") },
  { question: msg("Whose time zone counts, mine or theirs?"), answer: msg("Theirs. A call from California at 6 p.m. reaches New York at 9 p.m., already outside the window.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Telemarketing calling hours by state")}
      eyebrow={msg("▸ FREE TOOL · TELEMARKETING CALLING HOURS")}
      h1={msg("Can you call")}
      h1Second={msg("that state right now?")}
      answer={msg("Telemarketers may call between 8 a.m. and 9 p.m. in the called person’s local time under federal rules, and some states are stricter: Florida ends at 8 p.m. Pick a state or type a number to see the local time there and whether a call is allowed now, then check every state at a glance.")}
      tool={<CallingHoursChecker />}
      toolIcon="calendar"
      faqs={FAQS}
      related={[{ href: "/tools/area-code-lookup", label: msg("AREA CODE LOOKUP") }, { href: "/faq/calling-hours", label: msg("CALLING HOURS EXPLAINED") }]}
      pitch={msg("DialerSeat enforces a narrower window than the law, 9 a.m. to 9 p.m. (8 p.m. in Florida) in each lead’s own time zone, on every call.")}
      embedHeight={820}
    />
  )
}
