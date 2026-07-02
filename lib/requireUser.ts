import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'






























export type RequireUserResult =
  | { ok: true; userId: string; response: null }
  | { ok: false; userId: null; response: NextResponse }


export async function requireUser(): Promise<RequireUserResult> {
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false,
      userId: null,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }
  return { ok: true, userId, response: null }
}


export async function requireUserMatching(
  requested: string | null | undefined
): Promise<RequireUserResult> {
  const gate = await requireUser()
  if (!gate.ok) return gate

  
  
  
  if (requested && requested !== gate.userId) {
    return {
      ok: false,
      userId: null,
      response: NextResponse.json(
        { success: false, error: 'Forbidden: user mismatch' },
        { status: 403 }
      ),
    }
  }
  return gate
}