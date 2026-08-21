/**
 * Allowlist for hotspot CTA / link.open URLs.
 * Rejects javascript:, data:, vbscript:, and other non-navigation schemes.
 */
export function isAllowedExternalUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed, 'https://example.invalid')
    const protocol = parsed.protocol.toLowerCase()
    if (protocol === 'https:' || protocol === 'http:') return true
    if (protocol === 'mailto:' || protocol === 'tel:') return true
    return false
  } catch {
    return false
  }
}

/** Return the URL if allowed, otherwise null. */
export function sanitizeExternalUrl(url: string | null | undefined): string | null {
  if (url == null) return null
  const trimmed = String(url).trim()
  if (!trimmed) return null
  return isAllowedExternalUrl(trimmed) ? trimmed : null
}
