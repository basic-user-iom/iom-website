import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Path,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { HANDLE_GRIP_LEN, HANDLE_GRIP_R, HANDLE_WIRE_R, HANDLE_Y } from './constants'
import type { KettleMaterials } from './materials'
import { sampleRadius } from './profiles'

type Profile = Vector2[]

const HOOK_R = 0.0034
const EYELET_R = 0.0027
const LUG_THICK = 0.00085
const FLARE = 0.18

function mesh(name: string, geometry: Mesh['geometry'], material: Mesh['material'], shadows = true) {
  const m = new Mesh(geometry, material)
  m.name = name
  m.castShadow = shadows
  m.receiveShadow = shadows
  return m
}

function v3(x: number, y: number, z: number) {
  return new Vector3(x, y, z)
}

/** Vertically elongated stamped teardrop tab with a circular hole near the top. */
function stampedLugGeo() {
  const shape = new Shape()
  const topY = 0.0046
  const botY = -0.0124
  const topW = 0.0041
  const midW = 0.0054
  const botW = 0.0063
  shape.moveTo(0, topY)
  shape.quadraticCurveTo(topW, topY, topW, topY - 0.0034)
  shape.lineTo(midW, -0.003)
  shape.lineTo(botW, botY + 0.0036)
  shape.quadraticCurveTo(botW, botY, 0, botY)
  shape.quadraticCurveTo(-botW, botY, -botW, botY + 0.0036)
  shape.lineTo(-midW, -0.003)
  shape.lineTo(-topW, topY - 0.0034)
  shape.quadraticCurveTo(-topW, topY, 0, topY)
  const hole = new Path()
  hole.absarc(0, 0, EYELET_R, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geo = new ExtrudeGeometry(shape, {
    depth: LUG_THICK,
    bevelEnabled: true,
    bevelThickness: 0.00012,
    bevelSize: 0.00012,
    bevelSegments: 2,
    curveSegments: 24,
  })
  geo.translate(0, 0, -LUG_THICK * 0.5)
  geo.computeVertexNormals()
  return geo
}

function gripLathe() {
  const half = HANDLE_GRIP_LEN * 0.5
  const hole = HANDLE_WIRE_R + 0.00018
  const r = HANDLE_GRIP_R
  return new LatheGeometry(
    [
      new Vector2(hole, -half),
      new Vector2(r * 0.86, -half),
      new Vector2(r * 0.97, -half + 0.0015),
      new Vector2(r, -half + 0.0032),
      new Vector2(r * 1.008, -0.018),
      new Vector2(r * 0.995, 0),
      new Vector2(r * 1.006, 0.02),
      new Vector2(r, half - 0.0032),
      new Vector2(r * 0.97, half - 0.0015),
      new Vector2(r * 0.86, half),
      new Vector2(hole, half),
    ],
    48,
  )
}

/** Compact J-hook after the wire has passed through the lug hole. */
function hookAndThrough(z: number, fromCurl: boolean) {
  const curl: Vector3[] = []
  const n = 10
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 0.88
    curl.push(v3(HOOK_R * Math.sin(a), -HOOK_R * (1 - Math.cos(a)), z))
  }
  const holePos = v3(0, 0, z)
  const outPos = v3(0.00105, 0, z)
  const inPos = v3(-0.00115, 0.00012, z)
  const woodPos = v3(-0.0048, 0.00055, z)
  if (fromCurl) {
    return [...curl.slice().reverse(), holePos, inPos, woodPos]
  }
  return [woodPos, inPos, holePos, outPos, ...curl.slice(1)]
}

function sideArm(z: number, woodX: number, woodY: number, barHalf: number, towardWood: boolean) {
  const endZ = Math.sign(z) * barHalf
  const arm = [
    v3(-0.01, 0.0012, z),
    v3(woodX * 0.28, woodY * 0.12, z * 0.97),
    v3(woodX * 0.58, woodY * 0.42, z * 0.42 + endZ * 0.38),
    v3(woodX * 0.9, woodY * 0.86, endZ + Math.sign(z) * 0.007),
    v3(woodX, woodY, endZ),
  ]
  return towardWood ? arm : arm.slice().reverse()
}

function makeHandlePath(eyeZ: number, woodX: number, woodY: number, barHalf: number) {
  const pts: Vector3[] = [
    ...hookAndThrough(eyeZ, true),
    ...sideArm(eyeZ, woodX, woodY, barHalf, true),
    v3(woodX, woodY, barHalf * 0.45),
    v3(woodX, woodY, 0),
    v3(woodX, woodY, -barHalf * 0.45),
    ...sideArm(-eyeZ, woodX, woodY, barHalf, false),
    ...hookAndThrough(-eyeZ, false),
  ]
  return new CatmullRomCurve3(pts, false, 'catmullrom', 0.04)
}

export type HandleAssembly = {
  root: Group
  pivot: Group
  wire: Mesh
  wireA: Mesh
  wireB: Mesh
  grip: Mesh
  debug: LineSegments
  setAngle: (t: number) => void
  updateCollision: (profile: Profile, showDebug: boolean) => void
}

export function createHandle(mats: KettleMaterials, outerPts: Profile): HandleAssembly {
  const root = new Group()
  root.name = 'handle_assembly'
  const y = HANDLE_Y
  const bodyR = sampleRadius(outerPts, y)
  const rUp = sampleRadius(outerPts, y + 0.008)
  const wallTilt = Math.atan2(bodyR - rUp, 0.008)
  const lugGeo = stampedLugGeo()
  const stand = 0.00055
  const eyeZ = bodyR + stand + LUG_THICK * 0.5
  const eyeY = y + 0.001

  const makeLug = (name: string, sign: number) => {
    const group = new Group()
    group.name = name
    const plate = mesh(`${name}_plate`, lugGeo, mats.steelSmooth)
    plate.rotation.order = 'YXZ'
    plate.rotation.y = Math.PI / 2
    plate.rotation.x = sign * (FLARE + wallTilt)
    plate.position.set(0, eyeY, sign * eyeZ)
    group.add(plate)
    return group
  }

  root.add(makeLug('handle_bracket_a', 1), makeLug('handle_bracket_b', -1))

  const woodX = -(bodyR + 0.038)
  const woodY = -0.07
  const barHalf = HANDLE_GRIP_LEN * 0.5 + 0.002

  const pivot = new Group()
  pivot.name = 'handle_pivot_group'
  pivot.position.set(0, eyeY, 0)

  const path = makeHandlePath(eyeZ, woodX, woodY, barHalf)
  const tube = new TubeGeometry(path, 320, HANDLE_WIRE_R, 12, false)
  const wire = mesh('handle_wire', tube, mats.steelSmooth)

  const capA = mesh('handle_wire_cap_a', new SphereGeometry(HANDLE_WIRE_R * 0.98, 12, 10), mats.steelSmooth)
  const capB = mesh('handle_wire_cap_b', new SphereGeometry(HANDLE_WIRE_R * 0.98, 12, 10), mats.steelSmooth)
  capA.position.copy(path.getPoint(0))
  capB.position.copy(path.getPoint(1))

  const grip = mesh('handle_wood_grip', gripLathe(), mats.wood)
  grip.position.set(woodX, woodY, 0)
  grip.rotation.x = Math.PI / 2

  pivot.add(wire, capA, capB, grip)

  const sampleCount = 28
  const debugPos = new Float32Array(sampleCount * 6)
  const debugCol = new Float32Array(sampleCount * 6)
  const debugGeo = new BufferGeometry()
  debugGeo.setAttribute('position', new BufferAttribute(debugPos, 3))
  debugGeo.setAttribute('color', new BufferAttribute(debugCol, 3))
  const debug = new LineSegments(
    debugGeo,
    new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9 }),
  )
  debug.name = 'handle_collision_debug'
  debug.visible = false
  debug.renderOrder = 8
  pivot.add(debug)

  const local = new Vector3()
  const setAngle = (t: number) => {
    const u = Math.max(0, Math.min(1, t))
    pivot.rotation.z = -u * 2.05
  }

  const updateCollision = (profile: Profile, showDebug: boolean) => {
    debug.visible = showDebug
    if (!showDebug) {
      wire.material = mats.steelSmooth
      return
    }
    let hit = false
    const cz = Math.cos(pivot.rotation.z)
    const sz = Math.sin(pivot.rotation.z)
    for (let i = 0; i < sampleCount; i++) {
      const u = 0.18 + (i / (sampleCount - 1)) * 0.64
      path.getPoint(u, local)
      const x = local.x * cz - local.y * sz
      const yy = local.x * sz + local.y * cz
      const dist = Math.hypot(x, local.z)
      const body = sampleRadius(profile, pivot.position.y + yy)
      const ok = dist > body + HANDLE_WIRE_R + 0.0025
      if (!ok) hit = true
      const o = i * 6
      debugPos[o] = local.x
      debugPos[o + 1] = local.y
      debugPos[o + 2] = local.z
      debugPos[o + 3] = local.x
      debugPos[o + 4] = local.y + 0.004
      debugPos[o + 5] = local.z
      const r = ok ? 0.15 : 1
      const g = ok ? 0.85 : 0.12
      for (let k = 0; k < 2; k++) {
        debugCol[o + k * 3] = r
        debugCol[o + k * 3 + 1] = g
        debugCol[o + k * 3 + 2] = 0.12
      }
    }
    debugGeo.attributes.position.needsUpdate = true
    debugGeo.attributes.color.needsUpdate = true
    wire.material = hit ? mats.whistleDark : mats.steelSmooth
  }

  root.add(pivot)
  setAngle(0)
  return { root, pivot, wire, wireA: wire, wireB: wire, grip, debug, setAngle, updateCollision }
}
