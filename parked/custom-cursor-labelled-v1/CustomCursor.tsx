import { useEffect } from 'react'
import { mountCustomCursor } from './mountCustomCursor'
import './custom-cursor.css'

/**
 * Mounts the site-wide custom cursor once. Renders nothing into the React tree —
 * the cursor DOM is created imperatively to avoid pointer-driven re-renders.
 */
export function CustomCursor() {
  useEffect(() => {
    const cleanup = mountCustomCursor()
    return () => {
      cleanup?.()
    }
  }, [])

  return null
}
