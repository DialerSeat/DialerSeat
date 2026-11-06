import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import PhoneNumberExtractor from '@/components/tools/PhoneNumberExtractor'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

// /tools/phone-number-extractor: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/phone-number-extractor'

const baseMetadata: Metadata = toolMetadata({
  route: ROUTE,
  title: msg("Phone Number Extractor: Pull Numbers From Any Text"),
  description: msg("Paste emails, notes or a web page and extract every US and Canadian phone number, formatted, de-duplicated and checked. Free, runs in your browser."),
  social: msg("Extract phone numbers from text"),
})

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  { question: msg("What formats does it find?"), answer: msg("(312) 555-0147, 312.555.0147, 312-555-0147, +1 312 555 0147 and ten digits in a row. Extensions after the number are ignored.") },
  { question: msg("Will it pick up order or card numbers?"), answer: msg("No. Digits that sit inside a longer run of digits are left alone, so an order number that happens to contain ten digits is not mistaken for a phone number.") },
  { question: msg("Does it work for international numbers?"), answer: msg("It finds North American numbers only (US, Canada and the Caribbean). International formats vary too much to extract reliably from free text.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Extract phone numbers from text")}
      eyebrow={msg("▸ FREE TOOL · PHONE NUMBER EXTRACTOR")}
      h1={msg("Pull every number")}
      h1Second={msg("out of any text.")}
      answer={msg("Paste any block of text, an email thread, meeting notes, a copied web page, and this pulls out every US and Canadian phone number in it, whatever the formatting. Duplicates are merged, each number is checked, and you can copy the list or download a CSV. Nothing you paste leaves your browser.")}
      tool={<PhoneNumberExtractor />}
      toolIcon="phone"
      faqs={FAQS}
      related={[{ href: "/tools/phone-number-formatter", label: msg("PHONE NUMBER FORMATTER") }, { href: "/tools/lead-list-cleaner", label: msg("LEAD LIST CLEANER") }]}
      pitch={msg("Got a list? DialerSeat dials it at $35 a week per seat, with every dialing mode included.")}
      embedHeight={700}
    />
  )
}
