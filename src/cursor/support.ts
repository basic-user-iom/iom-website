import { parseLocalePath } from '../i18n'

/** True when a fine pointer with hover is available and motion is allowed. */
export function isCustomCursorSupported(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false

  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (!fineHover) return false

  // Prefer native cursor when the user asks for reduced motion.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

  // Embedded iframes / opaque contexts where we cannot own the pointer reliably.
  try {
    if (window.self !== window.top) return false
  } catch {
    return false
  }

  return true
}

/** CRM / portal shells keep the native system cursor for dense UI work. */
export function isCustomCursorExcludedPath(pathname = window.location.pathname): boolean {
  const { path } = parseLocalePath(pathname)
  return (
    path === '/client-login' ||
    path === '/crm-demo' ||
    path.startsWith('/client-login/') ||
    path.startsWith('/crm-demo/')
  )
}
