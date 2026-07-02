




















import { requireAdmin as requireAdminGate, checkIsAdmin } from '@/lib/requireAdmin'

export { checkIsAdmin }


export async function requireAdmin(): Promise<{ userId: string }> {
  const gate = await requireAdminGate()
  if (!gate.ok) {
    throw new Response(JSON.stringify({ error: gate.message }), {
      status: gate.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { userId: gate.clerkId }
}