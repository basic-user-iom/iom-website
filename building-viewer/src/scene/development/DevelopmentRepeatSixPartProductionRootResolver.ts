/**
 * Development-only, read-only resolver for the four production instancing
 * roots replaced by the repeat-six-part exact catalog pilot.
 *
 * Resolution is intentionally ordinal and physical. The source GLB nodes are
 * unnamed, but GLTFLoader deterministically assigns the four runtime mesh names
 * pinned below. Names alone are never searched; they are only an additional
 * signature after exact ordinal binding. Live references stay in a WeakMap.
 */

import {
  InstancedMesh,
  Matrix4,
  type Material,
  type Object3D,
} from 'three'

import type { LoadedModelLayer } from '../types'

const MODEL_ID = 'icm-anim-2025' as const
const INSTANCE_COUNT = 78 as const
const POSITIVE_INSTANCES = 40 as const
const MIRRORED_INSTANCES = 38 as const
const IDENTITY = new Matrix4()
const MATRIX_COMPONENTS = 16
const DETERMINANT_EPSILON = 1e-9

const ROOT_PINS = Object.freeze([
  Object.freeze({
    rootId: 'scene/0/258' as const,
    ordinal: 258 as const,
    runtimeName: 'mesh_1127' as const,
    materialName: 'vray Stuhl_Plastik' as const,
    trianglesPerInstance: 24_213 as const,
  }),
  Object.freeze({
    rootId: 'scene/0/259' as const,
    ordinal: 259 as const,
    runtimeName: 'mesh_1128' as const,
    materialName: 'vray Stuhl_Plakete' as const,
    trianglesPerInstance: 7_102 as const,
  }),
  Object.freeze({
    rootId: 'scene/0/260' as const,
    ordinal: 260 as const,
    runtimeName: 'mesh_1129' as const,
    materialName: 'vray Stuhl_Metall' as const,
    trianglesPerInstance: 14_041 as const,
  }),
  Object.freeze({
    rootId: 'scene/0/261' as const,
    ordinal: 261 as const,
    runtimeName: 'mesh_1130' as const,
    materialName: 'vray Stuhl_Bezug' as const,
    trianglesPerInstance: 15_913 as const,
  }),
] as const)

export type DevelopmentRepeatSixPartProductionRootId = typeof ROOT_PINS[number]['rootId']

export type DevelopmentRepeatSixPartProductionRootMetadata = Readonly<{
  rootId: DevelopmentRepeatSixPartProductionRootId
  ordinal: 258 | 259 | 260 | 261
  runtimeName: 'mesh_1127' | 'mesh_1128' | 'mesh_1129' | 'mesh_1130'
  materialName: string
  trianglesPerInstance: number
  instances: 78
  positiveInstances: 40
  mirroredInstances: 38
}>

export type DevelopmentRepeatSixPartProductionRootResolutionMetadata = Readonly<{
  kind: 'development-repeat-six-part-production-root-resolution-metadata'
  developmentOnly: true
  modelId: 'icm-anim-2025'
  monolithic: true
  activeSceneChildCount: number
  sourceRootIds: readonly DevelopmentRepeatSixPartProductionRootId[]
  roots: readonly DevelopmentRepeatSixPartProductionRootMetadata[]
  sharedOrderedInstanceMatrices: true
  instances: 78
  positiveInstances: 40
  mirroredInstances: 38
}>

const RESOLUTION_BRAND: unique symbol = Symbol('development-repeat-six-part-production-root-resolution')

export type DevelopmentRepeatSixPartProductionRootResolution = Readonly<{
  kind: 'development-repeat-six-part-production-root-resolution'
  developmentOnly: true
  metadata: DevelopmentRepeatSixPartProductionRootResolutionMetadata
  readonly [RESOLUTION_BRAND]: true
}>

export type DevelopmentRepeatSixPartProductionRootLiveBinding = Readonly<{
  modelRoot: Object3D
  activeScene: Object3D
  roots: readonly InstancedMesh[]
}>

export type DevelopmentRepeatSixPartProductionRootResolverErrorCode =
  | 'INVALID_INPUT'
  | 'WRONG_MODEL'
  | 'STREAMING_LAYER'
  | 'INVALID_GRAPH'
  | 'INVALID_PRODUCTION_ROOT'
  | 'INVALID_GEOMETRY'
  | 'INVALID_INSTANCE_SET'
  | 'FORGED_RESOLUTION'
  | 'STALE_RESOLUTION'

export class DevelopmentRepeatSixPartProductionRootResolverError extends Error {
  readonly code: DevelopmentRepeatSixPartProductionRootResolverErrorCode

  constructor(code: DevelopmentRepeatSixPartProductionRootResolverErrorCode, message: string) {
    super(message)
    this.name = 'DevelopmentRepeatSixPartProductionRootResolverError'
    this.code = code
  }
}

type ResolvedInput = Readonly<{
  modelRoot: Object3D
  fromLayer: boolean
}>

type ValidatedGraph = Readonly<{
  modelRoot: Object3D
  activeScene: Object3D
  roots: readonly InstancedMesh[]
  metadata: DevelopmentRepeatSixPartProductionRootResolutionMetadata
}>

const issuedResolutions = new WeakSet<object>()
const liveBindings = new WeakMap<object, DevelopmentRepeatSixPartProductionRootLiveBinding>()

function fail(
  code: DevelopmentRepeatSixPartProductionRootResolverErrorCode,
  message: string,
): never {
  throw new DevelopmentRepeatSixPartProductionRootResolverError(code, message)
}

function isObject3D(value: unknown): value is Object3D {
  return Boolean(value && typeof value === 'object' && (value as { isObject3D?: unknown }).isObject3D === true)
}

function resolveInput(input: LoadedModelLayer | Object3D): ResolvedInput {
  if (isObject3D(input)) {
    if (input.userData?.layerId !== MODEL_ID) {
      fail('WRONG_MODEL', `Raw model root must carry layerId ${MODEL_ID}`)
    }
    if (input.userData?.streaming === true) {
      fail('STREAMING_LAYER', 'Streaming model roots cannot own the four monolithic production roots')
    }
    if (input.name !== `Model:${MODEL_ID}` && input.name !== 'ModelRoot') {
      fail('INVALID_GRAPH', `Unexpected monolithic model-root name ${JSON.stringify(input.name)}`)
    }
    return Object.freeze({ modelRoot: input, fromLayer: false })
  }

  if (!input || typeof input !== 'object' || !isObject3D(input.root)) {
    fail('INVALID_INPUT', 'Resolver input must be a LoadedModelLayer or a Three.js model root')
  }
  if (input.id !== MODEL_ID || input.entry?.id !== MODEL_ID) {
    fail('WRONG_MODEL', `Loaded layer must be ${MODEL_ID}`)
  }
  if (input.streaming === true) {
    fail('STREAMING_LAYER', 'Streaming layers cannot own the four monolithic production roots')
  }
  if (input.result?.root !== input.root) {
    fail('INVALID_GRAPH', 'Loaded layer result root does not match the mounted layer root')
  }
  if (input.root.userData?.layerId !== MODEL_ID || input.root.name !== `Model:${MODEL_ID}`) {
    fail('INVALID_GRAPH', 'Loaded layer root does not carry the expected model identity')
  }
  return Object.freeze({ modelRoot: input.root, fromLayer: true })
}

function isIdentity(object: Object3D): boolean {
  return (
    object.matrix.equals(IDENTITY) &&
    object.position.x === 0 && object.position.y === 0 && object.position.z === 0 &&
    object.quaternion.x === 0 && object.quaternion.y === 0 &&
    object.quaternion.z === 0 && object.quaternion.w === 1 &&
    object.scale.x === 1 && object.scale.y === 1 && object.scale.z === 1
  )
}

function materialName(material: Material | Material[]): string {
  if (Array.isArray(material)) {
    fail('INVALID_PRODUCTION_ROOT', 'Pinned production root unexpectedly has multiple runtime materials')
  }
  return material.name
}

function triangleCount(mesh: InstancedMesh): number {
  const index = mesh.geometry.getIndex()
  if (!index || index.count < 3 || index.count % 3 !== 0) {
    fail('INVALID_GEOMETRY', 'Pinned production root must have a non-empty indexed triangle geometry')
  }
  return index.count / 3
}

function matrixComponents(mesh: InstancedMesh, instanceIndex: number, target: Matrix4): readonly number[] {
  mesh.getMatrixAt(instanceIndex, target)
  const values = target.elements
  if (values.length !== MATRIX_COMPONENTS || values.some((value) => !Number.isFinite(value))) {
    fail('INVALID_INSTANCE_SET', `Instance ${instanceIndex} contains a non-finite 4x4 matrix`)
  }
  return values
}

function matricesEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function validateInstanceSets(roots: readonly InstancedMesh[]): void {
  const scratch = new Matrix4()
  const canonical = Array.from({ length: INSTANCE_COUNT }, (_, instanceIndex) =>
    Object.freeze([...matrixComponents(roots[0]!, instanceIndex, scratch)]))

  let positive = 0
  let mirrored = 0
  for (let instanceIndex = 0; instanceIndex < INSTANCE_COUNT; instanceIndex += 1) {
    scratch.fromArray(canonical[instanceIndex]!)
    const determinant = scratch.determinant()
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= DETERMINANT_EPSILON) {
      fail('INVALID_INSTANCE_SET', `Instance ${instanceIndex} has a singular or invalid parity transform`)
    }
    if (determinant > 0) positive += 1
    else mirrored += 1

    for (let rootIndex = 1; rootIndex < roots.length; rootIndex += 1) {
      const observed = matrixComponents(roots[rootIndex]!, instanceIndex, scratch)
      if (!matricesEqual(canonical[instanceIndex]!, observed)) {
        fail(
          'INVALID_INSTANCE_SET',
          `${ROOT_PINS[rootIndex]!.rootId} instance ${instanceIndex} differs from the canonical ordered matrix set`,
        )
      }
    }
  }
  if (positive !== POSITIVE_INSTANCES || mirrored !== MIRRORED_INSTANCES) {
    fail(
      'INVALID_INSTANCE_SET',
      `Production instance parity changed (${positive} positive / ${mirrored} mirrored)`,
    )
  }
}

function deepFreezeMetadata<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const entry of Object.values(value as Record<string, unknown>)) deepFreezeMetadata(entry)
  return Object.freeze(value)
}

function validateGraph(modelRoot: Object3D): ValidatedGraph {
  if (modelRoot.children.length !== 1) {
    fail('INVALID_GRAPH', 'Monolithic ModelRoot must contain exactly one active glTF scene')
  }
  const activeScene = modelRoot.children[0]!
  if (activeScene.parent !== modelRoot || !isIdentity(activeScene)) {
    fail('INVALID_GRAPH', 'Active glTF scene has invalid ancestry or a non-identity local transform')
  }
  if (activeScene.children.length <= ROOT_PINS[ROOT_PINS.length - 1]!.ordinal) {
    fail('INVALID_GRAPH', 'Active glTF scene is missing the pinned production child ordinals')
  }

  const roots = ROOT_PINS.map((pin) => {
    const candidate = activeScene.children[pin.ordinal]
    if (!(candidate instanceof InstancedMesh)) {
      fail('INVALID_PRODUCTION_ROOT', `${pin.rootId} is not an InstancedMesh`)
    }
    if (
      candidate.parent !== activeScene ||
      activeScene.children[pin.ordinal] !== candidate ||
      candidate.name !== pin.runtimeName ||
      !isIdentity(candidate)
    ) {
      fail(
        'INVALID_PRODUCTION_ROOT',
        `${pin.rootId} has invalid ordinal ownership, ancestry, name, or host transform ` +
        `(parent=${candidate.parent === activeScene}, ordinal=${activeScene.children[pin.ordinal] === candidate}, ` +
        `name=${JSON.stringify(candidate.name)}, matrix=${candidate.matrix.toArray().join(',')}, ` +
        `position=${candidate.position.toArray().join(',')}, quaternion=${candidate.quaternion.toArray().join(',')}, ` +
        `scale=${candidate.scale.toArray().join(',')})`,
      )
    }
    if (candidate.count !== INSTANCE_COUNT) {
      fail('INVALID_INSTANCE_SET', `${pin.rootId} must contain exactly ${INSTANCE_COUNT} instances`)
    }
    const observedMaterial = materialName(candidate.material)
    if (observedMaterial !== pin.materialName) {
      fail('INVALID_PRODUCTION_ROOT', `${pin.rootId} material changed (${JSON.stringify(observedMaterial)})`)
    }
    const observedTriangles = triangleCount(candidate)
    if (observedTriangles !== pin.trianglesPerInstance) {
      fail('INVALID_GEOMETRY', `${pin.rootId} triangle count changed (${observedTriangles})`)
    }
    return candidate
  })

  if (new Set<Object3D>(roots).size !== ROOT_PINS.length) {
    fail('INVALID_PRODUCTION_ROOT', 'Pinned production root references are not distinct')
  }
  validateInstanceSets(roots)

  const rootMetadata = ROOT_PINS.map((pin) => ({
    rootId: pin.rootId,
    ordinal: pin.ordinal,
    runtimeName: pin.runtimeName,
    materialName: pin.materialName,
    trianglesPerInstance: pin.trianglesPerInstance,
    instances: INSTANCE_COUNT,
    positiveInstances: POSITIVE_INSTANCES,
    mirroredInstances: MIRRORED_INSTANCES,
  }))
  const metadata = deepFreezeMetadata({
    kind: 'development-repeat-six-part-production-root-resolution-metadata' as const,
    developmentOnly: true as const,
    modelId: MODEL_ID,
    monolithic: true as const,
    activeSceneChildCount: activeScene.children.length,
    sourceRootIds: ROOT_PINS.map((pin) => pin.rootId),
    roots: rootMetadata,
    sharedOrderedInstanceMatrices: true as const,
    instances: INSTANCE_COUNT,
    positiveInstances: POSITIVE_INSTANCES,
    mirroredInstances: MIRRORED_INSTANCES,
  })

  return Object.freeze({
    modelRoot,
    activeScene,
    roots: Object.freeze([...roots]),
    metadata,
  })
}

/** Resolve the exact live monolithic production roots without mutating them. */
export function resolveDevelopmentRepeatSixPartProductionRoots(
  input: LoadedModelLayer | Object3D,
): DevelopmentRepeatSixPartProductionRootResolution {
  const { modelRoot } = resolveInput(input)
  const validated = validateGraph(modelRoot)
  const resolution = Object.freeze({
    kind: 'development-repeat-six-part-production-root-resolution' as const,
    developmentOnly: true as const,
    metadata: validated.metadata,
    [RESOLUTION_BRAND]: true as const,
  })
  const binding = Object.freeze({
    modelRoot: validated.modelRoot,
    activeScene: validated.activeScene,
    roots: validated.roots,
  })
  issuedResolutions.add(resolution)
  liveBindings.set(resolution, binding)
  return resolution
}

/** Authenticity check for a bridge before it accepts resolver evidence. */
export function isIssuedDevelopmentRepeatSixPartProductionRootResolution(
  value: unknown,
): value is DevelopmentRepeatSixPartProductionRootResolution {
  return Boolean(value && typeof value === 'object' && issuedResolutions.has(value as object) && liveBindings.has(value as object))
}

/**
 * Recover the live roots from authentic evidence and revalidate that their
 * graph, ordinals, physical pins, ordered matrices, and parity are unchanged.
 */
export function getIssuedDevelopmentRepeatSixPartProductionRootLiveBinding(
  resolution: DevelopmentRepeatSixPartProductionRootResolution,
): DevelopmentRepeatSixPartProductionRootLiveBinding {
  if (!isIssuedDevelopmentRepeatSixPartProductionRootResolution(resolution)) {
    fail('FORGED_RESOLUTION', 'Production-root resolution was not issued by this resolver module')
  }
  const binding = liveBindings.get(resolution)!
  let current: ValidatedGraph
  try {
    current = validateGraph(binding.modelRoot)
  } catch (error) {
    if (error instanceof DevelopmentRepeatSixPartProductionRootResolverError) {
      throw new DevelopmentRepeatSixPartProductionRootResolverError(
        'STALE_RESOLUTION',
        `Issued production-root resolution is no longer current: ${error.message}`,
      )
    }
    throw error
  }
  if (
    current.activeScene !== binding.activeScene ||
    current.roots.some((root, index) => root !== binding.roots[index])
  ) {
    fail('STALE_RESOLUTION', 'Issued production-root references were replaced after resolution')
  }
  return binding
}
