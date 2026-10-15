/** Fullscreen only the 3D viewport; native API first, in-page expansion fallback. */
export function createViewportFullscreen({ viewport, button, onSkipTour }) {
  if (!viewport || !button) throw new Error('Fullscreen control requires its viewport and button.');
  const state = { active: false, mode: 'inline', pending: false, disposed: false };
  const text = button.querySelector('[data-fullscreen-label]');
  const help = viewport.querySelector('#fullscreen-help');
  const announcement = viewport.querySelector('#fullscreen-status');
  const tourControls = viewport.querySelector('#fullscreen-tour-controls');
  const tourTitle = viewport.querySelector('#fullscreen-tour-title');
  const tourToggle = viewport.querySelector('#fullscreen-tour-toggle');
  const tourDuration = viewport.querySelector('#fullscreen-tour-duration');
  const tourDescription = viewport.querySelector('#fullscreen-tour-description');
  const tourProgress = viewport.querySelector('#fullscreen-tour-progress');
  const tourRestart = viewport.querySelector('#fullscreen-tour-restart');
  const tourRepeat = viewport.querySelector('#fullscreen-tour-repeat');
  const tourSkip = viewport.querySelector('#fullscreen-tour-skip');
  let currentTour = null;
  let previousOverflow = null;
  let previousFocus = null;
  let focusSession = false;
  const inertSiblings = new Map();

  function visibleControl(element) {
    return element instanceof HTMLElement && element.isConnected && !element.disabled &&
      !element.closest('[inert],[hidden]') && element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden';
  }

  function focusableControls() {
    return [...viewport.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
      .filter(element => element.tabIndex >= 0 && visibleControl(element));
  }

  function beginFocusSession() {
    if (focusSession) return;
    focusSession = true;
    previousFocus = document.activeElement;
    // In-page fullscreen is modal too: outside controls must not remain reachable.
    for (let branch = viewport; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
        inertSiblings.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      if (branch.parentElement === document.body) break;
    }
    if (!viewport.contains(document.activeElement)) button.focus({ preventScroll: true });
  }

  function endFocusSession() {
    if (!focusSession) return;
    focusSession = false;
    for (const [element, wasInert] of inertSiblings) element.inert = wasInert;
    inertSiblings.clear();
    const destination = visibleControl(previousFocus) && previousFocus !== document.body
      ? previousFocus : button;
    previousFocus = null;
    destination.focus({ preventScroll: true });
  }
  button.dataset.preserveTour = '';

  function sync() {
    const native = document.fullscreenElement === viewport;
    const expanded = viewport.classList.contains('is-expanded');
    state.active = native || expanded;
    state.mode = native ? 'native' : expanded ? 'expanded' : 'inline';
    button.setAttribute('aria-pressed', String(state.active));
    button.setAttribute('aria-label', state.active ? 'Exit full screen' : 'Enter full screen');
    button.title = state.active ? 'Exit full screen (Escape)' : 'View gallery in full screen';
    if (text) text.textContent = state.active ? 'Exit full screen' : 'Full screen';
    if (help) help.hidden = !state.active;
    if (announcement) announcement.textContent = state.active
      ? 'Full-screen gallery. Press Escape to return.' : '';
    update(currentTour);
    if (state.active) {
      // Move navigation into the viewport before outside branches become inert.
      viewport.dispatchEvent(new CustomEvent('gallery:fullscreenchange', { detail: { active: true, mode: state.mode } }));
      beginFocusSession();
    } else {
      // Clear outside inertness before restoring the original toolbar controls.
      endFocusSession();
      viewport.dispatchEvent(new CustomEvent('gallery:fullscreenchange', { detail: { active: false, mode: state.mode } }));
    }
  }

  function expand() {
    if (previousOverflow === null) previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    viewport.classList.add('is-expanded');
    sync();
  }

  function collapse() {
    viewport.classList.remove('is-expanded');
    if (previousOverflow !== null) document.body.style.overflow = previousOverflow;
    previousOverflow = null;
    sync();
  }

  async function enter({ automatic = false } = {}) {
    if (state.disposed || state.pending || state.active) return false;
    state.pending = true;
    try {
      if (automatic && !navigator.userActivation?.isActive) {
        expand();
      } else if (typeof viewport.requestFullscreen === 'function' && document.fullscreenEnabled !== false) {
        try { await viewport.requestFullscreen(); }
        catch { if (!state.disposed) expand(); }
      } else expand();
      if (!state.disposed) sync();
      return state.active;
    } finally { state.pending = false; }
  }

  async function exit() {
    if (state.disposed || state.pending) return false;
    state.pending = true;
    try {
      if (document.fullscreenElement === viewport && document.exitFullscreen) {
        try { await document.exitFullscreen(); }
        catch { /* Preserve the actual native state; Escape remains available. */ }
      }
      collapse();
      return !state.active;
    } finally { state.pending = false; }
  }

  function toggle() { return state.active ? exit() : enter(); }
  function capture() { return { active: state.active, mode: state.mode }; }
  async function restore(snapshot) {
    if (!snapshot || typeof snapshot.active !== 'boolean') throw new Error('Invalid fullscreen snapshot.');
    if (!snapshot.active) return exit();
    if (state.active) return true;
    if (snapshot.mode === 'expanded') { expand(); return true; }
    return enter({ automatic: true });
  }
  const mobileMore = document.createElement('button');
  mobileMore.id='mobile-tour-more';mobileMore.type='button';mobileMore.textContent='More';
  mobileMore.setAttribute('aria-expanded','false');mobileMore.setAttribute('aria-controls','fullscreen-tour-description fullscreen-tour-restart fullscreen-navigation');
  tourControls?.querySelector('.fullscreen-tour-actions')?.append(mobileMore);
  mobileMore.addEventListener('click',()=>{
    const open=viewport.classList.toggle('mobile-tour-details-open');
    mobileMore.setAttribute('aria-expanded',String(open));mobileMore.textContent=open?'Less':'More';
  });
  function update(tour) {
    if (state.disposed) return;
    currentTour = tour ?? null;
    if (!tourControls || !tourTitle || !tourToggle) return;
    const available = Boolean(currentTour?.state.ready);
    const hidden = !state.active || !currentTour || viewport.classList.contains('is-walking');
    if (tourControls.hidden !== hidden) tourControls.hidden = hidden;
    const mode = currentTour?.state.mode;
    const mobileTour = state.active && !viewport.classList.contains('is-walking') && (mode === 'playing' || mode === 'paused') && currentTour?.state.reason !== 'skipped';
    if(viewport.classList.contains('mobile-tour-active')!==mobileTour)viewport.classList.toggle('mobile-tour-active', mobileTour);
    const tourState = currentTour?.state;
    const title = tourState?.index >= 0
      ? `${tourState.index + 1} / ${tourState.totalStops} · ${tourState.title}`
      : tourState?.reason === 'skipped' ? 'Explore at your own pace' : 'Welcome to the gallery';
    if (tourTitle.textContent !== title) tourTitle.textContent = title;
    const seconds = Math.ceil((tourState?.totalDuration ?? 0) / 10) * 10;
    const duration = `GUIDED WALK · ABOUT ${Math.floor(seconds / 60)} MIN ${seconds % 60} SEC`;
    if (tourDuration && tourDuration.textContent !== duration) tourDuration.textContent = duration;
    const description = tourState?.description ?? 'Preparing your guided walk.';
    if (tourDescription && tourDescription.textContent !== description) tourDescription.textContent = description;
    if (tourProgress) {
      tourProgress.max = Math.max(1, tourState?.totalDuration ?? 1);
      tourProgress.value = Math.max(0, tourState?.elapsed ?? 0);
    }
    if (tourRestart) tourRestart.disabled = !available;
    if (tourSkip) tourSkip.disabled = !available;
    if (tourRepeat) {
      tourRepeat.disabled = !available;
      tourRepeat.checked = Boolean(tourState?.repeat);
    }
    const label = mode === 'playing' ? 'Pause tour' : mode === 'complete' ? 'Replay tour' : mode === 'paused' && currentTour.state.index >= 0 ? 'Resume tour' : 'Play tour';
    if (tourToggle.textContent !== label) tourToggle.textContent = label;
    if (tourToggle.disabled !== !available) tourToggle.disabled = !available;
    const pressed = String(mode === 'playing');
    if (tourToggle.getAttribute('aria-pressed') !== pressed) tourToggle.setAttribute('aria-pressed', pressed);
  }
  function toggleTour() {
    if (!currentTour?.state.ready) return;
    if (currentTour.state.mode === 'playing') currentTour.pause();
    else currentTour.play();
    update(currentTour);
  }
  function restartTour() {
    if (!currentTour?.state.ready) return;
    currentTour.restart(); update(currentTour);
  }
  function repeatTour(event) {
    if (!currentTour?.state.ready) return;
    currentTour.setRepeat(event.target.checked); update(currentTour);
  }
  function skipTour() {
    if (!currentTour?.state.ready) return;
    if (typeof onSkipTour === 'function') onSkipTour();
    else currentTour.skipToEntry?.();
    update(currentTour);
  }
  function click(event) { event.preventDefault(); void toggle(); }
  function escape(event) {
    if (event.defaultPrevented) return;
    // Let a native modal own its focus loop and Escape dismissal.
    if (viewport.querySelector('dialog[open]')) return;
    if (state.active && (event.key === 'Escape' || event.key === 'Tab')) {
      const navigationEvent = new CustomEvent('gallery:fullscreen-keydown', {
        cancelable: true, detail: { key: event.key, shiftKey: event.shiftKey },
      });
      if (!viewport.dispatchEvent(navigationEvent)) {
        event.preventDefault(); event.stopPropagation();
        return;
      }
    }
    if (event.key === 'Tab' && state.active) {
      const controls = focusableControls();
      const first = controls[0], last = controls.at(-1);
      const active = document.activeElement;
      const destination = !controls.includes(active) ? (event.shiftKey ? last : first)
        : event.shiftKey && active === first ? last : !event.shiftKey && active === last ? first : null;
      if (destination) {
        event.preventDefault();
        destination.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key !== 'Escape' || !state.active) return;
    // Keep this view-only gesture out of the tour's manual-navigation handler.
    event.stopPropagation();
    event.preventDefault();
    void exit();
  }
  function change() { sync(); }
  button.addEventListener('click', click);
  tourToggle?.addEventListener('click', toggleTour);
  tourRestart?.addEventListener('click', restartTour);
  tourRepeat?.addEventListener('change', repeatTour);
  tourSkip?.addEventListener('click', skipTour);
  document.addEventListener('fullscreenchange', change);
  document.addEventListener('keydown', escape, true);
  sync();

  function dispose() {
    if (state.disposed) return;
    if (document.fullscreenElement === viewport) void document.exitFullscreen?.().catch(() => {});
    collapse();
    endFocusSession();
    button.removeEventListener('click', click);
    tourToggle?.removeEventListener('click', toggleTour);
    tourRestart?.removeEventListener('click', restartTour);
    tourRepeat?.removeEventListener('change', repeatTour);
    tourSkip?.removeEventListener('click', skipTour);
    document.removeEventListener('fullscreenchange', change);
    document.removeEventListener('keydown', escape, true);
    state.disposed = true;
  }
  return { state, enter, exit, toggle, capture, restore, update, dispose };
}
