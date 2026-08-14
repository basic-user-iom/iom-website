import {
  CatmullRomCurve3,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { CHAIN_LINKS, CHAIN_Y } from './constants'
import type { KettleMaterials } from './materials'
import { sampleRadius } from './profiles'

function mesh(name: string, geometry: Mesh['geometry'], material: Mesh['material'], shadows = false) {
  const m = new Mesh(geometry, material)
  m.name = name
  m.castShadow = shadows
  m.receiveShadow = shadows
  return m
}

function ovalLinkGeometry(rx: number, ry: number, tube: number) {
  const geo = new TorusGeometry(rx, tube, 10, 24)
  geo.scale(1, ry / rx, 1)
  geo.computeVertexNormals()
  return geo
}

export type ChainAssembly = {
  root: Group
  links: InstancedMesh
  bodyEnd: Vector3
  update: (
    whistleEnd: Vector3,
    visible: boolean,
    debug: boolean,
    reducedMotion: boolean,
    now: number,
  ) => void
}

export function createChain(mats: KettleMaterials, outerPts: Vector2[]): ChainAssembly {
  const root = new Group()
  root.name = 'whistle_chain'
  const y = CHAIN_Y
  const r = sampleRadius(outerPts, y)
  const attachPhi = Math.PI
  const bodyRadial = new Vector3(Math.cos(attachPhi), 0, Math.sin(attachPhi))
  const tangent = new Vector3(-bodyRadial.z, 0, bodyRadial.x)
  const surface = bodyRadial.clone().multiplyScalar(r)
  surface.y = y

  const eyeR = 0.0017
  const eyeTube = 0.00038
  const splitR = 0.00305
  const splitTube = 0.00032
  const eyeCenter = surface.clone().addScaledVector(bodyRadial, eyeR * 0.7)
  const splitCenter = eyeCenter
    .clone()
    .addScaledVector(bodyRadial, 0.0004)
    .add(new Vector3(0, -(eyeR + splitR) * 0.42, 0))

  const bracket = new Group()
  bracket.name = 'chain_body_bracket'
  const pad = mesh('chain_weld_pad', new SphereGeometry(0.00115, 12, 10), mats.steel)
  pad.scale.set(1.2, 0.42, 1.2)
  pad.position.copy(surface)
  pad.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), bodyRadial)
  const eye = mesh('chain_body_eye', new TorusGeometry(eyeR, eyeTube, 10, 22), mats.steelSmooth)
  eye.position.copy(eyeCenter)
  eye.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), tangent)
  const ring = mesh('chain_body_ring', new TorusGeometry(splitR, splitTube, 12, 28), mats.steelSmooth)
  ring.position.copy(splitCenter)
  ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), bodyRadial)
  ring.rotateX(0.28)
  bracket.add(pad, eye, ring)
  root.add(bracket)

  const linkRx = 0.00205
  const linkRy = 0.00132
  const linkTube = 0.0002
  const pitch = linkRx * 0.9
  const linkGeo = ovalLinkGeometry(linkRx, linkRy, linkTube)
  const chainMat = mats.steelSmooth.clone()
  chainMat.roughness = 0.36
  const links = new InstancedMesh(linkGeo, chainMat, CHAIN_LINKS)
  links.name = 'whistle_chain_links'
  links.instanceMatrix.setUsage(DynamicDrawUsage)
  links.castShadow = false
  links.frustumCulled = false
  links.count = 0
  root.add(links)

  const ringDown = new Vector3(0, -1, 0).applyQuaternion(ring.quaternion).normalize()
  const bodyEnd = splitCenter.clone().addScaledVector(ringDown, splitR)
  const bodyExit = bodyEnd
    .clone()
    .addScaledVector(ringDown, 0.006)
    .addScaledVector(bodyRadial, 0.011)
  const bodyExitDir = bodyExit.clone().sub(bodyEnd).normalize()
  const hangPts: Vector3[] = Array.from({ length: 12 }, () => new Vector3())
  const tangentDir = new Vector3()
  const quat = new Quaternion()
  const twist = new Quaternion()
  const mtx = new Matrix4()
  const scl = new Vector3(1, 1, 1)
  const dummyPos = new Vector3()
  const xAxis = new Vector3(1, 0, 0)
  const minY = 0.03

  const keepOutside = (p: Vector3) => {
    const minR = sampleRadius(outerPts, p.y) + 0.012
    const pr = Math.hypot(p.x, p.z)
    if (pr < 1e-6) {
      p.x = -minR
      p.z = 0
    } else if (pr < minR) {
      p.x *= minR / pr
      p.z *= minR / pr
    }
    if (p.y < minY) p.y = minY
  }

  const update = (
    whistleEnd: Vector3,
    visible: boolean,
    debug: boolean,
    reducedMotion: boolean,
    now: number,
  ) => {
    root.visible = visible
    if (!visible) {
      links.count = 0
      links.instanceMatrix.needsUpdate = true
      return
    }

    const sag = 0.078 + (debug ? 0.012 : 0)
    const sway = reducedMotion ? 0 : Math.sin(now * 1.05) * 0.16
    const bob = reducedMotion ? 0 : Math.sin(now * 0.72) * 0.006
    const phiW = Math.atan2(whistleEnd.z, whistleEnd.x)
    const y1 = whistleEnd.y
    const n = hangPts.length - 1

    hangPts[0].copy(bodyEnd)
    hangPts[1].copy(bodyExit)
    hangPts[n].copy(whistleEnd)
    const y0 = hangPts[1].y
    const bellyY = Math.max(minY, Math.min(y0, y1) - sag + bob)

    for (let i = 2; i < n; i++) {
      const t = (i - 1) / (n - 1)
      const phi = Math.PI + (phiW - Math.PI) * t + sway * Math.sin(Math.PI * t)
      let y: number
      if (t < 0.36) {
        const u = t / 0.36
        y = y0 + (bellyY - y0) * (u * u * (3 - 2 * u))
      } else {
        const u = (t - 0.36) / 0.64
        y = bellyY + (y1 - bellyY) * (u * u * (3 - 2 * u))
      }
      const stand = 0.014 + 0.026 * Math.sin(Math.PI * t)
      const rad = sampleRadius(outerPts, y) + stand
      hangPts[i].set(Math.cos(phi) * rad, y, Math.sin(phi) * rad)
      keepOutside(hangPts[i])
    }

    const curve = new CatmullRomCurve3(hangPts, false, 'centripetal', 0.5)
    const len = Math.max(0.06, curve.getLength())
    const used = Math.max(36, Math.min(CHAIN_LINKS, Math.round(len / pitch) + 1))
    links.count = used

    for (let i = 0; i < used; i++) {
      const t = used === 1 ? 0.5 : i / (used - 1)
      curve.getPointAt(t, dummyPos)
      if (i < 4) {
        tangentDir.copy(bodyExitDir)
      } else {
        curve.getTangentAt(Math.min(0.999, t), tangentDir)
        if (tangentDir.lengthSq() < 1e-8) tangentDir.copy(ringDown)
        tangentDir.normalize()
      }
      quat.setFromUnitVectors(xAxis, tangentDir)
      twist.setFromAxisAngle(xAxis, Math.PI * 0.2 + (i % 2) * (Math.PI * 0.5))
      quat.multiply(twist)
      mtx.compose(dummyPos, quat, scl)
      links.setMatrixAt(i, mtx)
    }
    links.instanceMatrix.needsUpdate = true
  }

  return { root, links, bodyEnd, update }
}
