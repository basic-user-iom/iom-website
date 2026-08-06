import { useEffect } from 'react'
import { ensureCustomCursor, mountCustomCursor } from './mountCustomCursor'
import { isCustomCursorExcludedPath } from './support'
import './custom-cursor.css'

/**
 * Mounts the site-wide custom cursor once. Renders nothing into the React tree —
 * the cursor DOM is created imperatively to avoid pointer-driven re-renders.
 *
 * Also re-ensures the instance after demo tab hops / bfcache restores so the
 * focus orb keeps working when you return from `/demos/panorama-360/` etc.
 * CRM / portal routes keep the native system cursor.
 */
export function CustomCursor() {
  useEffect(() => {
    let cleanup: (() => void) | null = null

    const sync = () => {
      if (isCustomCursorExcludedPath()) {
        cleanup?.()
        cleanup = null
        document.documentElement.classList.remove('iom-cursor-active')
        document.querySelectorAll('.iom-cursor').forEach((el) => el.remove())
        return
      }
      cleanup = ensureCustomCursor() ?? cleanup ?? mountCustomCursor()
    }

    sync()

    const revive = () => {
      if (document.hidden) return
      sync()
    }

    window.addEventListener('pageshow', revive)
    window.addEventListener('focus', revive)
    window.addEventListener('popstate', sync)
    document.addEventListener('visibilitychange', revive)

    return () => {
      window.removeEventListener('pageshow', revive)
      window.removeEventListener('focus', revive)
      window.removeEventListener('popstate', sync)
      document.removeEventListener('visibilitychange', revive)
      cleanup?.()
    }
  }, [])

  return null
}
