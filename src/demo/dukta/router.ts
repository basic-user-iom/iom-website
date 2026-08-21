import { useEffect, useState } from 'react'
import { BASE } from './data/site'

export type DuktaRoute = { name: 'home' } | { name: 'projects' }

export function pathToRoute(pathname: string): DuktaRoute {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === `${BASE}/projects` || path === '/projects') return { name: 'projects' }
  return { name: 'home' }
}

export function routeToPath(route: DuktaRoute): string {
  return route.name === 'projects' ? `${BASE}/projects` : `${BASE}/`
}

export function useDuktaRoute(): DuktaRoute {
  const [route, setRoute] = useState<DuktaRoute>(() =>
    typeof window === 'undefined' ? { name: 'home' } : pathToRoute(window.location.pathname),
  )

  useEffect(() => {
    const sync = () => setRoute(pathToRoute(window.location.pathname))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  return route
}

export function navigate(href: string, options?: { replace?: boolean }) {
  const url = new URL(href, window.location.origin)
  if (url.origin !== window.location.origin) {
    window.location.assign(href)
    return
  }
  if (url.pathname.startsWith(BASE) && !/\.[a-zA-Z0-9]+$/.test(url.pathname)) {
    if (options?.replace) window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    else window.history.pushState({}, '', url.pathname + url.search + url.hash)
    window.dispatchEvent(new PopStateEvent('popstate'))
    if (url.hash) {
      requestAnimationFrame(() => {
        document.querySelector(url.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } else {
      window.scrollTo(0, 0)
    }
    return
  }
  window.location.assign(href)
}
