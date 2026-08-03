import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three'
import type { EnvironmentState } from '../persistence/schema'

export interface EnvironmentHandles {
  scene: Scene
  sun: DirectionalLight
  fill: DirectionalLight
  hemi: HemisphereLight
  floor: Mesh
  pedestal: Mesh
  stars: Points
  moon: Mesh
}

function sunDirection(azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  const cosEl = Math.cos(el)
  return new Vector3(
    Math.sin(az) * cosEl,
    Math.sin(el),
    Math.cos(az) * cosEl,
  ).normalize()
}

function createStarField(): Points {
  const count = 1200
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 20
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.55 + 8
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  const material = new PointsMaterial({
    color: 0xdde6ff,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  const points = new Points(geometry, material)
  points.name = 'iom-stars'
  points.visible = false
  return points
}

function createMoon(): Mesh {
  const moon = new Mesh(
    new SphereGeometry(0.55, 24, 24),
    new MeshBasicMaterial({ color: 0xe8eef8 }),
  )
  moon.name = 'iom-moon'
  moon.visible = false
  return moon
}

export function attachEnvironmentDecor(scene: Scene): Pick<EnvironmentHandles, 'stars' | 'moon'> {
  const stars = createStarField()
  const moon = createMoon()
  scene.add(stars)
  scene.add(moon)
  return { stars, moon }
}

export function applyEnvironment(handles: EnvironmentHandles, env: EnvironmentState) {
  const dir = sunDirection(env.sunAzimuthDeg, env.sunElevationDeg)
  const sunDistance = 28
  handles.sun.position.copy(dir.clone().multiplyScalar(sunDistance))
  handles.sun.target.position.set(0, 0, 0)
  handles.sun.target.updateMatrixWorld()

  const floorMat = handles.floor.material as MeshStandardMaterial
  const pedestalMat = handles.pedestal.material as MeshStandardMaterial

  const intensity = env.environmentIntensity
  const exposure = env.exposure

  let sky = new Color(0x0c0e12)
  let ground = new Color(0x161a22)
  let pedestal = new Color(0x1c222c)
  let hemiSky = 0xb8c0cc
  let hemiGround = 0x2a303a
  let sunColor = 0xfff2e0
  let sunIntensity = 1.15 * intensity
  let fillIntensity = 0.32 * intensity
  let hemiIntensity = 0.45 * intensity
  let fogColor = sky.clone()

  switch (env.presetId === 'custom' ? inferLook(env) : env.presetId) {
    case 'day':
      sky = env.hdrBackground ? new Color(0x7eb6e8) : new Color(0x9ec8ef)
      ground = new Color(0xd5dbe3)
      pedestal = new Color(0xc8d0da)
      hemiSky = 0xd7e8ff
      hemiGround = 0xb0b8c0
      sunColor = 0xfff6e8
      sunIntensity = 1.55 * intensity
      fillIntensity = 0.4 * intensity
      hemiIntensity = 0.7 * intensity
      fogColor = new Color(0xb9d0e8)
      break
    case 'golden-hour':
      sky = env.hdrBackground ? new Color(0xc98a52) : new Color(0xd9a06a)
      ground = new Color(0x3a322c)
      pedestal = new Color(0x4a3e34)
      hemiSky = 0xffc98a
      hemiGround = 0x4a3828
      sunColor = 0xffb060
      sunIntensity = 1.35 * intensity
      fillIntensity = 0.28 * intensity
      hemiIntensity = 0.5 * intensity
      fogColor = new Color(0xc09060)
      break
    case 'night':
      sky = env.hdrBackground ? new Color(0x05070e) : new Color(0x0a0d16)
      ground = new Color(0x10131a)
      pedestal = new Color(0x151922)
      hemiSky = 0x2a3550
      hemiGround = 0x0c1018
      sunColor = 0xa8b8ff
      sunIntensity = Math.max(0.08, 0.22 * intensity)
      fillIntensity = 0.18 * intensity
      hemiIntensity = 0.28 * intensity
      fogColor = new Color(0x080b14)
      break
    case 'studio':
    default:
      sky = env.hdrBackground ? new Color(0x10141c) : new Color(0x0c0e12)
      ground = new Color(0x161a22)
      pedestal = new Color(0x1c222c)
      hemiSky = 0xb8c0cc
      hemiGround = 0x2a303a
      sunColor = 0xfff2e0
      sunIntensity = 1.15 * intensity
      fillIntensity = 0.32 * intensity
      hemiIntensity = 0.42 * intensity
      fogColor = sky.clone()
      break
  }

  handles.scene.background = sky
  if (env.fogDensity > 0.001) {
    handles.scene.fog = new Fog(fogColor, 12 / Math.max(env.fogDensity * 40, 0.2), 55)
  } else {
    handles.scene.fog = null
  }

  floorMat.color.copy(ground)
  pedestalMat.color.copy(pedestal)

  handles.sun.color.setHex(sunColor)
  handles.sun.intensity = sunIntensity * exposure
  handles.sun.visible = env.sunElevationDeg > -2 || env.presetId === 'night'

  handles.fill.intensity = fillIntensity * exposure
  handles.hemi.color.setHex(hemiSky)
  handles.hemi.groundColor.setHex(hemiGround)
  handles.hemi.intensity = hemiIntensity * exposure

  const showStars = env.starsEnabled && (env.presetId === 'night' || env.presetId === 'custom')
  handles.stars.visible = showStars
  ;(handles.stars.material as PointsMaterial).opacity = showStars ? 0.85 : 0

  const showMoon = env.moonEnabled && (env.presetId === 'night' || env.presetId === 'custom')
  handles.moon.visible = showMoon
  if (showMoon) {
    // Opposite side of the sun / high night sky
    const moonDir = sunDirection(env.sunAzimuthDeg + 160, Math.max(18, Math.abs(env.sunElevationDeg) + 22))
    handles.moon.position.copy(moonDir.multiplyScalar(36))
  }
}

function inferLook(env: EnvironmentState): EnvironmentState['presetId'] {
  if (env.starsEnabled || env.moonEnabled || env.sunElevationDeg < 5) return 'night'
  if (env.sunElevationDeg < 18) return 'golden-hour'
  if (env.sunElevationDeg > 40) return 'day'
  return 'studio'
}
