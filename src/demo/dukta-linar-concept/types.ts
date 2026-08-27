export type LinarMaterialId = 'mdf' | 'plywood' | 'three-layer-spruce'
export type LinarVeneerId = 'none' | 'oak' | 'maple' | 'ash' | 'walnut'
export type LinarMdfColourId =
  | 'reference-01'
  | 'reference-02'
  | 'reference-03'
  | 'reference-04'
  | 'reference-05'
  | 'reference-06'
  | 'reference-07'
  | 'reference-08'
  | 'reference-09'
export type LinarFeltColourId =
  | 'reference-red'
  | 'development-charcoal'
  | 'development-stone'
export type LinarPattern = 'regular'
export type LinarStatus = 'Standard' | 'Possible' | 'Not tested'
export type LinarApplication = 'freestanding' | 'wall' | 'ceiling'
export type LinarBacking = 'none' | 'acoustic-fleece' | 'felt'
export type LinarDataSource = 'Physical sample' | 'Geometric estimate' | 'Visual reference'
export type LinarBendDirection = 'left' | 'flat' | 'right'

/**
 * Normalised starting position of the single interactive presentation light.
 * `u` selects the fixed source azimuth and `v` selects its safe elevation/distance;
 * the scene maps both to an application-specific position around the installation.
 */
export type LinarLightState = {
  enabled: boolean
  u: number
  v: number
}

export const DEFAULT_LINAR_LIGHT: LinarLightState = {
  enabled: false,
  u: -0.32,
  v: -0.28,
}

/**
 * Reserved data-model extension for a future, physically defined S-curve.
 * It intentionally has no visible control until the secondary zone semantics
 * and reference behavior are confirmed by dukta.
 */
export type LinarSecondaryBend = {
  direction: Exclude<LinarBendDirection, 'flat'>
  radiusMm: number
  startFraction: number
}

export type LinarConfig = {
  material: LinarMaterialId
  veneer: LinarVeneerId
  mdfColour: LinarMdfColourId
  feltColour: LinarFeltColourId
  thicknessMm: number
  incisionLengthMm: number
  cutWidthMm: number
  slatWidthMm: number
  incisedTwelfths: number
  pattern: LinarPattern
  application: LinarApplication
  backing: LinarBacking
  panelCount: number
  bendDirection: LinarBendDirection
  bendRadiusMm: number | null
  secondaryBend: LinarSecondaryBend | null
}

export type LinarState = {
  targetBend: number
  displayedBend: number
  config: LinarConfig
  hasUserInteracted: boolean
}

export const LINAR_MATERIALS: { id: LinarMaterialId; label: string }[] = [
  { id: 'mdf', label: 'MDF' },
  { id: 'plywood', label: 'Birch Plywood' },
  { id: 'three-layer-spruce', label: '3-Layer Spruce' },
]

/** Descriptor-driven so adding a future veneer does not require UI changes. */
export const LINAR_VENEERS: { id: LinarVeneerId; label: string }[] = [
  { id: 'none', label: 'No veneer' },
  { id: 'oak', label: 'Oak' },
  { id: 'maple', label: 'Maple' },
  { id: 'ash', label: 'Ash' },
  { id: 'walnut', label: 'Walnut' },
]

export const LINAR_APPLICATIONS: { id: LinarApplication; label: string }[] = [
  { id: 'freestanding', label: 'Freestanding' },
  { id: 'wall', label: 'Wall' },
  { id: 'ceiling', label: 'Ceiling' },
]

export const LINAR_BACKINGS: { id: LinarBacking; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'acoustic-fleece', label: 'Acoustic fleece' },
  { id: 'felt', label: 'Felt' },
]

export const LINAR_VISIBLE_BACKINGS = LINAR_BACKINGS

export type LinarViewId = 'hero' | 'closeup' | 'side' | 'reverse' | 'bent' | 'top'
export type LinarSide = 'front' | 'back'

export const LINAR_SIDES: { id: LinarSide; label: string }[] = [
  { id: 'front', label: 'Front side' },
  { id: 'back', label: 'Back side' },
]

export const LINAR_VIEWS: { id: LinarViewId; label: string }[] = [
  { id: 'hero', label: 'Front view' },
  { id: 'closeup', label: 'Close-up' },
  { id: 'side', label: 'Side' },
  { id: 'reverse', label: 'Back view' },
  { id: 'bent', label: 'Radius' },
  { id: 'top', label: 'Top shape' },
]

/** Confirmed visual reference cell from the supplied LINAR pattern drawings. */
export const LINAR_REFERENCE_BRIDGE_LENGTH_MM = 60
export const LINAR_REFERENCE_OPENING_LENGTH_MM = 40

/**
 * Birch plywood 9 mm 4/4 visual calibration panel.
 *
 * The 40 mm opening and 60 mm bridge reproduce the supplied reference cell,
 * but this exact combination is not in the physical-sample table and must
 * therefore remain visibly marked as Not tested.
 */
export const DEFAULT_LINAR_CONFIG: LinarConfig = {
  material: 'plywood',
  veneer: 'none',
  mdfColour: 'reference-01',
  feltColour: 'reference-red',
  thicknessMm: 9,
  incisionLengthMm: LINAR_REFERENCE_OPENING_LENGTH_MM,
  cutWidthMm: 4,
  slatWidthMm: 4,
  incisedTwelfths: 12,
  pattern: 'regular',
  application: 'freestanding',
  backing: 'none',
  panelCount: 1,
  bendDirection: 'flat',
  bendRadiusMm: null,
  secondaryBend: null,
}

export function cloneConfig(config: LinarConfig): LinarConfig {
  return {
    ...config,
    secondaryBend: config.secondaryBend ? { ...config.secondaryBend } : null,
  }
}
