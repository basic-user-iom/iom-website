import {
  CatmullRomCurve3,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Path,
  Quaternion,
  Shape,
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

function bodyTabGeo() {
  const shape = new Shape()
  shape.moveTo(-0.0026, -0.0038)
  shape.lineTo(0.0026, -0.0038)
  shape.quadraticCurveTo(0.0022, 0.0006, 0.0015, 0.0038)
  shape.lineTo(-0.0015, 0.0038)
  shape.quadraticCurveTo(-0.0022, 0.0006, -0.0026, -0.0038)
  shape.closePath()
  const hole = new Path()
  hole.absarc(0, 0.0008, 0.00125, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geo = new ExtrudeGeometry(shape, {
    depth: 0.0008,
    bevelEnabled: true,
    bevelThickness: 0.00008,
    bevelSize: 0.00008,
    bevelSegments: 1,
  })
  geo.translate(0, 0, -0.0004)
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
  const bodyEnd = new Vector3(-(r + 0.0058), y, 0.0015)

  const bracket = new Group()
  bracket.name = 'chain_body_bracket'
  const tab = mesh('chain_body_tab', bodyTabGeo(), mats.steelSmooth, true)
  tab.position.set(-(r + 0.00015), y, 0)
  tab.rotation.y = -Math.PI / 2
  const ring = mesh('chain_body_ring', new TorusGeometry(0.00255, 0.00034, 10, 20), mats.steelSmooth)
  ring.position.copy(bodyEnd)
  ring.rotation.z = Math.PI / 2
  bracket.add(tab, ring)
  root.add(bracket)

  const linkRx = 0.00335
  const linkRy = 0.00215
  const linkTube = 0.00042
  const pitch = linkRx * 1.42
  const linkGeo = ovalLinkGeometry(linkRx, linkRy, linkTube)
  const chainMat = mats.steelSmooth.clone()
  chainMat.roughness = 0.36
  const links = new InstancedMesh(linkGeo, chainMat, CHAIN_LINKS)
  links.name = 'whistle_chain_links'
  links.instanceMatrix.setUsage(DynamicDrawUsage)
  links.castShadow = false
  links.frustumCulled = false
  root.add(links)

  const p0 = new Vector3()
  const p1 = new Vector3()
  const p2 = new Vector3()
  const tangent = new Vector3()
  const normal = new Vector3()
  const binormal = new Vector3()
  const quat = new Quaternion()
  const mtx = new Matrix4()
  const basis = new Matrix4()
  const scl = new Vector3(1, 1, 1)
  const dummyPos = new Vector3()
  const worldUp = new Vector3(0, 1, 0)
  const prevTangent = new Vector3(0, -1, 0)
  const sample: Vector3[] = []
  const minY = 0.058

  const keepClear = (p: Vector3) => {
    const minR = sampleRadius(outerPts, p.y) + 0.009
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
    p0.copy(bodyEnd)
    p2.copy(whistleEnd)
    const sag = 0.02 + (debug ? 0.01 : 0)
    const sway = reducedMotion ? 0 : Math.sin(now * 1.05) * 0.0005
    const midY = Math.max(minY, Math.min(p0.y, p2.y) - sag)
    const frontR = sampleRadius(outerPts, (p0.y + p2.y) * 0.5) + 0.02
    p1.set((p0.x + p2.x) * 0.5, midY, Math.max(frontR, (p0.z + p2.z) * 0.5 + 0.012) + sway)
    keepClear(p1)
    const n = 18
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      const p = sample[i] ?? new Vector3()
      p.set(
        u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
        u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
      )
      keepClear(p)
      sample[i] = p
    }
    sample[0].copy(bodyEnd)
    sample[n].copy(whistleEnd)
    const curve = new CatmullRomCurve3(sample, false, 'chordal')
    const len = Math.max(0.02, curve.getLength())
    const used = Math.max(10, Math.min(CHAIN_LINKS, Math.round(len / pitch) + 1))
    links.count = used

    let first = true
    prevTangent.set(0, -1, 0)
    for (let i = 0; i < used; i++) {
      const t = used === 1 ? 0.5 : i / (used - 1)
      curve.getPoint(t, dummyPos)
      curve.getTangent(t, tangent)
      if (tangent.lengthSq() < 1e-8) tangent.copy(prevTangent)
      tangent.normalize()
      if (!first && tangent.dot(prevTangent) < 0) tangent.multiplyScalar(-1)
      first = false
      prevTangent.copy(tangent)
      normal.copy(worldUp).cross(tangent)
      if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1)
      normal.normalize()
      binormal.crossVectors(tangent, normal).normalize()
      if (i % 2 === 1) basis.makeBasis(tangent, binormal, normal)
      else basis.makeBasis(tangent, normal, binormal)
      quat.setFromRotationMatrix(basis)
      mtx.compose(dummyPos, quat, scl)
      links.setMatrixAt(i, mtx)
    }
    links.instanceMatrix.needsUpdate = true
  }

  update(new Vector3(0.08, CHAIN_Y + 0.08, 0.02), true, false, true, 0)
  return { root, links, bodyEnd, update }
}
