import { insertPageview } from './client'
import type { AnalyticsEventInput } from './types'

const SESSION_KEY = 'iom-analytics-session'
const LAST_PATH_KEY = 'iom-analytics-last-path'
const PAGE_START_KEY = 'iom-analytics-page-start'

/** Routes excluded from tracking (private CRM / admin surfaces). */
const EXCLUDED_PREFIXES = ['/client-login', '/crm-demo', '/artist-globe/admin']

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

function utmParams(): Pick<
  AnalyticsEventInput,
  'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term'
> {
  const params = new URLSearchParams(window.location.search)
  return {
    utm_source: params.get('utm_source')?.slice(0, 128) ?? '',
    utm_medium: params.get('utm_medium')?.slice(0, 128) ?? '',
    utm_campaign: params.get('utm_campaign')?.slice(0, 128) ?? '',
    utm_term: params.get('utm_term')?.slice(0, 256) ?? '',
  }
}

/** Pull search keyword from referrer when engines still expose it (rare for Google). */
export function extractSearchKeyword(referrer: string): string {
  if (!referrer) return ''
  try {
    const u = new URL(referrer)
    const host = u.hostname.replace(/^www\./, '')
    const q =
      u.searchParams.get('q') ||
      u.searchParams.get('query') ||
      u.searchParams.get('p') ||
      u.searchParams.get('wd') ||
      u.searchParams.get('text') ||
      ''
    if (!q) return ''
    if (
      host.includes('google.') ||
      host.includes('bing.') ||
      host.includes('duckduckgo.') ||
      host.includes('yahoo.') ||
      host.includes('baidu.') ||
      host.includes('yandex.') ||
      host.includes('ecosia.') ||
      host.includes('search.brave.')
    ) {
      return q.slice(0, 256)
    }
  } catch {
    /* ignore */
  }
  return ''
}

function baseFields(pathname: string): AnalyticsEventInput {
  const referrer = (document.referrer || '').slice(0, 512)
  const utm = utmParams()
  const fromReferrer = extractSearchKeyword(referrer)
  return {
    session_id: getSessionId(),
    path: pathname.slice(0, 512) || '/',
    referrer,
    ...utm,
    search_keyword: (utm.utm_term || fromReferrer).slice(0, 256),
    device_type: deviceType(),
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
  }
}

async function sendEvent(event: AnalyticsEventInput): Promise<void> {
  try {
    const res = await fetch('/api/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    })
    if (res.ok || res.status === 204) return
  } catch {
    /* local vite has no /api */
  }
  if ((event.event_type ?? 'pageview') === 'pageview') {
    void insertPageview(event)
  }
}

function markPageStart(path: string) {
  try {
    sessionStorage.setItem(PAGE_START_KEY, JSON.stringify({ path, t: Date.now() }))
  } catch {
    /* ignore */
  }
}

function flushEngage(reason: string) {
  if (!shouldTrack(window.location.pathname)) return
  let start: { path: string; t: number } | null = null
  try {
    const raw = sessionStorage.getItem(PAGE_START_KEY)
    if (raw) start = JSON.parse(raw) as { path: string; t: number }
  } catch {
    return
  }
  if (!start?.t) return
  const duration_ms = Math.min(Math.max(0, Date.now() - start.t), 86_400_000)
  if (duration_ms < 1000) return
  const path = start.path || window.location.pathname
  void sendEvent({
    ...baseFields(path),
    event_type: 'engage',
    duration_ms,
    path,
  })
  // Reset start so we don't double-count until next pageview
  markPageStart(path)
  void reason
}

/** Record a pageview once per distinct path per tab session. */
export function trackPageView(pathname: string): void {
  if (!shouldTrack(pathname)) return

  // Flush time spent on previous page before switching
  flushEngage('route')

  try {
    const last = sessionStorage.getItem(LAST_PATH_KEY)
    const path = pathname.replace(/\/+$/, '') || '/'
    if (last === path) {
      markPageStart(path)
      return
    }
    sessionStorage.setItem(LAST_PATH_KEY, path)
  } catch {
    /* continue */
  }

  const path = pathname.replace(/\/+$/, '') || '/'
  markPageStart(path)
  void sendEvent({ ...baseFields(path), event_type: 'pageview' })
}

function trackLinkClick(anchor: HTMLAnchorElement) {
  if (!shouldTrack(window.location.pathname)) return
  const href = anchor.href?.trim()
  if (!href || href.startsWith('javascript:')) return

  let label =
    anchor.getAttribute('aria-label') ||
    anchor.textContent?.replace(/\s+/g, ' ').trim() ||
    ''
  label = label.slice(0, 256)

  void sendEvent({
    ...baseFields(window.location.pathname),
    event_type: 'click',
    link_url: href.slice(0, 1024),
    link_label: label,
  })
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

  const onClick = (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Element)) return
    const anchor = target.closest('a')
    if (!(anchor instanceof HTMLAnchorElement)) return
    trackLinkClick(anchor)
  }
  document.addEventListener('click', onClick, true)

  const onVis = () => {
    if (document.visibilityState === 'hidden') flushEngage('hidden')
    else markPageStart(getPath())
  }
  const onPageHide = () => flushEngage('pagehide')
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('pagehide', onPageHide)

  // Heartbeat every 30s while visible so long sessions get duration even without leave
  const beat = window.setInterval(() => {
    if (document.visibilityState === 'visible') flushEngage('heartbeat')
  }, 30_000)

  return () => {
    window.clearInterval(beat)
    window.removeEventListener('popstate', onPop)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('pagehide', onPageHide)
    history.pushState = origPush
    history.replaceState = origReplace
    flushEngage('teardown')
  }
}
