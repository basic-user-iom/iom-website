import { BoxGeometry, DynamicDrawUsage, InstancedMesh, Object3D, Vector3 } from 'three'
import {
  PANEL_HEIGHT,
  PANEL_THICKNESS,
  PANEL_WIDTH,
  SLAT_COUNT,
  SLAT_PITCH,
  SLAT_WIDTH,
  bendToAngle,
  curveElement,
  slatOriginalX,
} from './bendMath'
import { createLinarMaterials, type LinarMaterialSet } from './materials'
import type { LinarMaterialId } from './types'

const CONNECTOR_ROWS = [0.07, PANEL_HEIGHT * 0.5, PANEL_HEIGHT - 0.07]
const CONNECTOR_HEIGHT = 0.048
const CONNECTOR_WIDTH = SLAT_PITCH * 0.9
const CONNECTOR_DEPTH = PANEL_THICKNESS * 0.72

export type LinarPanelHandle = {
  group: Object3D
  setBend: (percent: number) => void
  setMaterial: (id: LinarMaterialId, immediate?: boolean) => void
  tickMaterials: (dt: number) => boolean
  boundingSize: Vector3
  dispose: () => void
}

export function createLinarPanel(): LinarPanelHandle {
  const group = new Object3D()
  group.name = 'LinarPanel'

  const materials: LinarMaterialSet = createLinarMaterials()
  const slatGeo = new BoxGeometry(SLAT_WIDTH, PANEL_HEIGHT, PANEL_THICKNESS)
  const slats = new InstancedMesh(slatGeo, materials.slat, SLAT_COUNT)
  slats.name = 'LinarSlats'
  slats.castShadow = true
  slats.receiveShadow = true
  slats.frustumCulled = false
  slats.instanceMatrix.setUsage(DynamicDrawUsage)

  const connectorCount = (SLAT_COUNT - 1) * CONNECTOR_ROWS.length
  const connectorGeo = new BoxGeometry(CONNECTOR_WIDTH, CONNECTOR_HEIGHT, CONNECTOR_DEPTH)
  const connectors = new InstancedMesh(connectorGeo, materials.connector, connectorCount)
  connectors.name = 'LinarConnectors'
  connectors.castShadow = true
  connectors.receiveShadow = true
  connectors.frustumCulled = false
  connectors.instanceMatrix.setUsage(DynamicDrawUsage)

  group.add(slats)
  group.add(connectors)

  const dummy = new Object3D()
  const originals = new Float32Array(SLAT_COUNT)
  for (let i = 0; i < SLAT_COUNT; i++) originals[i] = slatOriginalX(i)

  const writeInstances = (percent: number) => {
    const angle = bendToAngle(percent)

    for (let i = 0; i < SLAT_COUNT; i++) {
      const pose = curveElement(originals[i], PANEL_WIDTH, angle)
      dummy.position.set(pose.x, PANEL_HEIGHT * 0.5, pose.z)
      dummy.rotation.set(0, pose.theta, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      slats.setMatrixAt(i, dummy.matrix)
    }
    slats.instanceMatrix.needsUpdate = true
    slats.computeBoundingSphere()

    let c = 0
    for (let row = 0; row < CONNECTOR_ROWS.length; row++) {
      const y = CONNECTOR_ROWS[row]
      for (let i = 0; i < SLAT_COUNT - 1; i++) {
        const midX = (originals[i] + originals[i + 1]) * 0.5
        const pose = curveElement(midX, PANEL_WIDTH, angle)
        dummy.position.set(pose.x, y, pose.z)
        dummy.rotation.set(0, pose.theta, 0)
        dummy.updateMatrix()
        connectors.setMatrixAt(c, dummy.matrix)
        c += 1
      }
    }
    connectors.instanceMatrix.needsUpdate = true
    connectors.computeBoundingSphere()
  }

  writeInstances(0)

  const boundingSize = new Vector3(PANEL_WIDTH, PANEL_HEIGHT, PANEL_THICKNESS)

  return {
    group,
    setBend: writeInstances,
    setMaterial: (id, immediate) => materials.apply(id, immediate),
    tickMaterials: (dt) => materials.tick(dt),
    boundingSize,
    dispose: () => {
      slats.dispose()
      connectors.dispose()
      slatGeo.dispose()
      connectorGeo.dispose()
      materials.dispose()
    },
  }
}
