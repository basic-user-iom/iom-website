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

export const DEFAULT_LINAR_CONFIG: LinarConfig = {
  material: 'mdf',
  thicknessMm: 10,
  incisionLengthMm: 66,
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
