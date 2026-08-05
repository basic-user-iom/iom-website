import {
  BackSide,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { EnvironmentPresetId } from '../persistence/schema'
import type { RenderBackend } from './backend'

export type IblFamily = 'studio' | 'day' | 'golden-hour' | 'night'

export function iblFamilyForPreset(presetId: EnvironmentPresetId | string): IblFamily {
  if (presetId === 'day' || presetId === 'golden-hour' || presetId === 'night') {
    return presetId
  }
  return 'studio'
}

type PmremLike = {
  fromScene: (
    scene: Scene,
    sigma?: number,
    near?: number,
    far?: number,
  ) => { texture: Texture; dispose?: () => void }
  dispose: () => void
}

/**
 * Build and cache RoomEnvironment / tinted outdoor proxy IBLs with the
 * backend-correct PMREMGenerator (core for WebGL2, three/webgpu for WebGPU).
 */
export async function createIblCache(
  renderer: WebGLRenderer,
  backend: RenderBackend,
): Promise<{
  get: (family: IblFamily) => Texture | null
  dispose: () => void
  ok: boolean
  error: string | null
}> {
  const cache = new Map<IblFamily, Texture>()
  let pmrem: PmremLike | null = null
  let error: string | null = null

  try {
    if (backend === 'webgpu') {
      const webgpu = await import('three/webgpu')
      pmrem = new webgpu.PMREMGenerator(renderer as never) as unknown as PmremLike
    } else {
      pmrem = new PMREMGenerator(renderer) as unknown as PmremLike
    }

    const families: IblFamily[] = ['studio', 'day', 'golden-hour', 'night']
    for (const family of families) {
      const scene = buildIblSourceScene(family)
      const rt = pmrem.fromScene(scene, family === 'studio' ? 0.04 : 0.02)
      cache.set(family, rt.texture)
      disposeIblSourceScene(scene)
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    console.warn('[automotive-studio] IBL init failed', err)
    pmrem?.dispose()
    pmrem = null
  }

  return {
    ok: cache.size > 0 && !error,
    error,
    get(family) {
      return cache.get(family) ?? cache.get('studio') ?? null
    },
    dispose() {
      for (const tex of cache.values()) tex.dispose?.()
      cache.clear()
      pmrem?.dispose()
      pmrem = null
    },
  }
}

function buildIblSourceScene(family: IblFamily): Scene {
  if (family === 'studio') {
    return new RoomEnvironment() as unknown as Scene
  }

  const scene = new Scene()
  const colors = outdoorIblColors(family)
  scene.add(
    new Mesh(
      new SphereGeometry(5, 32, 16),
      new MeshBasicMaterial({ side: BackSide, color: colors.horizon }),
    ),
  )
  scene.add(
    new Mesh(
      new SphereGeometry(4.9, 24, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
      new MeshBasicMaterial({ side: BackSide, color: colors.ground }),
    ),
  )
  const sun = new Mesh(
    new SphereGeometry(0.35, 16, 16),
    new MeshBasicMaterial({ color: colors.sun }),
  )
  sun.position.copy(colors.sunPos)
  scene.add(sun)
  return scene
}

function outdoorIblColors(family: Exclude<IblFamily, 'studio'>) {
  switch (family) {
    case 'day':
      return {
        horizon: new Color(0xb8d4f0),
        ground: new Color(0x9aa8b4),
        sun: new Color(0xfff5e0),
        sunPos: new Vector3(2.2, 3.5, -1.5),
      }
    case 'golden-hour':
      return {
        horizon: new Color(0xe8a060),
        ground: new Color(0x4a382c),
        sun: new Color(0xff9030),
        sunPos: new Vector3(3.5, 1.2, -0.5),
      }
    case 'night':
      return {
        horizon: new Color(0x12182a),
        ground: new Color(0x080a10),
        sun: new Color(0xc8d4ff),
        sunPos: new Vector3(-2.5, 2.8, 1.5),
      }
  }
}

function disposeIblSourceScene(scene: Scene) {
  scene.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const mat = mesh.material
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else (mat as MeshBasicMaterial)?.dispose?.()
  })
  ;(scene as Scene & { dispose?: () => void }).dispose?.()
}
