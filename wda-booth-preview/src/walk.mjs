// Adapted from internal IOM Gallery of Light gallery-walk.js, 2026-10-28.
// Source SHA256 12d08f25d440a53875ecc252d24849002e9ad524e46c8e931e820a22100725a5.
// No client assets are copied. WDA changes: configurable measured navigation,
// render-on-change invalidation, simplified accessible HUD and reduced motion.
import { advanceWalk, WALK_HEIGHT } from './walk-navigation.mjs';
const LOOK = .0032, PITCH_LIMIT = Math.PI * .4;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MOVEMENT = new Map([['KeyW', 'forward'], ['ArrowUp', 'forward'], ['KeyS', 'back'], ['ArrowDown', 'back'],
  ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right']]);
const interactive = target => !!target?.closest?.('button,a,input,select,textarea,[contenteditable="true"],[role="button"],dialog,iframe');
const validPoint = point => Array.isArray(point) && point.length >= 3 && point.slice(0, 3).every(Number.isFinite);

export function createGalleryWalk({ camera, controls, canvas, viewport, navigation, getEntryPose,
  onEnter, onExit, onInvalidate = () => {}, button, reducedMotion } = {}) {
  const document = viewport.ownerDocument, window = document.defaultView;
  const height = (navigation?.state?.floorY ?? 0) + (navigation?.state?.eyeHeight ?? WALK_HEIGHT);
  const motion = { position: [0, height, 0], vx: 0, vz: 0, yaw: 0, distance: 0 };
  const state = { ready: false, active: false, disposed: false, status: 'idle', eyeHeight: height,
    speed: 0, yaw: 0, pitch: 0, blocked: false, spawn: null, distance: 0,
    method: 'Visitor-height movement with swept circle collisions' };
  const held = new Set(), touchHeld = new Map(), listeners = [];
  let previous = null, drag = null, originalEnabled = controls.enabled;
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const hud = document.createElement('div'); hud.id = 'gallery-walk-controls'; hud.hidden = true;
  hud.innerHTML = '<div class="walk-instructions"><strong>Explore the booth</strong><span class="walk-desktop-help">WASD / arrows to move · Drag to look · Esc to exit</span><span class="walk-touch-help">Hold an arrow to move · Drag the view to look</span></div><button type="button" class="walk-exit">Exit walk</button>';
  const pad = document.createElement('div'); pad.id = 'gallery-walk-pad'; pad.hidden = true;
  pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', 'Walking controls');
  pad.innerHTML = '<button type="button" data-walk="forward" aria-label="Walk forward">↑</button><button type="button" data-walk="left" aria-label="Step left">←</button><button type="button" data-walk="back" aria-label="Walk backward">↓</button><button type="button" data-walk="right" aria-label="Step right">→</button>';
  viewport.append(hud, pad);
  const exitButton = hud.querySelector('.walk-exit');
  const on = (target, type, fn, options) => { target.addEventListener(type, fn, options); listeners.push(() => target.removeEventListener(type, fn, options)); };
  const wake = () => { if (!state.disposed) onInvalidate(); };
  function ready() {
    return state.ready = !state.disposed && navigation?.state?.ready !== false &&
      !!(navigation?.visitorPose && navigation?.contains && navigation?.segmentClear);
  }
  function clearMotion() {
    held.clear(); touchHeld.clear(); motion.vx = motion.vz = state.speed = 0; previous = null;
    for (const key of pad.querySelectorAll('[data-walk]')) key.classList.remove('is-held');
  }
  function cancelDrag() {
    const old = drag; drag = null;
    if (old && canvas.hasPointerCapture?.(old.id)) canvas.releasePointerCapture(old.id);
    canvas.classList.remove('is-walk-looking');
  }
  function clearInput() { clearMotion(); cancelDrag(); wake(); }
  function aim() {
    const horizontal = Math.cos(state.pitch);
    controls.target.set(camera.position.x + Math.sin(state.yaw) * horizontal * 3,
      height + Math.sin(state.pitch) * 3, camera.position.z + Math.cos(state.yaw) * horizontal * 3);
    camera.lookAt(controls.target);
  }
  function drainControls() {
    const position = camera.position.toArray(), target = controls.target.toArray(), damping = controls.enableDamping;
    controls.enableDamping = false; controls.update(); camera.position.fromArray(position);
    controls.target.fromArray(target); camera.lookAt(controls.target); controls.enableDamping = damping;
  }
  function setButton() {
    if (!button) return;
    button.setAttribute('aria-pressed', String(state.active)); button.textContent = state.active ? 'Exit walk' : 'Walk inside';
  }
  function enter({ pose } = {}) {
    if (!ready()) return false;
    if (state.active) return true;
    const requested = pose ?? { position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov };
    let safe = (!!pose || (requested.position[1] >= .8 && requested.position[1] <= 2.4)) &&
      validPoint(requested.position) && validPoint(requested.target) ? navigation.visitorPose(requested) : null;
    if (!safe) {
      const fallback = getEntryPose?.();
      if (fallback && validPoint(fallback.position) && validPoint(fallback.target)) safe = navigation.visitorPose(fallback);
    }
    if (!safe || !validPoint(safe.position) || !validPoint(safe.target)) { state.status = 'No safe walking position is available.'; return false; }
    const position = [safe.position[0], height, safe.position[2]];
    if (!navigation.contains(position)) { state.status = 'No safe walking position is available.'; return false; }
    clearInput(); drainControls(); originalEnabled = controls.enabled; controls.enabled = false;
    camera.position.fromArray(position); motion.position = [...position]; motion.distance = 0;
    const dx = safe.target[0] - position[0], dy = safe.target[1] - position[1], dz = safe.target[2] - position[2];
    motion.yaw = state.yaw = Math.atan2(dx, dz); state.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -PITCH_LIMIT, PITCH_LIMIT);
    if (Number.isFinite(safe.fov)) { camera.fov = clamp(safe.fov, 35, 80); camera.updateProjectionMatrix(); }
    state.active = true; state.blocked = false; state.spawn = [...position]; state.distance = 0; state.status = 'Walking';
    aim(); viewport.classList.add('is-walking'); hud.hidden = pad.hidden = false; setButton();
    canvas.focus({ preventScroll: true }); onEnter?.(state); wake(); return true;
  }
  function exit() {
    if (!state.active) return false;
    clearInput(); state.active = false; state.blocked = false; state.status = 'idle';
    hud.hidden = pad.hidden = true; viewport.classList.remove('is-walking');
    drainControls(); controls.enabled = originalEnabled; setButton(); onExit?.(state); wake(); return true;
  }
  function input() {
    const touch = [...touchHeld.values()];
    return { forward: Number(held.has('KeyW') || held.has('ArrowUp') || touch.includes('forward')) - Number(held.has('KeyS') || held.has('ArrowDown') || touch.includes('back')),
      right: Number(held.has('KeyD') || held.has('ArrowRight') || touch.includes('right')) - Number(held.has('KeyA') || held.has('ArrowLeft') || touch.includes('left')) };
  }
  // Returns whether another frame is needed; no scheduler or RAF is created here.
  function update(now) {
    if (!state.active || state.disposed || !Number.isFinite(now)) return false;
    if (!ready()) { exit(); return false; }
    if (document.hidden) { clearMotion(); cancelDrag(); return false; }
    const elapsed = previous === null ? 0 : Math.max(0, (now - previous) / 1000); previous = now;
    motion.position = camera.position.toArray(); motion.position[1] = height; motion.yaw = state.yaw;
    const next = advanceWalk(motion, input(), elapsed, navigation, { reducedMotion: reducedMotion ?? media?.matches ?? false });
    camera.position.fromArray(motion.position); state.speed = motion.speed; state.blocked = motion.blocked;
    state.distance = motion.distance; aim();
    if (!next.needsFrame) previous = null;
    return next.needsFrame;
  }
  on(window, 'keydown', event => {
    if (!state.active || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Escape') { event.preventDefault(); exit(); canvas.focus({ preventScroll: true }); return; }
    if (interactive(event.target) || !MOVEMENT.has(event.code)) return;
    event.preventDefault(); held.add(event.code); wake();
  }, true);
  on(window, 'keyup', event => { if (held.delete(event.code)) wake(); }, true);
  on(window, 'blur', clearInput);
  on(document, 'visibilitychange', () => { if (document.hidden) clearInput(); else wake(); });
  on(document, 'focusin', event => { if (state.active && event.target !== canvas && !pad.contains(event.target)) clearInput(); }, true);
  on(document, 'pointerdown', event => { if (state.active && event.target !== canvas && !pad.contains(event.target)) clearInput(); }, true);
  on(canvas, 'pointerdown', event => {
    if (!state.active || drag || event.button !== 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId); canvas.classList.add('is-walk-looking');
  });
  on(canvas, 'pointermove', event => {
    if (!state.active || drag?.id !== event.pointerId) return;
    state.yaw -= (event.clientX - drag.x) * LOOK;
    state.pitch = clamp(state.pitch - (event.clientY - drag.y) * LOOK, -PITCH_LIMIT, PITCH_LIMIT);
    drag.x = event.clientX; drag.y = event.clientY; aim(); event.preventDefault(); wake();
  });
  on(canvas, 'pointerup', event => { if (drag?.id === event.pointerId) cancelDrag(); });
  on(canvas, 'lostpointercapture', () => { drag = null; canvas.classList.remove('is-walk-looking'); });
  on(window, 'pointercancel', clearInput, true);
  for (const key of pad.querySelectorAll('[data-walk]')) {
    on(key, 'pointerdown', event => {
      if (!state.active || event.button !== 0) return;
      event.preventDefault(); touchHeld.set(event.pointerId, key.dataset.walk); key.classList.add('is-held');
      key.setPointerCapture?.(event.pointerId); wake();
    });
    const release = event => {
      touchHeld.delete(event.pointerId); key.classList.remove('is-held');
      if (key.hasPointerCapture?.(event.pointerId)) key.releasePointerCapture(event.pointerId);
      wake();
    };
    on(key, 'pointerup', release); on(key, 'lostpointercapture', release);
    on(key, 'keydown', event => {
      if (!state.active || !['Space', 'Enter'].includes(event.code)) return;
      event.preventDefault(); touchHeld.set(`key-${key.dataset.walk}`, key.dataset.walk); key.classList.add('is-held'); wake();
    });
    on(key, 'keyup', event => {
      if (!['Space', 'Enter'].includes(event.code)) return;
      event.preventDefault(); touchHeld.delete(`key-${key.dataset.walk}`); key.classList.remove('is-held'); wake();
    });
    on(key, 'blur', () => { touchHeld.delete(`key-${key.dataset.walk}`); key.classList.remove('is-held'); wake(); });
  }
  on(exitButton, 'click', () => { exit(); canvas.focus({ preventScroll: true }); });
  if (button) on(button, 'click', () => { if (state.active) exit(); else enter(); });
  if (media?.addEventListener) on(media, 'change', () => { clearMotion(); wake(); });
  ready(); setButton();
  function dispose() {
    if (state.disposed) return;
    exit(); clearInput(); for (const remove of listeners) remove(); hud.remove(); pad.remove();
    state.disposed = true; state.ready = false; state.status = 'disposed';
  }
  return { state, enter, exit, update, dispose, clearInput };
}
