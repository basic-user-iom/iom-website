import type { Lead, LeadEmail } from './types'

const addressPattern = /^[^\s@<>,;\r\n]+@[^\s@<>,;\r\n]+\.[^\s@<>,;\r\n]+$/

export function senderOnCard(
  lead: { email?: string | null; emails?: Array<{ email?: string | null }> | null },
  from: string,
) {
  const target = from.trim().toLowerCase()
  if (!target) return false
  const card = [lead.email, ...(lead.emails ?? []).map((row) => row?.email)]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase())
  return card.includes(target)
}

/** Additional addresses only. The primary address and the lead owner stay as they are. */
export function describeExtraAddressChange(lead: Pick<Lead, 'email' | 'emails'>, emails: LeadEmail[]) {
  if (emails.length > 50) return { ok: false as const, code: 'invalid_address_list' }
  const next: LeadEmail[] = []
  const seen = new Set<string>()
  for (const row of emails) {
    const label = row.label.trim().slice(0, 80)
    const email = row.email.trim().toLowerCase()
    if (!email) continue
    if (email.length > 320 || !addressPattern.test(email)) return { ok: false as const, code: 'invalid_address' }
    if (seen.has(email)) return { ok: false as const, code: 'address_duplicate' }
    seen.add(email)
    next.push({ label: label || email, email })
  }
  const primary = lead.email.trim().toLowerCase()
  if (primary && next.some((row) => row.email === primary)) return { ok: false as const, code: 'address_duplicate' }
  const before = new Map(
    (lead.emails ?? [])
      .filter((row) => row.email.trim())
      .map((row) => [row.email.trim().toLowerCase(), row.label.trim()] as const),
  )
  let added = 0
  let edited = 0
  let removed = 0
  const after = new Set(next.map((row) => row.email))
  for (const row of next) {
    if (!before.has(row.email)) added += 1
    else if (before.get(row.email) !== row.label) edited += 1
  }
  for (const email of before.keys()) if (!after.has(email)) removed += 1
  return { ok: true as const, emails: next, added, edited, removed }
}
