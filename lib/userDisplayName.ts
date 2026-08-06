import { getServiceClient } from '@/lib/supabase'

// =============================================================================
// USER DISPLAY NAME — for notification copy
// =============================================================================
// Admin notifications are only useful if they say WHO. "A customer paused
// their subscription" is a fact; "Marcus Alvarez paused their subscription" is
// something you can act on before the window closes.
//
// NOTE: app/api/stripe/webhook/route.ts has its own private copy of this
// logic. It is deliberately left alone — that file is the billing path, it
// works, and a pure-refactor edit there buys nothing. If it ever needs
// touching for another reason, collapse it into this.
// =============================================================================

const supabase = getServiceClient('userDisplayName')

export interface UserIdentity {
  name: string
  email: string | null
}

/**
 * Best available human label for a Clerk user.
 *
 * Falls back through full name -> email local-part -> a generic string, so
 * the caller never has to handle a null and a notification never renders as
 * "undefined paused their subscription".
 */
export async function lookupUserIdentity(clerkId: string): Promise<UserIdentity> {
  try {
    const { data } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    if (!data) return { name: 'A customer', email: null }

    const full = `${data.first_name || ''} ${data.last_name || ''}`.trim()
    return {
      name: full || data.email?.split('@')[0] || 'A customer',
      email: data.email ?? null,
    }
  } catch {
    // Never let a name lookup be the reason a notification doesn't send.
    return { name: 'A customer', email: null }
  }
}
