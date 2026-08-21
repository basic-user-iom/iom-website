const STORAGE_KEY = 'dukta-website-unlocked'

export function getDuktaWebsitePassword(): string {
  return import.meta.env.VITE_DUKTA_WEBSITE_PASSWORD?.trim() || 'dukta'
}

export function isDuktaWebsiteUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockDuktaWebsite(password: string): boolean {
  if (password !== getDuktaWebsitePassword()) return false
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
  return true
}

/** Same-origin CRM iframe can skip the gate. Top-level ?crmEmbed=1 does nothing. */
export function tryCrmEmbedUnlock(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crmEmbed') !== '1') return false
    if (window.top === window.self) return false
    if (window.top?.location.origin !== window.location.origin) return false
    sessionStorage.setItem(STORAGE_KEY, '1')
    return true
  } catch {
    return false
  }
}
