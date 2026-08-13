const PENDING_CLASS = 'section-block--pending'

function escapeAttr(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id)
  return id.replace(/["\\]/g, '\\$&')
}

export function parseLocationHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): string {
  const raw = hash.replace(/^#/, '').trim()
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Real section only — skip deferred placeholders so hash scroll cannot land on an empty box. */
export function findReadyHashTarget(id: string): HTMLElement | null {
  if (!id) return null
  const nodes = document.querySelectorAll<HTMLElement>(`[id="${escapeAttr(id)}"]`)
  for (const el of nodes) {
    if (!el.classList.contains(PENDING_CLASS)) return el
  }
  return null
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function headerOffsetPx(el: HTMLElement): number {
  const fromEl = parseFloat(getComputedStyle(el).scrollMarginTop)
  if (Number.isFinite(fromEl) && fromEl > 0) return fromEl
  const fromRoot = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'))
  return Number.isFinite(fromRoot) ? fromRoot : 72
}

function targetDrift(el: HTMLElement): number {
  return el.getBoundingClientRect().top - headerOffsetPx(el)
}

function alignToTarget(el: HTMLElement, behavior: ScrollBehavior): void {
  el.classList.add('is-visible')
  el.scrollIntoView({ behavior, block: 'start' })
}

function scheduleSettle(el: HTMLElement, isCancelled: () => boolean): () => void {
  let settleId = 0
  const started = Date.now()
  const tick = () => {
    if (isCancelled() || !el.isConnected) return
    if (Math.abs(targetDrift(el)) > 8) {
      alignToTarget(el, 'auto')
    }
    if (Date.now() - started < 1400) {
      settleId = window.setTimeout(tick, 140)
    }
  }
  settleId = window.setTimeout(tick, 80)
  return () => {
    if (settleId) window.clearTimeout(settleId)
  }
}

export function scrollReadyHashIntoView(id: string, behavior?: ScrollBehavior): boolean {
  const el = findReadyHashTarget(id)
  if (!el) return false
  const motion = behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth')
  alignToTarget(el, motion)
  return true
}

type WatchOptions = {
  timeoutMs?: number
}

/**
 * Scroll to the current location hash once the real section exists, then
 * re-align if deferred body / content-visibility shifts layout.
 * Always listens for hashchange (same-page About / Costs clicks).
 */
export function watchLocationHashScroll(options?: WatchOptions): () => void {
  const timeoutMs = options?.timeoutMs ?? 8000
  let cancelled = false
  let pollId = 0
  let cancelSettle = () => {}

  const stopPoll = () => {
    if (pollId) {
      window.clearInterval(pollId)
      pollId = 0
    }
  }

  const tryScroll = (): boolean => {
    const id = parseLocationHash()
    if (!id) return true
    const el = findReadyHashTarget(id)
    if (!el) return false
    alignToTarget(el, prefersReducedMotion() ? 'auto' : 'smooth')
    cancelSettle()
    cancelSettle = scheduleSettle(el, () => cancelled)
    return true
  }

  const start = () => {
    stopPoll()
    cancelSettle()
    if (tryScroll()) return
    const started = Date.now()
    pollId = window.setInterval(() => {
      if (tryScroll() || Date.now() - started > timeoutMs) stopPoll()
    }, 50)
  }

  const onHash = () => {
    window.requestAnimationFrame(start)
  }

  start()
  window.addEventListener('hashchange', onHash)
  return () => {
    cancelled = true
    stopPoll()
    cancelSettle()
    window.removeEventListener('hashchange', onHash)
  }
}

/** In-page hash click on the homepage. Other routes keep native navigation. */
export function handleHomeHashLinkClick(event: MouseEvent, id: string): void {
  if (!document.getElementById('top')) return
  event.preventDefault()
  if (parseLocationHash() !== id) {
    window.location.hash = id
  }
  scrollToHashWhenReady(id)
}

/** Homepage header/footer click: wait for the real section, then scroll. */
export function scrollToHashWhenReady(id: string, options?: WatchOptions): () => void {
  const timeoutMs = options?.timeoutMs ?? 8000
  let cancelled = false
  let pollId = 0
  let cancelSettle = () => {}

  const stop = () => {
    if (pollId) {
      window.clearInterval(pollId)
      pollId = 0
    }
  }

  const tryScroll = (): boolean => {
    const el = findReadyHashTarget(id)
    if (!el) return false
    alignToTarget(el, prefersReducedMotion() ? 'auto' : 'smooth')
    cancelSettle()
    cancelSettle = scheduleSettle(el, () => cancelled)
    return true
  }

  if (tryScroll()) {
    return () => {
      cancelled = true
      cancelSettle()
    }
  }

  const started = Date.now()
  pollId = window.setInterval(() => {
    if (cancelled || tryScroll() || Date.now() - started > timeoutMs) stop()
  }, 50)

  return () => {
    cancelled = true
    stop()
    cancelSettle()
  }
}
