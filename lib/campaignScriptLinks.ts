import { supabaseAdmin } from '@/lib/supabase'

export interface CampaignScriptSummary {
  id: string
  name: string
  body: string
}

/**
 * Loads each campaign's enabled scripts (campaign_script_links + scripts) as
 * a flat map of campaignId -> scripts, in sort_order.
 *
 * Deliberately avoids PostgREST's nested/embedded select syntax
 * (`campaign_script_links.select('..., scripts(id, name, body)')`) in favor
 * of two flat queries joined in JS here. The embedded form depends on
 * PostgREST having picked up the campaign_script_links -> scripts foreign
 * key in its schema cache, and a failure there comes back as an empty embed
 * with no error surfaced anywhere — which is exactly what made the dialer's
 * script box quietly show nothing. See app/api/campaigns/list/route.ts.
 */
export async function loadScriptsByCampaign(
  campaignIds: string[]
): Promise<Record<string, CampaignScriptSummary[]>> {
  if (campaignIds.length === 0) return {}

  const { data: links, error: linksError } = await supabaseAdmin
    .from('campaign_script_links')
    .select('campaign_id, script_id, sort_order')
    .in('campaign_id', campaignIds)
    .order('sort_order', { ascending: true })

  if (linksError) {
    console.error('loadScriptsByCampaign: failed to load campaign_script_links', linksError)
  }

  const scriptIds = Array.from(new Set((links || []).map(l => l.script_id)))
  if (scriptIds.length === 0) return {}

  const { data: scripts, error: scriptsError } = await supabaseAdmin
    .from('scripts')
    .select('id, name, body')
    .in('id', scriptIds)

  if (scriptsError) {
    console.error('loadScriptsByCampaign: failed to load scripts', scriptsError)
  }

  const scriptById = new Map((scripts || []).map(s => [s.id, s]))
  const byCampaign: Record<string, CampaignScriptSummary[]> = {}
  for (const l of links || []) {
    const sc = scriptById.get(l.script_id)
    if (!sc) continue
    ;(byCampaign[l.campaign_id] ||= []).push({ id: sc.id, name: sc.name, body: sc.body })
  }
  return byCampaign
}
