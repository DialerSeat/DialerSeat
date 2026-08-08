import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

// =============================================================================
// EVERY /api PATH THE UI FETCHES MUST HAVE A ROUTE BEHIND IT
// =============================================================================
// The Data Explorer played recordings from /api/admin/recordings/play. That
// route was never created — `list` lived at /api/admin/recordings/list and
// `play` at /api/admin/user-data/recordings/play, and the component assumed
// they were siblings. Every single playback 404'd. Recordings were being
// captured correctly the whole time.
//
// Nothing catches this. TypeScript does not typecheck a URL string, the build
// succeeds, the page renders, and the only symptom is a request failing at the
// moment a user clicks something. It is the same shape as the sitemap gap and
// the orphaned /vs page found earlier — wiring that is wrong in a way no
// compiler looks at.
//
// So the strings get checked against the filesystem.
// =============================================================================

const ROOT = process.cwd()
const APP = join(ROOT, 'app')

/** Every source file that might fetch something. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) sourceFiles(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

/**
 * Does a Next.js route handler exist for this pathname?
 *
 * Walks the segment list, allowing a [dynamic] or [[...catchall]] directory to
 * absorb a segment when no literal match exists.
 */
function routeExists(pathname: string): boolean {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean)
  let dir = APP

  for (const seg of segments) {
    const literal = join(dir, seg)
    if (existsSync(literal) && statSync(literal).isDirectory()) {
      dir = literal
      continue
    }
    // Fall back to a dynamic segment at this level.
    const dyn = readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('['))
      .map(e => e.name)
    if (dyn.length === 0) return false
    // A catch-all swallows everything remaining.
    if (dyn.some(d => d.includes('...'))) return true
    dir = join(dir, dyn[0])
  }

  return existsSync(join(dir, 'route.ts')) || existsSync(join(dir, 'route.tsx'))
}

describe('every /api path referenced in source has a route', () => {
  it('has no dangling API references', () => {
    const dangling: string[] = []

    for (const file of [...sourceFiles(APP), ...sourceFiles(join(ROOT, 'components')), ...sourceFiles(join(ROOT, 'lib'))]) {
      const src = readFileSync(file, 'utf8')

      // Literal /api/... paths only. A path built from a variable cannot be
      // resolved statically, and guessing at one would produce false failures
      // that get the whole test disabled.
      const matches = src.match(/["'`]\/api\/[a-zA-Z0-9\-_/[\]().]*/g) || []

      for (const raw of matches) {
        const path = raw.slice(1)
        // Interpolation or a trailing partial segment — not statically checkable.
        if (path.includes('${') || path.endsWith('/')) continue
        // Drop query strings and template remnants.
        const clean = path.split('?')[0].split('`')[0]
        if (clean.length < 6) continue
        if (!routeExists(clean)) {
          dangling.push(`${clean}  (${file.replace(ROOT, '').replace(/\\/g, '/')})`)
        }
      }
    }

    expect([...new Set(dangling)], 'these /api paths have no route handler').toEqual([])
  })
})
