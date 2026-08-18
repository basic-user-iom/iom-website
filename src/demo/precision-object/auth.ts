const STORAGE_KEY = 'precision-object-demo-unlocked'

export function getPrecisionObjectPassword(): string {
  return import.meta.env.VITE_PRECISION_OBJECT_DEMO_PASSWORD?.trim() || 'precision'
}

export function isPrecisionObjectUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockPrecisionObject(password: string): boolean {
  if (password !== getPrecisionObjectPassword()) return false
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
