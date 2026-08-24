import {
  BufferGeometry,
  BoxGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three'
import {
  MAX_SLATS,
  PANEL_HEIGHT_M,
  PANEL_WIDTH_M,
  bridgeSegsFor,
  curveElement,
  makeBendState,
  slatLayout,
  type BendState,
  type BridgeSeg,
  type PanelLayout,
  type SlatSpec,
} from './bendMath'
import type { LinarTech } from './linarData'
import { createLinarMaterials, type LinarMaterialSet } from './materials'
import type { LinarBacking, LinarConfig, LinarMaterialId, LinarVeneerId } from './types'
import { cloneConfig, LINAR_REFERENCE_BRIDGE_LENGTH_MM } from './types'

const MAX_BRIDGES = 14000
const SOLID_BAND_SEGMENTS = MAX_SLATS
const pose = { x: 0, z: 0, rotY: 0 }
const APPROVED_BRIDGE_PANEL_THICKNESS_MM = 10
const APPROVED_BRIDGE_CENTRE_HEIGHT_MM = 6.859
const APPROVED_BRIDGE_DEPTH_RATIO =
  APPROVED_BRIDGE_CENTRE_HEIGHT_MM / APPROVED_BRIDGE_PANEL_THICKNESS_MM

const BACKING_COLOR: Record<Exclude<LinarBacking, 'none'>, number> = {
  'acoustic-fleece': 0xd8d2c8,
  'acoustic-wool': 0xc4b8a8,
  felt: 0x3a3530,
}

export type LinarPanelHandle = {
  group: Object3D
  setBend: (
    percent: number,
    referenceRadiusMm: number | null,
    secondaryCurveAmount?: number,
  ) => void
  setConfig: (config: LinarConfig, tech: LinarTech) => void
  setMaterial: (id: LinarMaterialId, veneer: LinarVeneerId, immediate?: boolean) => void
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
  // Material 0 is the flat, two-sided rear plate. Material 1 is the approved
  // complementary curved wood face visible between the continuous slats.
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
 * One approved 60 mm bridge assembly. The rear rectangle remains an exact
 * zero-thickness surface, while the complementary wood face rises 6.859 mm
 * on the 10 mm reference profile and returns to the rear plane at both ends.
 *
 * Cut-wood walls close both X sides and any exposed/clipped Y end with a flat,
 * straight plane matching the saw-cut reference. No semicircular shoulder or
 * rounded bridge cap is added. The walls are
 * normally hidden where a bridge meets its neighbouring slats, but become
 * essential as those slats rotate apart: without them the curved bridge reads
 * as a hollow shell instead of a routed piece of solid wood.
 */
function createBridgeAssemblyGeometry(profileStart = 0, profileEnd = 1): BufferGeometry {
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
  const profileSteps = 48
  const halfChordMm = LINAR_REFERENCE_BRIDGE_LENGTH_MM * 0.5
  const surfaceRadiusMm =
    (halfChordMm ** 2 + APPROVED_BRIDGE_CENTRE_HEIGHT_MM ** 2) /
    (2 * APPROVED_BRIDGE_CENTRE_HEIGHT_MM)
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
    const sourceYmm = (sourceT - 0.5) * LINAR_REFERENCE_BRIDGE_LENGTH_MM
    const circularDropMm =
      surfaceRadiusMm -
      Math.sqrt(Math.max(0, surfaceRadiusMm ** 2 - sourceYmm ** 2))
    const heightMm = Math.max(0, APPROVED_BRIDGE_CENTRE_HEIGHT_MM - circularDropMm)
    // Keep the approved local -0.5..+0.5 convention so the plywood layer
    // shader retains the same phase as the isolated bridge study.
    const z = -0.5 + heightMm / APPROVED_BRIDGE_CENTRE_HEIGHT_MM
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
  const fullBridgeGeo = createBridgeAssemblyGeometry()
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

  const backingMesh = new InstancedMesh(unitBox, materials.backing, MAX_SLATS)
  backingMesh.name = 'LinarBacking'
  backingMesh.castShadow = false
  backingMesh.receiveShadow = true
  backingMesh.frustumCulled = false
  backingMesh.visible = false
  backingMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const partialBridgesGroup = new Object3D()
  partialBridgesGroup.name = 'LinarPartialBridges'

  group.add(backingMesh)
  group.add(slatsMesh)
  group.add(leftSolidBandMesh)
  group.add(rightSolidBandMesh)
  group.add(bridgesMesh)
  group.add(partialBridgesGroup)

  const dummy = new Object3D()
  const leftContactPose = { x: 0, z: 0, rotY: 0 }
  const rightContactPose = { x: 0, z: 0, rotY: 0 }
  const solidPoseX = new Float32Array(SOLID_BAND_SEGMENTS + 1)
  const solidPoseZ = new Float32Array(SOLID_BAND_SEGMENTS + 1)
  const solidPoseRotY = new Float32Array(SOLID_BAND_SEGMENTS + 1)
  let layout: PanelLayout = slatLayout(initial.config)
  let slats: SlatSpec[] = layout.slats
  let fullBridges: BridgeSeg[] = []
  let partialBridgeBatches: PartialBridgeBatch[] = []
  let backing: LinarBacking = initial.config.backing
  let lastPercent = 0
  let lastSecondaryCurveAmount = 0
  let lastRadius: number | null = initial.tech.referenceMinimumRadiusMm

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
      const geometry = createBridgeAssemblyGeometry(first.profileStart, first.profileEnd)
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
      curveElement(originalX, state, PANEL_WIDTH_M, pose)
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
        band.yFactors[vertex] * PANEL_HEIGHT_M,
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
    band.uv.needsUpdate = true
  }

  const updateSolidSides = (state: BendState) => {
    updateSolidBand(
      leftSolidBand,
      leftSolidBandMesh,
      -PANEL_WIDTH_M * 0.5,
      layout.incisedX0,
      state,
    )
    updateSolidBand(
      rightSolidBand,
      rightSolidBandMesh,
      layout.incisedX1,
      PANEL_WIDTH_M * 0.5,
      state,
    )
  }

  const writeWithState = (state: BendState) => {
    const thickness = layout.thicknessM
    const incisedMidY = (layout.incisedY0 + layout.incisedY1) * 0.5
    const bridgeDepth = Math.max(0.00035, thickness * APPROVED_BRIDGE_DEPTH_RATIO)

    updateSolidSides(state)

    for (let i = 0; i < slats.length; i += 1) {
      curveElement(slats[i].originalX, state, PANEL_WIDTH_M, pose)
      place(pose.x, incisedMidY, pose.z, pose.rotY, slats[i].width, layout.incisedHeightM, thickness)
      slatsMesh.setMatrixAt(i, dummy.matrix)
    }
    slatsMesh.count = slats.length
    slatsMesh.instanceMatrix.needsUpdate = true
    slatsMesh.computeBoundingSphere()

    const writeBridge = (mesh: InstancedMesh, index: number, seg: BridgeSeg) => {
      curveElement(seg.originalX, state, PANEL_WIDTH_M, pose)
      curveElement(layout.slats[seg.column].originalX, state, PANEL_WIDTH_M, leftContactPose)
      curveElement(layout.slats[seg.column + 1].originalX, state, PANEL_WIDTH_M, rightContactPose)

      if (state.compoundCurve) {
        const leftTangentX = Math.cos(leftContactPose.rotY)
        const leftTangentZ = -Math.sin(leftContactPose.rotY)
        const rightTangentX = Math.cos(rightContactPose.rotY)
        const rightTangentZ = -Math.sin(rightContactPose.rotY)
        const leftNormalX = Math.sin(leftContactPose.rotY)
        const leftNormalZ = Math.cos(leftContactPose.rotY)
        const rightNormalX = Math.sin(rightContactPose.rotY)
        const rightNormalZ = Math.cos(rightContactPose.rotY)
        const bridgeCenter = -thickness * 0.5 + bridgeDepth * 0.5
        const slatHalfWidth = layout.slatWidthM * 0.5
        const leftX =
          leftContactPose.x +
          leftTangentX * slatHalfWidth +
          leftNormalX * bridgeCenter
        const leftZ =
          leftContactPose.z +
          leftTangentZ * slatHalfWidth +
          leftNormalZ * bridgeCenter
        const rightX =
          rightContactPose.x -
          rightTangentX * slatHalfWidth +
          rightNormalX * bridgeCenter
        const rightZ =
          rightContactPose.z -
          rightTangentZ * slatHalfWidth +
          rightNormalZ * bridgeCenter
        const chordX = rightX - leftX
        const chordZ = rightZ - leftZ
        const chordLength = Math.hypot(chordX, chordZ)
        const chordTangent = Math.atan2(chordZ, chordX)

        // The variable-curvature pose can reverse sign inside one panel. A
        // bridge therefore follows the chord between its two actual lamella
        // contact points instead of stretching a midpoint patch by |angle|.
        place(
          (leftX + rightX) * 0.5,
          seg.localY,
          (leftZ + rightZ) * 0.5,
          -chordTangent,
          chordLength + 0.00008,
          seg.height,
          bridgeDepth,
        )
        mesh.setMatrixAt(index, dummy.matrix)
        return
      }

      const normalX = Math.sin(pose.rotY)
      const normalZ = Math.cos(pose.rotY)
      const halfContactAngle = Math.min(
        0.35,
        Math.abs(rightContactPose.rotY - leftContactPose.rotY) * 0.5,
      )
      // A midpoint rear patch otherwise separates from the two independently
      // rotated slats as the panel bends. This width compensation preserves
      // edge contact while remaining exactly at the nominal kerf when flat.
      const contactPad = thickness * 0.5 * Math.tan(halfContactAngle)
      const bridgeCenter = -thickness * 0.5 + bridgeDepth * 0.5
      place(
        pose.x + normalX * bridgeCenter,
        seg.localY,
        pose.z + normalZ * bridgeCenter,
        pose.rotY,
        layout.cutWidthM + contactPad * 2,
        seg.height,
        bridgeDepth,
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
    bridgesMesh.instanceMatrix.needsUpdate = true
    bridgesMesh.computeBoundingSphere()

    for (const batch of partialBridgeBatches) {
      for (let i = 0; i < batch.segments.length; i += 1) {
        writeBridge(batch.mesh, i, batch.segments[i])
      }
      batch.mesh.count = batch.segments.length
      batch.mesh.instanceMatrix.needsUpdate = true
      batch.mesh.computeBoundingSphere()
    }

    const showBacking = backing !== 'none'
    backingMesh.visible = showBacking
    if (showBacking && backing !== 'none') {
      const backZ = -(thickness * 0.5 + 0.0012)
      for (let i = 0; i < slats.length; i += 1) {
        curveElement(slats[i].originalX, state, PANEL_WIDTH_M, pose)
        const nx = Math.sin(pose.rotY)
        const nz = Math.cos(pose.rotY)
        place(
          pose.x + nx * backZ,
          incisedMidY,
          pose.z + nz * backZ,
          pose.rotY,
          layout.pitchM * 1.02,
          layout.incisedHeightM,
          0.0016,
        )
        backingMesh.setMatrixAt(i, dummy.matrix)
      }
      backingMesh.count = slats.length
      backingMesh.instanceMatrix.needsUpdate = true
      backingMesh.computeBoundingSphere()
      materials.backing.color.setHex(BACKING_COLOR[backing])
    } else {
      backingMesh.count = 0
    }
  }

  const applyConfig = (config: LinarConfig, tech: LinarTech) => {
    const next = cloneConfig(config)
    layout = slatLayout(next)
    slats = layout.slats
    rebuildBridgeBatches(bridgeSegsFor(next, tech.previewBridgeLengthMm, layout))
    backing = next.backing
    lastRadius = tech.referenceMinimumRadiusMm
    writeWithState(
      makeBendState(
        lastPercent,
        PANEL_WIDTH_M,
        lastRadius,
        layout.incisedWidthM,
        lastSecondaryCurveAmount,
      ),
    )
  }

  applyConfig(initial.config, initial.tech)
  materials.apply(initial.config.material, initial.config.veneer, true)

  const boundingSize = new Vector3(PANEL_WIDTH_M, PANEL_HEIGHT_M, layout.thicknessM)

  return {
    group,
    setBend: (percent, referenceRadiusMm, secondaryCurveAmount = 0) => {
      lastPercent = percent
      lastSecondaryCurveAmount = secondaryCurveAmount
      lastRadius = referenceRadiusMm
      writeWithState(
        makeBendState(
          percent,
          PANEL_WIDTH_M,
          referenceRadiusMm,
          layout.incisedWidthM,
          secondaryCurveAmount,
        ),
      )
    },
    setConfig: applyConfig,
    setMaterial: (id, veneer, immediate) => materials.apply(id, veneer, immediate),
    tickMaterials: (dt) => materials.tick(dt),
    boundingSize,
    dispose: () => {
      slatsMesh.dispose()
      bridgesMesh.dispose()
      clearPartialBridgeBatches()
      backingMesh.dispose()
      unitBox.dispose()
      fullBridgeGeo.dispose()
      leftSolidBand.geometry.dispose()
      rightSolidBand.geometry.dispose()
      materials.dispose()
    },
  }
}
