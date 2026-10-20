// Shared by the browser and inbound ingest. No I/O or message sending.
const messageId = /^<[^<>\s@]+@[^<>\s@]+>$/
const controls = /[\u0000-\u0008\u000a-\u001f\u007f]/

/** Canonicalize a References chain, including legacy JSON-encoded arrays. */
export function normalizeEmailReferences(input) {
  if (input === undefined || input === null || input === '') return ''
  let values = input
  if (typeof values === 'string') {
    if (controls.test(values)) throw new Error('Invalid reply references')
    const text = values.trim()
    if (!text) return ''
    if (text.startsWith('[')) {
      try { values = JSON.parse(text) }
      catch { throw new Error('Invalid reply references') }
    } else {
      values = text.split(/\s+/)
    }
  }
  if (!Array.isArray(values)) throw new Error('Invalid reply references')
  const result = []
  const seen = new Set()
  for (const value of values) {
    if (typeof value !== 'string' || controls.test(value)) throw new Error('Invalid reply references')
    const id = value.trim()
    if (!messageId.test(id)) throw new Error('Invalid reply references')
    // Match the existing backend's case-insensitive Message-ID comparison.
    const key = id.toLowerCase()
    if (!seen.has(key)) { seen.add(key); result.push(id) }
  }
  return result.join(' ')
}
