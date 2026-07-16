import { insertPageview } from './client'
import type { AnalyticsEventInput } from './types'

const SESSION_KEY = 'iom-analytics-session'
const LAST_PATH_KEY = 'iom-analytics-last-path'

/** Routes excluded from tracking (private CRM). */
const EXCLUDED_PREFIXES = ['/client-login', '/crm-demo']

function shouldTrack(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return !EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function deviceType(): AnalyticsEventInput['device_type'] {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function utmParams(): Pick<AnalyticsEventInput, 'utm_source' | 'utm_medium' | 'utm_campaign'> {
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source')?.slice(0, 128) ?? '',
    utm_medium: params.get('utm_medium')?.slice(0, 128) ?? '',
    utm_campaign: params.get('utm_campaign')?.slice(0, 128) ?? '',
  }
}

function buildEvent(pathname: string): AnalyticsEventInput {
  return {
    session_id: getSessionId(),
    path: pathname.slice(0, 512) || '/',
    referrer: (document.referrer || '').slice(0, 512),
    ...utmParams(),
    device_type: deviceType(),
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
  }
}

async function sendPageview(event: AnalyticsEventInput): Promise<void> {
  try {
    const res = await fetch('/api/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    })
    if (res.ok || res.status === 204) return
  } catch {
    /* fall through — local Vite has no /api */
  }
  void insertPageview(event)
}

/** Record a pageview once per distinct path per tab session. */
export function trackPageView(pathname: string): void {
  if (!shouldTrack(pathname)) return

  try {
    const last = sessionStorage.getItem(LAST_PATH_KEY)
    const path = pathname.replace(/\/+$/, '') || '/'
    if (last === path) return
    sessionStorage.setItem(LAST_PATH_KEY, path)
  } catch {
    /* continue */
  }

  void sendPageview(buildEvent(pathname))
}

/** Start SPA route tracking — call once from App. */
export function initAnalytics(getPath: () => string): () => void {
  trackPageView(getPath())

  const onPop = () => trackPageView(getPath())
  window.addEventListener('popstate', onPop)

  const origPush = history.pushState.bind(history)
  const origReplace = history.replaceState.bind(history)

  history.pushState = (...args) => {
    origPush(...args)
    trackPageView(getPath())
  }
  history.replaceState = (...args) => {
    origReplace(...args)
    trackPageView(getPath())
  }

  return () => {
    window.removeEventListener('popstate', onPop)
    history.pushState = origPush
    history.replaceState = origReplace
  }
}
