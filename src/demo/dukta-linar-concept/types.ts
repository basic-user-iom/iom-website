export type LinarMaterialId = 'mdf' | 'plywood' | 'three-layer-spruce'
export type LinarVeneerId = 'none' | 'oak' | 'maple' | 'ash' | 'walnut'
export type LinarMdfVariant = 'natural' | 'valchromat'
export type LinarValchromatColourId =
  | 'white-pearl'
  | 'white-grey'
  | 'light-grey'
  | 'grey'
  | 'black'
  | 'chocolate-brown'
  | 'red'
  | 'yellow'
  | 'orange'
  | 'blue'
  | 'mint-green'
  | 'khaki'
/** Kept as the internal field name to avoid invalidating older component APIs. */
export type LinarMdfColourId = LinarValchromatColourId
export type LinarFleeceColourId = 'black' | 'white' | 'translucent'
export type LinarFeltColourId =
  | 'raw-white'
  | 'grey'
  | 'granite'
  | 'fir-green'
  | 'copper-brown'
  | 'deep-blue'
  | 'yellow'
  | 'olive-green'
  | 'ruby-red'
export type LinarPattern = 'regular'
export type LinarStatus = 'Standard' | 'Possible' | 'Not tested' | 'Not recommended'
export type LinarProductionClassification = 'standard' | 'possible' | 'not-tested'
export type LinarPhysicalEvidence =
  | 'physical-sample'
  | 'not-physically-tested'
  | 'unknown'
export type LinarFeasibility = 'allowed' | 'blocked' | 'unknown'
export type LinarApplication = 'freestanding' | 'wall' | 'ceiling'
export type LinarBacking = 'none' | 'acoustic-fleece' | 'felt'
export type LinarBacklightMode = 'off' | 'on'
export type LinarDataSource =
  | 'Physical sample'
  | 'CAD-derived geometry'
  | 'Geometric estimate'
  | 'Manufacturer document'
  | 'Approved formula'
  | 'Visual reference'
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
  mdfVariant: LinarMdfVariant
  mdfColour: LinarMdfColourId
  fleeceColour: LinarFleeceColourId
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
  { id: 'felt', label: 'Wool felt' },
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

/** Confirmed opening-length visual reference from the supplied pattern drawing. */
export const LINAR_REFERENCE_OPENING_LENGTH_MM = 40

/**
 * Birch plywood 9 mm 4/4 visual calibration panel.
 *
 * The 40 mm opening reproduces the supplied plan reference. Rendered bridge
 * geometry follows the CAD cut model and does not inherit the 70 mm-incision
 * sample's measurements; this exact selection remains marked Not tested.
 */
export const DEFAULT_LINAR_CONFIG: LinarConfig = {
  material: 'plywood',
  veneer: 'none',
  mdfVariant: 'natural',
  mdfColour: 'grey',
  fleeceColour: 'black',
  feltColour: 'raw-white',
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
