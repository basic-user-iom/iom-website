// Visitor movement uses the same measured floor and obstacle grid as the tour.
// No pointer lock: drag on the view to look, and leave every menu accessible.
const HEIGHT = 1.70, SPEED = 2.2, RESPONSE = 10, STEP = 1 / 90;
const MAX_FRAME = .10, LOOK = .0032, PITCH_LIMIT = Math.PI * .40;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MOVEMENT = new Map([
  ['KeyW', 'forward'], ['ArrowUp', 'forward'], ['KeyS', 'back'], ['ArrowDown', 'back'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'],
]);
const interactive = target => !!target?.closest?.('button,a,input,select,textarea,[contenteditable="true"],[role="button"],[role="listbox"],[role="option"],[role="slider"],dialog,iframe');
const validPoint = point => Array.isArray(point) && point.length >= 3 && point.slice(0, 3).every(Number.isFinite);

export function createGalleryWalk({ camera, controls, canvas, viewport, navigation, getEntryPose, onEnter, onExit, button } = {}) {
  const document = viewport.ownerDocument, window = document.defaultView;
  const state = {
    ready: !!(navigation?.visitorPose && navigation?.contains && navigation?.segmentClear),
    active: false, disposed: false, status: 'idle', eyeHeight: HEIGHT,
    speed: 0, yaw: 0, pitch: 0, blocked: false, spawn: null, distance: 0,
    method: 'Visitor-height movement with swept navigation collisions',
  };
  const held = new Set(), touchHeld = new Map(), listeners = [];
  let velocityX = 0, velocityZ = 0, previous = null, drag = null;
  let originalEnabled = controls.enabled, lastLayout = 0, suspendedForPanel = false;
  const hud = document.createElement('div');
  hud.id = 'gallery-walk-controls'; hud.hidden = true; hud.dataset.preserveTour = '';
  hud.innerHTML = '<div class="walk-instructions"><strong>Walk through the gallery</strong><span class="walk-desktop-help">WASD or arrow keys · Drag to look · Esc to exit</span><span class="walk-touch-help">Hold an arrow to move · Drag the view to look</span><span class="walk-panel-help" hidden>Close the mixer to continue walking.</span></div><button type="button" class="walk-exit">Exit walk</button>';
  const pad = document.createElement('div');
  pad.id = 'gallery-walk-pad'; pad.hidden = true; pad.dataset.preserveTour = '';
  pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', 'Walking controls');
  pad.innerHTML = '<button type="button" data-walk="forward" aria-label="Walk forward">↑</button><button type="button" data-walk="left" aria-label="Step left">←</button><button type="button" data-walk="back" aria-label="Walk backward">↓</button><button type="button" data-walk="right" aria-label="Step right">→</button>';
  viewport.append(hud, pad);
  const exitButton = hud.querySelector('.walk-exit'), panelHelp = hud.querySelector('.walk-panel-help');
  const on = (target, type, fn, options) => {
    target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options));
  };
  function ready() {
    state.ready = !state.disposed && navigation?.state?.ready !== false && !!(navigation?.visitorPose && navigation?.contains && navigation?.segmentClear);
    return state.ready;
  }
  function clearMotion() {
    held.clear(); touchHeld.clear(); velocityX = velocityZ = state.speed = 0; previous = null;
    for (const key of pad.querySelectorAll('[data-walk]')) key.classList.remove('is-held');
  }
  function cancelDrag() {
    if (drag && canvas.hasPointerCapture?.(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null; canvas.classList.remove('is-walk-looking');
  }
  function clearInput() { clearMotion(); cancelDrag(); }
  function aim() {
    const horizontal = Math.cos(state.pitch), x = Math.sin(state.yaw) * horizontal, z = Math.cos(state.yaw) * horizontal;
    controls.target.set(camera.position.x + x * 3, HEIGHT + Math.sin(state.pitch) * 3, camera.position.z + z * 3);
    camera.lookAt(controls.target);
  }
  function drainControls() {
    const position = camera.position.toArray(), target = controls.target.toArray(), damping = controls.enableDamping;
    controls.enableDamping = false; controls.update();
    camera.position.fromArray(position); controls.target.fromArray(target); camera.lookAt(controls.target);
    controls.enableDamping = damping;
  }
  function setButton() {
    if (!button) return;
    button.setAttribute('aria-pressed', String(state.active));
    button.textContent = state.active ? 'Exit walk' : 'Walk through gallery';
  }
  function layout() {
    if (!state.active) return;
    const area = viewport.getBoundingClientRect(), padWidth = 148;
    // The mixer already supplies its own context. Do not cover its controls
    // with a second instruction panel in short landscape views.
    hud.hidden = viewport.classList.contains('soundtrack-mixer-open');
    hud.classList.toggle('is-compact', area.width < 600 && area.height < 480);
    let top = 12;
    for (const selector of ['#fullscreen-navigation', '#focus-label', '#viewport-fullscreen']) {
      const element = viewport.querySelector(selector);
      if (!element || element.hidden || !element.getClientRects().length) continue;
      const box = element.getBoundingClientRect();
      if (box.top < area.top + area.height * .5 && box.bottom > area.top)
        top = Math.max(top, box.bottom - area.top + 8);
    }
    hud.style.top = `${Math.ceil(top)}px`;
    let bottom = 12;
    for (const selector of ['#gallery-soundtrack', '#fullscreen-tour-controls', '#viewport-fullscreen']) {
      const element = viewport.querySelector(selector);
      if (!element || element.hidden || !element.getClientRects().length) continue;
      const box = element.getBoundingClientRect();
      if (selector === '#viewport-fullscreen' && box.top < area.top + area.height * .5) continue;
      if (box.right > area.right - padWidth - 12 && box.bottom > area.top && box.top < area.bottom)
        bottom = Math.max(bottom, area.bottom - box.top + 10);
    }
    const available = area.height - bottom - (top + hud.getBoundingClientRect().height + 8);
    suspendedForPanel = available < 102;
    pad.hidden = suspendedForPanel;
    panelHelp.hidden = !suspendedForPanel;
    panelHelp.textContent = viewport.classList.contains('soundtrack-mixer-open') ? 'Close the mixer to continue walking.' : 'Use full screen for more room to walk.';
    if (suspendedForPanel) clearInput();
    pad.style.bottom = `${Math.ceil(bottom)}px`;
  }
  function enter({ pose } = {}) {
    if (!ready()) return false;
    if (state.active) return true;
    const requested = pose ?? { position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov };
    const visitorHeight = !!pose || (requested.position[1] >= .8 && requested.position[1] <= 2.4);
    let safe = visitorHeight && validPoint(requested.position) && validPoint(requested.target) ? navigation.visitorPose(requested) : null;
    if (!safe) {
      const fallback = getEntryPose?.();
      if (fallback && validPoint(fallback.position) && validPoint(fallback.target)) safe = navigation.visitorPose(fallback);
    }
    if (!safe || !validPoint(safe.position) || !validPoint(safe.target)) { state.status = 'No safe walking position is available.'; return false; }
    const position = [safe.position[0], HEIGHT, safe.position[2]];
    if (!navigation.contains(position)) { state.status = 'No safe walking position is available.'; return false; }
    clearInput(); drainControls(); originalEnabled = controls.enabled; controls.enabled = false;
    camera.position.fromArray(position);
    const dx = safe.target[0] - position[0], dy = safe.target[1] - position[1], dz = safe.target[2] - position[2];
    state.yaw = Math.atan2(dx, dz); state.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -PITCH_LIMIT, PITCH_LIMIT);
    if (Number.isFinite(safe.fov)) { camera.fov = clamp(safe.fov, 35, 80); camera.updateProjectionMatrix(); }
    state.active = true; state.blocked = false; state.spawn = [...position]; state.distance = 0; state.status = 'Walking';
    aim(); viewport.classList.add('is-walking'); hud.hidden = false; pad.hidden = false; setButton(); layout();
    canvas.focus({ preventScroll: true }); onEnter?.(state);
    return true;
  }
  function exit() {
    if (!state.active) return false;
    clearInput(); state.active = false; state.blocked = false; state.status = 'idle';
    hud.hidden = pad.hidden = true; viewport.classList.remove('is-walking');
    drainControls(); controls.enabled = originalEnabled; setButton(); onExit?.(state);
    return true;
  }
  function canMove(from, to) { return navigation.contains(to) && navigation.segmentClear(from, to); }
  function step(dt) {
    let forward = Number(held.has('KeyW') || held.has('ArrowUp') || [...touchHeld.values()].includes('forward')) - Number(held.has('KeyS') || held.has('ArrowDown') || [...touchHeld.values()].includes('back'));
    let right = Number(held.has('KeyD') || held.has('ArrowRight') || [...touchHeld.values()].includes('right')) - Number(held.has('KeyA') || held.has('ArrowLeft') || [...touchHeld.values()].includes('left'));
    const length = Math.hypot(forward, right); if (length > 1) { forward /= length; right /= length; }
    const sx = Math.sin(state.yaw), cz = Math.cos(state.yaw), gain = 1 - Math.exp(-RESPONSE * dt);
    velocityX += ((forward * sx - right * cz) * SPEED - velocityX) * gain;
    velocityZ += ((forward * cz + right * sx) * SPEED - velocityZ) * gain;
    if (Math.abs(velocityX) < .0001) velocityX = 0;
    if (Math.abs(velocityZ) < .0001) velocityZ = 0;
    const from = [camera.position.x, HEIGHT, camera.position.z], dx = velocityX * dt, dz = velocityZ * dt;
    const to = [from[0] + dx, HEIGHT, from[2] + dz];
    if (canMove(from, to)) camera.position.fromArray(to);
    else {
      state.blocked = true;
      // Each slide is swept from the last accepted point; a blocked diagonal
      // never jumps across a corner, sculpture base, or a thin partition.
      const axes = Math.abs(dx) >= Math.abs(dz) ? ['x', 'z'] : ['z', 'x'];
      for (const axis of axes) {
        const a = [camera.position.x, HEIGHT, camera.position.z];
        const b = [...a]; b[axis === 'x' ? 0 : 2] += axis === 'x' ? dx : dz;
        if (canMove(a, b)) camera.position.fromArray(b);
        else if (axis === 'x') velocityX = 0;
        else velocityZ = 0;
      }
    }
    state.distance += Math.hypot(camera.position.x - from[0], camera.position.z - from[2]);
    state.speed = Math.hypot(velocityX, velocityZ);
  }
  function update(now) {
    if (!state.active || state.disposed || !Number.isFinite(now)) return;
    if (!ready()) { exit(); return; }
    if (document.hidden) { clearInput(); return; }
    if (now - lastLayout > 250) { layout(); lastLayout = now; }
    const elapsed = previous === null ? 0 : Math.max(0, (now - previous) / 1000); previous = now;
    // No catch-up teleport after tab switches, stalls, or a paused render loop.
    const dt = Math.min(MAX_FRAME, elapsed);
    state.blocked = false;
    if (!suspendedForPanel && dt > 0) {
      const steps = Math.ceil(dt / STEP);
      for (let i = 0; i < steps; i++) step(dt / steps);
    }
    camera.position.y = HEIGHT; aim();
  }
  function keydown(event) {
    if (!state.active || event.defaultPrevented || event.isComposing || interactive(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Escape') { event.preventDefault(); exit(); canvas.focus({ preventScroll: true }); return; }
    if (!MOVEMENT.has(event.code)) return;
    event.preventDefault(); held.add(event.code);
  }
  on(window, 'keydown', keydown, true);
  on(window, 'keyup', event => { held.delete(event.code); }, true);
  on(window, 'blur', clearInput);
  on(document, 'visibilitychange', () => { if (document.hidden) clearInput(); });
  on(document, 'focusin', event => { if (state.active && event.target !== canvas) clearInput(); }, true);
  on(document, 'pointerdown', event => {
    if (state.active && event.target !== canvas && !pad.contains(event.target)) clearInput();
  }, true);
  on(canvas, 'pointerdown', event => {
    if (!state.active || drag || event.button !== 0 || suspendedForPanel) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId); canvas.classList.add('is-walk-looking');
  });
  on(canvas, 'pointermove', event => {
    if (!state.active || drag?.id !== event.pointerId) return;
    state.yaw -= (event.clientX - drag.x) * LOOK;
    state.pitch = clamp(state.pitch - (event.clientY - drag.y) * LOOK, -PITCH_LIMIT, PITCH_LIMIT);
    drag.x = event.clientX; drag.y = event.clientY; aim(); event.preventDefault();
  });
  on(canvas, 'pointerup', event => { if (drag?.id === event.pointerId) cancelDrag(); });
  on(canvas, 'lostpointercapture', () => { drag = null; canvas.classList.remove('is-walk-looking'); });
  on(window, 'pointercancel', clearInput, true);
  for (const key of pad.querySelectorAll('[data-walk]')) {
    on(key, 'pointerdown', event => {
      if (!state.active || suspendedForPanel || event.button !== 0) return;
      event.preventDefault(); touchHeld.set(event.pointerId, key.dataset.walk); key.classList.add('is-held');
      key.setPointerCapture?.(event.pointerId);
    });
    const release = event => {
      touchHeld.delete(event.pointerId); key.classList.remove('is-held');
      if (key.hasPointerCapture?.(event.pointerId)) key.releasePointerCapture(event.pointerId);
    };
    on(key, 'pointerup', release); on(key, 'lostpointercapture', release);
    // Keyboard activation on a focused D-pad button remains usable without
    // stealing arrow keys from the gallery's ordinary controls.
    on(key, 'keydown', event => {
      if (!state.active || !['Space','Enter'].includes(event.code)) return;
      event.preventDefault(); touchHeld.set(`key-${key.dataset.walk}`, key.dataset.walk); key.classList.add('is-held');
    });
    on(key, 'keyup', event => {
      if (!['Space','Enter'].includes(event.code)) return;
      event.preventDefault(); touchHeld.delete(`key-${key.dataset.walk}`); key.classList.remove('is-held');
    });
  }
  on(exitButton, 'click', () => { exit(); canvas.focus({ preventScroll: true }); });
  if (button) on(button, 'click', () => { if (state.active) exit(); else enter(); });
  on(window, 'resize', layout);
  setButton();
  function dispose() {
    if (state.disposed) return;
    exit(); clearInput(); for (const remove of listeners) remove();
    hud.remove(); pad.remove(); state.disposed = true; state.ready = false; state.status = 'disposed';
  }
  return { state, enter, exit, update, dispose };
}
