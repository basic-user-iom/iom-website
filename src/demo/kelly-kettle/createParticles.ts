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
import { CHIMNEY_TOP_R, COLORS, DEFAULT_PARTICLES, KETTLE_H, MAX_PARTICLES, SEAT_Y } from './constants'

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

function airPath() {
  return new CatmullRomCurve3([
    new Vector3(0.0, 0.024, 0.105),
    new Vector3(0.0, 0.024, 0.078),
    new Vector3(0.006, 0.02, 0.03),
    new Vector3(0.0, 0.018, 0.0),
    new Vector3(0.0, SEAT_Y + 0.02, 0.0),
    new Vector3(0.0, SEAT_Y + KETTLE_H * 0.45, 0.0),
    new Vector3(0.0, SEAT_Y + KETTLE_H * 0.92, 0.0),
    new Vector3(0.004, SEAT_Y + KETTLE_H + 0.04, 0.0),
  ])
}

function heatPath(i: number) {
  const a = (i / 8) * Math.PI * 2
  const r0 = CHIMNEY_TOP_R + 0.004
  const r1 = 0.052
  const y = SEAT_Y + 0.08 + (i % 5) * 0.022
  return new CatmullRomCurve3([
    new Vector3(Math.cos(a) * r0, y, Math.sin(a) * r0),
    new Vector3(Math.cos(a) * ((r0 + r1) * 0.5), y + 0.01, Math.sin(a) * ((r0 + r1) * 0.5)),
    new Vector3(Math.cos(a) * r1, y + 0.04, Math.sin(a) * r1),
  ])
}

const cool = new Color(COLORS.coolAir)
const hot = new Color(COLORS.hotAir)
const steamCol = new Color(0xd8e4ea)
const tmp = new Vector3()
const tmpColor = new Color()

export function createParticles(): ParticleHandle {
  const map = particleMap()
  const n = MAX_PARTICLES
  const airN = Math.floor(n * 0.45)
  const heatN = Math.floor(n * 0.32)
  const steamN = n - airN - heatN
  const air = makeCloud('educational_cool_air_particles', airN, map)
  const heat = makeCloud('educational_heat_particles', heatN, map)
  const steam = makeCloud('steam_particles', steamN, map)
  const curve = airPath()
  const heatCurves = Array.from({ length: 8 }, (_, i) => heatPath(i))

  for (let i = 0; i < airN; i++) {
    air.progress[i] = i / airN
    air.speed[i] = 0.18 + (i % 5) * 0.03
  }
  for (let i = 0; i < heatN; i++) {
    heat.progress[i] = i / heatN
    heat.speed[i] = 0.12 + (i % 4) * 0.02
  }
  for (let i = 0; i < steamN; i++) {
    steam.progress[i] = i / steamN
    steam.speed[i] = 0.1 + (i % 3) * 0.02
  }

  const pathCool = new MeshBasicMaterial({
    color: COLORS.coolAir,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  const pathHot = new MeshBasicMaterial({
    color: COLORS.hotAir,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })

  const reducedGroup = new Group()
  reducedGroup.name = 'static_flow_paths'
  const coolTube = new Mesh(new TubeGeometry(curve, 24, 0.0014, 5, false), pathCool)
  const hotCurve = new CatmullRomCurve3([
    new Vector3(0, SEAT_Y + 0.02, 0),
    new Vector3(0, SEAT_Y + KETTLE_H * 0.5, 0),
    new Vector3(0, SEAT_Y + KETTLE_H + 0.02, 0),
  ])
  const hotTube = new Mesh(new TubeGeometry(hotCurve, 16, 0.0016, 5, false), pathHot)
  const arrowGeo = new ConeGeometry(0.004, 0.012, 8)
  const a1 = new Mesh(arrowGeo, pathCool)
  a1.position.copy(curve.getPoint(0.18))
  a1.lookAt(curve.getPoint(0.28))
  a1.rotateX(Math.PI / 2)
  const a2 = new Mesh(arrowGeo, pathHot)
  a2.position.copy(hotCurve.getPoint(0.55))
  a2.lookAt(hotCurve.getPoint(0.7))
  a2.rotateX(Math.PI / 2)
  reducedGroup.add(coolTube, hotTube, a1, a2)
  reducedGroup.visible = false

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
    update: (dt, fire, heatAmt, count, reducedMotion, visible) => {
      const on = visible && fire > 0.04
      reducedGroup.visible = on && reducedMotion
      air.points.visible = on && !reducedMotion
      heat.points.visible = on && !reducedMotion && heatAmt > 0.12
      steam.points.visible = on && !reducedMotion && heatAmt > 0.72
      if (!on || reducedMotion) return

      const total = Math.max(12, Math.min(MAX_PARTICLES, count || DEFAULT_PARTICLES))
      const airUsed = Math.floor(total * 0.45)
      const heatUsed = Math.floor(total * 0.32)
      const steamUsed = Math.max(0, Math.floor((total * 0.18 * Math.max(0, heatAmt - 0.7)) / 0.3))

      for (let i = 0; i < airUsed; i++) {
        air.progress[i] = (air.progress[i] + dt * air.speed[i] * (0.6 + fire)) % 1
      }
      writeCloud(air, airUsed, (_i, p, target) => {
        curve.getPoint(p, target)
        return tmpColor.copy(cool).lerp(hot, Math.min(1, Math.max(0, (p - 0.28) / 0.4)))
      })

      for (let i = 0; i < heatUsed; i++) {
        heat.progress[i] = (heat.progress[i] + dt * heat.speed[i] * (0.5 + heatAmt)) % 1
      }
      writeCloud(heat, heatUsed, (i, p, target) => {
        heatCurves[i % heatCurves.length].getPoint(p, target)
        return tmpColor.copy(hot).lerp(cool, 0.15)
      })

      for (let i = 0; i < steamUsed; i++) {
        steam.progress[i] = (steam.progress[i] + dt * steam.speed[i]) % 1
      }
      writeCloud(steam, steamUsed, (i, p, target) => {
        const chimney = i % 2 === 0
        target.set(chimney ? (i % 5) * 0.003 : 0.09, SEAT_Y + KETTLE_H + p * 0.07, chimney ? 0 : 0.01)
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
      pathCool.dispose()
      pathHot.dispose()
    },
  }
}
