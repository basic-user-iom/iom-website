import {
  LoadingManager,
  Group,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { WebGLRenderer } from 'three'
import type { LoadProgress, ModelLoadResult } from './types'

const DRACO_DECODER_PATH = '/draco/gltf/'
const KTX2_TRANSCODER_PATH = '/basis/'

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0)
    })
  })
}

function mergeByteChunks(chunks: Uint8Array[], totalLength: number): ArrayBuffer {
  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out.buffer
}

async function probeContentLength(url: string): Promise<number | null> {
  // Optional — some CDNs omit Content-Length on GET; HEAD can help progress UI.
  // Skip by default (extra RTT). Enable with ?probeSize=1.
  try {
    if (typeof location !== 'undefined') {
      const flag = new URLSearchParams(location.search).get('probeSize')
      if (flag !== '1' && flag !== 'true') return null
    }
  } catch {
    return null
  }
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (!res.ok) return null
    const len = res.headers.get('content-length')
    const n = len ? Number(len) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export class ModelLoader {
  private readonly gltf: GLTFLoader
  private readonly draco: DRACOLoader
  private readonly ktx2: KTX2Loader
  private ktx2Ready = false

  constructor(private readonly getRenderer: () => WebGLRenderer | null) {
    const manager = new LoadingManager()
    this.gltf = new GLTFLoader(manager)
    this.draco = new DRACOLoader()
    this.draco.setDecoderPath(DRACO_DECODER_PATH)
    this.ktx2 = new KTX2Loader()
    this.ktx2.setTranscoderPath(KTX2_TRANSCODER_PATH)
    this.gltf.setDRACOLoader(this.draco)
    this.gltf.setMeshoptDecoder(MeshoptDecoder)
  }

  private ensureKtx2(): void {
    if (this.ktx2Ready) return
    const renderer = this.getRenderer()
    if (!renderer) return
    this.ktx2.detectSupport(renderer)
    this.gltf.setKTX2Loader(this.ktx2)
    this.ktx2Ready = true
  }

  private reportDownloadProgress(
    loaded: number,
    total: number,
    onProgress?: (p: LoadProgress) => void,
  ): void {
    if (total > 0) {
      const ratio = Math.min(1, loaded / total)
      const loadedMb = loaded / (1024 * 1024)
      const totalMb = total / (1024 * 1024)
      onProgress?.({
        stage: 'download',
        ratio,
        message: `Loading model… ${loadedMb.toFixed(1)} / ${totalMb.toFixed(0)} MB`,
      })
      return
    }
    onProgress?.({
      stage: 'download',
      ratio: null,
      message: `Loading model… ${Math.round(loaded / (1024 * 1024))} MB`,
    })
  }

  private async downloadArrayBuffer(
    url: string,
    probedTotal: number | null,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<{ buffer: ArrayBuffer; transferredBytes: number; fileSizeBytes: number | null }> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Model HTTP ${response.status}: ${url}`)
    }

    const headerLen = response.headers.get('content-length')
    const parsedHeader = headerLen ? Number(headerLen) : NaN
    const total =
      Number.isFinite(parsedHeader) && parsedHeader > 0
        ? parsedHeader
        : probedTotal && probedTotal > 0
          ? probedTotal
          : 0

    if (!response.body) {
      const buffer = await response.arrayBuffer()
      this.reportDownloadProgress(buffer.byteLength, total || buffer.byteLength, onProgress)
      return {
        buffer,
        transferredBytes: buffer.byteLength,
        fileSizeBytes: total || buffer.byteLength,
      }
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      this.reportDownloadProgress(loaded, total, onProgress)
    }

    const fileSizeBytes = total > 0 ? total : loaded
    this.reportDownloadProgress(loaded, fileSizeBytes, onProgress)
    return {
      buffer: mergeByteChunks(chunks, loaded),
      transferredBytes: loaded,
      fileSizeBytes,
    }
  }

  private async parseBuffer(
    buffer: ArrayBuffer,
    url: string,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>> {
    onProgress?.({
      stage: 'parse',
      ratio: null,
      message: 'Parsing geometry…',
    })
    await yieldToMain()

    const parseStart = performance.now()
    const heartbeat = window.setInterval(() => {
      const sec = Math.max(1, Math.round((performance.now() - parseStart) / 1000))
      onProgress?.({
        stage: 'parse',
        ratio: null,
        message: `Parsing geometry… ${sec}s (large models can take a few minutes)`,
      })
    }, 1000)

    try {
      return await this.gltf.parseAsync(buffer, url)
    } finally {
      window.clearInterval(heartbeat)
    }
  }

  async loadUrl(
    url: string,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<ModelLoadResult> {
    this.ensureKtx2()
    onProgress?.({ stage: 'download', ratio: 0, message: 'Loading model' })

    // Some servers omit Content-Length on GET; HEAD often still reports size.
    const probedTotal = await probeContentLength(url)

    const downloadStart = performance.now()
    const { buffer, transferredBytes, fileSizeBytes } = await this.downloadArrayBuffer(
      url,
      probedTotal,
      onProgress,
    )
    const downloadMs = performance.now() - downloadStart

    onProgress?.({ stage: 'parse', ratio: null, message: 'Download complete — parsing geometry…' })
    const parseStart = performance.now()
    const gltf = await this.parseBuffer(buffer, url, onProgress)
    const parseMs = performance.now() - parseStart

    const root = new Group()
    root.name = 'ModelRoot'
    root.add(gltf.scene)
    root.updateMatrixWorld(true)

    onProgress?.({ stage: 'parse', ratio: 0.96, message: 'Geometry ready' })
    return {
      root,
      url,
      transferredBytes,
      downloadMs,
      parseMs,
      fileSizeBytes,
      animations: gltf.animations ?? [],
    }
  }

  async loadArrayBuffer(
    buffer: ArrayBuffer,
    name = 'local.glb',
    onProgress?: (p: LoadProgress) => void,
  ): Promise<ModelLoadResult> {
    this.ensureKtx2()
    onProgress?.({ stage: 'parse', ratio: 0.5, message: 'Decoding geometry' })
    const parseStart = performance.now()
    const gltf = await this.gltf.parseAsync(buffer, '')
    const root = new Group()
    root.name = name
    root.add(gltf.scene)
    root.updateMatrixWorld(true)
    const parseMs = performance.now() - parseStart
    onProgress?.({ stage: 'parse', ratio: 0.95, message: 'Geometry ready' })
    return {
      root,
      url: name,
      transferredBytes: buffer.byteLength,
      downloadMs: 0,
      parseMs,
      fileSizeBytes: buffer.byteLength,
      animations: gltf.animations ?? [],
    }
  }

  dispose(): void {
    this.draco.dispose()
    this.ktx2.dispose()
  }
}

export function applyModelTransform(
  root: Object3D,
  options: { scale?: number; rotation?: [number, number, number] },
): void {
  if (options.scale != null && options.scale !== 1) {
    root.scale.setScalar(options.scale)
  }
  if (options.rotation) {
    const [x, y, z] = options.rotation
    root.rotation.set(x, y, z)
  }
  root.updateMatrixWorld(true)
}
