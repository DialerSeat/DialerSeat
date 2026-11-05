import type { Metadata } from 'next'
import ToolPage, { toolMetadata } from '@/components/tools/ToolPage'
import { VoicemailScriptGenerator } from '@/components/tools/ScriptTools'
import { msg } from '@/lib/i18n/msg'

// /tools/sales-voicemail-script-generator: built from the spec in docs/seo (book ch 6, 7); demand
// checked in Google autocomplete on 2026-11-04. Layout: components/tools/ToolPage.

const ROUTE = '/tools/sales-voicemail-script-generator'

export const metadata: Metadata = toolMetadata({
  route: ROUTE,
  title: "Sales Voicemail Script Generator: 3 Under 30 Seconds",
  description: "Three sales voicemail scripts under 30 seconds each: the first touch, a follow-up and the last message, written for your industry.",
  social: "Sales voicemail script generator",
})

const FAQS = [
  { question: msg("How long should a sales voicemail be?"), answer: msg("Under 30 seconds, about 75 words at a normal pace. Long enough for who you are, why you called and your number, twice.") },
  { question: msg("How many voicemails should I leave?"), answer: msg("Three is plenty: a first touch, a follow-up a few days later, and a last message. More starts to feel like pressure.") },
  { question: msg("Should I say my number twice?"), answer: msg("Yes, slowly, once in the middle and once at the end. Most people listening are not holding a pen.") },
]

export default function Page() {
  return (
    <ToolPage
      route={ROUTE}
      name={msg("Sales voicemail script generator")}
      eyebrow={msg("▸ FREE TOOL · SALES VOICEMAIL SCRIPTS")}
      h1={msg("Voicemails that")}
      h1Second={msg("get a call back.")}
      answer={msg("Pick your industry and enter your name, company and callback number to get three sales voicemails, each under 30 seconds: a first touch, a follow-up and a final message. Each shows its word count and speaking time, says your number twice, and stays short enough that people listen to the end.")}
      tool={<VoicemailScriptGenerator />}
      toolIcon="chat"
      faqs={FAQS}
      related={[{ href: "/tools/cold-call-script-generator", label: msg("COLD CALL SCRIPTS") }, { href: "/faq/how-does-amd-work", label: msg("ANSWERING MACHINE DETECTION") }]}
      pitch={msg("DialerSeat’s answering machine detection routes machines away from your agents, so their time goes to people. $35 a week per seat.")}
      embedHeight={900}
    />
  )
}
