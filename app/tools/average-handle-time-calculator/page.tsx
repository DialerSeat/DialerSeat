import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { AhtCalculator } from '@/components/tools/MathTools'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/average-handle-time-calculator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/average-handle-time-calculator'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Average Handle Time Calculator (AHT)"),
  description: msg("Calculate average handle time from talk, hold and after-call work, see what share each takes, and what a call costs in agent time."),
  social: msg("Average handle time calculator"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("How do you calculate average handle time?"), answer: msg("Add total talk time, hold time and after-call work, then divide by the number of calls handled. 600 minutes over 120 calls is an AHT of 5 minutes.") },
  { question: msg("What is a good AHT?"), answer: msg("It depends on the call. Shorter is not better if it means rushed conversations; hold time and wrap-up are the parts worth shrinking first.") },
  { question: msg("Is AHT the same as talk time?"), answer: msg("No. Talk time is only the conversation. AHT adds hold time and the work after the call, so it is always the larger number.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Average handle time calculator")}
      eyebrow={msg("▸ FREE TOOL · AVERAGE HANDLE TIME")}
      h1={msg("What is your")}
      h1Second={msg("average handle time?")}
      answer={msg("Average handle time is talk time plus hold time plus after-call work, divided by the calls handled. Enter your totals to get AHT in minutes and seconds, the share each part takes, how many calls an agent can handle an hour, and what each call costs in agent time.")}
      tool={<AhtCalculator />}
      toolIcon="scale"
      faqs={FAQS}
      related={[{ href: "/tools/erlang-c-calculator", label: msg("ERLANG C CALCULATOR") }, { href: "/tools/calls-per-hour-calculator", label: msg("CALLS PER HOUR") }]}
      pitch={msg("In DialerSeat, dispositions and notes stay on the lead across sessions and seats. $35 a week per seat.")}
      embedHeight={560}
    />
  )
}
