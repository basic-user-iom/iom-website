import {
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { SPOUT_ANGLE, SPOUT_LEN, SPOUT_R, SPOUT_Y } from './constants'
import type { KettleMaterials } from './materials'
import { sampleRadius } from './profiles'

type Profile = Vector2[]

function mesh(name: string, geometry: Mesh['geometry'], material: Mesh['material'], shadows = true) {
  const m = new Mesh(geometry, material)
  m.name = name
  m.castShadow = shadows
  m.receiveShadow = shadows
  return m
}

function greenEyeGeo() {
  const shape = new Shape()
  shape.absellipse(0, 0, 0.004, 0.0031, 0, Math.PI * 2, false, 0)
  const hole = new Path()
  hole.absarc(0, 0, 0.00145, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.0024,
    bevelEnabled: true,
    bevelThickness: 0.00012,
    bevelSize: 0.0001,
    bevelSegments: 2,
    curveSegments: 32,
  })
  geometry.translate(0, 0, -0.0012)
  return geometry
}

export type SpoutWhistleAssembly = {
  spout: Group
  whistle: Group
  splitRing: Mesh
  seated: Vector3
  axis: Vector3
  setInserted: (inserted: boolean) => void
  steamPulse: (amount: number, reducedMotion: boolean) => void
  whistleWorld: (target: Vector3) => Vector3
}

export function createSpoutWhistle(mats: KettleMaterials, outerPts: Profile): SpoutWhistleAssembly {
  const attachR = sampleRadius(outerPts, SPOUT_Y)
  const axis = new Vector3(Math.cos(SPOUT_ANGLE), Math.sin(SPOUT_ANGLE), 0)
  const start = new Vector3(attachR - 0.0035, 0, 0)
  const mouth = start.clone().addScaledVector(axis, SPOUT_LEN)
  const insert = 0.011

  const spout = new Group()
  spout.name = 'water_spout'
  spout.position.set(0, SPOUT_Y, 0)

  const neck = mesh(
    'spout_neck',
    new CylinderGeometry(SPOUT_R - 0.00035, SPOUT_R, SPOUT_LEN, 48, 1, true),
    mats.steel,
  )
  neck.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis)
  neck.position.copy(start.clone().addScaledVector(axis, SPOUT_LEN * 0.5))

  const rim = mesh('spout_rim', new TorusGeometry(SPOUT_R - 0.0002, 0.00055, 12, 48), mats.steelSmooth)
  rim.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), axis)
  rim.position.copy(mouth)
  spout.add(neck, rim)

  const whistle = new Group()
  whistle.name = 'whistle_root'
  const seated = mouth.clone().addScaledVector(axis, -insert)
  whistle.position.copy(seated)
  whistle.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis)

  const down = new Vector3(0, -1, 0)
  const onDisc = down.clone().addScaledVector(axis, -down.dot(axis))
  if (onDisc.lengthSq() > 1e-8) {
    onDisc.normalize()
    const localX = new Vector3(1, 0, 0).applyQuaternion(whistle.quaternion)
    const localZ = new Vector3(0, 0, 1).applyQuaternion(whistle.quaternion)
    whistle.rotateY(-Math.atan2(onDisc.dot(localZ), onDisc.dot(localX)))
  }

  const segs = 96
  const lowerPts = [
    new Vector2(SPOUT_R + 0.0004, -0.0082),
    new Vector2(0.0142, -0.004),
    new Vector2(0.0148, 0.001),
    new Vector2(0.015, 0.0072),
    new Vector2(0.0134, 0.0088),
  ]
  const lower = mesh('whistle_green_lower_body', new LatheGeometry(lowerPts, segs), mats.whistle)
  lower.geometry.computeVertexNormals()

  const topPts = [
    new Vector2(0.0134, 0.0088),
    new Vector2(0.0122, 0.0098),
    new Vector2(0.0114, 0.0136),
    new Vector2(0.0098, 0.0149),
    new Vector2(0.0088, 0.01555),
    new Vector2(0.0038, 0.01568),
    new Vector2(0.0, 0.0157),
  ]
  const topDisc = mesh('whistle_green_top_disc', new LatheGeometry(topPts, segs), mats.whistle)
  topDisc.geometry.computeVertexNormals()

  const eye = mesh('whistle_green_attachment_tab', greenEyeGeo(), mats.whistle)
  eye.rotation.y = Math.PI / 2
  eye.position.set(0, 0.0016, 0.0163)

  const splitRing = mesh(
    'whistle_split_ring',
    new TorusGeometry(0.00265, 0.00034, 12, 32),
    mats.steelSmooth,
    false,
  )
  splitRing.position.set(0, 0.0016, 0.019)
  splitRing.rotation.x = Math.PI / 2

  const steam = mesh(
    'whistle_steam_puff',
    new SphereGeometry(0.0024, 8, 6),
    new MeshStandardMaterial({
      color: 0xdfe8ee,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      metalness: 0,
      roughness: 1,
    }),
    false,
  )
  steam.position.set(0.012, 0.006, 0)

  whistle.add(lower, topDisc, eye, splitRing, steam)
  spout.add(whistle)

  const lift = axis.clone().multiplyScalar(0.036)
  const setInserted = (inserted: boolean) => {
    if (inserted) whistle.position.copy(seated)
    else whistle.position.copy(seated).add(lift)
  }

  const steamPulse = (amount: number, reducedMotion: boolean) => {
    const mat = steam.material as MeshStandardMaterial
    if (amount < 0.04 || reducedMotion) {
      mat.opacity = 0
      steam.scale.setScalar(0.2)
      return
    }
    const t = performance.now() * 0.001
    const pulse = 0.5 + 0.5 * Math.sin(t * 9)
    mat.opacity = amount * 0.28 * pulse
    steam.scale.setScalar(0.6 + pulse * 0.8)
    steam.position.y = 0.006 + pulse * 0.004
  }

  const whistleWorld = (target: Vector3) => {
    splitRing.getWorldPosition(target)
    return target
  }

  return { spout, whistle, splitRing, seated, axis, setInserted, steamPulse, whistleWorld }
}
