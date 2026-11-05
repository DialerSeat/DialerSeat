# FAQ and vs links, with the terms to use

A plan, not yet built. These are links between your own pages. They spread what authority the site has and show Google which pages belong together, but they aren't backlinks from other sites, which are what move rankings (see [PLAYBOOK.md](PLAYBOOK.md), stage 6).

## What the 5 Nov crawl found

Counted from page content, with header, footer, nav and rail removed:

- **39 of 46 FAQ pages get no link from any /vs/ page.** The other 7 get one or none that matter; the most any FAQ page gets from /vs/ is 1.
- **15 of 32 competitor pages get no link from any FAQ page:** wavv, cloudtalk, dialpad, dialedin, ringcentral, smrtphone, aloware, ytel, 3cx, dialer-io, gohighlevel, ringover, talkdesk, nextiva, manual-dialing.
- /vs/readymode, in the sampled page, links only to the /faq index, not to one specific answer.
- /faq/dialer-for-insurance-agents links to no competitor page, while /faq/dialer-for-real-estate links to three.
- Comparison pages hold the buyer closest to deciding, and they're the ones sending them nowhere useful.

## Rules for this map

- Every term below came back from Google autocomplete on 4 or 5 Nov. These are searched phrases, not guesses.
- Use a term only where the page it points to really answers it. A term gets used once as the link text, never repeated down the page.
- Links go in a small "Related" block at the end of a page, so your existing copy isn't reworded. Changing your titles or body text stays your call.
- New link labels need translating into 11 languages unless they reuse strings that already exist. Where a page's own title already reads well, reuse it.
- Nothing here claims a feature the page doesn't describe.

## From competitor pages to FAQ answers

Each competitor page gets the block for its segment, plus the row for any named page.

| Competitor pages | Link to | Link text (searched term) |
|---|---|---|
| **Call center:** readymode, convoso, five9, vicidial, calltools, dialedin, ytel, talkdesk, string | /faq/is-a-predictive-dialer-legal | is a predictive dialer legal |
| | /faq/how-does-amd-work | answering machine detection |
| | /tools/abandon-rate-calculator | abandon rate formula |
| | /tools/erlang-c-calculator | call center staffing calculator |
| **Real estate:** mojo, redx, batchdialer, wavv, smrtphone | /faq/dialer-for-real-estate | best power dialer for real estate |
| | /faq/local-presence-dialing | local presence dialing |
| | /faq/how-to-remove-spam-likely | how to remove Spam Likely |
| **Sales and CRM:** phoneburner, kixie, orum, aloware, justcall, close, hubspot | /faq/what-is-a-power-dialer | power dialer vs predictive dialer |
| | /faq/what-is-a-parallel-dialer | parallel dialer vs power dialer |
| | /faq/send-leads-from-your-crm | send leads from your CRM |
| **Phone systems:** ringcentral, dialpad, nextiva, 3cx, aircall, cloudtalk, ringover | /faq/what-is-an-auto-dialer | what is an auto dialer |
| | /faq/why-calls-show-spam-likely | why calls show Spam Likely |
| | /faq/how-many-numbers-do-i-need | how many numbers do you need |
| gohighlevel | /faq/send-leads-from-your-crm | power dialer for GoHighLevel |
| | /faq/local-presence-dialing | GHL local presence dialing |
| ringcentral | /faq/local-presence-dialing | RingCentral local presence dialing |
| dialer-io | /faq/why-dialerseat | why DialerSeat |
| manual-dialing | /tools/calls-per-hour-calculator | calls per hour calculator |
| Every competitor page | /faq/why-we-charge | cheapest power dialer, or cheap auto dialer on call center pages |
| | /tools/dialer-cost-calculator | dialer cost |

## From FAQ answers to competitor pages

| FAQ page | Link to | Link text (searched term) |
|---|---|---|
| what-is-a-power-dialer | /vs/phoneburner, /vs/kixie | PhoneBurner alternative, Kixie alternatives |
| what-is-a-predictive-dialer | /vs/readymode, /vs/convoso | ReadyMode alternatives, Convoso alternatives |
| what-is-a-parallel-dialer | /vs/orum | Orum alternatives |
| what-is-an-auto-dialer | /vs/everyone | best auto dialer software |
| dialer-for-insurance-agents | /vs/readymode, /vs/convoso, /vs/calltools | best auto dialer for insurance agents |
| dialer-for-call-centers | /vs/five9, /vs/vicidial, /vs/talkdesk | dialer solution for call center |
| dialer-for-real-estate | Already links to mojo, batchdialer, redx; add /vs/wavv | Mojo Dialer alternatives |
| send-leads-from-your-crm | /vs/gohighlevel, /vs/hubspot | dialer for HubSpot, power dialer for GoHighLevel |
| local-presence-dialing | /vs/gohighlevel, /vs/ringcentral | GHL local presence dialing, RingCentral local presence dialing |
| why-we-charge | /vs/readymode, /vs/mojo, /data/dialer-pricing | ReadyMode $199 a week's cost, Mojo $149, power dialer pricing |
| why-dialerseat | /vs/everyone, /vs/dialer-io | dialer vs every other dialer |
| how-to-remove-spam-likely | /faq/why-we-dont-rest-flagged-numbers, /faq/how-we-keep-numbers-clean | number reputation, A-level attestation |
| 10dlc-and-outbound-calling | /faq/how-to-remove-spam-likely | Free Caller Registry |

Check each vendor pairing against `lib/competitors.ts` when building: the insurance and call center rows name vendors by segment, and a page must not imply a vendor targets a trade it doesn't.

## From FAQ answers to the compliance tools

| FAQ page | Link to | Link text (searched term) |
|---|---|---|
| how-to-scrub-the-do-not-call-registry | /tools/state-do-not-call-lists | state do not call list (live) |
| is-a-predictive-dialer-legal | /tools/tcpa-compliance-checklist | TCPA requirements for calls (live) |
| how-we-keep-compliance | /tools/state-do-not-call-lists | state do not call registry |
| calling-hours | /tools/state-do-not-call-lists | Florida, Texas and Indiana do not call lists |

## Terms worth working in, by topic

Use these when a page is next written or you approve copy changes. Don't paste them into pages that don't cover them.

| Topic | Searched terms |
|---|---|
| **Dialer types** | power dialer vs predictive dialer, power dialer vs auto dialer, predictive vs progressive dialer, predictive vs preview dialer, parallel dialer vs power dialer, what is dialer management |
| **Price intent** | cheapest power dialer, low cost power dialer, best cheap power dialer, cheapest auto dialer for cold calling, cheap predictive dialer, inexpensive auto dialer, predictive dialer pricing, power dialer pricing, auto dialer pricing, auto dialer free trial |
| **Buyer type** | best auto dialer for small business, best auto dialer for cold calling, best power dialer for insurance agents, best dialer for life insurance agents, best dialer for wholesaling real estate, best dialer for bpo, best dialer for truck dispatching |
| **CRM** | best dialer for hubspot, power dialer for hubspot, parallel dialer for hubspot, auto dialer for salesforce, salesforce dialer pricing, auto dialer for zoho crm, best dialer for pipedrive, power dialer for gohighlevel |
| **Reputation** | how to remove spam likely, scam likely, phone number reputation check, is my number flagged as spam, my number is marked as spam how to remove it, free caller registry, stir shaken attestation levels, a level stir shaken attestation |
| **Compliance** | tcpa requirements for calls, tcpa safe harbor, tcpa consent language examples, what is tcpa consent, one to one consent rule, dnc scrubbing, dnc list scrubbing, tcpa litigator list, florida mini tcpa, florida telemarketing registration, texas telemarketing registration requirements, california cold calling laws |
| **Call center math** | abandon rate formula call center, abandoned call rate industry standard, answering machine detection, dialer solution for call center |
| **Lists** | lead list template, lead list building |

Two to confirm before using:
- **One to one consent rule:** the FCC's rule has a court history, and the upload route's comments describe it as in force. Check its current status before any page mentions it.
- **"Best" and "cheapest" in link text:** fine as searched phrases pointing to a page that shows real prices. Don't make either claim about DialerSeat without the checkable number beside it.

## Suggested build order

1. A small related-links block, with the data held in one list, so a link can be added or removed in one place.
2. Competitor page blocks, starting with the 15 pages that have no FAQ link.
3. FAQ page blocks, starting with why-we-charge, insurance agents and send-leads-from-your-crm.
4. Re-run `node scripts/seo-links.mjs` and record the before and after in [measurement.md](measurement.md).
