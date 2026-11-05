import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import PhoneNumberFormatter from '@/components/tools/PhoneNumberFormatter'
import { msg } from '@/lib/i18n/msg'

// /tools/phone-number-formatter: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/phone-number-formatter'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "Phone Number Formatter: E.164, Clean & Dedupe a List",
  description: "Format a list of US and Canadian phone numbers to E.164 or (555) 555-0100, remove duplicates and flag numbers that can’t be dialed. Free, in your browser.",
  social: "Phone number formatter and cleaner",
})

const FAQS = [
  { question: msg("What is E.164 format?"), answer: msg("The international standard for phone numbers: a plus sign, the country code and the number, with no spaces or punctuation. A US number in E.164 is +1 followed by its 10 digits, like +14155550132.") },
  { question: msg("Why is a number marked as impossible?"), answer: msg("North American area codes and exchanges never start with 0 or 1, and N11 codes like 411 are service numbers. A number breaking those rules cannot ring a phone, whatever it looks like.") },
  { question: msg("How do I remove duplicate phone numbers?"), answer: msg("Leave \"Remove duplicates\" on. Numbers are compared after formatting, so (415) 555-0132 and 415.555.0132 count as the same number.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Phone number formatter and cleaner")}
      eyebrow={msg("▸ FREE TOOL · PHONE NUMBER FORMATTER")}
      h1={msg("Clean a phone list")}
      h1Second={msg("in one paste.")}
      answer={msg("Paste a column of phone numbers or open a CSV, pick a format, and get a clean list back: E.164 (+14155550132), (415) 555-0132, dashes or plain digits. Duplicates are removed, and numbers that cannot be dialed are listed with the reason, using the same checks a dialer runs. It all happens in your browser.")}
      tool={<PhoneNumberFormatter />}
      toolIcon="phone"
      faqs={FAQS}
      related={[{ href: "/tools/lead-list-cleaner", label: msg("LEAD LIST CLEANER") }, { href: "/tools/phone-number-extractor", label: msg("PHONE NUMBER EXTRACTOR") }]}
      pitch={msg("These are the checks DialerSeat runs before it dials. $35 a week per seat.")}
      embedHeight={760}
    />
  )
}
