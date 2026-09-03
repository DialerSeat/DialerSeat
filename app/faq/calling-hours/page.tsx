import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import JsonLd from '@/components/json-ld'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import DialingModeCTA from '@/components/DialingModeCTA'
import ExplainerStyles from '@/components/ExplainerStyles'
import ExplainerCrossLinks from '@/components/ExplainerCrossLinks'
import { STATE_TIMEZONES } from '@/lib/timezones'

export const metadata: Metadata = {
  title: 'Telemarketing Calling Hours by State: What DialerSeat Enforces | DialerSeat',
  description:
    'The federal TCPA window is 8am-9pm in the lead’s local time, not yours. DialerSeat enforces 9am-9pm per lead, server-side, using the timezone of the number being called. Which states are stricter, and what that means for your list.',
  alternates: { canonical: 'https://dialerseat.com/faq/calling-hours' },
  openGraph: {
    title: 'Telemarketing Calling Hours by State',
    description:
      'The window belongs to the lead, not the agent. What the federal rule says, which states go further, and what DialerSeat blocks automatically.',
    url: 'https://dialerseat.com/faq/calling-hours',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Telemarketing Calling Hours by State',
    description:
      'The federal window is 8am-9pm in the LEAD’s local time. DialerSeat enforces 9am-9pm per lead, server-side.',
  },
}

const FAQS = [
  {
    question: 'What are the legal calling hours for telemarketing?',
    answer:
      'The federal TCPA rule is 8:00am to 9:00pm in the time zone of the person being called, not the time zone of the caller. That distinction is the one most teams get wrong: an agent dialing at 6:30am Pacific is calling 9:30am Eastern, which is fine, but an agent dialing at 6:30pm Pacific is calling 9:30pm Eastern, which is not.',
  },
  {
    question: 'What hours does DialerSeat enforce?',
    answer:
      'DialerSeat enforces 9:00am to 9:00pm in each lead’s own local time. The 9am start is deliberately one hour stricter than the federal 8am, because answer rates before 9am are poor and the compliance risk is not worth the marginal contact. Enforcement is server-side and per lead, so it applies no matter which agent is dialing or where they are.',
  },
  {
    question: 'How does DialerSeat know what time zone a lead is in?',
    answer:
      'From the state column on the lead if there is one, and from the area code if there is not. If neither can establish a location, the lead is not dialed, the check fails closed rather than guessing. That is why a lead with an unrecognised area code and no state sits in the queue: it is not a bug, it is the calling-window check refusing to approve a call it cannot verify.',
  },
  {
    question: 'Do some states have stricter calling hours than the federal rule?',
    answer:
      'Yes. Florida and Maryland are commonly cited at 8am-8pm, Louisiana and Alabama restrict Sunday solicitation, Wisconsin bans Sunday telemarketing under its no-call statute, and Texas applies a narrower Sunday window. Several states have passed “mini-TCPA” laws since 2021 with their own hours, holiday and consent rules. DialerSeat does not currently enforce these state-specific variations automatically, it enforces the 9am-9pm baseline. Meeting stricter state law is your responsibility.',
  },
  {
    question: 'Can I turn the calling window off?',
    answer:
      'Not from the dashboard. The window is enforced server-side, which means it cannot be bypassed by a client-side change or by an agent choosing a different mode. An override exists at the account level for specific named accounts with a documented reason, and every overridden call is logged with the reason it would otherwise have been blocked.',
  },
  {
    question: 'What happens to a lead that is outside its window?',
    answer:
      'It stays in the queue and becomes dialable when its local window opens. Nothing is deleted and no attempt is recorded. The dialer tells you how many leads are waiting on the clock versus how many are blocked for a reason that waiting will not fix, so you can tell a quiet morning from a broken list.',
  },
]

// Grouped from the same map lib/callingWindow.ts consults at dial time, so this
// table cannot describe a timezone the product does not actually use. A
// hand-written table would be a second source of truth and would drift.
const BY_ZONE: Record<string, string[]> = {}
for (const [state, zone] of Object.entries(STATE_TIMEZONES)) {
  ;(BY_ZONE[zone] ||= []).push(state)
}

const ZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern',
  'America/Chicago': 'Central',
  'America/Denver': 'Mountain',
  'America/Phoenix': 'Mountain (no DST)',
  'America/Los_Angeles': 'Pacific',
  'America/Anchorage': 'Alaska',
  'Pacific/Honolulu': 'Hawaii (no DST)',
  'America/Boise': 'Mountain',
  'America/Indiana/Indianapolis': 'Eastern',
  'America/Puerto_Rico': 'Atlantic (no DST)',
  'America/St_Thomas': 'Atlantic (no DST)',
}

const STRICTER = [
  { state: 'Florida', rule: 'Commonly cited at 8:00am-8:00pm' },
  { state: 'Maryland', rule: 'Stop the Spam Calls Act: 8:00am-8:00pm' },
  { state: 'Alabama', rule: 'Sunday solicitation prohibited' },
  { state: 'Louisiana', rule: 'Sunday solicitation prohibited' },
  { state: 'Wisconsin', rule: 'Sunday telemarketing banned under the state no-call statute' },
  { state: 'Texas', rule: 'Narrower Sunday window, commonly reported as noon-9:00pm' },
]

export default function Page() {
  const zones = Object.entries(BY_ZONE).sort((a, b) => b[1].length - a[1].length)

  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: 'Home', url: '/' },
        { name: 'Faq', url: '/faq' },
        { name: 'Telemarketing Calling Hours by State', url: '/faq/calling-hours' },
      ])} />
      <JsonLd data={faqPageSchema(FAQS)} />
      <SiteHeader />
      <main className="exp-root">
        <ExplainerStyles accent="#2a4a8a" accentBg="#e8eef8" />

        <section className="exp-hero">
          <div className="exp-hero-inner">
            <div className="exp-eyebrow">REFERENCE · CALLING HOURS</div>
            <h1>What hours can you legally call a lead?</h1>
            <p className="exp-lead">
              The window belongs to the person you are calling, not to you. That
              single fact is where most calling-hour violations come from, and it
              is the reason enforcement has to happen per lead rather than per
              agent.
            </p>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ THE FEDERAL RULE</div>
          <h2>8:00am to 9:00pm, in the lead&apos;s time zone.</h2>
          <p>
            The TCPA sets the outer boundary at 8:00am-9:00pm <em>local to the
            called party</em>. Not local to the agent, not local to the company,
            not local to wherever the server is.
          </p>
          <p>
            The practical consequence catches teams out in both directions. An
            agent in California starting at 6:00am is calling 9:00am on the East
            Coast: legal, and often the best hour of their day. The same agent
            finishing at 6:15pm Pacific is calling 9:15pm Eastern, which is a
            violation, on a call that felt like the middle of the afternoon.
          </p>
          <p>
            A floor with agents in more than one time zone, or offshore, cannot
            solve this with a shift schedule. It has to be enforced against each
            individual lead.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ WHAT DIALERSEAT ENFORCES</div>
          <h2>9:00am to 9:00pm, per lead, server-side.</h2>
          <p>
            One hour stricter than the federal rule at the start of the day. That
            is deliberate: answer rates before 9:00am are poor enough that the
            hour is not worth much, and the margin removes any argument about
            whether a borderline call was inside the window.
          </p>
          <p>
            Enforcement lives on the server, in the same code path that places the
            call. There is no client-side check to disable, no mode that skips it,
            and no way for an agent to dial past it by choosing different settings.
            A lead outside its window is simply not handed to anyone.
          </p>
          <p>
            The time zone comes from the lead&apos;s state column when it has one,
            and from the area code when it does not. When neither resolves, the
            check <strong>fails closed</strong>, the lead is held rather than
            dialed. A system that guesses a time zone in order to place a call is
            not enforcing anything.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ TIME ZONE BY STATE</div>
          <h2>The map the dialer actually uses.</h2>
          <p>
            Generated from the same table the calling-window check reads at dial
            time, so it cannot describe behaviour the product does not have.
            Arizona and Hawaii do not observe daylight saving, which is why their
            offset relative to everyone else moves twice a year.
          </p>
          <div className="exp-table-wrap" style={{ overflowX: 'auto', margin: '24px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #2a4a8a', color: '#8888aa', fontSize: 11, letterSpacing: 2 }}>ZONE</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #2a4a8a', color: '#8888aa', fontSize: 11, letterSpacing: 2 }}>STATES &amp; TERRITORIES</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #2a4a8a', color: '#8888aa', fontSize: 11, letterSpacing: 2 }}>WINDOW</th>
                </tr>
              </thead>
              <tbody>
                {zones.map(([zone, states]) => (
                  <tr key={zone}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', whiteSpace: 'nowrap' }}>
                      {ZONE_LABELS[zone] ?? zone}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', color: '#c4c8d8' }}>
                      {states.sort().join(', ')}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', whiteSpace: 'nowrap', color: '#4ade80' }}>
                      9am-9pm local
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ STATES THAT GO FURTHER</div>
          <h2>Where the baseline is not enough.</h2>
          <p>
            A number of states impose rules stricter than the federal window, and
            more have added them since 2021 under so-called mini-TCPA statutes.
            The ones most consistently reported:
          </p>
          <div className="exp-table-wrap" style={{ overflowX: 'auto', margin: '24px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {STRICTER.map(r => (
                  <tr key={r.state}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                      {r.state}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #2a2a4a', color: '#c4c8d8' }}>
                      {r.rule}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{
            borderLeft: '2px solid #fbbf24',
            paddingLeft: 16,
            color: '#c4c8d8',
          }}>
            <strong>Read this part carefully.</strong> DialerSeat enforces the
            9am-9pm baseline. It does <em>not</em> currently apply these
            state-specific variations automatically, and this page is a starting
            point rather than legal advice: state statutes change, and the
            summaries above are drawn from secondary sources. If your list is
            concentrated in a stricter state, confirm the current rule with
            counsel and schedule around it. We would rather tell you that plainly
            than let you assume a protection the product does not provide.
          </p>
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ COMMON QUESTIONS</div>
          <h2>Calling hours, answered.</h2>
          {FAQS.map(f => (
            <div key={f.question} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>{f.question}</h3>
              <p style={{ margin: 0 }}>{f.answer}</p>
            </div>
          ))}
        </section>

        <section className="exp-section">
          <div className="exp-section-label">▸ RELATED</div>
          <h2>Compliance, in practice.</h2>
          <p>
            <Link href="/faq/how-we-keep-compliance">How DialerSeat keeps you compliant</Link>{' '}
            covers the rest of the enforcement surface: abandon-rate caps, DNC
            suppression and consent records.{' '}
            <Link href="/faq/dialer-for-offshore-agents">Dialing US leads from offshore</Link>{' '}
            covers the case where the agent&apos;s own clock is the furthest thing
            from the lead&apos;s.
          </p>
        </section>

        <DialingModeCTA
          headline="Stop worrying about what time it is where they are."
          description="DialerSeat checks every lead against its own local window before it dials, server-side. $35/week per seat, every dialer mode included."
        />
        <ExplainerCrossLinks current="calling-hours" />
      </main>
      <SiteFooter />
    </>
  )
}
