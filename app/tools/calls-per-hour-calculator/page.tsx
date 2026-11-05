import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { CallsPerHourCalculator } from '@/components/tools/MathTools'
import { msg } from '@/lib/i18n/msg'

// /tools/calls-per-hour-calculator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/calls-per-hour-calculator'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "Calls Per Hour Calculator: Dials per Hour, 1 to 3 Lines",
  description: "Work out calls per hour from dials and hours, then see what two or three lines would do to dials and conversations per hour.",
  social: "Calls per hour calculator",
})

const FAQS = [
  { question: msg("How do you calculate calls per hour?"), answer: msg("Divide the dials made by the hours spent dialing. 240 dials in 4 hours is 60 calls per hour.") },
  { question: msg("How many calls per hour is good for cold calling?"), answer: msg("By hand on one line, 40 to 60 dials an hour is typical. With more lines, most of the waiting on unanswered calls disappears, so dials rise while conversations stay the agent’s limit.") },
  { question: msg("Why not just add more lines?"), answer: msg("Every extra line raises the chance two people answer at once. In the US no more than 3% of answered calls may be abandoned, which caps how far lines can go.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Calls per hour calculator")}
      eyebrow={msg("▸ FREE TOOL · CALLS PER HOUR")}
      h1={msg("How many calls")}
      h1Second={msg("an hour, really?")}
      answer={msg("Calls per hour is dials divided by hours spent dialing. Enter yours, then your answer rate, talk time and ring time to estimate dials and conversations per hour on one, two or three lines, and see how much of your hour goes to waiting on phones that never pick up.")}
      tool={<CallsPerHourCalculator />}
      toolIcon="phone"
      faqs={FAQS}
      related={[{ href: "/tools/contact-rate-calculator", label: msg("CONTACT RATE CALCULATOR") }, { href: "/faq/dialer-modes", label: msg("DIALER MODES") }]}
      pitch={msg("DialerSeat runs power, progressive and multi-line predictive at $35 a week per seat, holding predictive under the 3% limit for you.")}
      embedHeight={720}
    />
  )
}
