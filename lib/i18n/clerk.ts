import 'server-only'
import { esMX } from '@clerk/localizations/es-MX'
import { ptBR } from '@clerk/localizations/pt-BR'
import { frFR } from '@clerk/localizations/fr-FR'
import { arSA } from '@clerk/localizations/ar-SA'
import { itIT } from '@clerk/localizations/it-IT'
import { deDE } from '@clerk/localizations/de-DE'
import { zhCN } from '@clerk/localizations/zh-CN'
import { heIL } from '@clerk/localizations/he-IL'
import { jaJP } from '@clerk/localizations/ja-JP'
import type { Locale } from './locales'
import { translate, type Dictionary } from './translate'

// Clerk's sign-in, sign-up and account screens. Clerk publishes its own
// translations; DialerSeat's few custom English strings (the delete-account
// confirmation) are translated from our dictionary and laid on top, so the
// phrase a person is asked to type matches the instruction telling them to.
//
// Spanish is Latin American (es-MX), for the Colombian, Mexican and Dominican
// centres this is for.
const CLERK: Record<Exclude<Locale, 'en'>, object> = {
  es: esMX, 'pt-BR': ptBR, fr: frFR, ar: arSA, it: itIT, de: deDE, 'zh-CN': zhCN, he: heIL, ja: jaJP,
}

type Tree = { [k: string]: string | Tree }

function translateTree(tree: Tree, dict: Dictionary | null): Tree {
  const out: Tree = {}
  for (const [k, v] of Object.entries(tree)) out[k] = typeof v === 'string' ? translate(dict, v) : translateTree(v, dict)
  return out
}

function merge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = out[k]
    out[k] = typeof v === 'object' && b && typeof b === 'object' ? merge(b, v) : v
  }
  return out
}

/** English gets `custom` exactly as written; other languages get Clerk's plus ours translated. */
export function clerkLocalization<T extends object>(locale: Locale, dict: Dictionary | null, custom: T): T {
  if (locale === 'en') return custom
  return merge(CLERK[locale] as Tree, translateTree(custom as unknown as Tree, dict)) as unknown as T
}
