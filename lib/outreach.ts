// =============================================================================
// OUTREACH LIST HYGIENE
// =============================================================================
// Everything here exists to stop bad addresses reaching a send, because the two
// things that kill a sending domain fastest are bounces and complaints, and
// both are decided before the first email goes out — by what is on the list.
//
// A bounce rate over a few percent tanks domain reputation, and role accounts
// (info@, sales@) are read by several people, none of whom asked to hear from
// you, which is where complaints come from. Neither problem is fixable later.
// =============================================================================

/**
 * Lowercased and trimmed. Stored this way everywhere so suppression lookups
 * cannot miss on capitalisation — "Bob@X.com" unsubscribing must suppress
 * "bob@x.com", because they are the same mailbox.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Practical validation, not RFC 5322. The full grammar accepts addresses no
 * real mailbox uses and rejecting valid-but-exotic ones costs less than letting
 * malformed ones through to bounce.
 */
const EMAIL_RE = /^[^\s@,;<>()[\]\\]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i

export function isPlausibleEmail(email: string): boolean {
  if (email.length < 6 || email.length > 254) return false
  if (email.includes('..')) return false
  return EMAIL_RE.test(email)
}

/**
 * Shared mailboxes. Not invalid — just the wrong thing to cold-email: read by
 * several people, none of whom is the person you want, and the one most likely
 * to hit "report spam" rather than reply.
 */
const ROLE_PREFIXES = new Set([
  'abuse', 'admin', 'administrator', 'billing', 'careers', 'compliance',
  'contact', 'enquiries', 'feedback', 'help', 'hello', 'hr', 'info',
  'inquiries', 'jobs', 'legal', 'mail', 'mailer-daemon', 'marketing', 'media',
  'newsletter', 'noc', 'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'office', 'postmaster', 'press', 'privacy', 'root', 'sales', 'security',
  'service', 'support', 'team', 'webmaster',
])

export function isRoleAccount(email: string): boolean {
  const local = email.split('@')[0] ?? ''
  return ROLE_PREFIXES.has(local)
}

export interface ParsedContact {
  email: string
  name?: string
  company?: string
}

/**
 * Turn whatever got pasted into contacts.
 *
 * Deliberately tolerant, because the input is a human pasting from a spreadsheet,
 * a CRM export, or their own inbox, and refusing the whole batch over one odd
 * line would just mean the cleaning happens by hand instead. Understood shapes:
 *
 *   bob@x.com
 *   Bob Smith <bob@x.com>
 *   bob@x.com, Bob Smith, Acme Ltd
 *   bob@x.com; jane@y.com
 *   "Bob Smith","bob@x.com","Acme"
 *
 * Anything with no recognisable address is returned as a reject with its line,
 * so the import can show what it could not read rather than silently dropping it.
 */
export function parseContacts(input: string): {
  contacts: ParsedContact[]
  unreadable: string[]
} {
  const contacts: ParsedContact[] = []
  const unreadable: string[] = []
  const seen = new Set<string>()

  for (const rawLine of input.split(/[\r\n]+/)) {
    const line = rawLine.trim()
    if (!line) continue

    // Angle-bracket form first: the name sits outside the brackets, so pulling
    // the address out this way keeps the name instead of discarding it.
    const angle = /^(.*?)<\s*([^>]+?)\s*>$/.exec(line)
    if (angle) {
      const email = normalizeEmail(angle[2])
      if (isPlausibleEmail(email) && !seen.has(email)) {
        seen.add(email)
        contacts.push({ email, name: cleanField(angle[1]) })
      }
      continue
    }

    // Otherwise split on the usual delimiters and find the address among the
    // fields, rather than assuming it is first — exports disagree about order.
    const fields = line.split(/[,;\t]/).map(f => cleanField(f)).filter(Boolean) as string[]
    const emailIdxs = fields
      .map((f, i) => (isPlausibleEmail(normalizeEmail(f)) ? i : -1))
      .filter(i => i !== -1)

    // A line carrying SEVERAL addresses is a list, not one contact with
    // metadata. Taking only the first would drop every address after it and
    // file the second one as somebody's name — silently, which is the worst
    // way for an import to lose data.
    if (emailIdxs.length > 1) {
      for (const i of emailIdxs) {
        const email = normalizeEmail(fields[i])
        if (seen.has(email)) continue
        seen.add(email)
        contacts.push({ email })
      }
      continue
    }

    const emailIdx = emailIdxs.length === 1 ? emailIdxs[0] : -1

    if (emailIdx === -1) {
      // A line with several addresses and no delimiters we split on — take them
      // all rather than calling the line unreadable.
      const loose = line.match(/[^\s@,;<>()[\]\\]+@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}/gi)
      if (loose && loose.length) {
        for (const m of loose) {
          const email = normalizeEmail(m)
          if (isPlausibleEmail(email) && !seen.has(email)) {
            seen.add(email)
            contacts.push({ email })
          }
        }
      } else {
        unreadable.push(line.slice(0, 120))
      }
      continue
    }

    const email = normalizeEmail(fields[emailIdx])
    if (seen.has(email)) continue
    seen.add(email)

    // Remaining fields, in order: first is treated as a name, second as a
    // company. A guess, but a recoverable one — both are optional everywhere.
    const rest = fields.filter((_, i) => i !== emailIdx)
    contacts.push({
      email,
      name: rest[0],
      company: rest[1],
    })
  }

  return { contacts, unreadable }
}

/** Trim, drop surrounding quotes, and treat an empty result as absent. */
function cleanField(v: string | undefined): string | undefined {
  if (!v) return undefined
  const s = v.trim().replace(/^["']|["']$/g, '').trim()
  return s.length ? s.slice(0, 200) : undefined
}

/**
 * The unsubscribe URL for one contact.
 *
 * Per-recipient and embedded by the SENDING tool, whichever that is. Keeping
 * the link pointed at this app rather than at a vendor is what makes the
 * suppression list authoritative: switch sending tools and every previously
 * issued link still works, and still lands in the same table.
 */
export function unsubscribeUrl(token: string, origin = 'https://dialerseat.com'): string {
  return `${origin}/u/${token}`
}
