/**
 * Versioned Automotive Studio project schema (Phase 1 skeleton).
 * Planning model from docs/automotive-studio-plan.md §21 — not a frozen contract.
 */

export const AUTOMOTIVE_SCHEMA_VERSION = 5 as const

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

/** Authored PBR edits keyed by semantic node — survive reload / quality switch. */
export interface MaterialOverrideProps {
  visible?: boolean
  color?: string
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
  transparent?: boolean
  envMapIntensity?: number
  clearcoat?: number
  clearcoatRoughness?: number
  transmission?: number
}

export interface MaterialNodeOverride {
  id: string
  node: SemanticNodeRef
  materialSlot: number
  materialName?: string
  /** shared-material mutates the GLB material; mesh-local reserved for future cloning. */
  scope: 'shared-material' | 'mesh-local'
  props: MaterialOverrideProps
}

export type VehiclePolishMode = 'auto' | 'off'

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
  /** Heuristic glass/paint/chrome polish on import. Off = leave GLB materials as authored. */
  polishMode: VehiclePolishMode
  /** Persistent material edits from the Objects panel. */
  materialOverrides: MaterialNodeOverride[]
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

export interface StageSurfaceMaps {
  mapAssetId?: string | null
  normalMapAssetId?: string | null
  roughnessMapAssetId?: string | null
  metalnessMapAssetId?: string | null
  /** Height / depth map for displacement. */
  displacementMapAssetId?: string | null
  aoMapAssetId?: string | null
  emissiveMapAssetId?: string | null
}

export interface StageSurface {
  color: string
  metalness: number
  roughness: number
  emissive: string
  emissiveIntensity: number
  /** UV tiling for maps. */
  mapRepeat: number
  displacementScale: number
  maps: StageSurfaceMaps
}

export interface StageState {
  floorVisible: boolean
  cycloramaVisible: boolean
  /** Show the short reflective pedestal under the vehicle. */
  pedestalVisible: boolean
  /** Floor diameter in metres. */
  floorSize: number
  /** Pedestal diameter in metres. */
  pedestalSize: number
  /** Cyclorama radius in metres. */
  cycloramaSize: number
  /** Cyclorama wall height in metres. */
  cycloramaHeight: number
  floor: StageSurface
  pedestal: StageSurface
  cyclorama: StageSurface
}

/** Arcade free-drive (WASD) — mutually exclusive with an active route. */
export interface FreeDriveState {
  enabled: boolean
  cruiseKmh: number
  accelMps2: number
  brakeMps2: number
  maxSteerDeg: number
  bodyRollDeg: number
  tireRollRate: number
  chaseCamera: boolean
}

export function createDefaultFreeDrive(): FreeDriveState {
  return {
    enabled: false,
    cruiseKmh: 50,
    accelMps2: 6,
    brakeMps2: 10,
    maxSteerDeg: 38,
    bodyRollDeg: 0,
    tireRollRate: 1,
    chaseCamera: true,
  }
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
  /** Follow-cam behind the vehicle while the route plays. */
  chaseCamera?: boolean
  /** Chase orbit yaw relative to travel, degrees (0 = rear). */
  chaseOrbitYawDeg?: number
  /** Chase elevation above horizon, degrees. */
  chaseOrbitPitchDeg?: number
  /** Chase camera distance in metres. */
  chaseDistance?: number
  /** Look-at offset along the vehicle nose, metres (positive = toward front). */
  chaseLookAhead?: number
  /** Lateral look-at offset, metres (positive = vehicle right). */
  chaseLookSide?: number
  /** Demo oval size multiplier (1 = default rx/rz). Ignored once waypoints are hand-edited. */
  ovalScale?: number
  /** Open demo path size multiplier. Cleared once waypoints are hand-edited. */
  openScale?: number
  /** Max body lean in corners, degrees. 0 = off. */
  bodyRollDeg?: number
  /** Forward accel toward cruise, m/s². */
  accelMps2?: number
  /** Brake / reverse-direction rate, m/s². */
  brakeMps2?: number
  /** Travel direction along the path. -1 = reverse. */
  direction?: 1 | -1
  /** Open-path: accel from standstill at the start (m/s²). Defaults to accelMps2. */
  startAccelMps2?: number
  /** Open-path: brake rate used to stop at the end (m/s²). Defaults to brakeMps2. */
  endStopMps2?: number
}

export type EnvironmentPresetId = 'studio' | 'day' | 'golden-hour' | 'night' | 'custom'

export interface EnvironmentState {
  presetId: EnvironmentPresetId
  /**
   * Visual family used when `presetId === 'custom'` after slider edits.
   * Never inferred from a single elevation threshold (audit §5.8).
   */
  basePresetId: Exclude<EnvironmentPresetId, 'custom'>
  /** True after the author tweaks a built-in preset without switching presets. */
  customized: boolean
  /** Tone-mapping / camera exposure only — not multiplied into light power. */
  exposure: number
  /** Scene.environmentIntensity (IBL response). */
  environmentIntensity: number
  fogDensity: number
  /** Softer procedural sky dome response (not a real HDRI load). */
  hdrBackground: boolean
  starsEnabled: boolean

  // —— Sun (independent of moon) ——
  /** Drive the directional key from the sun (day/golden). Off at night when moon key is used. */
  sunEnabled: boolean
  sunAzimuthDeg: number
  sunElevationDeg: number
  sunDiscVisible: boolean
  /** Apparent angular diameter in degrees (real Moon/Sun ≈ 0.53°). */
  sunAngularDiameterDeg: number
  /** Artistic size multiplier on top of angular diameter (1 = physical default). */
  sunDiscScale: number
  /** Directional sun/key intensity multiplier. */
  sunIntensity: number

  // —— Moon (independent of sun) ——
  moonEnabled: boolean
  moonAzimuthDeg: number
  moonElevationDeg: number
  /** Apparent angular diameter in degrees. */
  moonAngularDiameterDeg: number
  moonScale: number
  moonIntensity: number
  /** 0 = new, 0.5 = full, 1 = new (phase cycle). */
  moonPhase: number
  /** When true and moon is above horizon, directional key follows the moon. */
  moonAsKeyLight: boolean
}

export type UiChromeTheme = 'dark' | 'light'

/** Semantic automotive lamp groups (audit §10.3). */
export type VehicleLightGroupId =
  | 'drl'
  | 'lowBeam'
  | 'highBeam'
  | 'tail'
  | 'brake'
  | 'indicatorLeft'
  | 'indicatorRight'
  | 'hazards'
  | 'reverse'
  | 'interior'

export const VEHICLE_LIGHT_GROUP_IDS: VehicleLightGroupId[] = [
  'drl',
  'lowBeam',
  'highBeam',
  'tail',
  'brake',
  'indicatorLeft',
  'indicatorRight',
  'hazards',
  'reverse',
  'interior',
]

export interface VehicleLightTarget {
  node: SemanticNodeRef
  materialSlot?: number
  materialName?: string
}

export interface VehicleLightsState {
  /** Which groups are author-on (hazards implies both indicators blink). */
  groups: Record<VehicleLightGroupId, boolean>
  /** Global gain for emissive / proxy intensity, 0–2. */
  intensity: number
  /** Spawn small shadowless PointLights near matched lenses. */
  proxiesEnabled: boolean
  /** When env is night and author has not customized lights, propose DRL+tail. */
  autoRunningAtNight: boolean
  /**
   * Manual mesh bindings per group. When a group key is present (even empty),
   * heuristics are skipped for that group and only listed targets are used.
   */
  targets: Partial<Record<VehicleLightGroupId, VehicleLightTarget[]>>
  /** Luminance-threshold bloom for lamps / sun / moon (WebGL2 composer). */
  bloomEnabled: boolean
  bloomStrength: number
  bloomThreshold: number
}

export type VehicleLightSequenceId = 'welcome' | 'farewell'

export function createDefaultVehicleLights(): VehicleLightsState {
  return {
    groups: {
      drl: false,
      lowBeam: false,
      highBeam: false,
      tail: false,
      brake: false,
      indicatorLeft: false,
      indicatorRight: false,
      hazards: false,
      reverse: false,
      interior: false,
    },
    intensity: 1,
    proxiesEnabled: true,
    autoRunningAtNight: true,
    targets: {},
    bloomEnabled: false,
    bloomStrength: 0.28,
    bloomThreshold: 1.0,
  }
}

export interface AccentLightState {
  enabled: boolean
  /** Soft volumetric glow planes (cheap stand-in, not true volumetric fog). */
  volumetricEnabled: boolean
  /** Accent intensity multiplier, 0–2. */
  intensity: number
}

export interface Shot {
  id: string
  name: string
  holdSeconds: number
  transitionSeconds: number
  cameraPosition?: Vec3
  cameraTarget?: Vec3
  fov?: number
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
  | { type: 'vehicleLight.set'; groupId: VehicleLightGroupId; on: boolean }
  | { type: 'vehicleLight.toggle'; groupId: VehicleLightGroupId }
  | { type: 'vehicleLight.sequence'; sequenceId: VehicleLightSequenceId }

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
  /** Epoch ms stamped on each IndexedDB save (reopen / picker ordering). */
  updatedAt?: number
  assets: AssetRecord[]
  activeVehicleId: string | null
  stage: StageState
  vehicle: VehicleState | null
  route: VehicleRoute | null
  freeDrive: FreeDriveState
  environment: EnvironmentState
  accentLights: AccentLightState
  vehicleLights: VehicleLightsState
  shots: Shot[]
  timeline: TimelineState
  hotspots: Hotspot[]
  presentation: PresentationSettings
  credits: CreditRecord[]
}

export function createDefaultStageSurface(
  color: string,
  metalness: number,
  roughness: number,
): StageSurface {
  return {
    color,
    metalness,
    roughness,
    emissive: '#000000',
    emissiveIntensity: 0,
    mapRepeat: 1,
    displacementScale: 0,
    maps: {},
  }
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
      pedestalVisible: true,
      floorSize: 28,
      pedestalSize: 4.8,
      cycloramaSize: 14,
      cycloramaHeight: 10,
      floor: createDefaultStageSurface('#161a22', 0.35, 0.55),
      pedestal: createDefaultStageSurface('#1c222c', 0.45, 0.4),
      cyclorama: createDefaultStageSurface('#1a1f28', 0.05, 0.92),
    },
    vehicle: null,
    route: null,
    freeDrive: createDefaultFreeDrive(),
    environment: {
      presetId: 'studio',
      basePresetId: 'studio',
      customized: false,
      exposure: 1,
      environmentIntensity: 1,
      fogDensity: 0,
      hdrBackground: true,
      starsEnabled: false,
      sunEnabled: true,
      sunAzimuthDeg: 135,
      sunElevationDeg: 42,
      sunDiscVisible: true,
      sunAngularDiameterDeg: 0.53,
      sunDiscScale: 1,
      sunIntensity: 1,
      moonEnabled: false,
      moonAzimuthDeg: 295,
      moonElevationDeg: 28,
      moonAngularDiameterDeg: 0.53,
      moonScale: 1,
      moonIntensity: 1,
      moonPhase: 0.5,
      moonAsKeyLight: false,
    },
    accentLights: {
      enabled: false,
      volumetricEnabled: false,
      intensity: 1,
    },
    vehicleLights: createDefaultVehicleLights(),
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
