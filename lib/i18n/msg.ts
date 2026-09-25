// msg("LEADS") is "LEADS" — an identity function with no React and no
// request, safe at module scope. It marks English text that lives in data
// (nav items, option lists, FAQ entries) so the catalog extractor finds it;
// the place that renders it calls t(item.label) to translate.
//
// Keeping the value English matters: these strings are also compared, used
// as keys and sent to the server, and all of that keeps working unchanged.
export function msg<T extends string>(text: T): T {
  return text
}
