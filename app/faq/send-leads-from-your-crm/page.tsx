import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { faqRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'
import { localizeMetadata } from '@/lib/i18n/metadata'

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

const baseMetadata: Metadata = {
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

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("Can I send leads into DialerSeat automatically from my CRM?"),
    answer:
      msg("Yes, with lead drip. It gives a team campaign its own webhook URL, and any tool that can send a web request, such as GoHighLevel, HubSpot, Zapier or a Google Sheet, can post new leads to it. They land in the campaign’s queue, and agents already dialing that campaign reach them without restarting. Lead drip is switched on from the campaign’s page in Teams, which comes with Manager+."),
  },
  {
    question: msg("What format does the DialerSeat webhook accept?"),
    answer:
      'JSON, sent with Content-Type: application/json. You can send one lead as an object, several as an array, or wrap them as {"leads": [...]}, up to 500 per request. Field names do not have to match ours: phone, phone_number, mobile or cell all work, and fields nested one level deep, like HubSpot’s properties, are read as if they were flat.',
  },
  {
    question: msg("What happens to fields DialerSeat does not recognise?"),
    answer:
      msg("They are kept with the lead rather than thrown away. A field nobody anticipated is often the one an agent needs during the call."),
  },
  {
    question: msg("How do I know if my leads arrived?"),
    answer:
      msg("Every response says how many leads were accepted, how many were skipped because that number was already on the campaign, and how many were rejected and why. It also says whether the campaign is live or paused. Every request is logged too, so you can read it back later from the campaign."),
  },
]

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("FAQ"), url: '/faq' },
          { name: msg("Send leads from your CRM"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={faqRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ LEADS")}</div>
            <h1>
              {t("One URL per campaign.")}<span className="second">{t("Any CRM can use it.")}</span>
            </h1>
            <p>
              {t("Lead drip gives a campaign its own webhook address. Point your CRM, your forms or your automations at it, and new leads land straight in the dial queue, even while your team is mid-session.")}</p>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("Why a webhook instead of an integration")}>
          <p>
            {t("A separate connector for every CRM is a separate thing that breaks every time that CRM changes something. A web address that accepts JSON works with every tool that can send a web request, which is nearly all of them.")}</p>
          <div className="guts-grid-3">
            <div className="guts-panel"><h3>{t("GoHighLevel")}</h3><p>{t("A workflow webhook action.")}</p></div>
            <div className="guts-panel"><h3>{t("HubSpot")}</h3><p>{t("A workflow webhook.")}</p></div>
            <div className="guts-panel"><h3>{t("Zapier or Make")}</h3><p>{t("A webhook step.")}</p></div>
            <div className="guts-panel"><h3>{t("Google Sheets")}</h3><p>{t("A short Apps Script.")}</p></div>
            <div className="guts-panel"><h3>{t("Your own forms")}</h3><p>{t("One request from your code.")}</p></div>
            <div className="guts-panel"><h3>{t("Lead vendors")}</h3><p>{t("Anyone who can post leads to a URL.")}</p></div>
          </div>
        </GutsSection>

        <GutsSection icon="list" title={t("What to send")}>
          <p>
            {t("JSON, with")}{" "}<code>Content-Type: application/json</code>{t(", in whichever of these shapes your tool finds easiest:")}</p>
          <ul className="guts-list good">
            <li>{t("one lead as a single object")}</li>
            <li>{t("several leads as an array")}</li>
            <li>
              {t("several leads wrapped as")}{" "}<code>{'{"leads": [ ... ]}'}</code>
            </li>
          </ul>
          <p>
            {t("Up to")}{" "}<strong>{t("500 leads per request")}</strong>{t(". Send more in several requests.")}</p>
          <p>
            {t("The only thing each lead must have is a")}{" "}<strong>{t("10-digit US phone number")}</strong>{t(". Names, email, address and anything else are optional. If your form records consent, send it too: fields such as")}{" "}<code>consent_date</code>, <code>opt_in_source</code> {t("or")}{' '}
            <code>tcpa_language</code> {t("are kept with the lead as its consent record.")}</p>
        </GutsSection>

        <GutsSection icon="swap" title={t("Your field names, not ours")}>
          <p>
            {t("No CRM uses the same field names, and rejecting a lead because it said “Phone Number” instead of “phone” is the most common way these setups fail. So lead drip reads what people actually send.")}</p>
          <ul className="guts-list good">
            <li>
              <strong>{t("Phone")}</strong> {t("can arrive as phone, phone_number, mobile, cell, telephone, primary_phone and several other common names.")}</li>
            <li>
              <strong>{t("Names")}</strong> {t("can arrive as first_name or firstname, last_name or surname, and the other usual variations.")}</li>
            <li>
              <strong>{t("Nested fields")}</strong> {t("one level deep are read as if they were flat, which is how HubSpot’s")}{" "}<code>properties</code> {t("arrive.")}</li>
            <li>
              <strong>{t("Anything unrecognised is kept")}</strong> {t("with the lead instead of thrown away. The field nobody anticipated is often the one an agent needs on the call.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="check" title={t("You always know what happened")}>
          <p>
            {t("A bare “error 400” tells a sender nothing about whether the field names were wrong, the numbers were unusable or the campaign was paused. So every response spells it out:")}</p>
          <ul className="guts-list good">
            <li>
              {t("how many leads were")}{" "}<strong>{t("accepted")}</strong>
            </li>
            <li>
              {t("how many were")}{" "}<strong>{t("skipped as duplicates")}</strong>{t(", because that number is already on the campaign or appeared twice in the same request")}</li>
            <li>
              {t("how many were")}{" "}<strong>{t("rejected")}</strong>{t(", with the reason")}</li>
            <li>
              {t("whether the campaign is")}{" "}<strong>{t("live")}</strong>{t(", or")}{" "}<strong>{t("paused")}</strong> {t("so nothing will be dialed until it is switched back on")}</li>
          </ul>
          <p>
            {t("Duplicates matter more than they look. CRM automations fire twice and sheets re-sync, and without the check the same person would be called twice. Every request is also logged, so you can read it back from the campaign later.")}</p>
        </GutsSection>

        <GutsSection icon="shield" title={t("Keeping the URL private")}>
          <ul className="guts-list good">
            <li>
              {t("The address contains a long secret that DialerSeat generates. It is never one you choose, because a secret somebody picks is usually a weak one.")}</li>
            <li>
              {t("If a URL leaks, generate a new one from the campaign page and the old one stops working.")}</li>
            <li>
              {t("A wrong address and a revoked one get exactly the same response, so nobody can probe for a URL that used to work.")}</li>
          </ul>
        </GutsSection>

        <GutsSection icon="team" title={t("Where to find it")}>
          <p>
            {t("Lead drip is switched on from a campaign’s page in")}{" "}<strong>{t("Teams")}</strong>{t(", which comes with")}{' '}
            <Link href="/faq/manager-plus">{t("Manager+")}</Link>{t(". Turn it on, copy the campaign’s URL into your CRM or automation, and send a test lead to see the response.")}</p>
          <p>
            {t("Uploading a spreadsheet works on every plan. See")}{' '}
            <Link href="/faq/leads">{t("uploading and managing leads")}</Link>.
          </p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/faq/manager-plus" className="guts-btn secondary">{t("WHAT MANAGER+ ADDS")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
