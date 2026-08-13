import { clearCursorOverride, subscribeCursorApi } from './api'
import { pointOnRectPerimeter, rectPerimeterT } from './rectPerimeter'
import { resolveCursorFromTarget } from './resolveTarget'
import { isCustomCursorExcludedPath, isCustomCursorSupported } from './support'
import type { CursorMode, ResolvedCursor } from './types'

const DOT_LERP = 0.55
const RING_LERP = 0.16
const RING_ORBIT_LERP = 0.35
/** Edge travel speed (px/s). Fixed lap time made large cards feel much faster. */
const CARD_ORBIT_PX_PER_SEC = 48
/** Large reference cards get an extra slowdown on top of constant edge speed. */
const CARD_ORBIT_LARGE_SCALE = 0.55
const CARD_ORBIT_PAD = 10
const TAU = Math.PI * 2
const VISIBLE_CLASS = 'is-visible'
const ACTIVE_ROOT_CLASS = 'iom-cursor-active'
const ORBITING_CLASS = 'is-orbiting'

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
  let lastTs = 0
  let orbitEl: HTMLElement | null = null
  let orbitPhase = 0

  let current: ResolvedCursor = { mode: 'default', label: null, icon: 'none' }

  const resolveOrbitHost = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null
    // Prefer the innermost control / chip (compound selectors are unreliable in closest).
    const chip = target.closest('.pc-inquiry-chip')
    if (chip instanceof HTMLElement) return chip
    const btn = target.closest('.btn, .pc-print-btn, button')
    if (btn instanceof HTMLElement && btn.closest('.pc-main')) return btn
    const marked = target.closest('[data-cursor-orbit="card"]')
    return marked instanceof HTMLElement && marked.isConnected ? marked : null
  }

  /** Buttons, header menu, cards, logos, RFO stages: tip only — no large ring / glow. */
  const isTipOnlyTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false
    if (resolveOrbitHost(target)) return false
    const tipHost = target.closest(
      [
        '.project-card',
        '.pc-engage-card',
        '.clients-mark',
        '.about-pathway-item',
        '.contact-form-portal a',
        '.contact-form-mailto',
        '.footer-links a',
        '.btn',
        'a.btn',
        '.header-cta',
        '.header-login',
        '.header-mute',
        '.hero-start-btn',
        '.nav-toggle',
        '.header-nav a',
        '.header-tools a',
        '.header-tools button',
        '.lang-switcher',
        '.lang-switcher button',
        'button',
        '[role="button"]',
      ].join(', '),
    )
    return tipHost instanceof HTMLElement
  }

  const syncOrbitFromTarget = (target: EventTarget | null) => {
    const next = resolveOrbitHost(target)
    if (next === orbitEl) return
    if (next) {
      const box = next.getBoundingClientRect()
      const cx = box.left + box.width * 0.5
      const cy = box.top + box.height * 0.5
      const halfW = box.width * 0.5 + CARD_ORBIT_PAD
      const halfH = box.height * 0.5 + CARD_ORBIT_PAD
      orbitPhase = rectPerimeterT(cx, cy, halfW, halfH, ringX, ringY) * TAU
      orbitEl = next
      dom.root.classList.add(ORBITING_CLASS)
    } else {
      orbitEl = null
      dom.root.classList.remove(ORBITING_CLASS)
    }
  }

  const ensureDomAttached = () => {
    if (!dom.root.isConnected) {
      document.body.appendChild(dom.root)
    }
  }

  const applyResolved = (next: ResolvedCursor) => {
    if (!modesEqual(current, next)) {
      current = next
    }

    const tipOnly = isTipOnlyTarget(lastTarget)
    const showLabel = Boolean(next.label) && !tipOnly
    const modeClass =
      next.mode === 'default' || next.mode === 'native' ? '' : `is-${next.mode}`
    dom.root.dataset.mode = next.mode
    dom.root.className = [
      'iom-cursor',
      visible ? VISIBLE_CLASS : '',
      pressing ? 'is-pressing' : '',
      dragging ? 'is-dragging' : '',
      orbitEl ? ORBITING_CLASS : '',
      tipOnly ? 'is-tip-only' : '',
      next.mode === 'native' ? 'is-native' : '',
      showLabel ? 'has-label' : '',
      !tipOnly && next.icon !== 'none' ? `has-icon has-icon--${next.icon}` : '',
      tipOnly ? '' : modeClass,
    ]
      .filter(Boolean)
      .join(' ')

    if (showLabel) {
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
    orbitEl = null
    lastTs = 0
    dom.root.classList.remove(VISIBLE_CLASS, 'is-pressing', 'is-dragging', ORBITING_CLASS)
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
    orbitEl = null
    lastTs = 0
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

  const tick = (ts: number) => {
    raf = 0
    const now = ts || performance.now()
    const dtMs = lastTs ? Math.min(48, now - lastTs) : 16.67
    lastTs = now

    let ringTargetX = pointerX
    let ringTargetY = pointerY
    let ringLerp = RING_LERP
    let orbiting = false

    if (orbitEl?.isConnected) {
      const box = orbitEl.getBoundingClientRect()
      if (box.width > 2 && box.height > 2) {
        const cx = box.left + box.width * 0.5
        const cy = box.top + box.height * 0.5
        const halfW = box.width * 0.5 + CARD_ORBIT_PAD
        const halfH = box.height * 0.5 + CARD_ORBIT_PAD
        const perim = Math.max(64, 2 * (halfW * 2 + halfH * 2))
        const large =
          orbitEl.classList.contains('pc-card') ||
          box.width * box.height > 220_000
        const pxPerSec = CARD_ORBIT_PX_PER_SEC * (large ? CARD_ORBIT_LARGE_SCALE : 1)
        orbitPhase += ((pxPerSec * dtMs) / 1000 / perim) * TAU
        if (orbitPhase > TAU) orbitPhase -= TAU
        const pt = pointOnRectPerimeter(cx, cy, halfW, halfH, orbitPhase / TAU)
        ringTargetX = pt.x
        ringTargetY = pt.y
        ringLerp = RING_ORBIT_LERP
        orbiting = true
      } else {
        orbitEl = null
        dom.root.classList.remove(ORBITING_CLASS)
      }
    }

    dotX = lerp(dotX, pointerX, DOT_LERP)
    dotY = lerp(dotY, pointerY, DOT_LERP)
    ringX = lerp(ringX, ringTargetX, ringLerp)
    ringY = lerp(ringY, ringTargetY, ringLerp)

    if (Math.abs(dotX - pointerX) < 0.05) dotX = pointerX
    if (Math.abs(dotY - pointerY) < 0.05) dotY = pointerY
    if (Math.abs(ringX - ringTargetX) < 0.05) ringX = ringTargetX
    if (Math.abs(ringY - ringTargetY) < 0.05) ringY = ringTargetY

    dom.dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`
    dom.ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`

    const needsFrame =
      orbiting ||
      Math.abs(dotX - pointerX) > 0.05 ||
      Math.abs(dotY - pointerY) > 0.05 ||
      Math.abs(ringX - ringTargetX) > 0.05 ||
      Math.abs(ringY - ringTargetY) > 0.05

    if (needsFrame) {
      raf = window.requestAnimationFrame(tick)
    } else {
      lastTs = 0
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
    syncOrbitFromTarget(under)
    requestTick()
  }

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    refreshFromTarget(event.target)
    syncOrbitFromTarget(event.target)
    requestTick()
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
    syncOrbitFromTarget(under)
    requestTick()
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
    const under = document.elementFromPoint(event.clientX, event.clientY)
    refreshFromTarget(under)
    syncOrbitFromTarget(under)
    requestTick()
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
