import type {
  LinarBacking,
  LinarFeltColourId,
  LinarMaterialId,
  LinarMdfColourId,
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

export type LinarColourSource = 'Supplied photo reference' | 'Development preview'

export type LinarColourOption<T extends string> = {
  id: T
  label: string
  swatch: string
  source: LinarColourSource
  provisional: true
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

/**
 * Sampled visually from `Linar_MDFvalchromat colors.jpeg`. Numbered labels are
 * intentionally provisional because no approved manufacturer names or codes
 * were supplied with the photograph.
 */
export const LINAR_MDF_COLOURS: readonly LinarColourOption<LinarMdfColourId>[] = [
  { id: 'reference-01', label: 'Reference 01', swatch: '#b9afa2', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-02', label: 'Reference 02', swatch: '#504f54', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-03', label: 'Reference 03', swatch: '#9b7463', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-04', label: 'Reference 04', swatch: '#d2a62f', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-05', label: 'Reference 05', swatch: '#c7763f', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-06', label: 'Reference 06', swatch: '#c85851', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-07', label: 'Reference 07', swatch: '#76547d', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-08', label: 'Reference 08', swatch: '#397b91', source: 'Supplied photo reference', provisional: true },
  { id: 'reference-09', label: 'Reference 09', swatch: '#3f7d72', source: 'Supplied photo reference', provisional: true },
]

/** Only red has a supplied LINAR felt photograph; the other two test the UI. */
export const LINAR_FELT_COLOURS: readonly LinarColourOption<LinarFeltColourId>[] = [
  { id: 'reference-red', label: 'Reference red', swatch: '#a51d29', source: 'Supplied photo reference', provisional: true },
  { id: 'development-charcoal', label: 'Development charcoal', swatch: '#343638', source: 'Development preview', provisional: true },
  { id: 'development-stone', label: 'Development stone', swatch: '#8a8379', source: 'Development preview', provisional: true },
]

export const LINAR_BACKING_COLOURS: Record<Exclude<LinarBacking, 'none'>, string> = {
  'acoustic-fleece': '#4b4b49',
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

export function findFeltColour(id: LinarFeltColourId) {
  return LINAR_FELT_COLOURS.find((option) => option.id === id) ?? LINAR_FELT_COLOURS[0]
}
