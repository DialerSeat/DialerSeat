
























const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const API = 'https://api.vercel.com'

export interface DomainOpResult {
  ok: boolean
  skipped?: boolean        // true when config missing — caller can ignore
  alreadyExisted?: boolean // add: domain was already on the project
  notFound?: boolean       // remove: domain wasn't on the project
  status?: number
  error?: string
}

function fqdn(slug: string): string {
  return `${slug}.${ROOT_DOMAIN}`
}

function teamQuery(): string {
  const team = process.env.VERCEL_TEAM_ID
  return team ? `?teamId=${encodeURIComponent(team)}` : ''
}

function config(): { token: string; projectId: string } | null {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return null
  return { token, projectId }
}


export async function addProjectDomain(slug: string): Promise<DomainOpResult> {
  const cfg = config()
  if (!cfg) {
    console.warn('[vercelDomains] add skipped — VERCEL_API_TOKEN/PROJECT_ID not set')
    return { ok: false, skipped: true, error: 'vercel_not_configured' }
  }

  const name = fqdn(slug)
  try {
    const res = await fetch(
      `${API}/v10/projects/${cfg.projectId}/domains${teamQuery()}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      }
    )

    if (res.ok) {
      return { ok: true, status: res.status }
    }

    
    const data = await res.json().catch(() => ({} as any))
    const code = data?.error?.code || ''
    if (
      res.status === 409 ||
      code === 'domain_already_in_use' ||
      code === 'domain_already_exists'
    ) {
      return { ok: true, alreadyExisted: true, status: res.status }
    }

    console.error(`[vercelDomains] add failed for ${name}:`, res.status, data?.error)
    return { ok: false, status: res.status, error: data?.error?.message || `http_${res.status}` }
  } catch (err: any) {
    console.error(`[vercelDomains] add threw for ${name}:`, err?.message)
    return { ok: false, error: err?.message || 'fetch_failed' }
  }
}


export async function removeProjectDomain(slug: string): Promise<DomainOpResult> {
  const cfg = config()
  if (!cfg) {
    console.warn('[vercelDomains] remove skipped — VERCEL_API_TOKEN/PROJECT_ID not set')
    return { ok: false, skipped: true, error: 'vercel_not_configured' }
  }

  const name = fqdn(slug)
  try {
    const res = await fetch(
      `${API}/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(name)}${teamQuery()}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${cfg.token}` },
      }
    )

    if (res.ok || res.status === 204) {
      return { ok: true, status: res.status }
    }

    if (res.status === 404) {
      return { ok: true, notFound: true, status: res.status }
    }

    const data = await res.json().catch(() => ({} as any))
    console.error(`[vercelDomains] remove failed for ${name}:`, res.status, data?.error)
    return { ok: false, status: res.status, error: data?.error?.message || `http_${res.status}` }
  } catch (err: any) {
    console.error(`[vercelDomains] remove threw for ${name}:`, err?.message)
    return { ok: false, error: err?.message || 'fetch_failed' }
  }
}


export async function changeProjectDomain(
  oldSlug: string,
  newSlug: string
): Promise<{ added: DomainOpResult; removedOld: DomainOpResult }> {
  const added = await addProjectDomain(newSlug)
  
  let removedOld: DomainOpResult = { ok: false, skipped: true }
  if (added.ok) {
    removedOld = await removeProjectDomain(oldSlug)
  } else {
    console.error(
      `[vercelDomains] not removing old slug ${oldSlug} because new slug ${newSlug} add failed`
    )
  }
  return { added, removedOld }
}