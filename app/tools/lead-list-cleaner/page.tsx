import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import LeadListCleaner from '@/components/tools/LeadListCleaner'
import { msg } from '@/lib/i18n/msg'

// /tools/lead-list-cleaner: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/lead-list-cleaner'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "Lead List Cleaner: Fix Any Lead Sheet for Your Dialer",
  description: "Fix a lead sheet in your browser: wrong headers, p:+1 phones, states typed every way, full names, ALL CAPS, duplicates. Download a clean CSV. Free.",
  social: "Lead list cleaner: any sheet, ready to dial",
})

const FAQS = [
  { question: msg("Why did my leads import without names?"), answer: msg("Usually the headers. An importer matches column names exactly, so \"FIRST NAME\" or \"Last name\" can be ignored even though the data is there. This cleaner renames columns to first_name, last_name, phone, email and state, which every import reads.") },
  { question: msg("What happens to the p:+1 in front of my phone numbers?"), answer: msg("It is removed. Facebook lead ads export phones as p:+15555550100; the cleaner keeps the 10 digits and drops the label and country code, so the number reads the same everywhere.") },
  { question: msg("My state column is a mess. What does it do?"), answer: msg("It reads full names, abbreviations, typos like m0 for MO, and states buried in an address, and turns each into a 2-letter code. When nothing readable is there, it can fill the state from the phone’s area code and tells you which rows it did that for.") },
  { question: msg("Is my lead list uploaded anywhere?"), answer: msg("No. The file is read and fixed inside your browser tab. Open your browser’s network tab while you use it and you will see no requests carrying your data.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Lead list cleaner")}
      eyebrow={msg("▸ FREE TOOL · LEAD LIST CLEANER")}
      h1={msg("Fix your lead sheet")}
      h1Second={msg("before you upload it.")}
      answer={msg("Open your lead sheet (CSV or Excel) and this cleaner checks what every column actually holds, not just what its header says. It reformats phone numbers to 10 digits, turns states into 2-letter codes, splits full names, fixes ALL CAPS, removes duplicates and lists rows that cannot be dialed. Download a clean CSV. The file never leaves your browser.")}
      tool={<LeadListCleaner />}
      toolIcon="list"
      faqs={FAQS}
      related={[{ href: "/tools/phone-number-formatter", label: msg("PHONE NUMBER FORMATTER") }, { href: "/faq/leads", label: msg("HOW LEAD UPLOAD WORKS") }]}
      pitch={msg("The output is the format DialerSeat imports, column for column. $35 a week per seat, every dialing mode included.")}
      embedHeight={900}
    />
  )
}
