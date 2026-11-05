import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { ColdCallScriptGenerator } from '@/components/tools/ScriptTools'
import { msg } from '@/lib/i18n/msg'

// /tools/cold-call-script-generator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/cold-call-script-generator'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "Cold Call Script Generator: Openers & Rebuttals",
  description: "Generate a cold calling script for real estate, insurance, mortgage, solar, B2B or recruiting: opener, questions, a close and objection rebuttals.",
  social: "Cold call script generator",
})

const FAQS = [
  { question: msg("What makes a good cold call opener?"), answer: msg("Who you are, why you are calling them specifically, and a quick ask for permission to continue, in under fifteen seconds.") },
  { question: msg("How do I handle \"I’m not interested\"?"), answer: msg("Acknowledge it, then ask one honest question about why: cost, timing, or already covered. The answer tells you whether to call back.") },
  { question: msg("What if they ask not to be called again?"), answer: msg("Agree, end the call politely, and add them to your do-not-call list before the next dial. The law requires honoring it.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Cold call script generator")}
      eyebrow={msg("▸ FREE TOOL · COLD CALL SCRIPT GENERATOR")}
      h1={msg("A cold call script")}
      h1Second={msg("for your industry.")}
      answer={msg("Pick your industry and fill in your name, company and market to get a full cold call script: an opener, the reason for the call, three questions, an appointment close and rebuttals for the objections that actually come up in your industry. It also covers what to say when someone asks how you got their number, or asks not to be called.")}
      tool={<ColdCallScriptGenerator />}
      toolIcon="chat"
      faqs={FAQS}
      related={[{ href: "/tools/sales-voicemail-script-generator", label: msg("VOICEMAIL SCRIPTS") }, { href: "/faq/scripts", label: msg("SCRIPTS IN DIALERSEAT") }]}
      pitch={msg("In DialerSeat you can attach several scripts to a campaign and switch between them mid-call. $35 a week per seat.")}
      embedHeight={1000}
    />
  )
}
