// =============================================================================
// CONSOLE SEARCH
// =============================================================================
// Runs in the browser over a few hundred entries (lib/developers/searchIndex),
// so every keystroke is a full rescore with no server round trip.
//
// An obscure query has to land. That takes more than substring matching:
//   - stems:     "rotating keys"     → rotate, key
//   - synonyms:  "contacts"          → leads; "widget" → miniplayer
//   - typos:     "webhok", "dispostion", "predictve"
//   - prefixes:  "sig"               → signature, signing secret
//   - paths:     "POST /seats/{id}/sessions", "dsk_live", "402"
//   - coverage:  an entry matching every word beats one matching a single
//                word very well
// Field weights put a title match above a keyword match above body text.
// =============================================================================

export interface SearchEntry {
  id: string
  title: string
  /** Breadcrumb shown under the title, e.g. "Docs › Webhooks". */
  section: string
  kind: 'page' | 'setting' | 'doc' | 'endpoint' | 'event' | 'concept'
  href: string
  keywords?: string[]
  body?: string
  /** Small nudge for the entries people most often mean. */
  boost?: number
}

export interface SearchResult {
  entry: SearchEntry
  score: number
  /** Best-matching sentence from the body, if the body matched. */
  snippet?: string
  /** Query terms (and their matched forms) for highlighting. */
  terms: string[]
}

const STOP = new Set([
  'a', 'an', 'the', 'to', 'of', 'for', 'how', 'do', 'does', 'i', 'my', 'me', 'in', 'on', 'is', 'are',
  'be', 'can', 'what', 'where', 'which', 'with', 'and', 'or', 'it', 'its', 'from', 'by', 'at', 'this',
  'that', 'your', 'you', 'we', 'our', 'should', 'would', 'will', 'want', 'need', 'get', 'set', 'up',
  'there', 'when', 'why', 'into', 'about', 'any', 'way', 'find', 'show', 'see', 'much', 'many', 'so', 'just', 'than', 'then',
])

// Groups of words that mean the same thing to a developer. Every word in a
// group expands to every other. Kept as groups so a new synonym is one edit.
const SYNONYM_GROUPS: string[][] = [
  ['key', 'token', 'credential', 'secret', 'apikey', 'bearer'],
  ['revoke', 'delete', 'remove', 'disable', 'deactivate', 'kill', 'cancel'],
  ['rotate', 'regenerate', 'roll', 'reset', 'replace', 'new'],
  ['lead', 'contact', 'record', 'prospect', 'number', 'phone'],
  ['seat', 'user', 'agent', 'rep', 'member', 'caller', 'license'],
  ['webhook', 'hook', 'callback', 'event', 'notification', 'postback', 'listener'],
  ['miniplayer', 'widget', 'embed', 'iframe', 'portable', 'sdk', 'snippet', 'plugin', 'frame', 'mount'],
  ['disposition', 'outcome', 'result', 'wrapup', 'status', 'code'],
  ['billing', 'invoice', 'payment', 'pay', 'charge', 'price', 'pricing', 'cost', 'rate', 'plan', 'tier', 'subscription', 'money', 'card'],
  ['negotiate', 'discount', 'volume', 'sales', 'custom', 'enterprise', 'quote'],
  ['usage', 'metering', 'consumption', 'dials', 'minutes', 'volume'],
  ['dial', 'call', 'phone', 'ring', 'outbound'],
  ['mode', 'dialer', 'dialing', 'pacing'],
  ['exception', 'override', 'upgrade', 'special', 'per'],
  ['amd', 'machine', 'answering', 'voicemail', 'detection', 'beep'],
  ['dnc', 'donotcall', 'suppression', 'optout', 'unsubscribe', 'blocklist'],
  ['origin', 'domain', 'cors', 'whitelist', 'allowlist', 'host'],
  ['signature', 'signing', 'hmac', 'verify', 'dswh', 'authenticity'],
  ['test', 'sandbox', 'staging', 'development', 'dev', 'simulated', 'fake'],
  ['live', 'production', 'prod', 'real'],
  ['activate', 'enable', 'turn', 'start', 'launch', 'golive'],
  ['session', 'login', 'signin', 'sso', 'auth', 'authenticate', 'authentication', 'authorization'],
  ['campaign', 'list', 'queue'],
  ['error', 'fail', 'failure', 'problem', 'broken', 'denied', 'rejected', 'issue'],
  ['limit', 'throttle', 'ratelimit', 'quota', '429'],
  ['recording', 'audio', 'mp3', 'record'],
  ['setting', 'settings', 'config', 'configuration', 'preference', 'options'],
  ['overview', 'dashboard', 'home', 'summary'],
  ['docs', 'documentation', 'reference', 'guide', 'manual', 'help'],
  ['create', 'add', 'make', 'generate', 'post'],
  ['list', 'all', 'browse', 'get'],
  ['predictive', 'auto', 'autodialer'],
  ['power', 'autoadvance'],
  ['hours', 'window', 'time', 'timezone', 'tcpa', 'curfew'],
  ['platform', 'company', 'organization', 'org', 'account', 'workspace', 'tenant'],
  ['crm', 'hubspot', 'salesforce', 'highlevel', 'gohighlevel', 'pipedrive', 'zoho', 'app'],
  ['quickstart', 'started', 'begin', 'tutorial', 'setup', 'install', 'onboarding', 'integrate', 'integration'],
  ['reseller', 'whitelabel', 'oem', 'partner', 'rebrand'],
  ['independent', 'separate', 'linked', 'connected', 'shared', 'bleed', 'tied', 'same'],
]

const SYN = new Map<string, Set<string>>()
for (const group of SYNONYM_GROUPS) {
  const stems = group.map(stem)
  for (const w of stems) {
    if (!SYN.has(w)) SYN.set(w, new Set())
    for (const o of stems) if (o !== w) SYN.get(w)!.add(o)
  }
}

/** Light suffix stripping. Good enough to join "keys/key", "rotating/rotate", "dispositions/disposition". */
export function stem(word: string): string {
  let w = word
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 5 && w.endsWith('ing')) { w = w.slice(0, -3); return w.endsWith('at') || w.endsWith('ok') || w.endsWith('in') ? w + 'e' : w }
  if (w.length > 4 && w.endsWith('ed')) { w = w.slice(0, -2); return w.endsWith('at') ? w + 'e' : w }
  if (w.length > 4 && (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('sses') || w.endsWith('xes'))) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1)
  return w
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/** Restricted Damerau-Levenshtein (adjacent transpositions), early exit past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev2 = new Array(b.length + 1).fill(0)
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    for (let k = 0; k < prev.length; k++) prev2[k] = prev[k]
    prev = cur
  }
  return prev[b.length]
}

interface PreparedEntry {
  entry: SearchEntry
  title: string[]
  keywords: string[]
  section: string[]
  body: string[]
  titleText: string
  bodyText: string
  sentences: string[]
}

export interface SearchIndex {
  items: PreparedEntry[]
  /** Every distinct stemmed token across all entries. Query words are matched against this once. */
  vocab: string[]
}

const FIELD_WEIGHT = { title: 6, keywords: 3.5, section: 1.5, body: 1 } as const
const FIELDS = ['title', 'keywords', 'section', 'body'] as const

function uniqStems(text: string): string[] {
  return [...new Set(tokenize(text).map(stem))]
}

export function prepare(entries: SearchEntry[]): SearchIndex {
  const vocab = new Set<string>()
  const items = entries.map(entry => {
    const body = entry.body || ''
    const p: PreparedEntry = {
      entry,
      title: uniqStems(entry.title),
      keywords: uniqStems((entry.keywords || []).join(' ')),
      section: uniqStems(entry.section),
      body: uniqStems(body),
      titleText: entry.title.toLowerCase(),
      bodyText: body.toLowerCase(),
      sentences: body.split(/(?<=[.!?:])\s+/).filter(x => x.length > 0),
    }
    for (const f of FIELDS) for (const t of p[f]) vocab.add(t)
    return p
  })
  return { items, vocab: [...vocab] }
}

/** How well query word q matches index token t: 0 (no) to 1 (exact). */
function tokenMatch(q: string, t: string): number {
  if (t === q) return 1
  if (q.length >= 2 && t.startsWith(q)) return 0.88 - Math.min(0.2, (t.length - q.length) * 0.02)
  if (q.length >= 4 && t.includes(q)) return 0.6
  if (q.length >= 4 && t.length >= 4) {
    const max = q.length >= 8 ? 2 : 1
    const d = editDistance(q, t, max)
    if (d <= max) return d === 1 ? 0.72 : 0.55
  }
  return 0
}

/**
 * Every vocabulary token a query word reaches, with how strongly: itself, its
 * prefixes and typos, its synonyms, and — when the word is a typo of a
 * synonym root ("dispostion") — that root's whole group.
 */
function expandWord(q: string, vocab: string[]): Map<string, number> {
  const variants: [string, number][] = [[q, 1]]
  for (const s of SYN.get(q) || []) variants.push([s, 0.66])
  if (!SYN.has(q) && q.length >= 5) {
    for (const [root, group] of SYN) {
      if (editDistance(q, root, 1) <= 1) {
        variants.push([root, 0.7])
        for (const s of group) variants.push([s, 0.55])
        break
      }
    }
  }
  const out = new Map<string, number>()
  for (const [v, factor] of variants) {
    for (const t of vocab) {
      const m = tokenMatch(v, t) * factor
      if (m > (out.get(t) || 0)) out.set(t, m)
    }
  }
  return out
}

export function search(index: SearchIndex, query: string, limit = 12): SearchResult[] {
  const raw = tokenize(query)
  if (raw.length === 0) return []
  const meaningful = raw.filter(w => !STOP.has(w))
  const words = [...new Set((meaningful.length ? meaningful : raw).map(stem))]
  const phrase = query.trim().toLowerCase()
  const expanded = words.map(w => expandWord(w, index.vocab))

  const results: SearchResult[] = []
  for (const p of index.items) {
    let total = 0
    let matched = 0
    const terms: string[] = []
    for (let i = 0; i < words.length; i++) {
      const reach = expanded[i]
      let best = 0
      for (const f of FIELDS) {
        for (const t of p[f]) {
          const m = reach.get(t)
          if (!m) continue
          const s = m * FIELD_WEIGHT[f]
          if (s > best) best = s
          if (m >= 0.5 && !terms.includes(t)) terms.push(t)
        }
      }
      if (best > 0) { matched++; total += best }
    }
    if (matched === 0) continue
    const coverage = matched / words.length
    // Coverage dominates: every word matched beats one word matched loudly.
    let score = total * (0.25 + 0.75 * coverage * coverage)
    if (phrase.length >= 3) {
      if (p.titleText === phrase) score += 12
      else if (p.titleText.includes(phrase)) score += 6
      else if (p.bodyText.includes(phrase)) score += 3
    }
    score *= 1 + (p.entry.boost || 0)

    let snippet: string | undefined
    if (p.sentences.length) {
      let bestHits = 0
      for (const sentence of p.sentences) {
        const st = new Set(tokenize(sentence).map(stem))
        let h = 0
        for (const t of terms) if (st.has(t)) h++
        if (h > bestHits) { bestHits = h; snippet = sentence }
      }
      if (!snippet) snippet = p.sentences[0]
    }
    results.push({ entry: p.entry, score, snippet, terms })
  }

  results.sort((a, b) => b.score - a.score)
  // Drop the long tail: anything far below the best result is noise.
  const best = results[0]?.score || 0
  return results.filter(r => r.score >= best * 0.12).slice(0, limit)
}
