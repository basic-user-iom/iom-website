const STORAGE_KEY = 'harp-configurator-demo-unlocked'

export function getDemoPassword() {
  return import.meta.env.VITE_HARP_CONFIGURATOR_DEMO_PASSWORD?.trim() || 'forte32'
}

export function isDemoUnlocked() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function unlockDemo(password) {
  if (password !== getDemoPassword()) return false
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* Ignore blocked storage; the current page still unlocks. */
  }
  return true
}

/** Same-origin CRM Demo iframes may bypass the gate; top-level query strings may not. */
export function tryCrmEmbedUnlock() {
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
