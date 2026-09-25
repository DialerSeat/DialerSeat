import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/components/json-ld'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import GutsShell, { GutsSection } from '@/components/GutsShell'
import { vsRail } from '@/lib/gutsRail'
import { breadcrumbSchema, faqPageSchema } from '@/lib/schema'
import { primeLocale, t } from '@/lib/i18n/server'

// =============================================================================
// /vs/manual-dialing — "is a dialer even worth it?"
// =============================================================================
// The biggest objection a solo agent has is not a competitor. It is the phone
// already in their pocket and a spreadsheet. So this is the one /vs page whose
// opponent is not a product.
//
// DELIBERATELY NO PRODUCTIVITY NUMBERS. "Dialers triple your talk time" is the
// most repeated claim in this industry and nobody publishes how it was
// measured. This page describes what a dialer mechanically removes from the
// gap between conversations — which the reader can check against their own
// afternoon — rather than quoting a multiplier we cannot source.
//
// Every product behaviour named here is one that runs: AMD and multi-line
// predictive are campaign settings (app/api/campaigns/create), calling hours
// are enforced per lead (see /faq/calling-hours), and the 60-a-day cap is
// DEFAULT_DAILY_CAP in lib/numberPool.
// =============================================================================

const ROUTE = '/vs/manual-dialing'

export const metadata: Metadata = {
  keywords: [
    'power dialer vs manual dialing',
    'is a dialer worth it',
    'manual dialing pros and cons',
    'cons of manual dialing',
    'auto dialer vs manual dialing',
    'cold calling from your cell phone',
  ],
  title: 'DialerSeat vs Manual Dialing: Is a Dialer Worth $35 a Week?',
  description:
    'The pros and cons of dialing by hand against using a dialer. What a dialer actually removes from the gap between conversations, why dialing everything from your own cell number gets it labelled, and when dialing by hand is genuinely fine.',
  alternates: { canonical: `https://dialerseat.com${ROUTE}` },
  openGraph: {
    title: 'DialerSeat vs Manual Dialing',
    description:
      'What a dialer actually removes from your day, and when dialing by hand is genuinely fine.',
    url: `https://dialerseat.com${ROUTE}`,
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DialerSeat vs Manual Dialing',
    description:
      'What a dialer actually removes from your day, and when dialing by hand is genuinely fine.',
  },
}

const FAQS = [
  {
    question: 'Is a dialer worth it compared to dialing manually?',
    answer:
      'It depends on how much of your day is calling. A dialer removes the work between conversations: finding and dialing the next number, waiting through rings, sitting through voicemail greetings, and logging the result. If you make a handful of warm callbacks a day, dialing by hand is fine. If calling is most of your day, those gaps add up to most of it.',
  },
  {
    question: 'What are the cons of manual dialing?',
    answer:
      'Every step between conversations falls on you, voicemails and unanswered rings take the same time as live calls, you have to check each lead’s local time yourself to stay inside legal calling hours, results live in a spreadsheet you keep by hand, and dialing everything from your own number concentrates all of it on one caller ID.',
  },
  {
    question: 'Why does calling from my cell phone get my number marked as spam?',
    answer:
      'Because all of your calls come from one number. Call-protection providers score numbers on how people respond to them, and a single number placing a high volume of calls to people who decline or hang up builds a poor reputation fast. On a personal cell, that label follows you onto your personal calls too. DialerSeat spreads calls across a pool and caps each number at 60 calls a day.',
  },
  {
    question: 'When is dialing by hand the better choice?',
    answer:
      'When you make only a few calls a day, when every call is a warm callback to someone expecting you, or when you are testing whether outbound calling works for your business at all. There is no reason to pay for a dialer to make ten calls.',
  },
]

export default async function Page() {
  await primeLocale()
  return (
    <>
      <JsonLd data={faqPageSchema(FAQS)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', url: '/' },
          { name: 'Comparisons', url: '/vs' },
          { name: 'DialerSeat vs manual dialing', url: ROUTE },
        ])}
      />
      <SiteHeader />
      <GutsShell rail={vsRail()} activeHref={ROUTE}>

        <GutsSection>
          <div className="guts-hero">
            <div className="guts-eyebrow">{t("▸ COMPARISON")}</div>
            <h1>
              {t("Dialing by hand works.")}<span className="second">{t("Until it’s your whole day.")}</span>
            </h1>
            <p>
              {t("A phone and a spreadsheet will get you started. The question is what happens between the conversations, and how much of your afternoon that turns out to be.")}</p>
            <div className="guts-btns">
              <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
              <Link href="/vs" className="guts-btn secondary">{t("ALL COMPARISONS")}</Link>
            </div>
          </div>
        </GutsSection>

        <GutsSection icon="swap" title={t("What a dialer actually removes")}>
          <p>
            {t("The conversation is the only part of a call that earns anything. Everything around it is overhead, and dialing by hand, all of it is yours.")}</p>
          <div className="guts-grid-2">
            <div className="guts-panel">
              <div className="role">{t("BY HAND")}</div>
              <ul className="guts-list warn">
                <li>{t("Find the next number and type it in")}</li>
                <li>{t("Wait through every ring, including the ones nobody answers")}</li>
                <li>{t("Sit through voicemail greetings to find out it was a machine")}</li>
                <li>{t("Write down what happened before moving on")}</li>
              </ul>
            </div>
            <div className="guts-panel">
              <div className="role">{t("WITH A DIALER")}</div>
              <ul className="guts-list good">
                <li>{t("The next lead is dialed the moment you finish the last one")}</li>
                <li>{t("Predictive mode dials several leads at once and connects you to whoever answers")}</li>
                <li>{t("Answering machine detection screens out voicemail greetings")}</li>
                <li>{t("The outcome is logged to the lead as you set it")}</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: 24 }}>
            {t("We don’t quote a talk-time multiplier here, because nobody in this industry publishes how theirs was measured. Time your own next hour of calling and count the minutes you actually spent talking. That number is the real comparison.")}</p>
        </GutsSection>

        <GutsSection icon="alert" title={t("The problem with calling from your own number")}>
          <p>
            {t("Dialing a list from your cell puts every call on one caller ID. Call-protection providers score numbers on how people respond to them, and one number placing a high volume of calls to people who decline or hang up builds a poor reputation quickly.")}</p>
          <p>
            {t("On a business line that is a nuisance. On your personal cell, the label follows you onto every call you make, including the ones to people who know you.")}</p>
          <p>
            {t("DialerSeat places calls from a pool of numbers, signed with STIR/SHAKEN A-attestation, and no single number places more than 60 calls a day. How that works is on")}{' '}
            <Link href="/faq/how-we-keep-numbers-clean">{t("how we keep our numbers clean")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="shield" title={t("Calling hours you don’t have to check")}>
          <p>
            {t("Federal rules limit telemarketing calls to between 8 AM and 9 PM in the time zone of the person being called, and some states are stricter. Dialing by hand, checking each lead’s local time is on you, lead by lead, all day.")}</p>
          <p>
            {t("DialerSeat enforces calling windows on every call, based on the lead’s location, so a call outside the window is never placed. The full breakdown is on")}{' '}
            <Link href="/faq/calling-hours">{t("telemarketing calling hours by state")}</Link>.
          </p>
        </GutsSection>

        <GutsSection icon="check" title={t("When dialing by hand is the right call")}>
          <p>
            {t("Honestly, often. There is no reason to pay for a dialer to make ten calls.")}</p>
          <ul className="guts-list good">
            <li>{t("You make a handful of calls a day")}</li>
            <li>{t("Every call is a warm callback to someone expecting to hear from you")}</li>
            <li>{t("You are still testing whether outbound calling works for your business at all")}</li>
          </ul>
          <p style={{ marginTop: 18 }}>
            {t("When calling becomes most of your day, that is the point a dialer pays for itself. DialerSeat is $35 a week per seat with every dialer mode included, no contract, and you can stop any week.")}</p>
          <div className="guts-btns">
            <Link href="/sign-up" className="guts-btn primary">{t("GET STARTED →")}</Link>
            <Link href="/dialing-modes" className="guts-btn secondary">{t("SEE THE DIALER MODES")}</Link>
          </div>
        </GutsSection>

      </GutsShell>
      <SiteFooter />
    </>
  )
}
