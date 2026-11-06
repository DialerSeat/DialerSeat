import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { CostPerLeadCalculator } from '@/components/tools/MathTools'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/cost-per-lead-calculator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/cost-per-lead-calculator'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Cost Per Lead Calculator: Per Lead, Appointment & Sale"),
  description: msg("Calculate cost per lead from spend and leads, plus cost per appointment, cost per sale and return on spend."),
  social: msg("Cost per lead calculator"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("How do you calculate cost per lead?"), answer: msg("Divide total spend by the number of leads. $1,500 for 300 leads is $5 a lead.") },
  { question: msg("Why look past cost per lead?"), answer: msg("Cheap leads that never answer cost more per sale than expensive ones that do. Cost per appointment and per sale show which source actually pays.") },
  { question: msg("What should I include in spend?"), answer: msg("At least what you paid for the leads. Adding the dialer and agent time shows the full cost of working them.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Cost per lead calculator")}
      eyebrow={msg("▸ FREE TOOL · COST PER LEAD")}
      h1={msg("Cost per lead calculator:")}
      h1Second={msg("what does a lead really cost?")}
      answer={msg("Cost per lead is total spend divided by the leads it bought. Add appointments and sales to see cost per appointment and cost per sale, and revenue per sale to see the return on what you spent. Count whatever spend matters to you: the leads, the dialer, ads or time.")}
      tool={<CostPerLeadCalculator />}
      toolIcon="price"
      faqs={FAQS}
      related={[{ href: "/tools/cold-calls-per-day-calculator", label: msg("COLD CALLS PER DAY") }, { href: "/tools/dialer-cost-calculator", label: msg("DIALER COST CALCULATOR") }]}
      pitch={msg("DialerSeat bills $35 a week per seat, so a week of dialing a lead batch costs a week, not a month.")}
      embedHeight={520}
    />
  )
}
