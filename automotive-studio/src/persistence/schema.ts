/**
 * Versioned Automotive Studio project schema (Phase 1 skeleton).
 * Planning model from docs/automotive-studio-plan.md §21 — not a frozen contract.
 */

export const AUTOMOTIVE_SCHEMA_VERSION = 1 as const

export type ExperienceMode = 'studio' | 'preview' | 'guided' | 'explore'

export type Vec3 = [number, number, number]

export interface CreditRecord {
  id: string
  label: string
  detail?: string
  url?: string
}

export interface AssetRecord {
  id: string
  role: 'vehicle-master' | 'vehicle-high' | 'vehicle-balanced' | 'vehicle-mobile' | 'prop' | 'environment' | 'image' | 'video' | 'other'
  filename: string
  contentHash?: string
  byteSize?: number
  /** Blob keys live in IndexedDB; never embed large binaries in JSON. */
  blobKey?: string
}

export interface SemanticNodeRef {
  iomId?: string
  path?: string
  name?: string
}

export interface WheelBinding {
  id: 'FL' | 'FR' | 'RL' | 'RR'
  steeringNode?: SemanticNodeRef
  rollingNode?: SemanticNodeRef
  staticBrakeGroup?: SemanticNodeRef
  radiusMetres?: number
  axleAxis?: 'x' | 'y' | 'z'
  rollingDriver: 'route-distance' | 'embedded-clip' | 'off'
}

export interface SemanticAction {
  id: string
  label: string
  sourceClipId?: string
  timeRange?: [number, number]
  trackFilter?: SemanticNodeRef[]
  mode: 'play' | 'toggle' | 'momentary'
  reverseActionId?: string
}

export interface VehicleRigManifest {
  assetFingerprint: string
  primaryRoot: SemanticNodeRef
  boundsExclusions: SemanticNodeRef[]
  forwardAxis: string
  upAxis: string
  wheels: WheelBinding[]
  semanticActions: SemanticAction[]
  preservedNodes: SemanticNodeRef[]
}

export interface VehicleState {
  assetId: string
  name: string
  lengthMetres: number | null
  widthMetres: number | null
  heightMetres: number | null
  grounded: boolean
  forwardAxis: string
  upAxis: string
  targetLengthMetres: number | null
  uniformScale: number
  groundOffsetMetres: number
  flip180: boolean
  /** Last import analysis snapshot (serializable subset). */
  analysis: {
    filename: string
    byteSize: number
    nodes: number
    meshes: number
    vertices: number
    triangles: number
    materials: number
    textures: number
    maxTextureResolution: number
    estimatedDecodedTextureBytes: number
    animations: Array<{ name: string; duration: number; trackCount: number }>
    extensions: string[]
    warnings: string[]
    bounds: { x: number; y: number; z: number }
    likelyUnits: string
  } | null
  rig: VehicleRigManifest | null
}

export interface StageState {
  floorVisible: boolean
  cycloramaVisible: boolean
}

export interface VehicleRoute {
  id: string
  closed: boolean
  pointsMetres: Vec3[]
  speedKmh: number
  /** Artistic multiplier on distance-linked tire roll. 1 = no wheel slip. */
  tireRollRate?: number
  /** Front-wheel steering lock in degrees. */
  maxSteerDeg?: number
}

export type EnvironmentPresetId = 'studio' | 'day' | 'golden-hour' | 'night' | 'custom'

export interface EnvironmentState {
  presetId: EnvironmentPresetId
  exposure: number
  environmentIntensity: number
  fogDensity: number
  /** Degrees, 0 = +Z, increases clockwise looking down. */
  sunAzimuthDeg: number
  /** Degrees above horizon; negative = below. */
  sunElevationDeg: number
  /** Procedural HDR-style sky/IBL stand-in until licensed HDR maps (Phase 5). */
  hdrBackground: boolean
  starsEnabled: boolean
  moonEnabled: boolean
}

export type UiChromeTheme = 'dark' | 'light'

export interface AccentLightState {
  enabled: boolean
  volumetricEnabled: boolean
}

export interface Shot {
  id: string
  name: string
  holdSeconds: number
  transitionSeconds: number
}

export interface TimelineState {
  durationSeconds: number
  loop: boolean
}

export type HotspotContentBlock =
  | { type: 'eyebrow'; text: string }
  | { type: 'title'; text: string }
  | { type: 'richtext'; markdown: string }
  | { type: 'image'; assetId: string; alt: string }
  | { type: 'gallery'; assetIds: string[] }
  | { type: 'video'; assetId: string; captionsAssetId?: string }
  | { type: 'specs'; rows: Array<{ label: string; value: string }> }
  | { type: 'cta'; label: string; url: string }

export type HotspotAction =
  | { type: 'action.toggle'; actionId: string }
  | { type: 'action.play'; actionId: string }
  | { type: 'shot.goTo'; shotId: string }
  | { type: 'environment.setPreset'; presetId: EnvironmentPresetId }
  | { type: 'timeline.playSequence'; sequenceId: string }
  | { type: 'link.open'; url: string }

export interface HotspotAnchor {
  assetFingerprint: string
  node: SemanticNodeRef
  localPosition: Vec3
  localNormal: Vec3
  offset: number
  fallbackVehicleCoordinate?: Vec3
}

export interface Hotspot {
  id: string
  name: string
  anchor: HotspotAnchor
  markerLabel: string
  blocks: HotspotContentBlock[]
  actions: HotspotAction[]
  exploreVisible: boolean
  closeBehavior: 'keep-state' | 'reverse-actions' | 'reset-sequence'
}

export interface PresentationSettings {
  accessPolicy: 'local-only' | 'access-controlled' | 'unlisted' | 'public'
  branding: 'iom' | 'neutral' | 'configurable'
  defaultMode: 'guided' | 'explore'
  allowEnvironmentSwitch: boolean
}

export interface AutomotiveProject {
  schemaVersion: number
  id: string
  name: string
  dirty?: boolean
  assets: AssetRecord[]
  activeVehicleId: string | null
  stage: StageState
  vehicle: VehicleState | null
  route: VehicleRoute | null
  environment: EnvironmentState
  accentLights: AccentLightState
  shots: Shot[]
  timeline: TimelineState
  hotspots: Hotspot[]
  presentation: PresentationSettings
  credits: CreditRecord[]
}

export function createEmptyProject(name = 'Untitled Automotive Project'): AutomotiveProject {
  return {
    schemaVersion: AUTOMOTIVE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name,
    assets: [],
    activeVehicleId: null,
    stage: {
      floorVisible: true,
      cycloramaVisible: true,
    },
    vehicle: null,
    route: null,
    environment: {
      presetId: 'studio',
      exposure: 1,
      environmentIntensity: 1,
      fogDensity: 0,
      sunAzimuthDeg: 135,
      sunElevationDeg: 42,
      hdrBackground: true,
      starsEnabled: false,
      moonEnabled: false,
    },
    accentLights: {
      enabled: false,
      volumetricEnabled: false,
    },
    shots: [],
    timeline: {
      durationSeconds: 0,
      loop: false,
    },
    hotspots: [],
    presentation: {
      accessPolicy: 'local-only',
      branding: 'iom',
      defaultMode: 'guided',
      allowEnvironmentSwitch: false,
    },
    credits: [
      {
        id: 'iom',
        label: 'IOM — Interactive Object Media',
        url: 'https://iobjectm.com',
      },
    ],
  }
}
