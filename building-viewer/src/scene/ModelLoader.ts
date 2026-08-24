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

  async loadUrl(
    url: string,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<ModelLoadResult> {
    this.ensureKtx2()
    onProgress?.({ stage: 'download', ratio: 0, message: 'Loading model' })

    // Some servers omit Content-Length on GET; HEAD often still reports size.
    const probedTotal = await probeContentLength(url)

    const downloadStart = performance.now()
    let transferredBytes: number | null = null
    let fileSizeBytes: number | null = probedTotal

    const gltf = await new Promise<Awaited<ReturnType<GLTFLoader['loadAsync']>>>((resolve, reject) => {
      this.gltf.load(
        url,
        (result) => resolve(result),
        (event) => {
          transferredBytes = event.loaded
          const total =
            event.lengthComputable && event.total > 0
              ? event.total
              : probedTotal && probedTotal > 0
                ? probedTotal
                : 0
          if (total > 0) {
            fileSizeBytes = total
            const ratio = Math.min(1, event.loaded / total)
            const loadedMb = event.loaded / (1024 * 1024)
            const totalMb = total / (1024 * 1024)
            onProgress?.({
              stage: 'download',
              ratio,
              message: `Loading model… ${loadedMb.toFixed(1)} / ${totalMb.toFixed(0)} MB`,
            })
          } else {
            onProgress?.({
              stage: 'download',
              ratio: null,
              message: `Loading model… ${Math.round(event.loaded / (1024 * 1024))} MB`,
            })
          }
        },
        reject,
      )
    })

    const downloadMs = performance.now() - downloadStart
    onProgress?.({ stage: 'parse', ratio: 0.92, message: 'Decoding geometry' })
    const parseStart = performance.now()

    const root = new Group()
    root.name = 'ModelRoot'
    root.add(gltf.scene)
    root.updateMatrixWorld(true)

    const parseMs = performance.now() - parseStart
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
