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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { HANDLE_GRIP_DROP, HANDLE_GRIP_LEN, HANDLE_GRIP_R, HANDLE_WIRE_R, HANDLE_Y } from './constants'
import type { KettleMaterials } from './materials'
import { sampleRadius } from './profiles'

type Profile = Vector2[]

const EYELET_R = 0.0027
const LUG_THICK = 0.00085
const LUG_STANDOFF = 0.00025
const LUG_FLARE = 0.0036

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

function smoothstep01(value: number) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

/**
 * Thin stamped tab. Its lower section follows the shoulder radius while the
 * upper section bends radially outward. The undeformed hole axis is local Z,
 * which is also the complete handle assembly's shared pivot axis.
 */
function stampedLugGeo(profile: Profile, eyeY: number, radialSign: number) {
  const shape = new Shape()
  const topY = 0.0046
  const botY = -0.0124
  const topW = 0.0041
  const midW = 0.0054
  const botW = 0.0063
  shape.moveTo(0, topY)
  shape.quadraticCurveTo(topW, topY, topW, topY - 0.0034)
  shape.lineTo(midW, -0.003)
  shape.lineTo(botW, botY + 0.0028)
  shape.quadraticCurveTo(botW, botY, botW - 0.0022, botY)
  shape.lineTo(-botW + 0.0022, botY)
  shape.quadraticCurveTo(-botW, botY, -botW, botY + 0.0028)
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
  const position = geo.getAttribute('position') as BufferAttribute
  const eyeWallR = sampleRadius(profile, eyeY)
  for (let i = 0; i < position.count; i++) {
    const localY = position.getY(i)
    const wallDelta = sampleRadius(profile, eyeY + localY) - eyeWallR
    const bend = smoothstep01((localY + 0.004) / (topY + 0.004)) * LUG_FLARE
    position.setZ(i, position.getZ(i) + radialSign * (wallDelta + bend))
  }
  position.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

function gripLathe() {
  const half = HANDLE_GRIP_LEN * 0.5
  const hole = HANDLE_WIRE_R + 0.00075
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

/** Outside free end → compact retaining hook → directly through the lug bore. */
function hookOutsideToInside(eyeZ: number, radialSign: number) {
  const z = (offset: number) => radialSign * (eyeZ + offset)
  return [
    v3(0.0002, -0.004, z(0.0041)),
    v3(0.0028, -0.0032, z(0.0038)),
    v3(0.004, -0.001, z(0.0029)),
    v3(0.0034, 0.0012, z(0.0019)),
    v3(0.0014, 0.0019, z(0.00125)),
    v3(0.0002, 0.0008, z(0.00075)),
    v3(0, 0, z(0)),
    v3(0, -0.0001, z(-0.0006)),
  ]
}

function sideArm(eyeZ: number, radialSign: number, woodX: number, woodY: number, barHalf: number) {
  const z = (value: number) => radialSign * value
  const arm = [
    v3(-0.008, -0.0008, z(eyeZ - 0.0006)),
    v3(-0.025, -0.007, z(eyeZ - 0.001)),
    v3(woodX * 0.56, woodY * 0.44, z(barHalf + 0.024)),
    v3(woodX * 0.88, woodY * 0.86, z(barHalf + 0.008)),
    v3(woodX, woodY, z(barHalf + 0.0025)),
    v3(woodX, woodY, z(barHalf)),
  ]
  return arm
}

function makeHandlePath(eyeZ: number, woodX: number, woodY: number, barHalf: number) {
  const positiveHook = hookOutsideToInside(eyeZ, 1)
  const negativeHook = hookOutsideToInside(eyeZ, -1)
  const positiveArm = sideArm(eyeZ, 1, woodX, woodY, barHalf)
  const negativeArm = sideArm(eyeZ, -1, woodX, woodY, barHalf)
  const pts: Vector3[] = [
    ...positiveHook,
    ...positiveArm,
    v3(woodX, woodY, barHalf * 0.45),
    v3(woodX, woodY, 0),
    v3(woodX, woodY, -barHalf * 0.45),
    ...negativeArm.slice().reverse(),
    ...negativeHook.slice().reverse(),
  ]
  return new CatmullRomCurve3(pts, false, 'centripetal', 0.5)
}

function cappedWireGeometry(path: CatmullRomCurve3) {
  const tube = new TubeGeometry(path, 360, HANDLE_WIRE_R, 14, false)
  const capA = new SphereGeometry(HANDLE_WIRE_R, 14, 10)
  const capB = capA.clone()
  capA.translate(path.getPoint(0).x, path.getPoint(0).y, path.getPoint(0).z)
  capB.translate(path.getPoint(1).x, path.getPoint(1).y, path.getPoint(1).z)
  const merged = mergeGeometries([tube, capA, capB], false)
  tube.dispose()
  capA.dispose()
  capB.dispose()
  if (!merged) throw new Error('Unable to build continuous handle wire geometry')
  merged.computeVertexNormals()
  return merged
}

export type HandleAssembly = {
  root: Group
  pivot: Group
  wire: Mesh
  grip: Mesh
  debug: LineSegments
  setAngle: (t: number) => void
  updateCollision: (profile: Profile, showDebug: boolean) => void
}

export function createHandle(mats: KettleMaterials, outerPts: Profile): HandleAssembly {
  const root = new Group()
  root.name = 'handle_assembly'
  const y = HANDLE_Y
  const eyeY = y + 0.001
  const bodyR = sampleRadius(outerPts, eyeY)
  const bendAtHole = smoothstep01(0.004 / 0.0086) * LUG_FLARE
  const eyeZ = bodyR + LUG_STANDOFF + LUG_THICK * 0.5 + bendAtHole

  const makeLug = (name: string, sign: number) => {
    const group = new Group()
    group.name = name
    const plate = mesh(`${name}_plate`, stampedLugGeo(outerPts, eyeY, sign), mats.steelSmooth)
    plate.position.set(0, eyeY, sign * (bodyR + LUG_STANDOFF + LUG_THICK * 0.5))
    group.add(plate)
    return group
  }

  root.add(makeLug('handle_bracket_a', 1), makeLug('handle_bracket_b', -1))

  const woodX = -(bodyR + 0.038)
  const woodY = -HANDLE_GRIP_DROP
  const barHalf = HANDLE_GRIP_LEN * 0.5 + 0.002

  const pivot = new Group()
  pivot.name = 'handle_pivot_group'
  pivot.position.set(0, eyeY, 0)

  const path = makeHandlePath(eyeZ, woodX, woodY, barHalf)
  const wire = mesh('handle_wire', cappedWireGeometry(path), mats.steelSmooth)

  const grip = mesh('handle_wood_grip', gripLathe(), mats.wood)
  grip.position.set(woodX, woodY, 0)
  grip.rotation.x = Math.PI / 2

  pivot.add(wire, grip)

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
  return { root, pivot, wire, grip, debug, setAngle, updateCollision }
}
