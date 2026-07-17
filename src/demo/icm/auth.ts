const STORAGE_KEY = 'icm-demo-unlocked'

export function getIcmDemoPassword(): string {
  return import.meta.env.VITE_ICM_DEMO_PASSWORD?.trim() || 'volimte'
}

export function isIcmDemoUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockIcmDemo(password: string): boolean {
  if (password !== getIcmDemoPassword()) return false
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
  return true
}

/**
 * Allow CRM Demo tab iframe to show the real site (with images) without the gate.
 * Only works when embedded in a same-origin parent — top-level ?crmEmbed=1 does nothing.
 */
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

export function lockIcmDemo(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
