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
