const BASE = '/demo/icm'

export function isIcmDemoPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return p === BASE || p.startsWith(`${BASE}/`)
}

export const ICM_DEMO_BASE = BASE
