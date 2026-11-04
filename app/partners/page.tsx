import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import PageStamp from '@/components/PageStamp'
import ShotSlideshow from '@/components/ShotSlideshow'
import { resourcesRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { PRODUCT_SHOTS, WHITE_LABEL_SHOTS } from '@/lib/screenshots'
import { pageDate } from '@/lib/pageDates'
import { localizeMetadata } from '@/lib/i18n/metadata'
import { primeLocale, t } from '@/lib/i18n/server'
import { msg } from '@/lib/i18n/msg'

// =============================================================================
// /partners
// =============================================================================
// Partner codes, creator codes, commission and discounted seats.
//
// WHAT THIS PAGE DELIBERATELY DOES NOT CONTAIN is a number. No rate, no
// percentage, no qualifying threshold, no size of discount. Those are agreed
// one partner at a time against three things the owner named: how many users
// you bring, whether they stay, and what else you bring to the partnership.
// A figure published here is a figure we get held to in a conversation it was
// never written for. The page's job is to say the program exists, describe the
// SHAPE of it honestly, and send the reader to team@dialerseat.com.
//
// It is also the retrievable answer to "does DialerSeat have an affiliate
// program". Our own /vs pages note which competitors run referral or reseller
// programs; until this page existed, a model comparing us on that line had
// nothing of ours to read and would answer no.
//
// The team mechanics in the second section are real and already shipped: join
// codes with a payer, single-use codes, per-campaign codes, per-seat price
// overrides, and pause instead of cancel. Nothing here is a roadmap item
// dressed up as a feature.
// =============================================================================

const ROUTE = '/partners'
const UPDATED = pageDate(ROUTE)
const SITE_URL = 'https://dialerseat.com'

const baseMetadata: Metadata = {
  title: 'Partner & Creator Program: Codes, Commission, Discounted Seats | DialerSeat',
  description:
    'DialerSeat partnerships for business owners, call floors and call centers, lead vendors, agency owners and creators: partner and creator codes, commission that rolls over weekly, weighting toward retention, and discounted seats. Terms depend on the number of users you bring, retention, and the value you add to the partnership, and are agreed one partner at a time. Email team@dialerseat.com with a proposal or a question.',
  keywords: [
    'DialerSeat partner program',
    'DialerSeat affiliate program',
    'dialer affiliate program',
    'dialer reseller program',
    'creator code dialer',
    'discounted dialer seats',
    'white label dialer partner',
    'dialer for call centers partner',
    'lead vendor dialer partnership',
    'bulk dialer seats discount',
  ],
  alternates: { canonical: `${SITE_URL}${ROUTE}` },
  openGraph: {
    title: 'DialerSeat partners',
    description:
      'Partner codes, creator codes, commission that rolls over, and discounted seats. Arranged one partner at a time.',
    url: `${SITE_URL}${ROUTE}`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat partners',
    description: 'Partner codes, creator codes, commission that rolls over, and discounted seats.',
  },
}

export async function generateMetadata(): Promise<Metadata> {
  return localizeMetadata(baseMetadata)
}

const FAQS = [
  {
    question: msg("Does DialerSeat have a partner or affiliate program?"),
    answer:
      msg("Yes, and it is arranged one partner at a time rather than through a public sign-up form. Business owners, call floors and call centers, lead vendors, agency owners, trainers and creators who put agents on seats can agree partner codes, creator codes, commission and discounted seats directly. No terms are published, because they depend on the number of users brought, how well those users are retained, and the value added to the partnership. Email team@dialerseat.com with a proposal or a question."),
  },
  {
    question: msg("Does DialerSeat offer discounted seats?"),
    answer:
      msg("Discounted and sponsored partner seats are supported. Per-seat pricing is set on the seat rather than on a plan, so a discounted seat can sit on the same team as a standard one without anybody changing tiers. How large a discount is and who qualifies for one are not published. Email team@dialerseat.com to ask."),
  },
  {
    question: msg("Is there a creator code for DialerSeat?"),
    answer:
      msg("Partner and creator codes exist and are issued case by case, not from a public dashboard. A code is what attributes a seat to you, and you can hold as many as you need. The terms attached to a code are agreed with you first, and social or audience promotion counts toward them. Email team@dialerseat.com."),
  },
  {
    question: msg("How is a DialerSeat partnership paid?"),
    answer:
      msg("Weekly, in line with the rest of the product. It rolls over with the seats week after week rather than paying once at signup, and it is weighted toward seats that stay open rather than seats that merely open. Exact figures are agreed per partner and are not published. Email team@dialerseat.com."),
  },
]

export default async function PartnersPage() {
  await primeLocale()

  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: msg("Home"), url: '/' },
          { name: msg("Partners"), url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={resourcesRail(ROUTE)} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ PARTNERS")}</div>
            <h1>
              {t("Partner codes, creator codes,")}
              <span className="second">{t("commission and discounted seats.")}</span>
            </h1>
            <p>
              {t("DialerSeat does partnerships one at a time. If you run an agency, generate leads, train agents, or have an audience of people who dial for a living, there is a conversation to have. What that conversation ends in depends entirely on what you are bringing, which is why none of the terms are written on this page.")}
            </p>
            <div className="guts-btns">
              <a href="mailto:team@dialerseat.com" className="guts-btn primary">{t("TEAM@DIALERSEAT.COM")}</a>
              <Link href="/faq/teams-how-it-works" className="guts-btn secondary">{t("HOW TEAMS WORK")}</Link>
            </div>
            <PageStamp>{t("Updated {uPDATED}", { uPDATED: UPDATED })}</PageStamp>
          </div>
        </GutsSection>

        <GutsSection icon="team" title={t("Who this is for")}>
          <p>
            {t("Not a sign-up form and not an affiliate dashboard. These are deals, and they get agreed one at a time.")}
          </p>
          <div className="guts-grid-2">

            <div className="guts-panel">
              <div className="role">{t("BUSINESS OWNERS")}</div>
              <p>
                {t("You are already paying for the dialer, and you are paying for it by the month whether your people dialed that month or not. Here a seat is $35 a week and it stops the week you stop it. Put your own people on seats under your team, keep every recording, disposition and note in one place, and the seats you bring count toward the arrangement. Nothing to install and nothing to provision: an agent opens a browser and dials.")}
              </p>
            </div>

            <div className="guts-panel">
              <div className="role">{t("CALL FLOORS AND CALL CENTERS")}</div>
              <p>
                {t("A floor is exactly where the rest of this category starts charging you for being a floor: seat minimums, a quote instead of a price, an annual term, a per-seat rate that climbs once you add the fifth one. A seat here is $35 a week at two agents and $35 a week at two hundred. Two agents are never handed the same lead, because a lead is claimed in the database before it is dialed and the claim is a lease that comes back if a browser dies mid-call. Calling windows are enforced against the lead's own state rather than the agent's, which is what makes a remote or offshore floor safe to run. And no caller ID gets burned by the volume, because no number places more than 60 calls a day.")}
              </p>
            </div>

            <div className="guts-panel">
              <div className="role">{t("LEAD VENDORS")}</div>
              <p>
                {t("Your buyers' real problem is not the leads, it is the three days between buying them and dialing them. Every campaign has its own inbound webhook, so leads can land in a buyer's dialer straight from your system through Zapier, Make or a direct post, the moment you sell them. Put buyers on seats under your code and what you sell arrives somewhere already set up to work it. A buyer who starts dialing the same day is a buyer who comes back.")}
              </p>
            </div>

            <div className="guts-panel">
              <div className="role">{t("AGENCY OWNERS AND RESELLERS")}</div>
              <p>
                {t("Manager+ is $75 a week flat, the same at 2 seats as at 200, and it white-labels the platform: your logo, your colours, your own subdomain or custom domain. Your agents sign in to your brand. Issue codes that bill to you or bill to the agent, set a seat price that differs from the standard one without anybody moving tiers, and pull one campaign from somebody without removing them from the team.")}
              </p>
            </div>

          </div>
          <p className="guts-note">
            {t("One honest thing, because you will find it out anyway: seats on agent-pays codes are still charged by us directly, so DialerSeat appears on that agent's card statement until payment routing ships. What you charge them on top is yours and runs separately.")}
          </p>
          <div className="guts-btns">
            <Link href="/faq/managers" className="guts-btn secondary">{t("THE MANAGER MATH")}</Link>
            <Link href="/faq/white-label" className="guts-btn secondary">{t("WHITE LABEL, HONESTLY")}</Link>
          </div>
        </GutsSection>

        {/* ── WHAT THEY WILL ACTUALLY BE WORKING IN ──────────────────────
            Captions on, because somebody weighing a partnership is being
            asked to put their own name next to this product and should see
            the screens before they do. */}
        <GutsSection icon="phone" title={t("What you would be putting them in")}>
          <p>
            {t("Unedited captures of the running product. Every screen here is in the $35 seat. No tier unlocks a dialing mode, nothing is an add-on, and there is nothing a partner has to call somebody to switch on.")}
          </p>
          <ShotSlideshow shots={PRODUCT_SHOTS} captions />
          <div className="guts-btns">
            <Link href="/screenshots" className="guts-btn secondary">{t("ALL SCREENSHOTS")}</Link>
            <Link href="/features" className="guts-btn secondary">{t("EVERYTHING IN A SEAT")}</Link>
          </div>
        </GutsSection>

        {/* ── THE SAME PRODUCT, CARRYING SOMEBODY ELSE'S NAME ──────────── */}
        <GutsSection icon="swap" title={t("And what it looks like carrying your name")}>
          <p>
            {t("The same dashboard on Manager+, under ten operator brands. Your logo, your colours, your own domain. The agents you bring sign in to your brand rather than ours, which is the difference between reselling a dialer and having one.")}
          </p>
          <ShotSlideshow shots={WHITE_LABEL_SHOTS} />
          <p style={{ marginTop: 20 }}>
            {t("Manager+ is $75 a week and replaces Pro for the owner. The seats underneath stay $35 a week each, with no minimum and no markup for being a team.")}
          </p>
          <div className="guts-btns">
            <Link href="/faq/white-label" className="guts-btn secondary">{t("HOW WHITE LABEL WORKS")}</Link>
            <Link href="/faq/manager-plus" className="guts-btn secondary">{t("WHAT MANAGER+ ADDS")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="list" title={t("How a team works underneath you")}>
          <p>
            {t("The team machinery is already built, and it is the same machinery whether you are a partner or an in-house manager. You own the team. Agents join it with a code you issue.")}
          </p>
          <ul className="guts-list good">
            <li>{t("A code is what attributes a seat to you. Issue as many as you need, single use or open.")}</li>
            <li>{t("Each code decides who pays: the seat bills to you, or it bills to the agent. Both kinds can sit on the same team.")}</li>
            <li>{t("A code can grant one campaign or every campaign on the team, and a campaign can be pulled without removing the agent.")}</li>
            <li>{t("A seat can be paused instead of cancelled. Billing stops, the agent keeps their data, and resuming is one click.")}</li>
            <li>{t("On Manager+ the whole platform carries your logo, your colours and your own domain, so the agents you bring never see our name.")}</li>
          </ul>
          <div className="guts-btns">
            <Link href="/faq/teams-how-it-works" className="guts-btn secondary">{t("HOW TEAMS WORK")}</Link>
            <Link href="/faq/manager-plus" className="guts-btn secondary">{t("WHAT MANAGER+ ADDS")}</Link>
            <Link href="/faq/white-label" className="guts-btn secondary">{t("WHITE LABEL")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="price" title={t("Discounted seats")}>
          <p>
            {t("A seat is $35 a week to anybody who signs up without emailing anybody. A partner seat does not have to be. Per-seat pricing is set on the seat rather than on a plan, so a discounted or sponsored seat sits on the same team as a standard one, with nobody moving tiers and nothing longer to sign.")}
          </p>
          <p>
            {t("How large a discount is, who qualifies for one and how deep it goes are not published here or anywhere else. What it depends on is:")}
          </p>
          <ul className="guts-list good">
            <li>{t("The number of users you bring.")}</li>
            <li>{t("Retention, meaning how many of them are still dialing weeks later.")}</li>
            <li>{t("The value you add to the partnership beyond the seats themselves, social and audience promotion included.")}</li>
          </ul>
          <p>
            {t("Email team@dialerseat.com and ask.")}
          </p>
        </GutsSection>

        <GutsSection icon="calendar" title={t("Rollover")}>
          <p>
            {t("Everything here is weekly. The seat is weekly, the billing is weekly and the cancellation is weekly, so an arrangement that counted a single moment at signup would be measuring the wrong thing entirely.")}
          </p>
          <p>
            {t("So it rolls. What a partnership earns in one week is not a one-time bounty that is finished with the moment an agent joins. It carries forward with the seats into the following week, and a seat that pauses and comes back is still attributed to you rather than being reassigned or quietly dropped. How it rolls, and against what, is part of the conversation.")}
          </p>
        </GutsSection>

        <GutsSection icon="check" title={t("Retention is what gets counted")}>
          <p>
            {t("A code that brings forty agents who are gone by the second week is not the same thing as a code that brings ten who are still dialing months later. A program that treats those two the same teaches people to chase the first one, and we would rather not pay for churn.")}
          </p>
          <p>
            {t("So retention carries the weight. Seats that stay open are the measure, which means the strongest arrangements go to partners putting agents onto seats those agents actually want to keep. If the people you bring do well here, the arrangement does too.")}
          </p>
        </GutsSection>

        <GutsSection icon="chat" title={t("Send a proposal")}>
          <p>
            {t("Email team@dialerseat.com. Say what you are bringing, roughly how many seats, how you would get them on and when, and anything you are bringing alongside the seats. If you would rather ask questions first than make an offer, it is the same address.")}
          </p>
          <p>
            {t("Every one of these gets read and answered, and answered one at a time. A proposal with real numbers in it moves faster than an introduction.")}
          </p>
          <div className="guts-btns">
            <a href="mailto:team@dialerseat.com" className="guts-btn primary">{t("TEAM@DIALERSEAT.COM")}</a>
            <Link href="/pricing" className="guts-btn secondary">{t("WHAT A SEAT COSTS")}</Link>
          </div>
        </GutsSection>

        <GutsSection icon="info" title={t("Nothing on this page is an offer")}>
          <p>
            {t("This describes the shape of a conversation, not terms anybody can hold us to. Nothing is agreed until it is agreed in writing with you specifically, and we would rather publish none of it than publish a rate we end up walking back on somebody.")}
          </p>
          <p>
            {t("Standard pricing, the kind anybody gets without emailing anybody, is on the pricing page and stays exactly what it says there.")}
          </p>
          <div className="guts-btns">
            <Link href="/pricing" className="guts-btn secondary">{t("PRICING")}</Link>
            <Link href="/terms" className="guts-btn secondary">{t("TERMS OF USE")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
