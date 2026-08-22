/** sessionStorage key: homepage card to restore after a first-party demo. */
export const IOM_RETURN_CARD_KEY = 'iom:returnCard'

const FIRST_PARTY_DEMO = /^\/demos?(\/|$)/i

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

/** External http(s) only — first-party `/demos/` and `/demo/` stay same-tab. */
export function shouldOpenInNewTab(url: string | undefined): boolean {
  if (!url) return false
  if (isFirstPartyDemoUrl(url)) return false
  return /^https?:\/\//i.test(url)
}

export function newTabAnchorProps(url: string | undefined): { target: '_blank'; rel: string } | Record<string, never> {
  if (!shouldOpenInNewTab(url)) return {}
  return { target: '_blank', rel: 'noopener noreferrer' }
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
      if (!projectId || projectId === 'music' || projectId === 'top') return null
      if (data.at && Date.now() - data.at > 30 * 60 * 1000) return null
      return { ...data, projectId }
    }
    const projectId = raw.trim()
    if (!projectId || projectId === 'music' || projectId === 'top') return null
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
