/**
 * Escapes a string for safe interpolation into XML/TwiML text content.
 * Use for any dynamic value (e.g. `room`) placed inside a TwiML response body.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
