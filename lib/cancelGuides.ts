// =============================================================================
// lib/cancelGuides.ts: how to cancel each dialer, from the vendor's own pages
// =============================================================================
// Behind /faq/how-to-cancel and /faq/how-to-cancel/<slug>. Google autocomplete
// (13 Nov 2026) finishes "how to cancel <dialer>" for these thirteen, and none
// of the six competitor sitemaps we read has a cancellation page. People
// leaving a dialer are the readers most likely to want one with no contract,
// so these pages earn their place only by being exactly right about the
// vendor they describe.
//
// THE RULE: every line comes from the vendor's own help center, terms or
// pricing page, read on CANCEL_CHECKED, and each guide lists those pages. A
// field the vendor does not state is left out, never filled from a review
// site, a chargeback service or a forum. Where the vendor's own pages
// disagree with each other, the guide says so (Ringover).
//
// DialerSeat is mentioned once, at the bottom of the page, after the guide has
// done its job (RankHonestly ch 35).
// =============================================================================

import { msg } from '@/lib/i18n/msg'

export const CANCEL_CHECKED = '2026-11-13'

export type SourceKind = 'help' | 'terms' | 'pricing'

export interface CancelGuide {
  slug: string
  name: string
  /** 40–80 words that answer the search on their own. */
  answer: string
  steps: string[]
  who?: string
  notice?: string
  ends?: string
  refunds?: string
  numbers?: string
  data?: string
  /** Something the vendor's own pages say that a leaver should know first. */
  watch?: string
  sources: { kind: SourceKind; url: string }[]
}

export const SOURCE_LABEL: Record<SourceKind, string> = {
  help: msg("{name} help center"),
  terms: msg("{name} terms of service"),
  pricing: msg("{name} pricing page"),
}

const OWNER = msg("Only the account owner.")

export const CANCEL_GUIDES: CancelGuide[] = [
  {
    slug: 'readymode', name: 'ReadyMode',
    answer: msg("ReadyMode needs 30 days’ notice to cancel, given to its Billing team. Annual plans are paid up front for 12 months and renew automatically unless you opt out before the renewal date, and cancelling early can cut any refund by the time used and the lost annual discount. Phone numbers are billed monthly until they are released."),
    steps: [
      msg("Find your renewal date, and whether you are on a monthly or an annual plan."),
      msg("Contact ReadyMode’s Billing team at least 30 days before you want the account to end."),
      msg("On an annual plan, give notice before the renewal date, or the plan renews for another year."),
    ],
    notice: msg("30 days, to the Billing team."),
    ends: msg("Annual plans renew automatically each year unless you opt out before the renewal date."),
    refunds: msg("Cancelling an annual plan before the end of the term can reduce any refund by the time used and the removal of the annual discount."),
    numbers: msg("Each phone number is billed monthly until it is released."),
    sources: [
      { kind: 'help', url: 'https://help.readymode.com/support/solutions/articles/11000096651-readymode-billing-faq' },
      { kind: 'pricing', url: 'https://readymode.com/demo/pricing-readymode/' },
      { kind: 'terms', url: 'https://readymode.com/terms-and-conditions/' },
    ],
  },
  {
    slug: 'mojo', name: 'Mojo Dialer',
    answer: msg("Mojo Dialer is cancelled only inside your Mojo account, on a computer, logged in as the owner: open Subscriptions and click Cancel. Requests by email, phone or ticket are not processed. The cancellation takes effect after your next billing date, and you can keep using Mojo until then."),
    steps: [
      msg("Log in to Mojo on a computer as the account owner."),
      msg("Open the Subscriptions tab on the left of the page."),
      msg("Click Cancel and follow the on-screen instructions."),
    ],
    who: OWNER,
    notice: msg("None stated. Email, phone and ticket requests are not processed."),
    ends: msg("After your next billing date; you can use Mojo until then."),
    watch: msg("If you only need a break, Mojo offers a basic subscription at $10 a month per user that keeps your data."),
    sources: [{ kind: 'help', url: 'https://mojodialersupport.mojosells.com/portal/en/kb/articles/how-to-cancel-your-account' }],
  },
  {
    slug: 'batchdialer', name: 'BatchDialer',
    answer: msg("BatchDialer is cancelled from its billing page: open Settings from your username, click Cancel Account, say why you are leaving and click Next. You can talk to its team instead if you want help. The account is cancelled at the end of the billing period, and you can use it until then."),
    steps: [
      msg("Click your username and open Settings, which takes you to the billing page."),
      msg("Click Cancel Account."),
      msg("Say why you are closing the account, then click Next."),
    ],
    ends: msg("At the end of the billing period; you can use the account until then."),
    sources: [{ kind: 'help', url: 'https://help.getbatch.co/en/articles/9792937-how-to-request-account-cancellation-in-batchdialer' }],
  },
  {
    slug: 'kixie', name: 'Kixie',
    answer: msg("To cancel Kixie, email support@kixie.com and complete its cancellation exit survey: asking to cancel is not enough on its own. Kixie gives no refunds once a bill has been charged, so cancel before your next bill date. On cancellation all phone numbers are released and users and settings are erased, so ask to port any number in that first email."),
    steps: [
      msg("Check your next bill date in Kixie under Billing, then Subscription."),
      msg("Email support@kixie.com to start the cancellation. If you want to keep a number, say so in this first email."),
      msg("Complete the exit survey Kixie sends. Billing does not stop until you do."),
    ],
    notice: msg("Cancel before your next bill date. On a contract, licences can only be reduced in the last 30 days of the term."),
    refunds: msg("None once a subscription charge has gone through, and no refunds or credits for user changes during an annual cycle."),
    numbers: msg("Released on cancellation. To keep one, the account must stay active and paid until the port completes."),
    data: msg("Users and settings are erased and dashboard access is disabled."),
    sources: [
      { kind: 'help', url: 'https://support.kixie.com/hc/en-us/articles/225116528-How-does-Kixie-s-billing-work' },
      { kind: 'help', url: 'https://support.kixie.com/hc/en-us/articles/5534691005723-Kixie-Billing-Annual-Contracts-and-Annual-Bill-Cycles' },
    ],
  },
  {
    slug: 'wavv', name: 'WAVV',
    answer: msg("To cancel WAVV, open its Billing tab, click Manage subscription and then Cancel subscription, or ask WAVV Support in chat. Only the owner can cancel. Cancel WAVV before your CRM, because cancelling the CRM does not cancel WAVV. You keep access to the end of the billing cycle, and your numbers are removed once the subscription ends."),
    steps: [
      msg("Open the Billing tab in WAVV."),
      msg("Click Manage subscription, which opens Stripe."),
      msg("Click Cancel subscription and confirm."),
    ],
    who: OWNER,
    ends: msg("Full access to the end of the current billing cycle, with no further charges."),
    refunds: msg("Only if asked for within 7 days of the most recent charge and no calls or texts were made in those 7 days. Wallet balance is not refunded."),
    numbers: msg("Removed once the subscription is cancelled."),
    data: msg("Call history, recordings and transcriptions are kept for 90 days, then deleted."),
    watch: msg("Cancelling your CRM does not cancel WAVV: cancel WAVV first, then the CRM."),
    sources: [
      { kind: 'help', url: 'https://help.wavv.com/en/articles/17764023-cancelling-your-wavv-subscription-and-refunds' },
      { kind: 'help', url: 'https://help.wavv.com/en/articles/13931463-how-can-i-cancel-my-wavv-subscription' },
    ],
  },
  {
    slug: 'justcall', name: 'JustCall',
    answer: msg("To cancel JustCall, the account owner opens Billing from the profile icon, selects Overview and clicks Cancel Subscription. The account closes at the end of the current billing cycle and is not charged for a new one, though a final invoice can still arrive for items like new numbers or porting. Port out numbers and export data first."),
    steps: [
      msg("Log in to JustCall, click your profile icon and select Billing."),
      msg("Make sure Overview is selected and scroll to Cancel Subscription."),
      msg("Check the end date shown and click Cancel Subscription."),
    ],
    who: OWNER,
    ends: msg("At the end of the current billing cycle, with no charge for a new one. You can revoke the cancellation until then."),
    refunds: msg("Only for duplicate or incorrect payments, not for standard subscription charges."),
    numbers: msg("Port them out before you cancel, and keep the account open until porting is complete."),
    data: msg("Download call logs, text messages and voicemails before the account closes."),
    watch: msg("A final invoice can still arrive after you cancel, for items such as new numbers, number porting or 10DLC fees."),
    sources: [{ kind: 'help', url: 'https://help.justcall.io/en/articles/1046750-how-can-i-cancel-my-justcall-subscription-and-what-happens-afterward' }],
  },
  {
    slug: 'aircall', name: 'Aircall',
    answer: msg("Aircall’s standard terms require written notice 30 days before your renewal date. With 10 or fewer users, an owner can click Cancel Subscription in the Dashboard’s Plan tab, and the cancellation is scheduled at the end of the billing period. With more than 10 users, you email Customer Success at least 30 days before renewal."),
    steps: [
      msg("In the Aircall Dashboard, open the Plan tab and find your renewal date under Overview."),
      msg("With 10 or fewer users, click Cancel Subscription. With more, email Customer Success."),
      msg("Make sure the request is in at least 30 days before the renewal date."),
    ],
    who: msg("Users with Owner permissions."),
    notice: msg("30 days before the renewal date, in writing. This applies to annual plans and commitments even under 10 users."),
    ends: msg("At the end of the current billing period."),
    numbers: msg("Open a porting ticket early, as porting can take weeks. The account must stay active until it completes."),
    data: msg("Request exports of call logs, voicemails and recordings through the Help Centre before you cancel."),
    sources: [{ kind: 'help', url: 'https://support.aircall.io/en-gb/articles/19179941054877' }],
  },
  {
    slug: 'dialpad', name: 'Dialpad',
    answer: msg("On a month-to-month Dialpad plan with 25 or fewer licences, you cancel yourself in Admin Settings under Billing Summary. Other accounts go through Dialpad’s cancellation process in its help center. Dialpad refunds only cancellations within 3 days of a charge, annual plans are not refunded, and unused calling credits expire on cancellation."),
    steps: [
      msg("Open Admin Settings in Dialpad and go to Billing Summary."),
      msg("On a month-to-month plan with 25 or fewer licences, cancel there."),
      msg("On an annual plan or with more licences, follow the cancellation route in Dialpad’s help center."),
    ],
    refunds: msg("Only within 3 days of a charge. Annual plans are not refunded, nor are unused licences."),
    data: msg("Unused calling and international calling credits expire on the termination date."),
    sources: [
      { kind: 'help', url: 'https://help.dialpad.com/hc/en-us/articles/54920599156251-Cancel-Your-Dialpad-Account' },
      { kind: 'help', url: 'https://help.dialpad.com/hc/en-us/articles/54926238981403-Dialpad-Cancellation-and-Refund-FAQs' },
    ],
  },
  {
    slug: 'ringcentral', name: 'RingCentral',
    answer: msg("RingCentral is cancelled by calling or chatting with its support, and only the company admin or account owner can do it. Support asks for the account’s main phone number, its security answer and the last four digits of the card. The account is disabled for 30 days before it is cancelled, and cancelling disconnects your numbers and deletes call logs and messages."),
    steps: [
      msg("Back up company and user data first, including call recordings."),
      msg("Call or chat with RingCentral support as the company admin or account owner."),
      msg("Have the main phone number, the security answer and the card’s last four digits ready."),
    ],
    who: msg("The company admin or account owner."),
    ends: msg("The account is disabled for 30 days, then cancelled. Call support to reactivate it within those 30 days."),
    numbers: msg("Disconnected on cancellation."),
    data: msg("Call logs, messages and contacts are deleted. Its Archiver only backs up data from the day it was set up, and not call history or personal contacts."),
    sources: [{ kind: 'help', url: 'https://support.ringcentral.com/article-v2/Canceling-your-RingCentral-account.html?brand=RingCentral&product=RingEX&language=en_US' }],
  },
  {
    slug: 'gohighlevel', name: 'GoHighLevel',
    answer: msg("If you pay HighLevel directly, go to Agency Settings, then Billing, click Want to modify/cancel your subscription?, give a reason, review the data-loss warning and confirm. If you bought it through another agency, that agency has to cancel it. HighLevel keeps cancelled data for 90 days, but deletes phone numbers 14 days after cancellation."),
    steps: [
      msg("Go to Agency Settings and click Billing."),
      msg("Click Want to modify/cancel your subscription? and choose a reason."),
      msg("Review the data-loss warning and click I am sure I want to cancel."),
    ],
    who: msg("The agency that pays HighLevel. If you bought through another agency, ask its administrator."),
    numbers: msg("Phone numbers and A2P registrations are deleted 14 days after cancellation."),
    data: msg("Kept for 90 days, during which reactivating restores it. Add-on subscriptions are cancelled with the plan."),
    sources: [
      { kind: 'help', url: 'https://help.gohighlevel.com/support/solutions/articles/48001208376' },
      { kind: 'help', url: 'https://help.gohighlevel.com/support/solutions/articles/155000004281' },
    ],
  },
  {
    slug: 'ringover', name: 'Ringover',
    answer: msg("To cancel Ringover, log in at talk.ringover.com, open the Subscription section and confirm. The service closes immediately, not at the end of the period, and every number is lost at that moment, so finish porting any number you want first. Payments already made are not refunded, and annual plans are not refunded mid-year."),
    steps: [
      msg("Port any number you want to keep and wait for the port to complete."),
      msg("Log in at talk.ringover.com and open the Subscription section."),
      msg("Follow the prompts to confirm the cancellation."),
    ],
    ends: msg("Immediately. Ringover suggests waiting until the end of the billing cycle to use what you have paid for."),
    refunds: msg("Monthly payments already made are not refunded; annual plans are not refunded mid-year."),
    numbers: msg("Disconnected and lost the moment you cancel, and cannot be recovered."),
    watch: msg("Ringover’s pages disagree: its help center says the monthly plan has no commitment, while its pricing page lists a 12-month commitment on both plans. Check which applies to your account."),
    sources: [
      { kind: 'help', url: 'https://support.ringover.com/hc/en-us/articles/44205440451985-TALK-How-do-I-cancel-my-Ringover-Talk-subscription' },
      { kind: 'pricing', url: 'https://www.ringover.com/pricing' },
    ],
  },
  {
    slug: 'nextiva', name: 'Nextiva',
    answer: msg("Nextiva’s terms require you to cancel by emailing service@nextiva.com or calling 1-800-983-4289 at least 30 days before your service term ends. With less notice, the agreement renews for another term and ends only after it. Prepaid fees are not refundable, and anything owed is due at disconnection."),
    steps: [
      msg("Find the end date of your current service term."),
      msg("Email service@nextiva.com or call 1-800-983-4289 at least 30 days before that date."),
      msg("Expect any charges still owed to be due on the day the service is disconnected."),
    ],
    notice: msg("30 days before the end of the service term. Less than that, and the service renews for another term."),
    ends: msg("At the end of the current term, if notice was given in time."),
    refunds: msg("Prepaid fees are not refundable, and all charges owed are due at disconnection."),
    watch: msg("Nextiva sends a pro forma invoice 7 days before renewal, which is too late to give 30 days’ notice."),
    sources: [
      { kind: 'terms', url: 'https://www.nextiva.com/download/Nextiva-NextOS-Terms-&-Conditions.pdf' },
      { kind: 'help', url: 'https://help.nextiva.com/article/billing-faqs' },
    ],
  },
  {
    slug: 'redx', name: 'REDX',
    answer: msg("REDX is cancelled by calling 800-731-7339 to talk to Customer Support, or by mailing a written request to its corporate office, which must arrive at least one business day before your next billing cycle. Each prepaid term renews automatically for the same length, and missing the deadline does not justify a refund."),
    steps: [
      msg("Find the start date of your next billing cycle."),
      msg("Call REDX Customer Support at 800-731-7339, or mail a written cancellation request to its corporate office."),
      msg("Make sure it is received at least one business day before the next billing cycle."),
    ],
    notice: msg("At least one business day before the next billing cycle."),
    ends: msg("Each term renews automatically for the same length as the original plan until you cancel."),
    refunds: msg("Failing to cancel before the end of the billing cycle does not justify a refund."),
    sources: [{ kind: 'terms', url: 'https://www.redx.com/terms' }],
  },
]
