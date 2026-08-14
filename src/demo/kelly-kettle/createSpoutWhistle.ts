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

function lathe(name: string, pts: Vector2[], segs: number, material: Mesh['material']) {
  const geometry = new LatheGeometry(pts, segs)
  geometry.computeVertexNormals()
  return mesh(name, geometry, material)
}

function greenLugGeo() {
  const shape = new Shape()
  shape.absellipse(0, 0, 0.00315, 0.00235, 0, Math.PI * 2, false, 0)
  const hole = new Path()
  hole.absarc(0, 0, 0.00112, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.0019,
    bevelEnabled: true,
    bevelThickness: 0.00018,
    bevelSize: 0.00015,
    bevelSegments: 3,
    curveSegments: 24,
  })
  geometry.translate(0, 0, -0.00095)
  geometry.computeVertexNormals()
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

  const D = SPOUT_R * 2
  const capR = SPOUT_R * 1.09
  const housingH = D * 0.205
  const overlap = 0.00185
  const lidR = D * 0.365
  const lidH = D * 0.11
  const innerR = SPOUT_R + 0.00048
  const segs = 64

  const whistle = new Group()
  whistle.name = 'whistle_root'
  const seated = mouth.clone()
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

  const housing = lathe(
    'whistle_green_housing',
    [
      new Vector2(innerR, -overlap),
      new Vector2(innerR, housingH - 0.00185),
      new Vector2(lidR * 0.22, housingH - 0.00115),
      new Vector2(0.0005, housingH - 0.0011),
      new Vector2(0.0005, housingH - 0.00018),
      new Vector2(lidR + 0.00045, housingH - 0.00018),
      new Vector2(lidR + 0.00135, housingH - 0.00055),
      new Vector2(capR - 0.00115, housingH),
      new Vector2(capR - 0.00012, housingH - 0.00062),
      new Vector2(capR + 0.00008, housingH * 0.38),
      new Vector2(capR + 0.00018, -overlap + 0.00028),
      new Vector2(innerR + 0.00025, -overlap),
      new Vector2(innerR, -overlap),
    ],
    segs,
    mats.whistle,
  )

  const lidPivot = new Group()
  lidPivot.name = 'whistle_green_lid_pivot'
  lidPivot.position.set(0, housingH, -lidR)

  const lid = new Group()
  lid.name = 'whistle_green_lid'
  lid.position.set(0, 0, lidR)

  const topDisc = lathe(
    'whistle_green_lid_disc',
    [
      new Vector2(0, lidH),
      new Vector2(lidR * 0.42, lidH - 0.00008),
      new Vector2(lidR * 0.82, lidH * 0.72),
      new Vector2(lidR * 0.97, lidH * 0.32),
      new Vector2(lidR, lidH * 0.18),
      new Vector2(lidR, 0.00028),
      new Vector2(lidR * 0.93, 0),
      new Vector2(0, 0),
    ],
    segs,
    mats.whistle,
  )

  const tab = mesh('whistle_green_thumb_tab', new SphereGeometry(0.0017, 16, 12), mats.whistle)
  tab.scale.set(1.55, 0.4, 0.82)
  tab.position.set(0, lidH * 0.28, lidR * 0.9)
  lid.add(topDisc, tab)
  lidPivot.add(lid)

  const lugAng = 1.12
  const lugR = capR + 0.00055
  const lugY = housingH * 0.28
  const lugX = Math.sin(lugAng) * lugR
  const lugZ = Math.cos(lugAng) * lugR
  const eye = mesh('whistle_green_attachment_tab', greenLugGeo(), mats.whistle)
  eye.rotation.set(Math.PI / 2, lugAng, 0)
  eye.position.set(lugX, lugY, lugZ)

  const ringR = 0.00215
  const splitRing = mesh(
    'whistle_split_ring',
    new TorusGeometry(ringR, 0.00028, 12, 28),
    mats.steelSmooth,
    false,
  )
  splitRing.position.set(lugX + ringR * 0.92, lugY, lugZ)
  splitRing.rotation.set(0.18, 0, 0.12)

  const steam = mesh(
    'whistle_steam_puff',
    new SphereGeometry(0.0016, 8, 6),
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
  steam.position.set(lidR + 0.0006, housingH + 0.0004, 0)

  whistle.add(housing, lidPivot, eye, splitRing, steam)
  spout.add(whistle)

  const setInserted = (inserted: boolean) => {
    lidPivot.rotation.x = inserted ? 0 : -1.15
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
    steam.position.y = housingH + 0.0004 + pulse * 0.0024
  }

  const whistleWorld = (target: Vector3) => {
    splitRing.getWorldPosition(target)
    return target
  }

  return { spout, whistle, splitRing, seated, axis, setInserted, steamPulse, whistleWorld }
}
