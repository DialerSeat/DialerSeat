import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'

// =============================================================================
// /faq/send-leads-from-your-crm — lead drip
// =============================================================================
// Every behaviour described is read from the code that runs:
//
//   one object, an array, or     app/api/ingest/leads/[token] extractLeads, and
//     {"leads":[...]}              the error text it returns when neither is sent
//   500 per request              MAX_BATCH
//   accepted / duplicates /      the counts every response carries, plus the
//     rejected, live or paused     first 20 rejections with a reason and a note
//                                  saying whether the campaign is live; the
//                                  per-request log (lead_ingest_events) also
//                                  keeps "received"
//   duplicates                   a phone already on THIS campaign, or repeated
//                                  inside the same payload
//   10-digit US number           the only thing a lead must have
//   consent fields               consent_date / consent_source /
//                                  consent_description aliases, kept when sent
//   field-name aliases           lib/leadIngest ALIASES
//   one level of nesting         lib/leadIngest normaliseLead, which is how
//                                  HubSpot's properties.* arrives flat
//   unknown fields kept          extra_data, never discarded
//   token generated, rotatable   app/api/teams/campaigns/ingest
//   wrong or revoked URL -> 404  identical on purpose, so it cannot be probed
//
// WHO GETS IT. The only screen that switches lead drip on is the Teams campaign
// page (components/teams/CampaignDetail), which comes with Manager+. The page
// says so up front rather than letting a Pro user go looking for a setting
// they do not have.
// =============================================================================

const ROUTE = '/faq/send-leads-from-your-crm'

export const metadata: Metadata = {
  title: 'Send Leads Into DialerSeat From GoHighLevel, HubSpot or Any Form | DialerSeat',
  description:
    'Lead drip gives a campaign its own webhook URL. Point GoHighLevel, HubSpot, Zapier, a Google Sheet or your own form at it and new leads land in the running dial queue, whatever your CRM calls its fields.',
  keywords: [
    'send leads to dialer webhook',
    'gohighlevel dialer integration',
    'hubspot dialer integration',
    'zapier dialer',
    'auto dialer webhook',
    'push leads to dialer',
  ],
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'Send Leads Into DialerSeat From Your CRM',
    description:
      'One webhook URL per campaign. Any CRM, any form, whatever it calls its fields.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Send Leads Into DialerSeat From Your CRM',
    description: 'One webhook URL per campaign. Any CRM, any form, whatever it calls its fields.',
  },
}

const FAQS = [
  {
    question: 'Can I send leads into DialerSeat automatically from my CRM?',
    answer:
      'Yes, with lead drip. It gives a team campaign its own webhook URL, and any tool that can send a web request, such as GoHighLevel, HubSpot, Zapier or a Google Sheet, can post new leads to it. They land in the campaign’s queue, and agents already dialing that campaign reach them without restarting. Lead drip is switched on from the campaign’s page in Teams, which comes with Manager+.',
  },
  {
    question: 'What format does the DialerSeat webhook accept?',
    answer:
      'JSON, sent with Content-Type: application/json. You can send one lead as an object, several as an array, or wrap them as {"leads": [...]}, up to 500 per request. Field names do not have to match ours: phone, phone_number, mobile or cell all work, and fields nested one level deep, like HubSpot’s properties, are read as if they were flat.',
  },
  {
    question: 'What happens to fields DialerSeat does not recognise?',
    answer:
      'They are kept with the lead rather than thrown away. A field nobody anticipated is often the one an agent needs during the call.',
  },
  {
    question: 'How do I know if my leads arrived?',
    answer:
      'Every response says how many leads were accepted, how many were skipped because that number was already on the campaign, and how many were rejected and why. It also says whether the campaign is live or paused. Every request is logged too, so you can read it back later from the campaign.',
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
          { name: 'Send leads from your CRM', url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">▸ LEADS</div>
            <h1>
              One URL per campaign.
              <span className="second">Any CRM can use it.</span>
            </h1>
            <p>
              Lead drip gives a campaign its own webhook address. Point your CRM, your forms or your
              automations at it, and new leads land straight in the dial queue, even while your team
              is mid-session.
            </p>
          </div>
        </GutsSection>

        <GutsSection icon="info" title="Why a webhook instead of an integration">
          <p>
            A separate connector for every CRM is a separate thing that breaks every time that CRM
            changes something. A web address that accepts JSON works with every tool that can send a
            web request, which is nearly all of them.
          </p>
          <div className="guts-grid-3">
            <div className="guts-panel"><h3>GoHighLevel</h3><p>A workflow webhook action.</p></div>
            <div className="guts-panel"><h3>HubSpot</h3><p>A workflow webhook.</p></div>
            <div className="guts-panel"><h3>Zapier or Make</h3><p>A webhook step.</p></div>
            <div className="guts-panel"><h3>Google Sheets</h3><p>A short Apps Script.</p></div>
            <div className="guts-panel"><h3>Your own forms</h3><p>One request from your code.</p></div>
            <div className="guts-panel"><h3>Lead vendors</h3><p>Anyone who can post leads to a URL.</p></div>
          </div>
        </GutsSection>

        <GutsSection icon="list" title="What to send">
          <p>
            JSON, with <code>Content-Type: application/json</code>, in whichever of these shapes your
            tool finds easiest:
          </p>
          <ul className="guts-list good">
            <li>one lead as a single object</li>
            <li>several leads as an array</li>
            <li>
              several leads wrapped as <code>{'{"leads": [ ... ]}'}</code>
            </li>
          </ul>
          <p>
            Up to <strong>500 leads per request</strong>. Send more in several requests.
          </p>
          <p>
            The only thing each lead must have is a <strong>10-digit US phone number</strong>. Names,
            email, address and anything else are optional. If your form records consent, send it too:
            fields such as <code>consent_date</code>, <code>opt_in_source</code> or{' '}
            <code>tcpa_language</code> are kept with the lead as its consent record.
          </p>
        </GutsSection>

        <GutsSection icon="swap" title="Your field names, not ours">
          <p>
            No CRM uses the same field names, and rejecting a lead because it said “Phone Number”
            instead of “phone” is the most common way these setups fail. So lead drip reads what
            people actually send.
          </p>
          <ul className="guts-list good">
            <li>
              <strong>Phone</strong> can arrive as phone, phone_number, mobile, cell, telephone,
              primary_phone and several other common names.
            </li>
            <li>
              <strong>Names</strong> can arrive as first_name or firstname, last_name or surname, and
              the other usual variations.
            </li>
            <li>
              <strong>Nested fields</strong> one level deep are read as if they were flat, which is
              how HubSpot’s <code>properties</code> arrive.
            </li>
            <li>
              <strong>Anything unrecognised is kept</strong> with the lead instead of thrown away. The
              field nobody anticipated is often the one an agent needs on the call.
            </li>
          </ul>
        </GutsSection>

        <GutsSection icon="check" title="You always know what happened">
          <p>
            A bare “error 400” tells a sender nothing about whether the field names were wrong, the
            numbers were unusable or the campaign was paused. So every response spells it out:
          </p>
          <ul className="guts-list good">
            <li>
              how many leads were <strong>accepted</strong>
            </li>
            <li>
              how many were <strong>skipped as duplicates</strong>, because that number is already on
              the campaign or appeared twice in the same request
            </li>
            <li>
              how many were <strong>rejected</strong>, with the reason
            </li>
            <li>
              whether the campaign is <strong>live</strong>, or <strong>paused</strong> so nothing will
              be dialed until it is switched back on
            </li>
          </ul>
          <p>
            Duplicates matter more than they look. CRM automations fire twice and sheets re-sync, and
            without the check the same person would be called twice. Every request is also logged, so
            you can read it back from the campaign later.
          </p>
        </GutsSection>

        <GutsSection icon="shield" title="Keeping the URL private">
          <ul className="guts-list good">
            <li>
              The address contains a long secret that DialerSeat generates. It is never one you
              choose, because a secret somebody picks is usually a weak one.
            </li>
            <li>
              If a URL leaks, generate a new one from the campaign page and the old one stops working.
            </li>
            <li>
              A wrong address and a revoked one get exactly the same response, so nobody can probe
              for a URL that used to work.
            </li>
          </ul>
        </GutsSection>

        <GutsSection icon="team" title="Where to find it">
          <p>
            Lead drip is switched on from a campaign’s page in <strong>Teams</strong>, which comes with{' '}
            <Link href="/faq/manager-plus">Manager+</Link>. Turn it on, copy the campaign’s URL into
            your CRM or automation, and send a test lead to see the response.
          </p>
          <p>
            Uploading a spreadsheet works on every plan. See{' '}
            <Link href="/faq/leads">uploading and managing leads</Link>.
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">GET STARTED →</Link>
            <Link href="/faq/manager-plus" className="guts-btn secondary">WHAT MANAGER+ ADDS</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
