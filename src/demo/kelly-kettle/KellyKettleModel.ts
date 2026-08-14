import { Group } from 'three'
import { createProceduralKettle } from './createProceduralKettle'
import { SEMANTIC_NAMES, GLB_URL, type KellyKettleModelHandle, type ModelParts, type ModelSource, type QualityLevel } from './types'
import { triangleCountOf, collectGeometriesAndMaterials, disposeTracked } from './dispose'

function mapParts(root: Group): ModelParts {
  const parts: ModelParts = {}
  root.traverse((obj) => {
    if ((SEMANTIC_NAMES as readonly string[]).includes(obj.name)) {
      parts[obj.name as keyof ModelParts] = obj
    }
  })
  if (!parts.kettle_procedural_root) parts.kettle_procedural_root = root
  return parts
}

async function loadGlb(): Promise<KellyKettleModelHandle | null> {
  try {
    const response = await fetch(GLB_URL)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    const gltf = await new Promise<{ scene: Group }>((resolve, reject) => {
      loader.parse(buffer, '', (result) => resolve(result), reject)
    })
    const group = gltf.scene
    group.name = group.name || 'kettle_procedural_root'
    const tracked = collectGeometriesAndMaterials(group)
    return {
      group,
      parts: mapParts(group),
      source: 'glb',
      triangleCount: triangleCountOf(group),
      assetBytes: buffer.byteLength,
      update: (state) => {
        const water = group.getObjectByName('water_jacket')
        if (water) water.visible = state.waterVisible && state.cutawayProgress > 0.2
        const cut = group.getObjectByName('kettle_shell_cutaway')
        if (cut) cut.visible = state.cutawayProgress < 0.92
      },
      dispose: () => disposeTracked(tracked.geos, tracked.mats),
    }
  } catch {
    return null
  }
}

export async function createKellyKettleModel(options: {
  source: ModelSource | 'auto'
  quality: QualityLevel
}): Promise<KellyKettleModelHandle> {
  if (options.source === 'glb' || options.source === 'auto') {
    const glb = await loadGlb()
    if (glb) return glb
  }
  return createProceduralKettle(options.quality)
}
