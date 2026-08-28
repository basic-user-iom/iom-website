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
export type LinarBacklightMode = 'off' | 'on'
export type LinarDataSource = 'Physical sample' | 'Geometric estimate' | 'Visual reference'
export type LinarBendDirection = 'left' | 'flat' | 'right'
export type LinarLightPlacement = 'room' | 'behind'

/**
 * Normalised position of the single interactive presentation light.
 * `u` selects azimuth, `v` selects elevation and `radius` selects distance
 * (`-1` nearest, `0` default, `1` farthest). The scene maps this stable
 * application-independent state to a safe rig around the current installation.
 */
export type LinarLightState = {
  enabled: boolean
  placement: LinarLightPlacement
  u: number
  v: number
  radius: number
}

export const DEFAULT_LINAR_LIGHT: LinarLightState = {
  enabled: false,
  placement: 'room',
  // A front-normal, elevated source lets the real 4 mm perforations project
  // onto the floor. Strongly lateral positions remain available through the
  // 360-degree light control, but their cut sidewalls physically self-occlude.
  u: 0,
  v: 0.6,
  radius: 0,
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
  backlightMode: LinarBacklightMode
  backlightIntensity: number
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

export const LINAR_BACKLIGHT_MODES: { id: LinarBacklightMode; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'on', label: 'On' },
]

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
  backlightMode: 'off',
  backlightIntensity: 60,
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
