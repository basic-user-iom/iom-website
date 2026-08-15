import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  ShapeGeometry,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import {
  AIR_HOLE_PHI,
  AIR_HOLE_R,
  AIR_HOLE_Y,
  BASE_H,
  BODY_R,
  CHIMNEY_TOP_R,
  CUT_ANGLE,
  KETTLE_H,
  SEAT_Y,
  WALL,
  WATER_TOP_Y,
} from './constants'
import { createChain } from './createChain'
import { createHandle } from './createHandle'
import { createSpoutWhistle } from './createSpoutWhistle'
import { collectGeometriesAndMaterials, disposeTracked, triangleCountOf } from './dispose'
import { createKettleMaterials, type KettleMaterials } from './materials'
import {
  CHIMNEY_NECK_JOIN_Y,
  chimneyInnerProfile,
  chimneyOuterProfile,
  clipProfileY,
  fireBaseFloorProfile,
  fireBaseUpperSeatProfile,
  fireBaseWallProfile,
  kettleOuterProfile,
  offsetProfile,
  sampleRadius,
  wallSectionShape,
  waterInnerProfile,
  waterOuterProfile,
} from './profiles'
import { sheetWithCircularHole } from './sheetWithHole'
import type { KellyKettleModelHandle, ModelParts, ModelUpdate } from './types'

type Profile = Vector2[]

function lathe(points: Profile, segments: number, phiStart = 0, phiLength = Math.PI * 2) {
  const geo = new LatheGeometry(points, segments, phiStart, phiLength)
  geo.computeVertexNormals()
  return geo
}

/**
 * Revolves an open profile without duplicating the full-circle seam.
 * Reversing the winding makes the cavity wall render inward with FrontSide.
 */
function openRevolvedWall(
  points: Profile,
  segments: number,
  inward = false,
  phiStart = 0,
  phiLength = Math.PI * 2,
) {
  const fullCircle = Math.abs(phiLength - Math.PI * 2) < 1e-6
  const ringCount = fullCircle ? segments : segments + 1
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let ring = 0; ring < ringCount; ring++) {
    const u = ring / segments
    const phi = phiStart + phiLength * u
    const sin = Math.sin(phi)
    const cos = Math.cos(phi)
    for (let row = 0; row < points.length; row++) {
      const point = points[row]
      positions.push(point.x * sin, point.y, point.x * cos)
      uvs.push(u, row / Math.max(1, points.length - 1))
    }
  }

  const strips = fullCircle ? segments : segments
  for (let ring = 0; ring < strips; ring++) {
    const nextRing = fullCircle ? (ring + 1) % ringCount : ring + 1
    for (let row = 0; row < points.length - 1; row++) {
      const a = ring * points.length + row
      const b = nextRing * points.length + row
      const c = b + 1
      const d = a + 1
      if (inward) {
        indices.push(a, d, b, b, d, c)
      } else {
        indices.push(a, b, d, b, c, d)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.normalizeNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** A rounded half-profile joins the two open walls without covering the bore. */
function rolledRim(
  innerRadius: number,
  outerRadius: number,
  y: number,
  segments: number,
  phiStart = 0,
  phiLength = Math.PI * 2,
) {
  const centre = (innerRadius + outerRadius) * 0.5
  const radius = (outerRadius - innerRadius) * 0.5
  const profile: Vector2[] = []
  const profileSegments = 16
  for (let i = 0; i <= profileSegments; i++) {
    const angle = Math.PI - (i / profileSegments) * Math.PI
    profile.push(new Vector2(centre + Math.cos(angle) * radius, y + Math.sin(angle) * radius))
  }
  return openRevolvedWall(profile, segments, false, phiStart, phiLength)
}

function mesh(name: string, geometry: Mesh['geometry'], material: Mesh['material'], shadows = true) {
  const m = new Mesh(geometry, material)
  m.name = name
  m.castShadow = shadows
  m.receiveShadow = shadows
  return m
}

export function createProceduralKettle(quality: 'high' | 'mobile'): KellyKettleModelHandle {
  const mats = createKettleMaterials()
  const segs = quality === 'high' ? 96 : 48
  const root = new Group()
  root.name = 'kettle_procedural_root'

  const kettle = new Group()
  kettle.name = 'kettle_body'
  kettle.position.y = SEAT_Y

  const outerPts = kettleOuterProfile()
  const shellPts = clipProfileY(outerPts, outerPts[0].y, CHIMNEY_NECK_JOIN_Y)
  const innerPts = clipProfileY(offsetProfile(shellPts, -WALL), shellPts[0].y, CHIMNEY_NECK_JOIN_Y)
  const remStart = CUT_ANGLE / 2
  const remLen = Math.PI * 2 - CUT_ANGLE
  const remSegs = Math.max(36, Math.round(segs * (remLen / (Math.PI * 2))))

  const shellFull = mesh('kettle_exterior_full', lathe(shellPts, segs), mats.steel)
  shellFull.name = 'kettle_shell_outer'
  const innerShellMaterial = mats.steel.clone()
  innerShellMaterial.side = DoubleSide
  const innerFull = mesh('kettle_shell_inner', lathe(innerPts, segs), innerShellMaterial)

  const cutawayMat = mats.steel.clone()
  cutawayMat.transparent = true
  cutawayMat.opacity = 0
  const shellCut = mesh('kettle_exterior_cutaway', lathe(shellPts, remSegs, remStart, remLen), cutawayMat)
  shellCut.name = 'kettle_shell_cutaway'
  shellCut.visible = false
  const innerCut = mesh(
    'kettle_shell_inner_cutaway',
    lathe(innerPts, remSegs, remStart, remLen),
    innerFull.material,
  )
  innerCut.visible = false

  const cutShape = wallSectionShape(shellPts, innerPts)
  const cutGeo = new ShapeGeometry(cutShape)
  const cutA = mesh('kettle_cut_face_a', cutGeo, mats.steel, false)
  const cutB = mesh('kettle_cut_face_b', cutGeo.clone(), mats.steel, false)
  cutA.rotation.y = remStart - Math.PI / 2
  cutB.rotation.y = remStart + remLen - Math.PI / 2
  cutA.visible = false
  cutB.visible = false

  const chimneyInnerPts = chimneyInnerProfile()
  const chimneyOuterPts = chimneyOuterProfile()
  const chimneyTopRadius = chimneyInnerPts[chimneyInnerPts.length - 1].x
  const chimneyOuterTopRadius = chimneyOuterPts[chimneyOuterPts.length - 1].x
  const chimneyBodyMaxY = CHIMNEY_NECK_JOIN_Y - 0.0003
  const chimneyBodyInner = clipProfileY(chimneyInnerPts, chimneyInnerPts[0].y, chimneyBodyMaxY)
  const chimneyBodyOuter = clipProfileY(chimneyOuterPts, chimneyOuterPts[0].y, chimneyBodyMaxY)
  const chimneyNeckInnerPts = clipProfileY(chimneyInnerPts, CHIMNEY_NECK_JOIN_Y, KETTLE_H)
  const chimneyNeckOuterPts = clipProfileY(chimneyOuterPts, CHIMNEY_NECK_JOIN_Y, KETTLE_H)

  const chimneyFull = mesh(
    'chimney_full',
    openRevolvedWall(chimneyBodyInner, segs, true),
    mats.chimneyInner,
    false,
  )
  chimneyFull.name = 'chimney_inner'
  const chimneySkin = mesh(
    'chimney_outer_skin',
    openRevolvedWall(chimneyBodyOuter, segs, false),
    mats.steel,
    false,
  )
  const chimneyInnerCut = mesh(
    'chimney_inner_cutaway',
    openRevolvedWall(chimneyBodyInner, remSegs, true, remStart, remLen),
    mats.chimneyInner,
    false,
  )
  chimneyInnerCut.visible = false
  const chimneySkinCut = mesh(
    'chimney_outer_skin_cutaway',
    openRevolvedWall(chimneyBodyOuter, remSegs, false, remStart, remLen),
    mats.steel,
    false,
  )
  chimneySkinCut.visible = false
  const chimneyNeckInner = mesh(
    'chimney_neck_inner',
    openRevolvedWall(chimneyNeckInnerPts, segs, true),
    mats.chimneyInner,
    false,
  )
  const chimneyNeckOuter = mesh(
    'chimney_neck_outer',
    openRevolvedWall(chimneyNeckOuterPts, segs, false),
    mats.steel,
    false,
  )
  const chimneyRim = mesh(
    'chimney_top_rim',
    rolledRim(chimneyTopRadius, chimneyOuterTopRadius, KETTLE_H, segs),
    mats.steel,
    false,
  )
  const chimneyCutShape = wallSectionShape(chimneyBodyOuter, chimneyBodyInner)
  const chimneyCutGeo = new ShapeGeometry(chimneyCutShape)
  const chimneyCutA = mesh('chimney_cut_face_a', chimneyCutGeo, mats.steel, false)
  const chimneyCutB = mesh('chimney_cut_face_b', chimneyCutGeo.clone(), mats.steel, false)
  chimneyCutA.rotation.y = remStart - Math.PI / 2
  chimneyCutB.rotation.y = remStart + remLen - Math.PI / 2
  chimneyCutA.visible = false
  chimneyCutB.visible = false

  const waterGroup = new Group()
  waterGroup.name = 'water_jacket'
  const wOuter = waterOuterProfile()
  const wInner = waterInnerProfile()
  waterGroup.add(
    mesh('water_outer', lathe(wOuter, remSegs, remStart, remLen), mats.water, false),
    mesh('water_inner', lathe(wInner, remSegs, remStart, remLen), mats.water, false),
  )
  const topR = wOuter[wOuter.length - 1]?.x ?? BODY_R * 0.7
  const topRi = wInner[wInner.length - 1]?.x ?? CHIMNEY_TOP_R
  const waterTopY = wOuter[wOuter.length - 1]?.y ?? WATER_TOP_Y
  const waterBotY = wOuter[0]?.y ?? 0.01
  const waterTop = mesh(
    'water_top',
    openRevolvedWall([new Vector2(topRi, waterTopY), new Vector2(topR, waterTopY)], remSegs, false, remStart, remLen),
    mats.water,
    false,
  )
  const waterBot = mesh(
    'water_bottom',
    openRevolvedWall(
      [new Vector2(wInner[0]?.x ?? CHIMNEY_TOP_R, waterBotY), new Vector2(wOuter[0]?.x ?? BODY_R * 0.6, waterBotY)],
      remSegs,
      false,
      remStart,
      remLen,
    ),
    mats.water,
    false,
  )
  const waterCutShape = wallSectionShape(wOuter, wInner)
  const waterCutGeo = new ShapeGeometry(waterCutShape)
  const waterCutA = mesh('water_cut_face_a', waterCutGeo, mats.water, false)
  const waterCutB = mesh('water_cut_face_b', waterCutGeo.clone(), mats.water, false)
  waterCutA.rotation.y = remStart - Math.PI / 2
  waterCutB.rotation.y = remStart + remLen - Math.PI / 2
  waterGroup.add(waterTop, waterBot, waterCutA, waterCutB)
  const bubbleGeo = new SphereGeometry(0.0016, 8, 6)
  const bubbleMat = mats.water.clone()
  bubbleMat.opacity = 0.45
  const bubbles: Mesh[] = []
  for (let i = 0; i < 10; i++) {
    const bubble = mesh(`water_bubble_${i}`, bubbleGeo, bubbleMat, false)
    bubble.visible = false
    waterGroup.add(bubble)
    bubbles.push(bubble)
  }
  waterGroup.visible = false

  const spoutWhistle = createSpoutWhistle(mats, outerPts)
  const handle = createHandle(mats, outerPts)
  const chain = createChain(mats, outerPts)
  const { fireBase, airHole } = buildFireBase(mats, segs)

  kettle.add(
    shellFull,
    shellCut,
    innerFull,
    innerCut,
    cutA,
    cutB,
    chimneyFull,
    chimneySkin,
    chimneyInnerCut,
    chimneySkinCut,
    chimneyNeckInner,
    chimneyNeckOuter,
    chimneyRim,
    chimneyCutA,
    chimneyCutB,
    waterGroup,
    spoutWhistle.spout,
    handle.root,
    chain.root,
  )
  root.add(fireBase, kettle)

  const parts: ModelParts = {
    kettle_procedural_root: root,
    kettle_shell_outer: shellFull,
    kettle_shell_cutaway: shellCut,
    kettle_shell_inner: innerFull,
    kettle_exterior_full: shellFull,
    kettle_exterior_cutaway: shellCut,
    chimney_inner: chimneyFull,
    chimney_full: chimneyFull,
    chimney_cutaway: chimneyInnerCut,
    water_jacket: waterGroup,
    water_spout: spoutWhistle.spout,
    green_whistle: spoutWhistle.whistle,
    whistle_root: spoutWhistle.whistle,
    handle_wire: handle.wire,
    handle_grip: handle.grip,
    handle_pivot_group: handle.pivot,
    handle_wood_grip: handle.grip,
    pouring_chain: chain.root,
    whistle_chain: chain.root,
    chain_body_bracket: chain.root.getObjectByName('chain_body_bracket') ?? chain.root,
    fire_base: fireBase,
    fire_base_air_hole: airHole,
  }

  const tracked = collectGeometriesAndMaterials(root)
  const shared = new Set<Material>([
    mats.steel,
    mats.steelBase,
    mats.steelSmooth,
    mats.steelSatin,
    mats.chimneyInner,
    mats.water,
    mats.whistle,
    mats.whistleDark,
    mats.wood,
  ])
  for (const mat of shared) tracked.mats.delete(mat)

  const whistleWorld = new Vector3()
  let lastCut = -1
  let lastWater = false
  const boilBase = new Vector3()

  return {
    group: root,
    parts,
    source: 'procedural',
    triangleCount: triangleCountOf(root),
    assetBytes: 0,
    update: (state: ModelUpdate) => {
      mats.steel.roughness = state.metalRoughness
      mats.steelBase.roughness = Math.min(0.62, state.metalRoughness + 0.06)

      const force = state.exteriorOrCutaway
      const cut = force === 'exterior' ? 0 : force === 'cutaway' ? 1 : state.cutawayProgress
      if (Math.abs(cut - lastCut) > 0.001) {
        lastCut = cut
        const showCut = cut > 0.45
        shellFull.visible = !showCut
        innerFull.visible = !showCut
        chimneyFull.visible = !showCut
        chimneySkin.visible = !showCut
        chimneyInnerCut.visible = showCut
        chimneySkinCut.visible = showCut
        chimneyCutA.visible = showCut
        chimneyCutB.visible = showCut
        chimneyNeckInner.visible = true
        chimneyNeckOuter.visible = true
        chimneyRim.visible = true
        shellCut.visible = showCut
        innerCut.visible = showCut
        cutA.visible = showCut
        cutB.visible = showCut
        kettle.rotation.y = -0.18 * cut
      }

      const showWater = state.waterVisible && cut > 0.2
      if (showWater !== lastWater) {
        lastWater = showWater
        waterGroup.visible = showWater
      }
      if (showWater) {
        const heat = state.waterHeatProgress
        mats.water.opacity = 0.32 + heat * 0.1
        mats.water.color.setHSL(0.52 - heat * 0.06, 0.48, 0.42 + heat * 0.04)
        const t = performance.now() * 0.001
        const remStart = CUT_ANGLE / 2 + 0.2
        const remLen = Math.PI * 2 - CUT_ANGLE - 0.4
        const yMin = waterBotY + 0.012
        const yMax = waterTopY - 0.01
        const span = Math.max(0.04, yMax - yMin)
        for (let i = 0; i < bubbles.length; i++) {
          const show = heat > 0.35
          bubbles[i].visible = show
          if (!show) continue
          const y = state.reducedMotion
            ? yMin + (i / bubbles.length) * span
            : yMin + ((t * (0.035 + heat * 0.06) + i * 0.17) % span)
          const innerR = sampleRadius(wInner, y) + 0.002
          const outerR = sampleRadius(wOuter, y) - 0.002
          const r = innerR + ((i % 3) / 3) * Math.max(0.003, outerR - innerR)
          const a = remStart + ((i + 0.5) / bubbles.length) * remLen
          bubbles[i].position.set(Math.sin(a) * r, y, Math.cos(a) * r)
          bubbles[i].scale.setScalar(0.6 + heat * 0.7)
        }
      }

      const fire = state.fireProgress * state.fireIntensity
      mats.chimneyInner.emissive.setRGB(0.14 + 0.12 * fire, 0.14 + 0.04 * fire, 0.14)
      mats.chimneyInner.emissiveIntensity = 0.28 + 0.5 * fire

      handle.setAngle(state.handleAngle)
      handle.updateCollision(outerPts, state.handleCollisionDebug)
      spoutWhistle.setInserted(state.whistleInserted)
      kettle.updateMatrixWorld(true)
      spoutWhistle.whistleWorld(whistleWorld)
      kettle.worldToLocal(whistleWorld)
      chain.update(
        whistleWorld,
        state.chainVisible,
        state.chainDebug,
        state.reducedMotion,
        performance.now() * 0.001,
      )

      const boiling = state.waterHeatProgress > 0.92 && state.fireProgress > 0.85 && state.whistleInserted
      if (boiling && !state.reducedMotion) {
        const t = performance.now() * 0.001
        boilBase.copy(spoutWhistle.seated)
        spoutWhistle.whistle.position.x = boilBase.x + Math.sin(t * 48) * 0.00025
        spoutWhistle.whistle.position.y = boilBase.y + Math.sin(t * 39) * 0.00018
      }
      spoutWhistle.steamPulse(
        boiling ? 0.8 : state.waterHeatProgress * 0.15,
        state.reducedMotion,
      )
    },
    dispose: () => {
      disposeTracked(tracked.geos, tracked.mats)
      mats.dispose()
    },
  }
}

function buildFireBase(mats: KettleMaterials, segs: number) {
  const group = new Group()
  group.name = 'fire_base'
  const wall = fireBaseWallProfile()
  const splitY = BASE_H * 0.63
  const holeLo = AIR_HOLE_Y - AIR_HOLE_R
  const holeHi = AIR_HOLE_Y + AIR_HOLE_R
  const below = clipProfileY(wall, wall[0].y, holeLo)
  const midUpper = clipProfileY(wall, holeHi, splitY)

  const wallMat = mats.steelBase.clone()
  wallMat.side = DoubleSide
  const panMat = mats.steelBase.clone()
  panMat.color.setHex(0x6a7076)
  panMat.roughness = 0.72
  panMat.metalness = 0.42
  panMat.side = DoubleSide
  const lowerMat = mats.steelBase.clone()
  lowerMat.side = DoubleSide
  lowerMat.roughness = 0.58

  const holeMesh = mesh(
    'fire_base_hole_wall',
    sheetWithCircularHole(wall, segs, AIR_HOLE_Y, AIR_HOLE_R, AIR_HOLE_PHI, holeLo, holeHi),
    lowerMat,
  )
  const airHole = new Group()
  airHole.name = 'fire_base_air_hole'
  airHole.add(holeMesh)

  const wallInner = Math.max(0.004, sampleRadius(wall, 0.006) - WALL * 1.1)
  const linerPts = [
    new Vector2(wallInner, 0.0048),
    new Vector2(wallInner, splitY),
  ]
  // Full inner liner — air enters only through the outer wall hole above the pan floor.
  const chamber = mesh(
    'fire_base_chamber',
    lathe(linerPts, Math.max(32, Math.floor(segs / 2))),
    panMat,
    false,
  )

  group.add(
    mesh('fire_base_floor', lathe(fireBaseFloorProfile(), segs), panMat),
    mesh('fire_base_below_hole', lathe(below, segs), lowerMat),
    airHole,
    mesh('fire_base_above_hole', lathe(midUpper, segs), lowerMat),
    mesh('fire_base_seat', lathe(fireBaseUpperSeatProfile(), segs), wallMat),
    chamber,
  )
  return { fireBase: group, airHole }
}
