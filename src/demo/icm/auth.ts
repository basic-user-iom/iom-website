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

export function lockIcmDemo(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
