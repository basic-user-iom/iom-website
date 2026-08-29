import {
  Box3,
  Group,
  Matrix4,
  Mesh,
  Vector3,
  type AnimationClip,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three'
import type { ModelLoader } from './ModelLoader'
import { verifyModelAssetIntegrity, type ModelAssetIntegrity } from './ModelLoader'
import type { LoadProgress, ModelManifestEntry, ModelVariantKey } from './types'
import { SharedTextureResidencyRegistry } from './SharedTextureResidencyRegistry'
import { isRuntimeManagedTexture } from './runtimeTextureOwnership'

export type AnimationPackageLevel = 'lod0' | 'hlod'
export type AnimationPackageResidentLevel = AnimationPackageLevel | 'unloaded'

export type AnimationPackageEstimate = {
  triangles: number
  draws: number
  bytes: number
  encodedTextureBytes: number
  /** Conservative decoded GPU residency estimate, including mip levels. */
  gpuTextureBytes: number
}

export type AnimationPackagePayload = {
  url: string
  sha256: string
  estimates: AnimationPackageEstimate
  /** Exact bounds of this one payload level after decode. */
  bounds: AnimationPackageBounds
}

export type AnimationPackageBounds = {
  space: 'owner-local'
  min: [number, number, number]
  max: [number, number, number]
}

export type AnimationPackageManifestEntryV3 = {
  id: string
  kind: 'detail' | 'regional-hlod' | 'always-resident-shell'
  residency: 'streamed' | 'persistent-lossless'
  ownerId: string
  transform: { space: 'owner-local'; matrix: number[] }
  /** Stable focus-selection envelope containing every payload level for the variant. */
  selectionBounds: Record<ModelVariantKey, AnimationPackageBounds>
  streaming?: {
    lod0MarginMeters?: number
    lod0ExitMarginMeters?: number
    hlodMarginMeters?: number
    hlodExitMarginMeters?: number
  }
  semanticRoles: string[]
  /** Exact, globally-disjoint DCC source ownership represented by this package. */
  sourcePaths: Record<ModelVariantKey, string[]>
  /** Attributes guaranteed on every primitive. Texture UV needs are checked per primitive/material. */
  requiredAttributes: string[]
  variants: Record<
    ModelVariantKey,
    Partial<Record<AnimationPackageLevel, AnimationPackagePayload>>
  >
}

export type AnimationPackageManifestV3 = {
  version: 3
  enabled: true
  modelId: string
  units: 'meters'
  source: {
    animationDurationSeconds: number
    variants: Record<ModelVariantKey, { url: string; sha256: string }>
    ownership: Record<ModelVariantKey, {
      mode: 'disjoint-additive'
      pathCount: number
      pathsSha256: string
    }>
  }
  rig: {
    url: string
    sha256: string
    bytes: number
    animationDurationSeconds: number
    clips: Array<{ name: string; durationSeconds: number }>
    owners: Array<{ id: string; nodeName: string; persistent: true }>
  }
  budgets: {
    maxDetailTriangles: number
    maxAlwaysResidentShellTriangles: number
    maxResident: Record<ModelVariantKey, AnimationPackageEstimate>
    maxTransitionPeak: Record<ModelVariantKey, AnimationPackageEstimate>
  }
  packages: AnimationPackageManifestEntryV3[]
  residentSets: Record<
    ModelVariantKey,
    Array<{ packageId: string; level: AnimationPackageLevel }>
  >
}

export type AnimationPackageManifestPins = {
  modelId: string
  sourceSha256: string
  rigSha256: string
}

export type AnimationPackageManifestIntegrity = ModelAssetIntegrity

export type AnimationPackageStreamFocus = { x: number; y: number; z: number }

export type AnimationPackageStreamState = {
  loaded: string[]
  pending: string[]
  residentTriangles: number
  residentDraws: number
  residentBytes: number
  residentEncodedTextureBytes: number
  residentGpuTextureBytes: number
  levels: Record<string, AnimationPackageLevel>
}

export type AnimationPackageStreamChangeEvent = {
  loaded: string[]
  unloaded: string[]
  layerId: string
  /** Package swaps never replace the persistent rig or its clips. */
  animationChanged: false
}

export type AnimationPackagePrepareIncoming = (
  root: Object3D,
  pkg: AnimationPackageManifestEntryV3,
  level: AnimationPackageLevel,
  signal: AbortSignal,
) => void | Promise<void>

type LoadedPackage = {
  pkg: AnimationPackageManifestEntryV3
  level: AnimationPackageLevel
  root: Object3D
  estimate: AnimationPackageEstimate
}

type TransitionAccumulator = { loaded: string[]; unloaded: string[] }

type ResourceSet = {
  geometries: Set<BufferGeometry>
  materials: Set<Material>
  textures: Set<Texture>
}

type ActiveOperation = {
  controller: AbortController
  signal: AbortSignal
  abortFromCaller: () => void
  key: string
}

type SerializedRequest = ActiveOperation & {
  promise: Promise<AnimationPackageStreamChangeEvent>
}

const VARIANTS: ModelVariantKey[] = ['web', 'quest']
const LEVELS: AnimationPackageLevel[] = ['lod0', 'hlod']
const RESOURCE_KEYS: Array<keyof AnimationPackageEstimate> = [
  'triangles',
  'draws',
  'bytes',
  'encodedTextureBytes',
  'gpuTextureBytes',
]
const SHA256 = /^[a-fA-F0-9]{64}$/
const MAX_DETAIL_TRIANGLES = 250_000
const MAX_SHELL_TRIANGLES = 150_000
const HARD_RESIDENT: Record<ModelVariantKey, AnimationPackageEstimate> = {
  web: { triangles: 2_000_000, draws: 1_200, bytes: 512 * 1024 * 1024, encodedTextureBytes: 256 * 1024 * 1024, gpuTextureBytes: 768 * 1024 * 1024 },
  quest: { triangles: 800_000, draws: 500, bytes: 256 * 1024 * 1024, encodedTextureBytes: 64 * 1024 * 1024, gpuTextureBytes: 192 * 1024 * 1024 },
}
const HARD_PEAK: Record<ModelVariantKey, AnimationPackageEstimate> = {
  web: { triangles: 2_500_000, draws: 1_600, bytes: 768 * 1024 * 1024, encodedTextureBytes: 384 * 1024 * 1024, gpuTextureBytes: 1024 * 1024 * 1024 },
  quest: { triangles: 1_000_000, draws: 650, bytes: 384 * 1024 * 1024, encodedTextureBytes: 96 * 1024 * 1024, gpuTextureBytes: 256 * 1024 * 1024 },
}
const DETAIL_BOUNDS_MARGIN_METERS = 1.5
const REGIONAL_HLOD_MARGIN_METERS = 35
const DETAIL_HYSTERESIS_METERS = 2
const REGIONAL_HYSTERESIS_METERS = 5
const BOUNDS_EPSILON_METERS = 0.02
const LOSSLESS_ROLES = new Set(['fire-safety', 'building-connection'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveSafeInteger(value: unknown, allowZero = false): value is number {
  return Number.isSafeInteger(value) && (value as number) >= (allowZero ? 0 : 1)
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

async function stringListSha256(values: Iterable<string>): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify([...values].sort()))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

async function assertOwnershipDigests(manifest: AnimationPackageManifestV3): Promise<void> {
  for (const variant of VARIANTS) {
    const paths = manifest.packages.flatMap((pkg) => pkg.sourcePaths[variant])
    const observed = await stringListSha256(paths)
    const expected = manifest.source.ownership[variant].pathsSha256.toLowerCase()
    if (observed !== expected) {
      throw new Error(`Unsafe animation package manifest: source.ownership.${variant}.pathsSha256 does not match declared package sourcePaths`)
    }
  }
}

function finiteTuple(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

function emptyEstimate(): AnimationPackageEstimate {
  return { triangles: 0, draws: 0, bytes: 0, encodedTextureBytes: 0, gpuTextureBytes: 0 }
}

function addEstimate(
  left: AnimationPackageEstimate,
  right: AnimationPackageEstimate,
): AnimationPackageEstimate {
  return {
    triangles: left.triangles + right.triangles,
    draws: left.draws + right.draws,
    bytes: left.bytes + right.bytes,
    encodedTextureBytes: left.encodedTextureBytes + right.encodedTextureBytes,
    gpuTextureBytes: left.gpuTextureBytes + right.gpuTextureBytes,
  }
}

function subtractEstimate(
  left: AnimationPackageEstimate,
  right: AnimationPackageEstimate,
): AnimationPackageEstimate {
  return {
    triangles: left.triangles - right.triangles,
    draws: left.draws - right.draws,
    bytes: left.bytes - right.bytes,
    encodedTextureBytes: left.encodedTextureBytes - right.encodedTextureBytes,
    gpuTextureBytes: left.gpuTextureBytes - right.gpuTextureBytes,
  }
}

function firstBudgetExceeded(
  value: AnimationPackageEstimate,
  budget: AnimationPackageEstimate,
): keyof AnimationPackageEstimate | null {
  return RESOURCE_KEYS.find((key) => value[key] > budget[key]) ?? null
}

function abortError(message: string): DOMException {
  return new DOMException(message, 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError('Animation package load was superseded')
}

function collectResources(root: Object3D): ResourceSet {
  const resources: ResourceSet = {
    geometries: new Set<BufferGeometry>(),
    materials: new Set<Material>(),
    textures: new Set<Texture>(),
  }
  root.traverse((object) => {
    const renderable = object as Mesh & {
      isLine?: boolean
      isPoints?: boolean
      isSprite?: boolean
      geometry?: BufferGeometry
      material?: Material | Material[]
    }
    if (!renderable.isMesh && !renderable.isLine && !renderable.isPoints && !renderable.isSprite) return
    if (renderable.geometry) resources.geometries.add(renderable.geometry)
    const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material]
    for (const material of materials) {
      if (!material) continue
      resources.materials.add(material)
      const values = material as Material & Record<string, unknown>
      for (const value of Object.values(values)) {
        if (
          value &&
          typeof value === 'object' &&
          (value as Texture).isTexture &&
          !isRuntimeManagedTexture(value as Texture)
        ) {
          resources.textures.add(value as Texture)
        }
      }
    }
  })
  return resources
}

/** Dispose only resources that are not referenced by another live package. */
function disposeIsolatedRoot(root: Object3D, protectedRoots: Iterable<Object3D>): void {
  const candidates = collectResources(root)
  const protectedResources: ResourceSet = {
    geometries: new Set<BufferGeometry>(),
    materials: new Set<Material>(),
    textures: new Set<Texture>(),
  }
  for (const protectedRoot of protectedRoots) {
    const resources = collectResources(protectedRoot)
    for (const geometry of resources.geometries) protectedResources.geometries.add(geometry)
    for (const material of resources.materials) protectedResources.materials.add(material)
    for (const texture of resources.textures) protectedResources.textures.add(texture)
  }
  for (const geometry of candidates.geometries) {
    if (!protectedResources.geometries.has(geometry)) geometry.dispose()
  }
  for (const material of candidates.materials) {
    if (!protectedResources.materials.has(material)) material.dispose()
  }
  for (const texture of candidates.textures) {
    if (!protectedResources.textures.has(texture)) texture.dispose()
  }
  root.clear()
}

function validateStringArray(
  value: unknown,
  path: string,
  fail: (path: string, message: string) => void,
): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(path, 'must be a non-empty string array')
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  value.forEach((entry, index) => {
    if (!isString(entry)) fail(`${path}[${index}]`, 'must be a non-empty string')
    else if (seen.has(entry)) fail(`${path}[${index}]`, 'must be unique')
    else {
      seen.add(entry)
      result.push(entry)
    }
  })
  return result
}

function validateEstimateRecord(
  value: unknown,
  path: string,
  fail: (path: string, message: string) => void,
): AnimationPackageEstimate | null {
  if (!isRecord(value)) {
    fail(path, 'must declare triangles, draws, bytes, encodedTextureBytes and gpuTextureBytes')
    return null
  }
  for (const key of RESOURCE_KEYS) {
    const mayBeZero = key === 'encodedTextureBytes' || key === 'gpuTextureBytes'
    if (!isPositiveSafeInteger(value[key], mayBeZero)) {
      fail(`${path}.${key}`, mayBeZero ? 'must be non-negative' : 'must be positive')
    }
  }
  return RESOURCE_KEYS.every((key) =>
    isPositiveSafeInteger(value[key], key === 'encodedTextureBytes' || key === 'gpuTextureBytes'),
  )
    ? (value as unknown as AnimationPackageEstimate)
    : null
}

function validateRuntimeManifest(
  value: unknown,
  _variant: ModelVariantKey,
  pins: AnimationPackageManifestPins,
): { manifest: AnimationPackageManifestV3 | null; errors: string[] } {
  const errors: string[] = []
  const fail = (path: string, message: string): void => {
    errors.push(`${path}: ${message}`)
  }
  if (!isRecord(value)) return { manifest: null, errors: ['manifest: must be an object'] }
  if (value.version !== 3) fail('version', 'must equal 3; legacy cell manifests are disabled')
  if (value.enabled !== true) fail('enabled', 'must explicitly equal true')
  if (value.modelId !== pins.modelId) fail('modelId', `must equal ${pins.modelId}`)
  if (value.units !== 'meters') fail('units', 'must equal meters')

  const source = value.source
  const sourceVariants = isRecord(source) ? source.variants : null
  for (const variantName of VARIANTS) {
    const asset = isRecord(sourceVariants) ? sourceVariants[variantName] : null
    const path = `source.variants.${variantName}`
    if (!isRecord(asset) || !isString(asset.url)) fail(`${path}.url`, 'must be present')
    const hash = isRecord(asset) ? asset.sha256 : null
    if (typeof hash !== 'string' || !SHA256.test(hash)) {
      fail(`${path}.sha256`, 'must be a SHA-256 value')
    } else if (variantName === _variant && (!SHA256.test(pins.sourceSha256) || hash.toLowerCase() !== pins.sourceSha256.toLowerCase())) {
      fail(`${path}.sha256`, 'does not match the selected model-variant hash pin')
    }
  }
  const sourceDuration = isRecord(source) ? source.animationDurationSeconds : null
  if (typeof sourceDuration !== 'number' || !Number.isFinite(sourceDuration) || sourceDuration <= 0) {
    fail('source.animationDurationSeconds', 'must be a finite number > 0')
  }

  const rigAsset = value.rig
  if (!isRecord(rigAsset) || !isString(rigAsset.url)) fail('rig.url', 'must be present')
  const rigHash = isRecord(rigAsset) ? rigAsset.sha256 : null
  if (typeof rigHash !== 'string' || !SHA256.test(rigHash)) {
    fail('rig.sha256', 'must be a SHA-256 value')
  } else if (!SHA256.test(pins.rigSha256) || rigHash.toLowerCase() !== pins.rigSha256.toLowerCase()) {
    fail('rig.sha256', 'does not match the model-entry hash pin')
  }
  const rigDurationValue = isRecord(rigAsset) ? rigAsset.animationDurationSeconds : null
  if (typeof rigDurationValue !== 'number' || !Number.isFinite(rigDurationValue) || rigDurationValue <= 0) {
    fail('rig.animationDurationSeconds', 'must be a finite number > 0')
  }
  const sourceOwnership = isRecord(value.source) ? value.source.ownership : null
  for (const variantName of VARIANTS) {
    const ownership = isRecord(sourceOwnership) ? sourceOwnership[variantName] : null
    if (!isRecord(ownership) || ownership.mode !== 'disjoint-additive') {
      fail(`source.ownership.${variantName}.mode`, 'must equal disjoint-additive')
    }
    if (!isRecord(ownership) || !isPositiveSafeInteger(ownership.pathCount)) {
      fail(`source.ownership.${variantName}.pathCount`, 'must be a positive safe integer')
    }
    if (!isRecord(ownership) || typeof ownership.pathsSha256 !== 'string' || !SHA256.test(ownership.pathsSha256)) {
      fail(`source.ownership.${variantName}.pathsSha256`, 'must be a SHA-256 value')
    }
  }
  const rigDuration = isRecord(value.rig) ? value.rig.animationDurationSeconds : null
  if (
    typeof sourceDuration === 'number' &&
    Number.isFinite(sourceDuration) &&
    typeof rigDuration === 'number' &&
    Number.isFinite(rigDuration) &&
    Math.abs(sourceDuration - rigDuration) > 1e-6
  ) {
    fail('rig.animationDurationSeconds', 'must match source.animationDurationSeconds')
  }

  const rig = value.rig
  if (!isRecord(rig) || !isPositiveSafeInteger(rig.bytes)) fail('rig.bytes', 'must be positive')
  const declaredClips = isRecord(rig) ? rig.clips : null
  const clipNames = new Set<string>()
  if (!Array.isArray(declaredClips) || declaredClips.length === 0) {
    fail('rig.clips', 'must declare every persistent rig clip')
  } else {
    declaredClips.forEach((clip, index) => {
      const path = `rig.clips[${index}]`
      if (!isRecord(clip) || !isString(clip.name)) fail(`${path}.name`, 'must be present')
      else if (clipNames.has(clip.name)) fail(`${path}.name`, 'must be unique')
      else clipNames.add(clip.name)
      if (
        !isRecord(clip) ||
        typeof clip.durationSeconds !== 'number' ||
        !Number.isFinite(clip.durationSeconds) ||
        clip.durationSeconds <= 0
      ) {
        fail(`${path}.durationSeconds`, 'must be a finite number > 0')
      }
    })
  }

  const budgets = value.budgets
  if (!isRecord(budgets)) fail('budgets', 'must be present')
  const detailBudget = isRecord(budgets) ? budgets.maxDetailTriangles : null
  const shellBudget = isRecord(budgets) ? budgets.maxAlwaysResidentShellTriangles : null
  if (!isPositiveSafeInteger(detailBudget) || detailBudget > MAX_DETAIL_TRIANGLES) {
    fail('budgets.maxDetailTriangles', `must be between 1 and ${MAX_DETAIL_TRIANGLES}`)
  }
  if (!isPositiveSafeInteger(shellBudget) || shellBudget > MAX_SHELL_TRIANGLES) {
    fail('budgets.maxAlwaysResidentShellTriangles', `must be between 1 and ${MAX_SHELL_TRIANGLES}`)
  }
  const residentBudgets: Partial<Record<ModelVariantKey, AnimationPackageEstimate>> = {}
  const peakBudgets: Partial<Record<ModelVariantKey, AnimationPackageEstimate>> = {}
  for (const variantName of VARIANTS) {
    const resident = validateEstimateRecord(
      isRecord(budgets) && isRecord(budgets.maxResident) ? budgets.maxResident[variantName] : null,
      `budgets.maxResident.${variantName}`,
      fail,
    )
    const peak = validateEstimateRecord(
      isRecord(budgets) && isRecord(budgets.maxTransitionPeak)
        ? budgets.maxTransitionPeak[variantName]
        : null,
      `budgets.maxTransitionPeak.${variantName}`,
      fail,
    )
    if (resident) {
      residentBudgets[variantName] = resident
      const hardKey = firstBudgetExceeded(resident, HARD_RESIDENT[variantName])
      if (hardKey) fail(`budgets.maxResident.${variantName}.${hardKey}`, 'exceeds runtime hard limit')
    }
    if (peak) {
      peakBudgets[variantName] = peak
      const hardKey = firstBudgetExceeded(peak, HARD_PEAK[variantName])
      if (hardKey) fail(`budgets.maxTransitionPeak.${variantName}.${hardKey}`, 'exceeds runtime hard limit')
      if (resident) {
        const tooSmall = RESOURCE_KEYS.find((key) => peak[key] < resident[key])
        if (tooSmall) fail(`budgets.maxTransitionPeak.${variantName}.${tooSmall}`, 'must be at least the resident budget')
      }
    }
  }

  const ownerIds = new Set<string>()
  const ownerNames = new Set<string>()
  const owners = isRecord(rig) ? rig.owners : null
  if (!Array.isArray(owners) || owners.length === 0) {
    fail('rig.owners', 'must contain persistent owners')
  } else {
    owners.forEach((owner, index) => {
      const path = `rig.owners[${index}]`
      if (!isRecord(owner)) {
        fail(path, 'must be an object')
        return
      }
      if (!isString(owner.id) || ownerIds.has(owner.id)) fail(`${path}.id`, 'must be unique')
      else ownerIds.add(owner.id)
      if (!isString(owner.nodeName) || ownerNames.has(owner.nodeName)) fail(`${path}.nodeName`, 'must be unique')
      else ownerNames.add(owner.nodeName)
      if (owner.persistent !== true) fail(`${path}.persistent`, 'must equal true')
    })
  }

  const packages = value.packages
  const packagesById = new Map<string, Record<string, unknown>>()
  const ownedSourcePaths: Record<ModelVariantKey, Set<string>> = { web: new Set(), quest: new Set() }
  const payloadEstimates = new Map<string, Record<ModelVariantKey, Partial<Record<AnimationPackageLevel, AnimationPackageEstimate>>>>()
  const persistentSelections = new Map<string, AnimationPackageLevel>()
  const shellTotals: Record<ModelVariantKey, AnimationPackageEstimate> = {
    web: emptyEstimate(),
    quest: emptyEstimate(),
  }
  let shellCount = 0
  if (!Array.isArray(packages) || packages.length === 0) {
    fail('packages', 'must be non-empty')
  } else {
    packages.forEach((pkg, index) => {
      const path = `packages[${index}]`
      if (!isRecord(pkg)) {
        fail(path, 'must be an object')
        return
      }
      if (!isString(pkg.id) || packagesById.has(pkg.id)) fail(`${path}.id`, 'must be unique')
      else packagesById.set(pkg.id, pkg)
      if (pkg.kind !== 'detail' && pkg.kind !== 'regional-hlod' && pkg.kind !== 'always-resident-shell') {
        fail(`${path}.kind`, 'is invalid')
      }
      if (pkg.residency !== 'streamed' && pkg.residency !== 'persistent-lossless') {
        fail(`${path}.residency`, 'is invalid')
      }
      if (pkg.kind === 'always-resident-shell') {
        shellCount += 1
        if (pkg.residency !== 'persistent-lossless') fail(`${path}.residency`, 'shell must be persistent-lossless')
        if (isString(pkg.id)) persistentSelections.set(pkg.id, 'hlod')
      } else if (pkg.kind === 'detail' && pkg.residency === 'persistent-lossless' && isString(pkg.id)) {
        persistentSelections.set(pkg.id, 'lod0')
      } else if (pkg.kind === 'regional-hlod') {
        fail(`${path}.kind`, 'regional HLOD is disabled until atomic replacement ownership is implemented')
      }
      if (!isString(pkg.ownerId) || !ownerIds.has(pkg.ownerId)) {
        fail(`${path}.ownerId`, 'must reference one persistent rig owner')
      }
      const transform = pkg.transform
      if (!isRecord(transform) || transform.space !== 'owner-local' || !finiteTuple(transform.matrix, 16)) {
        fail(`${path}.transform`, 'must be owner-local with a finite affine matrix[16]')
      } else {
        const matrix = transform.matrix
        if (
          Math.abs(matrix[3]!) > 1e-8 ||
          Math.abs(matrix[7]!) > 1e-8 ||
          Math.abs(matrix[11]!) > 1e-8 ||
          Math.abs(matrix[15]! - 1) > 1e-8
        ) {
          fail(`${path}.transform.matrix`, 'must be an affine column-major matrix')
        }
        if (Math.abs(new Matrix4().fromArray(matrix).determinant()) < 1e-8) {
          fail(`${path}.transform.matrix`, 'must be invertible')
        }
      }
      for (const variantName of VARIANTS) {
        const bounds = isRecord(pkg.selectionBounds) ? pkg.selectionBounds[variantName] : null
        const boundsMin = isRecord(bounds) ? bounds.min : null
        const boundsMax = isRecord(bounds) ? bounds.max : null
        if (!isRecord(bounds) || bounds.space !== 'owner-local' || !finiteTuple(boundsMin, 3) || !finiteTuple(boundsMax, 3)) {
          fail(`${path}.selectionBounds.${variantName}`, 'must contain finite owner-local min/max')
        } else if (boundsMax.some((entry, axis) => entry <= boundsMin[axis]!)) {
          fail(`${path}.selectionBounds.${variantName}`, 'must have positive extent on every axis')
        }
      }
      const semanticRoles = validateStringArray(pkg.semanticRoles, `${path}.semanticRoles`, fail)
      if (
        semanticRoles.some((role) => LOSSLESS_ROLES.has(role)) &&
        (pkg.kind !== 'detail' || pkg.residency !== 'persistent-lossless')
      ) {
        fail(`${path}.residency`, 'fire-safety and building-connection roles require persistent-lossless detail')
      }
      for (const variantName of VARIANTS) {
        const sourcePaths = validateStringArray(
          isRecord(pkg.sourcePaths) ? pkg.sourcePaths[variantName] : null,
          `${path}.sourcePaths.${variantName}`,
          fail,
        )
        for (const sourcePath of sourcePaths) {
          if (ownedSourcePaths[variantName].has(sourcePath)) {
            fail(`${path}.sourcePaths.${variantName}`, `duplicates global source ownership ${sourcePath}`)
          } else {
            ownedSourcePaths[variantName].add(sourcePath)
          }
        }
      }
      const attributes = validateStringArray(pkg.requiredAttributes, `${path}.requiredAttributes`, fail)
      if (!attributes.includes('POSITION')) fail(`${path}.requiredAttributes`, 'must include POSITION')
      const knownAttributes = new Set([
        'POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3',
        'TANGENT', 'COLOR_0',
      ])
      for (const attribute of attributes) {
        if (!knownAttributes.has(attribute)) fail(`${path}.requiredAttributes`, `contains unsupported ${attribute}`)
      }
      if (pkg.streaming !== undefined) {
        if (!isRecord(pkg.streaming)) fail(`${path}.streaming`, 'must be an object')
        else {
          for (const key of ['lod0MarginMeters', 'lod0ExitMarginMeters', 'hlodMarginMeters', 'hlodExitMarginMeters'] as const) {
            if (pkg.streaming[key] !== undefined && !isFiniteNonNegative(pkg.streaming[key])) {
              fail(`${path}.streaming.${key}`, 'must be finite and non-negative')
            }
          }
          if (
            isFiniteNonNegative(pkg.streaming.lod0MarginMeters) &&
            isFiniteNonNegative(pkg.streaming.lod0ExitMarginMeters) &&
            pkg.streaming.lod0ExitMarginMeters < pkg.streaming.lod0MarginMeters
          ) {
            fail(`${path}.streaming.lod0ExitMarginMeters`, 'must be at least lod0MarginMeters')
          }
          if (
            isFiniteNonNegative(pkg.streaming.hlodMarginMeters) &&
            isFiniteNonNegative(pkg.streaming.hlodExitMarginMeters) &&
            pkg.streaming.hlodExitMarginMeters < pkg.streaming.hlodMarginMeters
          ) {
            fail(`${path}.streaming.hlodExitMarginMeters`, 'must be at least hlodMarginMeters')
          }
        }
      }

      const metrics: Record<ModelVariantKey, Partial<Record<AnimationPackageLevel, AnimationPackageEstimate>>> = {
        web: {},
        quest: {},
      }
      for (const variantName of VARIANTS) {
        const payloads = isRecord(pkg.variants) ? pkg.variants[variantName] : null
        if (!isRecord(payloads)) {
          fail(`${path}.variants.${variantName}`, 'must be present')
          continue
        }
        for (const level of LEVELS) {
          const payload = payloads[level]
          if (payload === undefined) continue
          const payloadPath = `${path}.variants.${variantName}.${level}`
          if (!isRecord(payload) || !isString(payload.url)) fail(`${payloadPath}.url`, 'must be present')
          if (!isRecord(payload) || typeof payload.sha256 !== 'string' || !SHA256.test(payload.sha256)) {
            fail(`${payloadPath}.sha256`, 'must be a SHA-256 value')
          }
          const payloadBounds = isRecord(payload) ? payload.bounds : null
          const payloadBoundsMin = isRecord(payloadBounds) ? payloadBounds.min : null
          const payloadBoundsMax = isRecord(payloadBounds) ? payloadBounds.max : null
          if (
            !isRecord(payloadBounds) ||
            payloadBounds.space !== 'owner-local' ||
            !finiteTuple(payloadBoundsMin, 3) ||
            !finiteTuple(payloadBoundsMax, 3)
          ) {
            fail(`${payloadPath}.bounds`, 'must contain finite owner-local min/max')
          } else if (payloadBoundsMax.some((entry, axis) => entry <= payloadBoundsMin[axis]!)) {
            fail(`${payloadPath}.bounds`, 'must have positive extent on every axis')
          } else {
            const selection = isRecord(pkg.selectionBounds) ? pkg.selectionBounds[variantName] : null
            const selectionMin = isRecord(selection) ? selection.min : null
            const selectionMax = isRecord(selection) ? selection.max : null
            if (
              finiteTuple(selectionMin, 3) &&
              finiteTuple(selectionMax, 3) &&
              (
                payloadBoundsMin.some((entry, axis) => entry < selectionMin[axis]! - BOUNDS_EPSILON_METERS) ||
                payloadBoundsMax.some((entry, axis) => entry > selectionMax[axis]! + BOUNDS_EPSILON_METERS)
              )
            ) {
              fail(`${payloadPath}.bounds`, `must be contained by selectionBounds.${variantName}`)
            }
          }
          const estimate = validateEstimateRecord(isRecord(payload) ? payload.estimates : null, `${payloadPath}.estimates`, fail)
          if (estimate) {
            metrics[variantName][level] = estimate
            if (pkg.kind !== 'always-resident-shell' && estimate.triangles > (detailBudget as number)) {
              fail(`${payloadPath}.estimates.triangles`, 'exceeds detail triangle budget')
            }
            if (pkg.kind === 'always-resident-shell' && level === 'hlod') {
              shellTotals[variantName] = addEstimate(shellTotals[variantName], estimate)
            }
            const peak = peakBudgets[variantName]
            if (peak) {
              const tooLarge = firstBudgetExceeded(estimate, peak)
              if (tooLarge) fail(`${payloadPath}.estimates.${tooLarge}`, 'exceeds transition peak budget')
            }
          }
        }
        const lod0 = metrics[variantName].lod0
        const hlod = metrics[variantName].hlod
        if (pkg.kind === 'always-resident-shell') {
          if (!hlod) fail(`${path}.variants.${variantName}.hlod`, 'shell requires HLOD')
          if (lod0) fail(`${path}.variants.${variantName}.lod0`, 'shell must not duplicate LOD0')
        } else if (pkg.kind === 'regional-hlod') {
          if (!hlod) fail(`${path}.variants.${variantName}.hlod`, 'regional HLOD requires HLOD')
          if (lod0) fail(`${path}.variants.${variantName}.lod0`, 'regional HLOD must not contain LOD0')
        } else {
          if (!lod0) fail(`${path}.variants.${variantName}.lod0`, 'detail requires LOD0')
          if (pkg.residency === 'persistent-lossless' && hlod) {
            fail(`${path}.variants.${variantName}.hlod`, 'persistent-lossless detail must not duplicate HLOD')
          }
          if (lod0 && hlod) {
            if (hlod.triangles > lod0.triangles) fail(`${path}.variants.${variantName}.hlod.estimates.triangles`, 'must not exceed LOD0')
            if (hlod.draws > lod0.draws) fail(`${path}.variants.${variantName}.hlod.estimates.draws`, 'must not exceed LOD0')
            const streaming = isRecord(pkg.streaming) ? pkg.streaming : null
            const lod0MarginValue = streaming?.lod0MarginMeters
            const lod0ExitMarginValue = streaming?.lod0ExitMarginMeters
            const hlodMarginValue = streaming?.hlodMarginMeters
            const lod0Margin = isFiniteNonNegative(lod0MarginValue)
              ? lod0MarginValue
              : DETAIL_BOUNDS_MARGIN_METERS
            const lod0ExitMargin = isFiniteNonNegative(lod0ExitMarginValue)
              ? lod0ExitMarginValue
              : lod0Margin + DETAIL_HYSTERESIS_METERS
            const hlodMargin = isFiniteNonNegative(hlodMarginValue)
              ? hlodMarginValue
              : lod0ExitMargin
            if (hlodMargin < lod0ExitMargin) {
              fail(`${path}.streaming.hlodMarginMeters`, 'must be at least the effective lod0ExitMarginMeters when HLOD exists')
            }
          }
        }
      }
      if (isString(pkg.id)) payloadEstimates.set(pkg.id, metrics)
    })
  }
  if (shellCount !== 1) fail('packages', 'must include exactly one always-resident shell')
  for (const variantName of VARIANTS) {
    const ownership = isRecord(sourceOwnership) ? sourceOwnership[variantName] : null
    if (
      isRecord(ownership) &&
      isPositiveSafeInteger(ownership.pathCount) &&
      ownedSourcePaths[variantName].size !== ownership.pathCount
    ) {
      fail(
        `source.ownership.${variantName}.pathCount`,
        `does not match ${ownedSourcePaths[variantName].size} globally disjoint package paths`,
      )
    }
  }
  for (const variantName of VARIANTS) {
    if (isPositiveSafeInteger(shellBudget) && shellTotals[variantName].triangles > shellBudget) {
      fail(`packages.${variantName}.alwaysResidentShell`, 'exceeds shell triangle budget')
    }
  }

  const residentSets = value.residentSets
  for (const variantName of VARIANTS) {
    const entries = isRecord(residentSets) ? residentSets[variantName] : null
    const selected = new Set<string>()
    let resident = emptyEstimate()
    if (!Array.isArray(entries) || entries.length === 0) {
      fail(`residentSets.${variantName}`, 'must be non-empty')
      continue
    }
    entries.forEach((entry, index) => {
      const path = `residentSets.${variantName}[${index}]`
      if (!isRecord(entry) || !isString(entry.packageId) || !LEVELS.includes(entry.level as AnimationPackageLevel)) {
        fail(path, 'must reference one package and level')
        return
      }
      if (selected.has(entry.packageId)) fail(`${path}.packageId`, 'must be unique in the set')
      selected.add(entry.packageId)
      const pkg = packagesById.get(entry.packageId)
      if (!pkg) {
        fail(`${path}.packageId`, 'does not exist')
        return
      }
      const expectedPersistentLevel = persistentSelections.get(entry.packageId)
      if (expectedPersistentLevel && entry.level !== expectedPersistentLevel) {
        fail(`${path}.level`, `persistent package must select ${expectedPersistentLevel}`)
      }
      const estimate = payloadEstimates.get(entry.packageId)?.[variantName][entry.level as AnimationPackageLevel]
      if (!estimate) fail(`${path}.level`, 'payload is unavailable for this variant')
      else resident = addEstimate(resident, estimate)
    })
    for (const [packageId] of persistentSelections) {
      if (!selected.has(packageId)) fail(`residentSets.${variantName}`, `must include persistent package ${packageId}`)
    }
    const budget = residentBudgets[variantName]
    if (budget) {
      const exceeded = firstBudgetExceeded(resident, budget)
      if (exceeded) fail(`residentSets.${variantName}.${exceeded}`, 'exceeds resident budget')
    }
  }

  return {
    manifest: errors.length ? null : (value as unknown as AnimationPackageManifestV3),
    errors,
  }
}

export function validateAnimationPackageRuntimeManifest(
  value: unknown,
  variant: ModelVariantKey,
  pins: AnimationPackageManifestPins,
): { valid: boolean; errors: string[] } {
  const result = validateRuntimeManifest(value, variant, pins)
  return { valid: Boolean(result.manifest), errors: result.errors }
}

function meshInstanceCount(mesh: Mesh): number {
  const instanced = mesh as Mesh & { isInstancedMesh?: boolean; count?: number }
  return instanced.isInstancedMesh && Number.isSafeInteger(instanced.count) && (instanced.count ?? 0) > 0
    ? instanced.count!
    : 1
}

const MATERIAL_TEXTURE_SLOTS = [
  'map', 'alphaMap', 'aoMap', 'lightMap', 'normalMap', 'bumpMap', 'displacementMap',
  'roughnessMap', 'metalnessMap', 'emissiveMap', 'specularMap', 'specularColorMap',
  'specularIntensityMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'transmissionMap', 'thicknessMap', 'anisotropyMap',
] as const

function materialIsLit(material: Material): boolean {
  const candidate = material as Material & { type?: string; userData?: Record<string, unknown> }
  const extensions = isRecord(candidate.userData?.gltfExtensions) ? candidate.userData.gltfExtensions : null
  if (extensions && isRecord(extensions.KHR_materials_unlit)) return false
  return ![
    'MeshBasicMaterial', 'MeshNormalMaterial', 'MeshDepthMaterial', 'MeshDistanceMaterial',
    'MeshMatcapMaterial', 'RawShaderMaterial', 'ShaderMaterial', 'SpriteMaterial', 'LineBasicMaterial',
    'LineDashedMaterial', 'PointsMaterial',
  ].includes(candidate.type ?? '')
}

function materialAttributeRequirements(material: Material): string[] {
  const required = new Set<string>()
  if (materialIsLit(material)) required.add('NORMAL')
  const values = material as Material & Record<string, unknown>
  for (const slot of MATERIAL_TEXTURE_SLOTS) {
    const texture = values[slot]
    if (!texture || typeof texture !== 'object' || !(texture as Texture).isTexture) continue
    const channel = Number.isInteger((texture as Texture).channel) ? (texture as Texture).channel : 0
    required.add(`TEXCOORD_${channel}`)
  }
  if (material.userData?.iomRequireAuthoredTangents === true) required.add('TANGENT')
  return [...required]
}

function attributeContainsOnlyFiniteValues(attribute: {
  count: number
  itemSize: number
  getX(index: number): number
  getY(index: number): number
  getZ(index: number): number
  getW(index: number): number
}): boolean {
  const readers = [attribute.getX, attribute.getY, attribute.getZ, attribute.getW]
  for (let index = 0; index < attribute.count; index += 1) {
    for (let component = 0; component < Math.min(attribute.itemSize, readers.length); component += 1) {
      if (!Number.isFinite(readers[component]!.call(attribute, index))) return false
    }
  }
  return attribute.itemSize >= 1 && attribute.itemSize <= readers.length
}

function collectPayloadSourcePaths(root: Object3D): { paths: string[]; errors: string[] } {
  const paths: string[] = []
  const errors: string[] = []
  root.traverse((object) => {
    const direct = object.userData?.iomPackageSourcePath
    if (typeof direct === 'string' && direct.trim()) paths.push(direct)
    const aggregate = object.userData?.iomPackageSourcePaths
    if (aggregate !== undefined) {
      if (!Array.isArray(aggregate) || aggregate.some((entry) => typeof entry !== 'string' || !entry.trim())) {
        errors.push(`${object.name || object.uuid}: iomPackageSourcePaths must contain non-empty strings`)
      } else {
        paths.push(...aggregate)
      }
    }
  })
  const seen = new Set<string>()
  for (const path of paths) {
    if (seen.has(path)) errors.push(`duplicate payload source ownership ${path}`)
    seen.add(path)
  }
  return { paths: [...seen].sort(), errors }
}

function inspectPackageGeometry(
  root: Object3D,
  requiredAttributes: readonly string[],
): { triangles: number; draws: number; errors: string[] } {
  let triangles = 0
  let draws = 0
  const errors: string[] = []
  const attributeNames: Record<string, string> = {
    POSITION: 'position',
    NORMAL: 'normal',
    TEXCOORD_0: 'uv',
    TEXCOORD_1: 'uv1',
    TEXCOORD_2: 'uv2',
    TEXCOORD_3: 'uv3',
    TANGENT: 'tangent',
    COLOR_0: 'color',
  }
  root.traverse((object) => {
    const sceneObject = object as Object3D & { isCamera?: boolean; isLight?: boolean }
    if (sceneObject.isCamera || sceneObject.isLight) {
      errors.push(`${object.name || object.uuid}: cameras and lights are forbidden in streamed payloads`)
    }
    const mesh = object as Mesh & {
      isLine?: boolean
      isPoints?: boolean
      isSprite?: boolean
      isSkinnedMesh?: boolean
      morphTargetInfluences?: number[]
    }
    if (!mesh.isMesh) {
      if (mesh.isLine || mesh.isPoints || mesh.isSprite) {
        errors.push(`${object.name || object.uuid}: non-mesh renderables are forbidden in streamed payloads`)
      }
      return
    }
    if (mesh.isSkinnedMesh) errors.push(`${mesh.name || mesh.uuid}: skinned meshes are forbidden in static streamed payloads`)
    const geometry = mesh.geometry
    if (!geometry) {
      errors.push(`${mesh.name || mesh.uuid}: missing geometry`)
      return
    }
    if (
      (mesh.morphTargetInfluences?.length ?? 0) > 0 ||
      Object.values(geometry.morphAttributes).some((attributes) => attributes.length > 0)
    ) {
      errors.push(`${mesh.name || mesh.uuid}: morph targets are forbidden in static streamed payloads`)
    }
    for (const [attributeName, attribute] of Object.entries(geometry.attributes)) {
      if (!attributeContainsOnlyFiniteValues(attribute)) {
        errors.push(`${mesh.name || mesh.uuid}: ${attributeName} contains invalid or non-finite values`)
      }
    }
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
      (material): material is Material => Boolean(material),
    )
    const perPrimitiveRequirements = new Set(requiredAttributes)
    for (const material of materials) {
      for (const required of materialAttributeRequirements(material)) perPrimitiveRequirements.add(required)
    }
    for (const required of perPrimitiveRequirements) {
      const attributeName = attributeNames[required]
      if (!attributeName || !geometry.getAttribute(attributeName)) {
        errors.push(`${mesh.name || mesh.uuid}: missing ${required}`)
      }
    }
    const elementCount = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
    if (elementCount % 3 !== 0) errors.push(`${mesh.name || mesh.uuid}: triangle element count must be divisible by three`)
    const positionCount = geometry.getAttribute('position')?.count ?? 0
    if (geometry.index) {
      for (let index = 0; index < geometry.index.count; index += 1) {
        const value = geometry.index.getX(index)
        if (!Number.isInteger(value) || value < 0 || value >= positionCount) {
          errors.push(`${mesh.name || mesh.uuid}: index ${index} is outside POSITION`)
          break
        }
      }
    }
    triangles += Math.floor(elementCount / 3) * meshInstanceCount(mesh)
    const materialAssignment = mesh.material
    if (Array.isArray(materialAssignment) && geometry.groups.length) {
      draws += geometry.groups.filter((group) => group.count >= 3 && materialAssignment[group.materialIndex ?? 0]).length
    } else if (elementCount >= 3 && mesh.material) {
      draws += 1
    }
  })
  if (triangles === 0 || draws === 0) errors.push('package contains no renderable geometry')
  return { triangles, draws, errors }
}

function boundsMatch(actual: Box3, declared: AnimationPackageBounds): boolean {
  const actualValues = [actual.min.x, actual.min.y, actual.min.z, actual.max.x, actual.max.y, actual.max.z]
  const declaredValues = [...declared.min, ...declared.max]
  return actualValues.every((value, index) => Math.abs(value - declaredValues[index]!) <= BOUNDS_EPSILON_METERS)
}

/**
 * Guarded runtime for the dormant animation-aware manifest-v3 pilot format.
 * Far detail is absent and covered by one persistent shell. A replacement is
 * verified and prepared while hidden before it can retire the previous level.
 */
export class AnimationPackageStreamLoader {
  private manifest: AnimationPackageManifestV3 | null = null
  private manifestAssetBase: URL | null = null
  private manifestUsesAbsoluteUrls = false
  private entry: ModelManifestEntry | null = null
  private layerRoot: Group | null = null
  private rigRoot: Object3D | null = null
  private clips: AnimationClip[] = []
  private owners = new Map<string, Object3D>()
  private packagesById = new Map<string, AnimationPackageManifestEntryV3>()
  private loaded = new Map<string, LoadedPackage>()
  private pending = new Map<string, symbol>()
  private activeOperation: ActiveOperation | null = null
  private serializedRequest: SerializedRequest | null = null
  private operationTail: Promise<void> = Promise.resolve()
  private onChange: ((event: AnimationPackageStreamChangeEvent) => void) | null = null
  private prepareIncoming: AnimationPackagePrepareIncoming | null = null
  private overviewMode = false
  private disposed = false
  private readonly geometryScopes = new WeakMap<BufferGeometry, string>()
  private readonly materialScopes = new WeakMap<Material, string>()
  private readonly sharedTextures = new SharedTextureResidencyRegistry()

  constructor(
    private readonly loader: ModelLoader,
    private readonly variant: ModelVariantKey,
  ) {}

  async loadManifest(
    url: string,
    pins: AnimationPackageManifestPins,
    integrity: AnimationPackageManifestIntegrity,
    signal?: AbortSignal,
  ): Promise<AnimationPackageManifestV3> {
    throwIfAborted(signal)
    if (this.disposed) throw abortError('Animation package stream was disposed')
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`Animation package manifest HTTP ${response.status}: ${url}`)
    const bytes = await response.arrayBuffer()
    await verifyModelAssetIntegrity(bytes, integrity, url)
    throwIfAborted(signal)
    let raw: unknown
    try {
      raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch (error) {
      throw new Error(`Animation package manifest is not valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
    throwIfAborted(signal)
    if (this.disposed) throw abortError('Animation package stream was disposed')
    const result = validateRuntimeManifest(raw, this.variant, pins)
    if (!result.manifest) throw new Error(`Unsafe animation package manifest: ${result.errors.join('; ')}`)
    await assertOwnershipDigests(result.manifest)
    throwIfAborted(signal)
    if (this.disposed) throw abortError('Animation package stream was disposed')
    this.manifest = result.manifest
    const documentBase = typeof location !== 'undefined' ? location.href : 'http://localhost/'
    const resolvedManifestUrl = new URL(url, documentBase)
    this.manifestAssetBase = new URL('.', resolvedManifestUrl)
    this.manifestUsesAbsoluteUrls = /^https?:\/\//i.test(url)
    this.packagesById = new Map(result.manifest.packages.map((pkg) => [pkg.id, pkg]))
    return result.manifest
  }

  attachLayer(entry: ModelManifestEntry, layerRoot: Group): void {
    this.entry = entry
    this.layerRoot = layerRoot
  }

  setOnChange(callback: ((event: AnimationPackageStreamChangeEvent) => void) | null): void {
    this.onChange = callback
  }

  setPrepareIncoming(callback: AnimationPackagePrepareIncoming | null): void {
    this.prepareIncoming = callback
  }

  setOverviewMode(enabled: boolean): void {
    this.overviewMode = enabled
  }

  getManifest(): AnimationPackageManifestV3 | null {
    return this.manifest
  }

  async initialize(
    focus?: AnimationPackageStreamFocus,
    options?: { onProgress?: (progress: LoadProgress) => void; signal?: AbortSignal },
  ): Promise<AnimationPackageStreamChangeEvent> {
    if (!this.manifest || !this.layerRoot || !this.entry) {
      throw new Error('Animation package stream must load a manifest and attach a layer first')
    }
    const manifest = this.manifest
    const key = `initialize:${focus ? `${focus.x},${focus.y},${focus.z}` : 'resident-only'}`
    return this.runSerializedOperation(key, options?.signal, async (operation) => {
      const changes: TransitionAccumulator = { loaded: [], unloaded: [] }
      await this.loadPersistentRig(options?.onProgress, operation.signal)
      const initial = [...manifest.residentSets[this.variant]].sort((a, b) => {
        const aPkg = this.packagesById.get(a.packageId)
        const bPkg = this.packagesById.get(b.packageId)
        const priority = (pkg: AnimationPackageManifestEntryV3 | undefined): number =>
          pkg?.kind === 'always-resident-shell' ? 0 : pkg?.residency === 'persistent-lossless' ? 1 : 2
        return priority(aPkg) - priority(bPkg)
      })
      for (const target of initial) {
        await this.setPackageLevel(target.packageId, target.level, changes, options?.onProgress, operation.signal, true)
      }
      if (focus) {
        for (const target of this.targetsFor(focus)) {
          throwIfAborted(operation.signal)
          const pkg = this.packagesById.get(target.packageId)
          await this.setPackageLevel(
            target.packageId,
            target.level,
            changes,
            options?.onProgress,
            operation.signal,
            pkg?.residency === 'persistent-lossless',
          )
        }
      }
      return this.eventFor(changes)
    })
  }

  async syncFocus(
    focus: AnimationPackageStreamFocus,
    options?: { onProgress?: (progress: LoadProgress) => void; signal?: AbortSignal },
  ): Promise<AnimationPackageStreamChangeEvent> {
    if (!this.manifest || !this.rigRoot || !this.entry) return this.eventFor({ loaded: [], unloaded: [] })
    throwIfAborted(options?.signal)
    const key = `focus:${focus.x},${focus.y},${focus.z}:overview=${this.overviewMode}`
    return this.runSerializedOperation(key, options?.signal, async (operation) => {
      const targets = this.targetsFor(focus)
      const changes: TransitionAccumulator = { loaded: [], unloaded: [] }
      for (const target of targets) {
        throwIfAborted(operation.signal)
        const pkg = this.packagesById.get(target.packageId)
        await this.setPackageLevel(
          target.packageId,
          target.level,
          changes,
          options?.onProgress,
          operation.signal,
          pkg?.residency === 'persistent-lossless',
        )
      }
      return this.eventFor(changes)
    })
  }

  private targetsFor(focus: AnimationPackageStreamFocus): Array<{ packageId: string; level: AnimationPackageResidentLevel }> {
    if (!this.manifest) return []
    const targets = this.manifest.packages.map((pkg) => {
      const level = this.targetLevel(pkg, focus)
      return {
        packageId: pkg.id,
        level,
        persistent: pkg.residency === 'persistent-lossless',
        distanceSq: this.focusDistanceSq(pkg, focus),
      }
    })
    // Retire out-of-window payloads first. Required persistent content follows,
    // then nearest LOD0 detail before optional farther HLOD. This prevents a
    // manifest's package order from letting far coarse geometry consume the
    // budget that should preserve the closest high-fidelity surface.
    const priority = (target: typeof targets[number]): number => {
      if (target.level === 'unloaded') return 0
      if (target.persistent) return 1
      return target.level === 'lod0' ? 2 : 3
    }
    targets.sort((left, right) =>
      priority(left) - priority(right) ||
      left.distanceSq - right.distanceSq ||
      left.packageId.localeCompare(right.packageId))
    return targets.map(({ packageId, level }) => ({ packageId, level }))
  }

  private focusDistanceSq(
    pkg: AnimationPackageManifestEntryV3,
    focus: AnimationPackageStreamFocus,
  ): number {
    const owner = this.owners.get(pkg.ownerId)
    if (!owner) return Number.POSITIVE_INFINITY
    owner.updateWorldMatrix(true, false)
    const localFocus = owner.worldToLocal(new Vector3(focus.x, focus.y, focus.z))
    const bounds = pkg.selectionBounds[this.variant]
    return new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max))
      .distanceToPoint(localFocus) ** 2
  }

  private targetLevel(
    pkg: AnimationPackageManifestEntryV3,
    focus: AnimationPackageStreamFocus,
  ): AnimationPackageResidentLevel {
    if (pkg.kind === 'always-resident-shell') return 'hlod'
    if (pkg.residency === 'persistent-lossless') return 'lod0'
    if (this.overviewMode) return 'unloaded'
    const owner = this.owners.get(pkg.ownerId)
    if (!owner) return 'unloaded'
    owner.updateWorldMatrix(true, false)
    const localFocus = owner.worldToLocal(new Vector3(focus.x, focus.y, focus.z))
    const variantBounds = pkg.selectionBounds[this.variant]
    const baseBounds = new Box3(new Vector3(...variantBounds.min), new Vector3(...variantBounds.max))
    const currentLevel = this.loaded.get(pkg.id)?.level
    const contains = (margin: number): boolean => baseBounds.clone().expandByScalar(margin).containsPoint(localFocus)
    if (pkg.kind === 'detail') {
      const lod0Margin = pkg.streaming?.lod0MarginMeters ?? DETAIL_BOUNDS_MARGIN_METERS
      const lod0ExitMargin = pkg.streaming?.lod0ExitMarginMeters ?? lod0Margin + DETAIL_HYSTERESIS_METERS
      if (currentLevel === 'lod0' && contains(lod0ExitMargin)) return 'lod0'
      if (contains(lod0Margin)) return 'lod0'
      const hlod = pkg.variants[this.variant].hlod
      const hlodMargin = pkg.streaming?.hlodMarginMeters ?? lod0ExitMargin
      const hlodExitMargin = pkg.streaming?.hlodExitMarginMeters ?? hlodMargin + DETAIL_HYSTERESIS_METERS
      if (hlod && currentLevel === 'hlod' && contains(hlodExitMargin)) return 'hlod'
      if (hlod && contains(hlodMargin)) {
        return 'hlod'
      }
      return 'unloaded'
    }
    const margin = pkg.streaming?.hlodMarginMeters ?? REGIONAL_HLOD_MARGIN_METERS
    const exitMargin = pkg.streaming?.hlodExitMarginMeters ?? margin + REGIONAL_HYSTERESIS_METERS
    return contains(currentLevel === 'hlod' ? exitMargin : margin) ? 'hlod' : 'unloaded'
  }

  private async setPackageLevel(
    packageId: string,
    level: AnimationPackageResidentLevel,
    changes: TransitionAccumulator,
    onProgress: ((progress: LoadProgress) => void) | undefined,
    signal: AbortSignal,
    required: boolean,
  ): Promise<void> {
    throwIfAborted(signal)
    const pkg = this.packagesById.get(packageId)
    const owner = pkg ? this.owners.get(pkg.ownerId) : null
    if (!pkg || !owner || !this.manifest) throw new Error(`Package ownership unavailable: ${packageId}`)
    const previous = this.loaded.get(packageId)
    if (level === 'unloaded') {
      if (!previous) return
      this.loaded.delete(packageId)
      previous.root.visible = false
      previous.root.parent?.remove(previous.root)
      this.disposePackageRoot(previous.root)
      const delta = `${packageId}:${previous.level}`
      changes.unloaded.push(delta)
      this.emit(this.eventFor({ loaded: [], unloaded: [delta] }))
      return
    }
    if (previous?.level === level) return
    const payload = pkg.variants[this.variant][level]
    if (!payload) throw new Error(`Package payload unavailable: ${packageId}:${level}`)

    const current = this.currentEstimate()
    const steady = addEstimate(subtractEstimate(current, previous?.estimate ?? emptyEstimate()), payload.estimates)
    const peak = addEstimate(current, payload.estimates)
    const steadyExceeded = firstBudgetExceeded(steady, this.manifest.budgets.maxResident[this.variant])
    const peakExceeded = firstBudgetExceeded(peak, this.manifest.budgets.maxTransitionPeak[this.variant])
    if (steadyExceeded || peakExceeded) {
      if (!required) return
      const kind = steadyExceeded ? 'resident' : 'transition peak'
      const metric = steadyExceeded ?? peakExceeded!
      throw new Error(`${kind} ${this.variant} ${metric} budget exceeded by ${packageId}:${level}`)
    }

    const pendingKey = `${packageId}:${level}`
    const pendingToken = Symbol(pendingKey)
    this.pending.set(pendingKey, pendingToken)
    onProgress?.({ stage: 'download', ratio: null, message: `Loading ${packageId} ${level.toUpperCase()}` })
    let result: Awaited<ReturnType<ModelLoader['loadUrlVerified']>> | null = null
    try {
      result = await this.loader.loadUrlVerified(
        this.resolveUrl(payload.url),
        { sha256: payload.sha256, bytes: payload.estimates.bytes },
        onProgress,
        signal,
      )
      if (signal.aborted || this.disposed || !this.layerRoot) {
        this.disposeDetached(result.root)
        result = null
        throw abortError('Animation package load was superseded')
      }
      if (result.animations.length) throw new Error(`Package ${packageId}:${level} illegally contains animation clips`)
      if (result.fileSizeBytes !== payload.estimates.bytes || result.transferredBytes !== payload.estimates.bytes) {
        throw new Error(`Package ${packageId}:${level} byte count differs from its verified pin`)
      }
      const ownerNames = new Set(this.manifest.rig.owners.map((item) => item.nodeName))
      const duplicateOwners: string[] = []
      result.root.traverse((object) => {
        if (ownerNames.has(object.name)) duplicateOwners.push(object.name)
      })
      if (duplicateOwners.length) throw new Error(`Package ${packageId}:${level} duplicates persistent owner ${duplicateOwners[0]}`)
      const geometry = inspectPackageGeometry(result.root, pkg.requiredAttributes)
      if (geometry.errors.length) throw new Error(`Package ${packageId}:${level} geometry invalid: ${geometry.errors.join('; ')}`)
      if (geometry.triangles !== payload.estimates.triangles || geometry.draws !== payload.estimates.draws) {
        throw new Error(
          `Package ${packageId}:${level} metrics differ from pins ` +
          `(${geometry.triangles}/${geometry.draws} != ${payload.estimates.triangles}/${payload.estimates.draws})`,
        )
      }
      const ownership = collectPayloadSourcePaths(result.root)
      if (ownership.errors.length) {
        throw new Error(`Package ${packageId}:${level} ownership invalid: ${ownership.errors.join('; ')}`)
      }
      const declaredSourcePaths = [...pkg.sourcePaths[this.variant]].sort()
      if (
        ownership.paths.length !== declaredSourcePaths.length ||
        ownership.paths.some((path, index) => path !== declaredSourcePaths[index])
      ) {
        throw new Error(`Package ${packageId}:${level} source ownership differs from its exact contract`)
      }

      this.isolateIncomingResources(result.root, packageId)
      result.root.name = `HLODPackage:${packageId}:${level}`
      result.root.matrix.fromArray(pkg.transform.matrix)
      result.root.matrixAutoUpdate = false
      result.root.visible = false
      result.root.updateMatrixWorld(true)
      const actualBounds = new Box3().setFromObject(result.root)
      if (actualBounds.isEmpty() || !boundsMatch(actualBounds, payload.bounds)) {
        throw new Error(`Package ${packageId}:${level} differs from declared exact owner-local bounds`)
      }
      await this.prepareIncoming?.(result.root, pkg, level, signal)
      throwIfAborted(signal)
      if (this.disposed || !this.layerRoot) throw abortError('Animation package load was superseded')
      this.sharedTextures.acquireRoot(result.root)

      owner.add(result.root)
      result.root.visible = true
      result.root.updateMatrixWorld(true)
      const next: LoadedPackage = { pkg, level, root: result.root, estimate: payload.estimates }
      this.loaded.set(packageId, next)
      const loadedDelta = `${packageId}:${level}`
      changes.loaded.push(loadedDelta)
      result = null

      const unloaded: string[] = []
      if (previous) {
        previous.root.visible = false
        previous.root.parent?.remove(previous.root)
        this.disposePackageRoot(previous.root)
        const delta = `${packageId}:${previous.level}`
        changes.unloaded.push(delta)
        unloaded.push(delta)
      }
      this.emit(this.eventFor({ loaded: [loadedDelta], unloaded }))
    } catch (error) {
      if (result) this.disposeDetached(result.root)
      throw error
    } finally {
      if (this.pending.get(pendingKey) === pendingToken) this.pending.delete(pendingKey)
    }
  }

  private async loadPersistentRig(
    onProgress: ((progress: LoadProgress) => void) | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    if (this.rigRoot) return
    if (!this.manifest || !this.layerRoot) throw new Error('Animation package manifest is unavailable')
    onProgress?.({ stage: 'download', ratio: null, message: 'Loading persistent animation rig' })
    const result = await this.loader.loadUrlVerified(
      this.resolveUrl(this.manifest.rig.url),
      { sha256: this.manifest.rig.sha256, bytes: this.manifest.rig.bytes },
      onProgress,
      signal,
    )
    if (signal.aborted || this.disposed || !this.layerRoot) {
      disposeIsolatedRoot(result.root, [])
      throw abortError('Persistent rig load was superseded')
    }
    if (result.fileSizeBytes !== this.manifest.rig.bytes || result.transferredBytes !== this.manifest.rig.bytes) {
      disposeIsolatedRoot(result.root, [])
      throw new Error('Persistent rig byte count differs from its verified pin')
    }
    let forbiddenSceneObjects = 0
    result.root.traverse((object) => {
      const candidate = object as Object3D & {
        isMesh?: boolean
        isLine?: boolean
        isPoints?: boolean
        isSprite?: boolean
        isCamera?: boolean
        isLight?: boolean
      }
      if (
        candidate.isMesh || candidate.isLine || candidate.isPoints || candidate.isSprite ||
        candidate.isCamera || candidate.isLight
      ) forbiddenSceneObjects += 1
    })
    if (forbiddenSceneObjects) {
      disposeIsolatedRoot(result.root, [])
      throw new Error(`Persistent rig must be render-mesh-free and camera/light-free (${forbiddenSceneObjects} forbidden scene objects found)`)
    }

    const owners = new Map<string, Object3D>()
    for (const contractOwner of this.manifest.rig.owners) {
      const matches: Object3D[] = []
      result.root.traverse((object) => {
        if (object.name === contractOwner.nodeName) matches.push(object)
      })
      if (matches.length !== 1) {
        disposeIsolatedRoot(result.root, [])
        throw new Error(`Persistent rig owner ${contractOwner.nodeName} resolved ${matches.length} times`)
      }
      owners.set(contractOwner.id, matches[0]!)
    }
    const actualClips = new Map(result.animations.map((clip) => [clip.name, clip]))
    if (actualClips.size !== result.animations.length || actualClips.size !== this.manifest.rig.clips.length) {
      disposeIsolatedRoot(result.root, [])
      throw new Error('Persistent rig clip set differs from its exact contract')
    }
    for (const declared of this.manifest.rig.clips) {
      const clip = actualClips.get(declared.name)
      if (!clip || Math.abs(clip.duration - declared.durationSeconds) > 1e-3) {
        disposeIsolatedRoot(result.root, [])
        throw new Error(`Persistent rig clip ${declared.name} differs from its exact duration contract`)
      }
    }
    const loadedDuration = Math.max(...result.animations.map((clip) => clip.duration), 0)
    if (Math.abs(loadedDuration - this.manifest.rig.animationDurationSeconds) > 1e-3) {
      disposeIsolatedRoot(result.root, [])
      throw new Error(
        `Persistent rig duration mismatch (${loadedDuration.toFixed(6)}s != ${this.manifest.rig.animationDurationSeconds.toFixed(6)}s)`,
      )
    }

    this.isolateIncomingResources(result.root, '__persistent_rig__')
    result.root.name = 'AnimationPackagePersistentRig'
    this.layerRoot.add(result.root)
    result.root.updateMatrixWorld(true)
    this.rigRoot = result.root
    this.owners = owners
    this.clips = result.animations
  }

  private isolateIncomingResources(root: Object3D, scope: string): void {
    root.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      if (mesh.geometry) {
        const previousScope = this.geometryScopes.get(mesh.geometry)
        if (previousScope && previousScope !== scope) mesh.geometry = mesh.geometry.clone()
        this.geometryScopes.set(mesh.geometry, scope)
      }
      const isolateMaterial = (material: Material): Material => {
        const previousScope = this.materialScopes.get(material)
        const isolated = previousScope && previousScope !== scope ? material.clone() : material
        isolated.userData = { ...isolated.userData, hlodResourceScope: scope }
        this.materialScopes.set(isolated, scope)
        return isolated
      }
      if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(isolateMaterial)
      else if (mesh.material) mesh.material = isolateMaterial(mesh.material)
      mesh.userData.hlodPackageResourceScope = scope
      mesh.userData.detailLodIgnore = true
    })
  }

  private protectedRoots(exclude?: Object3D): Object3D[] {
    const roots: Object3D[] = []
    if (this.rigRoot && this.rigRoot !== exclude) roots.push(this.rigRoot)
    for (const loaded of this.loaded.values()) if (loaded.root !== exclude) roots.push(loaded.root)
    return roots
  }

  private disposePackageRoot(root: Object3D): void {
    this.sharedTextures.releaseRoot(root)
    disposeIsolatedRoot(root, this.protectedRoots(root))
  }

  private disposeDetached(root: Object3D): void {
    this.sharedTextures.releaseRoot(root)
    disposeIsolatedRoot(root, this.protectedRoots())
  }

  private resolveUrl(url: string): string {
    if (!this.manifestAssetBase) throw new Error('Animation package manifest base is unavailable')
    let resolved: URL
    try {
      resolved = new URL(url, this.manifestAssetBase)
    } catch {
      throw new Error(`Invalid animation package URL: ${url}`)
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      throw new Error(`Unsupported animation package URL scheme: ${resolved.protocol}`)
    }
    if (resolved.origin !== this.manifestAssetBase.origin) {
      throw new Error(`Cross-origin animation package URL is forbidden: ${url}`)
    }
    if (!resolved.pathname.startsWith(this.manifestAssetBase.pathname)) {
      throw new Error(`Animation package URL escapes its approved model directory: ${url}`)
    }
    resolved.hash = ''
    return this.manifestUsesAbsoluteUrls ? resolved.href : `${resolved.pathname}${resolved.search}`
  }

  private runSerializedOperation(
    key: string,
    callerSignal: AbortSignal | undefined,
    work: (operation: ActiveOperation) => Promise<AnimationPackageStreamChangeEvent>,
  ): Promise<AnimationPackageStreamChangeEvent> {
    if (this.disposed) return Promise.reject(abortError('Animation package stream was disposed'))
    if (this.serializedRequest?.key === key && !this.serializedRequest.signal.aborted) {
      return this.serializedRequest.promise
    }
    this.serializedRequest?.controller.abort()
    this.activeOperation?.controller.abort()
    const controller = new AbortController()
    const abortFromCaller = (): void => controller.abort()
    if (callerSignal?.aborted) controller.abort()
    else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
    const operation = { controller, signal: controller.signal, abortFromCaller, key }
    const predecessor = this.operationTail
    let request!: SerializedRequest
    const promise = (async (): Promise<AnimationPackageStreamChangeEvent> => {
      await predecessor
      throwIfAborted(operation.signal)
      if (this.disposed) throw abortError('Animation package stream was disposed')
      this.activeOperation = operation
      try {
        return await work(operation)
      } finally {
        callerSignal?.removeEventListener('abort', operation.abortFromCaller)
        if (this.activeOperation?.controller === operation.controller) this.activeOperation = null
        if (this.serializedRequest === request) this.serializedRequest = null
      }
    })()
    request = { ...operation, promise }
    this.serializedRequest = request
    this.operationTail = promise.then(() => undefined, () => undefined)
    return promise
  }

  private eventFor(changes: TransitionAccumulator): AnimationPackageStreamChangeEvent {
    return { ...changes, layerId: this.entry?.id ?? '?', animationChanged: false }
  }

  private emit(event: AnimationPackageStreamChangeEvent): void {
    if (event.loaded.length || event.unloaded.length) this.onChange?.(event)
  }

  private currentEstimate(): AnimationPackageEstimate {
    let result = emptyEstimate()
    for (const loaded of this.loaded.values()) result = addEstimate(result, loaded.estimate)
    return result
  }

  getState(): AnimationPackageStreamState {
    const resident = this.currentEstimate()
    const levels: Record<string, AnimationPackageLevel> = {}
    for (const [packageId, loaded] of this.loaded) levels[packageId] = loaded.level
    return {
      loaded: [...this.loaded.keys()],
      pending: [...this.pending.keys()],
      residentTriangles: resident.triangles,
      residentDraws: resident.draws,
      residentBytes: resident.bytes,
      residentEncodedTextureBytes: resident.encodedTextureBytes,
      residentGpuTextureBytes: resident.gpuTextureBytes,
      levels,
    }
  }

  collectAnimations(): AnimationClip[] {
    return this.clips
  }

  getAnimationBindRoot(): Object3D | null {
    return this.rigRoot
  }

  getOwner(ownerId: string): Object3D | null {
    return this.owners.get(ownerId) ?? null
  }

  getLoadedPackageRoot(packageId: string): Object3D | null {
    return this.loaded.get(packageId)?.root ?? null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.serializedRequest?.controller.abort()
    this.serializedRequest = null
    this.activeOperation?.controller.abort()
    this.activeOperation = null
    for (const loaded of [...this.loaded.values()]) {
      loaded.root.parent?.remove(loaded.root)
      this.loaded.delete(loaded.pkg.id)
      this.disposePackageRoot(loaded.root)
    }
    this.pending.clear()
    if (this.rigRoot) {
      this.rigRoot.parent?.remove(this.rigRoot)
      disposeIsolatedRoot(this.rigRoot, [])
    }
    this.rigRoot = null
    this.sharedTextures.dispose()
    this.clips = []
    this.owners.clear()
    this.packagesById.clear()
    this.manifest = null
    this.manifestAssetBase = null
    this.layerRoot = null
    this.entry = null
    this.onChange = null
    this.prepareIncoming = null
  }
}
