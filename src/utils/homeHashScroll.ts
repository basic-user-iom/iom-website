const PENDING_CLASS = 'section-block--pending'

const USER_SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar',
])

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

/** Real section hashes only — `#top` / empty are not deep-links and must not settle. */
export function isSectionHash(id: string): boolean {
  return Boolean(id) && id !== 'top'
}

export function isDeepLinkHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  return isSectionHash(parseLocationHash(hash))
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

/** Extra page length so a last-section hash (#contact) can actually reach the header. */
function ensureHashScrollPad(el: HTMLElement): void {
  const desiredY = window.scrollY + el.getBoundingClientRect().top - headerOffsetPx(el)
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  if (desiredY <= maxY + 1) return
  const prev = parseFloat(document.documentElement.style.getPropertyValue('--hash-scroll-pad')) || 0
  document.documentElement.style.setProperty(
    '--hash-scroll-pad',
    `${Math.ceil(prev + desiredY - maxY + 8)}px`,
  )
}

function alignToTarget(el: HTMLElement, behavior: ScrollBehavior): void {
  el.classList.add('is-visible')
  ensureHashScrollPad(el)
  const top = window.scrollY + el.getBoundingClientRect().top - headerOffsetPx(el)
  window.scrollTo({ top: Math.max(0, top), behavior })
}

let hashScrollLocks = 0

function beginHashScroll(): () => void {
  hashScrollLocks += 1
  document.documentElement.classList.add('is-hash-scrolling')
  return () => {
    hashScrollLocks = Math.max(0, hashScrollLocks - 1)
    if (hashScrollLocks === 0) {
      document.documentElement.classList.remove('is-hash-scrolling')
    }
  }
}

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function isUserScrollKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (isEditableKeyTarget(event.target)) return false
  return USER_SCROLL_KEYS.has(event.key)
}

/** Scrollbar clicks hit <html> / <body>; ignore UI clicks inside the page. */
function isViewportScrollbarPointer(event: PointerEvent): boolean {
  if (event.pointerType && event.pointerType !== 'mouse') return false
  return event.target === document.documentElement || event.target === document.body
}

/**
 * Re-align while deferred body / content-visibility shifts layout.
 * Stop immediately if the visitor takes over (wheel, touch, keys, scrollbar).
 */
function scheduleSettle(el: HTMLElement, isCancelled: () => boolean): () => void {
  let settleId = 0
  let ro: ResizeObserver | null = null
  let finished = false
  const started = Date.now()
  const endHashScroll = beginHashScroll()

  const finish = () => {
    if (finished) return
    finished = true
    if (settleId) window.clearTimeout(settleId)
    ro?.disconnect()
    window.removeEventListener('wheel', onUserIntent, listenerOpts)
    window.removeEventListener('touchmove', onUserIntent, listenerOpts)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('pointerdown', onPointerDown, listenerOpts)
    endHashScroll()
  }

  const onUserIntent = () => {
    finish()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (isUserScrollKey(event)) finish()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (isViewportScrollbarPointer(event)) finish()
  }

  const listenerOpts: AddEventListenerOptions = { passive: true, capture: true }

  const realign = () => {
    if (finished || isCancelled() || !el.isConnected) return
    if (Math.abs(targetDrift(el)) > 8) {
      alignToTarget(el, 'auto')
    }
  }

  const tick = () => {
    if (finished || isCancelled() || !el.isConnected) {
      finish()
      return
    }
    realign()
    if (Date.now() - started < 2800) {
      settleId = window.setTimeout(tick, 140)
    } else {
      finish()
    }
  }

  window.addEventListener('wheel', onUserIntent, listenerOpts)
  window.addEventListener('touchmove', onUserIntent, listenerOpts)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', onPointerDown, listenerOpts)

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(realign)
    ro.observe(el)
    const main = document.getElementById('main-content')
    if (main && main !== el) ro.observe(main)
  }

  settleId = window.setTimeout(tick, 80)
  return finish
}

export function scrollReadyHashIntoView(id: string, behavior?: ScrollBehavior): boolean {
  if (!isSectionHash(id)) return false
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
 * `#top` / empty hash never start a settle — that was yanking hard-reloads back up.
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
    if (!isSectionHash(id)) return true
    const el = findReadyHashTarget(id)
    if (!el) return false
    cancelSettle()
    cancelSettle = scheduleSettle(el, () => cancelled)
    alignToTarget(el, prefersReducedMotion() ? 'auto' : 'smooth')
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
    document.documentElement.style.removeProperty('--hash-scroll-pad')
  }
}

/** In-page hash click on the homepage. Other routes keep native navigation. */
export function handleHomeHashLinkClick(event: { preventDefault: () => void }, id: string): void {
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
    if (!isSectionHash(id)) return true
    const el = findReadyHashTarget(id)
    if (!el) return false
    cancelSettle()
    cancelSettle = scheduleSettle(el, () => cancelled)
    alignToTarget(el, prefersReducedMotion() ? 'auto' : 'smooth')
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
