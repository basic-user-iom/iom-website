export type ModelVariantKey = 'web' | 'quest'

export type PinnedJsonAsset = {
  url: string
  sha256: string
  bytes: number
}

export type HlodStreamingConfig = {
  /** Both this flag and manifest.enabled must be true. Omit in production until pilot approval. */
  enabled: boolean
  /** Animation-aware package manifest v3 for desktop/mobile Web. */
  web: string
  /** Optional Quest-specific manifest. No fallback to the Web package set. */
  quest?: string
  /** Independent entry pins prevent a stale/replaced package manifest from activating. */
  sourceSha256: Record<ModelVariantKey, string>
  rigSha256: string
  /** The manifest supplies every payload hash, so the manifest bytes must also be pinned. */
  manifestSha256: Record<ModelVariantKey, string>
  manifestBytes: Record<ModelVariantKey, number>
  /** Dedicated streamed collision must be verified before it can be committed. */
  collisionSha256: string
  collisionBytes: number
  /** SHA-bound authored coverage plus exact live collision-metric activation gate. */
  collisionActivation: {
    contract: PinnedJsonAsset
    coverageReport: PinnedJsonAsset
  }
}

export type ModelManifestEntry = {
  id: string
  name: string
  web: string
  quest?: string
  /** Uniform scale applied after load (meter-scale assets default to 1). */
  scale?: number
  rotation?: [number, number, number]
  playerHeight?: number
  playerRadius?: number
  eyeHeight?: number
  spawn?: [number, number, number]
  shadowProfile?: string
  /** Optional character asset override (defaults to shared Xbot). */
  characterUrl?: string
  /** Optional dedicated collision GLB (COLLIDER_* meshes). Falls back to visual heuristics. */
  collision?: string
  /** When false, validated dedicated walk-coarse collision is used without visual walk merge. */
  collisionMergeVisual?: boolean
  /** Floor-band height in meters for visual residency (default ~3.6). */
  floorBandHeight?: number
  /** Optional spatial sidecar from optimize bake (Phase C). */
  spatialMeta?: string
  /** Web cell manifest. Ignored on Quest and when the bake is unsafe for animated models. */
  cellManifest?: string
  /** Quest cell manifest (optional). Falls back to monolithic quest GLB. */
  cellManifestQuest?: string
  /**
   * Guarded animation-aware HLOD packages. Legacy cellManifest v2 routes stay
   * disabled; this v3 route requires explicit entry + manifest opt-in.
   */
  hlodStreaming?: HlodStreamingConfig
  /** Lightweight rig + clips GLB for streamed layers (bind target nodes). */
  animation?: string
  /** When true, play embedded GLB animations after load. Default: start paused. */
  autoPlayAnimation?: boolean
  /**
   * Optional lighting-only lightmap (linear). Bound to TEXCOORD_1 / uv1.
   * Not a core glTF material slot — project metadata only.
   */
  lightmap?: string
  /** Three.js lightMapIntensity. Default 1. */
  lightMapIntensity?: number
  /**
   * When set, this layer is a visual patch for `replaces`.
   * The host's triangles inside `replaceAabb` are clipped at load.
   */
  replaces?: string
  replaceAabb?: { min: [number, number, number]; max: [number, number, number] }
  /** Hide from the Layers panel (still loaded with the host). */
  hideInLayerList?: boolean
  /**
   * Reference / A-B layer: skip CAD prep, collision, and instancing so the
   * authored GLB can be compared with the live exterior.
   */
  compareVisual?: boolean
}

export type ModelManifest = {
  version: number
  models: ModelManifestEntry[]
  defaultModelId?: string
  /** Models loaded together at startup (both visible). Falls back to defaultModelId. */
  initialModelIds?: string[]
}

export type LoadProgress = {
  stage: string
  /** 0–1 when known; null when indeterminate */
  ratio: number | null
  message: string
}

export type ModelLoadResult = {
  root: import('three').Group
  url: string
  transferredBytes: number | null
  downloadMs: number
  parseMs: number
  fileSizeBytes: number | null
  animations: import('three').AnimationClip[]
}

export type LoadedModelLayer = {
  id: string
  entry: ModelManifestEntry
  root: import('three').Object3D
  result: ModelLoadResult
  visible: boolean
  /** Phase C — cell streaming replaces monolithic web GLB load. */
  streaming?: boolean
}

export type AnimationTransportState = {
  available: boolean
  playing: boolean
  time: number
  duration: number
  label: string
}
