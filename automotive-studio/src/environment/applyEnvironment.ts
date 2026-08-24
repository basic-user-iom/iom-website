import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  Scene,
} from 'three'
import type { EnvironmentState } from '../persistence/schema'
import {
  createCelestialLayer,
  directionFromAzEl,
  type CelestialHandles,
} from './celestialLayer'

export interface EnvironmentHandles {
  scene: Scene
  sun: DirectionalLight
  fill: DirectionalLight
  rim: DirectionalLight
  hemi: HemisphereLight
  ambient: AmbientLight
  floor: Mesh
  pedestal: Mesh
  celestial: CelestialHandles
  /** @deprecated use celestial.skyDome */
  skyDome: Mesh
  stars: CelestialHandles['stars']
  moon: Mesh
  sunDisc: Group
}

type PresetLook = {
  skyTop: Color
  skyHorizon: Color
  skyGround: Color
  ground: Color
  pedestal: Color
  hemiSky: number
  hemiGround: number
  sunColor: number
  fillColor: number
  rimColor: number
  sunIntensity: number
  fillIntensity: number
  rimIntensity: number
  hemiIntensity: number
  ambientIntensity: number
  fogColor: Color
  floorMetal: number
  floorRough: number
  pedestalMetal: number
  pedestalRough: number
}

export function attachEnvironmentDecor(scene: Scene): CelestialHandles {
  return createCelestialLayer(scene)
}

function lookForPreset(presetId: Exclude<EnvironmentState['presetId'], 'custom'>): PresetLook {
  switch (presetId) {
    case 'day':
      return {
        skyTop: new Color(0x4a90d8),
        skyHorizon: new Color(0xb8d4ec),
        skyGround: new Color(0x9aacbc),
        ground: new Color(0xe4e9ef),
        pedestal: new Color(0xd0d7e0),
        hemiSky: 0xe8f2ff,
        hemiGround: 0xa8b0b8,
        sunColor: 0xfff8ee,
        fillColor: 0xb8d0ff,
        rimColor: 0xe8f0ff,
        sunIntensity: 1.85,
        fillIntensity: 0.48,
        rimIntensity: 0.35,
        hemiIntensity: 0.85,
        ambientIntensity: 0.18,
        fogColor: new Color(0xb8d0e8),
        floorMetal: 0.08,
        floorRough: 0.78,
        pedestalMetal: 0.12,
        pedestalRough: 0.62,
      }
    case 'golden-hour':
      return {
        skyTop: new Color(0x3a4a78),
        skyHorizon: new Color(0xe8a060),
        skyGround: new Color(0x4a382c),
        ground: new Color(0x4a4038),
        pedestal: new Color(0x564840),
        hemiSky: 0xffc898,
        hemiGround: 0x4a3020,
        sunColor: 0xffa040,
        fillColor: 0x6080c0,
        rimColor: 0xffd0a0,
        sunIntensity: 1.65,
        fillIntensity: 0.3,
        rimIntensity: 0.45,
        hemiIntensity: 0.55,
        ambientIntensity: 0.12,
        fogColor: new Color(0xc09060),
        floorMetal: 0.12,
        floorRough: 0.7,
        pedestalMetal: 0.18,
        pedestalRough: 0.55,
      }
    case 'night':
      return {
        skyTop: new Color(0x050814),
        skyHorizon: new Color(0x12182a),
        skyGround: new Color(0x080a10),
        ground: new Color(0x1a1e28),
        pedestal: new Color(0x222833),
        hemiSky: 0x2a3558,
        hemiGround: 0x0c1018,
        sunColor: 0xc8d4ff,
        fillColor: 0x4060a0,
        rimColor: 0x7090d0,
        sunIntensity: 0.55,
        fillIntensity: 0.22,
        rimIntensity: 0.2,
        hemiIntensity: 0.32,
        ambientIntensity: 0.08,
        fogColor: new Color(0x080b14),
        floorMetal: 0.18,
        floorRough: 0.62,
        pedestalMetal: 0.22,
        pedestalRough: 0.5,
      }
    case 'studio':
    default:
      return {
        skyTop: new Color(0x182030),
        skyHorizon: new Color(0x4a5568),
        skyGround: new Color(0x1a2030),
        ground: new Color(0x2a303c),
        pedestal: new Color(0x343b48),
        hemiSky: 0xc8d0dc,
        hemiGround: 0x2a303a,
        sunColor: 0xfff6e8,
        fillColor: 0xa8c0ff,
        rimColor: 0xe8dcc8,
        sunIntensity: 1.35,
        fillIntensity: 0.38,
        rimIntensity: 0.42,
        hemiIntensity: 0.5,
        ambientIntensity: 0.14,
        fogColor: new Color(0x3a4558),
        floorMetal: 0.16,
        floorRough: 0.62,
        pedestalMetal: 0.22,
        pedestalRough: 0.5,
      }
  }
}

/** Visual family for lighting / IBL / stage — never guessed from a single slider. */
export function resolveVisualPreset(
  env: EnvironmentState,
): Exclude<EnvironmentState['presetId'], 'custom'> {
  if (env.presetId !== 'custom') return env.presetId
  return env.basePresetId ?? 'studio'
}

/** Exterior presets open the horizon; studio keeps the cyclorama wall. */
export function stagePolicyForPreset(
  presetId: Exclude<EnvironmentState['presetId'], 'custom'>,
): { cycloramaVisible: boolean; contactOpacity: number } {
  if (presetId === 'studio') {
    return { cycloramaVisible: true, contactOpacity: 0.8 }
  }
  return {
    cycloramaVisible: false,
    contactOpacity: presetId === 'night' ? 0.45 : presetId === 'day' ? 0.55 : 0.65,
  }
}

const _bgColor = new Color()
const _hazeColor = new Color()

function minimumAtmosphericFog(
  env: EnvironmentState,
  visualPreset: Exclude<EnvironmentState['presetId'], 'custom'>,
): number {
  if (!env.hdrBackground) return env.fogDensity
  if (env.fogDensity > 0.001) return env.fogDensity
  switch (visualPreset) {
    case 'night':
      return 0.012
    case 'golden-hour':
      return 0.008
    case 'day':
      return 0.006
    case 'studio':
    default:
      return 0.004
  }
}

function elevHorizonFade(elevationDeg: number): number {
  // Soft fade near the horizon — grazing directional shadows are GPU-expensive.
  const t = Math.max(0, Math.min(1, (elevationDeg - 1) / 7))
  return t * t * (3 - 2 * t)
}

export function applyEnvironment(handles: EnvironmentHandles, env: EnvironmentState) {
  const visualPreset = resolveVisualPreset(env)
  const look = lookForPreset(visualPreset)

  const moonElRaw = env.moonElevationDeg ?? 0
  const sunElRaw = env.sunElevationDeg
  const useMoonKey = Boolean(env.moonAsKeyLight) && Boolean(env.moonEnabled)
  const moonKeyFade = useMoonKey ? elevHorizonFade(moonElRaw) : 0
  const useSunKey = !useMoonKey && env.sunEnabled !== false
  const sunKeyFade = useSunKey ? elevHorizonFade(sunElRaw) : 0

  const keyAz = useMoonKey ? (env.moonAzimuthDeg ?? env.sunAzimuthDeg) : env.sunAzimuthDeg
  // Aim the key light from a safe elevation so grazing / below-horizon angles
  // never stretch the shadow frustum across the whole stage.
  const keyElRaw = useMoonKey ? moonElRaw : sunElRaw
  const keyEl = Math.max(8, keyElRaw)
  const dir = directionFromAzEl(keyAz, keyEl)
  const sunDistance = 36
  handles.sun.position.copy(dir).multiplyScalar(sunDistance)
  handles.sun.target.position.set(0, 0.4, 0)
  handles.sun.target.updateMatrixWorld()

  const fillDir = directionFromAzEl(keyAz + 160, Math.max(8, keyEl * 0.35))
  handles.fill.position.copy(fillDir).multiplyScalar(24)

  const rimDir = directionFromAzEl(keyAz - 95, Math.max(6, keyEl * 0.25 + 10))
  handles.rim.position.copy(rimDir).multiplyScalar(22)

  _bgColor.copy(look.skyHorizon)
  handles.scene.background = _bgColor

  const effectiveFogDensity = minimumAtmosphericFog(env, visualPreset)
  const wantFog = effectiveFogDensity > 0.001
  const fogFar = wantFog
    ? visualPreset === 'night' || env.starsEnabled
      ? 280
      : visualPreset === 'studio'
        ? 140
        : 90
    : 8000
  const fogNear = wantFog ? 18 / Math.max(effectiveFogDensity * 40, 0.2) : 7000
  if (handles.scene.fog instanceof Fog) {
    handles.scene.fog.color.copy(look.fogColor)
    handles.scene.fog.near = fogNear
    handles.scene.fog.far = fogFar
  } else {
    handles.scene.fog = new Fog(look.fogColor.getHex(), fogNear, fogFar)
  }

  const sunGain = Math.max(0, Math.min(2, env.sunIntensity ?? 1))
  const moonGain = Math.max(0, Math.min(3, env.moonIntensity ?? 1))

  // Keep castShadow sticky while the key source is selected so dragging across
  // the horizon fade does not allocate/destroy the shadow map every few degrees.
  if (useMoonKey) {
    const lit = moonKeyFade > 0.02
    handles.sun.color.setHex(0xc8d4ff)
    handles.sun.intensity = 0.55 * moonGain * moonKeyFade
    handles.sun.visible = lit
    handles.sun.castShadow = lit
  } else if (useSunKey) {
    const lit = sunKeyFade > 0.02
    handles.sun.color.setHex(look.sunColor)
    handles.sun.intensity = look.sunIntensity * sunGain * sunKeyFade
    handles.sun.visible = lit
    handles.sun.castShadow = lit
  } else {
    handles.sun.color.setHex(look.sunColor)
    handles.sun.intensity = 0
    handles.sun.visible = false
    handles.sun.castShadow = false
  }

  // Exterior / free-drive day must read as a single sun key — studio fill+rim
  // directionals otherwise look like three separate suns (and fill also casts).
  const exteriorSingleKey = visualPreset !== 'studio'
  if (exteriorSingleKey) {
    handles.fill.intensity = 0
    handles.fill.visible = false
    handles.fill.castShadow = false
    handles.rim.intensity = 0
    handles.rim.visible = false
  } else {
    handles.fill.color.setHex(look.fillColor)
    handles.fill.intensity = look.fillIntensity
    handles.fill.visible = true
    handles.fill.castShadow = true
    handles.rim.color.setHex(look.rimColor)
    handles.rim.intensity = look.rimIntensity
    handles.rim.visible = true
  }

  handles.hemi.color.setHex(look.hemiSky)
  handles.hemi.groundColor.setHex(look.hemiGround)
  // Slight hemi lift outdoors so losing fill/rim does not crush shadow side.
  handles.hemi.intensity = exteriorSingleKey
    ? look.hemiIntensity * (visualPreset === 'day' ? 1.18 : visualPreset === 'golden-hour' ? 1.12 : 1.08)
    : look.hemiIntensity

  handles.ambient.color.setHex(look.hemiSky)
  handles.ambient.intensity = exteriorSingleKey
    ? look.ambientIntensity * 1.15
    : look.ambientIntensity

  handles.celestial.apply(env, {
    top: look.skyTop,
    horizon: look.skyHorizon,
    ground: look.skyGround,
    softSky: Boolean(env.hdrBackground),
    sunColor: look.sunColor,
    hazeColor: _hazeColor.copy(look.fogColor).lerp(look.skyHorizon, 0.55),
  })
}

export { directionFromAzEl }
