import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const VALID_MODES = ['preview', 'power', 'progressive', 'predictive'] as const
type DialerMode = typeof VALID_MODES[number]

export async function POST(req: Request) {
  try {
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, dialer_mode, amd_enabled, predictive_lines_per_agent, voicemail_drop_url } = body

    let finalName = (typeof name === 'string' ? name.trim() : '')
    if (!finalName) {
      const { data: existing } = await supabaseAdmin
        .from('campaigns')
        .select('name')
        .eq('user_id', userId)
        .ilike('name', 'Untitled%')
      const taken = new Set((existing || []).map(c => (c.name || '').trim()))
      if (!taken.has('Untitled')) {
        finalName = 'Untitled'
      } else {
        let n = 1
        while (taken.has(`Untitled (${n})`)) n++
        finalName = `Untitled (${n})`
      }
    }

    const mode: DialerMode = dialer_mode && VALID_MODES.includes(dialer_mode)
      ? dialer_mode
      : 'power'

    const amdDefault = mode === 'progressive' || mode === 'predictive'
    const amdEnabled = typeof amd_enabled === 'boolean' ? amd_enabled : amdDefault

    let lines = 1.5
    if (typeof predictive_lines_per_agent === 'number') {
      lines = Math.max(1.0, Math.min(3.0, predictive_lines_per_agent))
    }

    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({
        user_id: userId,
        name: finalName,
        status: 'active', // new campaigns are active by default
        dialer_mode: mode,
        amd_enabled: amdEnabled,
        predictive_lines_per_agent: lines,
        voicemail_drop_url: voicemail_drop_url || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    return apiError(error, { route: 'campaigns/create' })
  }
}