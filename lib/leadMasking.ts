import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────
// KEEPING A LEAD LIST FROM WALKING OUT THE DOOR
//
// A lead vendor hands a list to closers they do not employ. Every phone number
// on screen is a number that can be copied into a notes app, and a stolen list
// is the vendor's whole business. So a campaign can be set to hide numbers, and
// an agent sees the person — name, state, whatever else — but not how to reach
// them outside DialerSeat.
//
// ONE HELPER, CALLED BY EVERY READ PATH. A rule enforced in the queue panel and
// forgotten in the campaign page or the CSV is not a rule, it is an
// inconvenience with a workaround — and the workaround is exactly what the
// person trying to steal the list will look for first.
//
// The owner is never masked. It is their list.
// ─────────────────────────────────────────────────────────────────────────

/** Last four only. Enough for an agent to confirm they are on the right call
 *  when a number is read back to them, useless for exfiltrating a list. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 4) return '•••'
  return `(•••) •••-${digits.slice(-4)}`
}

export interface MaskDecision {
  mask: boolean
  campaignId: string | null
}

/**
 * May this viewer see phone numbers on this campaign?
 *
 * Fails OPEN — a lookup failure returns "do not mask". Deliberate: the
 * alternative is a dialer that silently stops being able to place calls
 * because a settings read timed out. Masking is theft deterrence, not a
 * security boundary against the platform itself, and breaking dialing to
 * enforce it would cost the vendor far more than the risk it prevents.
 */
export async function shouldMaskCampaign(
  campaignId: string | null | undefined,
  viewerClerkId: string
): Promise<boolean> {
  if (!campaignId) return false

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('user_id, mask_lead_numbers')
    .eq('id', campaignId)
    .maybeSingle()

  if (error || !data) return false
  if (!data.mask_lead_numbers) return false

  // Their own list. Never hidden from them.
  return data.user_id !== viewerClerkId
}

/** Which of these campaigns hide numbers from this viewer. One query for a
 *  whole queue rather than one per lead. */
export async function maskedCampaignIds(
  campaignIds: string[],
  viewerClerkId: string
): Promise<Set<string>> {
  const unique = Array.from(new Set(campaignIds.filter(Boolean)))
  if (unique.length === 0) return new Set()

  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .select('id, user_id, mask_lead_numbers')
    .in('id', unique)

  if (error || !data) return new Set()

  return new Set(
    data
      .filter((c: any) => c.mask_lead_numbers && c.user_id !== viewerClerkId)
      .map((c: any) => c.id)
  )
}

/**
 * Strip the real number out of a lead before it leaves the server.
 *
 * The masked value replaces `phone` rather than sitting beside it. Returning
 * both would put the real number in the network response, where anyone who
 * knows to open devtools can read it — which is the entire population this
 * setting exists to stop.
 */
export function maskLeadRow<T extends Record<string, any>>(lead: T): T {
  return {
    ...lead,
    phone: maskPhone(lead.phone),
    phone_masked: true,
  }
}

/**
 * Which of these leads has this viewer already CALLED?
 *
 * Masking exists to stop a list being copied out before it is worked. Once an
 * agent has dialled a lead, the number has been in their ear and on their
 * screen anyway — continuing to hide it protects nothing and costs them the
 * ability to call somebody back, check a wrong number, or read their own
 * history. So the number is theirs from the moment they have used it.
 *
 * Scoped to the VIEWER'S own calls. Somebody else having dialled a lead does
 * not unmask it: what is being extended is "you have worked this", not "this
 * has been worked".
 */
export async function dialedLeadIds(
  viewerClerkId: string,
  leadIds: string[]
): Promise<Set<string>> {
  const unique = Array.from(new Set(leadIds.filter(Boolean)))
  if (unique.length === 0) return new Set()

  const { data, error } = await supabaseAdmin
    .from('calls')
    .select('lead_id')
    .eq('user_id', viewerClerkId)
    .in('lead_id', unique)

  // Fails CLOSED here, unlike shouldMaskCampaign. A lookup failure means we
  // cannot prove they dialled it, and the safe answer to "may they see this
  // number" is no. Nothing breaks: dialing does not depend on this.
  if (error || !data) return new Set()

  return new Set(data.map((r: any) => r.lead_id).filter(Boolean))
}
