const phases = [
 ['Preparing the architecture', 'Loading the building and its surface textures.'],
 ['Setting the daylight', 'Preparing the sky, reflections and shadows.'],
 ['Preparing the lighting', 'Loading the architectural lighting.'],
 ['Building the streetscape', 'Loading the street and furnishings.'],
 ['Completing the neighbourhood', 'Loading the surrounding buildings.'],
 ['Adding the landscape', 'Preparing the trees, planting and leaf textures.'],
 ['Preparing the interiors', 'Loading the visible upper-floor interiors.'],
 ['Preparing your first view', 'Rendering the complete scene.'],
];

export class LoadingScreen {
 state: 'loading'|'error'|'ready' = 'loading';
 completed = 0;
 get failed() { return this.state === 'error'; }
 private elapsed = 0;
 private phaseElapsed = 0;
 private last = performance.now();
 private timer: ReturnType<typeof setInterval>;
 private screen = document.getElementById('loading-screen')!;
 private title = document.getElementById('loading-title')!;
 private detail = document.getElementById('loading-detail')!;
 private progress = document.getElementById('loading-progress') as HTMLProgressElement;
 private count = document.getElementById('loading-count')!;
 private retry = document.getElementById('loading-retry') as HTMLButtonElement;
 private visibility = () => { this.last = performance.now(); };
 constructor() {
  window.dispatchEvent(new Event('viewer-loader-attached'));
  this.retry.onclick = () => location.reload();
  document.addEventListener('visibilitychange', this.visibility);
  this.timer = setInterval(() => {
   const now = performance.now(), delta = Math.min(now-this.last, 2000); this.last = now;
   if(document.hidden || this.state !== 'loading') return;
   this.elapsed += delta; this.phaseElapsed += delta;
   if(this.phaseElapsed >= 180000 || this.elapsed >= 600000) this.fail('Loading is taking too long. Check your connection, then try again.');
   else if(this.phaseElapsed >= 25000) { this.detail.textContent = 'Still loading this stage. A slow connection or device can take longer.'; this.retry.hidden = false; }
  }, 1000);
 }
 step(index: number) {
  if(this.state !== 'loading') return;
  this.completed = index; this.phaseElapsed = 0; this.retry.hidden = true;
  [this.title.textContent, this.detail.textContent] = phases[index];
  this.progress.value = index; this.count.textContent = `${index} of ${phases.length} stages complete`;
  this.progress.setAttribute('aria-valuetext', this.count.textContent);
 }
 fail(message = 'The scene could not be loaded. Check your connection and try again.') {
  if(this.state !== 'loading') return;
  this.state = 'error'; this.dispose(); document.documentElement.dataset.loadState = 'error';
  this.title.textContent = 'Unable to load your view'; this.detail.textContent = navigator.onLine ? message : 'You appear to be offline. Reconnect, then try again.';
  this.detail.setAttribute('role', 'alert'); this.progress.hidden = true; this.retry.hidden = false;
 }
 complete() {
  if(this.state !== 'loading') return false;
  this.state = 'ready'; this.completed = phases.length; this.progress.value = phases.length; this.dispose();
  const focusInside = this.screen.contains(document.activeElement);
  const app = document.getElementById('app')!; app.inert = false; app.removeAttribute('aria-hidden'); app.removeAttribute('aria-busy');
  document.documentElement.dataset.loadState = 'ready'; this.screen.hidden = true;
  if(focusInside) document.getElementById('canvas')?.focus({preventScroll:true});
  return true;
 }
 private dispose() { clearInterval(this.timer); document.removeEventListener('visibilitychange', this.visibility); }
}
export const startup = new LoadingScreen();
Object.assign(window, {__inspectLoading: () => ({state:startup.state,completed:startup.completed,total:phases.length})});
