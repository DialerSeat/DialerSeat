// =============================================================================
// LOCAL TEST IDENTITY — never active in a deployed build
// =============================================================================
// The Clerk project has production keys only, and those cannot sign anybody in
// on localhost. To walk the signed-in console while building, `next dev` can
// act as one fixed test user. All three must hold:
//   - NODE_ENV is not 'production' (every `next build`, so every Vercel
//     deployment, is production, so this is dead code there),
//   - DEV_PLATFORM_STORE=local (the throwaway JSON file, never Supabase),
//   - DEV_LOCAL_TEST_USER is set.
// Edge-safe: no Node imports, so proxy.ts can use it too.
// =============================================================================

export function localTestUser(): string | null {
  if (process.env.NODE_ENV === 'production') return null
  if (process.env.VERCEL_ENV) return null
  if (process.env.DEV_PLATFORM_STORE !== 'local') return null
  const id = process.env.DEV_LOCAL_TEST_USER
  return id && /^[\w-]{3,64}$/.test(id) ? id : null
}
