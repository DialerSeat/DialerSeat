import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'

// =============================================================================
// /faq/dialer-for-insurance-agents
// =============================================================================
// SEARCH INTENT: "dialer for insurance agents", "insurance auto dialer",
// "medicare dialer", "final expense dialer". High commercial intent, and the
// vertical that buys dialers most.
//
// WHAT IS CLAIMED, and where it comes from:
//   $35 / seat / week, weekly     lib/canonicalFacts pricing
//   all four modes included       same
//   windows per LEAD state        same, and lib/tcpaHours
//   abandon cap enforced          lib/dialerPacing
//   local presence default        claim_pool_number; see the local presence page
//   recordings, per campaign      canonicalFacts features
//   lead drip needs Manager+      the Teams campaign page is the only switch
//   DNC scrubbing is yours        canonicalFacts compliance, said plainly
//
// WHAT IS DELIBERATELY NOT CLAIMED:
//   - Any close rate, contact rate or ROI figure for insurance. We have no
//     vertical data and inventing one would poison every real number we publish.
//   - A CMS recording-retention period. The requirement exists for Medicare
//     TPMOs, the length is CMS's to state, and it was under revision in the
//     CY2027 rulemaking — which Federal Register would not serve to a fetch, so
//     it is not quoted. The page tells the reader to keep their own copies and
//     sends them to CMS, which is useful and cannot go stale.
//   - A retention window of our own. Recording expiry is an open item; saying
//     nothing beats saying a number that is not enforced yet.
//   - Any carrier, CRM or quoting-tool integration by name. Lead drip is a
//     webhook; that is what it can honestly be described as.
// =============================================================================

const ROUTE = '/faq/dialer-for-insurance-agents'

export const metadata: Metadata = {
  title: 'Dialer for Insurance Agents: Medicare, Final Expense, P&C | DialerSeat',
  description:
    'What an insurance agent needs from a dialer: calling windows enforced per lead state, local caller ID, recordings you can download, four dialing modes, and $35 per seat per week with no contract.',
  keywords: [
    'dialer for insurance agents',
    'insurance auto dialer',
    'medicare dialer',
    'final expense dialer',
    'insurance predictive dialer',
    'best dialer for insurance sales',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Dialer for Insurance Agents',
    description:
      'Calling windows per lead state, local caller ID, recordings you can download. $35 per seat per week.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dialer for Insurance Agents',
    description: 'Calling windows per lead state, local caller ID, recordings you can download. $35 per seat per week.',
  },
}

const FAQS = [
  {
    question: 'What is the best dialer for insurance agents?',
    answer:
      'The one that fits how you sell. A final expense or Medicare agent working aged or shared leads needs volume, so power or predictive dialing and local caller ID matter most. An agent working referrals and quote requests needs preview dialing and good notes. DialerSeat includes all four modes at $35 per seat per week, so you are not paying for a tier to change how you dial.',
  },
  {
    question: 'How much does an insurance dialer cost?',
    answer:
      'DialerSeat is $35 per seat per week, billed weekly, with no contract, no setup fee and no seat minimum. Carrier usage is charged separately as you dial. Most dialers aimed at insurance agencies are sold per seat per month on an annual commitment, often with local presence and recording as paid add-ons.',
  },
  {
    question: 'Can I run a predictive dialer for insurance calls legally?',
    answer:
      'Yes, within the federal rules on abandoned calls, calling hours and consent. DialerSeat enforces the abandon-rate cap per campaign and the calling window per lead, but scrubbing the National Do Not Call Registry and keeping consent records for your leads stay your responsibility.',
  },
  {
    question: 'Are calls recorded, and can I keep the recordings?',
    answer:
      'Recording can be switched on per campaign, and recordings can be played back and downloaded. If a rule that applies to you requires calls to be retained for a set number of years, download and keep your own copies rather than relying on any platform’s storage.',
  },
  {
    question: 'I am licensed in several states. Does the dialer handle calling hours?',
    answer:
      'Yes. Calling windows are enforced server-side against each lead’s own state, not your location, so an agent in one time zone cannot dial a lead in another outside that lead’s legal hours. States with stricter rules than the federal window are enforced at the stricter rule.',
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'FAQ', url: '/faq' },
          { name: 'Dialer for insurance agents', url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ INSURANCE</div>
            <h1>
              A dialer for agents
              <span className="second">who live on the phone.</span>
            </h1>
            <p>
              Medicare, final expense, ACA, life, P&amp;C: different products, same day. A list, a
              licence in several states, and however many conversations you can get before the day
              runs out. Here is what actually matters in a dialer, and what DialerSeat does about
              each one.
            </p>
          </div>
        </GutsSection>

        <GutsSection icon="calendar" title="Calling hours, when you are licensed in several states">
          <p>
            Selling in six states means six sets of calling hours, and the rule follows the person
            you are calling, not you. Getting it wrong is the easiest violation on the list to commit
            by accident.
          </p>
          <p>
            DialerSeat enforces the window on the server against each lead’s own state. An agent
            working late in one time zone cannot dial into a state where it is already too late, and
            states stricter than the federal 8 a.m. to 9 p.m. window are held to their own rule.
          </p>
          <div className="guts-btns">
            <Link href="/faq/calling-hours" className="guts-btn secondary">CALLING HOURS BY STATE</Link>
          </div>
        </GutsSection>

        <GutsSection icon="phone" title="Aged and shared leads need a local number">
          <p>
            If you buy shared or aged leads, the person you are calling has heard from other agents
            already, and an unfamiliar out-of-state number is the easiest one to ignore.
          </p>
          <p>
            Every DialerSeat call goes out from a number matched to the prospect: their area code
            first, then their state, then their region. It is on by default, on every plan, in every
            dialing mode, and there is no add-on fee for it. Calls spread across the pool so no single
            number gets hammered into a Spam Likely label.
          </p>
          <div className="guts-btns">
            <Link href="/faq/local-presence-dialing" className="guts-btn secondary">
              HOW THE NUMBER IS PICKED
            </Link>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title="All four modes, because a Medicare day is not a referral day">
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">FRESH INBOUND, REFERRALS</div>
              <h3>Preview</h3>
              <p>
                You read the lead first and start the call yourself. Worth the slower pace when the
                lead cost real money.
              </p>
            </div>
            <div className="guts-panel">
              <div className="role">A LIST TO GET THROUGH</div>
              <h3>Power or progressive</h3>
              <p>One call at a time, dialed the moment the last one ends. No dead air to fill.</p>
            </div>
            <div className="guts-panel">
              <div className="role">AGED OR SHARED LISTS</div>
              <h3>Predictive</h3>
              <p>
                Several lines per agent, the first person who answers reaches you. The most
                conversations per hour, and the mode the abandon rules apply to.
              </p>
            </div>
            <div className="guts-panel">
              <div className="role">NOT A TIER</div>
              <h3>All included</h3>
              <p>
                Pick the mode per campaign. You are not upgrading a plan to change how you dial.
              </p>
            </div>
          </div>
        </GutsSection>

        <GutsSection icon="shield" title="The compliance part, said honestly">
          <ul className="guts-list good">
            <li>
              <strong>Abandoned calls.</strong> Predictive campaigns are held under the federal 3%
              limit automatically, with a drop to one line per agent before the limit is reached.{' '}
              <Link href="/faq/is-a-predictive-dialer-legal">How that works</Link>.
            </li>
            <li>
              <strong>Calling windows.</strong> Enforced per lead, on the server.
            </li>
            <li>
              <strong>Opt-outs.</strong> Pressing 9 on the abandoned-call message blocks that number
              across your account. A text saying STOP blocks it platform-wide.
            </li>
            <li>
              <strong>A per-call export.</strong> Every call, with its AMD result, abandon flag and
              disposition, for any date range.{' '}
              <Link href="/faq/compliance-export">Compliance export</Link>.
            </li>
          </ul>
          <ul className="guts-list warn">
            <li>
              <strong>Do Not Call scrubbing is yours.</strong> Registry access is granted to your
              organization, so we cannot do it for you.{' '}
              <Link href="/faq/how-to-scrub-the-do-not-call-registry">How to scrub your list</Link>.
            </li>
            <li>
              <strong>Consent records are yours.</strong> Whether you may call a lead at all depends
              on how you got it. If your lead source sends consent details, in a CSV column or through lead drip, DialerSeat stores them
              with the lead.
            </li>
            <li>
              <strong>Product rules are yours.</strong> Medicare sales in particular carry CMS
              requirements on recording and retention that sit on top of the telemarketing rules. Keep
              your own copies of recordings, and check the current requirement with{' '}
              <a href="https://www.cms.gov" target="_blank" rel="noopener noreferrer">
                CMS
              </a>{' '}
              rather than assuming a platform covers it.
            </li>
          </ul>
        </GutsSection>

        <GutsSection icon="chat" title="Scripts and notes that survive the call">
          <p>
            A Medicare pitch and a final expense pitch are different conversations, and an agent
            switching between them mid-day should not be switching campaigns to find the right words.
            Campaigns carry multiple scripts, reorderable, switchable mid-call, and notes and
            dispositions stay with the lead across sessions and across seats.
          </p>
        </GutsSection>

        <GutsSection icon="team" title="If you run a downline">
          <p>
            Agencies and IMOs can put each agent on their own seat under one owner, at the same $35 a
            week, with per-agent call history and activity visible to the owner. Manager+ at $75 a
            week adds team ownership, white-labeling under your own brand, and lead drip, which sends
            new leads from your CRM straight into a running campaign.
          </p>
          <div className="guts-btns">
            <Link href="/faq/teams-how-it-works" className="guts-btn secondary">HOW TEAMS WORK</Link>
            <Link href="/faq/send-leads-from-your-crm" className="guts-btn secondary">
              SENDING LEADS FROM A CRM
            </Link>
          </div>
        </GutsSection>

        <GutsSection icon="price" title="What it costs">
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">PRO</div>
              <h3>$35 per seat, per week</h3>
              <p>
                All four modes, local presence, recording, compliance export. Billed weekly, no
                contract, no setup fee, no seat minimum. Carrier usage is charged as you dial.
              </p>
            </div>
            <div className="guts-panel">
              <div className="role">MANAGER+</div>
              <h3>$75 per week</h3>
              <p>Replaces Pro for the owner and adds teams, white-labeling and lead drip.</p>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            Weekly billing is the part that matters during a selling season. You add a seat when you
            need one and stop paying for it the week you do not, without renegotiating an annual
            contract written in July.
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/faq/why-we-charge" className="guts-btn secondary">WHY WE CHARGE THIS</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
