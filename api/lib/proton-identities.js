/**
 * Proton SMTP identities for CRM outreach.
 * Each From address needs its own SMTP token (Proton pairs token ↔ address).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** @typedef {'contact' | 'visual' | 'projects'} ProtonIdentityId */

/**
 * @typedef {object} ProtonIdentity
 * @property {ProtonIdentityId} id
 * @property {string} label
 * @property {string} email
 * @property {string} fromHeader  e.g. "IOM Visual <visual@…>"
 * @property {string} user        SMTP auth username (= email)
 * @property {string} pass        SMTP token
 * @property {boolean} configured
 */

/**
 * @returns {ProtonIdentity[]}
 */
export function listProtonIdentities() {
  const host = process.env.PROTON_SMTP_HOST
  const port = Number(process.env.PROTON_SMTP_PORT || 587)
  if (!host || !port) return []

  const defs = [
    {
      id: /** @type {const} */ ('contact'),
      label: 'Contact — general',
      emailFallback: 'contact@iobjectm.com',
      userEnv: 'PROTON_SMTP_USER',
      passEnv: 'PROTON_SMTP_PASS',
      fromEnv: 'PROTON_SMTP_FROM',
      fromFallback: 'IOM <contact@iobjectm.com>',
    },
    {
      id: /** @type {const} */ ('visual'),
      label: 'Visual — photo, film, arts',
      emailFallback: 'visual@iobjectm.com',
      userEnv: 'PROTON_SMTP_VISUAL_USER',
      passEnv: 'PROTON_SMTP_VISUAL_PASS',
      fromEnv: 'PROTON_SMTP_VISUAL_FROM',
      fromFallback: 'IOM Visual <visual@iobjectm.com>',
    },
    {
      id: /** @type {const} */ ('projects'),
      label: 'Projects — clients & collabs',
      emailFallback: 'projects@iobjectm.com',
      userEnv: 'PROTON_SMTP_PROJECTS_USER',
      passEnv: 'PROTON_SMTP_PROJECTS_PASS',
      fromEnv: 'PROTON_SMTP_PROJECTS_FROM',
      fromFallback: 'IOM Projects <projects@iobjectm.com>',
    },
  ]

  return defs.map((d) => {
    const user = (process.env[d.userEnv] || d.emailFallback).trim()
    const pass = (process.env[d.passEnv] || '').trim()
    const fromHeader = (process.env[d.fromEnv] || d.fromFallback).trim()
    const email = extractEmail(fromHeader) || user
    return {
      id: d.id,
      label: d.label,
      email,
      fromHeader,
      user,
      pass,
      configured: Boolean(user && pass && EMAIL_RE.test(email)),
    }
  })
}

/**
 * @param {string | null | undefined} id
 * @returns {ProtonIdentity | null}
 */
export function resolveProtonIdentity(id) {
  const list = listProtonIdentities()
  const wanted = String(id || 'contact').trim().toLowerCase()
  const match = list.find((i) => i.id === wanted && i.configured)
  if (match) return match
  return list.find((i) => i.id === 'contact' && i.configured) || null
}

/**
 * @param {string} fromHeader
 */
function extractEmail(fromHeader) {
  const m = fromHeader.match(/<([^>]+)>/)
  const raw = (m ? m[1] : fromHeader).trim().toLowerCase()
  return EMAIL_RE.test(raw) ? raw : ''
}

export { EMAIL_RE }
