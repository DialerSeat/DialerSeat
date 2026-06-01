// app/api/whitelabel/available-tenants/route.ts
// =============================================================================
// LIST AVAILABLE TENANTS (settings page toggle)
// =============================================================================
// GET /api/whitelabel/available-tenants
//
// Returns the brand options available to this user, plus their currently-
// selected one. The settings page uses this to render the toggle.
//
// Response:
//   {
//     available: [{ id, slug, brand_name, logo_url, role }, ...],
//     canSeeStandard: boolean,
//     currentTenantId: string | null,
//   }
//
// The settings page decides whether to render the toggle at all based on:
//   shouldShow = available.length > 1 || canSeeStandard
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAvailableTenantsForUser } from '@/lib/tenant'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const options = await getAvailableTenantsForUser(userId)
  return NextResponse.json(options)
}