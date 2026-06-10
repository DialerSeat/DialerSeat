import { redirect } from 'next/navigation'

// =============================================================================
// /dashboard/teams/[id] — REDIRECT TO /analytics
// =============================================================================
// Backward-compat shim. The old route at this exact URL was a misplaced
// route.ts API handler (now moved to /api/teams/[id]/analytics). This
// file ensures anyone who bookmarked /dashboard/teams/[id] or follows an
// older link lands on the new analytics page rather than a 404.
//
// IMPORTANT FOR DEPLOY: the old file at app/dashboard/teams/[id]/route.ts
// MUST be deleted from the local filesystem before pushing. Next.js
// App Router does not allow a page.tsx and a route.ts to coexist in the
// same segment — leaving the old route.ts will break this redirect.
// =============================================================================

export default async function TeamRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/teams/${id}/analytics`)
}