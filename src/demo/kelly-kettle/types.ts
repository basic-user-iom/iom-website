import type { Group, Object3D } from 'three'

export const SEMANTIC_NAMES = [
  'kettle_procedural_root',
  'kettle_shell_outer',
  'kettle_shell_cutaway',
  'kettle_shell_inner',
  'kettle_exterior_full',
  'kettle_exterior_cutaway',
  'chimney_inner',
  'chimney_full',
  'chimney_cutaway',
  'water_jacket',
  'water_spout',
  'green_whistle',
  'whistle_root',
  'handle_wire',
  'handle_grip',
  'handle_pivot_group',
  'handle_wood_grip',
  'pouring_chain',
  'whistle_chain',
  'chain_body_bracket',
  'fire_base',
  'fire_base_air_hole',
  'fuel_group',
  'fuel_twigs',
  'ember_core',
  'flame_group',
  'base_flames',
  'chimney_flame',
  'ember_sparks',
  'fire_light_base',
  'fire_light_chimney',
  'airflow_particles',
  'heatflow_particles',
  'educational_cool_air_particles',
  'educational_heat_particles',
  'steam_particles',
] as const

export type SemanticName = (typeof SEMANTIC_NAMES)[number]

export type DemoStep = 'explore' | 'cutaway' | 'fire' | 'complete'

export type QualityLevel = 'high' | 'mobile'

export type ModelSource = 'procedural' | 'glb'

export type ModelParts = Partial<Record<SemanticName, Object3D>>

export type ExteriorMode = 'auto' | 'exterior' | 'cutaway'

export type ModelUpdate = {
  cutawayProgress: number
  fireProgress: number
  waterHeatProgress: number
  airflowVisible: boolean
  waterVisible: boolean
  particleCount: number
  reducedMotion: boolean
  fireIntensity: number
  handleAngle: number
  whistleInserted: boolean
  chainVisible: boolean
  chainDebug: boolean
  handleCollisionDebug: boolean
  emberIntensity: number
  chimneyFlameHeight: number
  exteriorOrCutaway: ExteriorMode
  metalRoughness: number
}

export type KellyKettleModelHandle = {
  group: Group
  parts: ModelParts
  source: ModelSource
  triangleCount: number
  assetBytes: number
  update: (state: ModelUpdate) => void
  dispose: () => void
}

export type LabelAnchor = {
  id: string
  text: string
  x: number
  y: number
  visible: boolean
  side: 'left' | 'right'
}

export type CameraPose = {
  px: number
  py: number
  pz: number
  tx: number
  ty: number
  tz: number
  fov: number
}

export type SavedLabel = {
  id: string
  text: string
  x: number
  y: number
  side: 'left' | 'right'
}

export type StepViewSetup = {
  camera: CameraPose | null
  labels: SavedLabel[]
}

export type SceneStats = {
  fps: number
  triangles: number
  transferredBytes: number
  modelSource: ModelSource
}

export type DebugControls = {
  modelSource: ModelSource
  forceCutaway: boolean
  fireIntensity: number
  airflowVisible: boolean
  waterVisible: boolean
  particleCount: number
  autoRotate: boolean
  mobilePerformance: boolean
  silhouetteCompare: boolean
  handleAngle: number
  whistleInserted: boolean
  chainVisible: boolean
  chainDebug: boolean
  handleCollisionDebug: boolean
  emberIntensity: number
  chimneyFlameHeight: number
  exteriorOrCutaway: ExteriorMode
  metalRoughness: number
  showReferenceOverlay: boolean
  layoutEdit: boolean
}

export const GLB_URL = '/models/kelly-kettle-basecamp-final.glb'

export const STEPS: { id: DemoStep; label: string; hint: string }[] = [
  {
    id: 'explore',
    label: 'Explore',
    hint: 'Rotate the assembled kettle on its fire base.',
  },
  {
    id: 'cutaway',
    label: 'See Inside',
    hint: 'A clean vertical section shows water around the chimney.',
  },
  {
    id: 'fire',
    label: 'Light the fire',
    hint: 'Air enters the base, heats in the chimney, and warms the water jacket.',
  },
]
