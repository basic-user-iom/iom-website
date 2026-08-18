import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'

function concatChunks(chunks: Uint8Array[], total: number): ArrayBuffer {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out.buffer
}

export function loadGltf(
  url: string,
  onProgress: (progress: number) => void,
): Promise<GLTF> {
  const loader = new GLTFLoader()

  return fetch(url).then(async (res) => {
    if (!res.ok) {
      throw new Error(res.status === 404 ? '404' : `HTTP ${res.status}`)
    }

    const declared = Number(res.headers.get('content-length')) || 0
    const reader = res.body?.getReader()
    if (!reader) {
      const buffer = await res.arrayBuffer()
      onProgress(0.96)
      return loader.parseAsync(buffer, '/models/')
    }

    const chunks: Uint8Array[] = []
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      chunks.push(value)
      loaded += value.byteLength
      if (declared > 0) onProgress(Math.min(0.92, loaded / declared))
      else onProgress(Math.min(0.9, loaded / (12 * 1024 * 1024)))
    }

    onProgress(0.94)
    return loader.parseAsync(concatChunks(chunks, loaded), '/models/')
  })
}
