import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { ErlangCCalculator } from '@/components/tools/MathTools'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/erlang-c-calculator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/erlang-c-calculator'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Erlang C Calculator: Call Center Staffing"),
  description: msg("How many agents does your queue need? Enter calls, handle time and a service level target to get agents, scheduled staff, occupancy and speed of answer."),
  social: msg("Erlang C call center staffing calculator"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("What is Erlang C?"), answer: msg("A formula that predicts how long callers wait for a given number of agents, from call volume and handle time. Call centers use it to find the fewest agents that still hit a service level.") },
  { question: msg("What is a good service level?"), answer: msg("80% of calls answered within 20 seconds is the common target for inbound queues, but the right number is whatever your callers will tolerate before hanging up.") },
  { question: msg("What is shrinkage?"), answer: msg("Paid time an agent is not available for calls: breaks, training, meetings, absence. The 30% filled in here is a placeholder; use your own figure if you track it.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Erlang C call center staffing calculator")}
      eyebrow={msg("▸ FREE TOOL · ERLANG C STAFFING CALCULATOR")}
      h1={msg("How many agents")}
      h1Second={msg("does your queue need?")}
      answer={msg("Enter the calls you expect in an interval, the average handle time and your service level target, such as 80% answered within 20 seconds. The Erlang C formula gives the agents needed on the phones, the staff to schedule once shrinkage is counted, plus occupancy and average speed of answer.")}
      tool={<ErlangCCalculator />}
      toolIcon="team"
      faqs={FAQS}
      related={[{ href: "/tools/average-handle-time-calculator", label: msg("AHT CALCULATOR") }, { href: "/tools/calls-per-hour-calculator", label: msg("CALLS PER HOUR") }]}
      pitch={msg("Outbound floor instead of a queue? DialerSeat seats are $35 a week each, added or paused any week.")}
      embedHeight={640}
    />
  )
}
