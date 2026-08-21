const STORAGE_KEY = 'dukta-linar-concept-unlocked'

export function getLinarDemoPassword(): string {
  return import.meta.env.VITE_DUKTA_LINAR_DEMO_PASSWORD?.trim() || 'linar'
}

export function isLinarDemoUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Used only by the dukta marketing site before navigating here.
 * Does not change the password gate for direct visits to the configurator.
 */
export function unlockLinarForTrustedEntry(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function unlockLinarDemo(password: string): boolean {
  if (password !== getLinarDemoPassword()) return false
  unlockLinarForTrustedEntry()
  return true
}

/** Same-origin CRM Demo iframe can skip the gate. Top-level ?crmEmbed=1 does nothing. */
export function tryCrmEmbedUnlock(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crmEmbed') !== '1') return false
    if (window.top === window.self) return false
    if (window.top?.location.origin !== window.location.origin) return false
    unlockLinarForTrustedEntry()
    return true
  } catch {
    return false
  }
}
