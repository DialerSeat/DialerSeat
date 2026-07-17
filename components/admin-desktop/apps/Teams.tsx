'use client'
import TeamsManager from '@/components/teams/TeamsManager'

// This used to be an ~2,000-line copy-pasted duplicate of the owner-facing
// teams page — same interfaces, same API calls, same everything, just
// pasted a second time so it could run inside the admin desktop shell.
// That's exactly the kind of duplication that let the subscription-active
// bug (fixed earlier this session) exist in two places at once instead of
// one. It's also never actually shown "every team on the platform" the way
// its old registry description claimed — it calls the same
// /api/teams/list?detail=owned as the owner page, scoped to whichever
// account is logged in, so an admin only sees teams they personally own or
// belong to. There was no real distinct behavior here to preserve.
export default function TeamsApp() {
  return <TeamsManager />
}
