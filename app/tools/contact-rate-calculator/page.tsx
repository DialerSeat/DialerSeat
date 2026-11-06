import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { ContactRateCalculator } from '@/components/tools/MathTools'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/contact-rate-calculator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/contact-rate-calculator'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Answer, Connect & Contact Rate Calculator"),
  description: msg("Calculate answer rate, connect rate and contact rate the right way: over dials that actually rang, so failed dials aren’t blamed on your list."),
  social: msg("Answer, connect and contact rate calculator"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("What is the difference between answer, connect and contact rate?"), answer: msg("Answer rate counts any pickup. Connect rate means different things at different vendors, often the same as answer rate, so here it counts pickups by a person. Contact rate counts calls that produced a real outcome with the person, rather than just being answered.") },
  { question: msg("Why divide by dials that rang?"), answer: msg("A dial that fails before it reaches a phone gave nobody a chance to answer. Leaving it out of the rate stops a carrier or technical problem looking like a bad list.") },
  { question: msg("What is a good contact rate for cold calling?"), answer: msg("It varies by list and industry, so measure your own and compare month to month rather than against someone else’s average.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Answer, connect and contact rate calculator")}
      eyebrow={msg("▸ FREE TOOL · CONTACT RATE CALCULATOR")}
      h1={msg("Contact rate calculator:")}
      h1Second={msg("answer, connect, contact.")}
      answer={msg("Enter your dials, the dials that rang, answers, live connects and calls with a real outcome to get answer rate, connect rate and contact rate. Each is divided by dials that actually rang, not every dial, so a technical failure is never counted against your list, while failed dials still show in your totals.")}
      tool={<ContactRateCalculator />}
      toolIcon="scale"
      faqs={FAQS}
      related={[{ href: "/faq/how-we-measure-answer-rate", label: msg("HOW WE MEASURE IT") }, { href: "/data/connect-rates", label: msg("CONNECT RATES BY STATE & HOUR") }]}
      pitch={msg("DialerSeat divides by dials that rang in the same way, and its contact rate counts calls the agent marked closed, appointment, not interested or do not call.")}
      embedHeight={560}
    />
  )
}
