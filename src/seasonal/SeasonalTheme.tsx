import { useLayoutEffect } from 'react'
import { ACTIVE_SEASONAL_THEME } from './config'
import { readySeasonalTheme } from './registry'
import { resolveSeasonalTheme, SEASONAL_PREVIEW_KEY, SEASONAL_PREVIEW_PARAM } from './resolve'
import './seasonal.css'

/** A single removable integration; no extra DOM, timers or audio. */
export function SeasonalTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-iom-season')
    const previousPaused = root.getAttribute('data-iom-season-paused')
    const syncVisibility = () => {
      if (root.hasAttribute('data-iom-season') && document.hidden) {
        root.setAttribute('data-iom-season-paused', 'true')
      } else root.removeAttribute('data-iom-season-paused')
    }
    // URL/session previews are deliberately absent from production behavior.
    const previewEnabled = import.meta.env.DEV
      && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

    const sync = () => {
      let storedPreview: string | null = null
      if (previewEnabled && window.self === window.top) {
        try {
          const params = new URLSearchParams(window.location.search)
          if (params.has(SEASONAL_PREVIEW_PARAM)) {
            const selected = readySeasonalTheme(params.get(SEASONAL_PREVIEW_PARAM)) ?? 'off'
            window.sessionStorage.setItem(SEASONAL_PREVIEW_KEY, selected)
          }
          storedPreview = window.sessionStorage.getItem(SEASONAL_PREVIEW_KEY)
        } catch {
          // Private/restricted storage still permits the current URL preview.
        }
      }
      const theme = resolveSeasonalTheme({
        pathname: window.location.pathname,
        search: window.location.search,
        configured: ACTIVE_SEASONAL_THEME,
        previewEnabled,
        storedPreview,
        embedded: window.self !== window.top,
      })
      if (theme) root.setAttribute('data-iom-season', theme)
      else root.removeAttribute('data-iom-season')
      syncVisibility()
    }

    sync()
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
      document.removeEventListener('visibilitychange', syncVisibility)
      if (previous === null) root.removeAttribute('data-iom-season')
      else root.setAttribute('data-iom-season', previous)
      if (previousPaused === null) root.removeAttribute('data-iom-season-paused')
      else root.setAttribute('data-iom-season-paused', previousPaused)
    }
  }, [])

  return null
}
