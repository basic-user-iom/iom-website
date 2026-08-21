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

function revealHashTarget(el: HTMLElement): void {
  el.classList.add('is-visible')
  el.querySelectorAll('.reveal').forEach((node) => node.classList.add('is-visible'))
}

function alignToTarget(el: HTMLElement, behavior: ScrollBehavior): void {
  revealHashTarget(el)
  ensureHashScrollPad(el)
  const top = window.scrollY + el.getBoundingClientRect().top - headerOffsetPx(el)
  window.scrollTo({ top: Math.max(0, top), behavior })
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

/** Scrollbar clicks hit <html> / <body>; ignore UI clicks inside the page. */
function isViewportScrollbarPointer(event: PointerEvent): boolean {
  if (event.pointerType && event.pointerType !== 'mouse') return false
  return event.target === document.documentElement || event.target === document.body
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

/** One quiet moment after in-section images decode — no ResizeObserver loop. */
function waitForSectionMedia(el: HTMLElement, timeoutMs: number, isCancelled: () => boolean): Promise<void> {
  const images = [...el.querySelectorAll('img')].filter((img) => !img.complete)
  if (images.length === 0) return waitAnimationFrames(1)

  return new Promise((resolve) => {
    let remaining = images.length
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      resolve()
    }
    const onImg = () => {
      remaining -= 1
      if (remaining <= 0 || isCancelled()) done()
    }
    const timer = window.setTimeout(done, timeoutMs)
    for (const img of images) {
      img.addEventListener('load', onImg, { once: true })
      img.addEventListener('error', onImg, { once: true })
    }
  })
}

type LiveTarget = { current: HTMLElement }

/**
 * Scroll once (plus at most one correction after images). User intent cancels.
 * No 2.8s scrollIntoView loop and no ResizeObserver realign on every decode.
 */
function scheduleSettle(el: HTMLElement, id: string, isCancelled: () => boolean): () => void {
  let finished = false
  const endHashScroll = beginHashScroll()
  const live: LiveTarget = { current: el }

  const finish = () => {
    if (finished) return
    finished = true
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
      const placeholder = findHashPlaceholder(id)
      if (placeholder) alignToTarget(placeholder, 'auto')
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

    const motion = prefersReducedMotion() ? 'auto' : 'smooth'
    alignToTarget(target, motion)

    await waitForSectionMedia(target, 700, () => finished || isCancelled())
    await waitAnimationFrames(1)

    if (finished || isCancelled()) {
      finish()
      return
    }

    const settled = resolveLive()
    if (settled && Math.abs(targetDrift(settled)) > 8) {
      alignToTarget(settled, 'auto')
    }

    await waitAnimationFrames(1)
    finish()
  }

  window.addEventListener('wheel', onUserIntent, listenerOpts)
  window.addEventListener('touchmove', onUserIntent, listenerOpts)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', onPointerDown, listenerOpts)

  void run()
  return finish
}

export function scrollReadyHashIntoView(id: string, behavior?: ScrollBehavior): boolean {
  if (!isSectionHash(id)) return false
  const el = findReadyHashTarget(id) ?? findHashPlaceholder(id)
  if (!el) return false
  const motion = behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth')
  alignToTarget(el, motion)
  return true
}

type WatchOptions = {
  timeoutMs?: number
}

function bindHashScroll(id: string, isCancelled: () => boolean, timeoutMs: number): () => void {
  let pollId = 0
  let cancelSettle = () => {}

  const stopPoll = () => {
    if (pollId) {
      window.clearInterval(pollId)
      pollId = 0
    }
  }

  const tryScroll = (): boolean => {
    if (!isSectionHash(id)) return true
    const el = findReadyHashTarget(id) ?? findHashPlaceholder(id)
    if (!el) return false
    stopPoll()
    cancelSettle()
    cancelSettle = scheduleSettle(el, id, isCancelled)
    return true
  }

  if (tryScroll()) {
    return () => {
      stopPoll()
      cancelSettle()
    }
  }

  const started = Date.now()
  pollId = window.setInterval(() => {
    if (isCancelled() || tryScroll() || Date.now() - started > timeoutMs) stopPoll()
  }, 50)

  return () => {
    stopPoll()
    cancelSettle()
  }
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

  const start = () => {
    stopCurrent()
    const id = parseLocationHash()
    if (!isSectionHash(id)) return
    stopCurrent = bindHashScroll(id, () => cancelled, timeoutMs)
  }

  const onHash = () => {
    window.requestAnimationFrame(start)
  }

  start()
  window.addEventListener('hashchange', onHash)
  return () => {
    cancelled = true
    stopCurrent()
    window.removeEventListener('hashchange', onHash)
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
  if (parseLocationHash() !== id) {
    window.location.hash = id
    return
  }
  scrollToHashWhenReady(id)
}

/** Homepage header/footer click: wait for the real section, then scroll. */
export function scrollToHashWhenReady(id: string, options?: WatchOptions): () => void {
  const timeoutMs = options?.timeoutMs ?? 8000
  let cancelled = false
  const stop = bindHashScroll(id, () => cancelled, timeoutMs)
  return () => {
    cancelled = true
    stop()
  }
}
