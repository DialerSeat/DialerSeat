import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { DncCostCalculator } from '@/components/tools/MathTools'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/dnc-registry-cost-calculator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/dnc-registry-cost-calculator'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Do Not Call Registry Cost Calculator"),
  description: msg("What the National Do Not Call Registry costs for the area codes you call: first five free, then $85 each from October 2026, capped at $23,425."),
  social: msg("Do Not Call registry cost calculator"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("How much does the Do Not Call Registry cost?"), answer: msg("The first five area codes are free. From 1 October 2026, each additional area code is $85, and the total is capped at $23,425 for every area code in the country.") },
  { question: msg("How often do I have to scrub against it?"), answer: msg("Use a copy no more than 31 days old on the day you call. That is the Telemarketing Sales Rule’s safe harbor, so a list you keep dialing needs re-scrubbing at least monthly.") },
  { question: msg("Can I call numbers on the registry?"), answer: msg("Only with the person’s express written agreement to be called by you, or an established business relationship with them.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Do Not Call registry cost calculator")}
      eyebrow={msg("▸ FREE TOOL · DO NOT CALL REGISTRY COST")}
      h1={msg("What will the registry")}
      h1Second={msg("cost you?")}
      answer={msg("Enter how many area codes you call, or paste your numbers and the area codes are counted for you. The National Do Not Call Registry gives the first five area codes free; from 1 October 2026 each one after that costs $85, and access to every area code is capped at $23,425.")}
      tool={<DncCostCalculator />}
      toolIcon="price"
      faqs={FAQS}
      related={[{ href: "/faq/how-to-scrub-the-do-not-call-registry", label: msg("HOW TO SCRUB THE REGISTRY") }, { href: "/tools/tcpa-compliance-checklist", label: msg("TCPA CHECKLIST") }]}
      pitch={msg("Scrubbed list ready? DialerSeat dials it at $35 a week per seat, in each lead’s calling window.")}
      embedHeight={560}
    />
  )
}
