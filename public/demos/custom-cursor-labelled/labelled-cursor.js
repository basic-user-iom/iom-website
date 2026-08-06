/**
 * Labelled custom cursor — vanilla demo port of parked v1.
 * Fine pointer + hover only. Dot tracks fast; ring follows with inertia.
 */
;(() => {
  const DOT_LERP = 0.55
  const RING_LERP = 0.16
  const ACTIVE = 'iom-cursor-active'

  const LABELS = {
    view: 'VIEW',
    play: 'PLAY',
    pause: 'PAUSE',
    explore: 'EXPLORE',
    drag: 'DRAG',
    look: 'LOOK',
    start: 'START',
  }

  const supported =
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!supported) return

  const root = document.createElement('div')
  root.className = 'iom-cursor'
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <div class="iom-cursor__ring">
      <span class="iom-cursor__label" hidden></span>
      <span class="iom-cursor__icon">
        <svg class="iom-cursor__svg iom-cursor__svg--external" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3.5h8.5V12M12.5 3.5 3.5 12.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/></svg>
        <svg class="iom-cursor__svg iom-cursor__svg--drag" viewBox="0 0 24 10" aria-hidden="true"><path d="M3 5h18M5 2.5 2.5 5 5 7.5M19 2.5 21.5 5 19 7.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square"/></svg>
        <svg class="iom-cursor__svg iom-cursor__svg--look" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M14.8 5.2l-1.4 1.4M6.6 13.4l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="square"/></svg>
      </span>
    </div>
    <div class="iom-cursor__dot"></div>
  `
  document.body.appendChild(root)

  const ring = root.querySelector('.iom-cursor__ring')
  const dot = root.querySelector('.iom-cursor__dot')
  const labelEl = root.querySelector('.iom-cursor__label')

  let raf = 0
  let visible = false
  let pressing = false
  let dragging = false
  let px = -100
  let py = -100
  let dx = -100
  let dy = -100
  let rx = -100
  let ry = -100
  let mode = 'default'
  let label = null
  let icon = 'none'

  const lerp = (a, b, t) => a + (b - a) * t

  function resolve(target) {
    const el = target instanceof Element ? target : null
    if (!el) return { mode: 'default', label: null, icon: 'none' }

    if (el.closest('input, textarea, select, [contenteditable="true"], [data-cursor="native"]')) {
      return { mode: 'native', label: null, icon: 'none' }
    }

    const host = el.closest('[data-cursor]')
    const control = el.closest('a[href], button, summary, [role="button"]')

    if (control && control !== host) {
      const own = control.getAttribute('data-cursor')
      if (own) return finalize(own, control.getAttribute('data-cursor-label'))
      if (!host || !control.classList.contains('hit')) {
        return { mode: 'link', label: null, icon: 'none' }
      }
    }

    if (host) {
      return finalize(host.getAttribute('data-cursor'), host.getAttribute('data-cursor-label'))
    }

    if (control) return { mode: 'link', label: null, icon: 'none' }
    return { mode: 'default', label: null, icon: 'none' }
  }

  function finalize(raw, custom) {
    let next = raw || 'default'
    if ((next === 'look' || next === 'explore') && dragging) next = 'drag'
    let nextLabel = custom ? custom.toUpperCase() : LABELS[next] || null
    if (next === 'drag' && dragging) nextLabel = 'MOVE'
    if (next === 'link' || next === 'external' || next === 'default' || next === 'native') {
      if (next !== 'external') nextLabel = custom ? custom.toUpperCase() : null
    }
    const nextIcon =
      next === 'external' ? 'external' : next === 'drag' ? 'drag' : next === 'look' ? 'look' : 'none'
    return { mode: next, label: nextLabel, icon: nextIcon }
  }

  function apply(next) {
    mode = next.mode
    label = next.label
    icon = next.icon
    const modeClass = mode === 'default' || mode === 'native' ? '' : `is-${mode}`
    root.dataset.mode = mode
    root.className = [
      'iom-cursor',
      visible ? 'is-visible' : '',
      pressing ? 'is-pressing' : '',
      dragging ? 'is-dragging' : '',
      mode === 'native' ? 'is-native' : '',
      label ? 'has-label' : '',
      icon !== 'none' ? `has-icon has-icon--${icon}` : '',
      modeClass,
    ]
      .filter(Boolean)
      .join(' ')

    if (label) {
      labelEl.textContent = label
      labelEl.hidden = false
    } else {
      labelEl.textContent = ''
      labelEl.hidden = true
    }
  }

  function show() {
    document.documentElement.classList.add(ACTIVE)
    if (visible) return
    visible = true
  }

  function softResume() {
    visible = false
    pressing = false
    dragging = false
    root.className = 'iom-cursor'
    root.dataset.mode = 'default'
    document.documentElement.classList.remove(ACTIVE)
  }

  function tick() {
    raf = 0
    dx = lerp(dx, px, DOT_LERP)
    dy = lerp(dy, py, DOT_LERP)
    rx = lerp(rx, px, RING_LERP)
    ry = lerp(ry, py, RING_LERP)
    if (Math.abs(dx - px) < 0.05) dx = px
    if (Math.abs(dy - py) < 0.05) dy = py
    if (Math.abs(rx - px) < 0.05) rx = px
    if (Math.abs(ry - py) < 0.05) ry = py
    dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`
    if (
      Math.abs(dx - px) > 0.05 ||
      Math.abs(dy - py) > 0.05 ||
      Math.abs(rx - px) > 0.05 ||
      Math.abs(ry - py) > 0.05
    ) {
      raf = requestAnimationFrame(tick)
    }
  }

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return
      px = e.clientX
      py = e.clientY
      if (!visible) {
        dx = px
        dy = py
        rx = px
        ry = py
        show()
        dot.style.transform = `translate3d(${dx}px, ${dy}px, 0) translate(-50%, -50%)`
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`
      }
      apply(resolve(document.elementFromPoint(px, py)))
      if (!raf) raf = requestAnimationFrame(tick)
    },
    { passive: true },
  )

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return
      pressing = true
      const under = document.elementFromPoint(e.clientX, e.clientY)
      const hit = under?.closest('[data-cursor]')
      const m = hit?.getAttribute('data-cursor')
      if (m === 'drag' || m === 'look' || m === 'explore') dragging = true
      apply(resolve(under))
    },
    { passive: true },
  )

  const endPress = (e) => {
    if (e.pointerType === 'touch') return
    pressing = false
    dragging = false
    root.classList.add('is-pulse')
    setTimeout(() => root.classList.remove('is-pulse'), 220)
    apply(resolve(document.elementFromPoint(e.clientX, e.clientY)))
  }

  document.addEventListener('pointerup', endPress, { passive: true })
  document.addEventListener('pointercancel', endPress, { passive: true })
  document.documentElement.addEventListener('mouseleave', (e) => {
    if (e.relatedTarget == null) softResume()
  })
  document.addEventListener('visibilitychange', () => softResume())
  window.addEventListener('pageshow', () => softResume())
  window.addEventListener('focus', () => {
    if (!document.hidden) softResume()
  })
})()
