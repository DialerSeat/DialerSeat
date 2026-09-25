// node scripts/i18n/localize-metadata.mjs <page.tsx> [...]
//
// `export const metadata = {…}` becomes `const baseMetadata = {…}` plus a
// generateMetadata that passes it through localizeMetadata(). The object
// itself is not touched, so the title and description stay exactly where
// they were written. See lib/i18n/metadata.ts.

import fs from 'node:fs'
import ts from 'typescript'

export function localizeMetadataSource(src, file) {
  if (/localizeMetadata\(/.test(src)) return { src, status: 'already' }
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let stmt = null
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue
    const exported = (ts.getModifiers(st) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    const decl = st.declarationList.declarations[0]
    if (exported && decl && ts.isIdentifier(decl.name) && decl.name.text === 'metadata') stmt = st
  }
  if (!stmt) return { src, status: /generateMetadata/.test(src) ? 'manual (generateMetadata)' : 'none' }
  const decl = stmt.declarationList.declarations[0]
  const hasType = !!decl.type
  const exportKw = (ts.getModifiers(stmt) ?? []).find((m) => m.kind === ts.SyntaxKind.ExportKeyword)

  let out = src
  // Append generateMetadata after the statement (edit from the end first).
  const end = stmt.getEnd()
  out = out.slice(0, end) + `\n\nexport async function generateMetadata(): Promise<Metadata> {\n  return localizeMetadata(baseMetadata)\n}` + out.slice(end)
  // Rename metadata → baseMetadata.
  out = out.slice(0, decl.name.getStart(sf)) + 'baseMetadata' + (hasType ? '' : ': Metadata') + out.slice(decl.name.getEnd())
  // Drop `export ` from the statement.
  out = out.slice(0, exportKw.getStart(sf)) + out.slice(exportKw.getEnd()).replace(/^\s+/, '')

  const imports = [`import { localizeMetadata } from '@/lib/i18n/metadata'`]
  if (!/import (type )?\{[^}]*\bMetadata\b[^}]*\} from ['"]next['"]/.test(out)) imports.push(`import type { Metadata } from 'next'`)
  const sf2 = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imps = sf2.statements.filter(ts.isImportDeclaration)
  const at = imps.length ? imps[imps.length - 1].getEnd() : 0
  out = out.slice(0, at) + (at ? '\n' : '') + imports.join('\n') + (at ? '' : '\n') + out.slice(at)
  return { src: out, status: 'localized' }
}

if (process.argv[1] && /localize-metadata\.mjs$/.test(process.argv[1])) {
  for (const f of process.argv.slice(2)) {
    const { src, status } = localizeMetadataSource(fs.readFileSync(f, 'utf8'), f)
    if (status === 'localized') fs.writeFileSync(f, src)
    console.log(`${status.padEnd(26)} ${f}`)
  }
}
