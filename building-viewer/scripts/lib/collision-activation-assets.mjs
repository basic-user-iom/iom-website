import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'meshoptimizer'

export async function inspectPinnedFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  const info = await stat(path)
  if (!info.isFile() || info.size < 1) throw new Error(`Pinned asset is not a non-empty file: ${path}`)
  return { sha256: hash.digest('hex'), bytes: info.size }
}

export async function readPinnedJson(path) {
  const bytes = await readFile(path)
  let value
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${path}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return {
    value,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  }
}

/** Load exact local GLB bytes through the same Three.js meshopt decode path used in-browser. */
export async function loadCollisionGlbRoot(path) {
  const bytes = await readFile(path)
  await MeshoptDecoder.ready
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const gltf = await loader.parseAsync(arrayBuffer, '')
  return gltf.scene
}

export function disposeLoadedRoot(root) {
  root.traverse((object) => {
    if (!object.isMesh) return
    object.geometry?.dispose?.()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) material?.dispose?.()
  })
}
