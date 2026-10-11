import { createStemPlayer } from './audio-engine.js';
import { GALLERY_SOUNDTRACK } from './audio-tracks.js';

const formatTime = value => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Independent soundtrack controls. Music gestures leave the gallery walk running. */
export function initializeSoundtrack({ viewport }) {
  if (!viewport) throw new Error('The soundtrack needs a gallery viewport.');
  const panel = document.createElement('section');
  panel.id = 'gallery-soundtrack';
  panel.className = 'gallery-soundtrack';
  panel.dataset.preserveTour = '';
  panel.setAttribute('aria-label', 'Gallery soundtrack');
  panel.innerHTML = `
    <div class="soundtrack-toolbar">
      <button id="soundtrack-play" type="button" aria-pressed="false">Play music</button>
      <button id="soundtrack-mute" type="button" aria-label="Mute music" aria-pressed="false">Mute</button>
      <button id="soundtrack-mixer" type="button" aria-expanded="false" aria-controls="soundtrack-mixer-body">Mixer</button>
    </div>
    <div id="soundtrack-mixer-body" class="soundtrack-mixer-body" hidden>
      <div class="soundtrack-heading"><h3>Gallery soundtrack</h3><p>Shape the music as you explore.</p></div>
      <p id="soundtrack-status" role="status" aria-live="polite">Music starts when you choose Enter tour or Play music.</p>
      <label class="soundtrack-range" for="soundtrack-volume"><span>Master volume <output id="soundtrack-volume-value" aria-hidden="true">35%</output></span><input id="soundtrack-volume" type="range" min="0" max="1" step="0.01" value="0.35" aria-label="Master volume"></label>
      <label class="soundtrack-range soundtrack-seek" for="soundtrack-position"><span>Track position <output id="soundtrack-time" aria-hidden="true">0:00 / 3:33</output></span><input id="soundtrack-position" type="range" min="0" max="213.624" step="0.1" value="0" aria-label="Track position" aria-valuetext="0:00 of 3:33"></label>
      <label class="soundtrack-loop"><input id="soundtrack-loop" type="checkbox" checked> Loop soundtrack</label>
      <fieldset class="soundtrack-stems"><legend>Instrument layers</legend><div id="soundtrack-stems"></div></fieldset>
      <button id="soundtrack-reset" type="button">Reset mix</button>
    </div>`;
  viewport.append(panel);
  viewport.classList.add('has-soundtrack');
  const el = id => panel.querySelector('#' + id);
  const body = el('soundtrack-mixer-body');
  const stemControls = new Map();
  const events = [];
  let player, latestState, scrubbing = false, disposed = false;
  const listen = (target, type, callback) => {
    target.addEventListener(type, callback);
    events.push(() => target.removeEventListener(type, callback));
  };
  const setText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  const setValue = (element, value) => { if (element.value !== String(value)) element.value = String(value); };

  for (const track of GALLERY_SOUNDTRACK.stems) {
    const row = document.createElement('div');
    row.className = 'soundtrack-stem';
    const name = document.createElement('div');
    name.className = 'soundtrack-stem-name';
    const label = document.createElement('label');
    label.htmlFor = 'soundtrack-gain-' + track.id;
    label.textContent = track.label;
    name.append(label);
    if (track.occasional || ['guitar', 'brass'].includes(track.id.toLowerCase())) {
      const note = document.createElement('span');
      note.className = 'soundtrack-layer-note';
      note.textContent = 'Occasional layer';
      name.append(note);
    }
    const mute = document.createElement('button'), solo = document.createElement('button');
    for (const [button, title] of [[mute, 'Mute'], [solo, 'Solo']]) {
      button.type = 'button';
      button.textContent = title;
      button.setAttribute('aria-label', `${title} ${track.label}`);
      button.setAttribute('aria-pressed', 'false');
    }
    const gainRow = document.createElement('div');
    gainRow.className = 'soundtrack-gain-row';
    const gain = document.createElement('input'), output = document.createElement('output');
    gain.id = 'soundtrack-gain-' + track.id;
    gain.type = 'range'; gain.min = '0'; gain.max = '1'; gain.step = '0.01'; gain.value = '1';
    gain.setAttribute('aria-label', `${track.label} level`);
    output.setAttribute('aria-hidden', 'true'); output.textContent = '100%';
    gainRow.append(gain, output);
    row.append(name, mute, solo, gainRow);
    el('soundtrack-stems').append(row);
    stemControls.set(track.id, { mute, solo, gain, output, row });
    listen(gain, 'input', () => player.setStemGain(track.id, Number(gain.value)));
    listen(mute, 'click', () => player.setStemMuted(track.id, mute.getAttribute('aria-pressed') !== 'true'));
    listen(solo, 'click', () => player.setStemSolo(track.id, solo.getAttribute('aria-pressed') !== 'true'));
  }

  function render(state) {
    if (disposed || !state) return;
    latestState = state;
    const running = ['playing', 'loading', 'buffering'].includes(state.status);
    setText(el('soundtrack-play'), running ? 'Pause music' : 'Play music');
    el('soundtrack-play').setAttribute('aria-pressed', String(running));
    el('soundtrack-mute').setAttribute('aria-pressed', String(state.muted));
    el('soundtrack-mute').setAttribute('aria-label', state.muted ? 'Unmute music' : 'Mute music');
    setText(el('soundtrack-mute'), state.muted ? 'Unmute' : 'Mute');
    setValue(el('soundtrack-volume'), state.volume);
    setText(el('soundtrack-volume-value'), `${Math.round(state.volume * 100)}%`);
    el('soundtrack-loop').checked = Boolean(state.loop);
    const duration = state.duration || GALLERY_SOUNDTRACK.duration;
    el('soundtrack-position').max = String(duration);
    if (!scrubbing) {
      const position = state.currentTime ?? state.position ?? 0;
      setValue(el('soundtrack-position'), position);
      setText(el('soundtrack-time'), `${formatTime(position)} / ${formatTime(duration)}`);
      el('soundtrack-position').setAttribute('aria-valuetext', `${formatTime(position)} of ${formatTime(duration)}`);
    }
    const messages = {
      idle: 'Music starts when you choose Enter tour or Play music.',
      loading: 'Preparing the soundtrack…',
      buffering: 'Waiting for the music to load…',
      playing: state.muted ? 'Playing · sound muted' : 'Playing · six instrument layers',
      paused: ['page-hidden', 'hidden'].includes(state.pauseReason) ? 'Music paused while you were away. Press Play music to continue.' : 'Music paused. Press Play music to continue.',
      blocked: 'Tap Play music to enable audio.',
      error: 'The soundtrack could not load. Tap Play music to try again.',
      ended: 'The soundtrack has ended. Press Play music to listen again.',
    };
    setText(el('soundtrack-status'), messages[state.status] ?? 'Music is ready.');
    panel.dataset.status = state.status;
    for (const stem of state.stems) {
      const controls = stemControls.get(stem.id);
      if (!controls) continue;
      setValue(controls.gain, stem.gain);
      setText(controls.output, `${Math.round(stem.gain * 100)}%`);
      controls.mute.setAttribute('aria-pressed', String(stem.muted));
      controls.mute.setAttribute('aria-label', `${stem.muted ? 'Unmute' : 'Mute'} ${stem.label}`);
      controls.solo.setAttribute('aria-pressed', String(stem.solo));
      controls.row.dataset.muted = String(stem.muted);
    }
  }

  player = createStemPlayer({ ...GALLERY_SOUNDTRACK, onChange: render });
  render(player.state);
  listen(el('soundtrack-play'), 'click', () => {
    if (['playing', 'loading', 'buffering'].includes(latestState?.status)) player.pause();
    else void player.play();
  });
  listen(el('soundtrack-mute'), 'click', () => player.setMuted(!latestState?.muted));
  listen(el('soundtrack-volume'), 'input', () => player.setVolume(Number(el('soundtrack-volume').value)));
  listen(el('soundtrack-loop'), 'change', () => player.setLoop(el('soundtrack-loop').checked));
  listen(el('soundtrack-reset'), 'click', () => player.resetMix());
  listen(el('soundtrack-position'), 'input', () => {
    scrubbing = true;
    setText(el('soundtrack-time'), `${formatTime(el('soundtrack-position').value)} / ${formatTime(latestState.duration)}`);
  });
  listen(el('soundtrack-position'), 'change', () => {
    const position = Number(el('soundtrack-position').value);
    scrubbing = false;
    void player.seek(position);
  });
  listen(el('soundtrack-position'), 'blur', () => { scrubbing = false; render(latestState); });
  listen(el('soundtrack-mixer'), 'click', () => {
    body.hidden = !body.hidden;
    panel.classList.toggle('mixer-open', !body.hidden);
    viewport.classList.toggle('soundtrack-mixer-open', !body.hidden);
    el('soundtrack-mixer').setAttribute('aria-expanded', String(!body.hidden));
    setText(el('soundtrack-mixer'), body.hidden ? 'Mixer' : 'Close mixer');
    updateLayout();
  });
  // Called synchronously by the intro's trusted click event. No await precedes
  // play(), so the audio context and streams can unlock on mobile browsers.
  listen(window, 'gallery:enter-tour', () => { void player.play(); });

  function updateLayout() {
    const bounds = viewport.getBoundingClientRect();
    const expanded = document.fullscreenElement === viewport || viewport.classList.contains('is-expanded');
    const tour = document.getElementById('fullscreen-tour-controls');
    const tourBounds = tour && !tour.hidden ? tour.getBoundingClientRect() : null;
    let topClearance = 12, bottomClearance = 14;
    if (expanded) {
      for (const id of ['viewport-fullscreen', 'focus-label', 'fullscreen-navigation']) {
        const element = document.getElementById(id);
        const rect = element?.getBoundingClientRect();
        if (rect?.height) topClearance = Math.max(topClearance, rect.bottom - bounds.top + 10);
      }
      if (tourBounds?.height && tourBounds.width) {
        bottomClearance = Math.max(14, bounds.bottom - tourBounds.top + 10);
        panel.style.setProperty('--soundtrack-tour-left', `${tourBounds.left - bounds.left - viewport.clientLeft}px`);
        panel.style.setProperty('--soundtrack-tour-width', `${tourBounds.width}px`);
      } else {
        panel.style.removeProperty('--soundtrack-tour-left');
        panel.style.removeProperty('--soundtrack-tour-width');
      }
    }
    const walkControls = document.getElementById('gallery-walk-controls');
    if (walkControls && !walkControls.hidden) {
      const rect = walkControls.getBoundingClientRect();
      if (rect.height) topClearance = Math.max(topClearance, rect.bottom - bounds.top + 10);
    }
    for (const id of ['fullscreen-navigation', 'gallery-walk-controls']) {
      const element = document.getElementById(id);
      if (element && !observed.has(element)) { observed.add(element); resize.observe(element); }
    }
    panel.style.setProperty('--soundtrack-top-clearance', `${topClearance}px`);
    panel.style.setProperty('--soundtrack-bottom-clearance', `${bottomClearance}px`);
  }
  const observed = new WeakSet(), resize = new ResizeObserver(updateLayout);
  resize.observe(viewport);
  const tourPanel = document.getElementById('fullscreen-tour-controls');
  if (tourPanel) resize.observe(tourPanel);
  listen(document, 'fullscreenchange', updateLayout);
  listen(viewport, 'gallery:fullscreenchange', updateLayout);
  const layoutState = new MutationObserver(updateLayout);
  layoutState.observe(viewport, { attributes: true, attributeFilter: ['class'] });
  updateLayout();

  return {
    player, element: panel,
    dispose() {
      if (disposed) return;
      disposed = true;
      events.forEach(remove => remove());
      resize.disconnect(); layoutState.disconnect(); player.dispose(); panel.remove();
      viewport.classList.remove('has-soundtrack', 'soundtrack-mixer-open');
    },
  };
}
