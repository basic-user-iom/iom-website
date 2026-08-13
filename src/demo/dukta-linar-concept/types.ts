export type LinarMaterialId = 'mdf' | 'plywood' | 'three-layer'

export type LinarState = {
  targetBend: number
  displayedBend: number
  material: LinarMaterialId
  hasUserInteracted: boolean
}

export const LINAR_MATERIALS: { id: LinarMaterialId; label: string }[] = [
  { id: 'mdf', label: 'MDF' },
  { id: 'plywood', label: 'Plywood' },
  { id: 'three-layer', label: '3-Layer Board' },
]
