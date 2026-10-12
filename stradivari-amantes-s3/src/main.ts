import './style.css';
import { initialLanguage, translate, t, partText, type Language, type Part } from './i18n';
import { Viewer, type Stage, type Band } from './viewer';
document.documentElement.classList.toggle('has-touch', navigator.maxTouchPoints > 0);
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];
let stage: Stage = 1, band: Band = 'low', viewer: Viewer | undefined, generation = 0;
let lastPartTrigger: HTMLElement | undefined;
let activePart: Part | undefined;
let loadState: 'loading' | 'error' | 'ready' = 'loading';
function closePart(restoreFocus = false) {
  activePart = undefined;
  $('#part-detail').hidden = true;
  all<HTMLButtonElement>('[data-part]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (restoreFocus) lastPartTrigger?.focus();
}
function showPart(part: string) {
  lastPartTrigger = document.activeElement as HTMLElement;
  activePart = part as Part;
  $('#part-title').textContent = t(activePart); $('#part-text').textContent = partText(activePart);
  $('#part-detail').hidden = false;
  all<HTMLButtonElement>('[data-part]').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.part === part)));
}
function updateMotion() {
  const playing = viewer?.playing ?? false;
  $('#motion').innerHTML = t(playing ? 'pause' : 'start') + ' <span aria-hidden="true">' + String.fromCharCode(playing ? 0x2161 : 0x25b7) + '</span>';
  $('#motion').setAttribute('aria-pressed', String(playing));
}
function setStage(next: Stage) {
  stage = next;
  all<HTMLButtonElement>('[data-stage]').forEach(b => {
    if (Number(b.dataset.stage) === stage) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
  all('[data-panel]').forEach(p => p.hidden = Number(p.dataset.panel) !== stage);
  $('#view-label').textContent = '0' + stage + ' / ' + t(('stage' + stage) as 'stage1' | 'stage2' | 'stage3');
  $('#illustrative').hidden = stage !== 2;
  $('#page-count').textContent = '0' + stage + ' / 03';
  $<HTMLButtonElement>('#previous').disabled = stage === 1; $<HTMLButtonElement>('#next').disabled = stage === 3;
  closePart();
  viewer?.setStage(stage); updateMotion();
  $('#rotate').setAttribute('aria-pressed', 'false');
  // Keep keyboard focus usable when a navigation button just became disabled.
  if (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled) $<HTMLButtonElement>('[data-stage="' + stage + '"]').focus();
}
function setBand(next: Band) {
  band = next;
  all<HTMLButtonElement>('[data-band]').forEach(b => {
    const active = b.dataset.band === band; b.setAttribute('aria-pressed', String(active));
    b.querySelector('.band-check')!.textContent = active ? '✓' : '○';
  });
  viewer?.highlight(band);
}
function availability(ready: boolean) {
  for (const id of ['motion', 'reset', 'rotate', 'touch-orbit']) $<HTMLButtonElement>('#' + id).disabled = !ready;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) $<HTMLButtonElement>('#rotate').disabled = true;
}
function fail(error: unknown) {
  viewer?.dispose(); viewer = undefined;
  availability(false); updateMotion();
  $('#fallback').hidden = false; $('#retry').hidden = false;
  loadState = 'error'; $('#load-status').textContent = t('error');
  console.info('3D fallback:', error instanceof Error ? error.message : String(error));
}
async function load() {
  const attempt = ++generation;
  viewer?.dispose(); viewer = undefined;
  availability(false);
  $('#fallback').hidden = false; $('#retry').hidden = true;
  loadState = 'loading'; $('#load-status').textContent = t('loading');
  try {
    const instance = new Viewer($('#scene'), $('#hotspots'), fail, showPart); viewer = instance;
    updateViewerLabels();
    instance.stage = stage; instance.band = band;
    await instance.load();
    if (attempt !== generation || instance.disposed) return;
    loadState = 'ready'; $('#fallback').hidden = true; availability(true);
    instance.setTouchOrbit($('#touch-orbit').getAttribute('aria-pressed') === 'true');
  } catch (error) { if (attempt === generation) fail(error); }
}
all<HTMLButtonElement>('[data-stage]').forEach(b => b.addEventListener('click', () => setStage(Number(b.dataset.stage) as Stage)));
all<HTMLButtonElement>('[data-band]').forEach(b => b.addEventListener('click', () => setBand(b.dataset.band as Band)));
all<HTMLButtonElement>('[data-part]').forEach(b => b.addEventListener('click', () => b.getAttribute('aria-expanded') === 'true' ? closePart() : showPart(b.dataset.part!)));
$('#previous').addEventListener('click', () => setStage(Math.max(1, stage - 1) as Stage));
$('#next').addEventListener('click', () => setStage(Math.min(3, stage + 1) as Stage));
$('#motion').addEventListener('click', () => { viewer?.toggleMotion(); updateMotion(); });
$('#reset').addEventListener('click', () => {
  viewer?.setStage(stage); updateMotion(); $('#rotate').setAttribute('aria-pressed', 'false');
});
$('#rotate').addEventListener('click', () => {
  const enabled = viewer?.setAutoRotate($('#rotate').getAttribute('aria-pressed') !== 'true') ?? false;
  $('#rotate').setAttribute('aria-pressed', String(enabled));
});
function toggleTouchOrbit() {
  const enabled = $('#touch-orbit').getAttribute('aria-pressed') !== 'true';
  $('#touch-orbit').setAttribute('aria-pressed', String(enabled));
  $('#touch-orbit').textContent = t(enabled ? 'touchStop' : 'touchStart');
  $('#gesture-hint').textContent = t(enabled ? 'touchActive' : 'touchHint');
  viewer?.setTouchOrbit(enabled);
}
$('#touch-orbit').addEventListener('click', toggleTouchOrbit);
// A native touch handler also works when a browser suppresses the synthetic click after a drag.
$('#touch-orbit').addEventListener('touchend', event => { event.preventDefault(); toggleTouchOrbit(); }, { passive: false });
$('#close-detail').addEventListener('click', () => closePart(true));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#part-detail').hidden) closePart(true); });
$('#retry').addEventListener('click', () => void load());
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
  availability(viewer?.ready ?? false); $('#rotate').setAttribute('aria-pressed', 'false');
});
window.addEventListener('pagehide', () => { ++generation; viewer?.dispose(); viewer = undefined; });
window.addEventListener('pageshow', event => { if (event.persisted) void load(); });
if (import.meta.env.DEV || new URLSearchParams(location.search).has('qa')) {
  Object.defineProperty(window, '__demo', { configurable: true, get: () => ({ snapshot: () => viewer?.diagnostics() ?? { ready: false, stage }, sample: (time: number) => { if (viewer?.action && viewer.mixer) { viewer.action.play(); viewer.action.paused = false; viewer.mixer.setTime(time); viewer.action.paused = true; viewer.request(); } } }) });
}
function updateViewerLabels() {
  viewer?.setLabels(t('canvas'), [t('Cone'), t('Basket'), t('VoiceCoil')]);
}
function setLanguage(language: Language, persist = false) {
  translate(language, persist);
  $('#view-label').textContent = '0' + stage + ' / ' + t(('stage' + stage) as 'stage1' | 'stage2' | 'stage3');
  const touchActive = $('#touch-orbit').getAttribute('aria-pressed') === 'true';
  $('#touch-orbit').textContent = t(touchActive ? 'touchStop' : 'touchStart');
  $('#gesture-hint').textContent = t(navigator.maxTouchPoints > 0 ? (touchActive ? 'touchActive' : 'touchHint') : 'mouseHint');
  $('#load-status').textContent = t(loadState === 'error' ? 'error' : 'loading');
  if (activePart) { $('#part-title').textContent = t(activePart); $('#part-text').textContent = partText(activePart); }
  updateMotion(); updateViewerLabels();
}
all<HTMLButtonElement>('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language as Language, true)));
setLanguage(initialLanguage());
void load();



