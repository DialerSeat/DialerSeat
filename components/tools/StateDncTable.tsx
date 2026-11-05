import { ToolStyles } from './kit'

// =============================================================================
// STATE DO NOT CALL LISTS
// =============================================================================
// Eleven states compliance vendors name as keeping their own list, each checked
// on the state's own site on 2026-11-05. Vendor pages disagree with each other
// and many are years old, so nothing here comes from them. Where a state's site
// did not give a current price, the row says so instead of carrying an old one.
// Mississippi is left out: only a vendor says it folded into the federal list.
// =============================================================================

export interface StateList {
  state: string
  runBy: string
  cost: string
  refresh: string
  note?: string
  source: string
}

export const STATE_LISTS: StateList[] = [
  {
    state: 'Colorado', runBy: 'Public Utilities Commission, through a designated agent',
    cost: 'Annual fee paid to the agent: amount not confirmed, ask the agent',
    refresh: 'Not confirmed',
    note: 'Separate from registering as a commercial telephone seller with the Attorney General ($200 first filing, $100 renewal). Doing one does not cover the other.',
    source: 'https://puc.colorado.gov/coloradonocall',
  },
  {
    state: 'Florida', runBy: 'Department of Agriculture and Consumer Services',
    cost: '$30 per area code or $100 statewide per quarter; $120 or $400 per year (undated state order form, check at checkout)',
    refresh: 'Quarterly',
    note: 'Bought online by card, then downloaded. Section 501.059, Florida Statutes.',
    source: 'https://www.fdacs.gov/Business-Services/Florida-Do-Not-Call',
  },
  {
    state: 'Indiana', runBy: 'Attorney General',
    cost: '$750 per year, four lists included',
    refresh: 'Quarterly',
    note: 'Telephone solicitors must also register before doing business in Indiana. The Attorney General lists exemptions including licensed insurance agents soliciting an application, and licensed realtors under conditions.',
    source: 'https://www.in.gov/attorneygeneral/consumer-protection-division/id-theft-prevention/do-not-call/telephone-solicitors/',
  },
  {
    state: 'Louisiana', runBy: 'Public Service Commission',
    cost: 'Current fee not confirmed. A 2006 order set $400 for the list and $400 or $800 to register, and allows revision',
    refresh: 'Not confirmed',
    note: 'Solicitors register with the Commission to get the list.',
    source: 'https://lpsc.louisiana.gov/DNC_ConsumerFAQ',
  },
  {
    state: 'Massachusetts', runBy: 'Office of Consumer Affairs and Business Regulation, through a vendor',
    cost: '$1,100 per year',
    refresh: 'Quarterly: 1 Jan, 1 Apr, 1 Jul, 1 Oct',
    note: 'A subscription ends on 31 December whenever it began. Applies to out-of-state callers too.',
    source: 'https://www.mass.gov/info-details/do-not-call-registry-for-residents-and-businesses',
  },
  {
    state: 'Missouri', runBy: 'Attorney General',
    cost: '$50 per area code per quarter; all six for $300 a quarter or $1,200 a year',
    refresh: 'Quarterly: 1 Mar, 1 Jun, 1 Sep, 1 Dec',
    note: 'Up to $5,000 for each knowing violation. The copy may not be passed on.',
    source: 'https://ago.mo.gov/get-help/no-call/faqs-for-telemarketers/',
  },
  {
    state: 'Oklahoma', runBy: 'Attorney General',
    cost: '$150 per quarter or $600 per year',
    refresh: 'Quarterly, 30 days to remove numbers',
    note: 'Non-exempt telemarketers must also register, pay a fee and post a bond under the Commercial Telephone Solicitation Act.',
    source: 'https://oklahoma.gov/oag/resources/telemarketer-restriction-act.html',
  },
  {
    state: 'Pennsylvania', runBy: 'Attorney General, with the list kept by a contracted nonprofit',
    cost: 'Price not confirmed, ask the list administrator',
    refresh: 'Quarterly, 30 days to remove numbers',
    note: 'Telemarketers must also register with the Attorney General and post a $50,000 bond or deposit.',
    source: 'https://www.attorneygeneral.gov/protect-yourself/do-not-call',
  },
  {
    state: 'Tennessee', runBy: 'Public Utility Commission',
    cost: '$500 per year, due 1 May for 1 July to 30 June; $1,000 plus $50 per solicitor for a group',
    refresh: 'Monthly, 30 days to remove numbers',
    note: 'Covers text messages since 2023. Fines up to $2,000 per incident.',
    source: 'https://www.tn.gov/tpuc/tennessee-do-not-call-program/csd-tn-do-not-call-telemarketer-faqs.html',
  },
  {
    state: 'Texas', runBy: 'Public Utility Commission, at texasnocall.com',
    cost: '$75 per quarter',
    refresh: 'Quarterly: 1 Jan, 1 Apr, 1 Jul, 1 Oct, 60 days to update',
    source: 'https://www.puc.texas.gov/consumer/phone/telemarket_faq.aspx',
  },
  {
    state: 'Wyoming', runBy: 'No state-run list: the law points at a private list, the DMA’s, enforced by the Attorney General',
    cost: 'Not stated. Joining or subscribing to the DMA list is not required, but you may not call numbers on it',
    refresh: 'Not stated',
    note: 'Normally applies above 225 unsolicited sales calls a year. Each solicitor must also file a notice with the Attorney General.',
    source: 'https://attorneygeneral.wyo.gov/law-office-division/consumer-protection-and-antitrust-unit/telephone-solicitation-for-businesses',
  },
]

export default function StateDncTable() {
  return (
    <div className="tk">
      <ToolStyles />
      <style>{`
        @media (max-width: 640px) {
          .sdnc thead { display: none; }
          .sdnc tr, .sdnc td { display: block; }
          .sdnc tr { padding: 12px 4px; border-bottom: 1px solid #d6dbe3; }
          .sdnc td { border: 0; padding: 4px 8px; }
          .sdnc td:nth-child(2)::before { content: 'Who runs it: '; font-weight: 700; }
          .sdnc td:nth-child(3)::before { content: 'Cost: '; font-weight: 700; }
          .sdnc td:nth-child(4)::before { content: 'Refreshed: '; font-weight: 700; }
        }
      `}</style>
      <div className="tk-tablewrap" style={{ maxHeight: 'none' }}>
        <table className="tk-table sdnc">
          <thead>
            <tr><th>State</th><th>Who runs it</th><th>What telemarketers pay</th><th>Refreshed</th></tr>
          </thead>
          <tbody>
            {STATE_LISTS.map((s) => (
              <tr key={s.state}>
                <td>
                  <b>{s.state}</b><br />
                  <a href={s.source} target="_blank" rel="noopener noreferrer">State’s page</a>
                </td>
                <td>{s.runBy}</td>
                <td>{s.cost}{s.note && <div className="tk-hint">{s.note}</div>}</td>
                <td>{s.refresh}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tk-foot">
        Read from each state’s own site on 5 November 2026. Fees and rules change, so confirm with the state before you pay or dial. This is not legal advice.
      </p>
    </div>
  )
}
