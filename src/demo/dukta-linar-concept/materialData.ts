import type {
  LinarBacking,
  LinarFleeceColourId,
  LinarFeltColourId,
  LinarMaterialId,
  LinarMdfColourId,
  LinarMdfVariant,
  LinarVeneerId,
} from './types'

export type LinarMaterialLook = {
  face: string
  reverse: string
  cut: string
  end: string
  roughness: number
  cutRoughness: number
  faceBumpScale: number
  cutBumpScale: number
  grain: 'fine' | 'linear' | 'open'
  grainContrast: number
  plyLayers: number
  evidence: 'Reference-calibrated procedural' | 'Provisional procedural'
  reference: string
}

export type LinarColourSource =
  | 'Official manufacturer name/code'
  | 'Client-confirmed palette'
  | 'Supplied photo reference'
  | 'Development preview'

export type LinarColourOption<T extends string> = {
  id: T
  label: string
  swatch: string
  source: LinarColourSource
  manufacturerCode?: string
  isScreenApproximation: boolean
}

/**
 * Visual calibration data only. These values are not manufacturing colour
 * specifications and deliberately carry no invented commercial names/codes.
 */
export const LINAR_MATERIAL_LOOKS: Record<LinarMaterialId, LinarMaterialLook> = {
  mdf: {
    // MDF is tinted at runtime from the selected reference swatch, allowing
    // one neutral micro-detail map to be reused by every colour.
    face: '#ffffff',
    reverse: '#ffffff',
    cut: '#ffffff',
    end: '#ffffff',
    roughness: 0.92,
    cutRoughness: 0.96,
    faceBumpScale: 0.005,
    cutBumpScale: 0.011,
    grain: 'fine',
    grainContrast: 0.018,
    plyLayers: 0,
    evidence: 'Reference-calibrated procedural',
    reference: 'Supplied LINAR MDF colour photograph and dukta brochure 2026, page 8',
  },
  plywood: {
    // The supplied birch photographs show an almost ivory face. The warmer
    // laminated core belongs on machined walls and ends, not on the veneer.
    face: '#f0e9dc',
    reverse: '#e8decc',
    cut: '#d2b486',
    end: '#d8bf94',
    roughness: 0.81,
    cutRoughness: 0.91,
    faceBumpScale: 0.006,
    cutBumpScale: 0.016,
    grain: 'linear',
    grainContrast: 0.026,
    plyLayers: 7,
    evidence: 'Reference-calibrated procedural',
    reference: 'Supplied LINAR 4/4 birch plywood photographs and dukta brochure 2026, page 8',
  },
  'three-layer-spruce': {
    // Calibrated toward the new 13 mm three-layer LINAR specimen: pale,
    // low-gloss faces with warmth concentrated on routed/end surfaces.
    face: '#eee0c8',
    reverse: '#e2cfad',
    cut: '#d6b27f',
    end: '#dfc294',
    roughness: 0.84,
    cutRoughness: 0.92,
    faceBumpScale: 0.01,
    cutBumpScale: 0.018,
    grain: 'open',
    grainContrast: 0.042,
    plyLayers: 3,
    evidence: 'Reference-calibrated procedural',
    reference: 'Supplied LINAR 4/4 three-layer spruce photograph and dukta brochure 2026, page 8',
  },
}

type VeneerId = Exclude<LinarVeneerId, 'none'>

/** Veneer remains a visual surface option and does not change radius data. */
export const LINAR_VENEER_LOOKS: Record<VeneerId, LinarMaterialLook> = {
  oak: {
    face: '#b98f5c',
    reverse: '#ad8050',
    cut: '#b98f5c',
    end: '#b98f5c',
    roughness: 0.74,
    cutRoughness: 0.82,
    faceBumpScale: 0.012,
    cutBumpScale: 0.014,
    grain: 'open',
    grainContrast: 0.075,
    plyLayers: 0,
    evidence: 'Reference-calibrated procedural',
    reference: 'Supplied oak-veneered LINAR product photographs',
  },
  maple: {
    face: '#ead9bb',
    reverse: '#dfc9a8',
    cut: '#ead9bb',
    end: '#ead9bb',
    roughness: 0.76,
    cutRoughness: 0.84,
    faceBumpScale: 0.007,
    cutBumpScale: 0.012,
    grain: 'linear',
    grainContrast: 0.024,
    plyLayers: 0,
    evidence: 'Reference-calibrated procedural',
    reference: 'Supplied maple-veneered LINAR product photograph',
  },
  ash: {
    face: '#d8bd8d',
    reverse: '#cbaa78',
    cut: '#d8bd8d',
    end: '#d8bd8d',
    roughness: 0.79,
    cutRoughness: 0.86,
    faceBumpScale: 0.011,
    cutBumpScale: 0.014,
    grain: 'open',
    grainContrast: 0.058,
    plyLayers: 0,
    evidence: 'Provisional procedural',
    reference: 'Generic visual approximation; no supplied LINAR ash texture or named sample',
  },
  walnut: {
    face: '#795238',
    reverse: '#69432f',
    cut: '#795238',
    end: '#795238',
    roughness: 0.72,
    cutRoughness: 0.82,
    faceBumpScale: 0.013,
    cutBumpScale: 0.015,
    grain: 'open',
    grainContrast: 0.09,
    plyLayers: 0,
    evidence: 'Provisional procedural',
    reference: 'Generic visual approximation; no supplied LINAR walnut texture or named sample',
  },
}

export const LINAR_MDF_VARIANTS: readonly { id: LinarMdfVariant; label: string }[] = [
  { id: 'natural', label: 'MDF Natural' },
  { id: 'valchromat', label: 'Valchromat' },
]

/**
 * Names and manufacturer codes follow the current official Valchromat
 * catalogue. Hex values are deliberately centralised screen approximations;
 * they are not official colour-managed, RAL, RGB or production values.
 */
export const LINAR_MDF_COLOURS: readonly LinarColourOption<LinarMdfColourId>[] = [
  { id: 'white-pearl', label: 'White Pearl', manufacturerCode: 'WP', swatch: '#dedbd2', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'white-grey', label: 'White Grey', manufacturerCode: 'WG', swatch: '#c9c7bf', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'light-grey', label: 'Light Grey', manufacturerCode: 'LG', swatch: '#aaa9a4', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'grey', label: 'Grey', manufacturerCode: 'CZ', swatch: '#777774', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'black', label: 'Black', manufacturerCode: 'BL', swatch: '#292a29', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'chocolate-brown', label: 'Chocolate Brown', manufacturerCode: 'CB', swatch: '#6c4a3b', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'red', label: 'Red', manufacturerCode: 'SC', swatch: '#a54842', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'yellow', label: 'Yellow', manufacturerCode: 'YW', swatch: '#c3a340', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'orange', label: 'Orange', manufacturerCode: 'OR', swatch: '#b86c3b', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'blue', label: 'Blue', manufacturerCode: 'RB', swatch: '#426c7a', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'mint-green', label: 'Mint Green', manufacturerCode: 'GM', swatch: '#608577', source: 'Official manufacturer name/code', isScreenApproximation: true },
  { id: 'khaki', label: 'Khaki', manufacturerCode: 'CQ', swatch: '#817b5e', source: 'Official manufacturer name/code', isScreenApproximation: true },
]

export const LINAR_FLEECE_COLOURS: readonly LinarColourOption<LinarFleeceColourId>[] = [
  { id: 'black', label: 'Black', swatch: '#252624', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'white', label: 'White', swatch: '#e7e4dc', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'translucent', label: 'Translucent', swatch: '#cbc5b9', source: 'Client-confirmed palette', isScreenApproximation: true },
]

export const LINAR_FELT_COLOURS: readonly LinarColourOption<LinarFeltColourId>[] = [
  { id: 'raw-white', label: 'Raw white', swatch: '#dedbd1', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'grey', label: 'Grey', swatch: '#8b8a84', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'granite', label: 'Granite', swatch: '#555653', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'fir-green', label: 'Fir green', swatch: '#3f5a4b', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'copper-brown', label: 'Copper brown', swatch: '#855b45', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'deep-blue', label: 'Deep blue', swatch: '#344e67', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'yellow', label: 'Yellow', swatch: '#c4a13d', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'olive-green', label: 'Olive green', swatch: '#70734b', source: 'Client-confirmed palette', isScreenApproximation: true },
  { id: 'ruby-red', label: 'Ruby red', swatch: '#8e2935', source: 'Client-confirmed palette', isScreenApproximation: true },
]

export const LINAR_FLEECE_METADATA = {
  thicknessRangeMm: [0.1, 0.5] as const,
  representativeVisualThicknessMm: 0.3,
  translucent: {
    visualTransmissionEstimate: 0.8,
    isCertifiedOpticalValue: false,
  },
} as const

export const LINAR_FELT_METADATA = {
  thicknessRangeMm: [1, 3] as const,
  representativeVisualThicknessMm: 2,
  opaque: true,
} as const

/** Rendering assumptions only; black/white fleece optical data is unavailable. */
export const LINAR_BACKING_VISUAL_PROFILES = {
  none: { opacity: 0, lightTransmission: 1, castShadow: false, thicknessMm: 0 },
  'fleece-black': { opacity: 0.88, lightTransmission: 0.12, castShadow: false, thicknessMm: 0.3 },
  'fleece-white': { opacity: 0.82, lightTransmission: 0.18, castShadow: false, thicknessMm: 0.3 },
  'fleece-translucent': { opacity: 0.32, lightTransmission: 0.8, castShadow: false, thicknessMm: 0.3 },
  felt: { opacity: 1, lightTransmission: 0, castShadow: true, thicknessMm: 2 },
} as const

export function backingVisualProfile(
  backing: LinarBacking,
  fleeceColour: LinarFleeceColourId,
) {
  if (backing === 'none') return LINAR_BACKING_VISUAL_PROFILES.none
  if (backing === 'felt') return LINAR_BACKING_VISUAL_PROFILES.felt
  return LINAR_BACKING_VISUAL_PROFILES[`fleece-${fleeceColour}`]
}

export const LINAR_BACKING_COLOURS: Record<Exclude<LinarBacking, 'none'>, string> = {
  'acoustic-fleece': LINAR_FLEECE_COLOURS[0].swatch,
  felt: LINAR_FELT_COLOURS[0].swatch,
}

/** Development/performance guardrail, not a commercial product maximum. */
export const LINAR_PRESENTATION_LIMITS = {
  minimumPanelCount: 1,
  maximumPanelCount: 4,
} as const

export function clampLinarPanelCount(value: number): number {
  const finiteValue = Number.isFinite(value) ? Math.round(value) : 1
  return Math.max(
    LINAR_PRESENTATION_LIMITS.minimumPanelCount,
    Math.min(LINAR_PRESENTATION_LIMITS.maximumPanelCount, finiteValue),
  )
}

export function findMdfColour(id: LinarMdfColourId) {
  return LINAR_MDF_COLOURS.find((option) => option.id === id) ?? LINAR_MDF_COLOURS[0]
}

export function findFleeceColour(id: LinarFleeceColourId) {
  return LINAR_FLEECE_COLOURS.find((option) => option.id === id) ?? LINAR_FLEECE_COLOURS[0]
}

export function findFeltColour(id: LinarFeltColourId) {
  return LINAR_FELT_COLOURS.find((option) => option.id === id) ?? LINAR_FELT_COLOURS[0]
}
