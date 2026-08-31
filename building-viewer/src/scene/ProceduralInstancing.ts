import {
  AnimationClip,
  BatchedMesh,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type Material,
  type Object3D,
} from 'three'
import {
  DEFAULT_FLOOR_BAND_HEIGHT,
  SPATIAL_CELL_XZ,
  SPATIAL_CELL_Y,
  cellCoord,
  computeMeshSpatial,
  mergeSpatialFromMeshes,
  spatialKeyXZ,
  type IOMSpatial,
  type SpatialSceneConfig,
} from '../performance/spatial'

export type InstancingGroupInfo = {
  count: number
  /** Per-instance triangles for instancing; packed total for batches. */
  triangles: number
  submittedTriangles: number
  name: string
  kind: 'instance' | 'batch'
}

export type InstancingReport = {
  enabled: boolean
  scannedMeshes: number
  groupsConverted: number
  meshesReplaced: number
  instancesCreated: number
  batchedMeshes: number
  batchedSources: number
  /** Imported EXT_mesh_gpu_instancing groups split into spatially cullable groups. */
  importedInstancedMeshesSplit: number
  /** Spatial groups created from imported EXT_mesh_gpu_instancing sources. */
  importedSpatialGroupsCreated: number
  /** Mirrored imported instances extracted to standalone meshes for correct face culling. */
  importedNegativeInstancesExtracted: number
  drawCallsSaved: number
  skippedSkinned: number
  skippedMultiMaterial: number
  skippedAnimated: number
  /** Mirrored static meshes left standalone because shared draws cannot flip front-face per item. */
  skippedNegativeTransforms: number
  skippedTooFew: number
  topGroups: InstancingGroupInfo[]
  note: string
}

export type ProceduralInstancingOptions = {
  minInstances?: number
  minBatchSize?: number
  animatedNodeNames?: Set<string>
  sharedUuidOnly?: boolean
  /** Scene bounds for spatial (floor, cell) batching — Phase A. */
  spatial?: Partial<SpatialSceneConfig> & {
    sceneMinY: number
    sceneMinX: number
    sceneMinZ: number
  }
}

const _parentInv = new Matrix4()
const _local = new Matrix4()
const _aabb = new Box3()
const _aabbSize = new Vector3()
const _posePos = new Vector3()
const _poseQuat = new Quaternion()
const _poseScl = new Vector3()
const _instanceMatrix = new Matrix4()
const _instanceWorldMatrix = new Matrix4()
const _instanceCenter = new Vector3()
const _geometryCenter = new Vector3()
const _instanceColor = new Color()

type ImportedInstanceSplitReport = {
  sourcesSplit: number
  groupsCreated: number
  negativeInstancesExtracted: number
}

type InstanceBucket = {
  key: string
  indices: number[]
}

function poseKey(mesh: Mesh): string {
  mesh.updateWorldMatrix(true, false)
  mesh.matrixWorld.decompose(_posePos, _poseQuat, _poseScl)
  return [
    Math.round(_posePos.x * 20),
    Math.round(_posePos.y * 20),
    Math.round(_posePos.z * 20),
    Math.round(_poseQuat.x * 8),
    Math.round(_poseQuat.y * 8),
    Math.round(_poseQuat.z * 8),
    Math.round(_poseQuat.w * 8),
  ].join(',')
}

function dropPoseDuplicates(items: Candidate[]): { keep: Candidate[]; drop: Candidate[] } {
  const seen = new Set<string>()
  const keep: Candidate[] = []
  const drop: Candidate[] = []
  for (const item of items) {
    const key = poseKey(item.mesh)
    if (seen.has(key)) drop.push(item)
    else {
      seen.add(key)
      keep.push(item)
    }
  }
  return { keep, drop }
}

type Candidate = {
  mesh: Mesh
  parent: Object3D
  key: string
  triangles: number
  matKey: string
  /** Floor/rig node whose transform still drives this mesh (clip target). */
  animRoot: Object3D | null
  /** Keep explicit exterior ownership homogeneous across packed output. */
  orbitOwnership: 'ext' | 'facade-shutter' | 'none'
  /** Transparent candidates may be BatchedMesh-sorted, but never InstancedMesh-packed. */
  transparent: boolean
  /** Keep visibility/residency semantics homogeneous across packed output. */
  semanticKey: string
  /** Determinant sign of the Object3D that will own the shared draw. */
  packingHostSign: number
}

function orbitOwnership(mesh: Mesh): Candidate['orbitOwnership'] {
  if (mesh.userData?.orbitDuplicateOf === 'icm-ext') return 'ext'
  if (mesh.userData?.orbitDuplicateRole === 'facade-shutter') return 'facade-shutter'
  return 'none'
}

function copyOrbitOwnership(source: Mesh, target: InstancedMesh | BatchedMesh): void {
  const ownership = orbitOwnership(source)
  if (ownership === 'ext') target.userData.orbitDuplicateOf = 'icm-ext'
  if (ownership === 'facade-shutter') {
    target.userData.orbitDuplicateRole = 'facade-shutter'
    target.userData.shutter = true
  }
}

const PACKED_USER_DATA_KEYS = [
  'architecturalGlass',
  'containsArchitecturalGlass',
  'visibilityCritical',
  'detailLodIgnore',
  'floorZoneAlways',
  'floorResidency',
  'floorSurface',
  'paperThinGround',
  'waterSurface',
  'iomExplicitWalkable',
  'surfaceVisibilityRisk',
  'surfaceVisibilityReason',
] as const

function packingSemanticKey(mesh: Mesh): string {
  return PACKED_USER_DATA_KEYS.map((key) => (mesh.userData?.[key] ? '1' : '0')).join('')
}

function copyPackingSemantics(source: Mesh, target: InstancedMesh | BatchedMesh): void {
  for (const key of PACKED_USER_DATA_KEYS) {
    if (source.userData?.[key] != null) target.userData[key] = source.userData[key]
  }
}

function ensureIndexed(geom: BufferGeometry): boolean {
  if (geom.getIndex()) return true
  const pos = geom.getAttribute('position')
  if (!pos || pos.count < 3 || pos.count % 3 !== 0) return false
  const n = pos.count
  if (n > 65535) {
    const idx = new Uint32Array(n)
    for (let i = 0; i < n; i++) idx[i] = i
    geom.setIndex(new BufferAttribute(idx, 1))
  } else {
    const idx = new Uint16Array(n)
    for (let i = 0; i < n; i++) idx[i] = i
    geom.setIndex(new BufferAttribute(idx, 1))
  }
  return true
}

function triangleCount(geom: BufferGeometry): number {
  const index = geom.getIndex()
  if (index) return index.count / 3
  const pos = geom.getAttribute('position')
  return pos ? pos.count / 3 : 0
}

/**
 * BatchedMesh requires every packed geometry to expose the same vertex
 * attribute layout. BIM exports commonly mix UV/no-UV and normalized color
 * encodings even when meshes share one material, so material alone is not a
 * safe batching key.
 */
function geometryAttributeLayoutKey(geom: BufferGeometry): string {
  return Object.keys(geom.attributes)
    .sort()
    .map((name) => {
      const attr = geom.getAttribute(name)
      const arrayName = attr?.array?.constructor?.name ?? 'array'
      return `${name}:${attr?.itemSize ?? 0}:${attr?.normalized ? 1 : 0}:${arrayName}`
    })
    .join(',')
}

export function geometryContentKey(geom: BufferGeometry): string {
  const pos = geom.getAttribute('position')
  const index = geom.getIndex()
  const posLen = pos?.array?.length ?? 0
  const idxLen = index?.array?.length ?? 0
  let mix = posLen * 73856093 + idxLen * 19349663
  if (pos && posLen > 0) {
    const arr = pos.array as ArrayLike<number>
    const step = Math.max(1, Math.floor(posLen / 24))
    for (let i = 0; i < posLen; i += step) {
      mix = (mix + Math.imul(Math.round(arr[i]! * 1000) | 0, i + 1)) | 0
    }
    mix = (mix + Math.round(arr[0]! * 1000)) | 0
    mix = (mix + Math.round(arr[posLen - 1]! * 1000)) | 0
  }
  if (index && idxLen > 0) {
    const arr = index.array as ArrayLike<number>
    mix = (mix + (arr[0]! | 0) + (arr[idxLen - 1]! | 0) * 31) | 0
  }
  return `g:${posLen}:${idxLen}:${mix >>> 0}`
}

export function collectAnimatedNodeNames(clips: AnimationClip[]): Set<string> {
  const names = new Set<string>()
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const node = track.name.split('.')[0]
      if (node) names.add(node)
    }
  }
  return names
}

/** Clip-targeted ancestor (e.g. `Ground Floor._anim1`). Children can still be packed under it. */
function animatedAncestor(obj: Object3D, animatedNames: Set<string> | undefined): Object3D | null {
  if (!animatedNames || animatedNames.size === 0) return null
  let p: Object3D | null = obj
  while (p) {
    if (p.name && animatedNames.has(p.name)) return p
    p = p.parent
  }
  return null
}

function materialKey(mat: Material | Material[]): string | null {
  if (Array.isArray(mat)) {
    if (mat.length !== 1 || !mat[0]) return null
    return mat[0].uuid
  }
  return mat?.uuid ?? null
}

function isTransparentOrGlassMaterial(mat: Material | Material[]): boolean {
  const mats = Array.isArray(mat) ? mat : [mat]
  return mats.some((m) => {
    if (!m) return false
    if (m.transparent || m.opacity < 0.98) return true
    const any = m as Material & { transmission?: number }
    return (any.transmission ?? 0) > 0.02
  })
}

function hasNegativeDeterminant(matrix: Matrix4): boolean {
  return matrix.determinant() < 0
}

/**
 * WebGL can flip front-face winding once for a rendered object, but not for an
 * individual InstancedMesh/BatchedMesh item. Test the transform relative to
 * the object that would own the shared draw; an ancestor's negative scale is
 * safe because it remains on the packed object's matrixWorld.
 */
function hasNegativePackingTransform(mesh: Mesh, hostParent: Object3D): boolean {
  hostParent.updateWorldMatrix(true, false)
  mesh.updateWorldMatrix(true, false)
  const hostSign = Math.sign(hostParent.matrixWorld.determinant())
  const meshSign = Math.sign(mesh.matrixWorld.determinant())
  // A singular transform has no visible orientation to preserve. Comparing
  // signs avoids thousands of matrix inversions during the one-time CAD scan.
  if (hostSign === 0 || meshSign === 0) return false
  return hostSign !== meshSign
}

function packingHostSign(hostParent: Object3D): number {
  hostParent.updateWorldMatrix(true, false)
  return Math.sign(hostParent.matrixWorld.determinant())
}

function copyImportedRenderableState(source: InstancedMesh, target: Mesh): void {
  target.visible = source.visible
  target.castShadow = source.castShadow
  target.receiveShadow = source.receiveShadow
  target.frustumCulled = source.frustumCulled
  target.renderOrder = source.renderOrder
  target.layers.mask = source.layers.mask
  target.customDepthMaterial = source.customDepthMaterial
  target.customDistanceMaterial = source.customDistanceMaterial
  target.onBeforeRender = source.onBeforeRender
  target.onAfterRender = source.onAfterRender
  target.animations = source.animations.slice()
}

function materialWithInstanceColor(
  material: Material | Material[],
  color: Color,
): Material | Material[] {
  const tint = (source: Material): Material => {
    const clone = source.clone()
    const colorMaterial = clone as Material & { color?: Color }
    colorMaterial.color?.multiply(color)
    return clone
  }
  return Array.isArray(material) ? material.map(tint) : tint(material)
}

function assignImportedSpatialResidency(mesh: Mesh, config: SpatialSceneConfig): void {
  mesh.updateWorldMatrix(true, false)
  const residency = computeMeshSpatial(mesh, config)
  mesh.userData.IOM_spatial = {
    floorBand: residency.floorBand,
    floorBandMin: residency.bandMin,
    floorBandMax: residency.bandMax,
    cell: [residency.cellX, 0, residency.cellZ],
    cellXMin: residency.cellXMin,
    cellXMax: residency.cellXMax,
    cellZMin: residency.cellZMin,
    cellZMax: residency.cellZMax,
    alwaysOn: residency.alwaysOn,
  } satisfies IOMSpatial
}

/**
 * glTF EXT_mesh_gpu_instancing normally loads as one InstancedMesh. Three.js
 * culls that object as one unit, so a campus-wide lamp/tree group submits every
 * instance when any one instance is visible. Partition imported groups by
 * spatial cell while retaining shared geometry/material and every per-instance
 * transform. This is a lossless runtime equivalent of Nanite-style cluster
 * culling at the object level.
 */
function prepareImportedInstancedMeshes(
  root: Object3D,
  config: SpatialSceneConfig | null,
  animatedNodeNames?: Set<string>,
): ImportedInstanceSplitReport {
  const sources: InstancedMesh[] = []

  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as InstancedMesh
    if (!mesh.isInstancedMesh || !mesh.parent) return
    // Manifest-v3 packages are already authored/batched offline and must stay
    // owned by their disposable package roots. Runtime repartitioning would
    // move geometry under the animated owner and leave ghosts after unload.
    if (mesh.userData?.hlodPackageResourceScope) return
    if (mesh.userData?.proceduralInstanced || mesh.userData?.spatiallySplitImported) return
    // A track targeting the instanced node itself would no longer bind after
    // replacement. Animated ancestors remain safe because all partitions stay
    // below the same parent transform.
    if (mesh.name && animatedNodeNames?.has(mesh.name)) return
    if (mesh.count < 1 || mesh.morphTexture) return
    sources.push(mesh)
  })

  let sourcesSplit = 0
  let groupsCreated = 0
  let negativeInstancesExtracted = 0

  for (const source of sources) {
    const parent = source.parent
    if (!parent) continue

    if (config) {
      if (!source.geometry.boundingBox) source.geometry.computeBoundingBox()
      const bounds = source.geometry.boundingBox
      if (!bounds || bounds.isEmpty()) _geometryCenter.set(0, 0, 0)
      else bounds.getCenter(_geometryCenter)
    }

    parent.updateWorldMatrix(true, false)
    source.updateWorldMatrix(true, false)
    const buckets = new Map<string, InstanceBucket>()
    const positiveIndices: number[] = []
    const negativeIndices: number[] = []
    for (let i = 0; i < source.count; i++) {
      source.getMatrixAt(i, _instanceMatrix)
      if (hasNegativeDeterminant(_instanceMatrix)) {
        negativeIndices.push(i)
        continue
      }
      positiveIndices.push(i)
      if (!config) continue

      _instanceWorldMatrix.multiplyMatrices(source.matrixWorld, _instanceMatrix)
      _instanceCenter.copy(_geometryCenter).applyMatrix4(_instanceWorldMatrix)
      const floorBand = Math.floor(
        (_instanceCenter.y - config.sceneMinY) / config.bandHeight,
      )
      const cellX = cellCoord(_instanceCenter.x, config.sceneMinX, config.cellSizeXz)
      const cellZ = cellCoord(_instanceCenter.z, config.sceneMinZ, config.cellSizeXz)
      const key = spatialKeyXZ(cellX, cellZ, floorBand)
      const bucket = buckets.get(key)
      if (bucket) bucket.indices.push(i)
      else buckets.set(key, { key, indices: [i] })
    }

    const shouldSpatiallySplit = positiveIndices.length >= 8 && buckets.size >= 2
    if (negativeIndices.length === 0 && !shouldSpatiallySplit) continue

    // Instance matrices with a negative determinant reverse winding inside the
    // shared draw, where Three.js cannot change front-face state per instance.
    // Move only those items to standalone Mesh objects; their complete world
    // transform then drives Three's normal per-object winding correction.
    _parentInv.copy(parent.matrixWorld).invert()
    for (const sourceIndex of negativeIndices) {
      source.getMatrixAt(sourceIndex, _instanceMatrix)
      _instanceWorldMatrix.multiplyMatrices(source.matrixWorld, _instanceMatrix)
      _local.multiplyMatrices(_parentInv, _instanceWorldMatrix)

      let material: Material | Material[] = source.material
      let instanceColor: Color | null = null
      if (source.instanceColor) {
        source.getColorAt(sourceIndex, _instanceColor)
        instanceColor = _instanceColor.clone()
        material = materialWithInstanceColor(source.material, instanceColor)
      }

      const extracted = new Mesh(source.geometry, material)
      extracted.name = `${source.name || 'ImportedInstances'}:mirrored:${sourceIndex}`
      copyImportedRenderableState(source, extracted)
      extracted.matrixAutoUpdate = false
      extracted.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate
      extracted.matrix.copy(_local)
      extracted.userData = {
        ...source.userData,
        importedNegativeInstance: true,
        importedSourceInstance: sourceIndex,
      }
      if (instanceColor) extracted.userData.importedInstanceColor = instanceColor.toArray()
      delete extracted.userData.IOM_spatial
      parent.add(extracted)
      if (config) assignImportedSpatialResidency(extracted, config)
      negativeInstancesExtracted += 1
    }

    if (shouldSpatiallySplit) {
      const replacements: InstancedMesh[] = []
      let partition = 0
      for (const bucket of buckets.values()) {
        const split = new InstancedMesh(source.geometry, source.material, bucket.indices.length)
        split.name = `${source.name || 'ImportedInstances'}:${bucket.key}:${partition++}`
        split.position.copy(source.position)
        split.quaternion.copy(source.quaternion)
        split.scale.copy(source.scale)
        split.matrix.copy(source.matrix)
        split.matrixAutoUpdate = source.matrixAutoUpdate
        split.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate
        copyImportedRenderableState(source, split)
        split.frustumCulled = true
        split.userData = {
          ...source.userData,
          spatiallySplitImported: true,
          spatialPartition: bucket.key,
        }
        // The source residency can cover the entire campus. Recalculate from
        // the actual partition bounds after matrices have been copied.
        delete split.userData.IOM_spatial
        split.instanceMatrix.setUsage(source.instanceMatrix.usage)

        for (let i = 0; i < bucket.indices.length; i++) {
          const sourceIndex = bucket.indices[i]!
          source.getMatrixAt(sourceIndex, _instanceMatrix)
          split.setMatrixAt(i, _instanceMatrix)
          if (source.instanceColor) {
            source.getColorAt(sourceIndex, _instanceColor)
            split.setColorAt(i, _instanceColor)
          }
        }
        split.instanceMatrix.needsUpdate = true
        if (split.instanceColor) split.instanceColor.needsUpdate = true
        split.computeBoundingBox()
        split.computeBoundingSphere()
        parent.add(split)
        assignImportedSpatialResidency(split, config!)
        replacements.push(split)
      }

      source.removeFromParent()
      source.dispose()
      sourcesSplit += 1
      groupsCreated += replacements.length
      continue
    }

    // A small or single-cell imported group does not benefit from another
    // draw-call split. Compact its remaining positive instances in place.
    if (positiveIndices.length === 0) {
      source.removeFromParent()
      source.dispose()
      continue
    }
    for (let targetIndex = 0; targetIndex < positiveIndices.length; targetIndex++) {
      const sourceIndex = positiveIndices[targetIndex]!
      source.getMatrixAt(sourceIndex, _instanceMatrix)
      source.setMatrixAt(targetIndex, _instanceMatrix)
      if (source.instanceColor) {
        source.getColorAt(sourceIndex, _instanceColor)
        source.setColorAt(targetIndex, _instanceColor)
      }
    }
    source.count = positiveIndices.length
    source.instanceMatrix.needsUpdate = true
    if (source.instanceColor) source.instanceColor.needsUpdate = true
    source.computeBoundingBox()
    source.computeBoundingSphere()
    source.userData.importedNegativeInstancesExtracted = negativeIndices.length
    delete source.userData.IOM_spatial
    if (config) assignImportedSpatialResidency(source, config)
  }

  return { sourcesSplit, groupsCreated, negativeInstancesExtracted }
}

export function splitImportedInstancedMeshesBySpatialCell(
  root: Object3D,
  config: SpatialSceneConfig,
  animatedNodeNames?: Set<string>,
): ImportedInstanceSplitReport {
  return prepareImportedInstancedMeshes(root, config, animatedNodeNames)
}

/**
 * Runtime pipeline for imported BIM/GLB buildings:
 * 1) InstancedMesh — repeating geom×material
 * 2) BatchedMesh — unique static parts sharing a material
 *
 * Collision is built separately before packing — no per-mesh proxies.
 */
export function applyProceduralInstancing(
  root: Object3D,
  options: ProceduralInstancingOptions = {},
): InstancingReport {
  const minInstances = Math.max(2, options.minInstances ?? 3)
  const minBatchSize = Math.max(4, options.minBatchSize ?? 12)
  const animatedNames = options.animatedNodeNames
  const sharedUuidOnly = options.sharedUuidOnly === true
  const spatialConfig: SpatialSceneConfig | null = options.spatial
    ? {
        sceneMinY: options.spatial.sceneMinY,
        sceneMinX: options.spatial.sceneMinX,
        sceneMinZ: options.spatial.sceneMinZ,
        bandHeight: options.spatial.bandHeight ?? DEFAULT_FLOOR_BAND_HEIGHT,
        cellSizeXz: options.spatial.cellSizeXz ?? SPATIAL_CELL_XZ,
        cellSizeY: options.spatial.cellSizeY ?? SPATIAL_CELL_Y,
        neighborCells: options.spatial.neighborCells ?? 1,
      }
    : null

  root.updateMatrixWorld(true)
  const importedSplit = prepareImportedInstancedMeshes(root, spatialConfig, animatedNames)
  if (importedSplit.sourcesSplit > 0 || importedSplit.negativeInstancesExtracted > 0) {
    root.updateMatrixWorld(true)
  }

  const spatialSuffix = (mesh: Mesh): string => {
    if (!spatialConfig) return ''
    const s = computeMeshSpatial(mesh, spatialConfig)
    return `|${spatialKeyXZ(s.cellX, s.cellZ, s.floorBand)}`
  }

  const spatialFloorSuffix = (mesh: Mesh): string => {
    if (!spatialConfig) return ''
    const s = computeMeshSpatial(mesh, spatialConfig)
    return `|f${s.floorBand}`
  }

  const candidates: Candidate[] = []
  let skippedSkinned = 0
  let skippedMultiMaterial = 0
  let skippedAnimated = 0
  let skippedNegativeTransforms = 0

  root.traverse((obj) => {
    if (!(obj as Mesh).isMesh) return
    if ((obj as InstancedMesh).isInstancedMesh) return
    if ((obj as BatchedMesh).isBatchedMesh) return
    if (obj.userData?.collisionOnly) return
    if (obj.userData?.compareVisual) return
    if (obj.userData?.hlodPackageResourceScope) return
    if (obj.userData?.proceduralInstanced || obj.userData?.proceduralBatched) return
    if ((obj as SkinnedMesh).isSkinnedMesh) {
      skippedSkinned += 1
      return
    }
    const mesh = obj as Mesh
    if (!mesh.geometry || !mesh.parent) return
    const transparent = isTransparentOrGlassMaterial(mesh.material)
    // Named safety/connection assemblies remain individually addressable.
    // Ordinary floor/ground surfaces may still be packed losslessly: the
    // aggregate keeps their residency flags and BatchedMesh retains per-object
    // frustum culling, so draw reduction does not reintroduce ground holes.
    // Transparent objects are allowed only into the per-object-sorted
    // BatchedMesh path below; they are never converted to InstancedMesh.
    if (mesh.userData?.visibilityCritical && !transparent) return
    // Skip the clip target itself; pack its static children so floor explode still works.
    if (mesh.name && animatedNames?.has(mesh.name)) {
      skippedAnimated += 1
      return
    }
    const matKey = materialKey(mesh.material)
    if (!matKey) {
      skippedMultiMaterial += 1
      return
    }
    const animRoot = animatedAncestor(mesh, animatedNames)
    const hostParent = animRoot ?? mesh.parent
    if (hasNegativePackingTransform(mesh, hostParent)) {
      skippedNegativeTransforms += 1
      return
    }
    const hostSign = packingHostSign(hostParent)
    const animKey = animRoot ? `|anim:${animRoot.uuid}` : ''
    const ownership = orbitOwnership(mesh)
    const semanticKey = packingSemanticKey(mesh)
    const contentOnly = sharedUuidOnly
      ? `uuid:${mesh.geometry.uuid}`
      : geometryContentKey(mesh.geometry)
    candidates.push({
      mesh,
      parent: mesh.parent,
      key: `${contentOnly}|mat:${matKey}${spatialSuffix(mesh)}${animKey}|hostSign:${hostSign}|orbit:${ownership}|semantic:${semanticKey}`,
      triangles: triangleCount(mesh.geometry),
      matKey,
      animRoot,
      orbitOwnership: ownership,
      transparent,
      semanticKey,
      packingHostSign: hostSign,
    })
  })

  const groups = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const list = groups.get(c.key)
    if (list) list.push(c)
    else groups.set(c.key, [c])
  }

  const convertible: Candidate[][] = []
  let skippedTooFew = 0
  const leftovers: Candidate[] = []
  for (const items of groups.values()) {
    if (!items[0]!.transparent && items.length >= minInstances) convertible.push(items)
    else {
      skippedTooFew += items.length
      leftovers.push(...items)
    }
  }
  convertible.sort((a, b) => b.length - a.length)

  let groupsConverted = 0
  let meshesReplaced = 0
  let instancesCreated = 0
  let batchedMeshes = 0
  let batchedSources = 0
  const topGroups: InstancingGroupInfo[] = []
  const used = new Set<Mesh>()

  let poseDuplicatesDropped = 0
  for (const rawItems of convertible) {
    const hostParent = rawItems[0]!.animRoot ?? rawItems[0]!.parent
    // Static groups may span several source parents. Re-check against the
    // actual shared-draw owner so a later grouping-key change can never place
    // a mirrored relative matrix into InstancedMesh.
    const hostSafeItems = rawItems.filter(
      (item) => !hasNegativePackingTransform(item.mesh, hostParent),
    )
    skippedNegativeTransforms += rawItems.length - hostSafeItems.length
    const { keep: items, drop } = dropPoseDuplicates(hostSafeItems)
    for (const d of drop) {
      d.mesh.visible = false
      d.mesh.userData.cadDuplicate = true
      d.mesh.removeFromParent()
      used.add(d.mesh)
    }
    poseDuplicatesDropped += drop.length
    if (items.length < minInstances) continue

    const primary = items[0]!
    const geom = primary.mesh.geometry
    const material = Array.isArray(primary.mesh.material)
      ? primary.mesh.material[0]!
      : primary.mesh.material

    const instanced = new InstancedMesh(geom, material, items.length)
    instanced.name = `Instanced:${primary.mesh.name || 'mesh'}×${items.length}`
    _aabb.setFromObject(primary.mesh)
    _aabb.getSize(_aabbSize)
    const partFoot = Math.max(0.01, _aabbSize.x) * Math.max(0.01, _aabbSize.z)
    const partMass = partFoot >= 12 || Math.max(_aabbSize.x, _aabbSize.y, _aabbSize.z) >= 8
    instanced.castShadow = partMass && items.some((i) => i.mesh.castShadow)
    instanced.receiveShadow = items.some((i) => i.mesh.receiveShadow)
    instanced.frustumCulled = true
    instanced.userData.proceduralInstanced = true
    copyOrbitOwnership(primary.mesh, instanced)
    copyPackingSemantics(primary.mesh, instanced)
    instanced.userData.partSize = {
      sx: Math.max(0.01, _aabbSize.x),
      sy: Math.max(0.01, _aabbSize.y),
      sz: Math.max(0.01, _aabbSize.z),
    }
    if (spatialConfig) {
      instanced.userData.IOM_spatial = mergeSpatialFromMeshes(
        items.map((i) => i.mesh),
        spatialConfig,
      ) satisfies IOMSpatial
    }

    hostParent.updateWorldMatrix(true, false)
    for (let i = 0; i < items.length; i++) {
      const src = items[i]!
      src.mesh.updateWorldMatrix(true, false)
      _parentInv.copy(hostParent.matrixWorld).invert()
      _local.multiplyMatrices(_parentInv, src.mesh.matrixWorld)
      instanced.setMatrixAt(i, _local)
      used.add(src.mesh)
    }
    instanced.instanceMatrix.needsUpdate = true
    instanced.computeBoundingSphere()
    instanced.matrixAutoUpdate = false
    instanced.updateMatrix()
    hostParent.add(instanced)
    for (const { mesh } of items) mesh.removeFromParent()

    groupsConverted += 1
    meshesReplaced += items.length
    instancesCreated += items.length
    if (topGroups.length < 10) {
      topGroups.push({
        count: items.length,
        triangles: Math.round(primary.triangles),
        submittedTriangles: Math.round(primary.triangles * items.length),
        name: primary.mesh.name || 'mesh',
        kind: 'instance',
      })
    }
  }

  const minUniqueBatch = Math.min(4, minBatchSize)
  const byMaterial = new Map<string, Candidate[]>()
  for (const c of leftovers) {
    if (used.has(c.mesh)) continue
    if (!ensureIndexed(c.mesh.geometry)) continue
    // Unique CAD: material + floor + anim root (not 12 m cell — that left ~9k leftover draws).
    const space = spatialConfig ? spatialFloorSuffix(c.mesh) : ''
    const animKey = c.animRoot ? `|anim:${c.animRoot.uuid}` : ''
    const attributeLayout = geometryAttributeLayoutKey(c.mesh.geometry)
    const batchKey = `mat:${c.matKey}|attrs:${attributeLayout}${space}${animKey}|hostSign:${c.packingHostSign}|orbit:${c.orbitOwnership}|semantic:${c.semanticKey}|transparent:${c.transparent ? 1 : 0}`
    const list = byMaterial.get(batchKey)
    if (list) list.push(c)
    else byMaterial.set(batchKey, [c])
  }

  for (const group of byMaterial.values()) {
    if (group.length < minUniqueBatch) continue

    const batches: Candidate[][] = []
    let slice: Candidate[] = []
    let sliceVerts = 0
    let sliceIndex = 0
    const MAX_BATCH_VERTS = 250_000
    const MAX_BATCH_INDEX = 750_000
    const MAX_BATCH_ITEMS = 192
    for (const c of group) {
      const pos = c.mesh.geometry.getAttribute('position')
      const idx = c.mesh.geometry.getIndex()
      const v = pos?.count ?? 0
      const i = idx?.count ?? 0
      if (
        slice.length >= minUniqueBatch &&
        (slice.length >= MAX_BATCH_ITEMS ||
          sliceVerts + v > MAX_BATCH_VERTS ||
          sliceIndex + i > MAX_BATCH_INDEX)
      ) {
        batches.push(slice)
        slice = []
        sliceVerts = 0
        sliceIndex = 0
      }
      slice.push(c)
      sliceVerts += v
      sliceIndex += i
    }
    if (slice.length) batches.push(slice)

    for (const rawBatchItems of batches) {
    if (rawBatchItems.length < minUniqueBatch) continue

    const hostParent = rawBatchItems[0]!.animRoot ?? rawBatchItems[0]!.parent
    // As with InstancedMesh, validate against the final shared owner rather
    // than assuming every source's immediate parent has the same orientation.
    const items = rawBatchItems.filter(
      (item) => !hasNegativePackingTransform(item.mesh, hostParent),
    )
    skippedNegativeTransforms += rawBatchItems.length - items.length
    if (items.length < minUniqueBatch) continue

    let maxVerts = 0
    let maxIndex = 0
    for (const c of items) {
      const pos = c.mesh.geometry.getAttribute('position')
      const idx = c.mesh.geometry.getIndex()
      maxVerts += pos?.count ?? 0
      maxIndex += idx?.count ?? 0
    }
    if (maxVerts < 3 || maxIndex < 3) continue

    const material = Array.isArray(items[0]!.mesh.material)
      ? items[0]!.mesh.material[0]!
      : items[0]!.mesh.material
    const transparent = items[0]!.transparent

    let batched: BatchedMesh | null = null
    try {
      batched = new BatchedMesh(items.length, maxVerts, maxIndex, material)
      batched.name = `Batched:${material.name || 'mat'}×${items.length}`
      batched.castShadow = !transparent && items.some((i) => i.mesh.castShadow)
      // Never force receiveShadow — glass/transparent were already excluded above.
      batched.receiveShadow = !transparent && items.some((i) => i.mesh.receiveShadow)
      batched.frustumCulled = true
      // three r181+: cull individual batched draws when their sphere is off-screen.
      ;(batched as BatchedMesh & { perObjectFrustumCulled?: boolean }).perObjectFrustumCulled = true
      ;(batched as BatchedMesh & { sortObjects?: boolean }).sortObjects = true
      batched.userData.proceduralBatched = true
      batched.matrixAutoUpdate = false
      batched.updateMatrix()
      copyOrbitOwnership(items[0]!.mesh, batched)
      copyPackingSemantics(items[0]!.mesh, batched)
      if (spatialConfig) {
        batched.userData.IOM_spatial = mergeSpatialFromMeshes(
          items.map((i) => i.mesh),
          spatialConfig,
        ) satisfies IOMSpatial
      }

      const committed: Mesh[] = []
      const instanceLod: { id: number; radius: number; tris: number; sx: number; sy: number; sz: number }[] = []
      hostParent.updateWorldMatrix(true, false)
      for (const c of items) {
        if (!c.mesh.geometry.boundingSphere) c.mesh.geometry.computeBoundingSphere()
        if (!c.mesh.geometry.boundingBox) c.mesh.geometry.computeBoundingBox()
        const geoId = batched.addGeometry(c.mesh.geometry)
        const instanceId = batched.addInstance(geoId)
        c.mesh.updateWorldMatrix(true, false)
        _parentInv.copy(hostParent.matrixWorld).invert()
        _local.multiplyMatrices(_parentInv, c.mesh.matrixWorld)
        batched.setMatrixAt(instanceId, _local)
        _aabb.setFromObject(c.mesh)
        _aabb.getSize(_aabbSize)
        const radius = Math.max(0.05, Math.max(_aabbSize.x, _aabbSize.y, _aabbSize.z) * 0.5)
        instanceLod.push({
          id: instanceId,
          radius,
          tris: c.triangles,
          sx: Math.max(0.01, _aabbSize.x),
          sy: Math.max(0.01, _aabbSize.y),
          sz: Math.max(0.01, _aabbSize.z),
        })
        committed.push(c.mesh)
      }

      if (committed.length < minUniqueBatch) {
        batched.dispose()
        continue
      }

      for (const mesh of committed) {
        used.add(mesh)
        mesh.removeFromParent()
      }

      hostParent.add(batched)
      batched.userData.batchInstances = instanceLod
      try {
        batched.computeBoundingSphere()
      } catch {
        // Some batches lack a ready sphere until first render — keep cull on anyway.
      }
      batchedMeshes += 1
      batchedSources += committed.length
      meshesReplaced += committed.length
      groupsConverted += 1
      if (topGroups.length < 12) {
        const packedTris = Math.round(items.reduce((s, i) => s + i.triangles, 0))
        topGroups.push({
          count: committed.length,
          triangles: packedTris,
          submittedTriangles: packedTris,
          name: material.name || 'material-batch',
          kind: 'batch',
        })
      }
    } catch (err) {
      console.warn('[ProceduralInstancing] BatchedMesh failed', err)
      batched?.dispose()
    }
    }
  }

  const instancedMeshCount = groupsConverted - batchedMeshes
  const drawCallsSaved =
    Math.max(0, instancesCreated - instancedMeshCount) + Math.max(0, batchedSources - batchedMeshes)

  const noteParts: string[] = []
  if (instancesCreated > 0) noteParts.push(`Instanced ${instancesCreated} repeating meshes`)
  if (batchedSources > 0) {
    noteParts.push(`batched ${batchedSources} unique parts into ${batchedMeshes} BatchedMesh`)
  }
  if (poseDuplicatesDropped > 0) {
    noteParts.push(`dropped ${poseDuplicatesDropped} overlapping CAD copies`)
  }
  if (importedSplit.sourcesSplit > 0) {
    noteParts.push(
      `split ${importedSplit.sourcesSplit} imported instance groups into ${importedSplit.groupsCreated} spatial groups`,
    )
  }
  if (importedSplit.negativeInstancesExtracted > 0) {
    noteParts.push(
      `extracted ${importedSplit.negativeInstancesExtracted} mirrored imported instances`,
    )
  }
  if (skippedNegativeTransforms > 0) {
    noteParts.push(`kept ${skippedNegativeTransforms} mirrored meshes standalone`)
  }
  if (noteParts.length === 0) {
    noteParts.push(
      'Few packable clusters — CAD uniqueness dominates; use Performance quality or hide a layer',
    )
  }

  return {
    enabled: true,
    scannedMeshes: candidates.length,
    groupsConverted,
    meshesReplaced,
    instancesCreated,
    batchedMeshes,
    batchedSources,
    importedInstancedMeshesSplit: importedSplit.sourcesSplit,
    importedSpatialGroupsCreated: importedSplit.groupsCreated,
    importedNegativeInstancesExtracted: importedSplit.negativeInstancesExtracted,
    drawCallsSaved,
    skippedSkinned,
    skippedMultiMaterial,
    skippedAnimated,
    skippedNegativeTransforms,
    skippedTooFew,
    topGroups,
    note: `${noteParts.join('; ')}.`,
  }
}

