import { BoxGeometry, DynamicDrawUsage, InstancedMesh, Object3D, Vector3 } from 'three'
import {
  MAX_BRIDGE_ROWS,
  MAX_SLATS,
  PANEL_HEIGHT_M,
  PANEL_WIDTH_M,
  bendPercentToAngle,
  bridgeRowsFor,
  curveElement,
  slatLayout,
  type BridgeRowSpec,
  type PanelLayout,
  type SlatSpec,
} from './bendMath'
import type { LinarTech } from './linarData'
import { createLinarMaterials, type LinarMaterialSet } from './materials'
import type { LinarConfig, LinarMaterialId } from './types'
import { cloneConfig } from './types'

const MAX_BRIDGES = MAX_BRIDGE_ROWS * (MAX_SLATS - 1)
const MAX_SOLIDS = MAX_SLATS * 2
const pose = { x: 0, z: 0, rotY: 0 }

export type LinarPanelHandle = {
  group: Object3D
  setBend: (percent: number, referenceRadiusMm: number | null) => void
  setConfig: (config: LinarConfig, tech: LinarTech) => void
  setMaterial: (id: LinarMaterialId, immediate?: boolean) => void
  tickMaterials: (dt: number) => boolean
  boundingSize: Vector3
  dispose: () => void
}

export function createLinarPanel(initial: { config: LinarConfig; tech: LinarTech }): LinarPanelHandle {
  const group = new Object3D()
  group.name = 'LinarPanel'

  const materials: LinarMaterialSet = createLinarMaterials()
  const unitGeo = new BoxGeometry(1, 1, 1)

  const slatsMesh = new InstancedMesh(unitGeo, materials.slat, MAX_SLATS)
  slatsMesh.name = 'LinarSlats'
  slatsMesh.castShadow = true
  slatsMesh.receiveShadow = true
  slatsMesh.frustumCulled = false
  slatsMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const bridgesMesh = new InstancedMesh(unitGeo, materials.connector, MAX_BRIDGES)
  bridgesMesh.name = 'LinarBridges'
  bridgesMesh.castShadow = true
  bridgesMesh.receiveShadow = true
  bridgesMesh.frustumCulled = false
  bridgesMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  const solidsMesh = new InstancedMesh(unitGeo, materials.solid, MAX_SOLIDS)
  solidsMesh.name = 'LinarSolids'
  solidsMesh.castShadow = true
  solidsMesh.receiveShadow = true
  solidsMesh.frustumCulled = false
  solidsMesh.instanceMatrix.setUsage(DynamicDrawUsage)

  group.add(slatsMesh)
  group.add(bridgesMesh)
  group.add(solidsMesh)

  const dummy = new Object3D()
  let layout: PanelLayout = slatLayout(initial.config)
  let slats: SlatSpec[] = layout.slats
  let rows: BridgeRowSpec[] = bridgeRowsFor(initial.config, initial.tech.bridgeLengthMm, layout)
  let lastPercent = 0
  let lastRadius: number | null = initial.tech.referenceMinimumRadiusMm

  const writeWithAngle = (angle: number) => {
    const thickness = layout.thicknessM
    const incisedH = Math.max(layout.incisedHeightM, 0.001)
    const incisedMidY = (layout.incisedY0 + layout.incisedY1) * 0.5

    for (let i = 0; i < slats.length; i += 1) {
      curveElement(slats[i].originalX, angle, PANEL_WIDTH_M, pose)
      dummy.position.set(pose.x, incisedMidY, pose.z)
      dummy.rotation.set(0, pose.rotY, 0)
      dummy.scale.set(slats[i].width, incisedH, thickness)
      dummy.updateMatrix()
      slatsMesh.setMatrixAt(i, dummy.matrix)
    }
    slatsMesh.count = slats.length
    slatsMesh.instanceMatrix.needsUpdate = true
    slatsMesh.computeBoundingSphere()

    const bridgeWidth = layout.pitchM * 0.92
    const bridgeDepth = thickness * 0.72
    let b = 0
    for (const row of rows) {
      for (let i = 0; i < slats.length - 1 && b < MAX_BRIDGES; i += 1) {
        const midX = (slats[i].originalX + slats[i + 1].originalX) * 0.5
        curveElement(midX, angle, PANEL_WIDTH_M, pose)
        dummy.position.set(pose.x, row.localY, pose.z)
        dummy.rotation.set(0, pose.rotY, 0)
        dummy.scale.set(bridgeWidth, Math.max(row.height, 0.001), bridgeDepth)
        dummy.updateMatrix()
        bridgesMesh.setMatrixAt(b, dummy.matrix)
        b += 1
      }
    }
    bridgesMesh.count = b
    bridgesMesh.instanceMatrix.needsUpdate = true
    bridgesMesh.computeBoundingSphere()

    let s = 0
    for (const band of layout.solidBands) {
      for (let i = 0; i < slats.length && s < MAX_SOLIDS; i += 1) {
        curveElement(slats[i].originalX, angle, PANEL_WIDTH_M, pose)
        dummy.position.set(pose.x, band.localY, pose.z)
        dummy.rotation.set(0, pose.rotY, 0)
        dummy.scale.set(layout.pitchM * 1.01, band.height, thickness)
        dummy.updateMatrix()
        solidsMesh.setMatrixAt(s, dummy.matrix)
        s += 1
      }
    }
    solidsMesh.count = s
    solidsMesh.instanceMatrix.needsUpdate = true
    solidsMesh.computeBoundingSphere()
  }

  const applyConfig = (config: LinarConfig, tech: LinarTech) => {
    const next = cloneConfig(config)
    layout = slatLayout(next)
    slats = layout.slats
    rows = bridgeRowsFor(next, tech.bridgeLengthMm, layout)
    lastRadius = tech.referenceMinimumRadiusMm
    writeWithAngle(bendPercentToAngle(lastPercent, PANEL_WIDTH_M, lastRadius))
  }

  applyConfig(initial.config, initial.tech)
  materials.apply(initial.config.material, true)

  const boundingSize = new Vector3(PANEL_WIDTH_M, PANEL_HEIGHT_M, layout.thicknessM)

  return {
    group,
    setBend: (percent, referenceRadiusMm) => {
      lastPercent = percent
      lastRadius = referenceRadiusMm
      writeWithAngle(bendPercentToAngle(percent, PANEL_WIDTH_M, referenceRadiusMm))
    },
    setConfig: applyConfig,
    setMaterial: (id, immediate) => materials.apply(id, immediate),
    tickMaterials: (dt) => materials.tick(dt),
    boundingSize,
    dispose: () => {
      slatsMesh.dispose()
      bridgesMesh.dispose()
      solidsMesh.dispose()
      unitGeo.dispose()
      materials.dispose()
    },
  }
}
