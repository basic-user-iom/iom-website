/**
 * Shared mobile helpers for standalone IOM demos.
 */

export function isMobileViewport(maxWidth = 640) {
  return typeof window !== 'undefined' && window.matchMedia(`(max-width: ${maxWidth}px)`).matches
}

export function isCoarsePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

export function prefersMobileExperience() {
  return isMobileViewport() || isCoarsePointer()
}

export function mobilePixelRatio(capDesktop = 2, capMobile = 1.25) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Math.min(dpr, prefersMobileExperience() ? capMobile : capDesktop)
}

/**
 * Floating Orbit / Interact mode toggle for demos where one finger
 * both orbits and drives a pointer tool.
 */
export function createTouchModeToggle({
  modes = [
    { id: 'orbit', label: 'Orbit' },
    { id: 'interact', label: 'Interact' },
  ],
  defaultMode = 'orbit',
  onChange,
  hintEl,
  hints = {},
} = {}) {
  if (!prefersMobileExperience()) {
    return {
      mode: 'interact',
      isOrbit: () => false,
      isInteract: () => true,
      destroy() {},
    }
  }

  let mode = defaultMode
  const bar = document.createElement('div')
  bar.className = 'demo-touch-mode'
  bar.setAttribute('role', 'group')
  bar.setAttribute('aria-label', 'Touch mode')

  const buttons = new Map()
  for (const m of modes) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.mode = m.id
    btn.textContent = m.label
    btn.addEventListener('click', () => setMode(m.id))
    bar.appendChild(btn)
    buttons.set(m.id, btn)
  }

  document.body.appendChild(bar)
  document.body.classList.add('has-demo-touch-mode')

  function applyHints() {
    if (!hintEl) return
    const text = hints[mode]
    if (text) hintEl.textContent = text
  }

  function setMode(next) {
    mode = next
    for (const [id, btn] of buttons) {
      btn.classList.toggle('is-active', id === mode)
      btn.setAttribute('aria-pressed', id === mode ? 'true' : 'false')
    }
    applyHints()
    onChange?.(mode)
  }

  setMode(mode)

  return {
    get mode() {
      return mode
    },
    isOrbit: () => mode === 'orbit',
    isInteract: () => mode === 'interact' || mode === 'disturb' || mode === 'draw' || mode === 'push',
    setMode,
    destroy() {
      bar.remove()
      document.body.classList.remove('has-demo-touch-mode')
    },
  }
}

/**
 * On-screen virtual joystick for FirstPersonControls-style WASD on touch.
 * Returns { update(controls, dt), destroy }.
 */
export function createVirtualJoystick({ movementSpeedScale = 1 } = {}) {
  if (!prefersMobileExperience()) {
    return {
      active: false,
      visible: false,
      getAxes: () => ({ x: 0, y: 0, active: false }),
      applyToKeyStates() {},
      setVisible() {},
      update() {},
      destroy() {},
    }
  }

  const root = document.createElement('div')
  root.className = 'demo-joystick'
  root.innerHTML = `
    <div class="demo-joystick-base" aria-hidden="true">
      <div class="demo-joystick-knob"></div>
    </div>
    <span class="demo-joystick-label">Move</span>
  `
  document.body.appendChild(root)
  document.body.classList.add('has-demo-joystick')

  const base = root.querySelector('.demo-joystick-base')
  const knob = root.querySelector('.demo-joystick-knob')
  const vec = { x: 0, y: 0 }
  let pointerId = null
  let visible = true
  const maxRadius = 42

  function setKnob(dx, dy) {
    const len = Math.hypot(dx, dy) || 1
    const clamped = Math.min(len, maxRadius)
    const nx = (dx / len) * clamped
    const ny = (dy / len) * clamped
    vec.x = nx / maxRadius
    vec.y = ny / maxRadius
    knob.style.transform = `translate(${nx}px, ${ny}px)`
  }

  function reset() {
    vec.x = 0
    vec.y = 0
    knob.style.transform = 'translate(0px, 0px)'
    pointerId = null
  }

  function onDown(event) {
    if (pointerId !== null) return
    pointerId = event.pointerId
    base.setPointerCapture(event.pointerId)
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setKnob(event.clientX - cx, event.clientY - cy)
    event.preventDefault()
    event.stopPropagation()
  }

  function onMove(event) {
    if (event.pointerId !== pointerId) return
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    setKnob(event.clientX - cx, event.clientY - cy)
    event.preventDefault()
  }

  function onUp(event) {
    if (event.pointerId !== pointerId) return
    try {
      base.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    reset()
  }

  base.addEventListener('pointerdown', onDown)
  base.addEventListener('pointermove', onMove)
  base.addEventListener('pointerup', onUp)
  base.addEventListener('pointercancel', onUp)

  return {
    active: true,
    get visible() {
      return visible
    },
    getAxes() {
      return {
        x: vec.x,
        y: vec.y,
        active: pointerId !== null || Math.hypot(vec.x, vec.y) > 0.02,
      }
    },
    /** Map stick to keyboard-style keyStates used by custom walk controllers. */
    applyToKeyStates(keyStates, { dead = 0.18 } = {}) {
      if (!keyStates || !visible) return
      const forward = -vec.y * movementSpeedScale
      const strafe = vec.x * movementSpeedScale
      keyStates.KeyW = forward > dead
      keyStates.KeyS = forward < -dead
      keyStates.KeyA = strafe < -dead
      keyStates.KeyD = strafe > dead
    },
    setVisible(next) {
      visible = Boolean(next)
      root.style.display = visible ? '' : 'none'
      document.body.classList.toggle('has-demo-joystick', visible)
      if (!visible) reset()
    },
    /** Drive FirstPersonControls (r184+) private move flags from the stick. */
    update(controls) {
      if (!controls || !visible) return
      const dead = 0.18
      const scale = movementSpeedScale
      const forward = -vec.y * scale
      const strafe = vec.x * scale
      controls._keyForward = forward > dead
      controls._keyBackward = forward < -dead
      controls._moveLeft = strafe < -dead
      controls._moveRight = strafe > dead
      controls._pointerForward = false
      controls._pointerBackward = false
    },
    destroy() {
      base.removeEventListener('pointerdown', onDown)
      base.removeEventListener('pointermove', onMove)
      base.removeEventListener('pointerup', onUp)
      base.removeEventListener('pointercancel', onUp)
      root.remove()
      document.body.classList.remove('has-demo-joystick')
    },
  }
}
