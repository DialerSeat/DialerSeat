export interface CallabilityResult {
  allowed: boolean
  reason?: string
  retryAfter?: Date  // earliest time when this lead becomes callable again
  leadState?: string
  leadTimezone?: string
  leadLocalTime?: string
}

interface LeadInput {
  phone: string
  state?: string | null  // explicit state column from leads table (optional)
}

export function isCallableNow(_lead: LeadInput): CallabilityResult {
  return { allowed: true }
}
