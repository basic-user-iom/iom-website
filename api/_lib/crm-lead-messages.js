/**
 * Persist / look up CRM lead email messages via Supabase REST.
 */

/**
 * @param {object} opts
 * @param {string} opts.supabaseUrl
 * @param {string} opts.key  anon or service role
 * @param {string} [opts.userToken]  when set, used as Authorization (RLS as user)
 * @param {object} opts.row
 */
export async function insertLeadMessage({ supabaseUrl, key, userToken, row }) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/crm_lead_messages`
  const auth = userToken || key
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${auth}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const msg = json?.message || json?.error_description || text.slice(0, 240)
    throw new Error(msg || `Supabase ${res.status}`)
  }
  return Array.isArray(json) ? json[0] : json
}

/**
 * Normalize Message-ID-ish values for comparison.
 * @param {string | null | undefined} id
 */
export function normalizeMessageId(id) {
  const raw = String(id || '').trim()
  if (!raw) return ''
  if (raw.startsWith('<') && raw.endsWith('>')) return raw.toLowerCase()
  return `<${raw.replace(/^<|>$/g, '')}>`.toLowerCase()
}

/**
 * Build References chain from prior header + new parent id.
 * @param {string | null | undefined} priorReferences
 * @param {string | null | undefined} parentId
 */
export function buildReferencesHeader(priorReferences, parentId) {
  const parts = []
  const seen = new Set()
  const push = (v) => {
    const n = normalizeMessageId(v)
    if (!n || seen.has(n)) return
    seen.add(n)
    parts.push(n)
  }
  for (const token of String(priorReferences || '').split(/\s+/)) {
    push(token)
  }
  push(parentId)
  return parts.join(' ')
}
