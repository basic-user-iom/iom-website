import { LoadingManager, type WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import type { LoadedGltf } from './disposeObject'

export type ImportProgress = {
  loaded: number
  total: number
  ratio: number
}

export type ImportGlbOptions = {
  onProgress?: (progress: ImportProgress) => void
  signal?: AbortSignal
  /** Used to detect KTX2 GPU format support (WebGL or WebGPU renderer). */
  renderer?: WebGLRenderer | null
}

let sharedKtx2: KTX2Loader | null = null
let sharedKtx2Renderer: WebGLRenderer | null = null

/**
 * Version 1 production format: self-contained GLB only.
 * Multi-file glTF / FBX are deferred (see plan §10.2).
 */
export async function importGlbFile(
  file: File,
  options: ImportGlbOptions = {},
): Promise<{ gltf: LoadedGltf; objectUrl: string; byteSize: number; filename: string }> {
  assertGlbFile(file)

  // Prefer ArrayBuffer parse over blob: URLs — LoadingManager errors on blob paths
  // are opaque, and embedded WebP decode failures were masked as "Failed to load GLB resource".
  const buffer = await file.arrayBuffer()
  options.onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength, ratio: 0.35 })

  const objectUrl = URL.createObjectURL(file)
  try {
    const gltf = await parseGlbArrayBuffer(buffer, options)
    options.onProgress?.({ loaded: buffer.byteLength, total: buffer.byteLength, ratio: 1 })
    return {
      gltf,
      objectUrl,
      byteSize: file.size,
      filename: file.name,
    }
  } catch (err) {
    URL.revokeObjectURL(objectUrl)
    throw err
  }
}

export function assertGlbFile(file: File) {
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.glb')) {
    throw new Error(
      'Only self-contained .glb is supported in Phase 2. Multi-file .gltf and FBX are deferred.',
    )
  }
  if (file.size <= 0) throw new Error('Empty file')
}

export function createConfiguredGltfLoader(manager?: LoadingManager): GLTFLoader {
  return new GLTFLoader(manager)
}

export async function enableMeshopt(loader: GLTFLoader): Promise<void> {
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js')
  await MeshoptDecoder.ready
  loader.setMeshoptDecoder(MeshoptDecoder)
}

/**
 * Self-hosted Basis transcoder under `/demos/automotive-studio/basis/`.
 * Safe to call repeatedly; reuses one KTX2Loader per renderer instance.
 */
export async function enableKtx2(loader: GLTFLoader, renderer: WebGLRenderer): Promise<void> {
  try {
    if (!sharedKtx2 || sharedKtx2Renderer !== renderer) {
      sharedKtx2?.dispose()
      const ktx2 = new KTX2Loader()
      const base = import.meta.env.BASE_URL || '/'
      ktx2.setTranscoderPath(`${base}basis/`)
      ktx2.detectSupport(renderer)
      sharedKtx2 = ktx2
      sharedKtx2Renderer = renderer
    }
    loader.setKTX2Loader(sharedKtx2)
  } catch (err) {
    console.warn('[automotive-studio] KTX2 loader init failed; KTX2 textures will not decode.', err)
  }
}

export async function configureGltfLoader(
  loader: GLTFLoader,
  options: { renderer?: WebGLRenderer | null } = {},
): Promise<void> {
  await enableMeshopt(loader)
  if (options.renderer) await enableKtx2(loader, options.renderer)
}

function formatLoadError(err: unknown): Error {
  if (err instanceof Error) {
    const msg = err.message || String(err)
    if (/webp|texture|image/i.test(msg)) {
      return new Error(
        `${msg} — optimized GLB textures may be corrupt; re-run npm run optimize:automotive.`,
      )
    }
    return err
  }
  if (typeof err === 'string') return new Error(err)
  return new Error(`GLB load failed: ${String(err)}`)
}

export function parseGlbArrayBuffer(
  data: ArrayBuffer,
  options: ImportGlbOptions = {},
): Promise<LoadedGltf> {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      reject(formatLoadError(err))
    }
    const ok = (gltf: LoadedGltf) => {
      if (settled) return
      settled = true
      resolve(gltf)
    }

    if (options.signal?.aborted) {
      fail(new DOMException('Import aborted', 'AbortError'))
      return
    }
    options.signal?.addEventListener(
      'abort',
      () => fail(new DOMException('Import aborted', 'AbortError')),
      { once: true },
    )

    void (async () => {
      try {
        const manager = new LoadingManager()
        // Do not reject solely on manager path strings — keep the real Error from parse().
        manager.onError = (url) => {
          console.warn('[automotive-studio] GLB subresource error:', url)
        }
        const loader = createConfiguredGltfLoader(manager)
        await configureGltfLoader(loader, { renderer: options.renderer })
        loader.parse(
          data,
          '',
          (gltf) => {
            ok({
              scene: gltf.scene,
              animations: gltf.animations ?? [],
              parser: gltf.parser as { json?: unknown },
            })
          },
          (err) => fail(err),
        )
      } catch (err) {
        fail(err)
      }
    })()
  })
}

/** @deprecated Prefer parseGlbArrayBuffer for File imports; kept for URL loads. */
export function loadGlbUrl(
  url: string,
  options: ImportGlbOptions = {},
): Promise<LoadedGltf> {
  return new Promise((resolve, reject) => {
    const manager = new LoadingManager()
    let settled = false

    const fail = (err: unknown) => {
      if (settled) return
      settled = true
      reject(formatLoadError(err))
    }

    const ok = (gltf: LoadedGltf) => {
      if (settled) return
      settled = true
      resolve(gltf)
    }

    if (options.signal) {
      if (options.signal.aborted) {
        fail(new DOMException('Import aborted', 'AbortError'))
        return
      }
      options.signal.addEventListener(
        'abort',
        () => fail(new DOMException('Import aborted', 'AbortError')),
        { once: true },
      )
    }

    manager.onError = (path) => fail(new Error(`Failed to load GLB resource: ${path}`))

    void (async () => {
      try {
        const loader = createConfiguredGltfLoader(manager)
        await configureGltfLoader(loader, { renderer: options.renderer })
        loader.load(
          url,
          (gltf) => {
            ok({
              scene: gltf.scene,
              animations: gltf.animations ?? [],
              parser: gltf.parser as { json?: unknown },
            })
          },
          (event) => {
            const total = event.total || 0
            const loaded = event.loaded || 0
            options.onProgress?.({
              loaded,
              total,
              ratio: total > 0 ? loaded / total : 0,
            })
          },
          (err) => fail(err),
        )
      } catch (err) {
        fail(err)
      }
    })()
  })
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}
