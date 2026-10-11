// Keep the entrance available even when the 3D module or graphics startup fails.
(() => {
  const el = id => document.getElementById(id), element = el('gallery-intro');
  if (!element) return;
  const state = { mode: 'loading', stages: {}, completed: 0, canTour: false, canExplore: false, entry: null, error: null };
  const regions = [document.querySelector('header'), document.querySelector('main')];
  const progress = el('intro-progress'), status = el('intro-status'), detail = el('intro-detail');
  const enter = el('intro-enter'), explore = el('intro-explore'), retry = el('intro-retry');
  let actions = {}, slow = false;
  const write = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  progress.max = 5;
  element.focus({ preventScroll: true });
  const slowTimer = setTimeout(() => {
    if (state.mode !== 'loading') return;
    slow = true; retry.hidden = false;
    write(detail, 'This is taking a little longer. You can keep waiting or reload the gallery.');
  }, 45000);
  function update({ stages, message, download = '', canTour = false, canExplore = false, warning = '' }) {
    if (['leaving', 'entered', 'error'].includes(state.mode)) return;
    state.stages = stages;
    state.completed = Object.values(stages).filter(value => value === 'ready' || value === 'fallback').length;
    progress.value = state.completed;
    write(el('intro-progress-label'), `${state.completed} / 5 stages ready`);
    for (const step of element.querySelectorAll('[data-stage]')) step.dataset.state = stages[step.dataset.stage] ?? 'waiting';
    write(status, message);
    if (!slow) write(detail, warning || download || 'Preparing the gallery, sculptures and their light.');
    state.canTour = canTour; state.canExplore = canExplore;
    enter.disabled = !canTour; explore.disabled = !canExplore;
    if (canExplore) {
      state.mode = 'ready'; clearTimeout(slowTimer);
      element.setAttribute('aria-busy', 'false');
      retry.hidden = !warning;
      write(detail, warning || 'Take a guided walk through eight studies of light and material, or explore at your own pace.');
    }
  }
  function fail(message) {
    if (['entered', 'leaving'].includes(state.mode)) return;
    clearTimeout(slowTimer); state.mode = 'error'; state.error = message;
    state.canTour = state.canExplore = false;
    element.classList.add('has-error'); element.setAttribute('aria-busy', 'false');
    enter.disabled = explore.disabled = true; retry.disabled = false; retry.hidden = false;
    write(status, 'The gallery could not open');
    write(detail, message || 'Check your connection, then reload to try again.');
  }
  function choose(mode) {
    if (state.mode !== 'ready' || (mode === 'tour' ? !state.canTour : !state.canExplore)) return;
    state.mode = 'leaving'; state.entry = mode;
    enter.disabled = explore.disabled = retry.disabled = true;
    for (const region of regions) { region.inert = false; region.removeAttribute('aria-busy'); }
    // Keep this event synchronous with the trusted click, before Fullscreen can
    // consume user activation. Future audio.play()/AudioContext.resume() belongs here.
    if (mode === 'tour') window.dispatchEvent(new CustomEvent('gallery:enter-tour', {
      detail: { userActivated: navigator.userActivation?.isActive === true },
    }));
    try { actions.activate?.(mode, element); }
    catch (error) {
      state.mode = 'loading';
      for (const region of regions) region.inert = true;
      fail('The gallery could not start. Reload to try again.');
      console.error(error); return;
    }
    element.classList.add('is-leaving');
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600;
    setTimeout(() => {
      element.hidden = true; element.inert = true;
      document.body.classList.remove('intro-open'); state.mode = 'entered';
      actions.complete?.(mode);
    }, duration);
  }
  enter.addEventListener('click', () => choose('tour'));
  explore.addEventListener('click', () => choose('explore'));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || ['entered', 'leaving'].includes(state.mode)) return;
    const controls = [...element.querySelectorAll(
      'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]'
    )].filter(control => control.tabIndex >= 0 && !control.closest('[hidden],[inert]') &&
      control.getClientRects().length > 0 && getComputedStyle(control).visibility !== 'hidden');
    const current = document.activeElement, first = controls[0], last = controls.at(-1);
    if (!controls.length) { event.preventDefault(); element.focus(); }
    else if (current === element && !event.shiftKey && !enter.disabled && !enter.hidden) {
      event.preventDefault(); enter.focus();
    }
    else if (!controls.includes(current) || (event.shiftKey ? current === first : current === last)) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }, true);
  window.addEventListener('error', event => {
    if (event.error || event.target?.tagName === 'SCRIPT') fail('A part of the gallery could not start. Check your connection and reload.');
  }, true);
  window.addEventListener('unhandledrejection', () => fail('A part of the gallery could not load. Check your connection and reload.'));
  window.galleryIntro = { state, update, fail, bind(callbacks) { actions = callbacks; } };
})();
