import {
  CatmullRomCurve3,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
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
  const geo = new TorusGeometry(rx, tube, 8, 24)
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
  const bodyRadial = new Vector3(-Math.sqrt(3) * 0.5, 0, 0.5)
  const bodyEnd = bodyRadial.clone().multiplyScalar(r + 0.002)
  bodyEnd.y = y + 0.001

  const bracket = new Group()
  bracket.name = 'chain_body_bracket'
  const ring = mesh('chain_body_ring', new TorusGeometry(0.0028, 0.00042, 12, 28), mats.steelSmooth)
  ring.position.copy(bodyEnd)
  ring.rotation.y = Math.PI / 6
  bracket.add(ring)
  root.add(bracket)

  const linkRx = 0.0045
  const linkRy = 0.00265
  const linkTube = 0.00042
  const pitch = (linkRx * 2 - linkTube * 2) * 0.77
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

  const anchorDirection = new Vector3()
  const p0 = new Vector3()
  const p1 = new Vector3()
  const p2 = new Vector3()
  const tangent = new Vector3()
  const previousTangent = new Vector3()
  const normal = new Vector3()
  const binormal = new Vector3()
  const side = new Vector3()
  const quat = new Quaternion()
  const transport = new Quaternion()
  const mtx = new Matrix4()
  const basis = new Matrix4()
  const scl = new Vector3(1, 1, 1)
  const dummyPos = new Vector3()
  const worldUp = new Vector3(0, 1, 0)
  const worldForward = new Vector3(0, 0, 1)
  const bodyEyeNormal = new Vector3(0.5, 0, Math.sqrt(3) * 0.5)
  const sample: Vector3[] = []
  const minY = CHAIN_Y - 0.022

  const keepClear = (p: Vector3) => {
    const minR = sampleRadius(outerPts, p.y) + 0.008
    const pr = Math.hypot(p.x, p.z)
    if (pr < minR && pr > 1e-6) {
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
    anchorDirection.subVectors(whistleEnd, bodyEnd).normalize()
    const terminalOffset = linkRx * 1.02
    p0.copy(bodyEnd).addScaledVector(bodyRadial, terminalOffset)
    p2.copy(whistleEnd).addScaledVector(anchorDirection, -terminalOffset)
    const sag = 0.015 + (debug ? 0.007 : 0)
    const sway = reducedMotion ? 0 : Math.sin(now * 1.05) * 0.00035
    const midY = Math.max(minY, Math.min(p0.y, p2.y) - sag)
    const frontR = sampleRadius(outerPts, (p0.y + p2.y) * 0.5) + 0.009
    p1.set((p0.x + p2.x) * 0.5, midY, Math.max(frontR, (p0.z + p2.z) * 0.5 + 0.008) + sway)
    keepClear(p1)
    const n = 24
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      const p = sample[i] ?? new Vector3()
      p.set(
        u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
        u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
      )
      if (i > 0 && i < n) keepClear(p)
      sample[i] = p
    }
    sample[0].copy(p0)
    sample[n].copy(p2)
    const curve = new CatmullRomCurve3(sample, false, 'chordal')
    const len = Math.max(0.02, curve.getLength())
    const used = Math.max(20, Math.min(CHAIN_LINKS, Math.round(len / pitch) + 1))
    links.count = used

    for (let i = 0; i < used; i++) {
      const t = used === 1 ? 0.5 : i / (used - 1)
      curve.getPointAt(t, dummyPos)
      curve.getTangentAt(t, tangent)
      if (tangent.lengthSq() < 1e-8) tangent.copy(previousTangent)
      tangent.normalize()
      if (i === 0) {
        normal.copy(bodyEyeNormal).addScaledVector(tangent, -bodyEyeNormal.dot(tangent))
        if (normal.lengthSq() < 1e-8) {
          normal.copy(worldUp).addScaledVector(tangent, -worldUp.dot(tangent))
        }
        if (normal.lengthSq() < 1e-8) {
          normal.copy(worldForward).addScaledVector(tangent, -worldForward.dot(tangent))
        }
        normal.normalize()
      } else {
        transport.setFromUnitVectors(previousTangent, tangent)
        normal.applyQuaternion(transport)
        normal.addScaledVector(tangent, -normal.dot(tangent)).normalize()
      }
      binormal.crossVectors(tangent, normal).normalize()
      side.copy(i % 2 === 0 ? normal : binormal)
      binormal.crossVectors(tangent, side).normalize()
      basis.makeBasis(tangent, side, binormal)
      quat.setFromRotationMatrix(basis)
      mtx.compose(dummyPos, quat, scl)
      links.setMatrixAt(i, mtx)
      previousTangent.copy(tangent)
    }
    links.instanceMatrix.needsUpdate = true
  }

  return { root, links, bodyEnd, update }
}
