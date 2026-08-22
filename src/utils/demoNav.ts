/** sessionStorage key: homepage card to restore after OPEN (demo or same-tab external). */
export const IOM_RETURN_CARD_KEY = 'iom:returnCard'

/** Homepage menu hashes — never a project card to restore after a demo. */
const HOMEPAGE_NAV_IDS = new Set([
  'software',
  '3d',
  '360',
  'photography',
  'music',
  'experiments',
  'clients',
  'about',
  'contact',
  'engage-iom',
  'main-content',
  'top',
])

/** Same-origin pages that leave the homepage and should restore exact scrollY. */
const INTERNAL_LEAVE_HOME = /^\/(demos?|case-studies|artist-globe|crm-demo|tools)(\/|$)/i

const FIRST_PARTY_DEMO = /^\/demos?(\/|$)/i

export function isHomepageNavId(id: string): boolean {
  return HOMEPAGE_NAV_IDS.has(id)
}

/**
 * External product sites with no first-party `/demos/` preview and no IOM chrome.
 * OPEN stays in the same tab so the browser Back button returns to IOM; we store
 * `iom:returnCard` before leaving so the homepage can re-center that card.
 * Cross-origin sites cannot receive the Back to IOM pill from this origin.
 */
const SAME_TAB_EXTERNAL_HOSTS = new Set(['3dbviewer.com'])

export type DemoReturnPayload = {
  projectId: string
  section?: string
  scrollY?: number
  at?: number
}

export function isFirstPartyDemoUrl(url: string | undefined): boolean {
  if (!url) return false
  if (FIRST_PARTY_DEMO.test(url)) return true
  if (!/^https?:\/\//i.test(url)) return false
  try {
    const parsed = new URL(url)
    return FIRST_PARTY_DEMO.test(parsed.pathname)
  } catch {
    return false
  }
}

export function isSameTabExternalUrl(url: string | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return SAME_TAB_EXTERNAL_HOSTS.has(host)
  } catch {
    return false
  }
}

function stripLocalePath(path: string): string {
  const raw = path.replace(/\/+$/, '') || '/'
  const parts = raw.split('/').filter(Boolean)
  if (parts[0] && /^(en|de|fr|nl|it|es)$/i.test(parts[0])) {
    const rest = `/${parts.slice(1).join('/')}`
    return rest === '/' ? '/' : rest
  }
  return raw.startsWith('/') ? raw : `/${raw}`
}

function isInternalLeaveHomeUrl(url: string | undefined): boolean {
  if (!url || /^mailto:/i.test(url)) return false
  const path = (() => {
    if (url.startsWith('/')) return stripLocalePath(url.split(/[?#]/)[0] || url)
    try {
      const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://iobjectm.com')
      if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) return ''
      return stripLocalePath(parsed.pathname)
    } catch {
      return ''
    }
  })()
  return INTERNAL_LEAVE_HOME.test(path)
}

/** First-party demos, tools, case studies, and same-tab externals restore scroll on return. */
export function shouldRememberReturnCard(url: string | undefined): boolean {
  return isFirstPartyDemoUrl(url) || isSameTabExternalUrl(url) || isInternalLeaveHomeUrl(url)
}

/** External http(s) only — first-party `/demos/` and same-tab product hosts stay in-tab. */
export function shouldOpenInNewTab(url: string | undefined): boolean {
  if (!url) return false
  if (isFirstPartyDemoUrl(url)) return false
  if (isSameTabExternalUrl(url)) return false
  return /^https?:\/\//i.test(url)
}

export function newTabAnchorProps(url: string | undefined): { target: '_blank'; rel: string } | Record<string, never> {
  if (!shouldOpenInNewTab(url)) return {}
  return { target: '_blank', rel: 'noopener noreferrer' }
}

type SameTabClickEvent = {
  preventDefault: () => void
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  button: number
}

/**
 * Left-click stays in this browser window. Ctrl/meta/shift/middle-click keep
 * native new-tab behavior. Avoids Chrome reusing a leftover popup on another monitor.
 */
export function navigateSameTabOnClick(
  event: SameTabClickEvent,
  url: string,
  project?: { id: string; section?: string },
): void {
  if (project && shouldRememberReturnCard(url)) rememberReturnCard(project)
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (shouldOpenInNewTab(url)) return
  if (!url || /^mailto:/i.test(url)) return
  event.preventDefault()
  window.location.assign(url)
}

export function rememberReturnCard(project: { id: string; section?: string }): void {
  if (typeof window === 'undefined') return
  try {
    const payload: DemoReturnPayload = {
      projectId: project.id,
      section: project.section,
      scrollY: Math.round(window.scrollY),
      at: Date.now(),
    }
    sessionStorage.setItem(IOM_RETURN_CARD_KEY, JSON.stringify(payload))
  } catch {
    /* private mode */
  }
}

export function peekReturnCard(): DemoReturnPayload | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(IOM_RETURN_CARD_KEY)
    if (!raw) return null
    if (raw.charAt(0) === '{') {
      const data = JSON.parse(raw) as DemoReturnPayload
      const projectId = String(data.projectId || '').trim()
      if (!projectId || isHomepageNavId(projectId)) return null
      if (data.at && Date.now() - data.at > 30 * 60 * 1000) return null
      return { ...data, projectId }
    }
    const projectId = raw.trim()
    if (!projectId || isHomepageNavId(projectId)) return null
    return { projectId }
  } catch {
    return null
  }
}

export function clearReturnCard(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(IOM_RETURN_CARD_KEY)
  } catch {
    /* ignore */
  }
}

export function hasReturnScrollY(payload: DemoReturnPayload | null = peekReturnCard()): boolean {
  return typeof payload?.scrollY === 'number' && Number.isFinite(payload.scrollY) && payload.scrollY >= 0
}
