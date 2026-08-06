/**
 * Message in a Bottle — Open Sea
 * WebGPU only (three r181.2, TSL node materials, no WebGL fallback).
 *
 * Structure
 *   1.  Imports
 *   2.  Constants, palettes, wave spectrum
 *   3.  Small utilities (DOM, math, springs, base64url)
 *   4.  Message model: schema, validation, encode/decode, encryption
 *   5.  DOM references
 *   6.  Parchment rendering (typography / paper / ink)
 *   7.  Composer
 *   8.  Ambient audio (procedural, gesture gated)
 *   9.  Scene state + uniforms
 *   10. TSL: sky
 *   11. TSL: ocean (Gerstner + domain-warped FBM chop/capillary)
 *   12. Ocean + sky meshes
 *   13. Bottle (lathe glass, cork, parchment, cord, seal)
 *   13b. Sea life (fish near bottle, distant whale)
 *   14. CPU ocean sampling + buoyancy
 *   15. Interaction: raycast, activator, open/close
 *   16. Controls panel
 *   17. Frame loop
 *   18. Boot
 */

/* ============================================================================
 * 1. Imports
 * ========================================================================== */

import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, Break, float, vec2, vec3, vec4, uniform, texture, texture3D,
  mx_noise_float,
  positionLocal, positionWorld, cameraPosition, normalWorld, frontFacing,
  normalize, dot, reflect, pow, pow2, saturate, mix, step, sqrt,
  length, cross, exp, min, max, abs, sin, cos, atan, smoothstep, oneMinus,
  pass
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { RaymarchingBox } from 'three/addons/tsl/utils/Raymarching.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ============================================================================
 * 2. Constants, palettes, wave spectrum
 * ========================================================================== */

const SCHEMA_VERSION = 1;
const PBKDF2_ITERATIONS = 210000;
const DEG = Math.PI / 180;
const GRAVITY = 9.81;

const LIMITS = {
  recipient: 80,
  sender: 80,
  title: 120,
  message: 2000,
  signature: 300,
  date: 40,
  postscript: 300,
  secretLine: 300
};

const FONT_STACKS = {
  handwritten: '"Segoe Script", "Bradley Hand", "Brush Script MT", "Comic Sans MS", cursive',
  calligraphic: '"Edwardian Script ITC", "Apple Chancery", "Lucida Calligraphy", "Segoe Script", cursive',
  oldstyle: '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", Georgia, serif',
  classical: '"Trajan Pro", Optima, "Times New Roman", Times, serif',
  typewriter: '"Courier New", Courier, "Nimbus Mono PS", monospace',
  elegant: 'Didot, "Cormorant Garamond", Baskerville, "Hoefler Text", "Times New Roman", serif',
  modern: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif'
};

const FONT_LABELS = {
  handwritten: 'Handwritten',
  calligraphic: 'Calligraphic',
  oldstyle: 'Old style serif',
  classical: 'Classical',
  typewriter: 'Typewriter',
  elegant: 'Elegant didone',
  modern: 'Modern sans'
};

const PAPER_COLOURS = {
  ivory: { top: '#f4ead2', mid: '#ebe0c4', low: '#e0d0aa' },
  beige: { top: '#efe6d0', mid: '#e4d8bc', low: '#d6c8a8' },
  tan: { top: '#ecd9b4', mid: '#e0c898', low: '#d2b480' },
  smoke: { top: '#e8e4dc', mid: '#dad4c8', low: '#c8c2b6' }
};

const INK_COLOURS = {
  walnut: '#1a1008',
  iron: '#12161c',
  sepia: '#241608',
  indigo: '#141c2e'
};

const GLASS_STYLES = {
  clear: { tint: 0xdfe8e4, atten: 0xbed7ce, dist: 0.55, roughness: 0.055 },
  aqua: { tint: 0xaddad7, atten: 0x63b5b3, dist: 0.34, roughness: 0.07 },
  seagreen: { tint: 0x8db99d, atten: 0x2f6b52, dist: 0.28, roughness: 0.08 },
  amber: { tint: 0xc9a267, atten: 0x8a5a1e, dist: 0.26, roughness: 0.075 },
  smoke: { tint: 0xa9aeb1, atten: 0x4b5155, dist: 0.30, roughness: 0.09 }
};

const CORK_STYLES = {
  natural: { a: 0xc9a978, b: 0x9c7e51 },
  dark: { a: 0x8b6b45, b: 0x5b4529 },
  banded: { a: 0xc0a271, b: 0x6a4e30 }
};

const SEAL_STYLES = {
  none: null,
  crimson: 0x8e2b26,
  forest: 0x2f5138,
  brass: 0x9a7c3f
};

const ALLOW = {
  font: Object.keys(FONT_STACKS),
  align: ['left', 'center', 'right'],
  paperStyle: ['letter', 'map', 'plain'],
  paperColour: Object.keys(PAPER_COLOURS),
  ink: Object.keys(INK_COLOURS),
  bottle: ['antique', 'apothecary', 'flask'],
  glass: Object.keys(GLASS_STYLES),
  cork: Object.keys(CORK_STYLES),
  seal: Object.keys(SEAL_STYLES)
};

/**
 * Exactly five Gerstner waves. Wavelengths, speeds, directions and phases are
 * deliberately non-harmonic (no integer ratios) so the surface never visibly
 * repeats. `dirDeg` is relative to the wind direction.
 */
const WAVES = [
  { wavelength: 97.30, amplitude: 0.780, steepness: 0.28, speedScale: 0.940, dirDeg: 8.7, phase: 0.317 },
  { wavelength: 58.10, amplitude: 0.470, steepness: 0.34, speedScale: 1.073, dirDeg: 41.2, phase: 1.913 },
  { wavelength: 27.40, amplitude: 0.290, steepness: 0.41, speedScale: 1.137, dirDeg: -19.5, phase: 3.627 },
  { wavelength: 14.80, amplitude: 0.155, steepness: 0.37, speedScale: 0.931, dirDeg: 67.9, phase: 5.131 },
  { wavelength: 7.13, amplitude: 0.088, steepness: 0.31, speedScale: 1.207, dirDeg: -52.3, phase: 2.491 }
];
const NW = WAVES.length;
const WAVE_K = WAVES.map((w) => (Math.PI * 2) / w.wavelength);
const WAVE_OMEGA = WAVES.map((w, i) => Math.sqrt(GRAVITY * WAVE_K[i]) * w.speedScale);
const WAVE_DIR = WAVES.map((w) => [Math.cos(w.dirDeg * DEG), Math.sin(w.dirDeg * DEG)]);
/** Per-wave seed multipliers so one seed uniform reshuffles all five phases. */
const PHASE_K = [1.0, 2.3137, 3.7311, 5.1719, 6.9173];
/** Sum of nominal amplitudes, used to normalise crest height in the shader. */
const AMP_SUM = WAVES.reduce((a, w) => a + w.amplitude, 0);

const SURPRISE = {
  recipient: ['A friend far away', 'Someone I have not met yet', 'The finder of this bottle', 'My future self', 'Whoever walks this shore'],
  sender: ['A traveller', 'Someone who watched the tide', 'An old lighthouse keeper', 'A quiet correspondent', 'The one who let it go'],
  title: ['Sent on a long tide', 'Notes from the open water', 'For the one who finds this', 'A short letter, a long sea', 'Concerning the horizon'],
  message: [
    'The water has been kind today. Flat light, a long swell, and nothing on the horizon but more horizon.\n\nI am writing this because it seemed a waste to think it and let it go. If this reaches you, know that someone was out here, paying attention.',
    'There is a particular hour before dusk when the sea stops being scenery and becomes company.\n\nI wanted to leave a note in that hour. Take from it whatever you need, and put the rest back in the water.',
    'I have learned that patience is not waiting. It is staying interested while nothing happens.\n\nThe sea taught me that, slowly, and without any explanation.',
    'If you have found this, then the current did its work, and so did I.\n\nBe well. Look up more often. The weather is always doing something worth watching.'
  ],
  signature: ['With warmth', 'Fair winds', 'Yours across the water', 'Until the tide turns'],
  postscript: ['The glass is older than the letter.', 'Do not send it back — send it on.', 'The cork was the hardest part.'],
  secretLine: ['Look for the green light on the third night.', 'The rest is between you and the water.', 'You already know the answer.']
};

/* ============================================================================
 * 3. Small utilities
 * ========================================================================== */

const $ = (id) => document.getElementById(id);

function setText(el, value) {
  if (!el) return;
  el.textContent = value == null ? '' : String(value);
}

/** Sets text and hides the element entirely when the value is empty. */
function setOptionalText(el, value) {
  if (!el) return;
  const v = value == null ? '' : String(value);
  el.textContent = v;
  el.hidden = v.length === 0;
}

const clampNum = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function num(value, lo, hi, fallback) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return fallback;
  return clampNum(n, lo, hi);
}

function pick(value, list, fallback) {
  return typeof value === 'string' && list.indexOf(value) !== -1 ? value : fallback;
}

/** Trims to length and strips control characters (never trusts URL content). */
function str(value, max) {
  if (typeof value !== 'string') return '';
  /* eslint-disable-next-line no-control-regex */
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
}

/** Critically damped spring, implicit and unconditionally stable. */
function springStep(s, target, omega, dt) {
  if (dt <= 0) return s.x;
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);
  const detX = f * s.x + dt * s.v + hhoo * target;
  const detV = s.v + hoo * (target - s.x);
  s.x = detX * detInv;
  s.v = detV * detInv;
  return s.x;
}

const spring = (x = 0) => ({ x, v: 0 });

function bytesToB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToBytes(text) {
  const norm = String(text).replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const randomOf = (list) => list[Math.floor(Math.random() * list.length)];

/* ============================================================================
 * 4. Message model
 * ========================================================================== */

function defaultMessage() {
  return {
    v: SCHEMA_VERSION,
    to: '',
    from: 'A traveller',
    title: 'Notes from the open water',
    body:
      'The sea has been generous this week: long swell, thin light, and no particular hurry.\n\n' +
      'I am writing because it seemed a waste to think something and then let it go. ' +
      'If this reaches you, know that someone was out here, paying attention.\n\n' +
      'Take from it whatever you need, and put the rest back in the water.',
    sig: 'Fair winds',
    date: '',
    ps: '',
    secret: '',
    ty: { tf: 'calligraphic', bf: 'oldstyle', sf: 'handwritten', al: 'left', ts: 36, bs: 20, ss: 24, lh: 1.5 },
    pa: { st: 'letter', co: 'ivory', ik: 'walnut' },
    bo: { st: 'antique', gl: 'aqua', ck: 'natural', sl: 'none' },
    en: { tod: 0.52, sea: 0.45, haze: 0.35, cl: 0.4, sd: 4173, au: 0 }
  };
}

/**
 * Accepts either the compact wire format used in generated links, or the
 * verbose schema from the project brief, and normalises to compact.
 */
function normaliseIncoming(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.v != null || raw.ty || raw.pa || raw.bo || raw.en) return raw;

  const typography = raw.typography && typeof raw.typography === 'object' ? raw.typography : {};
  const paper = raw.paper && typeof raw.paper === 'object' ? raw.paper : {};
  const bottle = raw.bottle && typeof raw.bottle === 'object' ? raw.bottle : {};
  const environment = raw.environment && typeof raw.environment === 'object' ? raw.environment : {};
  const audio = raw.audio && typeof raw.audio === 'object' ? raw.audio : {};

  return {
    v: raw.version,
    to: raw.recipient,
    from: raw.sender,
    title: raw.title,
    body: raw.message,
    sig: raw.signature,
    date: raw.date,
    ps: raw.postscript,
    secret: raw.secretLine,
    ty: {
      tf: typography.titleFont,
      bf: typography.bodyFont,
      sf: typography.signatureFont,
      al: typography.alignment,
      ts: typography.titleSize,
      bs: typography.bodySize,
      ss: typography.signatureSize,
      lh: typography.lineHeight
    },
    pa: {
      st: paper.style,
      co: paper.colour,
      ik: paper.inkColour
    },
    bo: {
      st: bottle.style,
      gl: bottle.glassColour,
      ck: bottle.corkStyle,
      sl: bottle.sealStyle
    },
    en: {
      tod: environment.timeOfDay,
      sea: environment.seaState,
      haze: environment.haze,
      cl: environment.clouds,
      sd: environment.seed,
      au: audio.enabled ? 1 : 0
    }
  };
}

/** Clamps and allowlists an arbitrary object into a safe message. */
function sanitiseMessage(rawIn) {
  const raw = normaliseIncoming(rawIn);
  const d = defaultMessage();
  if (!raw || typeof raw !== 'object') return d;

  const ty = raw.ty && typeof raw.ty === 'object' ? raw.ty : {};
  const pa = raw.pa && typeof raw.pa === 'object' ? raw.pa : {};
  const bo = raw.bo && typeof raw.bo === 'object' ? raw.bo : {};
  const en = raw.en && typeof raw.en === 'object' ? raw.en : {};

  return {
    v: SCHEMA_VERSION,
    to: str(raw.to, LIMITS.recipient),
    from: str(raw.from, LIMITS.sender),
    title: str(raw.title, LIMITS.title),
    body: str(raw.body, LIMITS.message),
    sig: str(raw.sig, LIMITS.signature),
    date: str(raw.date, LIMITS.date),
    ps: str(raw.ps, LIMITS.postscript),
    secret: str(raw.secret, LIMITS.secretLine),
    ty: {
      tf: pick(ty.tf, ALLOW.font, d.ty.tf),
      bf: pick(ty.bf, ALLOW.font, d.ty.bf),
      sf: pick(ty.sf, ALLOW.font, d.ty.sf),
      al: pick(ty.al, ALLOW.align, d.ty.al),
      ts: Math.round(num(ty.ts, 22, 64, d.ty.ts)),
      bs: Math.round(num(ty.bs, 15, 34, d.ty.bs)),
      ss: Math.round(num(ty.ss, 16, 42, d.ty.ss)),
      lh: num(ty.lh, 1.2, 2, d.ty.lh)
    },
    pa: {
      st: pick(pa.st, ALLOW.paperStyle, d.pa.st),
      co: pick(pa.co, ALLOW.paperColour, d.pa.co),
      ik: pick(pa.ik, ALLOW.ink, d.pa.ik)
    },
    bo: {
      st: pick(bo.st, ALLOW.bottle, d.bo.st),
      gl: pick(bo.gl, ALLOW.glass, d.bo.gl),
      ck: pick(bo.ck, ALLOW.cork, d.bo.ck),
      sl: pick(bo.sl, ALLOW.seal, d.bo.sl)
    },
    en: {
      tod: num(en.tod, 0, 1, d.en.tod),
      sea: num(en.sea, 0.15, 1, d.en.sea),
      haze: num(en.haze, 0, 1, d.en.haze),
      cl: num(en.cl, 0, 1, d.en.cl),
      sd: Math.round(num(en.sd, 0, 999999, d.en.sd)),
      au: num(en.au, 0, 1, 0) >= 0.5 ? 1 : 0
    }
  };
}

function encodePlain(msg) {
  return bytesToB64Url(new TextEncoder().encode(JSON.stringify(msg)));
}

function decodePlain(fragment) {
  const json = new TextDecoder().decode(b64UrlToBytes(fragment));
  const parsed = JSON.parse(json);
  const normalised = normaliseIncoming(parsed);
  if (!normalised || normalised.v !== SCHEMA_VERSION) throw new Error('Unsupported message version.');
  return sanitiseMessage(normalised);
}

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Envelope: [version u8][iterations u32 BE][salt 16][iv 12][ciphertext]. */
async function encodeEncrypted(msg, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(msg)))
  );
  const out = new Uint8Array(1 + 4 + 16 + 12 + cipher.length);
  out[0] = SCHEMA_VERSION;
  out[1] = (PBKDF2_ITERATIONS >>> 24) & 0xff;
  out[2] = (PBKDF2_ITERATIONS >>> 16) & 0xff;
  out[3] = (PBKDF2_ITERATIONS >>> 8) & 0xff;
  out[4] = PBKDF2_ITERATIONS & 0xff;
  out.set(salt, 5);
  out.set(iv, 21);
  out.set(cipher, 33);
  return bytesToB64Url(out);
}

async function decodeEncrypted(fragment, password) {
  const bytes = b64UrlToBytes(fragment);
  if (bytes.length < 34) throw new Error('Damaged encrypted payload.');
  if (bytes[0] !== SCHEMA_VERSION) throw new Error('Unsupported message version.');
  const iterations = clampNum((bytes[1] << 24) | (bytes[2] << 16) | (bytes[3] << 8) | bytes[4], 10000, 1000000);
  const salt = bytes.slice(5, 21);
  const iv = bytes.slice(21, 33);
  const cipher = bytes.slice(33);
  const key = await deriveKey(password, salt, iterations);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  if (!parsed || parsed.v !== SCHEMA_VERSION) throw new Error('Unsupported message version.');
  return sanitiseMessage(parsed);
}

/* ============================================================================
 * 5. DOM references
 * ========================================================================== */

const dom = {
  viewport: $('viewport'),
  lensDrops: $('lens-drops'),
  loading: $('loading'),
  loadingText: $('loading-text'),
  loadingElapsed: $('loading-elapsed'),
  loadingFact: $('loading-fact'),
  loadingFactBody: $('loading-fact-body'),
  errorScreen: $('error-screen'),
  errorTitle: $('error-title'),
  errorBody: $('error-body'),
  errorFallback: $('error-fallback-btn'),

  passwordDialog: $('password-dialog'),
  decryptPassword: $('decrypt-password'),
  decryptError: $('decrypt-error'),
  decryptSubmit: $('decrypt-submit'),
  decryptCancel: $('decrypt-cancel'),

  btnCreate: $('btn-create'),
  btnOpenMessage: $('btn-open-message'),
  btnFacts: $('btn-facts'),
  btnMute: $('btn-mute'),
  btnControls: $('btn-controls'),
  btnPause: $('btn-pause'),
  btnResume: $('btn-resume'),
  fps: $('fps-display'),
  buoyDebug: $('buoy-debug'),
  buoyDebugBody: $('buoy-debug-body'),

  activator: $('bottle-activator'),
  hint: $('hint'),
  statusLive: $('status-live'),

  controlsPanel: $('controls-panel'),
  deviceHint: $('device-hint'),
  factsPanel: $('facts-panel'),
  factsBody: $('facts-body'),
  factsCount: $('facts-count'),
  btnFactPrev: $('btn-fact-prev'),
  btnFactNext: $('btn-fact-next'),
  btnFactClose: $('btn-fact-close'),

  messageLayer: $('message-layer'),
  messageParchment: $('message-parchment'),
  btnCloseMessage: $('btn-close-message'),
  btnCreateFromMessage: $('btn-create-from-message'),

  composer: $('composer'),
  composerForm: $('composer-form'),
  previewParchment: $('preview-parchment'),
  btnSurprise: $('btn-surprise'),
  btnReset: $('btn-reset'),
  btnPreviewExp: $('btn-preview-exp'),
  btnGenerate: $('btn-generate'),
  btnCopy: $('btn-copy'),
  btnCloseComposer: $('btn-close-composer'),
  generatedLink: $('generated-link'),
  charCount: $('char-count'),
  urlEstimate: $('url-estimate'),
  encryptField: $('encrypt-password-field'),
  fEncrypt: $('f-encrypt'),
  fPassword: $('f-password')
};

const MSG_IDS = { to: 'msg-to', title: 'msg-title', body: 'msg-body', sig: 'msg-signature', from: 'msg-from', date: 'msg-date', ps: 'msg-ps', secret: 'msg-secret' };
const PREV_IDS = { to: 'prev-to', title: 'prev-title', body: 'prev-body', sig: 'prev-signature', from: 'prev-from', date: 'prev-date', ps: 'prev-ps', secret: 'prev-secret' };

const CTRL = {
  quality: { input: $('ctrl-quality'), out: null },
  sea: { input: $('ctrl-sea'), out: $('out-sea') },
  wind: { input: $('ctrl-wind'), out: $('out-wind') },
  windDir: { input: $('ctrl-wind-dir'), out: $('out-wind-dir') },
  swell: { input: $('ctrl-swell'), out: $('out-swell') },
  foam: { input: $('ctrl-foam'), out: $('out-foam') },
  tod: { input: $('ctrl-tod'), out: $('out-tod') },
  sunAz: { input: $('ctrl-sun-az'), out: $('out-sun-az') },
  moonAz: { input: $('ctrl-moon-az'), out: $('out-moon-az') },
  moonElev: { input: $('ctrl-moon-elev'), out: $('out-moon-elev') },
  moonPhase: { input: $('ctrl-moon-phase'), out: $('out-moon-phase') },
  haze: { input: $('ctrl-haze'), out: $('out-haze') },
  clouds: { input: $('ctrl-clouds'), out: $('out-clouds') },
  exposure: { input: $('ctrl-exposure'), out: $('out-exposure') },
  drift: { input: $('ctrl-drift'), out: $('out-drift') },
  seed: { input: $('ctrl-seed'), out: null },
  volume: { input: $('ctrl-volume'), out: $('out-volume') },
  reduced: { input: $('ctrl-reduced'), out: null },
  buoyDebug: { input: $('ctrl-buoy-debug'), out: null }
};

/**
 * Short loading-screen notes drawn from drift-bottle history.
 * Verified finds are stated as fact; popular but unproven stories are marked as legends.
 * Sources include Western Australian Museum / Guinness (Paula 1886), Marine Biological
 * Association (Bidder), NOAA / Woods Hole recovery studies, and standard historical surveys.
 */
const LOADING_FACTS = [
  'The oldest confirmed message in a bottle was cast from the German barque Paula on 12 June 1886. It washed up in Western Australia in 2018 — about 132 years later — and holds the Guinness World Record.',
  'That Paula bottle was not a love letter. It was part of a German Naval Observatory ocean-current experiment (1864–1933). Captains logged the launch; finders were asked to return the slip to Hamburg.',
  'Of thousands of German drift bottles launched over nearly seventy years, only a few hundred message slips were ever returned. The Paula find remains the only known surviving bottle from that programme.',
  'Before Paula, the record stood at 108 years: a 1906 North Sea bottle from marine biologist George Parker Bidder, found on Amrum, Germany, in 2015. The note still promised the finder a shilling.',
  'Bidder’s bottles were weighted with copper wire so they drifted just above the seabed. That design helped prove that deep currents in the North Sea can run opposite to the surface flow.',
  'In the mid-1700s, Benjamin Franklin and others used drift bottles and similar floats while mapping the Gulf Stream — one of the earliest modern uses of bottled messages as ocean science.',
  'From 1808 to 1852, British naval officer Alexander Becher organised “bottle papers” with beachcomber networks to track how objects travel around ocean gyres.',
  'Prince Albert I of Monaco released drift bottles in the late 1800s and helped show that the Gulf Stream splits into the North Atlantic Drift and the Azores Current.',
  'Woods Hole oceanographers launched more than 150,000 Atlantic drift bottles between 1948 and 1962. Roughly one in ten was reported found — a high rate for open-ocean releases.',
  'Pacific recoveries are rarer. A Scripps Institution programme (1954–1971) that released about 148,000 bottles saw only around 3–4% returned.',
  'Oceanographer Curtis Ebbesmeyer’s rule of thumb: drop a bottle more than about 100 miles offshore and fewer than 10% ever come back; past 1,000 miles, only a few percent.',
  'A popular estimate from 2009 put total bottled messages since the mid-1900s at about six million — including roughly half a million released by oceanographers.',
  'Edgar Allan Poe’s 1833 tale “MS. Found in a Bottle” and Charles Dickens’s 1860 “A Message from the Sea” helped turn scientific drift notes into a romantic literary obsession.',
  'In 1914, Private Thomas Hughes tossed a letter to his wife into the English Channel days before he was killed in France. The bottle surfaced in 1999 and reached his daughter in New Zealand.',
  'A German “Flying Dutchman” bottle launched in 1929 asked finders to report it, then cast it back. It was logged across roughly 16,000 miles before its last known report in 1935.',
  'In 1875, steward Van Hoydek and cabin boy Henry Trusillo of the ship Lennie sealed 24 bottles naming mutineers who had murdered the officers. French authorities used the notes to catch them.',
  'Remote St Kilda islanders once sent “mailboats” — letters in tins floated on sheep bladders. Some rode the Gulf Stream to Scotland and Scandinavia within days or weeks.',
  'Alaska “drift casks” launched in 1899–1901 reached Siberia, Iceland and Norway — among the first human-made objects known to transit the Northwest Passage.',
  'A legend says Greek philosopher Theophrastus (about 310 BCE) tossed bottles to test Atlantic inflow into the Mediterranean. Scholars have found no evidence he ever did; treat it as a story, not a record.',
  'Another legend claims Queen Elizabeth I appointed an “Uncorker of Ocean Bottles” and threatened death for anyone else who opened one. Researchers trace the tale to later fiction, not Tudor law.',
  'Christopher Columbus is said to have sealed a New World report in a waxed barrel during a storm for Ferdinand and Isabella. If he did, the barrel was never found.',
  'Japan’s medieval epic The Tale of the Heike tells of an exiled poet around 1177 who floated wooden planks carved with poems — an early cousin of the bottled message.',
  'Many “Titanic message in a bottle” stories circulated after 1912. Newspapers warned even then that a great many such finds were cruel hoaxes.',
  'In 1959 Guinness Brewery cast some 150,000 promotional bottles into the Atlantic and Caribbean. Inuit hunters later reported dozens found as far as Hudson Bay.',
  'Modern science mostly replaced glass bottles with satellite-tracked drifters — but the hope in a sealed note still feels the same: cast something into the unknown and wait.'
];

const loadingFacts = {
  timer: 0,
  fadeTimer: 0,
  index: 0,
  reduced: false,
  /** performance.now() when the intro splash first showed a fact */
  shownAt: 0
};

/** Live splash status — keeps moving even during long async GPU waits. */
const loadingStatus = {
  stage: 'Loading',
  tick: 0,
  rotate: 0,
  variants: null
};

/** Minimum time the intro stays up so visitors can read the note. */
const INTRO_MIN_MS = 10000;

/** How long each "While you wait" fact stays on the splash. */
const LOADING_FACT_MS = 10000;

function setLoadingStage(stage, variants = null) {
  loadingStatus.stage = stage || 'Loading';
  loadingStatus.variants = Array.isArray(variants) && variants.length ? variants : null;
  loadingStatus.rotate = 0;
  setText(dom.loadingText, loadingStatus.stage);
  refreshLoadingElapsed();
}

function refreshLoadingElapsed() {
  if (!dom.loadingElapsed || !loadingFacts.shownAt) return;
  const sec = Math.max(0, Math.floor((performance.now() - loadingFacts.shownAt) / 1000));
  if (sec < 2) {
    setText(dom.loadingElapsed, '');
    return;
  }
  setText(
    dom.loadingElapsed,
    sec < 8 ? `${sec}s` : `${sec}s · first visit can take a moment`
  );
}

function startLoadingHeartbeat() {
  if (loadingStatus.tick) return;
  loadingStatus.tick = window.setInterval(() => {
    if (!dom.loading || dom.loading.classList.contains('hide')) {
      stopLoadingHeartbeat();
      return;
    }
    if (loadingStatus.variants) {
      loadingStatus.rotate = (loadingStatus.rotate + 1) % loadingStatus.variants.length;
      setText(dom.loadingText, loadingStatus.variants[loadingStatus.rotate]);
    }
    refreshLoadingElapsed();
  }, 1600);
}

function stopLoadingHeartbeat() {
  if (loadingStatus.tick) {
    window.clearInterval(loadingStatus.tick);
    loadingStatus.tick = 0;
  }
  loadingStatus.variants = null;
}

function readSeenFactIds() {
  try {
    const raw = localStorage.getItem('miab-facts-seen');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch (_) {
    return [];
  }
}

function writeSeenFactIds(ids) {
  try {
    localStorage.setItem('miab-facts-seen', JSON.stringify(ids.slice(-LOADING_FACTS.length)));
  } catch (_) { /* private mode */ }
}

/** Prefer facts not shown recently; cycle the full set before repeats. */
function pickNextFactIndex(exclude = -1) {
  const seen = readSeenFactIds();
  const unseen = [];
  for (let i = 0; i < LOADING_FACTS.length; i++) {
    if (!seen.includes(i) && i !== exclude) unseen.push(i);
  }
  let pool = unseen;
  if (!pool.length) {
    writeSeenFactIds([]);
    pool = [];
    for (let i = 0; i < LOADING_FACTS.length; i++) {
      if (i !== exclude) pool.push(i);
    }
    if (!pool.length) pool = LOADING_FACTS.map((_, i) => i);
  }
  const choice = pool[(Math.random() * pool.length) | 0];
  const nextSeen = seen.filter((id) => id !== choice).concat(choice);
  writeSeenFactIds(nextSeen);
  return choice;
}

function showLoadingFact(index, animate) {
  if (!dom.loadingFactBody) return;
  const text = LOADING_FACTS[index];
  if (!text) return;
  loadingFacts.index = index;

  const apply = () => {
    loadingFacts.fadeTimer = 0;
    setText(dom.loadingFactBody, text);
    if (dom.loadingFact) dom.loadingFact.classList.remove('is-fading');
  };

  if (loadingFacts.fadeTimer) {
    window.clearTimeout(loadingFacts.fadeTimer);
    loadingFacts.fadeTimer = 0;
  }

  if (!animate || loadingFacts.reduced || !dom.loadingFact) {
    apply();
    return;
  }

  dom.loadingFact.classList.add('is-fading');
  loadingFacts.fadeTimer = window.setTimeout(apply, 420);
}

function startLoadingFacts() {
  loadingFacts.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!loadingFacts.shownAt) loadingFacts.shownAt = performance.now();
  const first = pickNextFactIndex(-1);
  showLoadingFact(first, false);
  startLoadingHeartbeat();
  startLoadingFactsSteady();
}

function stopLoadingFacts() {
  if (loadingFacts.timer) {
    window.clearInterval(loadingFacts.timer);
    loadingFacts.timer = 0;
  }
  if (loadingFacts.fadeTimer) {
    window.clearTimeout(loadingFacts.fadeTimer);
    loadingFacts.fadeTimer = 0;
  }
  if (dom.loadingFact) dom.loadingFact.classList.remove('is-fading');
}

/**
 * Keep "While you wait" notes moving during load (no CSS fade —
 * a mid-fade + pause used to leave the fact invisible and look frozen).
 */
function startLoadingFactsSteady() {
  if (!dom.loading || dom.loading.classList.contains('hide')) return;
  if (loadingFacts.timer) {
    window.clearInterval(loadingFacts.timer);
    loadingFacts.timer = 0;
  }
  if (dom.loadingFact) dom.loadingFact.classList.remove('is-fading');
  loadingFacts.timer = window.setInterval(() => {
    if (!dom.loading || dom.loading.classList.contains('hide')) {
      stopLoadingFacts();
      return;
    }
    showLoadingFact(pickNextFactIndex(loadingFacts.index), false);
  }, LOADING_FACT_MS);
}

/** Resume fact rotation without resetting the intro clock. */
function resumeLoadingFacts() {
  startLoadingFactsSteady();
}

/** Hold the splash until INTRO_MIN_MS has elapsed, then fade it out. */
async function dismissLoadingScreen() {
  const started = loadingFacts.shownAt || performance.now();
  const elapsed = performance.now() - started;
  // First GPU compile (esp. cold / incognito) often already burns the 5s budget.
  // Only pad when the load was fast; otherwise a short "ready" beat and go.
  const remain = elapsed >= INTRO_MIN_MS
    ? 700
    : Math.max(700, INTRO_MIN_MS - elapsed);
  setLoadingStage('Ready when you are');
  if (dom.loadingElapsed) setText(dom.loadingElapsed, '');
  resumeLoadingFacts();
  await new Promise((resolve) => window.setTimeout(resolve, remain));
  stopLoadingHeartbeat();
  stopLoadingFacts();
  if (dom.loading) dom.loading.classList.add('hide');
}

const FORM = {
  recipient: $('f-recipient'),
  sender: $('f-sender'),
  title: $('f-title'),
  message: $('f-message'),
  signature: $('f-signature'),
  date: $('f-date'),
  postscript: $('f-postscript'),
  secret: $('f-secret'),
  titleFont: $('f-title-font'),
  bodyFont: $('f-body-font'),
  sigFont: $('f-sig-font'),
  align: $('f-align'),
  titleSize: $('f-title-size'),
  bodySize: $('f-body-size'),
  sigSize: $('f-sig-size'),
  lineHeight: $('f-line-height'),
  paperStyle: $('f-paper-style'),
  paperColour: $('f-paper-colour'),
  ink: $('f-ink-colour'),
  bottleStyle: $('f-bottle-style'),
  glass: $('f-glass-colour'),
  cork: $('f-cork-style'),
  seal: $('f-seal-style'),
  tod: $('f-tod'),
  sea: $('f-sea'),
  haze: $('f-haze'),
  clouds: $('f-clouds'),
  seed: $('f-seed'),
  audio: $('f-audio')
};

const FORM_OUT = {
  titleSize: $('out-title-size'),
  bodySize: $('out-body-size'),
  sigSize: $('out-sig-size'),
  lineHeight: $('out-line-height')
};

function announce(text) {
  setText(dom.statusLive, text);
}

function showHint(text) {
  if (!dom.hint) return;
  if (text) setText(dom.hint, text);
  dom.hint.classList.add('show');
}

function hideHint() {
  if (dom.hint) dom.hint.classList.remove('show');
}

const BOTTLE_HINT_KEY = 'miab-bottle-press-seen';

function hasSeenBottlePressHint() {
  try {
    return localStorage.getItem(BOTTLE_HINT_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function markBottlePressHintSeen() {
  try {
    localStorage.setItem(BOTTLE_HINT_KEY, '1');
  } catch (_) { /* private mode */ }
  if (dom.activator) dom.activator.classList.remove('cue');
}

function showFirstVisitBottleCue() {
  if (hasSeenBottlePressHint()) return;
  if (dom.activator) dom.activator.classList.add('cue');
  showHint('Press the bottle to open the message.');
  announce('Press the glowing bottle to open the message.');
}

function showErrorScreen(title, body) {
  stopLoadingHeartbeat();
  stopLoadingFacts();
  if (dom.loading) dom.loading.classList.add('hide');
  setText(dom.errorTitle, title);
  setText(dom.errorBody, body);
  if (dom.errorScreen) dom.errorScreen.classList.add('show');
  if (dom.errorFallback) {
    try {
      dom.errorFallback.focus({ preventScroll: true });
    } catch (err) {
      /* focus is best effort */
    }
  }
}

/** Reject if a promise takes too long (WebGPU init can hang with no adapter). */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(id);
        reject(err);
      }
    );
  });
}

/* ============================================================================
 * 6. Parchment rendering
 * ========================================================================== */

const PARCHMENT_TEX = new URL('./textures/parchment-aged.jpg', import.meta.url).href;
const PARCHMENT_GRUNGE = new URL('./textures/parchment-grunge.jpg', import.meta.url).href;
const PARCHMENT_FIBER = new URL('./textures/parchment-fiber.jpg', import.meta.url).href;

function paperBackground(style, colour) {
  const c = PAPER_COLOURS[colour] || PAPER_COLOURS.ivory;
  const aged = `url("${PARCHMENT_TEX}")`;
  const grunge = `url("${PARCHMENT_GRUNGE}")`;
  const fiber = `url("${PARCHMENT_FIBER}")`;
  // Stronger light wash so dark ink stays readable on aged texture.
  const tint = `linear-gradient(165deg, ${c.top}e8 0%, ${c.mid}d8 48%, ${c.low}e0 100%)`;
  const ageA = 'radial-gradient(ellipse at 12% 8%, rgba(110, 55, 18, 0.16), transparent 46%)';
  const ageB = 'radial-gradient(ellipse at 90% 94%, rgba(55, 32, 12, 0.2), transparent 52%)';
  const ageC = 'radial-gradient(ellipse at 68% 28%, rgba(150, 95, 40, 0.08), transparent 38%)';
  const ageD = 'radial-gradient(ellipse at 40% 70%, rgba(80, 45, 15, 0.08), transparent 40%)';
  if (style === 'plain') {
    return [tint, fiber, aged].join(', ');
  }
  return [ageA, ageB, ageC, ageD, tint, grunge, fiber, aged].join(', ');
}

function applyParchmentStyling(root, ids, msg) {
  if (!root) return;
  const ty = msg.ty;
  const pa = msg.pa;

  root.style.backgroundImage = paperBackground(pa.st, pa.co);
  root.style.backgroundColor = (PAPER_COLOURS[pa.co] || PAPER_COLOURS.ivory).mid;
  root.style.backgroundSize = 'auto, auto, auto, auto, auto, 720px 720px, 480px 480px, 640px 640px';
  root.style.backgroundRepeat = 'no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, repeat, repeat, repeat';
  // Soft-light on grunge (not multiply) keeps the page brighter under the ink.
  root.style.backgroundBlendMode = 'multiply, multiply, soft-light, multiply, soft-light, soft-light, soft-light, normal';
  root.style.color = INK_COLOURS[pa.ik] || INK_COLOURS.walnut;
  root.style.textAlign = ty.al;
  root.classList.toggle('style-map', pa.st === 'map');

  // Plain style uses fewer overlay layers.
  if (pa.st === 'plain') {
    root.style.backgroundSize = 'auto, 480px 480px, 640px 640px';
    root.style.backgroundRepeat = 'no-repeat, repeat, repeat';
    root.style.backgroundBlendMode = 'soft-light, soft-light, normal';
  }

  const titleEl = $(ids.title);
  const bodyEl = $(ids.body);
  const sigEl = $(ids.sig);
  const bodyStack = FONT_STACKS[ty.bf] || FONT_STACKS.oldstyle;

  if (titleEl) {
    titleEl.style.fontFamily = FONT_STACKS[ty.tf] || FONT_STACKS.calligraphic;
    titleEl.style.fontSize = `${ty.ts}px`;
    titleEl.style.fontWeight = '400';
  }
  if (bodyEl) {
    bodyEl.style.fontFamily = bodyStack;
    bodyEl.style.fontSize = `${ty.bs}px`;
    bodyEl.style.lineHeight = String(ty.lh);
  }
  if (sigEl) {
    sigEl.style.fontFamily = FONT_STACKS[ty.sf] || FONT_STACKS.handwritten;
    sigEl.style.fontSize = `${ty.ss}px`;
    sigEl.style.lineHeight = '1.3';
  }

  const smallSize = `${Math.max(13, Math.round(ty.bs * 0.82))}px`;
  ['to', 'from', 'date', 'ps', 'secret'].forEach((key) => {
    const el = $(ids[key]);
    if (!el) return;
    el.style.fontFamily = bodyStack;
    el.style.fontSize = smallSize;
    el.style.lineHeight = String(Math.min(1.8, ty.lh));
  });
}

function fillParchment(ids, msg, titleFallback) {
  setOptionalText($(ids.to), msg.to ? `To ${msg.to},` : '');
  setText($(ids.title), msg.title || titleFallback || '');
  setOptionalText($(ids.body), msg.body);
  setOptionalText($(ids.sig), msg.sig);
  setOptionalText($(ids.from), msg.from ? `— ${msg.from}` : '');
  setOptionalText($(ids.date), msg.date);
  setOptionalText($(ids.ps), msg.ps ? `P.S. ${msg.ps}` : '');
  setOptionalText($(ids.secret), msg.secret);
}

function renderMessageParchment(msg) {
  fillParchment(MSG_IDS, msg, 'A message from the sea');
  applyParchmentStyling(dom.messageParchment, MSG_IDS, msg);
}

function renderPreviewParchment(msg) {
  fillParchment(PREV_IDS, msg, 'Untitled letter');
  applyParchmentStyling(dom.previewParchment, PREV_IDS, msg);
}

/* ============================================================================
 * 7. Composer
 * ========================================================================== */

let currentMessage = defaultMessage();
let hasSharedMessage = false;
let lastGeneratedUrl = '';

function populateFontSelects() {
  [FORM.titleFont, FORM.bodyFont, FORM.sigFont].forEach((select) => {
    if (!select) return;
    select.replaceChildren();
    ALLOW.font.forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = FONT_LABELS[key] || key;
      select.appendChild(opt);
    });
  });
}

function setSelect(el, value) {
  if (el) el.value = value;
}

function writeForm(msg) {
  if (FORM.recipient) FORM.recipient.value = msg.to;
  if (FORM.sender) FORM.sender.value = msg.from;
  if (FORM.title) FORM.title.value = msg.title;
  if (FORM.message) FORM.message.value = msg.body;
  if (FORM.signature) FORM.signature.value = msg.sig;
  if (FORM.date) FORM.date.value = msg.date;
  if (FORM.postscript) FORM.postscript.value = msg.ps;
  if (FORM.secret) FORM.secret.value = msg.secret;

  setSelect(FORM.titleFont, msg.ty.tf);
  setSelect(FORM.bodyFont, msg.ty.bf);
  setSelect(FORM.sigFont, msg.ty.sf);
  setSelect(FORM.align, msg.ty.al);
  if (FORM.titleSize) FORM.titleSize.value = String(msg.ty.ts);
  if (FORM.bodySize) FORM.bodySize.value = String(msg.ty.bs);
  if (FORM.sigSize) FORM.sigSize.value = String(msg.ty.ss);
  if (FORM.lineHeight) FORM.lineHeight.value = String(msg.ty.lh);

  setSelect(FORM.paperStyle, msg.pa.st);
  setSelect(FORM.paperColour, msg.pa.co);
  setSelect(FORM.ink, msg.pa.ik);
  setSelect(FORM.bottleStyle, msg.bo.st);
  setSelect(FORM.glass, msg.bo.gl);
  setSelect(FORM.cork, msg.bo.ck);
  setSelect(FORM.seal, msg.bo.sl);

  if (FORM.tod) FORM.tod.value = String(msg.en.tod);
  if (FORM.sea) FORM.sea.value = String(msg.en.sea);
  if (FORM.haze) FORM.haze.value = String(msg.en.haze);
  if (FORM.clouds) FORM.clouds.value = String(msg.en.cl);
  if (FORM.seed) FORM.seed.value = String(msg.en.sd);
  setSelect(FORM.audio, String(msg.en.au));

  refreshFormOutputs();
}

function readForm() {
  return sanitiseMessage({
    v: SCHEMA_VERSION,
    to: FORM.recipient ? FORM.recipient.value : '',
    from: FORM.sender ? FORM.sender.value : '',
    title: FORM.title ? FORM.title.value : '',
    body: FORM.message ? FORM.message.value : '',
    sig: FORM.signature ? FORM.signature.value : '',
    date: FORM.date ? FORM.date.value : '',
    ps: FORM.postscript ? FORM.postscript.value : '',
    secret: FORM.secret ? FORM.secret.value : '',
    ty: {
      tf: FORM.titleFont ? FORM.titleFont.value : undefined,
      bf: FORM.bodyFont ? FORM.bodyFont.value : undefined,
      sf: FORM.sigFont ? FORM.sigFont.value : undefined,
      al: FORM.align ? FORM.align.value : undefined,
      ts: FORM.titleSize ? FORM.titleSize.value : undefined,
      bs: FORM.bodySize ? FORM.bodySize.value : undefined,
      ss: FORM.sigSize ? FORM.sigSize.value : undefined,
      lh: FORM.lineHeight ? FORM.lineHeight.value : undefined
    },
    pa: {
      st: FORM.paperStyle ? FORM.paperStyle.value : undefined,
      co: FORM.paperColour ? FORM.paperColour.value : undefined,
      ik: FORM.ink ? FORM.ink.value : undefined
    },
    bo: {
      st: FORM.bottleStyle ? FORM.bottleStyle.value : undefined,
      gl: FORM.glass ? FORM.glass.value : undefined,
      ck: FORM.cork ? FORM.cork.value : undefined,
      sl: FORM.seal ? FORM.seal.value : undefined
    },
    en: {
      tod: FORM.tod ? FORM.tod.value : undefined,
      sea: FORM.sea ? FORM.sea.value : undefined,
      haze: FORM.haze ? FORM.haze.value : undefined,
      cl: FORM.clouds ? FORM.clouds.value : undefined,
      sd: FORM.seed ? FORM.seed.value : undefined,
      au: FORM.audio ? FORM.audio.value : undefined
    }
  });
}

function refreshFormOutputs() {
  if (FORM.titleSize) setText(FORM_OUT.titleSize, FORM.titleSize.value);
  if (FORM.bodySize) setText(FORM_OUT.bodySize, FORM.bodySize.value);
  if (FORM.sigSize) setText(FORM_OUT.sigSize, FORM.sigSize.value);
  if (FORM.lineHeight) setText(FORM_OUT.lineHeight, parseFloat(FORM.lineHeight.value).toFixed(2));
}

function baseUrl() {
  return `${location.origin}${location.pathname}${location.search}`;
}

function updateComposerMeta(msg) {
  const len = msg.body.length;
  setText(dom.charCount, `${len} / ${LIMITS.message}`);
  if (dom.charCount) {
    dom.charCount.classList.toggle('warn', len > LIMITS.message * 0.9);
  }

  const encrypted = !!(dom.fEncrypt && dom.fEncrypt.checked);
  const payload = encodePlain(msg);
  // AES-GCM envelope adds a 33 byte header plus a 16 byte tag before base64.
  const estimate = encrypted
    ? baseUrl().length + 3 + Math.ceil(((payload.length * 3) / 4 + 49) / 3) * 4
    : baseUrl().length + 3 + payload.length;

  let note = `Estimated URL length: ${estimate} characters`;
  if (estimate > 8000) note += ' — too long for some browsers, please shorten the message.';
  else if (estimate > 2000) note += ' — long links may be truncated by some chat apps.';
  setText(dom.urlEstimate, note);
  if (dom.urlEstimate) {
    dom.urlEstimate.classList.toggle('warn', estimate > 2000 && estimate <= 8000);
    dom.urlEstimate.classList.toggle('error', estimate > 8000);
  }
}

function onComposerInput() {
  refreshFormOutputs();
  const msg = readForm();
  renderPreviewParchment(msg);
  updateComposerMeta(msg);
  if (dom.btnCopy) dom.btnCopy.disabled = true;
  lastGeneratedUrl = '';
}

function surpriseMe() {
  if (FORM.recipient) FORM.recipient.value = randomOf(SURPRISE.recipient);
  if (FORM.sender) FORM.sender.value = randomOf(SURPRISE.sender);
  if (FORM.title) FORM.title.value = randomOf(SURPRISE.title);
  if (FORM.message) FORM.message.value = randomOf(SURPRISE.message);
  if (FORM.signature) FORM.signature.value = randomOf(SURPRISE.signature);
  if (FORM.postscript) FORM.postscript.value = randomOf(SURPRISE.postscript);
  if (FORM.secret) FORM.secret.value = Math.random() < 0.5 ? randomOf(SURPRISE.secretLine) : '';
  if (FORM.date) {
    FORM.date.value = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }
  setSelect(FORM.titleFont, randomOf(ALLOW.font));
  setSelect(FORM.sigFont, randomOf(['handwritten', 'calligraphic', 'elegant']));
  setSelect(FORM.paperColour, randomOf(ALLOW.paperColour));
  setSelect(FORM.ink, randomOf(ALLOW.ink));
  setSelect(FORM.glass, randomOf(ALLOW.glass));
  setSelect(FORM.bottleStyle, randomOf(ALLOW.bottle));
  setSelect(FORM.cork, randomOf(ALLOW.cork));
  setSelect(FORM.seal, randomOf(ALLOW.seal));
  if (FORM.tod) FORM.tod.value = (0.18 + Math.random() * 0.7).toFixed(2);
  if (FORM.sea) FORM.sea.value = (0.25 + Math.random() * 0.55).toFixed(2);
  if (FORM.haze) FORM.haze.value = (0.15 + Math.random() * 0.55).toFixed(2);
  if (FORM.clouds) FORM.clouds.value = (0.1 + Math.random() * 0.7).toFixed(2);
  if (FORM.seed) FORM.seed.value = String(Math.floor(Math.random() * 1000000));
  onComposerInput();
  announce('A random letter has been composed.');
}

async function generateLink() {
  const msg = readForm();
  const encrypted = !!(dom.fEncrypt && dom.fEncrypt.checked);
  const password = dom.fPassword ? dom.fPassword.value : '';

  if (encrypted && password.length < 4) {
    setText(dom.generatedLink, '');
    announce('Please choose an encryption password of at least four characters.');
    if (dom.fPassword) dom.fPassword.focus();
    return;
  }

  try {
    const fragment = encrypted ? `#e=${await encodeEncrypted(msg, password)}` : `#m=${encodePlain(msg)}`;
    lastGeneratedUrl = baseUrl() + fragment;
    if (dom.generatedLink) dom.generatedLink.value = lastGeneratedUrl;
    if (dom.btnCopy) dom.btnCopy.disabled = false;
    announce(encrypted ? 'Encrypted link generated.' : 'Link generated.');
  } catch (err) {
    lastGeneratedUrl = '';
    if (dom.generatedLink) dom.generatedLink.value = '';
    announce('The link could not be generated in this browser.');
  }
}

async function copyLink() {
  if (!lastGeneratedUrl) return;
  try {
    await navigator.clipboard.writeText(lastGeneratedUrl);
    announce('Link copied to the clipboard.');
  } catch (err) {
    if (dom.generatedLink) {
      dom.generatedLink.focus();
      dom.generatedLink.select();
    }
    announce('Automatic copying was blocked. The link is selected — copy it manually.');
  }
}

/* ============================================================================
 * 8. Ambient audio (procedural, created only after a user gesture)
 * ========================================================================== */

const audio = {
  ctx: null,
  master: null,
  nodes: [],
  muted: true,
  volume: 0.35,
  offered: false
};

function buildAudioGraph() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Brown-ish noise buffer, long enough that the loop is not audible.
  const seconds = 6;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.019 * white) / 1.019;
    data[i] = last * 3.2;
  }

  // Low swell band: slow filter sweep gives the rise and fall of water.
  const swell = ctx.createBufferSource();
  swell.buffer = buffer;
  swell.loop = true;
  const swellFilter = ctx.createBiquadFilter();
  swellFilter.type = 'lowpass';
  swellFilter.frequency.value = 420;
  swellFilter.Q.value = 0.7;
  const swellGain = ctx.createGain();
  swellGain.gain.value = 0.9;
  swell.connect(swellFilter).connect(swellGain).connect(master);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 240;
  lfo.connect(lfoGain).connect(swellFilter.frequency);

  // Crest hiss band: band-passed noise, gently modulated.
  const hiss = ctx.createBufferSource();
  hiss.buffer = buffer;
  hiss.loop = true;
  hiss.playbackRate.value = 1.37;
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'bandpass';
  hissFilter.frequency.value = 2400;
  hissFilter.Q.value = 0.55;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.16;
  hiss.connect(hissFilter).connect(hissGain).connect(master);

  const hissLfo = ctx.createOscillator();
  hissLfo.type = 'sine';
  hissLfo.frequency.value = 0.043;
  const hissLfoGain = ctx.createGain();
  hissLfoGain.gain.value = 0.09;
  hissLfo.connect(hissLfoGain).connect(hissGain.gain);

  swell.start();
  hiss.start();
  lfo.start();
  hissLfo.start();

  audio.ctx = ctx;
  audio.master = master;
  audio.nodes = [swell, hiss, lfo, hissLfo];
  return true;
}

function applyAudioGain() {
  if (!audio.ctx || !audio.master) return;
  const target = audio.muted ? 0 : audio.volume * 0.5;
  const now = audio.ctx.currentTime;
  audio.master.gain.cancelScheduledValues(now);
  audio.master.gain.setTargetAtTime(target, now, 0.6);
}

async function toggleMute() {
  audio.muted = !audio.muted;
  if (!audio.muted) {
    if (!audio.ctx && !buildAudioGraph()) {
      audio.muted = true;
      announce('Ambient sound is not available in this browser.');
      return;
    }
    try {
      if (audio.ctx.state === 'suspended') await audio.ctx.resume();
    } catch (err) {
      /* resume is best effort */
    }
  }
  applyAudioGain();
  if (dom.btnMute) {
    dom.btnMute.setAttribute('aria-pressed', audio.muted ? 'true' : 'false');
    dom.btnMute.title = audio.muted ? 'Sound is off' : 'Sound is on';
  }
  announce(audio.muted ? 'Ambient sound off.' : 'Ambient sound on.');
}

/* ============================================================================
 * 9. Scene state + uniforms
 * ========================================================================== */

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Mobile / capability probe — used for default quality, CSS hooks, and sea-life cost.
 * Combines UA, pointer, viewport, memory, and Save-Data (not width alone).
 */
function detectDevice() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 820px)').matches;
  const touchPoints = navigator.maxTouchPoints || 0;
  const ua = navigator.userAgent || '';
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const iPadOs = navigator.platform === 'MacIntel' && touchPoints > 1;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = !!(connection && connection.saveData);
  const slowNet = !!(connection && /2g/i.test(connection.effectiveType || ''));
  const mem = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const mobile = !!(coarse || narrow || uaMobile || iPadOs);
  return {
    mobile,
    coarse,
    narrow,
    uaMobile,
    iPadOs,
    touchPoints,
    saveData,
    slowNet,
    mem,
    cores,
    dpr,
    lowPower: mobile || saveData || slowNet || cores <= 4 || (mem != null && mem <= 4)
  };
}

const device = detectDevice();
const isMobile = device.mobile;

try {
  document.documentElement.classList.toggle('is-mobile', device.mobile);
  document.documentElement.classList.toggle('is-coarse', device.coarse);
  document.documentElement.dataset.device = device.mobile ? 'mobile' : 'desktop';
} catch (_) { /* non-DOM host */ }

/** Graphics presets — Low targets phones / weak GPUs; High is the desktop look.
 *  Distance LOD (lodNear → lodFar) drops water detail away from the camera;
 *  sky / sun / moon stay at full quality. */
const QUALITY_PRESETS = {
  low: {
    segments: device.mobile ? 96 : 120,
    half: device.mobile ? 560 : 720,
    dprCap: 1,
    bloom: 0,
    antialias: false,
    skyW: 24,
    skyH: 14,
    fineNear: 6,
    fineFar: 42,
    lodNear: 8,
    lodMid: 36,
    lodFar: 110,
    ampFadeStart: 70,
    ampFadeEnd: 300,
    microScale: 0.22,
    cloudLod: 0,
    foamDetail: 0,
    lens: false,
    lensMul: 0,
    hullSamples: 3,
    seaLife: 'minimal',
    proceduralWhale: false
  },
  medium: {
    segments: device.mobile ? 140 : 240,
    half: device.mobile ? 700 : 920,
    dprCap: device.mobile ? 1.15 : 1.35,
    bloom: device.mobile ? 0.06 : 0.12,
    antialias: !device.mobile,
    skyW: device.mobile ? 36 : 48,
    skyH: device.mobile ? 20 : 28,
    fineNear: device.mobile ? 10 : 14,
    fineFar: device.mobile ? 70 : 110,
    lodNear: device.mobile ? 12 : 16,
    lodMid: device.mobile ? 50 : 70,
    lodFar: device.mobile ? 160 : 220,
    ampFadeStart: device.mobile ? 100 : 140,
    ampFadeEnd: device.mobile ? 400 : 520,
    microScale: device.mobile ? 0.45 : 0.7,
    // Volume raymarch only on High — Medium uses cheap sky wisps.
    cloudLod: 0,
    foamDetail: device.mobile ? 0 : 1,
    lens: !device.mobile,
    lensMul: device.mobile ? 0 : 0.55,
    hullSamples: device.mobile ? 3 : 5,
    seaLife: device.mobile ? 'light' : 'full',
    proceduralWhale: !device.mobile
  },
  high: {
    // On phones, “High” is capped — still looks rich, but avoids thermal throttle.
    segments: device.mobile ? 180 : 360,
    half: device.mobile ? 780 : 1000,
    dprCap: device.mobile ? 1.35 : 1.75,
    bloom: device.mobile ? 0.1 : 0.18,
    antialias: !device.mobile,
    skyW: device.mobile ? 48 : 64,
    skyH: device.mobile ? 28 : 40,
    fineNear: device.mobile ? 14 : 22,
    fineFar: device.mobile ? 110 : 200,
    lodNear: device.mobile ? 16 : 24,
    lodMid: device.mobile ? 65 : 95,
    lodFar: device.mobile ? 210 : 320,
    ampFadeStart: device.mobile ? 120 : 180,
    ampFadeEnd: device.mobile ? 480 : 640,
    microScale: device.mobile ? 0.65 : 1,
    cloudLod: 1,
    foamDetail: device.mobile ? 0 : 1,
    lens: !device.mobile,
    lensMul: device.mobile ? 0.35 : 1,
    hullSamples: device.mobile ? 4 : 7,
    seaLife: device.mobile ? 'light' : 'full',
    proceduralWhale: !device.mobile
  }
};

function detectDefaultQuality() {
  try {
    const saved = localStorage.getItem('miab-quality');
    if (saved && QUALITY_PRESETS[saved]) return saved;
  } catch (_) { /* private mode */ }

  if (device.lowPower || device.mobile) return 'low';
  if (device.cores <= 8 || (device.mem != null && device.mem <= 8)) return 'medium';
  return 'high';
}

function copyQualityPreset(level) {
  const preset = QUALITY_PRESETS[level] || QUALITY_PRESETS.medium;
  return {
    level: QUALITY_PRESETS[level] ? level : 'medium',
    segments: preset.segments,
    half: preset.half,
    dprCap: preset.dprCap,
    bloom: preset.bloom,
    antialias: preset.antialias,
    skyW: preset.skyW,
    skyH: preset.skyH,
    fineNear: preset.fineNear,
    fineFar: preset.fineFar,
    lodNear: preset.lodNear,
    lodMid: preset.lodMid,
    lodFar: preset.lodFar,
    ampFadeStart: preset.ampFadeStart,
    ampFadeEnd: preset.ampFadeEnd,
    microScale: preset.microScale,
    cloudLod: preset.cloudLod,
    foamDetail: preset.foamDetail,
    lens: preset.lens,
    lensMul: preset.lensMul,
    hullSamples: preset.hullSamples,
    seaLife: preset.seaLife,
    proceduralWhale: preset.proceduralWhale
  };
}

const quality = copyQualityPreset(detectDefaultQuality());

const params = {
  sea: 0.45,
  wind: 0.55,
  windDirDeg: 35,
  swell: 0.7,
  foam: 0.5,
  tod: 0.52,
  /** Compass bearing of the sun in degrees (independent of wind). */
  sunAzimuthDeg: 180,
  /** Compass bearing of the moon in degrees (independent of the sun). */
  moonAzimuthDeg: 330,
  /** Moon height above the horizon in degrees (−5 … 80). */
  moonElevationDeg: 42,
  /** 0 = new · 0.25 = first quarter · 0.5 = full · 0.75 = last quarter · 1 = new. */
  moonPhase: 0.5,
  // Slightly stronger default haze so sun/moon sit in the atmosphere.
  haze: 0.45,
  clouds: 0.5,
  exposure: 1,
  drift: true,
  seed: 4173,
  volume: 0.35,
  reduced: false,
  quality: quality.level
};

const derived = {
  seaAmp: 1,
  steep: 1,
  chopAmp: 0.2,
  capAmp: 0.012,
  glitter: 0.8,
  phaseSeed: 0,
  windVec: new THREE.Vector2(1, 0)
};

const U = {
  time: uniform(0),
  oceanOrigin: uniform(new THREE.Vector2(0, 0)),
  windDir: uniform(new THREE.Vector2(1, 0)),
  wind: uniform(0.55),
  swell: uniform(0.7),
  seaAmp: uniform(1),
  steep: uniform(1),
  chopAmp: uniform(0.2),
  capAmp: uniform(0.012),
  foam: uniform(0.5),
  glitter: uniform(0.8),
  phaseSeed: uniform(0),
  noiseSeed: uniform(0),
  haze: uniform(0.45),
  clouds: uniform(0.4),
  cloudScale: uniform(0.55),
  sunDir: uniform(new THREE.Vector3(0.4, 0.35, -0.85)),
  sunColor: uniform(new THREE.Color(1, 0.94, 0.84)),
  sunIntensity: uniform(1),
  zenith: uniform(new THREE.Color(0.16, 0.34, 0.6)),
  horizon: uniform(new THREE.Color(0.62, 0.72, 0.82)),
  hazeColor: uniform(new THREE.Color(0.62, 0.7, 0.78)),
  cloudLit: uniform(new THREE.Color(0.96, 0.95, 0.93)),
  cloudShadow: uniform(new THREE.Color(0.42, 0.47, 0.55)),
  waterDeep: uniform(new THREE.Color(0.012, 0.048, 0.075)),
  waterShallow: uniform(new THREE.Color(0.045, 0.135, 0.16)),
  scatter: uniform(new THREE.Color(0.10, 0.30, 0.29)),
  glassRim: uniform(new THREE.Color(0.5, 0.62, 0.7)),
  corkA: uniform(new THREE.Color(0xc9a978)),
  corkB: uniform(new THREE.Color(0x9c7e51)),
  paperA: uniform(new THREE.Color(0xe9dcc0)),
  paperB: uniform(new THREE.Color(0xc7b190)),
  wakeCenter: uniform(new THREE.Vector2(0, 0)),
  wakeStrength: uniform(0),
  wakePhase: uniform(0),
  bottleVel: uniform(new THREE.Vector2(0, 0)),
  bottleRadius: uniform(0.085),
  contactStrength: uniform(1),
  camSubmerge: uniform(0),
  waterAtCam: uniform(0),
  underTint: uniform(new THREE.Color(0.02, 0.12, 0.16)),
  messageDim: uniform(0),
  waveScale: uniform(AMP_SUM),
  fineNear: uniform(quality.fineNear),
  fineFar: uniform(quality.fineFar),
  /** Distance LOD bands (metres from camera): full → mid → far swell-only. */
  lodNear: uniform(quality.lodNear),
  lodMid: uniform(quality.lodMid),
  lodFar: uniform(quality.lodFar),
  ampFadeStart: uniform(quality.ampFadeStart),
  ampFadeEnd: uniform(quality.ampFadeEnd),
  cloudLod: uniform(quality.cloudLod),
  foamDetail: uniform(quality.foamDetail),
  /** Origin of the high-res patch under the bottle (world XZ). */
  patchOrigin: uniform(new THREE.Vector2(0, 0)),
  /** Circle radius of the local patch (metres). */
  patchRadius: uniform(0.3),
  night: uniform(0),
  moonDir: uniform(new THREE.Vector3(-0.4, 0.55, 0.7)),
  moonAmount: uniform(0),
  moonPhase: uniform(0.5),
  starAmount: uniform(0)
};

/** Scratch colors / vectors for syncSun — avoid per-frame allocations while dragging. */
const _sunScratch = {
  dir: new THREE.Vector3(),
  zen: new THREE.Color(),
  hor: new THREE.Color(),
  sun: new THREE.Color(),
  c0: new THREE.Color(),
  c1: new THREE.Color(),
  c2: new THREE.Color(),
  c3: new THREE.Color(),
  c4: new THREE.Color()
};

/** Recomputes derived quantities and pushes everything to the GPU. */
function syncParams() {
  derived.seaAmp = 0.35 + params.sea * 1.25;
  derived.steep = 0.55 + params.sea * 0.75;
  // Stronger wind chop / capillary than before — fragment normals only.
  derived.chopAmp = 0.07 + params.wind * 0.38;
  derived.capAmp = 0.006 + params.wind * 0.028;
  derived.glitter = 0.55 + params.wind * 0.6;
  derived.phaseSeed = (params.seed % 1000) * 0.0173;
  const rad = params.windDirDeg * DEG;
  derived.windVec.set(Math.cos(rad), Math.sin(rad));

  if (params.reduced) {
    derived.seaAmp *= 0.55;
    derived.steep *= 0.75;
    derived.chopAmp *= 0.5;
    derived.capAmp *= 0.4;
    derived.glitter *= 0.35;
  }

  U.windDir.value.copy(derived.windVec);
  U.wind.value = params.wind;
  U.swell.value = params.swell;
  U.seaAmp.value = derived.seaAmp;
  U.steep.value = derived.steep;
  U.chopAmp.value = derived.chopAmp * quality.microScale;
  U.capAmp.value = derived.capAmp * quality.microScale;
  U.foam.value = params.foam;
  U.phaseSeed.value = derived.phaseSeed;
  U.noiseSeed.value = (params.seed % 997) * 1.7137;
  U.haze.value = params.haze;
  U.clouds.value = params.clouds;
  U.waveScale.value = Math.max(0.05, AMP_SUM * params.swell * derived.seaAmp);
  U.fineNear.value = quality.fineNear;
  U.fineFar.value = quality.fineFar;
  U.lodNear.value = quality.lodNear;
  U.lodMid.value = quality.lodMid;
  U.lodFar.value = quality.lodFar;
  U.ampFadeStart.value = quality.ampFadeStart;
  U.ampFadeEnd.value = quality.ampFadeEnd;
  U.cloudLod.value = quality.cloudLod;
  U.foamDetail.value = quality.foamDetail;
  U.moonPhase.value = clampNum(params.moonPhase, 0, 1);

  syncSun();
  if (renderer) renderer.toneMappingExposure = params.exposure;
  if (bloomPass) bloomPass.strength.value = params.reduced ? 0.0 : quality.bloom;
}

/** Human-readable phase for the TOD slider (full night↔day↔night cycle). */
function todPhaseLabel(t) {
  const x = ((t % 1) + 1) % 1;
  if (x < 0.12 || x >= 0.88) return 'Night';
  if (x < 0.28) return 'Dawn';
  if (x < 0.42) return 'Morning';
  if (x < 0.58) return 'Noon';
  if (x < 0.72) return 'Afternoon';
  return 'Dusk';
}

/** Human-readable moon phase for the phase slider (0 = new … 0.5 = full … 1 = new). */
function moonPhaseLabel(p) {
  const x = ((p % 1) + 1) % 1;
  if (x < 0.06 || x >= 0.94) return 'New';
  if (x < 0.19) return 'Waxing crescent';
  if (x < 0.31) return 'First quarter';
  if (x < 0.44) return 'Waxing gibbous';
  if (x < 0.56) return 'Full';
  if (x < 0.69) return 'Waning gibbous';
  if (x < 0.81) return 'Last quarter';
  return 'Waning crescent';
}

/**
 * Time of day drives sun elevation and the atmospheric palette.
 * Bearing of sun/moon is independent (see params.sunAzimuthDeg / moonAzimuthDeg).
 *
 * Cycle: 0 = midnight · 0.25 = dawn · 0.5 = noon · 0.75 = dusk · 1 = midnight
 * Palette tuned for open-sea Rayleigh/Mie/ozone cues (no full atmosphere integrator).
 */
function syncSun() {
  const t = params.tod;
  const elevation = Math.sin((t - 0.25) * Math.PI * 2);
  const azimuth = params.sunAzimuthDeg * DEG;
  const elevClamped = clampNum(elevation, -1, 1);
  const horiz = Math.max(0.02, Math.cos(Math.asin(elevClamped)));
  const dir = _sunScratch.dir
    .set(Math.cos(azimuth) * horiz, elevClamped, Math.sin(azimuth) * horiz)
    .normalize();
  U.sunDir.value.copy(dir);

  const day = clampNum((elevation + 0.02) / 0.55, 0, 1);
  const low = Math.exp(-((elevation - 0.06) * (elevation - 0.06)) / (0.085 * 0.085));
  const dusk = clampNum(low * (0.75 + (1 - day) * 0.35), 0, 1);
  const night = clampNum(1 - clampNum((elevation + 0.18) / 0.32, 0, 1), 0, 1);
  const civil = clampNum(1 - Math.abs(elevation) / 0.22, 0, 1);

  U.night.value = night;
  U.starAmount.value = Math.pow(night, 1.15);
  U.moonAmount.value = clampNum(night * 1.25 - 0.01, 0, 1);

  const moonElev = Math.sin(clampNum(params.moonElevationDeg, -5, 80) * DEG);
  const moonAz = params.moonAzimuthDeg * DEG;
  const moonHoriz = Math.max(0.02, Math.cos(Math.asin(clampNum(moonElev, -1, 1))));
  U.moonDir.value.set(
    Math.cos(moonAz) * moonHoriz,
    clampNum(moonElev, -1, 1),
    Math.sin(moonAz) * moonHoriz
  ).normalize();

  const S = _sunScratch;
  // Zenith: day blue → ozone indigo/violet at twilight → deep night.
  S.zen
    .set(0.002, 0.004, 0.02)
    .lerp(S.c0.set(0.04, 0.08, 0.28), civil * (1 - day) * 0.55)
    .lerp(S.c1.set(0.05, 0.26, 0.7), day)
    .lerp(S.c2.set(0.16, 0.05, 0.32), dusk * 0.7)
    .lerp(S.c3.set(0.1, 0.04, 0.22), dusk * night * 0.85);
  // Horizon: clean amber → vermillion → magenta, then cool night band.
  S.hor
    .set(0.01, 0.016, 0.04)
    .lerp(S.c0.set(0.34, 0.54, 0.84), day * (1 - dusk * 0.75))
    .lerp(S.c1.set(1.0, 0.68, 0.28), dusk * 0.5)
    .lerp(S.c2.set(1.0, 0.38, 0.1), dusk * 0.85)
    .lerp(S.c3.set(0.78, 0.18, 0.36), dusk * night * 1.15)
    .lerp(S.c4.set(0.07, 0.09, 0.2), night * 0.75);
  U.zenith.value.copy(S.zen);
  U.horizon.value.copy(S.hor);
  // Mie-warm haze near the sun at dusk; cooler horizontal band at night.
  U.hazeColor.value
    .copy(S.hor)
    .lerp(S.c0.set(1.0, 0.62, 0.28), dusk * 0.7)
    .lerp(S.c1.set(0.95, 0.78, 0.55), dusk * (1 - night) * 0.35)
    .lerp(S.c2.set(0.12, 0.16, 0.26), night * 0.6)
    .lerp(S.zen, 0.08);

  S.sun
    .set(0.35, 0.45, 0.85)
    .lerp(S.c0.set(1.0, 0.97, 0.9), day)
    .lerp(S.c1.set(1.0, 0.78, 0.32), dusk * 0.55)
    .lerp(S.c2.set(1.0, 0.42, 0.08), dusk * 0.95);
  U.sunColor.value.copy(S.sun);
  U.sunIntensity.value = 0.04 + day * 1.35 + dusk * 1.05;

  // Daytime clouds stay near-white; shadows are cool sky-blue (not charcoal).
  U.cloudLit.value
    .copy(S.c0.set(0.18, 0.2, 0.28).lerp(S.c1.set(1.0, 0.98, 0.96), day))
    .lerp(S.c2.set(1.0, 0.84, 0.55), dusk * 0.85)
    .lerp(S.c3.set(1.0, 0.58, 0.28), dusk * 0.55)
    .lerp(S.c4.set(0.38, 0.42, 0.58), night * 0.85);
  U.cloudShadow.value
    .copy(S.c0.set(0.04, 0.05, 0.08).lerp(S.c1.set(0.42, 0.48, 0.58), day))
    .lerp(S.c2.set(0.28, 0.12, 0.14), dusk * 0.75)
    .lerp(S.c3.set(0.12, 0.05, 0.14), dusk * night * 0.9)
    .lerp(S.c4.set(0.05, 0.06, 0.12), night * 0.9);

  // Sea: deep stays cool; shallows/scatter pick up warm horizon light at dusk.
  U.waterDeep.value
    .copy(S.c0.set(0.001, 0.01, 0.038).lerp(S.c1.set(0.002, 0.032, 0.09), day))
    .lerp(S.c2.set(0.035, 0.018, 0.05), dusk * 0.4)
    .lerp(S.c3.set(0.008, 0.018, 0.048), night * 0.75);
  U.waterShallow.value
    .copy(S.c0.set(0.006, 0.03, 0.05).lerp(S.c1.set(0.018, 0.11, 0.13), day))
    .lerp(S.c2.set(0.48, 0.2, 0.06), dusk * 0.85)
    .lerp(S.c3.set(0.035, 0.06, 0.11), night * 0.55);
  U.scatter.value
    .copy(S.c0.set(0.005, 0.03, 0.04).lerp(S.c1.set(0.05, 0.24, 0.22), day))
    .lerp(S.c2.set(0.78, 0.32, 0.07), dusk * 0.95)
    .lerp(S.c3.set(0.07, 0.11, 0.2), night * 0.45);
  U.underTint.value
    .copy(S.c0.set(0.004, 0.03, 0.055).lerp(S.c1.set(0.01, 0.09, 0.12), day))
    .lerp(S.c2.set(0.03, 0.04, 0.08), night);
  U.glassRim.value.copy(S.hor).multiplyScalar(0.85);

  const phase = clampNum(params.moonPhase, 0, 1);
  // Illuminated fraction ≈ (1 − cos(2π·phase)) / 2, peaking at full (0.5).
  const illum = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);

  if (sunLight) {
    sunLight.position.copy(dir).multiplyScalar(60);
    sunLight.color.copy(S.sun);
    sunLight.intensity = (0.15 + day * 2.5 + dusk * 0.85) * (1 - night * 0.95);
    sunLight.visible = night < 0.96;
  }
  if (hemiLight) {
    hemiLight.color.copy(S.hor);
    hemiLight.groundColor.copy(U.waterShallow.value);
    hemiLight.intensity = 0.12 + day * 0.95 + dusk * 0.25 + night * 0.08;
  }
  if (moonLight) {
    moonLight.position.copy(U.moonDir.value).multiplyScalar(55);
    const moonLit = Math.max(U.moonAmount.value, moonElev > 0.02 ? 0.12 * (1 - day * 0.7) : 0);
    moonLight.intensity = (0.06 + moonLit * 0.5) * (0.2 + illum * 0.9);
    moonLight.visible = moonElev > -0.02 && (U.moonAmount.value > 0.04 || moonLit > 0.05) && illum > 0.04;
  }
  if (moonMesh) moonMesh.visible = false;
}

/* ============================================================================
 * 10. TSL: procedural sky
 * ========================================================================== */

/** Rotates a vec2 by a fixed angle and scales it — used to decorrelate octaves. */
function rot2(v, c, s, scale) {
  return vec2(v.x.mul(c).sub(v.y.mul(s)), v.x.mul(s).add(v.y.mul(c))).mul(scale);
}

/**
 * Moon albedo lives IN the sky shader (behind haze + clouds). A separate
 * foreground mesh was drawing on top of the atmosphere — that looked pasted-on.
 * NASA LROC texture is swapped into this same Three.Texture at boot.
 */
const MOON_TEX_URL = new URL('./textures/moon-lroc-2k.jpg', import.meta.url).href;
const moonSkyTexture = (() => {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 4;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#b8b2a6';
  ctx.fillRect(0, 0, 8, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
})();
// Kept so the texture node graph stays referenced even if sample UVs vary.
const moonMapNode = texture(moonSkyTexture);

/** Shared sky radiance: used by the sky sphere and by the ocean reflection. */
const skyRadiance = Fn(([dirIn]) => {
  const dir = normalize(vec3(dirIn)).toVar();
  const up = dir.y.max(0.0).toVar();

  // Horizon-camera remap: night stretches a wider low band so haze reads natural.
  const elev = saturate(up.mul(mix(float(2.4), float(1.55), U.night)));
  const grad = pow(oneMinus(elev), mix(float(1.85), float(1.28), U.night));
  const col = mix(U.zenith, U.horizon, grad).toVar();

  // Soften anything below the horizon so grazing reflections stay plausible.
  col.assign(mix(col, U.horizon.mul(0.45), saturate(dir.y.negate().mul(5.0))));

  // --- stars FIRST (behind sun/moon glow, behind clouds/haze) --------------
  If(U.starAmount.greaterThan(0.01), () => {
    const upGate = smoothstep(float(-0.05), float(0.12), up).toVar();
    const sp = dir.mul(260.0).toVar();
    const n1 = mx_noise_float(sp).mul(0.5).add(0.5);
    const n2 = mx_noise_float(sp.mul(2.15).add(17.3)).mul(0.5).add(0.5);
    const n3 = mx_noise_float(sp.mul(4.4).add(41.7)).mul(0.5).add(0.5);
    // Dense field — thresholds kept gentle so night actually sparkles.
    const field = pow(smoothstep(float(0.62), float(0.985), n1), float(4.0))
      .mul(smoothstep(float(0.28), float(0.9), n2));
    const bright = pow(smoothstep(float(0.82), float(0.996), n2), float(8.0))
      .mul(smoothstep(float(0.4), float(1.0), n3));
    const twinkle = mx_noise_float(vec3(dir.mul(70.0).add(U.time.mul(0.04)))).mul(0.5).add(0.5);
    const amp = U.starAmount.mul(upGate).mul(mix(float(0.75), float(1.0), twinkle));
    col.addAssign(vec3(0.78, 0.84, 1.0).mul(field.mul(amp).mul(1.9)));
    col.addAssign(vec3(0.95, 0.97, 1.0).mul(bright.mul(amp).mul(4.0)));
    const warm = pow(smoothstep(float(0.92), float(0.998), n3), float(12.0)).mul(amp);
    col.addAssign(vec3(1.0, 0.84, 0.65).mul(warm.mul(1.6)));

    const galAxis = normalize(vec3(0.35, 0.55, 0.76));
    const gal = oneMinus(abs(dot(dir, galAxis)));
    const mw = pow(smoothstep(float(0.78), float(0.995), gal), float(2.0));
    const dust = mx_noise_float(dir.mul(28.0).add(vec3(2.1, 0.4, 5.5))).mul(0.5).add(0.5);
    col.addAssign(vec3(0.55, 0.62, 0.85).mul(mw.mul(dust).mul(U.starAmount).mul(upGate).mul(0.22)));
  });

  // --- sun disc + atmospheric Mie (sits IN the haze, not on top) -----------
  const sd = saturate(dot(dir, U.sunDir)).toVar();
  const disc = pow(sd, 900.0).mul(8.0);
  const glow = pow(sd, 7.0).mul(0.55).add(pow(sd, 2.2).mul(0.14));
  const lowSun = oneMinus(saturate(U.sunDir.y.mul(4.0).add(0.15)));
  const corona = pow(sd, 2.8).mul(lowSun).mul(0.55);
  // Stronger low-sun Mie so dusk glows whitish-amber around the disc (aerosol cue).
  const mie = pow(sd, float(4.5)).mul(U.haze.add(0.28)).mul(0.42)
    .add(pow(sd, float(1.5)).mul(U.haze.add(0.12)).mul(0.26));
  const sunVis = oneMinus(U.night.mul(0.92));
  col.addAssign(U.sunColor.mul(disc.add(glow).add(corona).add(mie).mul(U.sunIntensity).mul(sunVis)));

  // --- textured moon disc (NASA albedo) BEFORE clouds/haze ---------------
  // Soft limb + atmospheric aureole; phase from U.moonPhase terminator lighting.
  If(U.moonDir.y.greaterThan(float(-0.05)), () => {
    // ~1.6° cinematic radius (readable texture; real Moon ≈ 0.5°).
    const moonAng = float(0.028);
    const mdir = normalize(U.moonDir).toVar();
    const help = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), step(float(0.92), abs(mdir.y))).toVar();
    const right = normalize(cross(help, mdir)).toVar();
    const mup = cross(mdir, right).toVar();
    const lx = dot(dir, right).div(moonAng).toVar();
    const ly = dot(dir, mup).div(moonAng).toVar();
    const rr = lx.mul(lx).add(ly.mul(ly)).toVar();
    const rad = sqrt(rr).toVar();
    const md = saturate(dot(dir, mdir)).toVar();

    // Broad soft Mie-like glow (no radial hard cut — that made the grey disc).
    const aureoleCore = pow(md, float(140.0)).mul(0.055);
    const aureoleSoft = pow(md, float(28.0)).mul(0.028);
    const aureoleWide = pow(md, float(8.0)).mul(0.012);
    const limbGate = smoothstep(float(0.72), float(1.08), rad);
    const aureole = aureoleCore.add(aureoleSoft).add(aureoleWide)
      .mul(U.moonAmount)
      .mul(limbGate)
      .mul(smoothstep(float(-0.04), float(0.08), U.moonDir.y));
    col.addAssign(vec3(0.62, 0.68, 0.82).mul(aureole));

    // Soft circular mask; skip texture work far outside the limb.
    If(rr.lessThan(float(1.25)), () => {
      const discMask = oneMinus(smoothstep(float(0.86), float(1.0), rad)).toVar();

      If(discMask.greaterThan(0.002), () => {
        const mu = lx.mul(0.46).add(0.5);
        const mv = ly.mul(-0.46).add(0.5);
        const albedo = moonMapNode.sample(vec2(mu, mv)).rgb.toVar();

        // Hemisphere normal in world space (center faces Earth along −mdir in view terms).
        const lz = sqrt(max(float(0.001), float(1.0).sub(min(rr, float(1.0))))).toVar();
        const nMoon = normalize(right.mul(lx).add(mup.mul(ly)).add(mdir.mul(lz))).toVar();

        // Phase light: 0.5 = full (lit toward Earth), 0/1 = new (lit away).
        // Angle = (phase − 0.5) · 2π in the moon disc plane.
        const phaseAng = U.moonPhase.sub(0.5).mul(6.2831853).toVar();
        const phaseLight = normalize(
          mdir.mul(cos(phaseAng)).add(right.mul(sin(phaseAng)))
        ).toVar();
        const phaseLit = saturate(dot(nMoon, phaseLight)).toVar();
        const sunLit = saturate(dot(nMoon, U.sunDir));
        // Day: real sun terminator. Night / twilight: artist phase control.
        const litRaw = mix(sunLit, phaseLit, saturate(U.night.mul(1.35).add(0.15))).toVar();
        const lit = smoothstep(float(-0.02), float(0.22), litRaw).toVar();
        // Earthshine on the dark limb near new moon (|phase−0.5| → 1).
        const nearNew = abs(U.moonPhase.sub(0.5)).mul(2.0);
        const shine = oneMinus(lit).mul(0.09).mul(nearNew);
        const gain = mix(float(0.55), float(1.15), U.moonAmount).toVar();
        const moonCol = albedo
          .mul(float(0.14).add(lit).add(shine))
          .mul(gain)
          .toVar();

        col.assign(mix(col, moonCol, discMask));
      });
    });
  });

  // --- sky-dome wisps (CHEAP) — heavy volume is the RaymarchingBox slab ----
  // Previous densAt3D × 8 × 5 sun probes destroyed FPS (esp. ocean reflections).
  const drift = U.time.mul(0.012);
  const wind2 = vec2(U.windDir.x.mul(drift), U.windDir.y.mul(drift));
  const seed2 = vec2(U.noiseSeed.mul(0.11), U.noiseSeed.mul(0.17));
  const cloudUV = dir.xz.div(max(up.add(0.18), float(0.18)))
    .mul(U.cloudScale.mul(1.4))
    .add(wind2)
    .add(seed2)
    .toVar();
  const nA = mx_noise_float(vec3(cloudUV.x, cloudUV.y, U.noiseSeed.mul(0.02))).mul(0.5).add(0.5);
  const nB = mx_noise_float(vec3(cloudUV.mul(2.1).add(vec2(3.1, 7.7)), U.time.mul(0.01))).mul(0.5).add(0.5);
  const skyNoise = saturate(nA.mul(0.7).add(nB.mul(0.3)));
  const skyCut = float(0.55).sub(saturate(U.clouds).mul(0.22));
  const skyCover = smoothstep(skyCut, skyCut.add(0.18), skyNoise)
    .mul(smoothstep(float(0.06), float(0.2), up))
    .mul(oneMinus(smoothstep(float(0.82), float(0.98), up)))
    .mul(saturate(U.clouds.mul(0.55)))
    .toVar();
  const skyShade = saturate(skyNoise.mul(0.5).add(up.mul(0.4)).add(0.2));
  const skyCloudCol = mix(U.cloudShadow, U.cloudLit, skyShade).toVar();
  skyCloudCol.assign(mix(skyCloudCol, U.hazeColor, float(0.2)));
  col.assign(mix(col, skyCloudCol, skyCover.mul(0.55)));

  const hazeHorizon = pow(oneMinus(up), float(2.55)).mul(U.haze).mul(mix(float(0.72), float(1.12), U.night));
  const hazeBandAmt = pow(oneMinus(up), float(1.25)).mul(U.haze).mul(mix(float(0.16), float(0.48), U.night));
  const hazeZenith = U.haze.mul(mix(float(0.10), float(0.055), U.night));
  const hazeAmt = saturate(hazeHorizon.add(hazeBandAmt).add(hazeZenith)).toVar();
  col.assign(mix(col, U.hazeColor, hazeAmt.mul(oneMinus(skyCover.mul(0.5)))));

  return col;
});


/* ============================================================================
 * 11. TSL: ocean
 * ========================================================================== */

/**
 * Gerstner displacement, unrolled over the five waves.
 * Returns vec3( dx, height, dz ) in world units.
 * `ampFade` tapers amplitude towards the far edge of the grid to kill aliasing.
 * `waveLod` (1 near → 0 far) fades short/mid waves — same pattern used by
 * production ocean shaders so distant water stays swell-only and cheap.
 */
const gerstnerDisplace = Fn(([xzIn, ampFadeIn, waveLodIn]) => {
  const xz = vec2(xzIn);
  const ampFade = float(ampFadeIn);
  const waveLod = float(waveLodIn);
  const wc = U.windDir.x;
  const ws = U.windDir.y;

  const dx = float(0).toVar();
  const dy = float(0).toVar();
  const dz = float(0).toVar();

  for (let i = 0; i < NW; i++) {
    const w = WAVES[i];
    const k = WAVE_K[i];
    const bd = WAVE_DIR[i];
    // Long swell (0–1) always on; mid (2) soft-fades; short (3–4) hard-fades.
    const lodWeight = i <= 1
      ? 1.0
      : i === 2
        ? 0.35
        : 0.0;

    const ddx = float(bd[0]).mul(wc).sub(float(bd[1]).mul(ws));
    const ddz = float(bd[0]).mul(ws).add(float(bd[1]).mul(wc));
    const lodAmp = mix(float(lodWeight), float(1.0), waveLod);
    const amp = float(w.amplitude).mul(U.swell).mul(U.seaAmp).mul(ampFade).mul(lodAmp);
    const qa = float(w.steepness / (k * NW)).mul(U.steep).mul(lodAmp);
    const phase = U.phaseSeed.mul(PHASE_K[i]).add(w.phase);
    const theta = xz.x.mul(ddx).add(xz.y.mul(ddz)).mul(k).sub(U.time.mul(WAVE_OMEGA[i])).add(phase);

    dx.addAssign(qa.mul(ddx).mul(theta.cos()));
    dy.addAssign(amp.mul(theta.sin()));
    dz.addAssign(qa.mul(ddz).mul(theta.cos()));
  }

  return vec3(dx, dy, dz);
});

/**
 * Analytic Gerstner surface derivatives.
 * Returns vec4( slopeX, slopeZ, jacobian, height ).
 * The Jacobian of the horizontal displacement drives crest foam: it collapses
 * towards zero exactly where the surface pinches.
 * `waveLod` matches `gerstnerDisplace` so normals track faded far-field swell.
 */
const gerstnerSlope = Fn(([xzIn, waveLodIn]) => {
  const xz = vec2(xzIn);
  const waveLod = float(waveLodIn);
  const wc = U.windDir.x;
  const ws = U.windDir.y;

  const sxx = float(0).toVar();
  const szz = float(0).toVar();
  const sxz = float(0).toVar();
  const hx = float(0).toVar();
  const hz = float(0).toVar();
  const height = float(0).toVar();

  for (let i = 0; i < NW; i++) {
    const w = WAVES[i];
    const k = WAVE_K[i];
    const bd = WAVE_DIR[i];
    const lodWeight = i <= 1
      ? 1.0
      : i === 2
        ? 0.35
        : 0.0;

    const ddx = float(bd[0]).mul(wc).sub(float(bd[1]).mul(ws));
    const ddz = float(bd[0]).mul(ws).add(float(bd[1]).mul(wc));
    const lodAmp = mix(float(lodWeight), float(1.0), waveLod);
    const amp = float(w.amplitude).mul(U.swell).mul(U.seaAmp).mul(lodAmp);
    const qak = float(w.steepness / NW).mul(U.steep).mul(lodAmp);
    const phase = U.phaseSeed.mul(PHASE_K[i]).add(w.phase);
    const theta = xz.x.mul(ddx).add(xz.y.mul(ddz)).mul(k).sub(U.time.mul(WAVE_OMEGA[i])).add(phase);
    const sn = theta.sin().toVar();
    const cs = theta.cos().toVar();
    const ak = amp.mul(k);

    sxx.addAssign(qak.mul(ddx).mul(ddx).mul(sn));
    szz.addAssign(qak.mul(ddz).mul(ddz).mul(sn));
    sxz.addAssign(qak.mul(ddx).mul(ddz).mul(sn));
    hx.addAssign(ak.mul(ddx).mul(cs));
    hz.addAssign(ak.mul(ddz).mul(cs));
    height.addAssign(amp.mul(sn));
  }

  const a = oneMinus(sxx).toVar();
  const b = oneMinus(szz).toVar();
  const tangent = vec3(a, hx, sxz.negate());
  const binormal = vec3(sxz.negate(), hz, b);
  const n = normalize(cross(binormal, tangent)).toVar();
  const ny = n.y.max(0.02);

  return vec4(n.x.div(ny).negate(), n.z.div(ny).negate(), a.mul(b).sub(sxz.mul(sxz)), height);
});

/** Camera-distance LOD factor: 1 near the camera, 0 beyond lodFar. */
const oceanWaveLod = Fn(([distIn]) => {
  const dist = float(distIn);
  // Two-step ramp: hold full detail to lodNear, ease through lodMid, swell-only past lodFar.
  const mid = oneMinus(smoothstep(U.lodNear, U.lodMid, dist));
  const far = oneMinus(smoothstep(U.lodMid, U.lodFar, dist));
  return mid.mul(0.55).add(far.mul(0.45));
});

/** Grid-edge amplitude taper (aliasing control), driven by quality uniforms. */
const oceanAmpFade = Fn(([distIn]) => {
  return mix(float(1.0), float(0.32), smoothstep(U.ampFadeStart, U.ampFadeEnd, float(distIn)));
});

/** Domain-warped FBM wind chop: three rotated octaves with independent offsets. */
const chopField = Fn(([xzIn]) => {
  const p = vec2(xzIn).mul(0.085).add(U.noiseSeed).toVar();

  const w1 = mx_noise_float(vec3(p.mul(0.5), U.time.mul(0.05)));
  const w2 = mx_noise_float(vec3(p.mul(0.5).add(vec2(19.73, 4.31)), U.time.mul(0.05).add(7.13)));
  p.addAssign(vec2(w1, w2).mul(1.7));

  const acc = float(0).toVar();
  const amp = float(1).toVar();
  const q = p.toVar();

  Loop({ start: 0, end: 3 }, ({ i }) => {
    const fi = float(i);
    const off = vec2(fi.mul(21.37).sin(), fi.mul(13.91).cos()).mul(53.0);
    acc.addAssign(mx_noise_float(vec3(q.add(off), U.time.mul(0.55).add(fi.mul(5.31)))).mul(amp));
    q.assign(rot2(q, 0.866025, 0.5, 2.13));
    amp.mulAssign(0.52);
  });

  return acc.mul(0.52);
});

/** Fast capillary ripple layer, independently warped and rotated. */
const capillaryField = Fn(([xzIn]) => {
  const q = vec2(xzIn).mul(0.9).add(U.noiseSeed.mul(0.37)).toVar();
  const warp = mx_noise_float(vec3(q.mul(0.35), U.time.mul(0.4)));
  q.addAssign(warp.mul(0.8));

  const acc = float(0).toVar();
  const amp = float(1).toVar();

  Loop({ start: 0, end: 2 }, ({ i }) => {
    const fi = float(i);
    const off = vec2(fi.mul(7.13).cos(), fi.mul(5.77).sin()).mul(31.0);
    acc.addAssign(mx_noise_float(vec3(q.add(off), U.time.mul(1.9).add(fi.mul(3.71)))).mul(amp));
    q.assign(rot2(q, 0.6, 0.8, 2.31));
    amp.mulAssign(0.5);
  });

  return acc.mul(0.66);
});

/**
 * Combined fine-scale height. Deliberately excluded from vertex displacement so
 * the CPU buoyancy sampler and the GPU surface agree exactly on wave height.
 */
const microHeight = Fn(([xzIn]) => {
  const xz = vec2(xzIn);
  return chopField(xz).mul(U.chopAmp).add(capillaryField(xz).mul(U.capAmp));
});

/**
 * Bottle contact — intentionally NOT a circular stamp.
 * ------------------------------------------------------------------
 * Earlier bug: rim/pile used length(xz − wakeCenter) vs bottleRadius, which
 * assumes an upright cylinder. Our bottle lies on its side, so that stamped a
 * perfect white foam/meniscus RING around a point (visible from above) with no
 * relation to the glass hull. Production oceans (Tidewater, WaterThreeJS) only
 * add soft directional wake foam from velocity, never a radial disc.
 *
 * Returns a tiny directional wake height only — no circular rim, no radial pile.
 */
const bottleContact = Fn(([xzIn]) => {
  const xz = vec2(xzIn);
  const to = xz.sub(U.wakeCenter).toVar();
  const d = length(to).max(0.001).toVar();
  const strength = U.contactStrength;
  const speed = length(U.bottleVel).toVar();
  // Gate: nearly-still bottle → zero (kills the static white circle).
  const moving = saturate(speed.mul(8.0)).toVar();

  const vdir = U.bottleVel.div(speed.max(0.0008)).toVar();
  const behind = saturate(dot(to.div(d), vdir.negate()));
  // Elongated trail only (not a ring): strong behind, none beside/ahead.
  const trail = behind
    .mul(smoothstep(0.02, 0.35, d))
    .mul(oneMinus(smoothstep(0.9, 2.4, d)))
    .mul(moving)
    .mul(strength)
    .toVar();

  const breakN = mx_noise_float(vec3(to.mul(3.2), U.time.mul(0.4)));
  const rip = sin(d.add(breakN.mul(0.05)).mul(14.0).sub(U.wakePhase.mul(4.5)))
    .mul(exp(d.mul(-1.4)))
    .mul(trail)
    .mul(0.006);

  return rip.mul(U.wakeStrength.mul(0.4).add(0.15));
});

const oceanPositionNode = Fn(() => {
  const local = positionLocal.toVar();
  const wxz = local.xz.add(U.oceanOrigin).toVar();
  const dist = length(wxz.sub(cameraPosition.xz));
  // Full Gerstner under/near the bottle so the visible mesh matches CPU seating
  // (sampleOcean is always full-amp). Far field still fades for aliasing.
  const dBot = length(wxz.sub(U.wakeCenter)).toVar();
  const nearBottle = oneMinus(smoothstep(float(2.5), float(9.0), dBot));
  const ampFade = mix(oceanAmpFade(dist), float(1.0), nearBottle);
  const waveLod = mix(oceanWaveLod(dist), float(1.0), nearBottle);
  const d = gerstnerDisplace(wxz, ampFade, waveLod).toVar();

  // Soft directional wake only (no circular contact mound).
  const contact = float(0).toVar();
  If(dBot.lessThan(2.6), () => {
    contact.assign(bottleContact(wxz));
  });

  return vec3(local.x.add(d.x), d.y.add(contact), local.z.add(d.z));
});

const oceanColorNode = Fn(() => {
  // Shading samples the wave field at the *displaced* world position rather
  // than the grid position the vertex stage used. The horizontal Gerstner
  // offset is small next to the feature size, so crest normals and foam land
  // where they should without needing a custom varying.
  const wxz = positionWorld.xz.toVar();
  const dist = length(wxz.sub(cameraPosition.xz)).toVar();
  const waveLod = oceanWaveLod(dist).toVar();
  const fineFade = oneMinus(smoothstep(U.fineNear, U.fineFar, dist)).mul(waveLod).toVar();
  // Mid band still wants soft foam / glitter; far band is almost flat swell.
  const shadeLod = oneMinus(smoothstep(U.lodMid, U.lodFar, dist)).toVar();

  // --- surface derivatives -------------------------------------------------
  const gj = gerstnerSlope(wxz, waveLod).toVar();
  const jac = gj.z.toVar();
  const height = gj.w.toVar();

  // Fine detail is only evaluated where it is actually visible. Beyond the
  // fade distance this skips roughly two dozen noise lookups per pixel, which
  // is most of the screen whenever the horizon is in view.
  const m0 = float(0).toVar();
  const microSlope = vec2(0.0).toVar();
  // Extra high-frequency noise for natural break-up (normals only — no vertex Y).
  const surfNoise = float(0).toVar();
  If(fineFade.greaterThan(0.004), () => {
    const eps = float(0.1);
    m0.assign(microHeight(wxz));
    const mx = microHeight(wxz.add(vec2(eps, 0.0)));
    const mz = microHeight(wxz.add(vec2(0.0, eps)));
    microSlope.assign(vec2(mx.sub(m0), mz.sub(m0)).div(eps).mul(fineFade).mul(1.25));
    surfNoise.assign(
      mx_noise_float(vec3(wxz.mul(2.4), U.time.mul(0.35)))
        .mul(0.5)
        .add(mx_noise_float(vec3(wxz.mul(7.1).add(3.7), U.time.mul(0.9))).mul(0.5))
        .mul(fineFade)
    );
    // Tiny analytic ripple on top of chop — kills plastic-smooth patches.
    microSlope.addAssign(vec2(surfNoise, surfNoise.mul(-0.65)).mul(0.045));
  });

  // Bottle contact slopes — directional wake only (no circular normal bump).
  const c0 = float(0).toVar();
  const cSlope = vec2(0.0).toVar();
  const dToBottle = length(wxz.sub(U.wakeCenter)).toVar();
  If(dToBottle.lessThan(2.6), () => {
    const cEps = float(0.05);
    c0.assign(bottleContact(wxz));
    cSlope.assign(vec2(
      bottleContact(wxz.add(vec2(cEps, 0.0))).sub(c0),
      bottleContact(wxz.add(vec2(0.0, cEps))).sub(c0)
    ).div(cEps));
  });

  const slope = gj.xy.add(microSlope).add(cSlope.mul(0.25)).toVar();
  const n = normalize(vec3(slope.x.negate(), 1.0, slope.y.negate())).toVar();

  // When the camera is looking at the underside, flip the normal.
  If(frontFacing.not(), () => {
    n.assign(n.negate());
  });

  // --- view / reflection ---------------------------------------------------
  const v = normalize(cameraPosition.sub(positionWorld)).toVar();
  const ndv = saturate(dot(n, v)).toVar();
  const fresnel = float(0.02).add(pow(oneMinus(ndv), 5.0).mul(0.88)).toVar();

  const r = reflect(v.negate(), n).toVar();
  // Near: full skyRadiance (sun / moon / stars / clouds). Far: cheap gradient —
  // horizon pixels dominate the screen and full sky sampling is wasted there.
  // The sky dome itself still draws at full quality behind the water.
  const skyRef = mix(U.horizon, U.zenith, saturate(r.y.mul(1.6).add(0.05))).toVar();
  If(shadeLod.greaterThan(0.12), () => {
    const fullSky = skyRadiance(vec3(r.x, r.y.abs().max(0.022), r.z));
    skyRef.assign(mix(skyRef, fullSky, saturate(shadeLod.mul(1.35))));
  });

  // --- water body: absorption with view depth, plus crest scatter ----------
  // Facing-down views read deep; grazing angles read shallow/cyan. Low sun
  // warms the shallows so dusk actually lands on the water, not only the sky.
  const lowSun = oneMinus(saturate(U.sunDir.y.mul(3.8).add(0.1)));
  const ndl = saturate(dot(n, U.sunDir));
  const depthMix = saturate(pow(ndv, 0.55).mul(0.7).add(saturate(n.y).mul(0.3)));
  const body = mix(U.waterShallow, U.waterDeep, depthMix).toVar();
  // Midday: deepen & cool the body so reflections don't milk it out.
  body.assign(mix(body, body.mul(vec3(0.78, 0.95, 1.15)).add(vec3(0.0, 0.01, 0.02)), oneMinus(lowSun).mul(0.45)));
  body.assign(mix(body, U.waterShallow.mul(vec3(1.25, 0.8, 0.42)).add(U.sunColor.mul(0.12)), lowSun.mul(0.55)));
  // Subtle body tint noise — breaks flat plastic patches without shifting mean color.
  body.addAssign(vec3(0.02, 0.035, 0.04).mul(surfNoise.mul(0.04).mul(fineFade)));
  const crest = saturate(height.div(U.waveScale).mul(1.35).add(0.42)).toVar();
  const backLit = saturate(dot(v.negate(), U.sunDir).mul(0.5).add(0.5));
  body.addAssign(U.scatter.mul(pow(crest, 2.2).mul(backLit).mul(1.2).add(0.07)));
  // Soft SSS-ish glow toward the sun on wave faces.
  body.addAssign(U.scatter.mul(ndl.mul(0.18).add(lowSun.mul(0.1))));

  // --- GGX-ish sun / moon glitter ------------------------------------------
  // Night: specular lobe follows the moon; day: the sun. Mix across dusk.
  // Fade glitter with distance — far sparkle just aliases into fireflies.
  const lightDir = normalize(mix(U.sunDir, U.moonDir, U.night)).toVar();
  const lightCol = mix(U.sunColor, vec3(0.72, 0.78, 0.92), U.night).toVar();
  const lightAmt = mix(U.sunIntensity, U.moonAmount.mul(1.15).add(0.08), U.night).toVar();
  const h = normalize(v.add(lightDir)).toVar();
  const ndh = saturate(dot(n, h)).toVar();
  // Wind + micro noise roughens the specular lobe so sparkle isn't uniform.
  const rough = mix(float(0.028), float(0.14), saturate(U.wind))
    .add(surfNoise.mul(0.018).mul(fineFade))
    .toVar();
  const a2 = rough.mul(rough).toVar();
  const denom = ndh.mul(ndh).mul(a2.sub(1.0)).add(1.0).toVar();
  const ggx = a2.div(denom.mul(denom).mul(3.14159265).max(0.0001));
  const ndlLite = saturate(dot(n, lightDir));
  const glitterMask = saturate(surfNoise.mul(0.55).add(0.72));
  const glitter = min(
    lightCol.mul(ggx.mul(ndlLite).mul(lightAmt).mul(U.glitter).mul(glitterMask).mul(mix(float(0.14), float(0.28), U.night.add(lowSun.mul(0.5)))).mul(mix(float(0.2), float(1.0), shadeLod))),
    vec3(7.0)
  ).toVar();

  // --- foam + whitecaps + bottle wake -------------------------------------
  // IMPORTANT: do not use `crest` here — it is biased (+0.42) for scatter and
  // would foam almost the entire wave face. Use raw relative height instead.
  const foamH = saturate(height.div(U.waveScale.max(0.05))).toVar();
  // Tight crest window — foam only on real tips, not the whole face.
  const foamCrest = pow(smoothstep(float(0.32), float(0.78), foamH), float(2.1));
  const foamJ = pow(oneMinus(smoothstep(float(0.38), float(0.78), jac)), float(2.2));
  const steepFace = saturate(length(gj.xy).mul(0.95));
  const lipFoam = steepFace.mul(foamCrest).mul(0.7);
  const windAmt = saturate(U.wind);
  const windFoam = foamCrest
    .mul(smoothstep(float(0.3), float(0.85), windAmt))
    .mul(0.65);

  // Advected multi-scale bubble / lace — higher UV freq = smaller patches vs bottle.
  const foamUv = wxz.mul(1.65)
    .sub(U.windDir.mul(U.time.mul(0.85)))
    .add(vec2(U.noiseSeed.mul(0.07), U.noiseSeed.mul(0.11)))
    .toVar();
  const fn1 = float(0.55).toVar();
  const fn2 = float(0.5).toVar();
  const fn3 = float(0.5).toVar();
  // Coarse sheet only while shadeLod is alive; fine lace only near camera.
  If(shadeLod.greaterThan(0.08), () => {
    fn1.assign(mx_noise_float(vec3(foamUv, U.time.mul(0.45))).mul(0.5).add(0.5));
    If(U.foamDetail.greaterThan(0.5), () => {
      If(fineFade.greaterThan(0.05), () => {
        fn2.assign(mx_noise_float(vec3(foamUv.mul(3.8).add(vec2(6.1, 2.7)), U.time.mul(1.2))).mul(0.5).add(0.5));
        fn3.assign(mx_noise_float(vec3(foamUv.mul(11.0).add(vec2(1.3, 8.4)), U.time.mul(2.0))).mul(0.5).add(0.5));
      });
    });
  });
  // Harder sheet cut + less sheet weight → smaller clumps, more lace/flecks.
  const foamSheets = smoothstep(float(0.52), float(0.86), fn1);
  const foamLace = smoothstep(float(0.48), float(0.86), fn2);
  const foamFleck = pow(smoothstep(float(0.55), float(0.9), fn3.add(surfNoise.mul(0.14))), float(2.0));
  const foamTex = saturate(
    foamSheets.mul(0.28)
      .add(foamLace.mul(0.48).mul(mix(float(0.4), float(1.0), U.foamDetail)).mul(fineFade.add(0.3)))
      .add(foamFleck.mul(0.42).mul(U.foamDetail).mul(fineFade))
  ).toVar();
  // Binary-ish presence so foam reads as clumps, not a milky wash.
  const foamBreak = smoothstep(float(0.34), float(0.68), foamTex).toVar();

  const breakup = saturate(
    m0.div(U.chopAmp.add(U.capAmp).max(0.001)).mul(0.35).add(0.65)
  );

  // --- bottle wake foam: directional trail only (NEVER a radial circle) ----
  // The old waterline used |d − bottleRadius| which assumed an upright cylinder
  // and painted a perfect white ring around a lying bottle (see top-down shots).
  const wakeFoam = float(0).toVar();
  If(dToBottle.lessThan(2.6), () => {
    const toBot = wxz.sub(U.wakeCenter).toVar();
    const speed = length(U.bottleVel).toVar();
    const moving = saturate(speed.mul(6.0));
    const vdir = U.bottleVel.div(speed.max(0.0008));
    const behind = saturate(dot(normalize(toBot), vdir.negate()));
    const trail = behind
      .mul(smoothstep(0.04, 0.45, dToBottle))
      .mul(oneMinus(smoothstep(0.8, 2.2, dToBottle)))
      .mul(moving)
      .toVar();
    const fleck = mx_noise_float(vec3(toBot.mul(18.0), U.time.mul(1.2))).mul(0.5).add(0.5);
    wakeFoam.assign(
      trail
        .mul(smoothstep(float(0.35), float(0.8), fleck))
        .mul(0.22)
        .mul(U.contactStrength)
        .mul(mix(float(0.15), float(0.45), U.foam))
    );
  });

  const foamRaw = foamCrest.mul(1.15)
    .add(foamJ.mul(1.25))
    .add(lipFoam)
    .add(windFoam)
    .mul(mix(float(0.2), float(1.35), foamBreak))
    .mul(mix(float(0.8), float(1.15), breakup))
    .mul(U.foam.mul(1.45))
    .add(wakeFoam)
    .toVar();

  // Soft far fade — slope shading is not amp-faded, so distant foam over-fires.
  const foamFar = shadeLod;
  const foam = saturate(foamRaw).mul(mix(float(0.12), float(1.0), foamFar)).toVar();

  // --- composite ----------------------------------------------------------
  const col = mix(body, skyRef, fresnel).add(glitter).toVar();
  // Thick wet foam: cool white lace with slightly darker wet pockets.
  const foamCol = mix(vec3(0.72, 0.8, 0.86), vec3(0.98, 0.99, 1.0), foamTex)
    .mul(U.sunColor.mul(0.12).add(0.9))
    .mul(U.sunIntensity.mul(0.15).add(0.9))
    .toVar();
  foamCol.assign(mix(foamCol, U.sunColor.mul(0.45).add(vec3(0.48, 0.36, 0.28)), lowSun.mul(0.22)));
  // Harder coverage — foam sits on top instead of glowing through the water.
  const foamAlpha = saturate(pow(foam, float(0.85)).mul(1.05));
  col.assign(mix(col, foamCol, foamAlpha));
  col.addAssign(vec3(1.0, 1.0, 1.0).mul(pow(foam.mul(foamFleck.add(0.15)), float(2.8)).mul(0.28).mul(fineFade)));
  col.addAssign(foamCol.mul(wakeFoam.mul(0.05)));

  // --- atmospheric haze ---------------------------------------------------
  // Stronger far falloff at night so the horizon softens into the sky band.
  const density = float(0.00026).add(U.haze.mul(0.003)).mul(mix(float(1.0), float(1.45), U.night));
  const hazeReach = saturate(oneMinus(exp(dist.mul(density).negate())))
    .mul(mix(float(0.62), float(0.92), U.night));
  col.assign(mix(col, U.hazeColor, hazeReach));

  // --- underwater look (camera below the local surface) -------------------
  // Looking up at the underside: brighter refracted sky disk + soft caustics.
  // Looking through submerged water: deep teal absorption and murk.
  const underAmt = U.camSubmerge.toVar();
  If(underAmt.greaterThan(0.002), () => {
    // Caustics only near the camera — underwater far tiles are already murky.
    const causticLit = float(0.45).toVar();
    If(dist.lessThan(U.lodMid), () => {
      const caustic = mx_noise_float(vec3(wxz.mul(1.7), U.time.mul(0.55)))
        .mul(0.5)
        .add(mx_noise_float(vec3(wxz.mul(3.4).add(8.1), U.time.mul(0.9))).mul(0.5));
      causticLit.assign(saturate(caustic.mul(0.55).add(0.35)));
    });

    const underBody = mix(
      U.underTint,
      U.waterShallow.mul(0.55),
      saturate(ndv.mul(0.65).add(causticLit.mul(0.35)))
    ).toVar();
    underBody.addAssign(U.scatter.mul(causticLit.mul(0.22)));

    // Soft brightening toward the surface when viewing the underside.
    If(frontFacing.not(), () => {
      const upGlow = pow(saturate(n.y.mul(0.5).add(0.5)), 2.2).mul(0.55);
      underBody.assign(mix(underBody, U.waterShallow.mul(1.4).add(U.sunColor.mul(0.25)), upGlow));
      underBody.addAssign(vec3(0.15, 0.35, 0.4).mul(pow(fresnel, 1.5).mul(0.35)));
    });

    // Depth murk grows with how far the camera sits below the surface.
    const murk = saturate(underAmt.mul(1.4));
    col.assign(mix(col, underBody, saturate(underAmt.mul(1.25))));
    col.mulAssign(mix(float(1.0), float(0.42), murk));
    col.assign(mix(col, U.underTint, murk.mul(0.35)));
  });

  col.mulAssign(mix(float(1.0), float(0.48), U.messageDim));

  return vec4(col.max(vec3(0.0)), 1.0);
});

/* ============================================================================
 * 12. Renderer, camera, ocean + sky meshes
 * ========================================================================== */

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let postProcessing = null;
let bloomPass = null;
let sunLight = null;
let moonLight = null;
let moonPhaseLight = null;
let moonTexLoading = null;
let hemiLight = null;
let ocean = null;
let oceanPatch = null;
let sky = null;
/** Three.js-style raymarched 3D-texture cloud slab (see webgpu_volume_cloud). */
let volumeClouds = null;
let volumeCloudTex = null;
const volumeCloudSteps = uniform(40);
let moonMesh = null;

function disposeMesh(mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) mesh.material.dispose();
}

function buildOcean() {
  const geometry = new THREE.PlaneGeometry(quality.half * 2, quality.half * 2, quality.segments, quality.segments);
  // Uniform grid — warped mid-range spacing made analytic crests sit above the mesh.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingSphere();

  const material = new THREE.MeshBasicNodeMaterial();
  material.positionNode = oceanPositionNode();
  material.colorNode = oceanColorNode();
  material.side = THREE.DoubleSide;
  material.transparent = false;

  ocean = new THREE.Mesh(geometry, material);
  ocean.frustumCulled = false;
  ocean.renderOrder = 0;
  scene.add(ocean);

  // No local water disc — a CircleGeometry under the bottle read as a
  // translucent “plate” through the glass / from grazing angles. Near-camera
  // Gerstner already runs at full amp (waveLod≈1, ampFade≈1), and seating uses
  // the same inverted sampleOcean field as the open sea.
}

/**
 * @deprecated Removed: circular water patch caused a visible disk under the hull.
 * Kept as empty stub so quality rebuilds that call it stay safe.
 */
function buildOceanPatch() {
  disposeMesh(oceanPatch);
  oceanPatch = null;
}

function buildSky() {
  const geometry = new THREE.SphereGeometry(2600, quality.skyW, quality.skyH);
  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = Fn(() => {
    const dir = positionWorld.sub(cameraPosition);
    const col = skyRadiance(dir).toVar();
    // Underwater: collapse the sky into a murky teal canopy.
    col.assign(mix(col, U.underTint.mul(0.55).add(U.waterShallow.mul(0.25)), saturate(U.camSubmerge.mul(1.35))));
    return vec4(col, 1.0);
  })();
  material.side = THREE.BackSide;
  material.depthWrite = false;

  sky = new THREE.Mesh(geometry, material);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
}

/**
 * Bake continuous 3D FBM (no sphere falloff).
 * Remapped into a fuller 0–1 range so thresholding can actually produce cover.
 */
function bakeCloudVolumeTexture(size) {
  const data = new Uint8Array(size * size * size);
  const perlin = new ImprovedNoise();
  let i = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x * 0.047;
        const py = y * 0.061;
        const pz = z * 0.053;
        let n = 0;
        let amp = 0.55;
        let fx = 1;
        let ampSum = 0;
        for (let o = 0; o < 4; o++) {
          const v = perlin.noise(px * fx + o * 19.1, py * fx - o * 7.3, pz * fx + o * 11.7);
          const r = 1 - Math.abs(v);
          n += amp * (o === 0 ? v * 0.5 + 0.5 : (v * 0.4 + r * 0.6));
          ampSum += amp;
          amp *= 0.5;
          fx *= 2.05;
        }
        n /= ampSum;
        // Boost contrast into usable density (raw FBM sat ~0.25–0.5).
        n = Math.pow(Math.max(0, (n - 0.28) / 0.55), 0.85);
        // Low-freq weather islands so full cover ≠ grey fog sheet.
        const wx = perlin.noise(x * 0.022 + 3.1, z * 0.019 - 1.7, 0.4) * 0.5 + 0.5;
        const weather = Math.pow(Math.max(0, (wx - 0.32) / 0.55), 1.15);
        const yh = y / (size - 1);
        const vGate = Math.min(1, yh / 0.12) * Math.min(1, (1 - yh) / 0.22);
        const dens = Math.max(0, Math.min(1, n * weather * vGate));
        data[i++] = (dens * 255) | 0;
      }
    }
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/** Cloud slab altitude / size — wide enough that horizon rays still intersect. */
const VOL_CLOUD_Y = 120;
const VOL_CLOUD_H = 220;
const VOL_CLOUD_XZ = 9000;

/**
 * Real volumetric clouds via 3D texture + RaymarchingBox.
 * Kept light: few steps, 2 tex samples/step. Skip entirely on low quality.
 */
function buildVolumeClouds() {
  disposeMesh(volumeClouds);
  volumeClouds = null;
  if (volumeCloudTex) {
    volumeCloudTex.dispose();
    volumeCloudTex = null;
  }

  // Low quality: sky-dome wisps only (volume raymarch is the FPS killer).
  if (quality.cloudLod < 0.5 || device.mobile) return;

  const size = quality.level === 'high' ? 48 : 40;
  volumeCloudTex = bakeCloudVolumeTexture(size);
  const map3d = texture3D(volumeCloudTex, null, 0);
  // High: 12 steps · medium: 10 — was 52 (~11 FPS). Sky no longer double-marches.
  volumeCloudSteps.value = quality.level === 'high' ? 12 : 10;

  const volumeColor = Fn(() => {
    const finalColor = vec4(0).toVar();
    const wind = vec3(U.windDir.x, float(0.0), U.windDir.y).mul(U.time.mul(0.003));

    RaymarchingBox(volumeCloudSteps, ({ positionRay }) => {
      const base = positionRay.add(0.5).toVar();
      const uvw = base.mul(vec3(1.15, 1.0, 1.15)).add(wind.mul(0.3)).toVar();
      const dens = map3d.sample(uvw).r.toVar();
      // Extra island carve — clouds=1 still leaves blue sky holes.
      const islands = smoothstep(
        float(0.34),
        float(0.62),
        map3d.sample(base.mul(vec3(0.55, 0.12, 0.55)).add(wind.mul(0.08))).r
      );
      // Soft ceiling: clouds=1 → thresh≈0.28 (was ~0.22 grey sheet).
      const thresh = float(0.44).sub(saturate(U.clouds).mul(0.16));
      const alpha = smoothstep(thresh.sub(0.03), thresh.add(0.12), dens)
        .mul(islands)
        .mul(mix(float(0.18), float(0.36), saturate(U.clouds)))
        .mul(saturate(U.clouds.mul(1.05)))
        .toVar();

      // One sun probe only (was multi-sample + warp + detail).
      const densSun = map3d.sample(uvw.add(U.sunDir.mul(0.05))).r;
      const sunLit = saturate(dens.sub(densSun).mul(3.2).add(0.18));
      const height = saturate(base.y);
      const lowSunAmt = oneMinus(saturate(U.sunDir.y.mul(4.0).add(0.15)));
      const shade = saturate(sunLit.mul(0.65).add(height.mul(0.45)).add(0.2));

      const col = mix(U.cloudShadow.mul(0.95), U.cloudLit, shade).toVar();
      col.assign(mix(col, U.sunColor.mul(0.75).add(vec3(0.35, 0.18, 0.05)), sunLit.mul(lowSunAmt).mul(0.35)));
      col.assign(mix(col, vec3(0.14, 0.16, 0.24).add(U.cloudLit.mul(0.25)), U.night.mul(0.85)));
      col.assign(mix(col, U.hazeColor, float(0.12)));

      finalColor.rgb.addAssign(finalColor.a.oneMinus().mul(alpha).mul(col));
      finalColor.a.addAssign(finalColor.a.oneMinus().mul(alpha));
      If(finalColor.a.greaterThanEqual(0.78), () => { Break(); });
    });

    return finalColor;
  })();

  const material = new THREE.NodeMaterial();
  material.colorNode = volumeColor;
  material.side = THREE.BackSide;
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = true;

  volumeClouds = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  volumeClouds.scale.set(VOL_CLOUD_XZ, VOL_CLOUD_H, VOL_CLOUD_XZ);
  volumeClouds.position.set(0, VOL_CLOUD_Y, 0);
  volumeClouds.frustumCulled = false;
  volumeClouds.renderOrder = -0.5;
  volumeClouds.name = 'volumeClouds';
  scene.add(volumeClouds);
}

/**
 * Load NASA LROC albedo into the sky-shader moon texture (behind haze/clouds).
 * @see textures/ATTRIBUTION.txt
 */
function applyMoonSkyImage(image) {
  moonSkyTexture.image = image;
  moonSkyTexture.colorSpace = THREE.SRGBColorSpace;
  moonSkyTexture.anisotropy = 8;
  moonSkyTexture.wrapS = THREE.RepeatWrapping;
  moonSkyTexture.wrapT = THREE.ClampToEdgeWrapping;
  moonSkyTexture.minFilter = THREE.LinearMipmapLinearFilter;
  moonSkyTexture.magFilter = THREE.LinearFilter;
  moonSkyTexture.generateMipmaps = true;
  moonSkyTexture.needsUpdate = true;
}

function loadMoonTexture() {
  if (moonTexLoading) return moonTexLoading;
  moonTexLoading = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      MOON_TEX_URL,
      (tex) => {
        applyMoonSkyImage(tex.image);
        resolve(moonSkyTexture);
      },
      undefined,
      () => {
        // Soft procedural fallback if the NASA file is missing.
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const g = ctx.createRadialGradient(size * 0.45, size * 0.4, size * 0.05, size * 0.5, size * 0.5, size * 0.55);
        g.addColorStop(0, '#d8d2c6');
        g.addColorStop(0.55, '#9a9488');
        g.addColorStop(1, '#5a564c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        applyMoonSkyImage(canvas);
        resolve(moonSkyTexture);
      }
    );
  });
  return moonTexLoading;
}

/** Moonlight for the sea/bottle; the lunar disc itself is in skyRadiance. */
function buildMoon() {
  if (!moonLight) {
    moonLight = new THREE.DirectionalLight(0xc8d2e8, 0.35);
    scene.add(moonLight);
  }
  if (moonMesh) {
    disposeMesh(moonMesh);
    moonMesh = null;
  }
  loadMoonTexture();
}

/** Apply a Low / Medium / High preset. Rebuilds ocean + sky meshes when the grid changes. */
function applyQuality(level, opts = {}) {
  if (!QUALITY_PRESETS[level]) return;
  const prev = quality.level;
  const next = copyQualityPreset(level);
  const meshChanged = prev !== next.level
    || quality.segments !== next.segments
    || quality.half !== next.half
    || quality.skyW !== next.skyW
    || quality.skyH !== next.skyH;

  Object.assign(quality, next);
  params.quality = quality.level;

  try {
    localStorage.setItem('miab-quality', quality.level);
  } catch (_) { /* private mode */ }

  if (U.fineNear) {
    U.fineNear.value = quality.fineNear;
    U.fineFar.value = quality.fineFar;
    U.lodNear.value = quality.lodNear;
    U.lodMid.value = quality.lodMid;
    U.lodFar.value = quality.lodFar;
    U.ampFadeStart.value = quality.ampFadeStart;
    U.ampFadeEnd.value = quality.ampFadeEnd;
    U.cloudLod.value = quality.cloudLod;
    U.foamDetail.value = quality.foamDetail;
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dprCap));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  if (bloomPass) {
    bloomPass.strength.value = params.reduced ? 0.0 : quality.bloom;
  }

  if (!quality.lens && dom.lensDrops) {
    lens.drops.length = 0;
    lens.wet = 0;
    if (lens.ctx) {
      lens.ctx.clearRect(0, 0, lens.w, lens.h);
    }
    dom.lensDrops.classList.remove('active');
  }

  if (opts.rebuild !== false && scene && meshChanged) {
    disposeMesh(oceanPatch);
    oceanPatch = null;
    disposeMesh(ocean);
    ocean = null;
    disposeMesh(sky);
    sky = null;
    buildSky();
    buildVolumeClouds();
    buildOcean();
  } else if (volumeCloudSteps) {
    volumeCloudSteps.value = quality.level === 'high' ? 12 : 10;
    if (quality.cloudLod < 0.5 && volumeClouds) {
      disposeMesh(volumeClouds);
      volumeClouds = null;
    } else if (quality.cloudLod >= 0.5 && !volumeClouds && scene) {
      buildVolumeClouds();
    }
  }

  syncParams();
}

/* ============================================================================
 * 13. Bottle
 * ========================================================================== */

const bottle = {
  group: null,
  model: null,
  glass: null,
  cork: null,
  seal: null,
  cord: null,
  parchment: null,
  glassMat: null,
  corkMat: null,
  sealMat: null,
  cordMat: null,
  parchmentMat: null,
  pickables: [],
  height: 0.34,
  bodyRadius: 0.056,
  corkBaseY: 0,
  parchmentBaseY: 0,
  style: 'antique'
};

/** Two-wall lathe profile: up the outside, back down the inside. */
function bottleProfile(style) {
  const spec = {
    antique: { bodyR: 0.056, bodyTop: 0.150, neckR: 0.0205, top: 0.340, wall: 0.0058, squash: 1.0 },
    apothecary: { bodyR: 0.064, bodyTop: 0.126, neckR: 0.0180, top: 0.352, wall: 0.0052, squash: 1.0 },
    flask: { bodyR: 0.062, bodyTop: 0.138, neckR: 0.0195, top: 0.306, wall: 0.0055, squash: 0.62 }
  }[style] || { bodyR: 0.056, bodyTop: 0.150, neckR: 0.0205, top: 0.340, wall: 0.0058, squash: 1.0 };

  const { bodyR, bodyTop, neckR, top, wall } = spec;
  const outer = [
    [0, 0],
    [bodyR * 0.55, 0],
    [bodyR * 0.92, 0.008],
    [bodyR, 0.028],
    [bodyR, bodyTop],
    [bodyR * 0.965, bodyTop + 0.028],
    [bodyR * 0.78, bodyTop + 0.054],
    [bodyR * 0.5, bodyTop + 0.080],
    [neckR * 1.06, bodyTop + 0.104],
    [neckR, top - 0.032],
    [neckR * 1.18, top - 0.018],
    [neckR * 1.18, top - 0.006],
    [neckR * 0.96, top]
  ];

  const points = outer.map(([r, y]) => new THREE.Vector2(r, y));
  for (let i = outer.length - 1; i >= 1; i--) {
    const [r, y] = outer[i];
    const inset = i >= 9 ? wall * 0.62 : wall;
    const drop = i >= 9 ? 0.0025 : wall;
    points.push(new THREE.Vector2(Math.max(r - inset, 0.0045), Math.max(y - drop, wall)));
  }
  points.push(new THREE.Vector2(0, wall));

  return { points, top, neckR, bodyR, squash: spec.squash };
}

function buildBottle() {
  bottle.group = new THREE.Group();
  bottle.group.rotation.order = 'YXZ';
  // Draw after the local water disc so glass correctly occludes the waterline.
  bottle.group.renderOrder = 4;
  scene.add(bottle.group);

  bottle.model = new THREE.Group();
  // Nearly flat on the belly — a large +Z tip lifts the hull clear of the water.
  bottle.model.rotation.z = -Math.PI / 2 + 0.02;
  bottle.group.add(bottle.model);

  // --- glass -------------------------------------------------------------
  bottle.glassMat = new THREE.MeshPhysicalNodeMaterial({
    color: new THREE.Color(GLASS_STYLES.aqua.tint),
    metalness: 0,
    roughness: GLASS_STYLES.aqua.roughness,
    transmission: 0.92,
    thickness: 0.05,
    ior: 1.5,
    attenuationColor: new THREE.Color(GLASS_STYLES.aqua.atten),
    attenuationDistance: GLASS_STYLES.aqua.dist,
    transparent: true,
    side: THREE.FrontSide
  });
  bottle.glassMat.emissiveNode = Fn(() => {
    const v = normalize(cameraPosition.sub(positionWorld));
    const rim = pow(oneMinus(saturate(dot(normalWorld, v))), 3.0);
    return U.glassRim.mul(rim.mul(0.42));
  })();

  bottle.glass = new THREE.Mesh(new THREE.LatheGeometry(bottleProfile('antique').points, 56), bottle.glassMat);
  bottle.glass.renderOrder = 4;
  bottle.model.add(bottle.glass);

  // --- cork --------------------------------------------------------------
  bottle.corkMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.88, metalness: 0 });
  bottle.corkMat.colorNode = Fn(() => {
    const grain = mx_noise_float(positionLocal.mul(220.0)).mul(0.5).add(0.5);
    const fleck = mx_noise_float(positionLocal.mul(720.0).add(11.3)).mul(0.5).add(0.5);
    return vec4(mix(U.corkA, U.corkB, saturate(grain.mul(0.75).add(fleck.mul(0.25)))), 1.0);
  })();
  // Short bung: sits in the mouth with almost no shaft down the neck, so the
  // cork is not visible through the glass neck wall.
  bottle.cork = new THREE.Mesh(new THREE.CylinderGeometry(0.0196, 0.0214, 0.018, 24, 1), bottle.corkMat);
  bottle.cork.renderOrder = 5;
  bottle.model.add(bottle.cork);

  // --- wax seal ----------------------------------------------------------
  bottle.sealMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.48, metalness: 0.08, color: new THREE.Color(0x8e2b26) });
  bottle.seal = new THREE.Mesh(new THREE.CylinderGeometry(0.0272, 0.0238, 0.0062, 22, 1), bottle.sealMat);
  bottle.seal.visible = false;
  bottle.model.add(bottle.seal);

  // --- cord --------------------------------------------------------------
  bottle.cordMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.94, metalness: 0, color: new THREE.Color(0x8b7550) });
  bottle.cord = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0232, 0.0021, 6, 22), bottle.cordMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -i * 0.0058;
    bottle.cord.add(ring);
  }
  bottle.model.add(bottle.cord);

  // --- rolled parchment inside ------------------------------------------
  bottle.parchmentMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  bottle.parchmentMat.colorNode = Fn(() => {
    const fibre = mx_noise_float(positionLocal.mul(vec3(90.0, 14.0, 90.0))).mul(0.5).add(0.5);
    const stain = mx_noise_float(positionLocal.mul(26.0).add(4.7)).mul(0.5).add(0.5);
    return vec4(mix(U.paperA, U.paperB, saturate(fibre.mul(0.55).add(stain.mul(0.45)))), 1.0);
  })();
  bottle.parchment = new THREE.Mesh(new THREE.CylinderGeometry(0.0138, 0.0138, 0.118, 20, 1, true), bottle.parchmentMat);
  bottle.parchment.rotation.z = 0.07;
  bottle.model.add(bottle.parchment);

  bottle.pickables = [bottle.glass, bottle.cork, bottle.parchment];
  applyBottleGeometry('antique');
  applyBottleStyles(currentMessage.bo);
}

function applyBottleGeometry(style) {
  const profile = bottleProfile(style);
  bottle.style = style;
  bottle.height = profile.top;
  // Vertical radius of the lying bottle (lathe X maps to world Y after the -90° roll).
  bottle.bodyRadius = profile.bodyR;

  const geometry = new THREE.LatheGeometry(profile.points, 56);
  geometry.translate(0, -profile.top * 0.5, 0);
  geometry.computeVertexNormals();
  bottle.glass.geometry.dispose();
  bottle.glass.geometry = geometry;
  bottle.glass.scale.set(1, 1, profile.squash);

  const halfTop = profile.top * 0.5;
  // Centre just above the lip — only a couple of millimetres enter the mouth.
  bottle.corkBaseY = halfTop + 0.004;
  bottle.cork.position.set(0, bottle.corkBaseY, 0);
  bottle.cork.scale.set(profile.neckR / 0.0205, 1, (profile.neckR / 0.0205) * profile.squash);

  bottle.seal.position.set(0, bottle.corkBaseY + 0.011, 0);
  bottle.seal.scale.set(profile.neckR / 0.0205, 1, (profile.neckR / 0.0205) * profile.squash);

  bottle.cord.position.set(0, halfTop - 0.058, 0);
  bottle.cord.scale.set(profile.neckR / 0.0205, 1, (profile.neckR / 0.0205) * profile.squash);

  bottle.parchmentBaseY = -profile.top * 0.5 + 0.088;
  bottle.parchment.position.set(0, bottle.parchmentBaseY, 0);
}

function applyBottleStyles(bo) {
  if (!bottle.glassMat) return;

  if (bo.st !== bottle.style) applyBottleGeometry(bo.st);

  const glass = GLASS_STYLES[bo.gl] || GLASS_STYLES.clear;
  bottle.glassMat.color.setHex(glass.tint);
  bottle.glassMat.attenuationColor.setHex(glass.atten);
  bottle.glassMat.attenuationDistance = glass.dist;
  bottle.glassMat.roughness = glass.roughness;
  bottle.glassMat.needsUpdate = true;

  const cork = CORK_STYLES[bo.ck] || CORK_STYLES.natural;
  U.corkA.value.setHex(cork.a);
  U.corkB.value.setHex(cork.b);
  bottle.cord.visible = bo.ck === 'banded';

  const seal = SEAL_STYLES[bo.sl];
  bottle.seal.visible = seal !== null && seal !== undefined;
  if (bottle.seal.visible) {
    bottle.sealMat.color.setHex(seal);
    bottle.sealMat.metalness = bo.sl === 'brass' ? 0.55 : 0.08;
    bottle.sealMat.roughness = bo.sl === 'brass' ? 0.34 : 0.48;
    bottle.sealMat.needsUpdate = true;
  }
}

function applyParchmentColours(pa) {
  const c = PAPER_COLOURS[pa.co] || PAPER_COLOURS.ivory;
  U.paperA.value.set(c.top);
  U.paperB.value.set(c.low);
}

/* ============================================================================
 * 13b. Sea life — free models (see models/ATTRIBUTION.txt)
 * ========================================================================== */

const SEA_LIFE_URLS = {
  clownfish: new URL('./models/clownfish-quaternius.glb', import.meta.url).href,
  fishB: new URL('./models/fish-b-quaternius.glb', import.meta.url).href,
  dolphin: new URL('./models/dolphin-quaternius.glb', import.meta.url).href,
  manta: new URL('./models/manta-quaternius.glb', import.meta.url).href,
  shark: new URL('./models/shark-quaternius.glb', import.meta.url).href,
  whaleFinback: new URL('./models/finback-google.glb', import.meta.url).href,
  whaleAnimated: new URL('./models/whale-quaternius.glb', import.meta.url).href
};

const seaLife = {
  ready: false,
  group: null,
  mixers: [],
  fish: [],
  whale: null,
  _tmpForward: new THREE.Vector3(),
  _tmpUp: new THREE.Vector3(0, 1, 0)
};

/** Center and uniformly scale a glTF scene so its longest axis ≈ targetSize metres. */
function wrapNormalizedModel(gltfScene, targetSize) {
  const wrap = new THREE.Group();
  wrap.add(gltfScene);
  gltfScene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  gltfScene.position.x -= center.x;
  gltfScene.position.y -= center.y;
  gltfScene.position.z -= center.z;
  const longest = Math.max(size.x, size.y, size.z, 1e-4);
  wrap.scale.setScalar(targetSize / longest);
  return wrap;
}

function hardenSeaLifeMaterials(root, { wet = false } = {}) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.frustumCulled = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissiveMap) mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      if (mat.emissive && mat.color) {
        mat.emissive.copy(mat.color).multiplyScalar(wet ? 0.03 : 0.045);
      }
      if ('roughness' in mat) {
        mat.roughness = wet
          ? Math.min(0.72, Math.max(0.28, (mat.roughness ?? 0.55) * 0.85))
          : Math.min(0.92, (mat.roughness ?? 0.65) + 0.06);
      }
      if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.06);
      mat.needsUpdate = true;
    }
  });
}

/**
 * Procedural swimming undulation for static meshes (e.g. Google Poly finback).
 * Displaces vertices along the body length so the realistic model can still swim.
 */
function attachProceduralSwim(root, {
  ampFrac = 0.048,
  freq = 1.45,
  waves = 1.2,
  headAtMin = true
} = {}) {
  const parts = [];
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !obj.geometry.attributes.position) return;
    const geo = obj.geometry.clone();
    obj.geometry = geo;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const sx = bb.max.x - bb.min.x;
    const sz = bb.max.z - bb.min.z;
    const axis = sx >= sz ? 0 : 2;
    const minA = axis === 0 ? bb.min.x : bb.min.z;
    const span = Math.max(axis === 0 ? sx : sz, 1e-4);
    const pos = geo.attributes.position;
    parts.push({
      pos,
      base: new Float32Array(pos.array),
      axis,
      minA,
      span,
      amp: span * ampFrac
    });
  });

  return {
    update(t) {
      for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        const arr = part.pos.array;
        const base = part.base;
        const amp = part.amp;
        for (let i = 0; i < base.length; i += 3) {
          const along = part.axis === 0 ? base[i] : base[i + 2];
          let u = (along - part.minA) / part.span;
          if (!headAtMin) u = 1 - u;
          // Head nearly still; tail swings more (classic carangiform envelope).
          const envelope = Math.pow(Math.max(0, u - 0.06), 1.35);
          const phase = t * freq - u * waves * Math.PI * 2;
          const lateral = Math.sin(phase) * amp * envelope;
          const heave = Math.sin(phase * 0.55 + 0.35) * amp * 0.22 * envelope;
          arr[i] = base[i];
          arr[i + 1] = base[i + 1] + heave;
          arr[i + 2] = base[i + 2];
          if (part.axis === 0) arr[i + 2] += lateral;
          else arr[i] += lateral;
        }
        part.pos.needsUpdate = true;
      }
    }
  };
}

function playSwimClip(gltf, preferredSubstr, timeScale = 1) {
  if (!gltf.animations || !gltf.animations.length) return null;
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const lowerPref = (preferredSubstr || 'swim').toLowerCase();
  // Prefer a plain Swim clip over bite/attack variants when present.
  const clip = gltf.animations.find((a) => {
    const n = a.name.toLowerCase();
    return n.includes(lowerPref) && !n.includes('bite') && !n.includes('attack') && !n.includes('death');
  })
    || gltf.animations.find((a) => /swim/i.test(a.name) && !/bite|attack|death/i.test(a.name))
    || gltf.animations.find((a) => /swim/i.test(a.name))
    || gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.enabled = true;
  action.setEffectiveTimeScale(timeScale);
  action.setEffectiveWeight(1);
  action.play();
  return mixer;
}

function loadGltf(url) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

async function spawnSwimmer(root, spec, phaseSeed) {
  const gltf = await loadGltf(spec.url);
  hardenSeaLifeMaterials(gltf.scene, { wet: !!spec.wet });
  const model = wrapNormalizedModel(gltf.scene, spec.size);
  const pivot = new THREE.Group();
  pivot.add(model);
  root.add(pivot);
  const mixer = playSwimClip(gltf, spec.preferred, spec.timeScale || 1);
  if (mixer) seaLife.mixers.push(mixer);
  const entry = {
    pivot,
    model,
    radius: spec.radius,
    radiusZ: spec.radiusZ || spec.radius,
    depth: spec.depth,
    speed: spec.speed,
    phase: phaseSeed,
    bob: spec.bob || 1.4,
    yawFix: spec.yaw || 0,
    wobble: spec.wobble || 0.1,
    hasClip: !!mixer,
    offsetX: spec.offsetX || 0,
    offsetZ: spec.offsetZ || 0,
    swim: null
  };
  if (spec.proceduralSwim) {
    entry.swim = attachProceduralSwim(model, spec.proceduralSwim);
  }
  seaLife.fish.push(entry);
  return entry;
}

/**
 * Animated school near the bottle + distant realistic finback (procedural swim).
 * Failures are non-fatal — the sea still opens without them.
 */
async function loadSeaLife() {
  if (!scene || seaLife.ready) return;
  if (seaLife.group) {
    scene.remove(seaLife.group);
    seaLife.group = null;
  }
  seaLife.mixers.length = 0;
  seaLife.fish.length = 0;
  seaLife.whale = null;

  const root = new THREE.Group();
  root.name = 'sea-life';
  scene.add(root);
  seaLife.group = root;

  const nearPlan = [
    { url: SEA_LIFE_URLS.clownfish, size: 0.11, radius: 0.55, depth: 0.42, speed: 0.55, preferred: 'Swimming_Normal' },
    { url: SEA_LIFE_URLS.clownfish, size: 0.09, radius: 0.78, depth: 0.58, speed: -0.48, preferred: 'Swimming_Normal' },
    { url: SEA_LIFE_URLS.fishB, size: 0.15, radius: 0.95, depth: 0.72, speed: 0.38, preferred: 'Swim' },
    { url: SEA_LIFE_URLS.fishB, size: 0.12, radius: 1.15, depth: 0.88, speed: -0.34, preferred: 'Swim' },
    { url: SEA_LIFE_URLS.dolphin, size: 0.55, radius: 2.4, depth: 1.35, speed: 0.22, preferred: 'Swim', timeScale: 0.9 },
    { url: SEA_LIFE_URLS.manta, size: 0.85, radius: 3.2, depth: 1.8, speed: -0.14, preferred: 'Swim', timeScale: 0.75 }
  ];

  const midPlan = [
    { url: SEA_LIFE_URLS.shark, size: 2.4, radius: 11, radiusZ: 8, depth: 3.2, speed: 0.09, preferred: 'Swim', timeScale: 0.85, offsetX: 8, offsetZ: -6 }
  ];

  const lifeMode = quality.seaLife || (device.mobile ? 'light' : 'full');
  const nearCount = lifeMode === 'minimal' ? 2 : lifeMode === 'light' ? 4 : nearPlan.length;
  const plan = nearPlan.slice(0, nearCount).concat(lifeMode === 'full' ? midPlan : []);

  await Promise.all(plan.map(async (spec, i) => {
    try {
      await spawnSwimmer(root, spec, i * 1.17 + 0.4);
    } catch (err) {
      console.warn('Sea-life fish failed to load', spec.url, err);
    }
  }));

  try {
    // Desktop medium/high: textured finback + procedural swim.
    // Mobile / low: Quaternius skeletal Swim (cheaper than CPU vertex morph).
    const wantProcedural = quality.proceduralWhale !== false && !device.mobile && quality.level !== 'low';
    let whaleGltf = null;
    let procedural = false;
    if (wantProcedural) {
      try {
        whaleGltf = await loadGltf(SEA_LIFE_URLS.whaleFinback);
        procedural = true;
      } catch (_) {
        whaleGltf = null;
      }
    }
    if (!whaleGltf) {
      whaleGltf = await loadGltf(SEA_LIFE_URLS.whaleAnimated);
      procedural = false;
    }
    hardenSeaLifeMaterials(whaleGltf.scene, { wet: true });
    const model = wrapNormalizedModel(whaleGltf.scene, device.mobile ? 12 : 16);
    const pivot = new THREE.Group();
    pivot.add(model);
    root.add(pivot);

    let mixer = null;
    let swim = null;
    if (procedural) {
      swim = attachProceduralSwim(model, { ampFrac: 0.052, freq: 1.25, waves: 1.15, headAtMin: true });
    } else {
      mixer = playSwimClip(whaleGltf, 'Swim', 0.7);
      if (mixer) seaLife.mixers.push(mixer);
    }

    seaLife.whale = {
      pivot,
      model,
      radiusX: device.mobile ? 36 : 52,
      radiusZ: device.mobile ? 26 : 36,
      depth: device.mobile ? 5.2 : 6.5,
      speed: 0.042,
      phase: 1.2,
      yawFix: Math.PI * 0.5,
      offsetX: device.mobile ? 28 : 40,
      offsetZ: device.mobile ? -16 : -24,
      swim,
      hasClip: !!mixer
    };
  } catch (err) {
    console.warn('Sea-life whale failed to load', err);
  }

  seaLife.ready = seaLife.fish.length > 0 || !!seaLife.whale;
}

function orientAlongXZ(pivot, dx, dz, yawFix) {
  const len = Math.hypot(dx, dz) || 1;
  const yaw = Math.atan2(dx / len, dz / len) + (yawFix || 0);
  pivot.rotation.order = 'YXZ';
  pivot.rotation.y = yaw;
}

function updateSeaLife(dt, t) {
  if (!seaLife.ready || !bottle.group || !camera) return;

  for (let i = 0; i < seaLife.mixers.length; i++) {
    seaLife.mixers[i].update(dt);
  }

  const bx = bottle.group.position.x;
  const bz = bottle.group.position.z;
  const camX = camera.position.x;
  const camZ = camera.position.z;
  const cullR = (quality.lodFar || 220) * 1.35;

  for (let i = 0; i < seaLife.fish.length; i++) {
    const f = seaLife.fish[i];
    const ang = f.phase + t * f.speed;
    const rx = f.radius;
    const rz = f.radiusZ || f.radius;
    const x = bx + (f.offsetX || 0) + Math.cos(ang) * rx;
    const z = bz + (f.offsetZ || 0) + Math.sin(ang) * rz;
    const dx = x - camX;
    const dz = z - camZ;
    if (dx * dx + dz * dz > cullR * cullR) {
      f.pivot.visible = false;
      continue;
    }
    f.pivot.visible = true;
    const sea = sampleOcean(x, z, t, gerstnerTmp);
    const y = sea.h - f.depth + Math.sin(t * f.bob + f.phase) * 0.045;
    f.pivot.position.set(x, y, z);
    const tx = -Math.sin(ang) * rx * Math.sign(f.speed || 1);
    const tz = Math.cos(ang) * rz * Math.sign(f.speed || 1);
    orientAlongXZ(f.pivot, tx, tz, f.yawFix);
    if (f.swim) f.swim.update(t);
    if (!f.hasClip && !f.swim) {
      f.model.rotation.z = Math.sin(t * 3.2 + f.phase) * f.wobble;
      f.model.rotation.x = Math.sin(t * 2.1 + f.phase * 0.7) * f.wobble * 0.45;
    } else if (f.hasClip) {
      f.model.rotation.z = Math.sin(t * 1.6 + f.phase) * 0.04;
    }
  }

  if (seaLife.whale) {
    const w = seaLife.whale;
    const ang = w.phase + t * w.speed;
    const cx = bx + w.offsetX;
    const cz = bz + w.offsetZ;
    const x = cx + Math.cos(ang) * w.radiusX;
    const z = cz + Math.sin(ang) * w.radiusZ;
    const dx = x - camX;
    const dz = z - camZ;
    const whaleCull = cullR * 2.2;
    if (dx * dx + dz * dz > whaleCull * whaleCull) {
      w.pivot.visible = false;
    } else {
      w.pivot.visible = true;
      const sea = sampleOcean(x, z, t, gerstnerTmp);
      const y = sea.h - w.depth + Math.sin(t * 0.32 + w.phase) * 0.55;
      w.pivot.position.set(x, y, z);
      const tx = -Math.sin(ang) * w.radiusX;
      const tz = Math.cos(ang) * w.radiusZ;
      orientAlongXZ(w.pivot, tx, tz, w.yawFix);
      if (w.swim) w.swim.update(t);
      w.model.rotation.x = Math.sin(t * 0.55 + w.phase) * 0.05;
      w.model.rotation.z = Math.sin(t * 0.4) * 0.035;
    }
  }
}

/* ============================================================================
 * 14. CPU ocean sampling + buoyancy
 * ========================================================================== */

const gerstnerOut = { dx: 0, dz: 0, h: 0, gx: 0, gz: 0 };
const gerstnerTmp = { dx: 0, dz: 0, h: 0, gx: 0, gz: 0 };

/** Mirrors `gerstnerDisplace` / `gerstnerSlope` exactly, on the CPU. */
function gerstnerAt(x, z, t, out) {
  const wc = derived.windVec.x;
  const ws = derived.windVec.y;
  let dx = 0;
  let dz = 0;
  let h = 0;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  let hx = 0;
  let hz = 0;

  for (let i = 0; i < NW; i++) {
    const w = WAVES[i];
    const k = WAVE_K[i];
    const bd = WAVE_DIR[i];
    const ddx = bd[0] * wc - bd[1] * ws;
    const ddz = bd[0] * ws + bd[1] * wc;
    const amp = w.amplitude * params.swell * derived.seaAmp;
    const qa = (w.steepness / (k * NW)) * derived.steep;
    const qak = (w.steepness / NW) * derived.steep;
    const theta = k * (x * ddx + z * ddz) - WAVE_OMEGA[i] * t + w.phase + derived.phaseSeed * PHASE_K[i];
    const sn = Math.sin(theta);
    const cs = Math.cos(theta);

    dx += qa * ddx * cs;
    dz += qa * ddz * cs;
    h += amp * sn;
    sxx += qak * ddx * ddx * sn;
    szz += qak * ddz * ddz * sn;
    sxz += qak * ddx * ddz * sn;
    hx += amp * k * ddx * cs;
    hz += amp * k * ddz * cs;
  }

  const a = 1 - sxx;
  const b = 1 - szz;
  // cross( binormal, tangent ) with tangent = (a, hx, -sxz), binormal = (-sxz, hz, b)
  const nx = hz * -sxz - b * hx;
  const ny = b * a - sxz * sxz;
  const nz = -sxz * hx - hz * a;
  const safeY = Math.abs(ny) < 0.02 ? 0.02 : ny;

  out.dx = dx;
  out.dz = dz;
  out.h = h;
  out.gx = -nx / safeY;
  out.gz = -nz / safeY;
  return out;
}

/**
 * Gerstner waves displace horizontally, so the surface point above a given
 * world XZ is found by a short fixed-point inversion.
 */
function sampleOcean(wx, wz, t, out) {
  let sx = wx;
  let sz = wz;
  for (let i = 0; i < 6; i++) {
    gerstnerAt(sx, sz, t, gerstnerTmp);
    sx = wx - gerstnerTmp.dx;
    sz = wz - gerstnerTmp.dz;
  }
  return gerstnerAt(sx, sz, t, out);
}

const buoy = {
  height: spring(0),
  pitch: spring(0),
  roll: spring(0),
  yaw: spring(0),
  driftX: spring(0.08),
  driftZ: spring(-0.95),
  cork: spring(0),
  paper: spring(0),
  anchorX: 0.08,
  anchorZ: -0.95,
  wakePhase: 0,
  lastX: 0.08,
  lastZ: -0.95,
  lastHeight: 0,
  velX: 0,
  velZ: 0,
  warmed: false
};

const hullSample = { dx: 0, dz: 0, h: 0, gx: 0, gz: 0 };
const _hullPt = new THREE.Vector3();
const _hullMin = new THREE.Vector3();

/**
 * Expert bottle–sea coupling
 * --------------------------
 * GPU Gerstner displaces vertices horizontally: the crest you see at world
 * (wx, wz) came from a different rest XZ. Buoyancy MUST use the same
 * fixed-point inversion as `sampleOcean` (industry practice: Tidewater /
 * WaterThreeJS CPU mirrors). Sampling rest-space `gerstnerAt(bx,bz)` seats
 * the hull on a column that has already slid away → bottle hangs in air.
 *
 * Attitude still comes from analytic slopes at the inverted rest point.
 */
function sampleKeelSurfaceH(bx, bz, yaw, waveTime) {
  const halfLen = Math.max(0.05, (bottle.height || 0.34) * 0.28);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  // Centreline samples along the lying hull — trough-biased so no end hangs.
  const ts = [-0.85, -0.45, -0.15, 0.15, 0.45, 0.75];
  let hMin = Infinity;
  let hSum = 0;
  for (let i = 0; i < ts.length; i++) {
    const wx = bx + ts[i] * halfLen * cy;
    const wz = bz + ts[i] * halfLen * sy;
    sampleOcean(wx, wz, waveTime, hullSample);
    hSum += hullSample.h;
    if (hullSample.h < hMin) hMin = hullSample.h;
  }
  // Strong trough bias — prefer the lowest free-surface under the hull.
  return hMin * 0.82 + (hSum / ts.length) * 0.18;
}

/**
 * True lowest world-Y on the glass mesh (actual lathe vertices), not a
 * phantom cylinder that can sit below the real belly and lift the bottle.
 */
function measureHullKeelY() {
  if (!bottle.glass || !bottle.group) return null;
  bottle.group.updateMatrixWorld(true);

  const geom = bottle.glass.geometry;
  const pos = geom && geom.attributes && geom.attributes.position;
  if (!pos) return null;

  const squash = bottle.glass.scale.z || 1;
  const r = bottle.bodyRadius || 0.05;
  let minY = Infinity;

  // Dense enough to catch the belly; skip hollow interior wall (near-axis).
  const step = Math.max(1, (pos.count / 480) | 0);
  for (let i = 0; i < pos.count; i += step) {
    _hullPt.fromBufferAttribute(pos, i);
    const radial = Math.hypot(_hullPt.x, _hullPt.z * squash);
    if (radial < r * 0.55) continue;
    bottle.glass.localToWorld(_hullPt);
    if (_hullPt.y < minY) {
      minY = _hullPt.y;
      _hullMin.copy(_hullPt);
    }
  }
  return Number.isFinite(minY) ? minY : null;
}

/** Target keel depth below free surface — ~¾ of the lying diameter. */
function bottleDraft(radius = bottle.bodyRadius || 0.05) {
  return radius * 1.55;
}

/**
 * Kinematic seat: snap the measured belly to free-surface − draft.
 * Old "Pass 2" clearance against every below-centre vertex fought draft —
 * mid-hull points are *supposed* to sit above the waterline on a floater.
 */
function seatBottleKeel(bx, surfaceH, bz, roll, yaw, pitch) {
  const radius = bottle.bodyRadius || 0.05;
  const draft = bottleDraft(radius);
  bottle.group.rotation.set(roll, yaw, pitch);
  bottle.group.position.set(bx, surfaceH, bz);

  let keel = measureHullKeelY();
  if (keel == null) {
    bottle.group.position.y = surfaceH - draft + radius;
    return bottle.group.position.y;
  }

  // Two snaps cancel residual matrix / subsample error.
  const floor = surfaceH - draft;
  bottle.group.position.y += floor - keel;
  keel = measureHullKeelY();
  if (keel != null) {
    bottle.group.position.y += floor - keel;
  }
  return bottle.group.position.y;
}

/**
 * Average Gerstner slope / height over the bottle footprint — inverted so
 * samples match the water column you actually see under each point.
 */
function sampleHullOcean(bx, bz, yaw, waveTime, out) {
  const halfLen = Math.max(0.05, (bottle.height || 0.22) * 0.24);
  const halfWid = Math.max(0.025, (bottle.bodyRadius || 0.05) * 0.75);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  const offsets = [
    [0, 0],
    [halfLen, 0],
    [-halfLen * 0.85, 0],
    [0, halfWid],
    [0, -halfWid],
    [halfLen * 0.4, halfWid * 0.5],
    [halfLen * 0.4, -halfWid * 0.5]
  ];
  const sampleCount = Math.max(1, Math.min(offsets.length, quality.hullSamples | 0));

  let hSum = 0;
  let gxSum = 0;
  let gzSum = 0;
  let hMin = Infinity;

  for (let i = 0; i < sampleCount; i++) {
    const lx = offsets[i][0];
    const lz = offsets[i][1];
    const wx = bx + lx * cy - lz * sy;
    const wz = bz + lx * sy + lz * cy;
    sampleOcean(wx, wz, waveTime, hullSample);
    hSum += hullSample.h;
    gxSum += hullSample.gx;
    gzSum += hullSample.gz;
    if (hullSample.h < hMin) hMin = hullSample.h;
  }

  const n = sampleCount;
  out.h = hSum / n * 0.55 + hMin * 0.45;
  out.gx = gxSum / n;
  out.gz = gzSum / n;
  out.dx = 0;
  out.dz = 0;
  return out;
}

function updateBuoyancy(dt, waveTime) {
  // Bounded drift along the wind — keeps the bottle in frame.
  const driftAmp = params.reduced ? 0.18 : 0.55;
  const wobble = waveTime * 0.055;
  const targetX = buoy.anchorX + derived.windVec.x * Math.sin(wobble) * driftAmp + Math.cos(wobble * 0.61) * driftAmp * 0.4;
  const targetZ = buoy.anchorZ + derived.windVec.y * Math.sin(wobble) * driftAmp + Math.sin(wobble * 0.47) * driftAmp * 0.4;
  const bx = springStep(buoy.driftX, targetX, 0.55, dt);
  const bz = springStep(buoy.driftZ, targetZ, 0.55, dt);

  // Yaw with the wind, slightly biased by local slope (inverted sample).
  const provisional = sampleOcean(bx, bz, waveTime, gerstnerOut);
  const targetYaw = Math.atan2(derived.windVec.y, derived.windVec.x) * -1 + provisional.gz * 0.22;
  const yaw = springStep(buoy.yaw, targetYaw, 1.35, dt);

  // ONE field for tilt + height (analytic Gerstner = GPU / local disc).
  const s = sampleHullOcean(bx, bz, yaw, waveTime, gerstnerOut);
  const surfaceH = sampleKeelSurfaceH(bx, bz, yaw, waveTime);

  if (!buoy.warmed) {
    buoy.warmed = true;
    buoy.height.x = surfaceH;
    buoy.height.v = 0;
    buoy.yaw.x = yaw;
    buoy.pitch.x = clampNum(Math.atan(clampNum(s.gx * Math.cos(yaw) - s.gz * Math.sin(yaw), -0.28, 0.28)) * 0.42, -0.12, 0.12);
    buoy.roll.x = clampNum(-Math.atan(clampNum(s.gx * Math.sin(yaw) + s.gz * Math.cos(yaw), -0.28, 0.28)) * 0.38, -0.12, 0.12);
    buoy.lastX = bx;
    buoy.lastZ = bz;
    buoy.lastHeight = surfaceH;
  }

  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const slopeAlong = s.gx * cy - s.gz * sy;
  const slopeAcross = s.gx * sy + s.gz * cy;

  // Gentle face-follow only. Unclamped Gerstner slopes can spike past 1.0 and
  // tip the bottle ~50°, which lifts the centre clear of the water while the
  // dipped tip still reports gapInv≈0.
  const pitchTarget = Math.atan(clampNum(slopeAlong, -0.28, 0.28)) * 0.42;
  const rollTarget = -Math.atan(clampNum(slopeAcross, -0.28, 0.28)) * 0.38;
  const pitch = clampNum(springStep(buoy.pitch, pitchTarget, 18, dt), -0.12, 0.12);
  const roll = clampNum(springStep(buoy.roll, rollTarget, 18, dt), -0.12, 0.12);
  buoy.pitch.x = pitch;
  buoy.roll.x = roll;

  // Kinematic seat: Y always locks to free surface (no spring hang / gravity lag).
  const prevH = buoy.height.x;
  buoy.height.x = surfaceH;
  buoy.height.v = (surfaceH - prevH) / Math.max(dt, 1e-4);

  const height = seatBottleKeel(bx, surfaceH, bz, roll, yaw, pitch);

  const invDt = dt > 1e-4 ? 1 / dt : 0;
  buoy.velX = (bx - buoy.lastX) * invDt;
  buoy.velZ = (bz - buoy.lastZ) * invDt;
  const vertSpeed = Math.abs(buoy.height.v);
  const horizSpeed = Math.hypot(buoy.velX, buoy.velZ);
  buoy.wakePhase += dt * (1.1 + params.wind * 0.55 + horizSpeed * 0.8);
  if (buoy.wakePhase > Math.PI * 2) buoy.wakePhase -= Math.PI * 2;

  const strength = clampNum(
    0.28 + vertSpeed * 0.45 + horizSpeed * 1.1 + params.sea * 0.2,
    0.2,
    1.35
  ) * (params.reduced ? 0.45 : 1);

  U.wakeCenter.value.set(bx, bz);
  U.wakePhase.value = buoy.wakePhase;
  U.wakeStrength.value += (strength - U.wakeStrength.value) * Math.min(1, dt * 4.5);
  U.bottleVel.value.set(buoy.velX, buoy.velZ);
  // Soft falloff scale for directional wake only (not a circular waterline).
  const halfLen = Math.max(0.06, (bottle.height || 0.34) * 0.28);
  U.bottleRadius.value = halfLen;
  U.contactStrength.value = params.reduced ? 0.2 : 0.4;
  buoy.lastX = bx;
  buoy.lastZ = bz;
  buoy.lastHeight = height;

  // Cork lift and parchment reveal.
  const opening = state.mode === 'opening' || state.mode === 'message' ? 1 : 0;
  const corkLift = springStep(buoy.cork, opening, 2.6, dt);
  const paperRise = springStep(buoy.paper, opening, 1.9, dt);
  bottle.cork.position.y = bottle.corkBaseY + corkLift * 0.055;
  bottle.cork.rotation.z = corkLift * 0.55;
  bottle.cork.rotation.x = corkLift * 0.24;
  if (bottle.seal.visible) {
    bottle.seal.position.y = bottle.corkBaseY + 0.011 + corkLift * 0.055;
    bottle.seal.rotation.z = corkLift * 0.55;
  }
  bottle.parchment.position.y = bottle.parchmentBaseY + paperRise * (bottle.height * 0.5 + 0.055);
  bottle.parchment.rotation.z = 0.07 + paperRise * 0.16;
  bottle.parchment.scale.setScalar(1 + paperRise * 0.16);

  updateBuoyDebug(bx, bz, yaw, pitch, roll, surfaceH, waveTime);
}

/* ============================================================================
 * 14b. Buoyancy diagnostics
 * Red = measured keel · Cyan = inverted water · Magenta = rest-space water
 * Toggle: Sea controls · key B · URL ?buoyDebug=1 to force on for a session
 * Always starts off (not restored from localStorage).
 * ========================================================================== */

const buoyDbgSample = { dx: 0, dz: 0, h: 0, gx: 0, gz: 0 };

const buoyDebug = {
  enabled: (() => {
    try {
      return new URLSearchParams(window.location.search).get('buoyDebug') === '1';
    } catch (_) {
      return false;
    }
  })(),
  markers: null,
  logAcc: 0,
  last: null
};

function ensureBuoyDebugMarkers() {
  if (!scene || buoyDebug.markers) return buoyDebug.markers;
  const mk = (hex) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 10, 10),
      new THREE.MeshBasicMaterial({ color: hex, depthTest: false, transparent: true, opacity: 0.95 })
    );
    m.renderOrder = 20;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  buoyDebug.markers = {
    keel: mk(0xff3355),
    waterInv: mk(0x33e0ff),
    waterRest: mk(0xff33ee)
  };
  return buoyDebug.markers;
}

function setBuoyDebugVisible(on) {
  buoyDebug.enabled = !!on;
  try {
    localStorage.removeItem('miab-buoy-debug');
  } catch (_) { /* private mode */ }
  if (CTRL.buoyDebug && CTRL.buoyDebug.input) {
    CTRL.buoyDebug.input.value = on ? '1' : '0';
  }
  if (dom.buoyDebug) {
    dom.buoyDebug.classList.toggle('show', on);
    dom.buoyDebug.setAttribute('aria-hidden', on ? 'false' : 'true');
  }
  if (on) ensureBuoyDebugMarkers();
  const marks = buoyDebug.markers;
  if (marks) {
    marks.keel.visible = on;
    marks.waterInv.visible = on;
    marks.waterRest.visible = on;
  }
}

function updateBuoyDebug(bx, bz, yaw, pitch, roll, surfaceH, waveTime) {
  if (!buoyDebug.enabled || !bottle.group) {
    if (dom.buoyDebug) dom.buoyDebug.classList.remove('show');
    return;
  }
  if (dom.buoyDebug) dom.buoyDebug.classList.add('show');

  const marks = ensureBuoyDebugMarkers();
  const radius = bottle.bodyRadius || 0.05;
  const draft = bottleDraft(radius);

  const keelY = measureHullKeelY();
  const kx = Number.isFinite(_hullMin.x) ? _hullMin.x : bx;
  const kz = Number.isFinite(_hullMin.z) ? _hullMin.z : bz;

  sampleOcean(bx, bz, waveTime, buoyDbgSample);
  const waterInv = buoyDbgSample.h;
  const invDx = buoyDbgSample.dx;
  const invDz = buoyDbgSample.dz;

  gerstnerAt(bx, bz, waveTime, buoyDbgSample);
  const waterRest = buoyDbgSample.h;
  const restDx = buoyDbgSample.dx;
  const restDz = buoyDbgSample.dz;

  const gapInv = keelY == null ? NaN : keelY - waterInv;
  const gapRest = keelY == null ? NaN : keelY - waterRest;
  const gapSurf = keelY == null ? NaN : keelY - surfaceH;
  const floor = surfaceH - draft;
  const gapFloor = keelY == null ? NaN : keelY - floor;

  if (marks) {
    marks.keel.visible = true;
    marks.waterInv.visible = true;
    marks.waterRest.visible = true;
    if (keelY != null) marks.keel.position.set(kx, keelY, kz);
    else marks.keel.position.set(bx, bottle.group.position.y, bz);
    marks.waterInv.position.set(bx, waterInv, bz);
    marks.waterRest.position.set(bx, waterRest, bz);
  }

  const fmt = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');
  const gapClass = (g) => (Number.isFinite(g) && g > 0.002 ? 'bd-gap-air' : 'bd-gap-ok');
  const air = Number.isFinite(gapInv) && gapInv > 0.002;

  const body =
    `groupY   ${fmt(bottle.group.position.y)}\n` +
    `keelY    ${fmt(keelY)}   xz ${fmt(kx, 2)}, ${fmt(kz, 2)}\n` +
    `waterInv ${fmt(waterInv)}  <span class="${gapClass(gapInv)}">gapInv  ${fmt(gapInv, 4)}</span>${air ? '  AIR' : '  ok'}\n` +
    `waterRst ${fmt(waterRest)}  <span class="${gapClass(gapRest)}">gapRest ${fmt(gapRest, 4)}</span>\n` +
    `surfaceH ${fmt(surfaceH)}  gapSurf ${fmt(gapSurf, 4)}\n` +
    `draft    ${fmt(draft)}   radius ${fmt(radius)}  floor ${fmt(floor)}\n` +
    `gapFloor ${fmt(gapFloor, 4)}  (0 = seated)\n` +
    `restΔxz  ${fmt(restDx, 4)}, ${fmt(restDz, 4)}\n` +
    `inv Δxz  ${fmt(invDx, 4)}, ${fmt(invDz, 4)}\n` +
    `yaw/pit/rol ${fmt(yaw, 2)} ${fmt(pitch, 2)} ${fmt(roll, 2)}\n` +
    `seaAmp   ${fmt(derived.seaAmp, 2)}  swell ${fmt(params.swell, 2)}\n` +
    `time     ${fmt(waveTime, 2)}  U.t ${fmt(U.time.value, 2)}\n` +
    `markers  red=keel cyan=inv magenta=rest`;

  if (dom.buoyDebugBody) dom.buoyDebugBody.innerHTML = body;

  buoyDebug.last = { keelY, waterInv, waterRest, gapInv, gapRest, surfaceH, air };
  buoyDebug.logAcc += 1;
  if (buoyDebug.logAcc >= 30) {
    buoyDebug.logAcc = 0;
    console.info(
      '[buoy]',
      air ? 'AIR' : 'ok',
      'gapInv', gapInv?.toFixed?.(4),
      'gapRest', gapRest?.toFixed?.(4),
      'keel', keelY?.toFixed?.(3),
      'inv', waterInv?.toFixed?.(3),
      'rest', waterRest?.toFixed?.(3)
    );
  }
}

/* ============================================================================
 * 15. Interaction
 * ========================================================================== */

const state = {
  mode: 'sea', // 'sea' | 'opening' | 'message'
  paused: false,
  hiddenPause: false,
  discovered: false,
  focusActive: false,
  openStarted: 0
};

const view = {
  focusTarget: new THREE.Vector3(0, 0.42, -0.9),
  defaultTarget: new THREE.Vector3(0, 0.42, -0.9),
  savedDist: 4.4,
  distSpring: spring(4.4),
  drift: new THREE.Vector3(),
  offset: new THREE.Vector3(),
  targetSpring: { x: spring(0), y: spring(0.42), z: spring(-0.9) }
};

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const projected = new THREE.Vector3();

function setActivatorReady(ready) {
  if (!dom.activator) return;
  dom.activator.classList.toggle('ready', ready);
  dom.activator.classList.toggle('busy', !ready);
}

function updateActivator() {
  if (!dom.activator || !bottle.group) return;
  if (state.mode !== 'sea') {
    setActivatorReady(false);
    return;
  }
  projected.copy(bottle.group.position);
  projected.y += 0.05;
  projected.project(camera);
  const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
  if (!onScreen) {
    setActivatorReady(false);
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  dom.activator.style.left = `${(projected.x * 0.5 + 0.5) * w}px`;
  dom.activator.style.top = `${(-projected.y * 0.5 + 0.5) * h}px`;
  setActivatorReady(true);
}

function openBottle() {
  if (state.mode !== 'sea') return;
  state.mode = 'opening';
  state.openStarted = performance.now();
  markBottlePressHintSeen();
  setActivatorReady(false);
  hideHint();

  view.savedDist = camera.position.distanceTo(controls.target);
  state.focusActive = true;
  announce('The cork is coming loose.');
}

function revealMessage() {
  state.mode = 'message';
  renderMessageParchment(currentMessage);
  if (dom.messageLayer) dom.messageLayer.classList.add('open');
  const titleEl = $(MSG_IDS.title);
  if (titleEl) {
    titleEl.setAttribute('tabindex', '-1');
    try {
      titleEl.focus({ preventScroll: true });
    } catch (err) {
      /* focus is best effort */
    }
  }
  if (dom.btnOpenMessage) dom.btnOpenMessage.hidden = false;
  announce('The letter is open.');
}

function closeMessage() {
  if (dom.messageLayer) dom.messageLayer.classList.remove('open');
  state.mode = 'sea';
  state.focusActive = true;
  view.focusTarget.copy(view.defaultTarget);
  view.distSpring.x = camera.position.distanceTo(controls.target);
  if (dom.btnOpenMessage) dom.btnOpenMessage.hidden = false;
  showHint('The bottle is still there, should you want to read it again.');
  if (dom.activator) {
    try {
      dom.activator.focus({ preventScroll: true });
    } catch (err) {
      /* focus is best effort */
    }
  }
  announce('Letter closed.');
}

function openComposer() {
  if (!dom.composer) return;
  dom.composer.classList.add('open');
  onComposerInput();
  const first = FORM.recipient || FORM.message;
  if (first) {
    try {
      first.focus({ preventScroll: true });
    } catch (err) {
      /* focus is best effort */
    }
  }
}

function closeComposer() {
  if (dom.composer) dom.composer.classList.remove('open');
  if (dom.btnCreate) {
    try {
      dom.btnCreate.focus({ preventScroll: true });
    } catch (err) {
      /* focus is best effort */
    }
  }
}

function onPointerDown(event) {
  if (state.mode !== 'sea') return;
  if (dom.composer && dom.composer.classList.contains('open')) return;
  if (dom.passwordDialog && dom.passwordDialog.classList.contains('open')) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  pointerNdc.set((event.clientX / w) * 2 - 1, -(event.clientY / h) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(bottle.pickables, false);
  if (hits.length > 0) openBottle();
}

/* --- modal focus trap ----------------------------------------------------- */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function topmostModal() {
  if (dom.passwordDialog && dom.passwordDialog.classList.contains('open')) return dom.passwordDialog;
  if (dom.composer && dom.composer.classList.contains('open')) return dom.composer;
  if (dom.messageLayer && dom.messageLayer.classList.contains('open')) return dom.messageLayer;
  return null;
}

function onKeyDown(event) {
  const modal = topmostModal();

  if (event.key === 'Escape') {
    if (modal === dom.passwordDialog) {
      closePasswordDialog();
      event.preventDefault();
    } else if (modal === dom.composer) {
      closeComposer();
      event.preventDefault();
    } else if (modal === dom.messageLayer) {
      closeMessage();
      event.preventDefault();
    } else if (dom.controlsPanel && dom.controlsPanel.classList.contains('open')) {
      toggleControls(false);
      event.preventDefault();
    } else if (dom.factsPanel && dom.factsPanel.classList.contains('open')) {
      toggleFacts(false);
      event.preventDefault();
    }
    return;
  }

  if (event.key === 'Tab' && modal) {
    const items = Array.from(modal.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.hidden && el.offsetParent !== null
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    } else if (!modal.contains(document.activeElement)) {
      first.focus();
      event.preventDefault();
    }
    return;
  }

  if (!modal && (event.key === 'p' || event.key === 'P')) togglePause();
  if (!modal && (event.key === 'b' || event.key === 'B')) {
    setBuoyDebugVisible(!buoyDebug.enabled);
    event.preventDefault();
  }
}

/* --- password dialog ------------------------------------------------------ */

let pendingEncrypted = null;

function openPasswordDialog(fragment) {
  pendingEncrypted = fragment;
  if (dom.decryptError) dom.decryptError.hidden = true;
  if (dom.passwordDialog) dom.passwordDialog.classList.add('open');
  if (dom.decryptPassword) {
    dom.decryptPassword.value = '';
    try {
      dom.decryptPassword.focus({ preventScroll: true });
    } catch (err) {
      /* focus is best effort */
    }
  }
}

function closePasswordDialog() {
  if (dom.passwordDialog) dom.passwordDialog.classList.remove('open');
  if (dom.decryptPassword) dom.decryptPassword.value = '';
  pendingEncrypted = null;
}

async function submitPassword() {
  if (!pendingEncrypted) return;
  const password = dom.decryptPassword ? dom.decryptPassword.value : '';
  try {
    const msg = await decodeEncrypted(pendingEncrypted, password);
    closePasswordDialog();
    applyMessage(msg, true);
    announce('Message unlocked. It waits inside the bottle.');
    if (hasSeenBottlePressHint()) {
      showHint('There is something in the water.');
    } else {
      showFirstVisitBottleCue();
    }
  } catch (err) {
    if (dom.decryptError) dom.decryptError.hidden = false;
    if (dom.decryptPassword) dom.decryptPassword.focus();
  }
}

/* ============================================================================
 * 16. Controls panel
 * ========================================================================== */

function toggleControls(force) {
  if (!dom.controlsPanel) return;
  const open = typeof force === 'boolean' ? force : !dom.controlsPanel.classList.contains('open');
  dom.controlsPanel.classList.toggle('open', open);
  if (dom.btnControls) dom.btnControls.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) toggleFacts(false);
}

const factsBrowse = { index: 0 };

function renderFactsPanel() {
  if (!dom.factsBody) return;
  const total = LOADING_FACTS.length;
  const idx = ((factsBrowse.index % total) + total) % total;
  factsBrowse.index = idx;
  setText(dom.factsBody, LOADING_FACTS[idx] || '');
  setText(dom.factsCount, `${idx + 1} / ${total}`);
}

function toggleFacts(force) {
  if (!dom.factsPanel) return;
  const open = typeof force === 'boolean' ? force : !dom.factsPanel.classList.contains('open');
  if (open) {
    // Continue from the last loading-screen note when possible.
    if (Number.isInteger(loadingFacts.index)) factsBrowse.index = loadingFacts.index;
    renderFactsPanel();
    toggleControls(false);
  }
  dom.factsPanel.classList.toggle('open', open);
  dom.factsPanel.hidden = !open;
  if (dom.btnFacts) dom.btnFacts.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function stepFact(delta) {
  factsBrowse.index += delta;
  renderFactsPanel();
}

function syncPauseButtons() {
  const paused = !!state.paused;
  if (dom.btnPause) {
    dom.btnPause.disabled = paused;
    dom.btnPause.setAttribute('aria-disabled', paused ? 'true' : 'false');
  }
  if (dom.btnResume) {
    dom.btnResume.disabled = !paused;
    dom.btnResume.setAttribute('aria-disabled', paused ? 'false' : 'true');
  }
}

function togglePause(force) {
  state.paused = typeof force === 'boolean' ? force : !state.paused;
  syncPauseButtons();
  announce(state.paused ? 'Paused.' : 'Resumed.');
}

function refreshControlOutputs() {
  setText(CTRL.sea.out, params.sea.toFixed(2));
  setText(CTRL.wind.out, params.wind.toFixed(2));
  setText(CTRL.windDir.out, `${Math.round(params.windDirDeg)}°`);
  setText(CTRL.swell.out, params.swell.toFixed(2));
  setText(CTRL.foam.out, params.foam.toFixed(2));
  setText(CTRL.tod.out, `${todPhaseLabel(params.tod)} · ${params.tod.toFixed(2)}`);
  setText(CTRL.sunAz.out, `${Math.round(params.sunAzimuthDeg)}°`);
  setText(CTRL.moonAz.out, `${Math.round(params.moonAzimuthDeg)}°`);
  setText(CTRL.moonElev.out, `${Math.round(params.moonElevationDeg)}°`);
  setText(CTRL.moonPhase.out, moonPhaseLabel(params.moonPhase));
  setText(CTRL.haze.out, params.haze.toFixed(2));
  setText(CTRL.clouds.out, params.clouds.toFixed(2));
  setText(CTRL.exposure.out, params.exposure.toFixed(2));
  setText(CTRL.drift.out, params.drift ? 'On' : 'Off');
  setText(CTRL.volume.out, params.volume.toFixed(2));
}

function writeControlInputs() {
  if (CTRL.quality.input) CTRL.quality.input.value = params.quality || quality.level;
  if (CTRL.sea.input) CTRL.sea.input.value = String(params.sea);
  if (CTRL.wind.input) CTRL.wind.input.value = String(params.wind);
  if (CTRL.windDir.input) CTRL.windDir.input.value = String(params.windDirDeg);
  if (CTRL.swell.input) CTRL.swell.input.value = String(params.swell);
  if (CTRL.foam.input) CTRL.foam.input.value = String(params.foam);
  if (CTRL.tod.input) CTRL.tod.input.value = String(params.tod);
  if (CTRL.sunAz.input) CTRL.sunAz.input.value = String(params.sunAzimuthDeg);
  if (CTRL.moonAz.input) CTRL.moonAz.input.value = String(params.moonAzimuthDeg);
  if (CTRL.moonElev.input) CTRL.moonElev.input.value = String(params.moonElevationDeg);
  if (CTRL.moonPhase.input) CTRL.moonPhase.input.value = String(params.moonPhase);
  if (CTRL.haze.input) CTRL.haze.input.value = String(params.haze);
  if (CTRL.clouds.input) CTRL.clouds.input.value = String(params.clouds);
  if (CTRL.exposure.input) CTRL.exposure.input.value = String(params.exposure);
  if (CTRL.drift.input) CTRL.drift.input.value = params.drift ? '1' : '0';
  if (CTRL.seed.input) CTRL.seed.input.value = String(params.seed);
  if (CTRL.volume.input) CTRL.volume.input.value = String(params.volume);
  if (CTRL.reduced.input) CTRL.reduced.input.value = params.reduced ? '1' : '0';
  if (CTRL.buoyDebug.input) CTRL.buoyDebug.input.value = buoyDebug.enabled ? '1' : '0';
  refreshControlOutputs();
}

/** Coalesce slider `input` to one sync per animation frame. */
let controlsRaf = 0;
/** Which control last fired — used to take a cheap sun-only path while dragging TOD. */
let controlsSource = null;
/** While dragging sky sliders, dial back stars so GPU cost doesn't hitch the thumb. */
let controlsDraggingSky = false;

const SKY_CTRL_IDS = new Set([
  'ctrl-tod', 'ctrl-sun-az', 'ctrl-moon-az', 'ctrl-moon-elev', 'ctrl-moon-phase',
  'ctrl-haze', 'ctrl-clouds', 'ctrl-exposure'
]);

function scheduleReadControls(event) {
  if (event && event.target) controlsSource = event.target;
  if (controlsRaf) return;
  controlsRaf = requestAnimationFrame(() => {
    controlsRaf = 0;
    readControls();
  });
}

/** Sky/TOD-only update — skips wave/audio/DOM thrash that made the TOD thumb hitch. */
function syncSkyControlsOnly() {
  params.tod = num(CTRL.tod.input && CTRL.tod.input.value, 0, 1, params.tod);
  params.sunAzimuthDeg = num(CTRL.sunAz.input && CTRL.sunAz.input.value, 0, 360, params.sunAzimuthDeg);
  params.moonAzimuthDeg = num(CTRL.moonAz.input && CTRL.moonAz.input.value, 0, 360, params.moonAzimuthDeg);
  params.moonElevationDeg = num(CTRL.moonElev.input && CTRL.moonElev.input.value, -5, 80, params.moonElevationDeg);
  params.moonPhase = num(CTRL.moonPhase.input && CTRL.moonPhase.input.value, 0, 1, params.moonPhase);
  params.haze = num(CTRL.haze.input && CTRL.haze.input.value, 0, 1, params.haze);
  params.clouds = num(CTRL.clouds.input && CTRL.clouds.input.value, 0, 1, params.clouds);
  params.exposure = num(CTRL.exposure.input && CTRL.exposure.input.value, 0.5, 1.8, params.exposure);

  U.haze.value = params.haze;
  U.clouds.value = params.clouds;
  U.moonPhase.value = clampNum(params.moonPhase, 0, 1);
  syncSun();
  // While dragging, keep stars soft so night doesn't spike GPU mid-scrub.
  if (controlsDraggingSky) {
    U.starAmount.value *= 0.2;
  }
  if (renderer) renderer.toneMappingExposure = params.exposure;

  setText(CTRL.tod.out, `${todPhaseLabel(params.tod)} · ${params.tod.toFixed(2)}`);
  setText(CTRL.sunAz.out, `${Math.round(params.sunAzimuthDeg)}°`);
  setText(CTRL.moonAz.out, `${Math.round(params.moonAzimuthDeg)}°`);
  setText(CTRL.moonElev.out, `${Math.round(params.moonElevationDeg)}°`);
  setText(CTRL.moonPhase.out, moonPhaseLabel(params.moonPhase));
  setText(CTRL.haze.out, params.haze.toFixed(2));
  setText(CTRL.clouds.out, params.clouds.toFixed(2));
  setText(CTRL.exposure.out, params.exposure.toFixed(2));
}

function readControls() {
  const src = controlsSource;
  controlsSource = null;
  // Cheap path only while actively dragging a sky slider; pointerup/change do a full sync.
  const skyOnly = !!(controlsDraggingSky && src && src.id && SKY_CTRL_IDS.has(src.id));
  if (skyOnly) {
    syncSkyControlsOnly();
    return;
  }

  const nextQuality = CTRL.quality.input && CTRL.quality.input.value;
  if (nextQuality && nextQuality !== quality.level && QUALITY_PRESETS[nextQuality]) {
    applyQuality(nextQuality);
    announce(`Graphics quality: ${nextQuality}.`);
  }

  const prevVolume = params.volume;
  params.sea = num(CTRL.sea.input && CTRL.sea.input.value, 0.15, 1, params.sea);
  params.wind = num(CTRL.wind.input && CTRL.wind.input.value, 0, 1, params.wind);
  params.windDirDeg = num(CTRL.windDir.input && CTRL.windDir.input.value, 0, 360, params.windDirDeg);
  params.swell = num(CTRL.swell.input && CTRL.swell.input.value, 0.2, 1.2, params.swell);
  params.foam = num(CTRL.foam.input && CTRL.foam.input.value, 0, 1, params.foam);
  params.tod = num(CTRL.tod.input && CTRL.tod.input.value, 0, 1, params.tod);
  params.sunAzimuthDeg = num(CTRL.sunAz.input && CTRL.sunAz.input.value, 0, 360, params.sunAzimuthDeg);
  params.moonAzimuthDeg = num(CTRL.moonAz.input && CTRL.moonAz.input.value, 0, 360, params.moonAzimuthDeg);
  params.moonElevationDeg = num(CTRL.moonElev.input && CTRL.moonElev.input.value, -5, 80, params.moonElevationDeg);
  params.moonPhase = num(CTRL.moonPhase.input && CTRL.moonPhase.input.value, 0, 1, params.moonPhase);
  params.haze = num(CTRL.haze.input && CTRL.haze.input.value, 0, 1, params.haze);
  params.clouds = num(CTRL.clouds.input && CTRL.clouds.input.value, 0, 1, params.clouds);
  params.exposure = num(CTRL.exposure.input && CTRL.exposure.input.value, 0.5, 1.8, params.exposure);
  params.drift = !(CTRL.drift.input && CTRL.drift.input.value === '0');
  params.seed = Math.round(num(CTRL.seed.input && CTRL.seed.input.value, 0, 999999, params.seed));
  params.volume = num(CTRL.volume.input && CTRL.volume.input.value, 0, 1, params.volume);
  params.reduced = !!(CTRL.reduced.input && CTRL.reduced.input.value === '1');
  if (CTRL.buoyDebug.input) {
    const wantDebug = CTRL.buoyDebug.input.value === '1';
    if (wantDebug !== buoyDebug.enabled) setBuoyDebugVisible(wantDebug);
  }

  if (params.volume !== prevVolume) {
    audio.volume = params.volume;
    applyAudioGain();
  }
  refreshControlOutputs();
  syncParams();
}

/* ============================================================================
 * 17. Frame loop
 * ========================================================================== */

const timing = {
  last: 0,
  waveTime: 0,
  frames: 0,
  fpsAccum: 0,
  rafId: 0,
  bootAt: 0
};

function updateCamera(dt) {
  // Gentle camera drift: move the orbit target and let OrbitControls translate
  // the camera rigidly with it, so the horizon rises and falls like a deck.
  view.drift.set(0, 0, 0);
  if (params.drift && !params.reduced && state.mode !== 'message') {
    const t = timing.waveTime;
    const s = sampleOcean(camera.position.x, camera.position.z, t, gerstnerTmp);
    view.drift.set(Math.sin(t * 0.11) * 0.16, s.h * 0.32 + Math.sin(t * 0.19) * 0.05, Math.cos(t * 0.083) * 0.16);
  }

  const focusing = state.mode === 'opening' || state.mode === 'message';
  if (focusing) {
    view.focusTarget.set(bottle.group.position.x, bottle.group.position.y + 0.03, bottle.group.position.z);
  }

  const tgt = state.focusActive ? view.focusTarget : view.defaultTarget;
  const sx = springStep(view.targetSpring.x, tgt.x, 2.4, dt);
  const sy = springStep(view.targetSpring.y, tgt.y, 2.4, dt);
  const sz = springStep(view.targetSpring.z, tgt.z, 2.4, dt);

  if (state.focusActive) {
    const desiredDist = focusing ? (isMobile ? 1.35 : 1.15) : view.savedDist;
    const dist = springStep(view.distSpring, desiredDist, 2.2, dt);
    view.offset.copy(camera.position).sub(controls.target);
    if (view.offset.lengthSq() > 1e-6) {
      view.offset.setLength(dist);
      camera.position.copy(controls.target).add(view.offset);
    }
    const settled =
      state.mode === 'sea' &&
      Math.abs(dist - desiredDist) < 0.02 &&
      Math.abs(sx - tgt.x) < 0.02 &&
      Math.abs(sz - tgt.z) < 0.02;
    if (settled) state.focusActive = false;
  } else {
    view.distSpring.x = camera.position.distanceTo(controls.target);
    view.distSpring.v = 0;
  }

  controls.target.set(sx + view.drift.x, sy + view.drift.y, sz + view.drift.z);
  controls.update();
}

/* ============================================================================
 * Lens water droplets (2D overlay)
 * Research basis: rain-on-glass / BigWings–style hemispheric lenses —
 * Fresnel rim, specular, soft contact shadow, teardrop stretch when sliding,
 * wet streaks (not 1px lines). Canvas cannot sample the WebGPU scene, so
 * refraction is faked with thickness tint + rim caustic instead of opaque
 * soap-bubble discs.
 * ========================================================================== */

const LENS_SPRITE = 96;
const lens = {
  ctx: null,
  w: 0,
  h: 0,
  dpr: 1,
  drops: [],
  trails: [],
  wasUnder: false,
  wet: 0,
  dripAcc: 0,
  /** Pre-baked hemispheric drop sprite (ImageBitmap / canvas). */
  sprite: null,
  /** Soft wet-streak stamp. */
  trailSprite: null,
  light: { x: -0.45, y: -0.72 }
};

/** Bake a hemispheric water-bead sprite once (normals → Fresnel + specular). */
function bakeLensSprites() {
  const size = LENS_SPRITE;
  const cx = (size - 1) * 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const lx = lens.light.x;
  const ly = lens.light.y;
  const lz = Math.sqrt(Math.max(0.01, 1 - lx * lx - ly * ly));

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Slight teardrop: taller than wide, flattened contact at bottom.
      let dx = (px - cx) / cx;
      let dy = (py - cx) / cx;
      dy = dy * (1.08 + dy * 0.14);
      const dist = Math.hypot(dx, dy);
      const i = (py * size + px) * 4;
      if (dist >= 1) {
        data[i + 3] = 0;
        continue;
      }

      // Hemisphere height / normal (unit ball cap).
      const z = Math.sqrt(Math.max(0, 1 - dist * dist));
      const invLen = Math.sqrt(dx * dx + dy * dy + z * z) || 1;
      const nx = dx / invLen;
      const ny = dy / invLen;
      const nz = z / invLen;

      // Schlick-ish Fresnel — bright thin rim, clear centre.
      const fresnel = Math.pow(1 - Math.max(0, nz), 3.2);
      // Soft contact shadow where the bead sits on the glass.
      const contact = Math.exp(-((dy - 0.55) * (dy - 0.55)) / 0.08) * (1 - dist) * 0.55;
      // Specular from upper-left key light.
      const ndl = Math.max(0, nx * lx + ny * ly + nz * lz);
      const spec = Math.pow(ndl, 48) * 0.95 + Math.pow(ndl, 12) * 0.18;
      // Fake thickness / slight cool refraction tint (not a white fill).
      const thick = z * z;
      const caustic = Math.exp(-((dist - 0.42) * (dist - 0.42)) / 0.035) * 0.22;

      const alpha = clampNum(
        fresnel * 0.72 + thick * 0.1 + caustic * 0.35 + contact * 0.25 + spec * 0.55,
        0,
        0.92
      ) * Math.pow(1 - dist, 0.15);

      // Cool body; rim goes near-white; contact goes slightly dark teal.
      let r = 150 + fresnel * 90 + spec * 105 - contact * 40;
      let g = 185 + fresnel * 55 + spec * 70 - contact * 20;
      let b = 205 + fresnel * 40 + spec * 50 + thick * 25;
      // Subtle chromatic fringe at the rim (magenta / cyan split).
      r += fresnel * fresnel * 18;
      b += fresnel * (1 - fresnel) * 22;

      data[i] = clampNum(Math.round(r), 0, 255);
      data[i + 1] = clampNum(Math.round(g), 0, 255);
      data[i + 2] = clampNum(Math.round(b), 0, 255);
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  lens.sprite = canvas;

  // Soft elongated wet-streak stamp (vertical capsule).
  const tw = 32;
  const th = 64;
  const tCanvas = document.createElement('canvas');
  tCanvas.width = tw;
  tCanvas.height = th;
  const tctx = tCanvas.getContext('2d');
  const tImg = tctx.createImageData(tw, th);
  const td = tImg.data;
  const tcx = (tw - 1) * 0.5;
  const tcy = (th - 1) * 0.5;
  for (let py = 0; py < th; py++) {
    for (let px = 0; px < tw; px++) {
      const dx = (px - tcx) / (tcx * 0.55);
      const dy = (py - tcy) / tcy;
      const d = Math.hypot(dx, dy * 0.55);
      const a = Math.exp(-d * d * 2.8) * (1 - Math.abs(dy) * 0.35);
      const i = (py * tw + px) * 4;
      td[i] = 170;
      td[i + 1] = 205;
      td[i + 2] = 220;
      td[i + 3] = Math.round(clampNum(a, 0, 1) * 110);
    }
  }
  tctx.putImageData(tImg, 0, 0);
  lens.trailSprite = tCanvas;
}

function resizeLensDrops() {
  if (!dom.lensDrops) return;
  if (!lens.sprite) bakeLensSprites();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const w = window.innerWidth;
  const h = window.innerHeight;
  lens.dpr = dpr;
  lens.w = w;
  lens.h = h;
  dom.lensDrops.width = Math.max(1, Math.floor(w * dpr));
  dom.lensDrops.height = Math.max(1, Math.floor(h * dpr));
  lens.ctx = dom.lensDrops.getContext('2d');
  if (lens.ctx) lens.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!dom.lensDrops.dataset.wired) {
    dom.lensDrops.dataset.wired = '1';
    dom.lensDrops.addEventListener('miab-lens-burst', (ev) => {
      burstLensDrops(ev.detail === 'dive' ? 'dive' : 'surface');
    });
  }
}

function spawnLensDrop(opts = {}) {
  const w = lens.w || window.innerWidth;
  const h = lens.h || window.innerHeight;
  // Real lens beads are small; avoid giant soap-bubble discs.
  const r = opts.r ?? (1.6 + Math.random() * 4.5);
  const life = opts.life ?? (1.8 + Math.random() * 2.6);
  lens.drops.push({
    x: opts.x ?? Math.random() * w,
    y: opts.y ?? Math.random() * h * 0.85,
    r,
    vx: opts.vx ?? (Math.random() - 0.5) * 12,
    vy: opts.vy ?? (4 + Math.random() * 18),
    life,
    maxLife: life,
    stretch: 1,
    cling: opts.cling ?? false,
    momentum: opts.momentum ?? 0,
    // Transient splat from impact / merge (settles via surface tension).
    spreadX: opts.spreadX ?? (0.05 + Math.random() * 0.18),
    spreadY: opts.spreadY ?? (0.08 + Math.random() * 0.22),
    seed: Math.random() * Math.PI * 2,
    lastTrail: 0
  });
}

/** Wipe every bead / streak / haze from the lens overlay right now. */
function clearLensDropsImmediate() {
  lens.drops.length = 0;
  lens.trails.length = 0;
  lens.wet = 0;
  lens.dripAcc = 0;
  if (lens.ctx && lens.w && lens.h) {
    lens.ctx.clearRect(0, 0, lens.w, lens.h);
  }
  if (dom.lensDrops) dom.lensDrops.classList.remove('active');
}

/** Burst of droplets when the camera breaks the surface (never while under). */
function burstLensDrops(kind) {
  if (params.reduced || !quality.lens || !dom.lensDrops) return;
  // Dive bursts removed — underwater must stay clean.
  if (kind === 'dive') {
    clearLensDropsImmediate();
    return;
  }
  const w = lens.w || window.innerWidth;
  const h = lens.h || window.innerHeight;
  const mul = quality.lensMul;
  const count = Math.max(0, Math.round((isMobile ? 18 : 28) * mul));
  if (count === 0) return;

  for (let i = 0; i < count; i++) {
    const edgeBias = Math.random();
    const x = edgeBias < 0.35
      ? (Math.random() < 0.5 ? Math.random() * w * 0.22 : w * (0.78 + Math.random() * 0.22))
      : Math.random() * w;
    spawnLensDrop({
      x,
      y: Math.random() * h * 0.55,
      r: 1.8 + Math.random() * 5.5,
      vx: (Math.random() - 0.5) * 28,
      vy: 2 + Math.random() * 14,
      life: 2.6 + Math.random() * 2.8,
      cling: Math.random() < 0.78,
      spreadX: 0.12 + Math.random() * 0.28,
      spreadY: 0.1 + Math.random() * 0.2
    });
  }

  // Larger clinging beads + a few tiny mist satellites.
  const beads = Math.max(0, Math.round(6 * mul));
  for (let i = 0; i < beads; i++) {
    spawnLensDrop({
      x: Math.random() * w,
      y: Math.random() * h * 0.5,
      r: 3.2 + Math.random() * 5.5,
      vx: (Math.random() - 0.5) * 4,
      vy: 0.5 + Math.random() * 4,
      life: 3.8 + Math.random() * 3,
      cling: true,
      spreadX: 0.08,
      spreadY: 0.12
    });
  }
  const mist = Math.max(0, Math.round(14 * mul));
  for (let i = 0; i < mist; i++) {
    spawnLensDrop({
      x: Math.random() * w,
      y: Math.random() * h * 0.75,
      r: 0.7 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 4,
      life: 2 + Math.random() * 2.5,
      cling: true,
      spreadX: 0.02,
      spreadY: 0.04
    });
  }

  dom.lensDrops.classList.add('active');
}

function updateLensDrops(dt, submerge) {
  if (!dom.lensDrops || !lens.ctx) return;

  if (!quality.lens || params.reduced) {
    if (lens.drops.length || lens.trails.length || lens.wet > 0.01) {
      clearLensDropsImmediate();
    }
    lens.wasUnder = submerge > 0.18;
    return;
  }

  // Instant threshold — no linger under the surface.
  const under = submerge > 0.18;

  if (under) {
    // Every dive (first frame under, or any leftover beads): wipe now.
    if (!lens.wasUnder || lens.drops.length || lens.trails.length || lens.wet > 0.01) {
      clearLensDropsImmediate();
    }
    lens.wasUnder = true;
    return;
  }

  // Just surfaced — clear any residue, then spawn a fresh burst.
  if (lens.wasUnder) {
    clearLensDropsImmediate();
    burstLensDrops('surface');
  }
  lens.wasUnder = false;

  const wetTarget = lens.drops.length > 0 ? 0.35 : 0;
  lens.wet += (wetTarget - lens.wet) * Math.min(1, dt * 3.5);

  const g = 480;
  const next = [];
  const shed = [];
  for (let i = 0; i < lens.drops.length; i++) {
    const d = lens.drops[i];
    d.life -= dt;
    if (d.life <= 0) continue;

    // Surface tension ≈ low chance of kick; larger beads slip sooner.
    if (d.cling) {
      const slipChance = (d.r / 14) * dt * 0.55;
      if (Math.random() < slipChance || d.life < d.maxLife * 0.35) {
        d.cling = false;
        d.momentum = 0.6 + Math.random() * 1.4;
      } else {
        d.vx *= 1 - dt * 4;
        d.vy = Math.min(d.vy + g * 0.02 * dt, 12);
      }
    }

    if (!d.cling) {
      d.momentum = (d.momentum || 0) * Math.pow(0.92, dt * 60);
      d.vy += g * 0.5 * dt + (d.momentum || 0) * 40 * dt;
      d.vx *= 1 - dt * 0.55;
      d.vx += derived.windVec.x * params.wind * 6 * dt;
    }

    // Surface tension settles splat shape.
    d.spreadX *= Math.pow(0.42, dt);
    d.spreadY *= Math.pow(0.68, dt);

    const prevX = d.x;
    const prevY = d.y;
    d.x += d.vx * dt;
    d.y += d.vy * dt;

    // Teardrop stretch from vertical speed (not round soap bubbles).
    const speed = Math.hypot(d.vx, d.vy);
    d.stretch = clampNum(1 + Math.max(0, d.vy - 25) * 0.0022 + Math.max(0, speed - 40) * 0.0006, 1, 2.1);

    // Soft wet streak left while sliding — not a 1px line.
    d.lastTrail = (d.lastTrail || 0) + dt;
    if (!d.cling && d.vy > 55 && d.lastTrail > 0.04) {
      d.lastTrail = 0;
      const dist = Math.hypot(d.x - prevX, d.y - prevY);
      if (dist > 1.5) {
        lens.trails.push({
          x: (d.x + prevX) * 0.5,
          y: (d.y + prevY) * 0.5,
          len: Math.max(dist, d.r * 1.2),
          w: Math.max(1.2, d.r * (0.35 + Math.min(0.5, d.vy / 400))),
          ang: Math.atan2(d.y - prevY, d.x - prevX),
          life: 0.35 + Math.random() * 0.35,
          maxLife: 0.7
        });
      }
      // Shed tiny satellites in the wake (mass loss).
      if (d.r > 3.2 && Math.random() < 0.12 && shed.length < 8) {
        shed.push({
          x: prevX + (Math.random() - 0.5) * d.r,
          y: prevY - d.r * 0.4,
          r: 0.8 + Math.random() * 1.4,
          vx: d.vx * 0.3,
          vy: d.vy * 0.15,
          life: 1.2 + Math.random(),
          cling: true,
          spreadX: 0.05,
          spreadY: 0.08
        });
        d.r *= 0.97;
      }
    }

    if (d.y - d.r * d.stretch < lens.h + 40 && d.x > -40 && d.x < lens.w + 40) {
      next.push(d);
    }
  }

  // Simple merge pass — bigger bead absorbs smaller (area conservation).
  next.sort((a, b) => a.y - b.y);
  for (let i = 0; i < next.length; i++) {
    const a = next[i];
    if (a._dead) continue;
    for (let j = i + 1; j < Math.min(i + 18, next.length); j++) {
      const b = next[j];
      if (b._dead || a.r <= b.r) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lim = (a.r + b.r) * 0.5;
      if (dx * dx + dy * dy < lim * lim) {
        const area = Math.PI * a.r * a.r + Math.PI * b.r * b.r * 0.8;
        a.r = Math.sqrt(area / Math.PI);
        a.momentum = (a.momentum || 0) + 0.8;
        a.spreadX = Math.max(a.spreadX, 0.22);
        a.spreadY = Math.max(a.spreadY, 0.14);
        a.cling = false;
        b._dead = true;
      }
    }
  }
  lens.drops = next.filter((d) => !d._dead);
  for (let i = 0; i < shed.length; i++) spawnLensDrop(shed[i]);

  const nextTrails = [];
  for (let i = 0; i < lens.trails.length; i++) {
    const t = lens.trails[i];
    t.life -= dt;
    if (t.life > 0) nextTrails.push(t);
  }
  lens.trails = nextTrails;

  drawLensDrops(submerge);

  const busy = lens.drops.length > 0 || lens.trails.length > 0 || lens.wet > 0.05;
  dom.lensDrops.classList.toggle('active', busy);
}

function drawLensDrops(submerge) {
  const ctx = lens.ctx;
  if (!ctx) return;
  const w = lens.w;
  const h = lens.h;
  ctx.clearRect(0, 0, w, h);
  if (!lens.sprite) bakeLensSprites();

  // Soft wet-glass haze (micro-lenses) — drops then read as clearer “portals”.
  const sheen = Math.max(lens.wet * 0.55, submerge * 0.35);
  if (sheen > 0.02) {
    ctx.fillStyle = `rgba(120, 165, 185, ${0.025 + sheen * 0.05})`;
    ctx.fillRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.12, w * 0.5, h * 0.5, h * 0.9);
    vg.addColorStop(0, 'rgba(100, 150, 170, 0)');
    vg.addColorStop(1, `rgba(25, 55, 75, ${0.06 + sheen * 0.14})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // Soft wet streaks first (under the beads).
  if (lens.trailSprite) {
    for (let i = 0; i < lens.trails.length; i++) {
      const t = lens.trails[i];
      const a = clampNum(t.life / t.maxLife, 0, 1);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.ang - Math.PI * 0.5);
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(lens.trailSprite, -t.w, -t.len * 0.5, t.w * 2, t.len);
      ctx.restore();
    }
  }

  for (let i = 0; i < lens.drops.length; i++) {
    const d = lens.drops[i];
    const fade = clampNum(d.life / Math.min(0.55, d.maxLife * 0.3), 0, 1);
    const alpha = 0.35 + fade * 0.65;
    const sx = d.r * 2 * (1 + d.spreadX);
    const sy = d.r * 2 * d.stretch * 1.35 * (1 + d.spreadY);

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(Math.sin(d.seed) * 0.08);
    ctx.globalAlpha = alpha;

    // Soft contact shadow under the bead (grounds it on the glass).
    ctx.fillStyle = `rgba(10, 30, 40, ${0.12 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, sy * 0.28, sx * 0.42, sy * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(lens.sprite, -sx * 0.5, -sy * 0.5, sx, sy);
    ctx.restore();
  }
}

function frame(now) {
  timing.rafId = requestAnimationFrame(frame);

  const rawDt = timing.last ? (now - timing.last) / 1000 : 0;
  timing.last = now;
  // Cap prevents spiral-of-death on hitch; keep enough headroom for tab restore.
  const dt = clampNum(rawDt, 0, 0.1);

  // FPS pill
  timing.frames++;
  timing.fpsAccum += rawDt;
  if (timing.fpsAccum >= 0.5) {
    setText(dom.fps, `${Math.round(timing.frames / timing.fpsAccum)} FPS`);
    timing.frames = 0;
    timing.fpsAccum = 0;
  }

  if (!state.paused) {
    timing.waveTime += dt;
    U.time.value = timing.waveTime;

    if (state.mode === 'opening' && now - state.openStarted > 1500) revealMessage();

    const dimTarget = state.mode === 'message' ? 1 : 0;
    U.messageDim.value += (dimTarget - U.messageDim.value) * Math.min(1, dt * 2.5);
    U.glitter.value = derived.glitter * (1 - U.messageDim.value * 0.75);

    updateBuoyancy(dt, timing.waveTime);
    updateSeaLife(dt, timing.waveTime);
    updateCamera(dt);

    // Infinite sea: the grid rides with the camera while the field stays in
    // world space, so the shader always reads absolute world XZ.
    ocean.position.set(camera.position.x, 0, camera.position.z);
    U.oceanOrigin.value.set(camera.position.x, camera.position.z);
    sky.position.copy(camera.position);
    // Volume cloud slab rides with the camera (infinite sky), stays at altitude.
    if (volumeClouds) {
      volumeClouds.position.set(camera.position.x, VOL_CLOUD_Y, camera.position.z);
    }

    // Detect how far the camera sits below the local water surface.
    const camSea = sampleOcean(camera.position.x, camera.position.z, timing.waveTime, gerstnerTmp);
    U.waterAtCam.value = camSea.h;
    const depth = Math.max(0, camSea.h - camera.position.y + 0.04);
    const submergeTarget = clampNum(depth / 0.55, 0, 1);
    U.camSubmerge.value += (submergeTarget - U.camSubmerge.value) * Math.min(1, dt * 5.5);

    // Soft floor: do not let the camera sink indefinitely through the sea bed.
    if (camera.position.y < camSea.h - 0.85) {
      camera.position.y = camSea.h - 0.85;
    }

    // Lens overlay uses *instant* submerge so beads vanish the frame you dive.
    updateLensDrops(dt, submergeTarget);
    updateActivator();

    if (!state.discovered && (timing.waveTime > 3.2 || now - timing.bootAt > 2800)) {
      state.discovered = true;
      if (hasSeenBottlePressHint()) {
        // Returning visitor — no pulse / press tutorial.
        if (dom.btnOpenMessage) dom.btnOpenMessage.hidden = false;
      } else {
        showFirstVisitBottleCue();
        if (dom.btnOpenMessage) dom.btnOpenMessage.hidden = false;
      }
    }
  } else {
    controls.update();
    updateLensDrops(dt, U.camSubmerge.value);
  }

  postProcessing.render();
}

function startLoop() {
  if (timing.rafId) return;
  timing.last = 0;
  timing.bootAt = performance.now();
  timing.rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  if (timing.rafId) cancelAnimationFrame(timing.rafId);
  timing.rafId = 0;
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dprCap));
  renderer.setSize(w, h, false);
  resizeLensDrops();
}

/* ============================================================================
 * 18. Apply message + boot
 * ========================================================================== */

function applyMessage(msg, isShared) {
  currentMessage = msg;
  hasSharedMessage = !!isShared;

  params.tod = msg.en.tod;
  params.sea = msg.en.sea;
  params.haze = msg.en.haze;
  params.clouds = msg.en.cl;
  params.seed = msg.en.sd;

  writeControlInputs();
  syncParams();
  applyBottleStyles(msg.bo);
  applyParchmentColours(msg.pa);
  renderMessageParchment(msg);
  renderPreviewParchment(msg);
  writeForm(msg);
  updateComposerMeta(msg);

  if (msg.en.au === 1 && !audio.offered) {
    audio.offered = true;
    announce('Ambient sound is available. Use the note button to turn it on.');
  }
}

function readFragment() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return { kind: 'none' };
  const parts = hash.split('&');
  for (const part of parts) {
    if (part.startsWith('m=')) return { kind: 'plain', value: part.slice(2) };
    if (part.startsWith('e=')) return { kind: 'encrypted', value: part.slice(2) };
  }
  return { kind: 'none' };
}

function wireUi() {
  populateFontSelects();

  // Reduced motion is honoured up front and can be overridden in the panel.
  if (reducedMotionQuery.matches) {
    params.reduced = true;
    params.drift = false;
  }

  writeControlInputs();

  Object.values(CTRL).forEach((entry) => {
    if (!entry.input) return;
    // Dragging sliders: coalesce to 1 sync/frame. Commit / select: sync immediately.
    entry.input.addEventListener('pointerdown', () => {
      if (entry.input.id && SKY_CTRL_IDS.has(entry.input.id)) controlsDraggingSky = true;
    });
    entry.input.addEventListener('pointerup', () => {
      if (controlsDraggingSky) {
        controlsDraggingSky = false;
        controlsSource = entry.input;
        if (controlsRaf) {
          cancelAnimationFrame(controlsRaf);
          controlsRaf = 0;
        }
        readControls();
      }
    });
    entry.input.addEventListener('pointercancel', () => { controlsDraggingSky = false; });
    entry.input.addEventListener('input', scheduleReadControls);
    entry.input.addEventListener('change', () => {
      controlsDraggingSky = false;
      controlsSource = entry.input;
      if (controlsRaf) {
        cancelAnimationFrame(controlsRaf);
        controlsRaf = 0;
      }
      readControls();
    });
  });

  if (dom.btnControls) dom.btnControls.addEventListener('click', () => toggleControls());
  if (dom.btnFacts) dom.btnFacts.addEventListener('click', () => toggleFacts());
  if (dom.btnFactClose) dom.btnFactClose.addEventListener('click', () => toggleFacts(false));
  if (dom.btnFactPrev) dom.btnFactPrev.addEventListener('click', () => stepFact(-1));
  if (dom.btnFactNext) dom.btnFactNext.addEventListener('click', () => stepFact(1));
  if (dom.btnPause) dom.btnPause.addEventListener('click', () => togglePause(true));
  if (dom.btnResume) dom.btnResume.addEventListener('click', () => togglePause(false));
  syncPauseButtons();
  if (dom.btnMute) dom.btnMute.addEventListener('click', () => { toggleMute(); });

  if (dom.btnCreate) dom.btnCreate.addEventListener('click', openComposer);
  if (dom.btnCloseComposer) dom.btnCloseComposer.addEventListener('click', closeComposer);
  if (dom.btnCreateFromMessage) {
    dom.btnCreateFromMessage.addEventListener('click', () => {
      closeMessage();
      openComposer();
    });
  }
  if (dom.btnCloseMessage) dom.btnCloseMessage.addEventListener('click', closeMessage);
  if (dom.btnOpenMessage) {
    dom.btnOpenMessage.addEventListener('click', () => {
      if (state.mode === 'sea') openBottle();
    });
  }
  if (dom.activator) dom.activator.addEventListener('click', openBottle);

  if (dom.composerForm) {
    dom.composerForm.addEventListener('input', onComposerInput);
    dom.composerForm.addEventListener('submit', (event) => event.preventDefault());
    dom.composerForm.addEventListener('reset', () => {
      window.setTimeout(() => {
        writeForm(defaultMessage());
        onComposerInput();
      }, 0);
    });
  }
  if (dom.fEncrypt) {
    if (!window.crypto || !window.crypto.subtle) {
      dom.fEncrypt.checked = false;
      dom.fEncrypt.disabled = true;
    }
    dom.fEncrypt.addEventListener('change', () => {
      if (dom.encryptField) dom.encryptField.hidden = !dom.fEncrypt.checked;
      onComposerInput();
    });
  }
  if (dom.btnSurprise) dom.btnSurprise.addEventListener('click', surpriseMe);
  if (dom.btnGenerate) dom.btnGenerate.addEventListener('click', () => { generateLink(); });
  if (dom.btnCopy) dom.btnCopy.addEventListener('click', () => { copyLink(); });
  if (dom.btnPreviewExp) {
    dom.btnPreviewExp.addEventListener('click', () => {
      applyMessage(readForm(), hasSharedMessage);
      closeComposer();
      if (hasSeenBottlePressHint()) {
        showHint('There is something in the water.');
      } else {
        showFirstVisitBottleCue();
      }
      announce('Preview applied to the sea.');
    });
  }

  if (dom.decryptSubmit) dom.decryptSubmit.addEventListener('click', () => { submitPassword(); });
  if (dom.decryptCancel) dom.decryptCancel.addEventListener('click', closePasswordDialog);
  if (dom.decryptPassword) {
    dom.decryptPassword.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitPassword();
      }
    });
  }

  if (dom.errorFallback) {
    dom.errorFallback.addEventListener('click', () => {
      const clean = baseUrl();
      if (location.href === clean) location.reload();
      else location.replace(clean);
    });
  }

  document.addEventListener('keydown', onKeyDown);
  setBuoyDebugVisible(buoyDebug.enabled);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.hiddenPause = true;
      stopLoop();
      if (audio.ctx && audio.ctx.state === 'running') audio.ctx.suspend().catch(() => {});
    } else if (state.hiddenPause) {
      state.hiddenPause = false;
      startLoop();
      if (audio.ctx && !audio.muted) audio.ctx.resume().catch(() => {});
    }
  });

  reducedMotionQuery.addEventListener('change', (event) => {
    if (event.matches) {
      params.reduced = true;
      params.drift = false;
      writeControlInputs();
      syncParams();
    }
  });
}

/** Let the splash CSS animate before / between heavy GPU work. */
function yieldToPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Yield a macrotask so intervals / CSS can run between sync TSL bursts. */
function yieldMacrotask() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/**
 * Precompile pipelines without the deprecated sync `renderAsync()` path
 * (that blocked the main thread and froze the mouse / status animations).
 * Chunks by object so the splash can breathe between heavy TSL builds.
 */
async function warmShaders() {
  if (!renderer || !scene || !camera) return;

  const chunks = [];
  if (sky) chunks.push({ label: 'Compiling the sky', object: sky });
  if (volumeClouds) chunks.push({ label: 'Compiling volumetric clouds', object: volumeClouds });
  if (ocean) chunks.push({ label: 'Compiling the ocean', object: ocean });
  if (bottle && bottle.group) chunks.push({ label: 'Compiling the bottle', object: bottle.group });
  if (seaLife && seaLife.group) chunks.push({ label: 'Compiling sea life', object: seaLife.group });
  chunks.push({ label: 'Warming up the sea', object: scene });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    setLoadingStage(chunk.label, [
      chunk.label,
      'First visit is slower',
      'Still compiling',
      'Almost there'
    ]);
    await yieldToPaint();
    await yieldMacrotask();

    if (typeof renderer.compileAsync === 'function') {
      if (chunk.object === scene) {
        await withTimeout(renderer.compileAsync(scene, camera), 30000, chunk.label);
      } else {
        await withTimeout(renderer.compileAsync(chunk.object, camera, scene), 30000, chunk.label);
      }
    } else {
      // Extremely old three — last resort; expect a brief freeze.
      renderer.render(scene, camera);
    }

    await yieldToPaint();
    await yieldMacrotask();
  }

  setLoadingStage('Finishing lighting');
  await yieldToPaint();
  await yieldMacrotask();

  if (postProcessing) {
    // First PP frame may still do a short sync compile — isolate it in a
    // macrotask so the splash heartbeat can tick once more beforehand.
    await new Promise((resolve, reject) => {
      window.setTimeout(() => {
        try {
          postProcessing.render();
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 16);
    });
  }
}

async function initScene() {
  if (!navigator.gpu) {
    showErrorScreen(
      'WebGPU is required',
      'This experience renders the sea with WebGPU and has no fallback renderer. Please open it in a recent version of Chrome, Edge, or Safari 18 and above (not an in-app browser).'
    );
    return false;
  }

  setLoadingStage('Loading graphics');
  await yieldToPaint();

  // Fail fast if the browser advertises WebGPU but never returns an adapter
  // (Cursor’s built-in browser, remote desktop, disabled HW accel, etc.).
  try {
    const adapter = await withTimeout(navigator.gpu.requestAdapter(), 6000, 'GPU adapter');
    if (!adapter) {
      showErrorScreen(
        'No graphics adapter',
        'This browser could not open a WebGPU adapter. Open the page in Chrome or Edge with hardware acceleration enabled (not Cursor’s built-in browser), then reload.'
      );
      return false;
    }
  } catch (err) {
    console.error(err);
    showErrorScreen(
      'The graphics device could not start',
      'WebGPU did not become ready in time. Open this page in Chrome or Edge with hardware acceleration on (Cursor’s built-in browser cannot run WebGPU), close heavy tabs, then reload.'
    );
    return false;
  }

  setLoadingStage('Starting the GPU');
  await yieldToPaint();

  scene = new THREE.Scene();

  // Far plane must clear the wide cloud slab (~9 km) used for horizon cover.
  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.05, 14000);
  camera.position.set(0.05, 1.42, 3.3);

  renderer = new THREE.WebGPURenderer({ antialias: quality.antialias, alpha: false, forceWebGL: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = params.exposure;

  try {
    await yieldToPaint();
    // Device creation can still hang after a successful adapter request.
    await withTimeout(renderer.init(), 12000, 'WebGPU device init');
  } catch (err) {
    console.error(err);
    showErrorScreen(
      'The graphics device could not start',
      'WebGPU did not become ready in time. Open this page in Chrome or Edge with hardware acceleration on (Cursor’s built-in browser cannot run WebGPU), close heavy tabs, then reload.'
    );
    return false;
  }

  // WebGPURenderer silently substitutes a WebGL2 backend when no adapter is
  // available. This experience is WebGPU only, so refuse that substitution.
  if (!renderer.backend || renderer.backend.isWebGPUBackend !== true) {
    renderer.dispose();
    renderer = null;
    showErrorScreen(
      'WebGPU is required',
      'The browser reported WebGPU support but fell back to an older graphics path, which this experience does not use. Please update your browser or enable hardware acceleration, then open this page again.'
    );
    return false;
  }

  dom.viewport.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 0.55;
  controls.maxDistance = 11;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI * 0.62; // allow dipping just under the local swell
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.65;
  controls.target.copy(view.defaultTarget);
  view.targetSpring.x.x = view.defaultTarget.x;
  view.targetSpring.y.x = view.defaultTarget.y;
  view.targetSpring.z.x = view.defaultTarget.z;
  view.distSpring.x = camera.position.distanceTo(controls.target);

  setLoadingStage('Loading sea and sky');
  await yieldToPaint();

  try {
    sunLight = new THREE.DirectionalLight(0xffffff, 2.1);
    scene.add(sunLight);
    hemiLight = new THREE.HemisphereLight(0x9fc0d4, 0x0d2433, 0.8);
    scene.add(hemiLight);
    scene.add(new THREE.AmbientLight(0x5c7a8c, 0.25));

    buildSky();
    await yieldToPaint();
    setLoadingStage('Building volumetric clouds');
    buildVolumeClouds();
    await yieldToPaint();
    setLoadingStage('Building the ocean');
    buildMoon();
    buildOcean();
    await yieldToPaint();
    setLoadingStage('Placing the bottle');
    buildBottle();
    await yieldToPaint();

    setLoadingStage('Loading sea life');
    await yieldToPaint();
    try {
      await withTimeout(loadSeaLife(), 20000, 'Sea life load');
    } catch (err) {
      console.warn(err);
      // Non-fatal — continue without fish/whale.
    }

    setLoadingStage('Loading lights');
    await yieldToPaint();

    postProcessing = new THREE.PostProcessing(renderer);
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode();
    bloomPass = bloom(sceneColor, quality.bloom, 0.5, 0.95);
    postProcessing.outputNode = Fn(() => {
      const lit = sceneColor.add(bloomPass).toVar();
      const veiled = mix(lit.rgb, U.underTint.mul(0.85).add(lit.rgb.mul(0.35)), saturate(U.camSubmerge.mul(0.82)));
      return vec4(veiled, 1.0);
    })();
  } catch (err) {
    console.error(err);
    showErrorScreen(
      'The sea could not be built',
      (err && err.message) ? String(err.message) : 'A graphics shader failed while preparing the scene. Reload the page, or try a lower graphics quality after it opens.'
    );
    return false;
  }

  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  resizeLensDrops();

  return true;
}

async function main() {
  // Card hover iframes: keep the start splash (pointer-events: none).
  if (new URLSearchParams(location.search).get('cardEmbed') === '1') {
    await window.iomDemoAwaitStart({
      poster: '/assets/posters/message-in-a-bottle.webp',
      label: 'Start message in a bottle',
    })
  }

  startLoadingFacts();
  if (dom.deviceHint) {
    const bits = [];
    bits.push(device.mobile ? 'Mobile profile on' : 'Desktop profile on');
    bits.push(`default ${quality.level}`);
    if (device.saveData) bits.push('Save-Data');
    if (device.mem != null) bits.push(`${device.mem} GB RAM`);
    setText(dom.deviceHint, bits.join(' · '));
  }
  console.info('[miab] device', device, 'quality', quality.level);
  wireUi();

  let initial = defaultMessage();
  let encryptedFragment = null;

  const fragment = readFragment();
  if (fragment.kind === 'plain') {
    try {
      initial = decodePlain(fragment.value);
      hasSharedMessage = true;
    } catch (err) {
      showErrorScreen(
        'This link could not be read',
        'The message inside the link is incomplete or damaged — links are sometimes cut short by chat applications. Ask the sender for the full link, or open the default experience below.'
      );
      return;
    }
  } else if (fragment.kind === 'encrypted') {
    if (!window.crypto || !window.crypto.subtle) {
      showErrorScreen(
        'This encrypted link cannot be opened here',
        'Decryption uses the Web Crypto API, which browsers only expose over a secure (HTTPS) connection. Open the link over HTTPS, or open the default experience below.'
      );
      return;
    }
    encryptedFragment = fragment.value;
    hasSharedMessage = true;
  }

  const ready = await initScene();
  if (!ready) return;

  applyMessage(initial, hasSharedMessage);
  // A shared message is never shown automatically: the sea comes first.
  if (encryptedFragment) openPasswordDialog(encryptedFragment);

  setLoadingStage('Preparing the sea', [
    'Preparing the sea',
    'Compiling shaders (first visit is slower)',
    'Warming up the ocean',
    'Almost there'
  ]);
  await yieldToPaint();

  try {
    await warmShaders();
  } catch (err) {
    console.error(err);
    stopLoadingHeartbeat();
    showErrorScreen(
      'Shaders failed to compile',
      (err && err.message)
        ? String(err.message)
        : 'Open this page in Chrome or Edge with WebGPU enabled, then reload.'
    );
    return;
  }

  startLoop();

  await dismissLoadingScreen();
}

main().catch(() => {
  showErrorScreen(
    'Unable to begin',
    'Something went wrong while preparing the sea. Reload the page, or open the default experience below.'
  );
});
