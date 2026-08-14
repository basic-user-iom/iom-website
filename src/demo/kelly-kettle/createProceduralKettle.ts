import {
  DoubleSide,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
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
  const innerPts = offsetProfile(outerPts, -WALL)
  const remStart = CUT_ANGLE / 2
  const remLen = Math.PI * 2 - CUT_ANGLE
  const remSegs = Math.max(36, Math.round(segs * (remLen / (Math.PI * 2))))

  const shellFull = mesh('kettle_exterior_full', lathe(outerPts, segs), mats.steel)
  shellFull.name = 'kettle_shell_outer'
  const innerFull = mesh('kettle_shell_inner', lathe(innerPts, segs), mats.steel)
  ;(innerFull.material as MeshStandardMaterial).side = DoubleSide

  const cutawayMat = mats.steel.clone()
  cutawayMat.transparent = true
  cutawayMat.opacity = 0
  const shellCut = mesh('kettle_exterior_cutaway', lathe(outerPts, remSegs, remStart, remLen), cutawayMat)
  shellCut.name = 'kettle_shell_cutaway'
  shellCut.visible = false
  const innerCut = mesh(
    'kettle_shell_inner_cutaway',
    lathe(innerPts, remSegs, remStart, remLen),
    innerFull.material,
  )
  innerCut.visible = false

  const cutShape = wallSectionShape(outerPts, innerPts)
  const cutGeo = new ShapeGeometry(cutShape)
  const cutA = mesh('kettle_cut_face_a', cutGeo, mats.steel, false)
  const cutB = mesh('kettle_cut_face_b', cutGeo.clone(), mats.steel, false)
  cutA.rotation.y = remStart - Math.PI / 2
  cutB.rotation.y = remStart + remLen - Math.PI / 2
  cutA.visible = false
  cutB.visible = false

  const chimneyFull = mesh('chimney_full', lathe(chimneyInnerProfile(), segs), mats.chimneyInner, false)
  chimneyFull.name = 'chimney_inner'
  const chimneyCut = mesh(
    'chimney_cutaway',
    lathe(chimneyInnerProfile(), remSegs, remStart, remLen),
    mats.chimneyInner,
    false,
  )
  chimneyCut.visible = false
  const chimneySkin = mesh(
    'chimney_outer_skin',
    lathe(chimneyOuterProfile(), segs),
    mats.steel,
    false,
  )
  chimneySkin.visible = false
  const chimneyRim = mesh(
    'chimney_top_rim',
    new TorusGeometry(CHIMNEY_TOP_R - 0.0005, 0.0007, 10, segs),
    mats.steel,
    false,
  )
  chimneyRim.rotation.x = Math.PI / 2
  chimneyRim.position.y = KETTLE_H

  const waterGroup = new Group()
  waterGroup.name = 'water_jacket'
  const wOuter = waterOuterProfile()
  const wInner = waterInnerProfile()
  waterGroup.add(
    mesh('water_outer', lathe(wOuter, segs), mats.water, false),
    mesh('water_inner', lathe(wInner, segs), mats.water, false),
  )
  const topR = wOuter[wOuter.length - 1]?.x ?? BODY_R * 0.7
  const topRi = wInner[wInner.length - 1]?.x ?? CHIMNEY_TOP_R
  const waterTop = mesh('water_top', new RingGeometry(topRi, topR, segs), mats.water, false)
  waterTop.rotation.x = -Math.PI / 2
  waterTop.position.y = wOuter[wOuter.length - 1]?.y ?? WATER_TOP_Y
  const waterBot = mesh(
    'water_bottom',
    new RingGeometry(wInner[0]?.x ?? CHIMNEY_TOP_R, wOuter[0]?.x ?? BODY_R * 0.6, segs),
    mats.water,
    false,
  )
  waterBot.rotation.x = -Math.PI / 2
  waterBot.position.y = wOuter[0]?.y ?? 0.01
  waterGroup.add(waterTop, waterBot)
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
    chimneyCut,
    chimneySkin,
    chimneyRim,
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
    chimney_cutaway: chimneyCut,
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
        chimneySkin.visible = showCut
        chimneyRim.visible = !showCut
        shellCut.visible = showCut
        innerCut.visible = showCut
        chimneyCut.visible = showCut
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
        if (!state.reducedMotion) {
          waterGroup.rotation.y = performance.now() * 0.001 * (0.004 + heat * 0.012)
        }
        const t = performance.now() * 0.001
        for (let i = 0; i < bubbles.length; i++) {
          const show = heat > 0.35
          bubbles[i].visible = show
          if (!show) continue
          const a = i * 0.7
          const y0 = 0.04 + (i % 5) * 0.03
          const rise = state.reducedMotion ? 0 : ((t * (0.04 + heat * 0.08) + i * 0.13) % 0.16)
          bubbles[i].position.set(Math.cos(a) * 0.048, y0 + rise, Math.sin(a) * 0.048)
          bubbles[i].scale.setScalar(0.6 + heat * 0.7)
        }
      }

      const fire = state.fireProgress * state.fireIntensity
      mats.chimneyInner.emissive.setRGB(0.1 * fire, 0.03 * fire, 0.004 * fire)

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
  const dark = mats.steelBase.clone()
  dark.color.setHex(0x3a3d40)
  dark.roughness = 0.7
  dark.side = DoubleSide
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

  const linerPts = [
    new Vector2(Math.max(0.004, sampleRadius(wall, 0.006) - WALL * 1.1), 0.004),
    new Vector2(Math.max(0.004, sampleRadius(wall, splitY) - WALL * 1.1), splitY),
  ]
  const chamber = mesh(
    'fire_base_chamber',
    lathe(linerPts, Math.max(24, Math.floor(segs / 2)), AIR_HOLE_PHI + 0.55, Math.PI * 2 - 1.1),
    dark,
    false,
  )

  group.add(
    mesh('fire_base_floor', lathe(fireBaseFloorProfile(), segs), dark),
    mesh('fire_base_below_hole', lathe(below, segs), lowerMat),
    airHole,
    mesh('fire_base_above_hole', lathe(midUpper, segs), lowerMat),
    mesh('fire_base_seat', lathe(fireBaseUpperSeatProfile(), segs), wallMat),
    chamber,
  )
  return { fireBase: group, airHole }
}
