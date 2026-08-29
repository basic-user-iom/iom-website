import { useEffect } from 'react'
import { useViewer } from './useViewer.js'

export function usePrefersReducedMotion() {
  const setReducedMotion = useViewer((state) => state.setReducedMotion)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [setReducedMotion])
}
