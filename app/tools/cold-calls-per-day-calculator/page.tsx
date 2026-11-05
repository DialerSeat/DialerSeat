import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { ColdCallsPerDayCalculator } from '@/components/tools/MathTools'
import { msg } from '@/lib/i18n/msg'

// /tools/cold-calls-per-day-calculator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/cold-calls-per-day-calculator'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "How Many Cold Calls per Day? Calculator",
  description: "Work back from your sales goal to the cold calls you need each day, using your own close, booking and contact rates. How many calls make a sale?",
  social: "How many cold calls per day do you need?",
})

const FAQS = [
  { question: msg("How many cold calls should I make per day?"), answer: msg("Enough to hit your goal at your own rates, which is what this works out. There is no universal number, because a change in contact rate or booking rate moves the answer a long way.") },
  { question: msg("How many calls does it take to make a sale?"), answer: msg("Sales goal back through close rate, booking rate and contact rate. The result here shows dials per sale for your numbers.") },
  { question: msg("Where do I get my rates?"), answer: msg("From last month: appointments that closed, conversations that booked, and dials that reached the person. The defaults are placeholders, not benchmarks.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("How many cold calls per day do you need?")}
      eyebrow={msg("▸ FREE TOOL · COLD CALLS PER DAY")}
      h1={msg("How many calls")}
      h1Second={msg("to hit your number?")}
      answer={msg("Start from the sales you want this month and work backwards: sales divided by your close rate gives appointments, appointments divided by your booking rate gives conversations, and conversations divided by your contact rate gives dials. Spread over your calling days, that is how many cold calls you need each day.")}
      tool={<ColdCallsPerDayCalculator />}
      toolIcon="calendar"
      faqs={FAQS}
      related={[{ href: "/tools/calls-per-hour-calculator", label: msg("CALLS PER HOUR") }, { href: "/tools/cold-calling-tracker", label: msg("COLD CALLING TRACKER") }]}
      pitch={msg("More dials in the same day is what a dialer is for. DialerSeat is $35 a week per seat.")}
      embedHeight={520}
    />
  )
}
