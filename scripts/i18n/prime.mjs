// node scripts/i18n/prime.mjs <page.tsx> [...]
//
// For server pages and layouts that use the server t(): make the default
// export start with `await primeLocale()` (making it async if it was not),
// and import primeLocale. See lib/i18n/server.ts for why every page primes.

import fs from 'node:fs'
import ts from 'typescript'

export function primeSource(src, file) {
  // Only files that render with the server t() need priming.
  if (!/import \{[^}]*\bt\b[^}]*\} from ['"]@\/lib\/i18n\/server['"]/.test(src) || /primeLocale\(\)/.test(src)) {
    return { src, status: 'skip' }
  }
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let target = null
  for (const st of sf.statements) {
    const mods = ts.getModifiers?.(st) ?? []
    const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    if (isDefault && ts.isFunctionDeclaration(st) && st.body) target = st
  }
  if (!target) {
    const def = sf.statements.find(ts.isExportAssignment)
    const name = def && ts.isIdentifier(def.expression) ? def.expression.text : null
    target = name && sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === name && s.body)
  }
  if (!target) return { src, status: 'manual' }
  const isAsync = (ts.getModifiers?.(target) ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
  const bodyStart = target.body.getStart(sf) + 1
  const fnKw = target.getChildren(sf).find((c) => c.kind === ts.SyntaxKind.FunctionKeyword)
  src = src.slice(0, bodyStart) + '\n  await primeLocale()' + src.slice(bodyStart)
  if (!isAsync) src = src.slice(0, fnKw.getStart(sf)) + 'async ' + src.slice(fnKw.getStart(sf))
  src = src.replace(
    /import \{\s*t(\s+as\s+\w+)?\s*\} from (['"])@\/lib\/i18n\/server\2/,
    (m, alias, q) => `import { primeLocale, t${alias ?? ''} } from ${q}@/lib/i18n/server${q}`,
  )
  return { src, status: isAsync ? 'primed' : 'primed (now async)' }
}

if (process.argv[1] && process.argv[1].endsWith('prime.mjs')) {
  for (const file of process.argv.slice(2)) {
    const { src, status } = primeSource(fs.readFileSync(file, 'utf8'), file)
    if (status.startsWith('primed')) fs.writeFileSync(file, src)
    console.log(`${status.padEnd(20)} ${file}`)
  }
}
