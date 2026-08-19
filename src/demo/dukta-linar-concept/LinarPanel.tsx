import {
  BufferGeometry,
  BoxGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
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
import type { LinarBacking, LinarConfig, LinarMaterialId } from './types'
import { cloneConfig, LINAR_REFERENCE_BRIDGE_LENGTH_MM } from './types'

const MAX_BRIDGES = 14000
const MAX_FILLS = MAX_SLATS * 2
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
  setBend: (percent: number, referenceRadiusMm: number | null) => void
  setConfig: (config: LinarConfig, tech: LinarTech) => void
  setMaterial: (id: LinarMaterialId, immediate?: boolean) => void
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

function frontBridgeMaterials(set: LinarMaterialSet): MeshStandardMaterial[] {
  // The official front face is calm and homogeneous. Recessed bridge walls
  // remain wood, but are darker than the exposed slats so they do not turn
  // into a bright horizontal stripe pattern at the front camera.
  return [set.cut, set.cut, set.end, set.end, set.cut, set.reverse]
}

/**
 * Approved local bridge solid from the isolated geometry study. The 60 mm
 * edge-to-edge chord rises 6.859 mm at its centre and tapers to zero depth at
 * both ends. The generated radius is therefore R69.037 mm; R62.5 remains the
 * cutter reference rather than the radius of this complementary wood solid.
 */
function createCurvedBridgeGeometry(profileStart = 0, profileEnd = 1): BufferGeometry {
  const geometry = new BufferGeometry()
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const profileSteps = 48
  const halfChordMm = LINAR_REFERENCE_BRIDGE_LENGTH_MM * 0.5
  const surfaceRadiusMm =
    (halfChordMm ** 2 + APPROVED_BRIDGE_CENTRE_HEIGHT_MM ** 2) /
    (2 * APPROVED_BRIDGE_CENTRE_HEIGHT_MM)

  const addVertex = (x: number, y: number, z: number, u: number, v: number): number => {
    vertices.push(x, y, z)
    uvs.push(u, v)
    return vertices.length / 3 - 1
  }

  const curveLeft: number[] = []
  const curveRight: number[] = []
  const flatLeft: number[] = []
  const flatRight: number[] = []
  const sideCurveLeft: number[] = []
  const sideCurveRight: number[] = []
  const sideFlatLeft: number[] = []
  const sideFlatRight: number[] = []
  const curveZs: number[] = []

  for (let i = 0; i <= profileSteps; i += 1) {
    const t = i / profileSteps
    const sourceT = profileStart + (profileEnd - profileStart) * t
    const y = t - 0.5
    const sourceY = sourceT - 0.5
    const yMm = sourceY * LINAR_REFERENCE_BRIDGE_LENGTH_MM
    const circularDropMm =
      surfaceRadiusMm -
      Math.sqrt(Math.max(0, surfaceRadiusMm ** 2 - yMm ** 2))
    const heightMm = Math.max(0, APPROVED_BRIDGE_CENTRE_HEIGHT_MM - circularDropMm)
    const curveZ = -0.5 + heightMm / APPROVED_BRIDGE_CENTRE_HEIGHT_MM
    curveZs.push(curveZ)
    curveLeft.push(addVertex(-0.5, y, curveZ, 0, sourceT))
    curveRight.push(addVertex(0.5, y, curveZ, 1, sourceT))
    flatLeft.push(addVertex(-0.5, y, -0.5, 0, sourceT))
    flatRight.push(addVertex(0.5, y, -0.5, 1, sourceT))
    // The machined walls need their own vertices. Sharing the curve rails
    // rounded the nominally crisp 90-degree bridge/slat junction normals.
    sideCurveLeft.push(addVertex(-0.5, y, curveZ, 1, sourceT))
    sideCurveRight.push(addVertex(0.5, y, curveZ, 1, sourceT))
    sideFlatLeft.push(addVertex(-0.5, y, -0.5, 0, sourceT))
    sideFlatRight.push(addVertex(0.5, y, -0.5, 0, sourceT))
  }

  const addQuad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d)
  }

  // Curved face points toward the official front side.
  const curveStart = indices.length
  for (let i = 0; i < profileSteps; i += 1) {
    addQuad(curveLeft[i], curveRight[i], curveRight[i + 1], curveLeft[i + 1])
  }
  const curveCount = indices.length - curveStart

  // Flat reverse face. Per-step vertices avoid the fan-shaped side artefacts
  // produced by the previous shared-corner approximation.
  const flatStart = indices.length
  for (let i = 0; i < profileSteps; i += 1) {
    addQuad(flatLeft[i], flatLeft[i + 1], flatRight[i + 1], flatRight[i])
  }
  const flatCount = indices.length - flatStart

  // Long side walls.
  const sidesStart = indices.length
  for (let i = 0; i < profileSteps; i += 1) {
    addQuad(sideFlatLeft[i], sideCurveLeft[i], sideCurveLeft[i + 1], sideFlatLeft[i + 1])
    addQuad(sideFlatRight[i], sideFlatRight[i + 1], sideCurveRight[i + 1], sideCurveRight[i])
  }
  const sidesCount = indices.length - sidesStart

  // End faces converge to the original panel plane at the two arc endpoints.
  const endsStart = indices.length
  const startFlatLeft = addVertex(-0.5, -0.5, -0.5, 0, 0)
  const startFlatRight = addVertex(0.5, -0.5, -0.5, 1, 0)
  const startCurveRight = addVertex(0.5, -0.5, curveZs[0], 1, 1)
  const startCurveLeft = addVertex(-0.5, -0.5, curveZs[0], 0, 1)
  addQuad(startFlatLeft, startFlatRight, startCurveRight, startCurveLeft)
  const endFlatLeft = addVertex(-0.5, 0.5, -0.5, 0, 0)
  const endCurveLeft = addVertex(-0.5, 0.5, curveZs[profileSteps], 0, 1)
  const endCurveRight = addVertex(0.5, 0.5, curveZs[profileSteps], 1, 1)
  const endFlatRight = addVertex(0.5, 0.5, -0.5, 1, 0)
  addQuad(endFlatLeft, endCurveLeft, endCurveRight, endFlatRight)
  const endsCount = indices.length - endsStart

  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  // Use the same material slots as BoxGeometry: side/end grain on the walls,
  // face finish on the exposed curved surface, reverse finish on the rear.
  geometry.addGroup(curveStart, curveCount, 4)
  geometry.addGroup(flatStart, flatCount, 5)
  geometry.addGroup(sidesStart, sidesCount, 0)
  geometry.addGroup(endsStart, endsCount, 2)
  geometry.computeVertexNormals()
  return geometry
}

export function createLinarPanel(initial: { config: LinarConfig; tech: LinarTech }): LinarPanelHandle {
  const group = new Object3D()
  group.name = 'LinarPanel'

  const materials = createLinarMaterials()
  const unitBox = new BoxGeometry(1, 1, 1)
  const fullBridgeGeo = createCurvedBridgeGeometry()

  const slatMats = boxMaterials(materials)
  const frontBridgeMats = frontBridgeMaterials(materials)
  const slatsMesh = new InstancedMesh(unitBox, slatMats, MAX_SLATS)
  slatsMesh.name = 'LinarSlats'
  slatsMesh.castShadow = true
  slatsMesh.receiveShadow = true
  slatsMesh.frustumCulled = false
  slatsMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const bridgesMesh = new InstancedMesh(fullBridgeGeo, frontBridgeMats, MAX_BRIDGES)
  bridgesMesh.name = 'LinarBridges'
  bridgesMesh.castShadow = true
  bridgesMesh.receiveShadow = true
  bridgesMesh.frustumCulled = false
  bridgesMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const fillsMesh = new InstancedMesh(unitBox, slatMats, MAX_FILLS)
  fillsMesh.name = 'LinarSolidFills'
  fillsMesh.castShadow = true
  fillsMesh.receiveShadow = true
  fillsMesh.frustumCulled = false
  fillsMesh.instanceMatrix.setUsage(DynamicDrawUsage)

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
  group.add(fillsMesh)
  group.add(bridgesMesh)
  group.add(partialBridgesGroup)

  const dummy = new Object3D()
  const leftContactPose = { x: 0, z: 0, rotY: 0 }
  const rightContactPose = { x: 0, z: 0, rotY: 0 }
  let layout: PanelLayout = slatLayout(initial.config)
  let slats: SlatSpec[] = layout.slats
  let fullBridges: BridgeSeg[] = []
  let partialBridgeBatches: PartialBridgeBatch[] = []
  let backing: LinarBacking = initial.config.backing
  let lastPercent = 0
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
      const geometry = createCurvedBridgeGeometry(first.profileStart, first.profileEnd)
      const mesh = new InstancedMesh(geometry, frontBridgeMats, segmentsForProfile.length)
      mesh.name = 'LinarClippedBridgeProfile'
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      partialBridgesGroup.add(mesh)
      partialBridgeBatches.push({ geometry, mesh, segments: segmentsForProfile })
    }
  }

  const place = (x: number, y: number, z: number, rotY: number, sx: number, sy: number, sz: number) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, rotY, 0)
    dummy.scale.set(Math.max(sx, 0.0002), Math.max(sy, 0.0002), Math.max(sz, 0.0002))
    dummy.updateMatrix()
  }

  const writeWithState = (state: BendState) => {
    const thickness = layout.thicknessM
    const incisedMidY = (layout.incisedY0 + layout.incisedY1) * 0.5
    const bridgeDepth = Math.max(0.00035, thickness * APPROVED_BRIDGE_DEPTH_RATIO)

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
      const normalX = Math.sin(pose.rotY)
      const normalZ = Math.cos(pose.rotY)
      const halfContactAngle = Math.min(
        0.35,
        Math.abs(rightContactPose.rotY - leftContactPose.rotY) * 0.5,
      )
      // A rigid midpoint bridge otherwise separates from the two rotated
      // slats as the panel bends. This hidden depth-derived pad preserves the
      // contact while staying at a nominal kerf width in the flat view.
      const contactPad = thickness * 0.5 * Math.tan(halfContactAngle) + 0.000015
      // The approved bridge occupies the complementary curved wood volume:
      // it begins at the reverse panel plane and rises toward the front while
      // leaving 31.41% of the thickness open at the lobe centre.
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

    let f = 0
    for (const fill of layout.solidFills) {
      if (f >= MAX_FILLS) break
      curveElement(fill.originalX, state, PANEL_WIDTH_M, pose)
      place(pose.x, fill.localY, pose.z, pose.rotY, fill.width, fill.height, thickness)
      fillsMesh.setMatrixAt(f, dummy.matrix)
      f += 1
    }
    fillsMesh.count = f
    fillsMesh.instanceMatrix.needsUpdate = true
    fillsMesh.computeBoundingSphere()

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
    writeWithState(makeBendState(lastPercent, PANEL_WIDTH_M, lastRadius))
  }

  applyConfig(initial.config, initial.tech)
  materials.apply(initial.config.material, true)

  const boundingSize = new Vector3(PANEL_WIDTH_M, PANEL_HEIGHT_M, layout.thicknessM)

  return {
    group,
    setBend: (percent, referenceRadiusMm) => {
      lastPercent = percent
      lastRadius = referenceRadiusMm
      writeWithState(makeBendState(percent, PANEL_WIDTH_M, referenceRadiusMm))
    },
    setConfig: applyConfig,
    setMaterial: (id, immediate) => materials.apply(id, immediate),
    tickMaterials: (dt) => materials.tick(dt),
    boundingSize,
    dispose: () => {
      slatsMesh.dispose()
      bridgesMesh.dispose()
      clearPartialBridgeBatches()
      fillsMesh.dispose()
      backingMesh.dispose()
      unitBox.dispose()
      fullBridgeGeo.dispose()
      materials.dispose()
    },
  }
}
