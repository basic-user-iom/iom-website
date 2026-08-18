import * as THREE from 'three'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { clampSunPitch } from './lookStudio'

export type StudioEnvironment = {
  background: THREE.Texture | THREE.Color
  environment: THREE.Texture
  dispose: () => void
}

/**
 * Same assignment as webgl_loader_texture_ultrahdr / webgl_materials_cubemap_dynamic /
 * webgl_loader_gltf_transmission: one EquirectangularReflectionMapping texture on
 * both scene.environment and scene.background. App-level PMREMGenerator is not used
 * for HDRIs in r162+ — the renderer pre-filters internally.
 */
export function loadExrEnvironment(url: string): Promise<THREE.DataTexture> {
  const loader = new EXRLoader()
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping
        texture.colorSpace = THREE.LinearSRGBColorSpace
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.flipY = false
        texture.needsUpdate = true
        resolve(texture)
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    )
  })
}

export function createRoomFallback(renderer: THREE.WebGLRenderer): StudioEnvironment {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new RoomEnvironment()
  const environment = pmrem.fromScene(envScene, 0.04).texture
  envScene.dispose()
  pmrem.dispose()
  return {
    background: new THREE.Color(0x0c0c0e),
    environment,
    dispose: () => environment.dispose(),
  }
}

export function createHdrEnvironment(equirect: THREE.DataTexture): StudioEnvironment {
  equirect.mapping = THREE.EquirectangularReflectionMapping
  return {
    background: equirect,
    environment: equirect,
    dispose: () => equirect.dispose(),
  }
}

/** Yaw around world up, then pitch as elevation. Matches Scene.environmentRotation in r181. */
export const ENV_EULER_ORDER: THREE.EulerOrder = 'YXZ'

/**
 * Constant X offset applied to env, background, and the shadow sun together.
 * AmbientCG lat-long skies are Y-up (zenith at the top of the EXR). A previous
 * split (PMREM cubemap vs raw equirect) made IBL look 90° off the sky; sharing
 * one texture is the UltraHDR fix. Keep this at 0 unless a map is truly Z-up.
 */
export const ENV_POLE_X = 0

/** Sun sits a little above the HDR horizon so the key casts a readable ground shadow. */
export const SUN_HORIZON_ELEVATION = 0.32

const KEY_RADIUS = 7.2
const _sunEuler = new THREE.Euler()
const _sunMatrix = new THREE.Matrix4()
const _envSun = new THREE.Vector3()
const _worldSun = new THREE.Vector3()

export function applyEnvironmentOrientation(scene: THREE.Scene, yaw: number, pitch: number): void {
  const x = ENV_POLE_X + clampSunPitch(pitch)
  scene.environmentRotation.order = ENV_EULER_ORDER
  scene.environmentRotation.set(x, yaw, 0)
  scene.backgroundRotation.order = ENV_EULER_ORDER
  scene.backgroundRotation.set(x, yaw, 0)
}

/**
 * World-space direction toward the HDR sun. Uses the same Euler as
 * environmentRotation, including the WebGLMaterials left-handed axis flip
 * (`x/y/z *= -1` before makeRotationFromEuler), then inverts so the
 * DirectionalLight sits where the bright region of the map appears.
 */
export function hdrSunDirection(yaw: number, pitch: number, target = _worldSun): THREE.Vector3 {
  _sunEuler.order = ENV_EULER_ORDER
  _sunEuler.set(ENV_POLE_X + clampSunPitch(pitch), yaw, 0)
  _sunEuler.x *= -1
  _sunEuler.y *= -1
  _sunEuler.z *= -1
  _sunMatrix.makeRotationFromEuler(_sunEuler).invert()
  _envSun.set(0, Math.sin(SUN_HORIZON_ELEVATION), Math.cos(SUN_HORIZON_ELEVATION))
  return target.copy(_envSun).applyMatrix4(_sunMatrix).normalize()
}

/** webgl_shadowmap pattern: one DirectionalLight is the only shadow caster. */
export function aimHdrSunLight(
  light: THREE.DirectionalLight,
  yaw: number,
  pitch: number,
  targetY = 0.35,
): void {
  hdrSunDirection(yaw, pitch, _worldSun)
  light.position.copy(_worldSun).multiplyScalar(KEY_RADIUS)
  if (light.position.y < 1.15) light.position.y = 1.15
  light.target.position.set(0, targetY, 0)
  light.target.updateMatrixWorld()
  light.shadow.camera.near = 0.8
  light.shadow.camera.far = KEY_RADIUS + 18
  light.shadow.camera.updateProjectionMatrix()
}

export function applyStudioEnvironment(
  scene: THREE.Scene,
  env: StudioEnvironment,
  opts?: {
    backgroundIntensity?: number
    backgroundBlurriness?: number
    environmentIntensity?: number
    yaw?: number
    pitch?: number
  },
): void {
  scene.environment = env.environment
  scene.background = env.background
  scene.environmentIntensity = opts?.environmentIntensity ?? 1.28
  applyEnvironmentOrientation(scene, opts?.yaw ?? 1.05, opts?.pitch ?? 0)
  if (env.background instanceof THREE.Texture) {
    scene.backgroundIntensity = opts?.backgroundIntensity ?? 0.72
    scene.backgroundBlurriness = opts?.backgroundBlurriness ?? 0.05
    scene.fog = null
  }
}
