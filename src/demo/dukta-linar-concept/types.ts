export type LinarMaterialId = 'mdf' | 'plywood' | 'three-layer-spruce'
export type LinarPattern = 'regular' | 'irregular'
export type LinarStatus = 'Standard' | 'Possible' | 'Not tested'
export type LinarApplication = 'freestanding' | 'wall' | 'ceiling'
export type LinarBacking = 'none' | 'acoustic-fleece' | 'acoustic-wool' | 'felt'
export type LinarDataSource = 'Physical sample' | 'Geometric estimate' | 'Visual reference'

export type LinarConfig = {
  material: LinarMaterialId
  thicknessMm: number
  incisionLengthMm: number
  cutWidthMm: number
  slatWidthMm: number
  incisedTwelfths: number
  pattern: LinarPattern
  application: LinarApplication
  backing: LinarBacking
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

export const LINAR_APPLICATIONS: { id: LinarApplication; label: string }[] = [
  { id: 'freestanding', label: 'Freestanding' },
  { id: 'wall', label: 'Wall' },
  { id: 'ceiling', label: 'Ceiling' },
]

export const LINAR_BACKINGS: { id: LinarBacking; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'acoustic-fleece', label: 'Acoustic fleece' },
  { id: 'acoustic-wool', label: 'Acoustic wool' },
  { id: 'felt', label: 'Felt' },
]

export type LinarViewId = 'hero' | 'closeup' | 'side' | 'reverse' | 'bent'
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
  thicknessMm: 9,
  incisionLengthMm: LINAR_REFERENCE_OPENING_LENGTH_MM,
  cutWidthMm: 4,
  slatWidthMm: 4,
  incisedTwelfths: 12,
  pattern: 'regular',
  application: 'freestanding',
  backing: 'none',
}

export function cloneConfig(config: LinarConfig): LinarConfig {
  return { ...config }
}
