import { useEffect } from 'react'
import { ensureCustomCursor, mountCustomCursor } from './mountCustomCursor'
import './custom-cursor.css'

/**
 * Mounts the site-wide custom cursor once. Renders nothing into the React tree —
 * the cursor DOM is created imperatively to avoid pointer-driven re-renders.
 *
 * Also re-ensures the instance after demo tab hops / bfcache restores so the
 * focus orb keeps working when you return from `/demos/panorama-360/` etc.
 */
export function CustomCursor() {
  useEffect(() => {
    let cleanup = mountCustomCursor()

    const revive = () => {
      if (document.hidden) return
      cleanup = ensureCustomCursor() ?? cleanup
    }

    window.addEventListener('pageshow', revive)
    window.addEventListener('focus', revive)
    document.addEventListener('visibilitychange', revive)

    return () => {
      window.removeEventListener('pageshow', revive)
      window.removeEventListener('focus', revive)
      document.removeEventListener('visibilitychange', revive)
      cleanup?.()
    }
  }, [])

  return null
}
