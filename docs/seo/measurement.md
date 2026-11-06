# SEO measurement: change log, predictions, and the weekly routine

The book's measurement discipline (ch 14, 15, 22, 33, 36, Appendices C, D, F) set up for DialerSeat. The rule underneath all of it: **write down what a change should do before the result exists, and judge it on a quarter, not a day.** Decision date for the strategy as a whole: **late January 2027** (most SEO pages shipped 25–26 Sept 2026; results arrive 1–4 months after shipping).

---

## Change log (Appendix C: date it, predict it, judge it a quarter later)

| Date | Change | Commit | Expected effect | Judge on |
|---|---|---|---|---|
| 2026-11-04 | FAQ markup removed from 92 pages whose questions weren't visible | 5ffcbf510 | Removes a manual-action risk. **No traffic change**: FAQ rich results weren't being shown for this site. A loss outside the 28-day noise band would mean the prediction was wrong. | 2027-02-04 |
| 2026-11-04 | " \| DialerSeat" dropped from tab titles, all languages | 5ffcbf510 | Fewer truncated titles (89 → 22). A small CTR gain at positions 6–10 at most; not separable from everything else shipping. Recorded so nobody credits it with a jump. | 2027-02-04 |
| 2026-11-04 | Test tenants removed from sitemap-index.xml | 5ffcbf510 | Search Console stops reporting robots-blocked and redirected URLs from test1–8. | Next Search Console visit |
| 2026-11-04 | CNAM claims removed from pages, schema, llms files, 11 translations | f53ee849e | Credibility, not rank: assistants and readers stop repeating a false claim. Checked by the monthly AI prompt set: no answer should say DialerSeat registers CNAM. | 2026-12-04 |
| 2026-11-04 | Brand alternateName on Organization and WebSite | 3e2378ebe | Helps Google tie "Dialer Seat", "dialerseat" and "dialerseat.com" to this site. Visible as the site name shown above results; sitelinks need the profiles in `sameAs` too. | 2027-02-04 |
| 2026-11-04 | 17 autocomplete-verified matchup pages (e.g. readymode-vs-mojo, wavv-vs-kixie) | 4085b01c6, f6c2b9123 | Indexed within weeks; at least 8 of 17 show impressions for their own "a vs b" query by 31 Jan 2027 (prediction 1). | 2027-01-31 |

| 2026-11-05 | /tools hub and 16 free tools (lead list cleaner, phone formatter and extractor, area code lookup, calling hours, TCPA checklist, DNC cost, Erlang C, AHT, calls per hour, contact rate, cold calls per day, cost per lead, script and voicemail generators, tracker). English only. | d0f21c8c6 | Indexed within weeks. At least 8 of 17 tool pages show Search Console impressions by 28 Feb 2027, and at least one earns an unsolicited link by 31 May 2027 (ch 24, 35). Which ones win can't be predicted (ch 3): do not delete the rest. Fewer lead-upload support issues. | 2027-02-28 |
| 2026-11-05 | 24 FAQ and vertical pages link to the tools that fit them, English versions only (translated pages get them once a tool is translated) | 6ade24d8a | Tool pages are found sooner: they stop depending on the hub and sitemap alone. Check in Search Console's Links report that the tools show internal links from these pages. No rank claim. | 2026-12-05 |
| 2026-11-05 | /tools/state-do-not-call-lists (eleven states, read from their own sites). Every tool links to three neighbours. Spam Likely fix page linked from two related pages. | 96173c756 | The state page shows impressions for "[state] do not call list" queries by 28 Feb 2027 and is the most pitchable tool, since competing pages are old and disagree. Tool pages stop having one or two inbound links. | 2027-02-28 |
| 2026-11-05 | FAQ and vs pages link to each other through one list (lib/relatedLinks.ts): every competitor page, 24 FAQ and explainer pages. All 12 languages from the same day. Sitemap lastmod regenerated. No reindex request sent with it. | 01d512d8a | Search Console's Links report shows internal links to the 15 competitor pages that had none from an FAQ page. Competitor pages with no impressions start showing some by 28 Feb 2027. No rank claim: this spreads authority, it doesn't create it. | 2027-02-28 |
| 2026-11-05 | All 18 new tools and the /tools hub translated into the 11 other languages, with language addresses and hreflang. Spoken scripts stay in English, because they are read to US leads. | this commit | The tools appear in Search Console under language URLs by 28 Feb 2027, first in Spanish and Portuguese. Competition for these phrases is thinner in other languages (ch 21). No rank claim. | 2027-02-28 |

Add a row before every SEO change ships, not after. **Never ship a big change and a reindex request together**: the reindex will take the credit (ch 22).

---

## Predictions (Appendix F: falsifiable, dated, with confidence)

1. **New matchups get found.** By 31 Jan 2027, at least 8 of the 17 pages added on 4 Nov show Search Console impressions for their own "a vs b" query. *~70%.* Check: Pages report, filtered to `/vs/`.
2. **No links, no climb.** Without editorial link work, the average position of non-brand queries is still worse than 8 on 31 Jan 2027. *~80%.* This is the book's central claim (ch 23) applied here. If position improves anyway, the authority argument is wrong for this site.
3. **Links move the US first.** If 20 or more editorial referring domains arrive by 31 Mar 2027, US non-brand average position improves by at least 2 places within four months of the last one. *~55%* (ch 21).
4. **Assistants stay a floor.** AI-assistant referrals stay under 1% of anonymous page views through 30 Jun 2027. *~70%.* Today they are 0.
5. **The FAQ removal costs nothing.** Non-brand clicks in the 28 days after Search Console has recrawled the changed pages stay inside the noise band of the 28 days before. *~85%.*
6. **The weekly-billing sentence takes.** By 30 Apr 2027, at least two of the five assistants, asked "dialer with no contract" in a fresh session, name DialerSeat or describe weekly billing. *~35%,* and the one I most expect to lose. Corpora update slowly (ch 13).

Each future review reports all six, including the ones that turned out wrong.

---

## The weekly routine (15 minutes, Mondays)

**1. Each channel on its own, looking for zeros (ch 22).** A blended total hides a dead channel; Bing sat near zero all autumn. Run in Supabase:

```sql
with v as (
  select *,
    case
      when referrer_host ~ '(^|\.)google\.' and referrer_host not in ('accounts.google.com','mail.google.com') then 'google'
      when referrer_host ~ 'bing\.com' then 'bing'
      when referrer_host ~ '(duckduckgo|search\.brave|yahoo|ecosia|yandex)' then 'other search'
      when referrer_host ~ '(chatgpt|openai|perplexity|claude\.ai|gemini|copilot)' then 'ai assistants'
      when referrer_host ~ '(instagram|facebook|t\.co|x\.com|linkedin|reddit|youtube)' then 'social'
      when referrer_host is null then 'direct'
      else 'other'
    end as channel
  from page_views
  where not coalesce(is_authed, false) and not coalesce(is_admin, false)
    and created_at > now() - interval '8 weeks'
)
select date_trunc('week', created_at)::date as week, channel, count(*) as views
from v group by 1, 2 order by 1, 2;
```

A channel that drops to zero for a week is a cliff, which means something technical: read that engine's console, then resubmit the sitemap and request reindexing, then check robots, DNS and the certificate. A slow decline is ranking; wait it out (ch 14, 22).

**2. Compare 28-day windows only (ch 15).** At about 25 views a day, anything shorter is noise. Act only on a change you decided in advance would matter, for example 20% held for 14 days. A rough band: take the last 60 days of daily views; mean ± 2 standard deviations is ordinary.

**3. The page check before any marketing deploy (ch 38):** `node scripts/seo-check.mjs` against the preview URL.

---

## Monthly (first Monday)

**Search Console export**, longest range, kept in `docs/seo/` with the date in the filename: Queries.csv, Pages.csv, Countries.csv, Devices.csv, plus Search appearance. With it:
- Split brand ("dialerseat", "dialer seat", "dialerseat login") from everything else before reading any click-through number (ch 9, 16).
- List pages over 5,000 impressions and under 1% CTR (ch 17).
- Classify every page as on-page (position 20+), snippet (position 1–5, CTR under ~3%) or authority (position 6–20); compare the impressions behind each before planning the month (ch 23).
- Build DialerSeat's own position→CTR curve from non-brand queries: sum clicks and impressions per position band, never average CTRs, ignore bands under 5,000 impressions (Appendix D).
- Check Search appearance for "Translated results" (ch 21).
- Check **Manual actions** (ch 29). It's the only thing that makes a bad link profile urgent.

**AI prompt set (ch 13, 33).** The same ten questions every month, asked in a fresh, signed-out or history-free session to ChatGPT, Claude, Gemini, Perplexity and Copilot. Never change the questions, or there's no trend. Record per answer: named (y/n), position in the list, the exact phrase used to describe DialerSeat.

1. What's the best dialer for insurance agents?
2. What's a predictive dialer I can use without a contract?
3. What are the cheapest alternatives to ReadyMode?
4. What are good alternatives to Mojo Dialer for real estate?
5. Is there a power dialer I can pay for by the week?
6. Which auto dialer works with GoHighLevel leads?
7. What's the best dialer for a small call center with 5 agents?
8. How do I stop my outbound calls showing "Spam Likely"?
9. What dialer should an offshore VA team use?
10. PhoneBurner vs Kixie vs DialerSeat: which should I pick?

If DialerSeat is named but described generically, the fix is the sentence, not more posting: make the weekly-billing line the one thing every page and post repeats.

**Brand check (ch 9, 27).** Search "dialerseat", "dialer seat", "dialerseat login" and "dialer.io" logged out. Note who ranks first, who gets sitelinks, and whether any result for our name belongs to someone else.

---

## Quarterly, or when the data doubles (ch 36)

- Re-run the 4 Nov audit with the same scripts, not from memory: `scripts/seo-check.mjs`, plus the autocomplete pass used for `docs/seo/baseline-2026-11-04/autocomplete.json`. Compare against `baseline-2026-11-04/pages.csv`. Changed definitions can't be compared.
- A teardown of one competitor (ch 27), ending in one sentence: "they beat us because ___".
- The 23 matchup pages that never appeared in autocomplete: after 120 days, split by Search Console impressions. None means no demand (leave or merge); impressions without clicks means rewrite the title (ch 37).
