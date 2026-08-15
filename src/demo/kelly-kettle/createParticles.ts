import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three'
import {
  AIR_HOLE_Y,
  BASE_R,
  COLORS,
  CUT_ANGLE,
  DEFAULT_PARTICLES,
  KETTLE_H,
  MAX_PARTICLES,
  SEAT_Y,
  WATER_TOP_Y,
} from './constants'
import { chimneyInnerProfile, sampleRadius, waterInnerProfile, waterOuterProfile } from './profiles'

export type ParticleHandle = {
  airflow: Points
  heatflow: Points
  steam: Points
  reducedGroup: Group
  update: (
    dt: number,
    fire: number,
    heat: number,
    count: number,
    reducedMotion: boolean,
    visible: boolean,
    cutaway?: number,
  ) => void
  dispose: () => void
}

type Cloud = {
  points: Points
  positions: Float32Array
  colors: Float32Array
  progress: Float32Array
  speed: Float32Array
}

const chimneyInner = chimneyInnerProfile()
const waterInner = waterInnerProfile()
const waterOuter = waterOuterProfile()

function particleMap() {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.45)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 32, 32)
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  return map
}

function makeCloud(name: string, n: number, map: CanvasTexture): Cloud {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  const mat = new PointsMaterial({
    map,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    size: 0.007,
    sizeAttenuation: true,
    opacity: 0.9,
    toneMapped: false,
  })
  const points = new Points(geometry, mat)
  points.name = name
  points.frustumCulled = false
  return {
    points,
    positions,
    colors,
    progress: new Float32Array(n),
    speed: new Float32Array(n),
  }
}

function chimneyR(worldY: number) {
  return Math.max(0.008, sampleRadius(chimneyInner, worldY - SEAT_Y) * 0.82)
}

function keepInChimney(target: Vector3) {
  if (target.y < SEAT_Y) return
  const maxR = chimneyR(target.y)
  const r = Math.hypot(target.x, target.z)
  if (r > maxR) {
    target.x *= maxR / r
    target.z *= maxR / r
  }
  target.y = Math.min(target.y, SEAT_Y + KETTLE_H * 0.96)
}

function airPath(spreadX: number, spreadY: number) {
  const y = AIR_HOLE_Y + spreadY
  return new CatmullRomCurve3([
    new Vector3(spreadX * 1.6, y, BASE_R + 0.042),
    new Vector3(spreadX, y, BASE_R + 0.012),
    new Vector3(spreadX * 0.7, y, BASE_R + 0.001),
    new Vector3(spreadX * 0.45, y * 0.9, BASE_R * 0.58),
    new Vector3(spreadX * 0.12, 0.02, BASE_R * 0.18),
    new Vector3(0, 0.018, 0.004),
    new Vector3(0, SEAT_Y + 0.02, 0),
    new Vector3(0, SEAT_Y + KETTLE_H * 0.48, 0),
    new Vector3(0, SEAT_Y + KETTLE_H * 0.94, 0),
  ])
}

function intakeGuide(spreadX: number, spreadY: number) {
  const y = AIR_HOLE_Y + spreadY
  return new CatmullRomCurve3([
    new Vector3(spreadX * 1.8, y, BASE_R + 0.048),
    new Vector3(spreadX * 1.1, y, BASE_R + 0.022),
    new Vector3(spreadX, y, BASE_R + 0.002),
    new Vector3(spreadX * 0.55, y * 0.88, BASE_R * 0.55),
    new Vector3(spreadX * 0.15, 0.02, BASE_R * 0.2),
  ])
}

const INTAKE_SPREADS = [
  [0, 0],
  [0.0048, 0.0032],
  [-0.0048, 0.0032],
  [0.0036, -0.0038],
  [-0.0036, -0.0038],
  [0, 0.0052],
] as const

const cool = new Color(COLORS.coolAir)
const hot = new Color(COLORS.hotAir)
const steamCol = new Color(0xd8e4ea)
const tmp = new Vector3()
const tmpColor = new Color()

export function createParticles(): ParticleHandle {
  const map = particleMap()
  const n = MAX_PARTICLES
  const airN = Math.floor(n * 0.5)
  const heatN = Math.floor(n * 0.3)
  const steamN = n - airN - heatN
  const air = makeCloud('educational_cool_air_particles', airN, map)
  const heat = makeCloud('educational_heat_particles', heatN, map)
  const steam = makeCloud('steam_particles', steamN, map)
  const airCurves = INTAKE_SPREADS.map(([x, y]) => airPath(x, y))

  for (let i = 0; i < airN; i++) {
    air.progress[i] = i / airN
    air.speed[i] = 0.2 + (i % 5) * 0.035
  }
  for (let i = 0; i < heatN; i++) {
    heat.progress[i] = i / heatN
    heat.speed[i] = 0.1 + (i % 4) * 0.018
  }
  for (let i = 0; i < steamN; i++) {
    steam.progress[i] = i / steamN
    steam.speed[i] = 0.1 + (i % 3) * 0.02
  }

  const pathCool = new MeshBasicMaterial({
    color: COLORS.coolAir,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  const pathHot = new MeshBasicMaterial({
    color: COLORS.hotAir,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  const intakeMat = new MeshBasicMaterial({
    color: COLORS.coolAir,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  })

  const reducedGroup = new Group()
  reducedGroup.name = 'static_flow_paths'
  const intakeGroup = new Group()
  intakeGroup.name = 'air_intake_guides'
  const reducedOnly = new Group()
  reducedOnly.name = 'reduced_motion_paths'
  reducedGroup.add(intakeGroup, reducedOnly)

  const intakeGeos: TubeGeometry[] = []
  for (const [x, y] of INTAKE_SPREADS) {
    const tube = new Mesh(new TubeGeometry(intakeGuide(x, y), 16, 0.001, 5, false), intakeMat)
    intakeGeos.push(tube.geometry)
    intakeGroup.add(tube)
  }

  const coolTube = new Mesh(new TubeGeometry(airCurves[0], 24, 0.0014, 5, false), pathCool)
  const hotCurve = new CatmullRomCurve3([
    new Vector3(0, SEAT_Y + 0.02, 0),
    new Vector3(0, SEAT_Y + KETTLE_H * 0.5, 0),
    new Vector3(0, SEAT_Y + KETTLE_H * 0.94, 0),
  ])
  const hotTube = new Mesh(new TubeGeometry(hotCurve, 16, 0.0014, 5, false), pathHot)
  const arrowGeo = new ConeGeometry(0.0036, 0.01, 8)
  const arrows: Mesh[] = []
  for (const p of [0.12, 0.2, 0.28]) {
    const arrow = new Mesh(arrowGeo, pathCool)
    arrow.position.copy(airCurves[0].getPoint(p))
    arrow.lookAt(airCurves[0].getPoint(p + 0.08))
    arrow.rotateX(Math.PI / 2)
    arrows.push(arrow)
    intakeGroup.add(arrow)
  }
  const a2 = new Mesh(arrowGeo, pathHot)
  a2.position.copy(hotCurve.getPoint(0.55))
  a2.lookAt(hotCurve.getPoint(0.7))
  a2.rotateX(Math.PI / 2)
  reducedOnly.add(coolTube, hotTube, a2)
  reducedOnly.visible = false

  const writeCloud = (
    cloud: Cloud,
    used: number,
    place: (i: number, p: number, target: Vector3) => Color,
  ) => {
    for (let i = 0; i < cloud.progress.length; i++) {
      if (i < used) {
        const col = place(i, cloud.progress[i], tmp)
        cloud.positions[i * 3] = tmp.x
        cloud.positions[i * 3 + 1] = tmp.y
        cloud.positions[i * 3 + 2] = tmp.z
        cloud.colors[i * 3] = col.r
        cloud.colors[i * 3 + 1] = col.g
        cloud.colors[i * 3 + 2] = col.b
      } else {
        cloud.positions[i * 3 + 1] = -10
      }
    }
    cloud.points.geometry.attributes.position.needsUpdate = true
    cloud.points.geometry.attributes.color.needsUpdate = true
  }

  return {
    airflow: air.points,
    heatflow: heat.points,
    steam: steam.points,
    reducedGroup,
    update: (dt, fire, heatAmt, count, reducedMotion, visible, cutaway = 0) => {
      const on = visible && fire > 0.04
      reducedGroup.visible = on && reducedMotion
      intakeGroup.visible = on && reducedMotion
      reducedOnly.visible = on && reducedMotion
      air.points.visible = on && !reducedMotion
      heat.points.visible = on && !reducedMotion && heatAmt > 0.12
      steam.points.visible = on && !reducedMotion && heatAmt > 0.72
      if (!on || reducedMotion) return

      const total = Math.max(12, Math.min(MAX_PARTICLES, count || DEFAULT_PARTICLES))
      const airUsed = Math.floor(total * 0.5)
      const heatUsed = Math.floor(total * 0.3)
      const steamUsed = Math.max(0, Math.floor((total * 0.16 * Math.max(0, heatAmt - 0.7)) / 0.3))
      const intakeUsed = Math.floor(airUsed * 0.62)

      for (let i = 0; i < airUsed; i++) {
        air.progress[i] = (air.progress[i] + dt * air.speed[i] * (0.7 + fire)) % 1
      }
      writeCloud(air, airUsed, (i, p, target) => {
        const curve = airCurves[i % airCurves.length]
        const along = i < intakeUsed ? p * 0.4 : 0.22 + p * 0.78
        curve.getPoint(along, target)
        keepInChimney(target)
        if (along < 0.36) return cool
        return tmpColor.copy(cool).lerp(hot, Math.min(1, (along - 0.36) / 0.45))
      })

      const remStart = CUT_ANGLE / 2 + 0.18
      const remLen = Math.PI * 2 - CUT_ANGLE - 0.36
      const yaw = -0.18 * cutaway
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)
      const jacketTop = SEAT_Y + WATER_TOP_Y - 0.012
      const jacketBot = SEAT_Y + 0.028

      for (let i = 0; i < heatUsed; i++) {
        heat.progress[i] = (heat.progress[i] + dt * heat.speed[i] * (0.45 + heatAmt)) % 1
      }
      writeCloud(heat, heatUsed, (i, p, target) => {
        const localY = jacketBot - SEAT_Y + p * (jacketTop - jacketBot)
        const inner = sampleRadius(waterInner, localY) + 0.0025
        const outer = sampleRadius(waterOuter, localY) - 0.0025
        const rr = inner + ((i % 4) / 4) * Math.max(0.003, outer - inner)
        const a = remStart + ((i % 11) / 11) * remLen
        const lx = Math.sin(a) * rr
        const lz = Math.cos(a) * rr
        target.set(lx * cy + lz * sy, SEAT_Y + localY, -lx * sy + lz * cy)
        return tmpColor.copy(hot).lerp(cool, 0.22)
      })

      for (let i = 0; i < steamUsed; i++) {
        steam.progress[i] = (steam.progress[i] + dt * steam.speed[i]) % 1
      }
      writeCloud(steam, steamUsed, (i, p, target) => {
        const a = i * 1.7
        const r = ((i % 5) * 0.002)
        target.set(Math.cos(a) * r, SEAT_Y + KETTLE_H * 0.88 + p * 0.05, Math.sin(a) * r)
        keepInChimney(target)
        return steamCol
      })
    },
    dispose: () => {
      air.points.geometry.dispose()
      heat.points.geometry.dispose()
      steam.points.geometry.dispose()
      ;(air.points.material as PointsMaterial).dispose()
      ;(heat.points.material as PointsMaterial).dispose()
      ;(steam.points.material as PointsMaterial).dispose()
      map.dispose()
      coolTube.geometry.dispose()
      hotTube.geometry.dispose()
      arrowGeo.dispose()
      for (const geo of intakeGeos) geo.dispose()
      pathCool.dispose()
      pathHot.dispose()
      intakeMat.dispose()
    },
  }
}
