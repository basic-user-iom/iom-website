const STORAGE_KEY = 'superbright-rock-demo-unlocked'

export function getSuperbrightRockPassword(): string {
  return import.meta.env.VITE_SUPERBRIGHT_ROCK_DEMO_PASSWORD?.trim() || 'superbright'
}

export function isSuperbrightRockUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockSuperbrightRock(password: string): boolean {
  if (password !== getSuperbrightRockPassword()) return false
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
  return true
}

/** Same-origin CRM Demo iframe can skip the gate. Top-level ?crmEmbed=1 does nothing. */
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
