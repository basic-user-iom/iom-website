import { clearCursorOverride, subscribeCursorApi } from './api'
import { resolveCursorFromTarget } from './resolveTarget'
import { isCustomCursorExcludedPath, isCustomCursorSupported } from './support'
import type { CursorMode, ResolvedCursor } from './types'

const DOT_LERP = 0.55
const RING_LERP = 0.16
const VISIBLE_CLASS = 'is-visible'
const ACTIVE_ROOT_CLASS = 'iom-cursor-active'

type CursorDom = {
  root: HTMLDivElement
  ring: HTMLDivElement
  dot: HTMLDivElement
  label: HTMLSpanElement
  icon: HTMLSpanElement
}

let activeCleanup: (() => void) | null = null
/** Soft kill switch used by CRM routes — prefer native pointer in dense tools. */
let cursorEnabled = true

function forceTearDown() {
  activeCleanup?.()
  activeCleanup = null
  document.documentElement.classList.remove(ACTIVE_ROOT_CLASS)
  document.querySelectorAll('.iom-cursor').forEach((el) => el.remove())
}

/** Enable/disable the site cursor (CRM routes turn it off). */
export function setCustomCursorEnabled(next: boolean): void {
  if (cursorEnabled === next) {
    if (!next) forceTearDown()
    return
  }
  cursorEnabled = next
  if (!next) {
    forceTearDown()
    return
  }
  if (!isCustomCursorExcludedPath()) {
    ensureCustomCursor()
  }
}

function createDom(): CursorDom {
  const root = document.createElement('div')
  root.className = 'iom-cursor'
  root.setAttribute('aria-hidden', 'true')

  const ring = document.createElement('div')
  ring.className = 'iom-cursor__ring'

  const label = document.createElement('span')
  label.className = 'iom-cursor__label'
  label.hidden = true

  const icon = document.createElement('span')
  icon.className = 'iom-cursor__icon'
  icon.innerHTML =
    '<svg class="iom-cursor__svg iom-cursor__svg--external" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3.5h8.5V12M12.5 3.5 3.5 12.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/></svg>' +
    '<svg class="iom-cursor__svg iom-cursor__svg--drag" viewBox="0 0 24 10" aria-hidden="true"><path d="M3 5h18M5 2.5 2.5 5 5 7.5M19 2.5 21.5 5 19 7.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square" stroke-linejoin="miter"/></svg>' +
    '<svg class="iom-cursor__svg iom-cursor__svg--look" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M14.8 5.2l-1.4 1.4M6.6 13.4l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="square"/></svg>'

  ring.append(label, icon)

  const dot = document.createElement('div')
  dot.className = 'iom-cursor__dot'

  root.append(ring, dot)
  return { root, ring, dot, label, icon }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function modesEqual(a: ResolvedCursor, b: ResolvedCursor): boolean {
  return a.mode === b.mode && a.label === b.label && a.icon === b.icon
}

/**
 * Imperatively mounts the custom cursor. Safe under React Strict Mode.
 * Survives demo tab hops / bfcache via pageshow + visibility resume.
 */
export function mountCustomCursor(): (() => void) | null {
  if (!cursorEnabled || isCustomCursorExcludedPath() || !isCustomCursorSupported()) return null

  // Replace any prior instance (Strict Mode remount / HMR / resume remount).
  if (activeCleanup) {
    activeCleanup()
    activeCleanup = null
  }

  const dom = createDom()
  document.body.appendChild(dom.root)
  // Native cursor stays until the first real pointer move after mount/resume.

  let raf = 0
  let visible = false
  let pressing = false
  let dragging = false
  let lastTarget: EventTarget | null = null
  let pulseTimer = 0

  let pointerX = -100
  let pointerY = -100
  let dotX = -100
  let dotY = -100
  let ringX = -100
  let ringY = -100

  let current: ResolvedCursor = { mode: 'default', label: null, icon: 'none' }

  const ensureDomAttached = () => {
    if (!dom.root.isConnected) {
      document.body.appendChild(dom.root)
    }
  }

  const applyResolved = (next: ResolvedCursor) => {
    if (!modesEqual(current, next)) {
      current = next
    }

    const modeClass =
      next.mode === 'default' || next.mode === 'native' ? '' : `is-${next.mode}`
    dom.root.dataset.mode = next.mode
    dom.root.className = [
      'iom-cursor',
      visible ? VISIBLE_CLASS : '',
      pressing ? 'is-pressing' : '',
      dragging ? 'is-dragging' : '',
      next.mode === 'native' ? 'is-native' : '',
      next.label ? 'has-label' : '',
      next.icon !== 'none' ? `has-icon has-icon--${next.icon}` : '',
      modeClass,
    ]
      .filter(Boolean)
      .join(' ')

    if (next.label) {
      dom.label.textContent = next.label
      dom.label.hidden = false
    } else {
      dom.label.textContent = ''
      dom.label.hidden = true
    }
  }

  const refreshFromTarget = (target: EventTarget | null = lastTarget) => {
    lastTarget = target
    applyResolved(resolveCursorFromTarget(target, { dragging }))
  }

  const claimPointer = () => {
    document.documentElement.classList.add(ACTIVE_ROOT_CLASS)
  }

  const releasePointer = () => {
    document.documentElement.classList.remove(ACTIVE_ROOT_CLASS)
  }

  const show = () => {
    ensureDomAttached()
    claimPointer()
    if (visible) return
    visible = true
    refreshFromTarget(lastTarget)
  }

  const hide = () => {
    if (!visible && !document.documentElement.classList.contains(ACTIVE_ROOT_CLASS)) return
    visible = false
    pressing = false
    dragging = false
    dom.root.classList.remove(VISIBLE_CLASS, 'is-pressing', 'is-dragging')
    refreshFromTarget(lastTarget)
  }

  /**
   * After leaving for a demo tab (or bfcache), drop custom ownership so the
   * system cursor works immediately on return, then re-claim on next move.
   */
  const softResume = () => {
    ensureDomAttached()
    clearCursorOverride()
    pressing = false
    dragging = false
    lastTarget = null
    current = { mode: 'default', label: null, icon: 'none' }
    visible = false
    if (pulseTimer) {
      window.clearTimeout(pulseTimer)
      pulseTimer = 0
    }
    dom.root.className = 'iom-cursor'
    dom.root.dataset.mode = 'default'
    dom.label.textContent = ''
    dom.label.hidden = true
    releasePointer()
  }

  const tick = () => {
    raf = 0
    dotX = lerp(dotX, pointerX, DOT_LERP)
    dotY = lerp(dotY, pointerY, DOT_LERP)
    ringX = lerp(ringX, pointerX, RING_LERP)
    ringY = lerp(ringY, pointerY, RING_LERP)

    if (Math.abs(dotX - pointerX) < 0.05) dotX = pointerX
    if (Math.abs(dotY - pointerY) < 0.05) dotY = pointerY
    if (Math.abs(ringX - pointerX) < 0.05) ringX = pointerX
    if (Math.abs(ringY - pointerY) < 0.05) ringY = pointerY

    dom.dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`
    dom.ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`

    const needsFrame =
      Math.abs(dotX - pointerX) > 0.05 ||
      Math.abs(dotY - pointerY) > 0.05 ||
      Math.abs(ringX - pointerX) > 0.05 ||
      Math.abs(ringY - pointerY) > 0.05

    if (needsFrame) {
      raf = window.requestAnimationFrame(tick)
    }
  }

  const requestTick = () => {
    if (!raf) raf = window.requestAnimationFrame(tick)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return

    pointerX = event.clientX
    pointerY = event.clientY

    if (!visible) {
      dotX = pointerX
      dotY = pointerY
      ringX = pointerX
      ringY = pointerY
      show()
      dom.dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`
      dom.ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`
    }

    const under = document.elementFromPoint(event.clientX, event.clientY)
    refreshFromTarget(under)
    requestTick()
  }

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    refreshFromTarget(event.target)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.button !== 0) return
    pressing = true

    const under = document.elementFromPoint(event.clientX, event.clientY)
    const hit = under?.closest('[data-cursor]') as HTMLElement | null
    const mode = hit?.getAttribute('data-cursor') as CursorMode | null
    if (mode === 'drag' || mode === 'look' || mode === 'explore') {
      dragging = true
    }
    refreshFromTarget(under)
  }

  const endPress = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    pressing = false
    dragging = false
    dom.root.classList.add('is-pulse')
    if (pulseTimer) window.clearTimeout(pulseTimer)
    pulseTimer = window.setTimeout(() => {
      dom.root.classList.remove('is-pulse')
      pulseTimer = 0
    }, 220)
    refreshFromTarget(document.elementFromPoint(event.clientX, event.clientY))
  }

  const onPointerLeaveWindow = (event: MouseEvent) => {
    if (event.relatedTarget == null) {
      hide()
    }
  }

  const onVisibility = () => {
    if (document.hidden) {
      softResume()
      return
    }
    // Tab focused again (e.g. closed panorama demo tab / switched back).
    softResume()
  }

  const onPageShow = () => {
    // bfcache restore after back-navigation from a same-tab demo.
    softResume()
  }

  const onWindowFocus = () => {
    if (!document.hidden) softResume()
  }

  const unsubApi = subscribeCursorApi(() => {
    refreshFromTarget(lastTarget)
  })

  document.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('pointerover', onPointerOver, { passive: true, capture: true })
  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('pointerup', endPress, { passive: true })
  document.addEventListener('pointercancel', endPress, { passive: true })
  document.documentElement.addEventListener('mouseleave', onPointerLeaveWindow)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('focus', onWindowFocus)

  const cleanup = () => {
    unsubApi()
    if (raf) window.cancelAnimationFrame(raf)
    if (pulseTimer) window.clearTimeout(pulseTimer)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerover', onPointerOver, true)
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('pointerup', endPress)
    document.removeEventListener('pointercancel', endPress)
    document.documentElement.removeEventListener('mouseleave', onPointerLeaveWindow)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', onPageShow)
    window.removeEventListener('focus', onWindowFocus)
    releasePointer()
    dom.root.remove()
    if (activeCleanup === cleanup) activeCleanup = null
  }

  activeCleanup = cleanup
  return cleanup
}

/** Remount if the live instance was lost (HMR edge cases / torn DOM). */
export function ensureCustomCursor(): (() => void) | null {
  if (!cursorEnabled || isCustomCursorExcludedPath() || !isCustomCursorSupported()) {
    forceTearDown()
    return null
  }
  const alive =
    activeCleanup &&
    document.querySelector('.iom-cursor') &&
    document.querySelector('.iom-cursor')?.isConnected
  if (alive) return activeCleanup
  return mountCustomCursor()
}
