import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { ColdCallingTracker } from '@/components/tools/TrackerAndChecklist'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/cold-calling-tracker: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/cold-calling-tracker'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Cold Calling Tracker: Free, No Signup, Export to CSV"),
  description: msg("Log cold calls, outcomes, notes and follow-ups in your browser, see your connect and booking rates, and export a CSV or a blank tracker template."),
  social: msg("Free cold calling tracker"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("Where is my data saved?"), answer: msg("In your browser on this device, nowhere else. Nothing is uploaded, so clearing your browser’s site data deletes it. Export a CSV to keep a copy.") },
  { question: msg("Can I use it in Excel or Google Sheets?"), answer: msg("Yes. Export your calls as a CSV, or download the blank template and track there instead.") },
  { question: msg("What should I track on a cold call?"), answer: msg("At least the outcome, a note on what was said, and when to follow up. Those three are what turn a day of dialing into next week’s appointments.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Free cold calling tracker")}
      eyebrow={msg("▸ FREE TOOL · COLD CALLING TRACKER")}
      h1={msg("Cold calling tracker:")}
      h1Second={msg("every call, no spreadsheet.")}
      answer={msg("Log each call with the person’s name, number, outcome, notes and a follow-up date, and the tracker keeps score: calls made, how many reached a person, appointments booked and follow-ups due today. Everything is saved in this browser only. Export to CSV whenever you like, or download a blank template for Excel or Google Sheets.")}
      tool={<ColdCallingTracker />}
      toolIcon="table"
      faqs={FAQS}
      related={[{ href: "/tools/cold-calls-per-day-calculator", label: msg("COLD CALLS PER DAY") }, { href: "/tools/cold-call-script-generator", label: msg("SCRIPT GENERATOR") }]}
      pitch={msg("A dialer logs all of this for you as you call. DialerSeat does it at $35 a week per seat.")}
      embedHeight={900}
    />
  )
}
