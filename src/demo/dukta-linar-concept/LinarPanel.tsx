import {
  BufferGeometry,
  BoxGeometry,
  DynamicDrawUsage,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'
import {
  MAX_SLATS,
  bridgeSegsFor,
  curveElement,
  makeBendState,
  maxRenderedNormalOffsetM,
  slatLayout,
  type BendState,
  type BridgeSeg,
  type PanelLayout,
  type SlatSpec,
} from './bendMath'
import type { LinarTech } from './linarData'
import {
  cadBridgeProfileHeightMm,
  type LinarCadCutGeometry,
} from './linarGeometry'
import { createLinarMaterials, type LinarMaterialSet } from './materials'
import { backingVisualProfile } from './materialData'
import type {
  LinarBacking,
  LinarConfig,
  LinarFleeceColourId,
  LinarFeltColourId,
  LinarMaterialId,
  LinarMdfColourId,
  LinarMdfVariant,
  LinarVeneerId,
} from './types'
import { cloneConfig } from './types'

const MAX_BRIDGES = 18000
const SOLID_BAND_SEGMENTS = MAX_SLATS
// A local routed lobe is sub-pixel in normal views. Sixteen analytically
// sampled, smooth-shaded slices preserve its approved circular profile in a
// close-up while avoiding millions of redundant triangles in repeated panels.
const BRIDGE_PROFILE_STEPS = 16
const pose = { x: 0, z: 0, rotY: 0 }
// Render-only separation from the physical rear face. It prevents coplanar
// flicker without representing a measured LED cavity or mounting depth.
const BACKLIGHT_RENDER_OFFSET_M = 0.00025
const BACKING_RENDER_GAP_M = 0.0001
const BACKLIGHT_VISIBLE_EPSILON = 0.002

export type LinarPanelHandle = {
  group: Object3D
  setBend: (
    percent: number,
    referenceRadiusMm: number | null,
    secondaryCurveAmount?: number,
  ) => BendState
  setConfig: (config: LinarConfig, tech: LinarTech) => void
  setMaterial: (
    id: LinarMaterialId,
    veneer: LinarVeneerId,
    mdfVariant: LinarMdfVariant,
    mdfColour: LinarMdfColourId,
    immediate?: boolean,
  ) => void
  setBacking: (
    backing: LinarBacking,
    fleeceColour: LinarFleeceColourId,
    feltColour: LinarFeltColourId,
  ) => void
  setBacklightStrength: (strength: number) => void
  prewarmMaterial: (id: LinarMaterialId, veneer: LinarVeneerId) => void
  tickMaterials: (dt: number) => boolean
  boundingSize: Vector3
  dispose: () => void
}

type PartialBridgeBatch = {
  geometry: BufferGeometry
  mesh: InstancedMesh
  segments: BridgeSeg[]
}

function boxMaterials(set: LinarMaterialSet): MeshStandardMaterial[] {
  return [set.cut, set.cut, set.end, set.end, set.face, set.reverse]
}

function bridgeAssemblyMaterials(set: LinarMaterialSet): MeshStandardMaterial[] {
  // Material 0 is the local rear face of the remaining bridge wood. It is not
  // a continuous rear sheet. Material 1 is the CAD-derived routed wood face.
  return [set.reverse, set.bridgeCut]
}

function solidBandMaterials(set: LinarMaterialSet): MeshStandardMaterial[] {
  // Top and bottom expose end grain; the two long perimeter edges expose a
  // routed/cut edge parallel to the face grain.
  return [set.face, set.reverse, set.end, set.cut]
}

type SolidBandGeometry = {
  geometry: BufferGeometry
  position: Float32BufferAttribute
  normal: Float32BufferAttribute
  uv: Float32BufferAttribute
  sampleIndices: Uint16Array
  yFactors: Float32Array
  zSides: Float32Array
  normalKinds: Uint8Array
  heightUvFactors: Float32Array
}

type BackingRibbonGeometry = {
  geometry: BufferGeometry
  position: Float32BufferAttribute
  normal: Float32BufferAttribute
}

function createBackingRibbonGeometry(): BackingRibbonGeometry {
  const vertexCount = (SOLID_BAND_SEGMENTS + 1) * 2
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const indices: number[] = []

  for (let i = 0; i <= SOLID_BAND_SEGMENTS; i += 1) {
    const u = i / SOLID_BAND_SEGMENTS
    for (let edge = 0; edge < 2; edge += 1) {
      const vertex = i * 2 + edge
      uvs[vertex * 2] = u
      uvs[vertex * 2 + 1] = edge
    }
    if (i < SOLID_BAND_SEGMENTS) {
      const a = i * 2
      const b = a + 1
      const c = a + 2
      const d = a + 3
      indices.push(a, c, b, c, d, b)
    }
  }

  const geometry = new BufferGeometry()
  const position = new Float32BufferAttribute(positions, 3).setUsage(DynamicDrawUsage)
  const normal = new Float32BufferAttribute(normals, 3).setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', position)
  geometry.setAttribute('normal', normal)
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return { geometry, position, normal }
}

/**
 * One continuous unincised panel side. Only its vertex positions change while
 * bending; static groups retain distinct face, reverse and finished-edge
 * materials without the pitch seams caused by overlapping fill boxes. The
 * inner face is omitted because it is internal to the solid/slat union.
 */
function createSolidBandGeometry(edgeMaterialIndices: {
  left: number | null
  right: number | null
}): SolidBandGeometry {
  const geometry = new BufferGeometry()
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const sampleIndices: number[] = []
  const yFactors: number[] = []
  const zSides: number[] = []
  const normalKinds: number[] = []
  const heightUvFactors: number[] = []

  // normalKinds: 0 front, 1 rear, 2 top, 3 bottom, 4 left, 5 right.
  const addVertex = (
    sample: number,
    yFactor: number,
    zSide: number,
    normalKind: number,
    u: number,
    v: number,
    heightUvFactor = -1,
  ): number => {
    const x = sample / SOLID_BAND_SEGMENTS - 0.5
    vertices.push(x, yFactor, zSide * 0.5)
    normals.push(0, 0, zSide)
    uvs.push(u, v)
    sampleIndices.push(sample)
    yFactors.push(yFactor)
    zSides.push(zSide)
    normalKinds.push(normalKind)
    heightUvFactors.push(heightUvFactor)
    return vertices.length / 3 - 1
  }
  const addQuad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d)
  }

  const addLongSurface = (zSide: number, materialIndex: number, reverseWinding: boolean) => {
    const start = indices.length
    const bottom: number[] = []
    const top: number[] = []
    const normalKind = zSide > 0 ? 0 : 1
    for (let i = 0; i <= SOLID_BAND_SEGMENTS; i += 1) {
      const u = i / SOLID_BAND_SEGMENTS
      bottom.push(addVertex(i, 0, zSide, normalKind, u, 0, 0))
      top.push(addVertex(i, 1, zSide, normalKind, u, 1, 1))
    }
    for (let i = 0; i < SOLID_BAND_SEGMENTS; i += 1) {
      if (reverseWinding) addQuad(bottom[i], top[i], top[i + 1], bottom[i + 1])
      else addQuad(bottom[i], bottom[i + 1], top[i + 1], top[i])
    }
    geometry.addGroup(start, indices.length - start, materialIndex)
  }

  const addHorizontalEdge = (yFactor: number, materialIndex: number, topEdge: boolean) => {
    const start = indices.length
    const front: number[] = []
    const rear: number[] = []
    const normalKind = topEdge ? 2 : 3
    for (let i = 0; i <= SOLID_BAND_SEGMENTS; i += 1) {
      const u = i / SOLID_BAND_SEGMENTS
      front.push(addVertex(i, yFactor, 1, normalKind, u, 1))
      rear.push(addVertex(i, yFactor, -1, normalKind, u, 0))
    }
    for (let i = 0; i < SOLID_BAND_SEGMENTS; i += 1) {
      if (topEdge) addQuad(front[i], front[i + 1], rear[i + 1], rear[i])
      else addQuad(front[i], rear[i], rear[i + 1], front[i + 1])
    }
    geometry.addGroup(start, indices.length - start, materialIndex)
  }

  const addSideEdge = (sample: number, materialIndex: number, rightEdge: boolean) => {
    const start = indices.length
    const normalKind = rightEdge ? 5 : 4
    const frontBottom = addVertex(sample, 0, 1, normalKind, 1, 0, 0)
    const frontTop = addVertex(sample, 1, 1, normalKind, 1, 1, 1)
    const rearTop = addVertex(sample, 1, -1, normalKind, 0, 1, 1)
    const rearBottom = addVertex(sample, 0, -1, normalKind, 0, 0, 0)
    if (rightEdge) addQuad(frontBottom, rearBottom, rearTop, frontTop)
    else addQuad(frontBottom, frontTop, rearTop, rearBottom)
    geometry.addGroup(start, indices.length - start, materialIndex)
  }

  addLongSurface(1, 0, false)
  addLongSurface(-1, 1, true)
  addHorizontalEdge(1, 2, true)
  addHorizontalEdge(0, 2, false)
  if (edgeMaterialIndices.left != null) addSideEdge(0, edgeMaterialIndices.left, false)
  if (edgeMaterialIndices.right != null) {
    addSideEdge(SOLID_BAND_SEGMENTS, edgeMaterialIndices.right, true)
  }

  const position = new Float32BufferAttribute(vertices, 3)
  const normal = new Float32BufferAttribute(normals, 3)
  const uv = new Float32BufferAttribute(uvs, 2)
  position.setUsage(DynamicDrawUsage)
  normal.setUsage(DynamicDrawUsage)
  uv.setUsage(DynamicDrawUsage)
  geometry.setAttribute('position', position)
  geometry.setAttribute('normal', normal)
  geometry.setAttribute('uv', uv)
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  return {
    geometry,
    position,
    normal,
    uv,
    sampleIndices: Uint16Array.from(sampleIndices),
    yFactors: Float32Array.from(yFactors),
    zSides: Float32Array.from(zSides),
    normalKinds: Uint8Array.from(normalKinds),
    heightUvFactors: Float32Array.from(heightUvFactors),
  }
}

/**
 * One normalised bridge assembly derived from the supplied 125 mm blade CAD.
 * The local rear rectangle is only the rear face of this bridge unit. At
 * runtime the routed wood face rises to `thickness - top cutting depth` and
 * returns to the finished rear plane at both ends.
 *
 * Cut-wood walls close both X sides and any exposed/clipped Y end with a flat,
 * straight plane matching the saw-cut reference. No semicircular shoulder or
 * rounded bridge cap is added. The walls are
 * normally hidden where a bridge meets its neighbouring slats, but become
 * essential as those slats rotate apart: without them the curved bridge reads
 * as a hollow shell instead of a routed piece of solid wood.
 */
function createBridgeAssemblyGeometry(
  cadGeometry: LinarCadCutGeometry,
  profileStart = 0,
  profileEnd = 1,
): BufferGeometry {
  const geometry = new BufferGeometry()
  const vertices: number[] = [
    -0.5, -0.5, -0.5,
    0.5, -0.5, -0.5,
    0.5, 0.5, -0.5,
    -0.5, 0.5, -0.5,
  ]
  const uvs: number[] = [0, profileStart, 1, profileStart, 1, profileEnd, 0, profileEnd]
  const indices: number[] = [0, 3, 2, 0, 2, 1]
  const rearCount = indices.length
  const profileSteps = BRIDGE_PROFILE_STEPS
  const curveLeft: number[] = []
  const curveRight: number[] = []

  const addVertex = (x: number, y: number, z: number, u: number, v: number): number => {
    vertices.push(x, y, z)
    uvs.push(u, v)
    return vertices.length / 3 - 1
  }

  for (let i = 0; i <= profileSteps; i += 1) {
    const t = i / profileSteps
    const sourceT = profileStart + (profileEnd - profileStart) * t
    const heightMm = cadBridgeProfileHeightMm(cadGeometry, sourceT)
    // Keep the local -0.5..+0.5 convention so the plywood layer
    // shader retains the same phase as the isolated bridge study.
    const z =
      -0.5 + heightMm / Math.max(0.000001, cadGeometry.bridgeHeightMm)
    const y = t - 0.5
    curveLeft.push(addVertex(-0.5, y, z, 0, sourceT))
    curveRight.push(addVertex(0.5, y, z, 1, sourceT))
  }

  const curveStart = indices.length
  for (let i = 0; i < profileSteps; i += 1) {
    indices.push(
      curveLeft[i],
      curveRight[i],
      curveRight[i + 1],
      curveLeft[i],
      curveRight[i + 1],
      curveLeft[i + 1],
    )
  }
  const curveCount = indices.length - curveStart

  const wallsStart = indices.length
  const addWallQuad = (
    a: [number, number, number, number, number],
    b: [number, number, number, number, number],
    c: [number, number, number, number, number],
    d: [number, number, number, number, number],
    reverse = false,
  ) => {
    const ia = addVertex(...a)
    const ib = addVertex(...b)
    const ic = addVertex(...c)
    const id = addVertex(...d)
    if (reverse) indices.push(ia, id, ic, ia, ic, ib)
    else indices.push(ia, ib, ic, ia, ic, id)
  }

  for (let i = 0; i < profileSteps; i += 1) {
    const t0 = i / profileSteps
    const t1 = (i + 1) / profileSteps
    const left0 = vertices.slice(curveLeft[i] * 3, curveLeft[i] * 3 + 3)
    const left1 = vertices.slice(curveLeft[i + 1] * 3, curveLeft[i + 1] * 3 + 3)
    const right0 = vertices.slice(curveRight[i] * 3, curveRight[i] * 3 + 3)
    const right1 = vertices.slice(curveRight[i + 1] * 3, curveRight[i + 1] * 3 + 3)

    addWallQuad(
      [-0.5, left0[1], -0.5, 0, t0],
      [-0.5, left1[1], -0.5, 0, t1],
      [-0.5, left1[1], left1[2], 1, t1],
      [-0.5, left0[1], left0[2], 1, t0],
      true,
    )
    addWallQuad(
      [0.5, right0[1], -0.5, 0, t0],
      [0.5, right0[1], right0[2], 1, t0],
      [0.5, right1[1], right1[2], 1, t1],
      [0.5, right1[1], -0.5, 0, t1],
      true,
    )
  }

  const addEndCap = (curveZ: number, y: number, v: number, top: boolean) => {
    if (curveZ <= -0.5 + 0.000001) return
    addWallQuad(
      [-0.5, y, -0.5, 0, v],
      [0.5, y, -0.5, 1, v],
      [0.5, y, curveZ, 1, v],
      [-0.5, y, curveZ, 0, v],
      top,
    )
  }
  const firstCurveZ = vertices[curveLeft[0] * 3 + 2]
  const lastCurveZ = vertices[curveLeft[curveLeft.length - 1] * 3 + 2]
  addEndCap(firstCurveZ, -0.5, profileStart, false)
  addEndCap(lastCurveZ, 0.5, profileEnd, true)
  const wallsCount = indices.length - wallsStart

  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.addGroup(0, rearCount, 0)
  geometry.addGroup(curveStart, curveCount, 1)
  geometry.addGroup(wallsStart, wallsCount, 1)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export function createLinarPanel(initial: { config: LinarConfig; tech: LinarTech }): LinarPanelHandle {
  const group = new Object3D()
  group.name = 'LinarPanel'

  const materials = createLinarMaterials()
  const unitBox = new BoxGeometry(1, 1, 1)
  let currentCadGeometry = initial.tech.cadGeometry
  let fullBridgeGeo = createBridgeAssemblyGeometry(currentCadGeometry)
  const backingRibbon = createBackingRibbonGeometry()
  // The left panel side has its finished outer edge on the left and its
  // routed incision boundary on the right; the right side is the inverse.
  const leftSolidBand = createSolidBandGeometry({ left: 3, right: null })
  const rightSolidBand = createSolidBandGeometry({ left: null, right: 3 })

  const slatMats = boxMaterials(materials)
  const bridgeMats = bridgeAssemblyMaterials(materials)
  const solidMats = solidBandMaterials(materials)
  const slatsMesh = new InstancedMesh(unitBox, slatMats, MAX_SLATS)
  slatsMesh.name = 'LinarSlats'
  slatsMesh.castShadow = true
  slatsMesh.receiveShadow = true
  slatsMesh.frustumCulled = false
  slatsMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const bridgesMesh = new InstancedMesh(fullBridgeGeo, bridgeMats, MAX_BRIDGES)
  bridgesMesh.name = 'LinarBridgeAssemblies'
  bridgesMesh.castShadow = true
  bridgesMesh.receiveShadow = true
  bridgesMesh.frustumCulled = false
  bridgesMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const leftSolidBandMesh = new Mesh(leftSolidBand.geometry, solidMats)
  leftSolidBandMesh.name = 'LinarSolidLeft'
  leftSolidBandMesh.castShadow = true
  leftSolidBandMesh.receiveShadow = true
  leftSolidBandMesh.frustumCulled = false

  const rightSolidBandMesh = new Mesh(rightSolidBand.geometry, solidMats)
  rightSolidBandMesh.name = 'LinarSolidRight'
  rightSolidBandMesh.castShadow = true
  rightSolidBandMesh.receiveShadow = true
  rightSolidBandMesh.frustumCulled = false

  const backingMesh = new Mesh(backingRibbon.geometry, materials.backing)
  backingMesh.name = 'LinarBacking'
  backingMesh.castShadow = false
  backingMesh.receiveShadow = true
  backingMesh.frustumCulled = false
  backingMesh.visible = false

  // A real deformed diffuser surface sits behind the manufactured geometry.
  // The slats and bridge assemblies therefore occlude it through ordinary
  // depth testing, leaving only the true LINAR apertures luminous.
  const backlightMaterial = new MeshBasicMaterial({
    color: 0xffc978,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  })
  // Replicas share this material. Keeping visibility here, rather than on the
  // source mesh, removes every diffuser draw call without synchronising clones.
  backlightMaterial.visible = false
  const backlightMesh = new Mesh(backingRibbon.geometry, backlightMaterial)
  backlightMesh.name = 'LinarBacklightDiffuser'
  backlightMesh.castShadow = false
  backlightMesh.receiveShadow = false
  backlightMesh.frustumCulled = false

  const partialBridgesGroup = new Object3D()
  partialBridgesGroup.name = 'LinarPartialBridges'

  group.add(backlightMesh)
  group.add(backingMesh)
  group.add(slatsMesh)
  group.add(leftSolidBandMesh)
  group.add(rightSolidBandMesh)
  group.add(bridgesMesh)
  group.add(partialBridgesGroup)

  const dummy = new Object3D()
  const leftContactPose = { x: 0, z: 0, rotY: 0 }
  const rightContactPose = { x: 0, z: 0, rotY: 0 }
  // One centreline sample per lamella is enough for every bridge row and the
  // optional backing. Reusing it avoids thousands of identical lookup calls
  // while the bend sliders animate.
  const slatPoseX = new Float32Array(MAX_SLATS)
  const slatPoseZ = new Float32Array(MAX_SLATS)
  const slatPoseRotY = new Float32Array(MAX_SLATS)
  const solidPoseX = new Float32Array(SOLID_BAND_SEGMENTS + 1)
  const solidPoseZ = new Float32Array(SOLID_BAND_SEGMENTS + 1)
  const solidPoseRotY = new Float32Array(SOLID_BAND_SEGMENTS + 1)
  let layout: PanelLayout = slatLayout(initial.config)
  const boundingSize = new Vector3(
    layout.panelWidthM,
    layout.panelHeightM,
    layout.thicknessM,
  )
  let slats: SlatSpec[] = layout.slats
  let fullBridges: BridgeSeg[] = []
  let partialBridgeBatches: PartialBridgeBatch[] = []
  let backing: LinarBacking = initial.config.backing
  let fleeceColour: LinarFleeceColourId = initial.config.fleeceColour
  let topCutDepthM = Math.max(0, initial.tech.topCutDepthMm / 1000)
  let lastPercent = 0
  let lastSecondaryCurveAmount = 0
  let lastRadius: number | null = initial.tech.referenceMinimumRadiusMm

  const markActiveInstanceMatrices = (mesh: InstancedMesh, activeCount: number) => {
    const attribute = mesh.instanceMatrix
    attribute.clearUpdateRanges()
    if (activeCount > 0) attribute.addUpdateRange(0, activeCount * 16)
    attribute.needsUpdate = true
  }

  const clearPartialBridgeBatches = () => {
    for (const batch of partialBridgeBatches) {
      partialBridgesGroup.remove(batch.mesh)
      batch.mesh.dispose()
      batch.geometry.dispose()
    }
    partialBridgeBatches = []
  }

  const rebuildBridgeBatches = (segments: BridgeSeg[]) => {
    clearPartialBridgeBatches()
    fullBridges = []
    const partials = new Map<string, BridgeSeg[]>()

    for (const segment of segments) {
      const isFullProfile = segment.profileStart <= 0.000001 && segment.profileEnd >= 0.999999
      if (isFullProfile) {
        fullBridges.push(segment)
        continue
      }
      // At regular boundaries these keys are the two exact profile halves.
      // Partial coverage can create another small set of clipped ranges.
      const key = `${segment.profileStart.toFixed(6)}:${segment.profileEnd.toFixed(6)}`
      const groupSegments = partials.get(key)
      if (groupSegments) groupSegments.push(segment)
      else partials.set(key, [segment])
    }

    for (const segmentsForProfile of partials.values()) {
      const first = segmentsForProfile[0]
      const geometry = createBridgeAssemblyGeometry(
        currentCadGeometry,
        first.profileStart,
        first.profileEnd,
      )
      const mesh = new InstancedMesh(geometry, bridgeMats, segmentsForProfile.length)
      mesh.name = 'LinarClippedBridgeProfile'
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      partialBridgesGroup.add(mesh)
      partialBridgeBatches.push({ geometry, mesh, segments: segmentsForProfile })
    }
  }

  const place = (
    x: number,
    y: number,
    z: number,
    rotY: number,
    sx: number,
    sy: number,
    sz: number,
    rotZ = 0,
  ) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, rotY, rotZ)
    dummy.scale.set(Math.max(sx, 0.0002), Math.max(sy, 0.0002), Math.max(sz, 0.0002))
    dummy.updateMatrix()
  }

  const updateSolidBand = (
    band: SolidBandGeometry,
    mesh: Mesh,
    x0: number,
    x1: number,
    state: BendState,
  ) => {
    const solidWidth = x1 - x0
    const visible = solidWidth > 0.0004
    mesh.visible = visible
    if (!visible) return

    const halfThickness = layout.thicknessM * 0.5

    // Sample the same centreline deformation used by the incised slats. Each
    // unincised side is one continuous full-height surface, and its inner edge
    // meets the first/last continuous slat exactly at the pattern boundary.
    for (let i = 0; i <= SOLID_BAND_SEGMENTS; i += 1) {
      const originalX = x0 + solidWidth * (i / SOLID_BAND_SEGMENTS)
      curveElement(originalX, state, layout.panelWidthM, pose)
      solidPoseX[i] = pose.x
      solidPoseZ[i] = pose.z
      solidPoseRotY[i] = pose.rotY
    }

    for (let vertex = 0; vertex < band.position.count; vertex += 1) {
      const sample = band.sampleIndices[vertex]
      const rotY = solidPoseRotY[sample]
      const normalX = Math.sin(rotY)
      const normalZ = Math.cos(rotY)
      const depthOffset = band.zSides[vertex] * halfThickness

      band.position.setXYZ(
        vertex,
        solidPoseX[sample] + normalX * depthOffset,
        band.yFactors[vertex] * layout.panelHeightM,
        solidPoseZ[sample] + normalZ * depthOffset,
      )

      const normalKind = band.normalKinds[vertex]
      if (normalKind === 0) {
        band.normal.setXYZ(vertex, normalX, 0, normalZ)
      } else if (normalKind === 1) {
        band.normal.setXYZ(vertex, -normalX, 0, -normalZ)
      } else if (normalKind === 2) {
        band.normal.setXYZ(vertex, 0, 1, 0)
      } else if (normalKind === 3) {
        band.normal.setXYZ(vertex, 0, -1, 0)
      } else {
        const tangentX = Math.cos(rotY)
        const tangentZ = -Math.sin(rotY)
        const direction = normalKind === 4 ? -1 : 1
        band.normal.setXYZ(vertex, tangentX * direction, 0, tangentZ * direction)
      }

      const heightUvFactor = band.heightUvFactors[vertex]
      if (heightUvFactor >= 0) {
        band.uv.setY(vertex, heightUvFactor)
      }
    }

    band.position.needsUpdate = true
    band.normal.needsUpdate = true
  }

  const updateSolidSides = (state: BendState) => {
    updateSolidBand(
      leftSolidBand,
      leftSolidBandMesh,
      -layout.panelWidthM * 0.5,
      layout.incisedX0,
      state,
    )
    updateSolidBand(
      rightSolidBand,
      rightSolidBandMesh,
      layout.incisedX1,
      layout.panelWidthM * 0.5,
      state,
    )
  }

  const writeWithState = (state: BendState) => {
    const thickness = layout.thicknessM
    const incisedMidY = (layout.incisedY0 + layout.incisedY1) * 0.5
    // Top cutting depth is removed from the finished panel thickness. The
    // separate 3 mm bottom cut belongs to the spoil board and is deliberately
    // absent from this rendered depth calculation.
    const bridgeHeight = Math.max(
      0.00035,
      Math.min(thickness, thickness - topCutDepthM),
    )

    updateSolidSides(state)

    for (let i = 0; i < slats.length; i += 1) {
      curveElement(slats[i].originalX, state, layout.panelWidthM, pose)
      slatPoseX[i] = pose.x
      slatPoseZ[i] = pose.z
      slatPoseRotY[i] = pose.rotY
      place(pose.x, incisedMidY, pose.z, pose.rotY, slats[i].width, layout.incisedHeightM, thickness)
      slatsMesh.setMatrixAt(i, dummy.matrix)
    }
    slatsMesh.count = slats.length
    markActiveInstanceMatrices(slatsMesh, slats.length)

    const writeBridge = (mesh: InstancedMesh, index: number, seg: BridgeSeg) => {
      leftContactPose.x = slatPoseX[seg.column]
      leftContactPose.z = slatPoseZ[seg.column]
      leftContactPose.rotY = slatPoseRotY[seg.column]
      rightContactPose.x = slatPoseX[seg.column + 1]
      rightContactPose.z = slatPoseZ[seg.column + 1]
      rightContactPose.rotY = slatPoseRotY[seg.column + 1]
      const leftTangentX = Math.cos(leftContactPose.rotY)
      const leftTangentZ = -Math.sin(leftContactPose.rotY)
      const rightTangentX = Math.cos(rightContactPose.rotY)
      const rightTangentZ = -Math.sin(rightContactPose.rotY)
      const leftNormalX = Math.sin(leftContactPose.rotY)
      const leftNormalZ = Math.cos(leftContactPose.rotY)
      const rightNormalX = Math.sin(rightContactPose.rotY)
      const rightNormalZ = Math.cos(rightContactPose.rotY)
      const bridgeCenter = -thickness * 0.5 + bridgeHeight * 0.5
      const leftSlatHalfWidth = slats[seg.column].width * 0.5
      const rightSlatHalfWidth = slats[seg.column + 1].width * 0.5
      const leftX =
        leftContactPose.x +
        leftTangentX * leftSlatHalfWidth +
        leftNormalX * bridgeCenter
      const leftZ =
        leftContactPose.z +
        leftTangentZ * leftSlatHalfWidth +
        leftNormalZ * bridgeCenter
      const rightX =
        rightContactPose.x -
        rightTangentX * rightSlatHalfWidth +
        rightNormalX * bridgeCenter
      const rightZ =
        rightContactPose.z -
        rightTangentZ * rightSlatHalfWidth +
        rightNormalZ * bridgeCenter
      const chordX = rightX - leftX
      const chordZ = rightZ - leftZ
      const chordLength = Math.hypot(chordX, chordZ)
      const chordTangent = Math.atan2(chordZ, chordX)

      // Always derive a bridge from its two actual lamella contact points.
      // Using the same placement for C and S states removes the geometry pop
      // that previously occurred as soon as the S progression left zero.
      place(
        (leftX + rightX) * 0.5,
        seg.localY,
        (leftZ + rightZ) * 0.5,
        -chordTangent,
        chordLength + 0.00008,
        seg.height,
        bridgeHeight,
      )
      mesh.setMatrixAt(index, dummy.matrix)
    }

    let b = 0
    for (const seg of fullBridges) {
      if (b >= MAX_BRIDGES) break
      writeBridge(bridgesMesh, b, seg)
      b += 1
    }
    bridgesMesh.count = b
    markActiveInstanceMatrices(bridgesMesh, b)

    for (const batch of partialBridgeBatches) {
      for (let i = 0; i < batch.segments.length; i += 1) {
        writeBridge(batch.mesh, i, batch.segments[i])
      }
      batch.mesh.count = batch.segments.length
      markActiveInstanceMatrices(batch.mesh, batch.segments.length)
    }

    const showBacking = backing !== 'none'
    const backingProfile = backingVisualProfile(backing, fleeceColour)
    backingMesh.visible = showBacking
    // Confirmed opaque felt casts a real shadow behind the apertures. Acoustic
    // fleece remains a non-certified transmission study and is attenuated by
    // the scene's central visual profile instead of casting an opaque shadow.
    backingMesh.castShadow = showBacking && backingProfile.castShadow
    // The shared ribbon is a render-efficient backing mid-surface, not a
    // certified thickness mesh. Half the representative visual thickness puts
    // its nominal front face directly behind the panel rear; the 0.1 mm gap is
    // only enough to avoid z-fighting and does not imply a mounting cavity.
    const backingMidSurfaceOffsetM =
      thickness * 0.5 +
      backingProfile.thicknessMm / 2000 +
      BACKING_RENDER_GAP_M
    const backZ = showBacking
      ? -backingMidSurfaceOffsetM
      : -thickness * 0.5 - BACKLIGHT_RENDER_OFFSET_M
    for (let i = 0; i <= SOLID_BAND_SEGMENTS; i += 1) {
      const originalX =
        -layout.panelWidthM * 0.5 +
        layout.panelWidthM * (i / SOLID_BAND_SEGMENTS)
      curveElement(originalX, state, layout.panelWidthM, pose)
      const nx = Math.sin(pose.rotY)
      const nz = Math.cos(pose.rotY)
      const x = pose.x + nx * backZ
      const z = pose.z + nz * backZ
      const lower = i * 2
      const upper = lower + 1
      backingRibbon.position.setXYZ(lower, x, 0, z)
      backingRibbon.position.setXYZ(upper, x, layout.panelHeightM, z)
      backingRibbon.normal.setXYZ(lower, nx, 0, nz)
      backingRibbon.normal.setXYZ(upper, nx, 0, nz)
    }
    backingRibbon.position.needsUpdate = true
    backingRibbon.normal.needsUpdate = true
  }

  const applyConfig = (config: LinarConfig, tech: LinarTech) => {
    const next = cloneConfig(config)
    layout = slatLayout(next)
    boundingSize.set(layout.panelWidthM, layout.panelHeightM, layout.thicknessM)
    slats = layout.slats
    currentCadGeometry = tech.cadGeometry
    const previousFullBridgeGeometry = fullBridgeGeo
    fullBridgeGeo = createBridgeAssemblyGeometry(currentCadGeometry)
    bridgesMesh.geometry = fullBridgeGeo
    previousFullBridgeGeometry.dispose()
    rebuildBridgeBatches(bridgeSegsFor(next, tech.previewBridgeLengthMm, layout))
    backing = next.backing
    fleeceColour = next.fleeceColour
    topCutDepthM = Math.max(0, tech.topCutDepthMm / 1000)
    materials.applyBacking(next.backing, next.fleeceColour, next.feltColour)
    lastRadius = tech.referenceMinimumRadiusMm
    writeWithState(
      makeBendState(
        lastPercent,
        layout.panelWidthM,
        lastRadius,
        layout.incisedWidthM,
        lastSecondaryCurveAmount,
        maxRenderedNormalOffsetM(layout.thicknessM, backing !== 'none'),
      ),
    )
  }

  applyConfig(initial.config, initial.tech)
  materials.apply(
    initial.config.material,
    initial.config.veneer,
    initial.config.mdfVariant,
    initial.config.mdfColour,
    true,
  )

  return {
    group,
    setBend: (percent, referenceRadiusMm, secondaryCurveAmount = 0) => {
      lastPercent = percent
      lastSecondaryCurveAmount = secondaryCurveAmount
      lastRadius = referenceRadiusMm
      const state = makeBendState(
        percent,
        layout.panelWidthM,
        referenceRadiusMm,
        layout.incisedWidthM,
        secondaryCurveAmount,
        maxRenderedNormalOffsetM(layout.thicknessM, backing !== 'none'),
      )
      writeWithState(state)
      return state
    },
    setConfig: applyConfig,
    setMaterial: (id, veneer, mdfVariant, mdfColour, immediate) =>
      materials.apply(id, veneer, mdfVariant, mdfColour, immediate),
    setBacking: (nextBacking, nextFleeceColour, feltColour) => {
      backing = nextBacking
      fleeceColour = nextFleeceColour
      materials.applyBacking(nextBacking, nextFleeceColour, feltColour)
      writeWithState(
        makeBendState(
          lastPercent,
          layout.panelWidthM,
          lastRadius,
          layout.incisedWidthM,
          lastSecondaryCurveAmount,
          maxRenderedNormalOffsetM(layout.thicknessM, backing !== 'none'),
        ),
      )
    },
    setBacklightStrength: (strength) => {
      const opacity = Math.max(0, Math.min(1, strength))
      // Replicated modules share this material, so both properties update the
      // complete installation without a per-replica visibility sync pass.
      backlightMaterial.opacity = opacity
      backlightMaterial.visible = opacity > BACKLIGHT_VISIBLE_EPSILON
    },
    prewarmMaterial: (id, veneer) => materials.prewarm(id, veneer),
    tickMaterials: (dt) => materials.tick(dt),
    boundingSize,
    dispose: () => {
      slatsMesh.dispose()
      bridgesMesh.dispose()
      clearPartialBridgeBatches()
      backingRibbon.geometry.dispose()
      backlightMaterial.dispose()
      unitBox.dispose()
      fullBridgeGeo.dispose()
      leftSolidBand.geometry.dispose()
      rightSolidBand.geometry.dispose()
      materials.dispose()
    },
  }
}
