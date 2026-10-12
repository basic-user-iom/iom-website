export type Language = 'nl' | 'en';
const nl = {
  stage1: 'De luidspreker', stage2: 'De driver', stage3: 'De frequenties',
  start: 'Beweging starten', pause: 'Beweging pauzeren',
  touchStart: 'Model draaien', touchStop: 'Draaien stoppen',
  mouseHint: 'Sleep om te draaien · scroll om te zoomen',
  touchHint: 'Veeg om te scrollen · tik op Model draaien',
  touchActive: 'Sleep om te draaien · tik op stoppen om te scrollen',
  loading: 'Het model wordt geladen…',
  error: 'De 3D-weergave is niet beschikbaar. Je kunt de drie stappen en alle uitleg blijven bekijken.',
  canvas: '3D-conceptmodel; de uitleg en bediening staan naast het model.',
  Cone: 'Conus', Basket: 'Open korf', VoiceCoil: 'Spreekspoel',
  ConeText: 'De conus beweegt met de spreekspoel mee. In dit schema blijft de buitenrand van de ophanging op zijn plaats.',
  BasketText: 'De korf ondersteunt de bewegende delen. Korf en magneet blijven stil. Deze doorsnede toont een schematisch ontwikkelprincipe.',
  VoiceCoilText: 'De spreekspoel beweegt samen met de conus langs de driveras. De koperkleur maakt dit onderdeel zichtbaar; de afmetingen zijn illustratief.'
};
const en: Record<keyof typeof nl, string> = {
  stage1: 'The loudspeaker', stage2: 'The driver', stage3: 'The frequencies',
  start: 'Start motion', pause: 'Pause motion',
  touchStart: 'Rotate model', touchStop: 'Stop rotating',
  mouseHint: 'Drag to rotate · scroll to zoom',
  touchHint: 'Swipe to scroll · tap Rotate model',
  touchActive: 'Drag to rotate · tap Stop rotating to scroll',
  loading: 'Loading the model…',
  error: 'The 3D view is unavailable. You can still explore all three steps and their explanations.',
  canvas: '3D concept model; explanations and controls are next to the model.',
  Cone: 'Cone', Basket: 'Open basket', VoiceCoil: 'Voice coil',
  ConeText: 'The cone moves with the voice coil. In this illustration, the outer edge of the suspension stays in place.',
  BasketText: 'The basket supports the moving parts. The basket and magnet remain still. This cutaway illustrates a schematic design principle.',
  VoiceCoilText: 'The voice coil moves with the cone along the driver axis. Its copper colour makes it easy to identify; the dimensions are illustrative.'
};
export type Part = 'Cone' | 'Basket' | 'VoiceCoil';
let language: Language = 'nl';
export const t = (key: keyof typeof nl) => (language === 'en' ? en : nl)[key];
export const partText = (part: Part) => t((part + 'Text') as 'ConeText' | 'BasketText' | 'VoiceCoilText');
const staticEnglish: [string, string, string?][] = [
  ['.skip', 'Skip to the explanation'],
  ['.wordmark', 'Stradivari concept demo, home', 'aria-label'],
  ['.wordmark span', 'An exploration in three steps'],
  ['.private-label', '<i></i> Concept demo <span class="private-extra">/ Private preview</span>'],
  ['.intro .eyebrow', 'Form. Motion. Frequency.'],
  ['.intro > p:last-child', 'Explore the form. Discover what moves.'],
  ['.viewer', 'Interactive 3D model', 'aria-label'],
  ['#illustrative', 'Illustrative cutaway'],
  ['#fallback img', 'Our concept render of the black Amantes S3 loudspeaker', 'alt'],
  ['#retry', 'Try again'],
  ['#hotspots', 'Parts in the model', 'aria-label'],
  ['#rotate', 'Auto-rotate'],
  ['#reset', 'Reset the camera to its initial view', 'aria-label'],
  ['#reset span', 'Reset view'],
  ['#chapters', 'Explore the model', 'aria-label'],
  ['.stage-nav', 'Three steps', 'aria-label'],
  ['[data-stage="1"]', '<span>01</span>The loudspeaker'],
  ['[data-stage="2"]', '<span>02</span>The driver'],
  ['[data-stage="3"]', '<span>03</span>The frequencies'],
  ['[data-panel="1"] .eyebrow', '01 — The loudspeaker'],
  ['[data-panel="1"] h2', 'A form worth<br>exploring.'],
  ['[data-panel="1"] > p:not([class])', 'A three-way bass-reflex loudspeaker. Explore its form and the role of each driver.'],
  ['.dimensions span:first-child', 'According to the manufacturer'],
  ['.dimensions strong', '107 × 19.5 × 35 <small>cm</small>'],
  ['.dimensions span:last-child', 'height × width × depth'],
  ['[data-panel="1"] .subtle', 'Rotate the model to explore its form from every angle.'],
  ['[data-panel="2"] .eyebrow', '02 — The driver'],
  ['[data-panel="2"] h2', 'Small movement.<br>A clear principle.'],
  ['[data-panel="2"] .tag', 'Illustrative cutaway'],
  ['[data-panel="2"] > p:not([class])', 'The voice coil moves the cone. The suspension guides the movement; the basket and magnet stay in place.'],
  ['.parts', 'Parts of the driver', 'aria-label'],
  ['[data-part="Cone"] span', 'Cone'],
  ['[data-part="Basket"] span', 'Open basket'],
  ['[data-part="VoiceCoil"] span', 'Voice coil'],
  ['#close-detail', 'Close the explanation', 'aria-label'],
  ['[data-panel="2"] > .small', 'Slowed down and schematic; not measured data'],
  ['[data-panel="3"] .eyebrow', '03 — The frequencies'],
  ['[data-panel="3"] h2', 'Three ranges.<br>Working together.'],
  ['[data-panel="3"] > p:not([class])', 'The crossover divides the signal between the drivers. This diagram shows their published frequency ranges.'],
  ['[data-panel="3"] > p.small:nth-of-type(3)', 'According to the manufacturer'],
  ['.signal-in', 'Signal'],
  ['.bands', 'Frequency ranges', 'aria-label'],
  ['[data-band="low"] > span:nth-child(2)', 'Low <small>20–180 Hz</small>'],
  ['[data-band="mid"] > span:nth-child(2)', 'Mid <small>180 Hz–3.5 kHz</small>'],
  ['[data-band="high"] > span:nth-child(2)', 'High <small>3.5–40 kHz</small>'],
  ['[data-band="low"] .band-role', '2 woofers'],
  ['[data-band="mid"] .band-role', 'Midrange'],
  ['[data-band="high"] .band-role', 'Tweeter'],
  ['[data-panel="3"] > .small:last-child', 'The ranges overlap in practice. This is a diagram, not a measurement. The buttons do not play any sound.'],
  ['#previous', '← Previous'], ['#next', 'Next →'],
  ['.disclosure', 'Concept visualisation based on public information. The driver cutaway and motion are schematic.'],
  ['.sources summary', 'Sources and assumptions <span aria-hidden="true">+</span>'],
  ['.source-grid section:nth-child(1) h3', 'Published specifications'],
  ['.source-grid section:nth-child(1) p', 'Dimensions, the three-way bass-reflex design and frequency ranges come from the <a href="https://www.stradivariaudio.nl/amantes/" target="_blank" rel="noopener noreferrer">Amantes S3 product page ↗</a>. These are manufacturer specifications, not independent measurements.'],
  ['.source-grid section:nth-child(2) h3', 'Form estimated from photographs'],
  ['.source-grid section:nth-child(2) p', 'The contour, details and driver positions are estimated from public photographs. This model is not production CAD. The images in this demo are our own renders of the reconstruction.'],
  ['.source-grid section:nth-child(3) h3', 'Schematic explanation'],
  ['.source-grid section:nth-child(3) p:first-of-type', 'The <a href="https://www.stradivariaudio.com/basket-3d/" target="_blank" rel="noopener noreferrer">3D basket ↗</a> and <a href="https://www.stradivariaudio.com/wp-content/uploads/2019/08/stradivari-basket-3d.pdf" target="_blank" rel="noopener noreferrer">basket PDF ↗</a> show a development model. The <a href="https://www.stradivariaudio.com/stradivari-cone-motion/" target="_blank" rel="noopener noreferrer">cone-motion page ↗</a> is a historical measurement example with no confirmed connection to the S3. None of these data were used to create the motion shown here.'],
  ['.source-grid section:nth-child(3) p:last-of-type', '<a href="https://www.stradivariaudio.nl/ontwerpfilter/" target="_blank" rel="noopener noreferrer">Crossover development ↗</a>, <a href="https://www.stradivariaudio.nl/woofer-design/" target="_blank" rel="noopener noreferrer">woofer design ↗</a> and <a href="https://www.stradivariaudio.nl/cone-shape/" target="_blank" rel="noopener noreferrer">cone shape ↗</a> provide general development context, not S3 production drawings. The cutaway and slow motion are illustrative only.'],
  ['.site-footer span:last-child', 'Concept study · IOM'],
  ['.language-switch', 'Language', 'aria-label']
];
// Snapshot the existing Dutch content once; translating never replaces interactive elements.
const bindings = staticEnglish.map(([selector, english, attribute]) => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error('Missing translation target: ' + selector);
  return { element, english, attribute, dutch: attribute ? element.getAttribute(attribute)! : element.innerHTML };
});
export function initialLanguage(): Language {
  const query = new URLSearchParams(location.search).get('lang');
  if (query === 'nl' || query === 'en') return query;
  try { return localStorage.getItem('stradivari-language') === 'en' ? 'en' : 'nl'; } catch { return 'nl'; }
}
export function translate(next: Language, persist = false) {
  language = next;
  document.documentElement.lang = next;
  document.title = 'Stradivari Amantes S3 — ' + (next === 'en' ? 'Concept demo' : 'Conceptdemo');
  document.querySelector('meta[name="description"]')!.setAttribute('content', next === 'en' ? 'Private concept visualisation of the Stradivari Amantes S3.' : 'Privé conceptvisualisatie van de Stradivari Amantes S3.');
  for (const b of bindings) {
    const value = next === 'en' ? b.english : b.dutch;
    if (b.attribute) b.element.setAttribute(b.attribute, value); else b.element.innerHTML = value;
  }
  document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.language === next)));
  if (persist) {
    try { localStorage.setItem('stradivari-language', next); } catch { /* Browsing without storage remains supported. */ }
    const url = new URL(location.href); url.searchParams.set('lang', next); history.replaceState(null, '', url);
  }
}

