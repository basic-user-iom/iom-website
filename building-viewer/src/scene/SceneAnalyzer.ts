import {
  Mesh,
  SkinnedMesh,
  InstancedMesh,
  BatchedMesh,
  Light,
  Camera,
  Bone,
  Texture,
  Material,
  DoubleSide,
  UnsignedByteType,
  type Object3D,
  type Texture as ThreeTexture,
  type BufferGeometry,
} from 'three'
import type { SceneBounds } from './SceneBounds'

export type TextureStat = {
  name: string
  uuid: string
  width: number
  height: number
  format: string
  colorSpace: string
  mipmaps: boolean
  compressed: boolean
  gpuBytesKnown: boolean
  estimatedGpuBytes: number
  /** Material slots / UV-transform clones sharing this GPU image. */
  slots: number
}

export type MaterialTypeCount = Record<string, number>

export type StaticSceneStats = {
  objects: number
  meshes: number
  skinnedMeshes: number
  instancedMeshes: number
  batchedMeshes: number
  vertices: number
  triangles: number
  drawnTriangles: number
  geometryCount: number
  primitiveCount: number
  uniqueMaterials: number
  materialTypes: MaterialTypeCount
  doubleSidedMaterials: number
  transparentMaterials: number
  transmissionMaterials: number
  missingUv0: number
  uv0OutOfRange: number
  uniqueTextures: number
  /** Texture objects on materials (GLTF clones one per slot / UV transform). */
  textureSlots: number
  totalTextureRefs: number
  textures: TextureStat[]
  totalTexels: number
  textureGpuUnknown: number
  estimatedTextureGpuBytes: number
  estimatedGeometryBytes: number
  lights: number
  cameras: number
  animations: number
  bones: number
  dimensions: { x: number; y: number; z: number }
  boundingVolume: number
  fileSizeBytes: number | null
  transferredBytes: number | null
  downloadMs: number
  parseMs: number
  collisionMs: number | null
  warnings: string[]
  /** Runtime procedural instancing results (repeating meshes → InstancedMesh / BatchedMesh). */
  instancing: {
    groupsConverted: number
    meshesReplaced: number
    drawCallsSaved: number
    instancesCreated?: number
    batchedMeshes?: number
    batchedSources?: number
    note: string
    topGroups: { name: string; count: number; triangles: number; submittedTriangles?: number; kind?: string }[]
  } | null
}

type TextureSource = { uuid?: string }

function textureSourceKey(tex: ThreeTexture): string {
  const source = (tex as ThreeTexture & { source?: TextureSource }).source
  return source?.uuid || tex.uuid
}

function mipmapBytes(tex: ThreeTexture): number {
  const mips = tex.mipmaps as { data?: ArrayBufferView }[] | undefined
  if (!mips?.length) return 0
  let bytes = 0
  for (const mip of mips) {
    bytes += mip.data?.byteLength ?? 0
  }
  return bytes
}

function estimateUncompressedRgba(width: number, height: number, withMips: boolean): number {
  if (width <= 0 || height <= 0) return 0
  const base = width * height * 4
  return withMips ? Math.floor(base * 1.333) : base
}

function estimateTextureBytes(tex: ThreeTexture): {
  width: number
  height: number
  mipmaps: boolean
  compressed: boolean
  format: string
  colorSpace: string
  bytes: number
  known: boolean
} {
  const image = tex.image as { width?: number; height?: number; data?: ArrayBufferView } | undefined
  const width = image?.width ?? 0
  const height = image?.height ?? 0
  const hasEmbeddedMips = (tex.mipmaps?.length ?? 0) > 1
  const mipmaps = hasEmbeddedMips || tex.generateMipmaps
  const compressed = Boolean((tex as ThreeTexture & { isCompressedTexture?: boolean }).isCompressedTexture)
  const format = compressed ? 'compressed' : String(tex.format)
  const colorSpace = String(tex.colorSpace ?? 'unknown')
  const packed = mipmapBytes(tex)

  let bytes = 0
  let known = false
  if (compressed && packed > 0) {
    bytes = packed
    known = true
  } else if (compressed && image && 'data' in image && image.data) {
    bytes = image.data.byteLength
    known = true
  } else if (!compressed && tex.type === UnsignedByteType && width > 0 && height > 0) {
    // Three.js uploads UnsignedByte images as RGBA8; mip chain is generated when enabled.
    bytes = estimateUncompressedRgba(width, height, mipmaps)
    known = true
  }
  return { width, height, mipmaps, compressed, format, colorSpace, bytes, known }
}

function geometryTriangleCount(geom: BufferGeometry): number {
  const index = geom.getIndex()
  if (index) return index.count / 3
  const pos = geom.getAttribute('position')
  return pos ? pos.count / 3 : 0
}

function materialTypeName(mat: Material): string {
  return mat.type || mat.constructor?.name || 'Material'
}

export function analyzeScene(
  root: Object3D,
  bounds: SceneBounds,
  meta: {
    fileSizeBytes: number | null
    transferredBytes: number | null
    downloadMs: number
    parseMs: number
    collisionMs?: number | null
    animations?: number
    instancing?: {
      groupsConverted: number
      meshesReplaced: number
      drawCallsSaved: number
      instancesCreated?: number
      batchedMeshes?: number
      batchedSources?: number
      note: string
      topGroups: { name: string; count: number; triangles: number; submittedTriangles?: number; kind?: string }[]
    } | null
  },
): StaticSceneStats {
  let objects = 0
  let meshes = 0
  let skinnedMeshes = 0
  let instancedMeshes = 0
  let batchedMeshCount = 0
  let vertices = 0
  let triangles = 0
  let drawnTriangles = 0
  let primitiveCount = 0
  let geometryCount = 0
  let lights = 0
  let cameras = 0
  let bones = 0
  let totalTextureRefs = 0
  let doubleSidedMaterials = 0
  let transparentMaterials = 0
  let transmissionMaterials = 0
  let missingUv0 = 0
  let uv0OutOfRange = 0
  let estimatedGeometryBytes = 0

  const materials = new Map<string, Material>()
  const materialTypes: MaterialTypeCount = {}
  const textures = new Map<string, TextureStat>()
  const geometryIds = new Set<string>()
  const uvChecked = new Set<string>()

  root.traverse((obj) => {
    objects += 1
    if ((obj as Light).isLight) lights += 1
    if ((obj as Camera).isCamera) cameras += 1
    if (obj instanceof Bone) bones += 1

    if (obj instanceof Mesh || obj instanceof SkinnedMesh) {
      const instanced = obj instanceof InstancedMesh
      const batched = obj instanceof BatchedMesh
      if (obj instanceof SkinnedMesh) skinnedMeshes += 1
      else if (instanced) instancedMeshes += 1
      else if (batched) batchedMeshCount += 1
      else meshes += 1

      const geom = obj.geometry
      if (geom) {
        primitiveCount += 1
        const geomTris = geometryTriangleCount(geom)
        const copies = instanced ? Math.max(1, obj.count) : 1
        drawnTriangles += geomTris * copies

        if (!geometryIds.has(geom.uuid)) {
          geometryIds.add(geom.uuid)
          geometryCount += 1
          triangles += geomTris
          const pos = geom.getAttribute('position')
          if (pos) {
            vertices += pos.count
            estimatedGeometryBytes += pos.array.byteLength
          }
          const index = geom.getIndex()
          if (index) estimatedGeometryBytes += index.array.byteLength
          for (const name of Object.keys(geom.attributes)) {
            if (name === 'position') continue
            const attr = geom.getAttribute(name)
            if (attr?.array) estimatedGeometryBytes += attr.array.byteLength
          }
          if (instanced) {
            const im = obj as InstancedMesh
            if (im.instanceMatrix?.array) estimatedGeometryBytes += im.instanceMatrix.array.byteLength
            if (im.instanceColor?.array) estimatedGeometryBytes += im.instanceColor.array.byteLength
          }
        }

        const matsForUv = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
        const textured = matsForUv.some((m) => Boolean(m && (m as Material & { map?: unknown }).map))
        const uv = geom.getAttribute('uv')
        if (textured && !uv) missingUv0 += 1
        if (uv && !uvChecked.has(geom.uuid)) {
          uvChecked.add(geom.uuid)
          const arr = uv.array
          const stride = uv.itemSize || 2
          for (let i = 0; i + 1 < arr.length; i += stride) {
            const u = arr[i]!
            const v = arr[i + 1]!
            if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) {
              uv0OutOfRange += 1
              break
            }
          }
        }
      }

      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
      for (const mat of mats) {
        if (!mat) continue
        if (!materials.has(mat.uuid)) {
          materials.set(mat.uuid, mat)
          const type = materialTypeName(mat)
          materialTypes[type] = (materialTypes[type] ?? 0) + 1
          if (mat.side === DoubleSide) doubleSidedMaterials += 1
          if (mat.transparent || mat.opacity < 1) transparentMaterials += 1
          if (((mat as Material & { transmission?: number }).transmission ?? 0) > 0.01) {
            transmissionMaterials += 1
          }
        }
        for (const key of Object.keys(mat)) {
          const value = (mat as Material & Record<string, unknown>)[key]
          if (value && typeof value === 'object' && (value as Texture).isTexture) {
            totalTextureRefs += 1
            const tex = value as Texture
            const sourceKey = textureSourceKey(tex)
            const existing = textures.get(sourceKey)
            if (existing) {
              existing.slots += 1
              continue
            }
            const est = estimateTextureBytes(tex)
            textures.set(sourceKey, {
              name: tex.name || key || tex.uuid.slice(0, 8),
              uuid: sourceKey,
              width: est.width,
              height: est.height,
              format: est.format,
              colorSpace: est.colorSpace,
              mipmaps: est.mipmaps,
              compressed: est.compressed,
              gpuBytesKnown: est.known,
              estimatedGpuBytes: est.known ? est.bytes : 0,
              slots: 1,
            })
          }
        }
      }
    }
  })

  const textureList = [...textures.values()].sort((a, b) => b.estimatedGpuBytes - a.estimatedGpuBytes)
  const estimatedTextureGpuBytes = textureList.reduce(
    (s, t) => s + (t.gpuBytesKnown ? t.estimatedGpuBytes : 0),
    0,
  )
  const textureSlots = textureList.reduce((s, t) => s + t.slots, 0)
  const textureGpuUnknown = textureList.filter((t) => !t.gpuBytesKnown).length
  const totalTexels = textureList.reduce((s, t) => s + t.width * t.height, 0)
  const tri = Math.round(triangles)
  const drawn = Math.round(drawnTriangles)

  return {
    objects,
    meshes,
    skinnedMeshes,
    instancedMeshes,
    batchedMeshes: batchedMeshCount,
    vertices: Math.round(vertices),
    triangles: tri,
    drawnTriangles: drawn,
    geometryCount,
    primitiveCount,
    uniqueMaterials: materials.size,
    materialTypes,
    doubleSidedMaterials,
    transparentMaterials,
    transmissionMaterials,
    missingUv0,
    uv0OutOfRange,
    uniqueTextures: textureList.length,
    textureSlots,
    totalTextureRefs,
    textures: textureList,
    totalTexels,
    textureGpuUnknown,
    estimatedTextureGpuBytes,
    estimatedGeometryBytes,
    lights,
    cameras,
    animations: meta.animations ?? 0,
    bones,
    dimensions: { x: bounds.size.x, y: bounds.size.y, z: bounds.size.z },
    boundingVolume: bounds.size.x * bounds.size.y * bounds.size.z,
    fileSizeBytes: meta.fileSizeBytes,
    transferredBytes: meta.transferredBytes,
    downloadMs: meta.downloadMs,
    parseMs: meta.parseMs,
    collisionMs: meta.collisionMs ?? null,
    warnings: [],
    instancing: meta.instancing
      ? {
          groupsConverted: meta.instancing.groupsConverted,
          meshesReplaced: meta.instancing.meshesReplaced,
          drawCallsSaved: meta.instancing.drawCallsSaved,
          instancesCreated: meta.instancing.instancesCreated,
          batchedMeshes: meta.instancing.batchedMeshes,
          batchedSources: meta.instancing.batchedSources,
          note: meta.instancing.note,
          topGroups: meta.instancing.topGroups,
        }
      : null,
  }
}
