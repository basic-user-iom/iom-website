import {
  Box3,
  Object3D,
  Vector3,
  type AnimationClip,
  type Mesh,
  type Texture,
} from 'three'

export type ClipSummary = {
  name: string
  duration: number
  trackCount: number
  affectedNodes: string[]
}

export type AssetCompatibilityReport = {
  filename: string
  byteSize: number
  checksumHint: string
  nodes: number
  meshes: number
  primitives: number
  vertices: number
  triangles: number
  materials: number
  textures: number
  maxTextureResolution: number
  estimatedDecodedTextureBytes: number
  animations: ClipSummary[]
  extensions: string[]
  doubleSidedMaterials: number
  transmissionMaterials: number
  warnings: string[]
  bounds: { x: number; y: number; z: number }
  likelyUnits: 'metres' | 'centimetres' | 'unknown'
}

/**
 * Promo junk that must not count toward vehicle bounds. `^text` catches the floor
 * "FREE 3D MODEL" caption, which otherwise sits ~45 units past the bumper and both
 * inflates the length and drags the centre off the vehicle.
 * "sketchfab" is deliberately absent — the Sketchfab wrapper root is named
 * `Sketchfab_model`, and pruning it would discard the whole car.
 */
const EXCLUDE_NAME_RE = /(discord|logo|credit|promo|watermark)|^text[._\-\d]/i

/** Container names that must never be pruned even if they match above. */
const NEVER_PRUNE = new Set([
  'Sketchfab_model',
  'root',
  'GLTF_SceneRootNode',
  'RootNode',
  'Scene',
])

export function analyzeGltfScene(input: {
  scene: Object3D
  animations: AnimationClip[]
  filename: string
  byteSize: number
  parserJson?: Record<string, unknown> | null
}): AssetCompatibilityReport {
  const warnings: string[] = []
  let nodes = 0
  let meshes = 0
  let primitives = 0
  let vertices = 0
  let triangles = 0
  const materials = new Set<unknown>()
  const textures = new Set<Texture>()
  let doubleSided = 0
  let transmission = 0
  let maxTextureResolution = 0

  input.scene.updateWorldMatrix(true, true)
  input.scene.traverse((obj) => {
    nodes += 1
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    meshes += 1
    primitives += 1
    const geo = mesh.geometry
    if (geo) {
      const pos = geo.getAttribute('position')
      if (pos) vertices += pos.count
      const index = geo.index
      if (index) triangles += index.count / 3
      else if (pos) triangles += pos.count / 3
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of mats) {
      if (!mat) continue
      materials.add(mat)
      const anyMat = mat as { side?: number; transmission?: number; map?: Texture; normalMap?: Texture; roughnessMap?: Texture; metalnessMap?: Texture; emissiveMap?: Texture; aoMap?: Texture }
      if (anyMat.side === 2) doubleSided += 1
      if (typeof anyMat.transmission === 'number' && anyMat.transmission > 0) transmission += 1
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'] as const) {
        const tex = anyMat[key]
        if (tex?.isTexture) {
          textures.add(tex)
          const img = tex.image as { width?: number; height?: number } | undefined
          const w = img?.width ?? 0
          const h = img?.height ?? 0
          maxTextureResolution = Math.max(maxTextureResolution, w, h)
        }
      }
    }
  })

  const carBounds = measureCarBounds(input.scene)
  const size = carBounds.getSize(new Vector3())
  const longest = Math.max(size.x, size.y, size.z)
  let likelyUnits: AssetCompatibilityReport['likelyUnits'] = 'unknown'
  if (longest > 20 && longest < 800) likelyUnits = 'centimetres'
  else if (longest > 1.5 && longest < 12) likelyUnits = 'metres'
  else if (longest >= 12) {
    likelyUnits = 'centimetres'
    warnings.push('Scene extents are large — treat units carefully before normalizing.')
  }

  if (input.byteSize > 80 * 1024 * 1024) {
    warnings.push('Large source asset — prefer offline optimization before client delivery (Phase 3).')
  }
  if (maxTextureResolution >= 4096) {
    warnings.push('Contains 4K+ textures — decoded GPU memory may be very high on mobile.')
  }
  if (!input.animations.length) {
    warnings.push('No animation clips detected.')
  }

  const extensions: string[] = []
  const json = input.parserJson
  if (json && typeof json === 'object') {
    const used = (json.extensionsUsed as string[] | undefined) ?? []
    extensions.push(...used)
  }

  const animations = input.animations.map((clip) => summarizeClip(clip))
  const estimatedDecodedTextureBytes = estimateDecodedTextureBytes(textures)

  return {
    filename: input.filename,
    byteSize: input.byteSize,
    checksumHint: `${input.byteSize.toString(16)}:${input.filename.length}`,
    nodes,
    meshes,
    primitives,
    vertices,
    triangles: Math.round(triangles),
    materials: materials.size,
    textures: textures.size,
    maxTextureResolution,
    estimatedDecodedTextureBytes,
    animations,
    extensions,
    doubleSidedMaterials: doubleSided,
    transmissionMaterials: transmission,
    warnings,
    bounds: { x: size.x, y: size.y, z: size.z },
    likelyUnits,
  }
}

export function summarizeClip(clip: AnimationClip): ClipSummary {
  const nodes = new Set<string>()
  for (const track of clip.tracks) {
    const name = track.name.split('.')[0]
    if (name) nodes.add(name)
  }
  return {
    name: clip.name || 'Animation',
    duration: clip.duration,
    trackCount: clip.tracks.length,
    affectedNodes: [...nodes],
  }
}

export function measureCarBounds(root: Object3D): Box3 {
  const box = new Box3()
  const temp = new Box3()
  let any = false
  root.updateWorldMatrix(true, true)

  // Object3D.traverse() cannot prune — returning early from its callback still visits the
  // children, so excluded groups leaked their meshes back into the bounds. Walk manually.
  const walk = (obj: Object3D) => {
    if (obj !== root && !NEVER_PRUNE.has(obj.name) && EXCLUDE_NAME_RE.test(obj.name)) return
    const mesh = obj as Mesh
    if (mesh.isMesh && mesh.geometry) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      if (mesh.geometry.boundingBox) {
        temp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
        if (!any) {
          box.copy(temp)
          any = true
        } else {
          box.union(temp)
        }
      }
    }
    for (const child of obj.children) walk(child)
  }
  walk(root)

  if (!any) box.setFromObject(root)
  return box
}

function estimateDecodedTextureBytes(textures: Set<Texture>): number {
  let total = 0
  for (const tex of textures) {
    const img = tex.image as { width?: number; height?: number } | undefined
    const w = img?.width ?? 0
    const h = img?.height ?? 0
    if (!w || !h) continue
    // RGBA8 + mipmaps ≈ 1.333×
    total += w * h * 4 * (4 / 3)
  }
  return Math.round(total)
}

export function formatGpuEstimate(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`
}
