import { HARDWARE_FINISHES, WOOD_FINISHES } from './materials.js'

export const PRODUCT = {
  id: 'generic-harp-study',
  brand: 'Marini Made Harps',
  subtitle: 'Interactive configuration study',
  disclaimer: 'Concept demonstration · Generic harp model',
  modelUrl: './models/harp.gltf',
  wood: {
    albedo: './models/wood/Wood095_Color.jpg',
    roughness: './models/wood/Wood095_Roughness.jpg',
    normal: './models/wood/Wood095_NormalGL.jpg',
    // Triplanar multiplier on world position: higher means finer grain.
    scale: 11.25,
  },
}

/**
 * Data-driven product options. The UI and scene consume this definition —
 * they do not hard-code each control.
 */
export const OPTIONS = {
  finish: {
    id: 'finish',
    type: 'material',
    target: 'wood',
    urlKey: 'finish',
    defaultValue: 'natural',
    label: 'Finish',
    group: 'wood',
    choices: Object.values(WOOD_FINISHES).map((item) => ({
      id: item.id,
      label: item.label,
      caption: item.caption,
      swatch: item.swatch,
      swatchInner: item.swatchInner,
    })),
  },
  hardware: {
    id: 'hardware',
    type: 'material',
    target: 'hardware',
    urlKey: 'hardware',
    defaultValue: 'bright',
    label: 'Hardware',
    group: 'hardware',
    choices: Object.values(HARDWARE_FINISHES).map((item) => ({
      id: item.id,
      label: item.label,
      caption: item.caption,
      swatch: item.swatch,
    })),
  },
  levers: {
    id: 'levers',
    type: 'boolean',
    urlKey: 'levers',
    defaultValue: false,
    label: 'Levers',
    group: 'hardware',
    summaryOn: 'On',
    summaryOff: 'Off',
    description: 'A complete set of string-aligned sharping levers, modeled after modern Forte-style hardware.',
  },
  pickup: {
    id: 'pickup',
    type: 'boolean',
    urlKey: 'pickup',
    defaultValue: false,
    label: 'Pickup / Amplification',
    group: 'details',
    summaryOn: 'Installed',
    summaryOff: 'None',
    description: 'K&K transducers concealed inside the front soundboard, with a small metal ¼-inch jack low on either side.',
  },
  detail: {
    id: 'detail',
    type: 'choice',
    urlKey: 'detail',
    defaultValue: 'classic',
    label: 'Decorative Detail',
    group: 'details',
    choices: [
      { id: 'classic', label: 'Clean', caption: 'No identification plate' },
      { id: 'emblem', label: 'Maker’s Plate', caption: 'Rear aged-brass nameplate' },
    ],
  },
  light: {
    id: 'light',
    type: 'lighting',
    urlKey: 'light',
    defaultValue: 'studio',
    label: 'Presentation',
    group: 'view',
    choices: [
      { id: 'studio', label: 'Studio' },
      { id: 'warm', label: 'Warm' },
    ],
  },
}

export const OPTION_GROUPS = [
  {
    id: 'wood',
    index: '01',
    title: 'Wood & Finish',
    blurb: 'Demonstration stains applied to the wooden body. These are conceptual finishes, not production options.',
    optionIds: ['finish'],
    defaultOpen: true,
  },
  {
    id: 'hardware',
    index: '02',
    title: 'Hardware',
    blurb: 'Metal fittings are isolated from the wood so finishes can change independently.',
    optionIds: ['hardware', 'levers'],
  },
  {
    id: 'details',
    index: '03',
    title: 'Details',
    blurb: 'Marini-referenced details: hidden transducers, a low side jack, and a rear maker’s plate.',
    optionIds: ['pickup', 'detail'],
  },
  {
    id: 'view',
    index: '04',
    title: 'View',
    blurb: 'Camera and lighting for product presentation.',
    optionIds: ['light'],
  },
]

export const CAMERA_VIEWS = [
  { id: 'hero', label: 'Hero' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'detail', label: 'Detail' },
]

export const HOTSPOTS = [
  {
    id: 'soundboard',
    label: 'Soundboard',
    kicker: 'Voice',
    body: 'The soundboard converts string vibration into the instrument’s acoustic projection. Its wood treatment stays independent from metal fittings and strings.',
    facts: ['Primary resonating surface', 'Pickup transducers remain concealed inside'],
    related: 'Finish · Internal pickup',
  },
  {
    id: 'strings',
    label: 'Strings',
    kicker: 'Voicing',
    body: 'The source instrument contains 33 individually detected strings. Their original colour and response are preserved while the frame finish changes around them.',
    facts: ['Kept separate from wood materials', 'Each top endpoint drives one lever position'],
    related: 'Sharping levers',
  },
  {
    id: 'neck',
    label: 'Sharping levers',
    kicker: 'Mechanism',
    body: 'Each lever aligns with one string below its tuning point. Engaging it shortens the vibrating length and raises that string by one semitone.',
    facts: ['One mechanism per string', 'Plate, mounting screws, cam, fret and handle'],
    related: 'Hardware finish · Levers',
  },
  {
    id: 'column',
    label: 'Column',
    kicker: 'Structure',
    body: 'The column braces the neck against string tension and completes the triangular frame. It shares the selected wood finish, while fittings remain metal.',
    facts: ['Structural frame member', 'Receives the selected wood finish'],
    related: 'Finish',
  },
]

export function getDefaultValues() {
  const values = {}
  for (const option of Object.values(OPTIONS)) {
    values[option.id] = option.defaultValue
  }
  return values
}

export const SUMMARY_ROWS = [
  { optionId: 'finish', label: 'Finish' },
  { optionId: 'hardware', label: 'Hardware' },
  { optionId: 'levers', label: 'Levers' },
  { optionId: 'pickup', label: 'Pickup' },
  { optionId: 'detail', label: 'Detail' },
]
