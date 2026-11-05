import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DialerCostCalculator from '@/components/tools/DialerCostCalculator'
import AbandonRateCalculator from '@/components/tools/AbandonRateCalculator'
import LeadListCleaner from '@/components/tools/LeadListCleaner'
import PhoneNumberFormatter from '@/components/tools/PhoneNumberFormatter'
import PhoneNumberExtractor from '@/components/tools/PhoneNumberExtractor'
import AreaCodeLookup from '@/components/tools/AreaCodeLookup'
import CallingHoursChecker from '@/components/tools/CallingHoursChecker'
import { ErlangCCalculator, AhtCalculator, CallsPerHourCalculator, ContactRateCalculator, ColdCallsPerDayCalculator, CostPerLeadCalculator, DncCostCalculator } from '@/components/tools/MathTools'
import { ColdCallScriptGenerator, VoicemailScriptGenerator } from '@/components/tools/ScriptTools'
import { ColdCallingTracker, TcpaChecklist } from '@/components/tools/TrackerAndChecklist'
import StateDncTable from '@/components/tools/StateDncTable'

// =============================================================================
// /embed/<tool> — the calculators, framed on somebody else's page
// =============================================================================
// No site header, no rail, no footer: just the tool and one credit line that
// links back to the full page. The embed code on each tool page puts a second
// credit link in the host page's own HTML, under the iframe, and that one is
// the backlink; a link inside a frame counts for the frame, not the host.
//
// noindex, because this is the same tool as /tools/<tool> without the words
// around it, and the full page is the one that should rank. next.config.ts
// lets /embed/* be framed by any site; every other route stays SAMEORIGIN.
// =============================================================================

const TOOLS = {
  'dialer-cost-calculator': { title: 'Dialer cost calculator', Tool: DialerCostCalculator },
  'abandon-rate-calculator': { title: 'Abandon rate calculator', Tool: AbandonRateCalculator },
  'lead-list-cleaner': { title: 'Lead list cleaner', Tool: LeadListCleaner },
  'phone-number-formatter': { title: 'Phone number formatter', Tool: PhoneNumberFormatter },
  'phone-number-extractor': { title: 'Phone number extractor', Tool: PhoneNumberExtractor },
  'area-code-lookup': { title: 'Area code lookup', Tool: AreaCodeLookup },
  'telemarketing-calling-hours': { title: 'Telemarketing calling hours', Tool: CallingHoursChecker },
  'tcpa-compliance-checklist': { title: 'TCPA compliance checklist', Tool: TcpaChecklist },
  'state-do-not-call-lists': { title: 'State Do Not Call lists', Tool: StateDncTable },
  'dnc-registry-cost-calculator': { title: 'Do Not Call registry cost calculator', Tool: DncCostCalculator },
  'erlang-c-calculator': { title: 'Erlang C calculator', Tool: ErlangCCalculator },
  'average-handle-time-calculator': { title: 'Average handle time calculator', Tool: AhtCalculator },
  'calls-per-hour-calculator': { title: 'Calls per hour calculator', Tool: CallsPerHourCalculator },
  'contact-rate-calculator': { title: 'Contact rate calculator', Tool: ContactRateCalculator },
  'cold-calls-per-day-calculator': { title: 'Cold calls per day calculator', Tool: ColdCallsPerDayCalculator },
  'cost-per-lead-calculator': { title: 'Cost per lead calculator', Tool: CostPerLeadCalculator },
  'cold-call-script-generator': { title: 'Cold call script generator', Tool: ColdCallScriptGenerator },
  'sales-voicemail-script-generator': { title: 'Sales voicemail script generator', Tool: VoicemailScriptGenerator },
  'cold-calling-tracker': { title: 'Cold calling tracker', Tool: ColdCallingTracker },
} as const

type ToolSlug = keyof typeof TOOLS

export function generateStaticParams() {
  return Object.keys(TOOLS).map((tool) => ({ tool }))
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool } = await params
  const t = TOOLS[tool as ToolSlug]
  return {
    title: t ? `${t.title} | DialerSeat` : 'DialerSeat',
    robots: { index: false, follow: true },
    alternates: t ? { canonical: `https://dialerseat.com/tools/${tool}` } : undefined,
  }
}

export default async function EmbedPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const t = TOOLS[tool as ToolSlug]
  if (!t) notFound()
  const { Tool } = t

  return (
    <main style={{ background: '#fff', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <Tool />
      <p style={{ marginTop: 14, fontSize: 12, color: '#6b7182' }}>
        {t.title} by{' '}
        <a href={`https://dialerseat.com/tools/${tool}`} target="_blank" rel="noopener" style={{ color: '#2a6eff', fontWeight: 600 }}>
          DialerSeat
        </a>
      </p>
    </main>
  )
}
