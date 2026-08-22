import { clearReturnCard, peekReturnCard } from './demoNav'

const PENDING_CLASS = 'section-block--pending'

/** In-page menu / footer hash travel. Long enough to see the page move; short of a trap. */
const HASH_SCROLL_MS = 900

/** Homepage nav hashes — card ids (project.id) use center alignment instead. */
const NAV_SECTION_IDS = new Set([
  'software',
  '3d',
  '360',
  'photography',
  'music',
  'experiments',
  'clients',
  'about',
  'contact',
  'main-content',
])

type ScrollAlign = 'start' | 'center'

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

export function isNavSectionId(id: string): boolean {
  return NAV_SECTION_IDS.has(id)
}

/** Project card hashes (`id={project.id}`) — not Software / Experiments menu targets. */
export function isCardHash(id: string): boolean {
  return isSectionHash(id) && !isNavSectionId(id)
}

export function isDeepLinkHash(hash = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  return isSectionHash(parseLocationHash(hash))
}

function isPendingOrBusy(el: HTMLElement): boolean {
  return el.classList.contains(PENDING_CLASS) || el.getAttribute('aria-busy') === 'true'
}

/** Real section only — skip deferred placeholders so hash scroll cannot land on an empty box. */
export function findReadyHashTarget(id: string): HTMLElement | null {
  if (!id) return null
  const nodes = document.querySelectorAll<HTMLElement>(`[id="${escapeAttr(id)}"]`)
  for (const el of nodes) {
    if (!isPendingOrBusy(el)) return el
  }
  return null
}

/** Placeholder with the hash id (e.g. deferred music) — used once to bring it on-screen. */
function findHashPlaceholder(id: string): HTMLElement | null {
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
  const header = document.querySelector('.site-header')
  if (header instanceof HTMLElement) {
    const bottom = header.getBoundingClientRect().bottom
    if (bottom > 0) return bottom
  }
  const fromEl = parseFloat(getComputedStyle(el).scrollMarginTop)
  if (Number.isFinite(fromEl) && fromEl > 0) return fromEl
  const fromRoot = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'))
  return Number.isFinite(fromRoot) ? fromRoot : 72
}

function targetYFor(el: HTMLElement, align: ScrollAlign = 'start'): number {
  const rect = el.getBoundingClientRect()
  if (align === 'center') {
    const center = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2
    return Math.max(0, Math.round(center))
  }
  return Math.max(0, window.scrollY + rect.top - headerOffsetPx(el))
}

/** Extra page length so a last-section hash (#contact) can actually reach the header. */
function ensureHashScrollPad(el: HTMLElement, align: ScrollAlign = 'start'): void {
  const desiredY = targetYFor(el, align)
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  if (desiredY <= maxY + 1) return
  const prev = parseFloat(document.documentElement.style.getPropertyValue('--hash-scroll-pad')) || 0
  document.documentElement.style.setProperty(
    '--hash-scroll-pad',
    `${Math.ceil(prev + desiredY - maxY + 8)}px`,
  )
}

function revealHashTarget(el: HTMLElement): void {
  el.classList.add('is-visible', 'is-hash-scroll-target')
  el.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-visible'))
}

function alignToTarget(el: HTMLElement, align: ScrollAlign = 'start'): void {
  revealHashTarget(el)
  ensureHashScrollPad(el, align)
  window.scrollTo({ top: targetYFor(el, align), behavior: 'auto' })
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function rememberSectionSizes(): void {
  document.querySelectorAll<HTMLElement>('.section-block').forEach((el) => {
    if (el.classList.contains(PENDING_CLASS)) return
    const height = el.getBoundingClientRect().height
    if (height > 1) el.style.containIntrinsicSize = `auto ${Math.round(height)}px`
  })
}

let hashScrollLocks = 0

function beginHashScroll(): () => void {
  hashScrollLocks += 1
  document.documentElement.classList.add('is-hash-scrolling')
  document.documentElement.style.setProperty('overflow-anchor', 'none')
  return () => {
    hashScrollLocks = Math.max(0, hashScrollLocks - 1)
    if (hashScrollLocks === 0) {
      rememberSectionSizes()
      document.documentElement.classList.remove('is-hash-scrolling')
      document.documentElement.style.removeProperty('overflow-anchor')
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

function waitAnimationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      window.requestAnimationFrame(() => step(left - 1))
    }
    step(count)
  })
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

type LiveTarget = { current: HTMLElement }

/**
 * One shot to the section: either an instant jump (first-load hash) or a ~900ms
 * rAF lerp (in-page menu). User wheel / touch / scroll keys cancel immediately.
 */
function scheduleSettle(
  el: HTMLElement,
  id: string,
  isCancelled: () => boolean,
  animate: boolean,
  align: ScrollAlign = 'start',
  onSettled?: () => void,
): () => void {
  let finished = false
  let rafId = 0
  const endHashScroll = beginHashScroll()
  const live: LiveTarget = { current: el }

  const finish = () => {
    if (finished) return
    finished = true
    if (rafId) window.cancelAnimationFrame(rafId)
    rafId = 0
    window.removeEventListener('wheel', onUserIntent, listenerOpts)
    window.removeEventListener('touchmove', onUserIntent, listenerOpts)
    window.removeEventListener('keydown', onKeyDown)
    endHashScroll()
  }

  const onUserIntent = () => {
    finish()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (isUserScrollKey(event)) finish()
  }

  const listenerOpts: AddEventListenerOptions = { passive: true, capture: true }

  const resolveLive = (): HTMLElement | null => {
    if (live.current.isConnected && !isPendingOrBusy(live.current)) return live.current
    const next = findReadyHashTarget(id)
    if (next) live.current = next
    return next
  }

  const run = async () => {
    await waitAnimationFrames(2)
    if (finished || isCancelled()) {
      finish()
      return
    }

    let target = resolveLive()
    if (!target) {
      // Deep-link only: park on a placeholder so the URL hash has somewhere to land.
      // In-page animate waits here so we do not jump, then lerp.
      if (!animate) {
        const placeholder = findHashPlaceholder(id)
        if (placeholder) alignToTarget(placeholder, align)
      }
      const started = Date.now()
      while (!target && !finished && !isCancelled() && Date.now() - started < 4000) {
        await waitMs(50)
        target = resolveLive()
      }
    }

    if (finished || isCancelled() || !target) {
      finish()
      return
    }

    revealHashTarget(target)
    await waitAnimationFrames(2)
    if (finished || isCancelled()) {
      finish()
      return
    }
    ensureHashScrollPad(target, align)
    const toY = targetYFor(target, align)
    const fromY = window.scrollY
    const delta = toY - fromY
    const shouldAnimate = animate && !prefersReducedMotion() && Math.abs(delta) > 1

    if (!shouldAnimate) {
      window.scrollTo({ top: toY, behavior: 'auto' })
      onSettled?.()
      finish()
      return
    }

    const t0 = performance.now()
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (finished || isCancelled()) {
          resolve()
          return
        }
        const t = Math.min(1, (now - t0) / HASH_SCROLL_MS)
        const liveEl = resolveLive()
        if (liveEl) ensureHashScrollPad(liveEl, align)
        const dest = liveEl ? targetYFor(liveEl, align) : fromY + delta
        window.scrollTo({ top: fromY + (dest - fromY) * easeInOutCubic(t), behavior: 'auto' })
        if (t < 1) {
          rafId = window.requestAnimationFrame(tick)
          return
        }
        resolve()
      }
      rafId = window.requestAnimationFrame(tick)
    })

    onSettled?.()
    finish()
  }

  window.addEventListener('wheel', onUserIntent, listenerOpts)
  window.addEventListener('touchmove', onUserIntent, listenerOpts)
  window.addEventListener('keydown', onKeyDown)

  void run()
  return finish
}

export function scrollReadyHashIntoView(id: string, behavior?: ScrollBehavior): boolean {
  if (!isSectionHash(id)) return false
  const el = findReadyHashTarget(id) ?? findHashPlaceholder(id)
  if (!el) return false
  const align: ScrollAlign = isCardHash(id) ? 'center' : 'start'
  const animate = (behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth')) === 'smooth'
  if (animate) {
    scheduleSettle(el, id, () => false, true, align)
  } else {
    alignToTarget(el, align)
  }
  return true
}

type WatchOptions = {
  timeoutMs?: number
  /** Eased rAF travel. Default true for menu clicks; first-load hash passes false. */
  animate?: boolean
}

let cancelActiveScroll = () => {}

function bindHashScroll(
  id: string,
  isCancelled: () => boolean,
  timeoutMs: number,
  animate: boolean,
  align: ScrollAlign = 'start',
  onSettled?: () => void,
): () => void {
  cancelActiveScroll()

  let pollId = 0
  let cancelSettle = () => {}

  const stopPoll = () => {
    if (pollId) {
      window.clearInterval(pollId)
      pollId = 0
    }
  }

  const stop = () => {
    stopPoll()
    cancelSettle()
  }

  const tryScroll = (): boolean => {
    if (!isSectionHash(id)) return true
    const el = findReadyHashTarget(id) ?? findHashPlaceholder(id)
    if (!el) return false
    stopPoll()
    cancelSettle()
    cancelSettle = scheduleSettle(el, id, isCancelled, animate, align, onSettled)
    return true
  }

  cancelActiveScroll = stop

  if (tryScroll()) return stop

  const started = Date.now()
  pollId = window.setInterval(() => {
    if (isCancelled() || tryScroll() || Date.now() - started > timeoutMs) stopPoll()
  }, 50)

  return stop
}

/** Ignore the hashchange that follows an in-page menu click we already animated. */
let ignoreHashchangeUntil = 0
let lastInPageNavId = ''
let lastInPageNavAt = 0

function markInPageHashNav(id: string): boolean {
  const now = performance.now()
  if (id === lastInPageNavId && now - lastInPageNavAt < 80) return false
  lastInPageNavId = id
  lastInPageNavAt = now
  ignoreHashchangeUntil = now + 400
  return true
}

function samePageHashId(anchor: HTMLAnchorElement): string {
  let url: URL
  try {
    url = new URL(anchor.href, window.location.href)
  } catch {
    return ''
  }
  if (url.origin !== window.location.origin) return ''
  const here = window.location.pathname.replace(/\/+$/, '') || '/'
  const there = url.pathname.replace(/\/+$/, '') || '/'
  if (here !== there) return ''
  return parseLocationHash(url.hash)
}

/**
 * Scroll to the current location hash once the real section exists.
 * Always listens for hashchange (same-page About / Costs clicks).
 * `#top` / empty hash never start a settle — that was yanking hard-reloads back up.
 */
export function watchLocationHashScroll(options?: WatchOptions): () => void {
  const timeoutMs = options?.timeoutMs ?? 8000
  let cancelled = false
  let stopCurrent = () => {}

  const start = (animate: boolean) => {
    if (animate && performance.now() < ignoreHashchangeUntil) return
    stopCurrent()
    const stored = peekReturnCard()
    const hashId = parseLocationHash()
    const id = stored?.projectId || hashId
    if (!isSectionHash(id)) return
    const align: ScrollAlign = isCardHash(id) ? 'center' : 'start'
    if (stored?.projectId && hashId !== stored.projectId) {
      try {
        window.history.replaceState(null, '', `#${stored.projectId}`)
      } catch {
        /* ignore */
      }
    }
    stopCurrent = bindHashScroll(id, () => cancelled, timeoutMs, animate, align, () => {
      if (stored?.projectId === id) clearReturnCard()
    })
  }

  const onHash = () => {
    window.requestAnimationFrame(() => start(true))
  }

  const onPop = () => {
    window.requestAnimationFrame(() => start(true))
  }

  const onDocClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const el = event.target
    if (!(el instanceof Element)) return
    const anchor = el.closest('a')
    if (!(anchor instanceof HTMLAnchorElement)) return
    const id = samePageHashId(anchor)
    if (!isSectionHash(id) || id === 'main-content') return
    if (!anchor.closest('.header-nav, .header-tools, .site-footer, .hero-actions')) return
    handleHomeHashLinkClick(event, id)
  }

  start(false)
  window.addEventListener('hashchange', onHash)
  window.addEventListener('popstate', onPop)
  window.addEventListener('click', onDocClick, true)
  return () => {
    cancelled = true
    stopCurrent()
    cancelActiveScroll()
    window.removeEventListener('hashchange', onHash)
    window.removeEventListener('popstate', onPop)
    window.removeEventListener('click', onDocClick, true)
    document.documentElement.classList.remove('is-hash-scrolling')
    document.documentElement.style.removeProperty('--hash-scroll-pad')
    document.documentElement.style.removeProperty('overflow-anchor')
    hashScrollLocks = 0
  }
}

/** In-page hash click on the homepage. Other routes keep native navigation. */
export function handleHomeHashLinkClick(event: { preventDefault: () => void }, id: string): void {
  if (!document.getElementById('top')) return
  event.preventDefault()
  if (!isSectionHash(id)) return
  if (!markInPageHashNav(id)) return
  if (parseLocationHash() !== id) {
    // pushState updates the URL without the browser jumping to the fragment.
    window.history.pushState(null, '', `#${id}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  }
  scrollToHashWhenReady(id, { animate: true })
}

/** Homepage header/footer click: wait for the real section, then scroll once. */
export function scrollToHashWhenReady(id: string, options?: WatchOptions): () => void {
  const timeoutMs = options?.timeoutMs ?? 8000
  const animate = options?.animate ?? true
  const align: ScrollAlign = isCardHash(id) ? 'center' : 'start'
  let cancelled = false
  const stop = bindHashScroll(id, () => cancelled, timeoutMs, animate, align)
  return () => {
    cancelled = true
    stop()
  }
}
