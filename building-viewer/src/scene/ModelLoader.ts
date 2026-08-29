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
import { disposeObject3D } from '../utils/disposeScene'

export type ModelAssetIntegrity = {
  sha256: string
  bytes: number
}

const SHA256 = /^[a-fA-F0-9]{64}$/
const GLB_MAGIC = 0x46546c67
const GLB_VERSION_2 = 2
const GLB_JSON_CHUNK = 0x4e4f534a
const GLB_BIN_CHUNK = 0x004e4942
const GLB_HEADER_BYTES = 12
const GLB_CHUNK_HEADER_BYTES = 8

/**
 * Verified network GLBs are deliberately bounded before any allocation-heavy
 * GLTF parsing. This remains well above the project's current ~98 MB maximum.
 */
export const MAX_VERIFIED_GLB_BYTES = 512 * 1024 * 1024

export type SelfContainedGlbValidation = {
  jsonChunkBytes: number
  binaryChunkBytes: number | null
  chunkCount: number
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertDataUrisOnly(value: unknown, path: string): void {
  const pending: Array<{ value: unknown; path: string }> = [{ value, path }]
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current) break
    if (Array.isArray(current.value)) {
      current.value.forEach((entry, index) => {
        pending.push({ value: entry, path: `${current.path}[${index}]` })
      })
      continue
    }
    if (!isJsonRecord(current.value)) continue

    for (const [key, entry] of Object.entries(current.value)) {
      const entryPath = `${current.path}.${key}`
      if (key === 'uri' && (typeof entry !== 'string' || !/^data:/i.test(entry))) {
        throw new Error(`External URI is not allowed in verified GLB at ${entryPath}`)
      }
      pending.push({ value: entry, path: entryPath })
    }
  }
}

/**
 * Validate a strict, self-contained GLB 2.0 container without side effects.
 * Unknown or duplicate chunks are rejected rather than delegated to GLTFLoader,
 * and every JSON property named `uri` must be an embedded data URI.
 */
export function validateSelfContainedGlbV2(
  buffer: ArrayBuffer,
  url = 'verified model',
): SelfContainedGlbValidation {
  if (buffer.byteLength < GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES) {
    throw new Error(`Malformed GLB for ${url}: file is too short`)
  }

  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error(`Malformed GLB for ${url}: invalid magic`)
  }
  if (view.getUint32(4, true) !== GLB_VERSION_2) {
    throw new Error(`Malformed GLB for ${url}: version must be 2`)
  }

  const declaredLength = view.getUint32(8, true)
  if (declaredLength !== buffer.byteLength) {
    throw new Error(
      `Malformed GLB for ${url}: declared length ${declaredLength} does not match ${buffer.byteLength}`,
    )
  }

  let offset = GLB_HEADER_BYTES
  let chunkCount = 0
  let jsonChunkOffset = -1
  let jsonChunkBytes = 0
  let binaryChunkBytes: number | null = null

  while (offset < declaredLength) {
    if (declaredLength - offset < GLB_CHUNK_HEADER_BYTES) {
      throw new Error(`Malformed GLB for ${url}: truncated chunk header`)
    }

    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    if (chunkLength % 4 !== 0) {
      throw new Error(`Malformed GLB for ${url}: chunk length is not 4-byte aligned`)
    }

    const dataOffset = offset + GLB_CHUNK_HEADER_BYTES
    const nextOffset = dataOffset + chunkLength
    if (nextOffset > declaredLength) {
      throw new Error(`Malformed GLB for ${url}: chunk exceeds declared file length`)
    }

    if (chunkType === GLB_JSON_CHUNK) {
      if (jsonChunkOffset !== -1) {
        throw new Error(`Malformed GLB for ${url}: duplicate JSON chunk`)
      }
      if (chunkCount !== 0) {
        throw new Error(`Malformed GLB for ${url}: JSON must be the first chunk`)
      }
      if (chunkLength === 0) {
        throw new Error(`Malformed GLB for ${url}: JSON chunk is empty`)
      }
      jsonChunkOffset = dataOffset
      jsonChunkBytes = chunkLength
    } else if (chunkType === GLB_BIN_CHUNK) {
      if (jsonChunkOffset === -1) {
        throw new Error(`Malformed GLB for ${url}: BIN chunk precedes JSON`)
      }
      if (binaryChunkBytes !== null) {
        throw new Error(`Malformed GLB for ${url}: duplicate BIN chunk`)
      }
      binaryChunkBytes = chunkLength
    } else {
      throw new Error(
        `Malformed GLB for ${url}: unknown chunk type 0x${chunkType.toString(16).padStart(8, '0')}`,
      )
    }

    chunkCount += 1
    offset = nextOffset
  }

  if (jsonChunkOffset === -1) {
    throw new Error(`Malformed GLB for ${url}: JSON chunk is missing`)
  }

  let jsonText: string
  try {
    jsonText = new TextDecoder('utf-8', { fatal: true }).decode(
      new Uint8Array(buffer, jsonChunkOffset, jsonChunkBytes),
    )
  } catch {
    throw new Error(`Malformed GLB for ${url}: JSON chunk is not valid UTF-8`)
  }

  let json: unknown
  try {
    json = JSON.parse(jsonText)
  } catch {
    throw new Error(`Malformed GLB for ${url}: JSON chunk cannot be parsed`)
  }
  if (!isJsonRecord(json)) {
    throw new Error(`Malformed GLB for ${url}: JSON root must be an object`)
  }
  if (!isJsonRecord(json.asset) || json.asset.version !== '2.0') {
    throw new Error(`Malformed GLB for ${url}: glTF asset.version must be "2.0"`)
  }
  assertDataUrisOnly(json, '$')

  return { jsonChunkBytes, binaryChunkBytes, chunkCount }
}

function hex(bytes: Uint8Array): string {
  let out = ''
  for (const value of bytes) out += value.toString(16).padStart(2, '0')
  return out
}

function assertIntegrityPin(expected: ModelAssetIntegrity, url: string): void {
  if (!Number.isSafeInteger(expected.bytes) || expected.bytes < 1) {
    throw new Error(`Invalid byte pin for ${url}`)
  }
  if (!SHA256.test(expected.sha256)) {
    throw new Error(`Invalid SHA-256 pin for ${url}`)
  }
}

function assertVerifiedGlbPin(expected: ModelAssetIntegrity, url: string): void {
  assertIntegrityPin(expected, url)
  if (expected.bytes < GLB_HEADER_BYTES + GLB_CHUNK_HEADER_BYTES) {
    throw new Error(`Verified GLB byte pin is too small for ${url}`)
  }
  if (expected.bytes > MAX_VERIFIED_GLB_BYTES) {
    throw new Error(
      `Verified GLB byte pin exceeds ${MAX_VERIFIED_GLB_BYTES} byte limit for ${url}`,
    )
  }
}

/** Verify the exact downloaded bytes before GLTF parsing allocates scene resources. */
export async function verifyModelAssetIntegrity(
  buffer: ArrayBuffer,
  expected: ModelAssetIntegrity,
  url: string,
): Promise<void> {
  assertIntegrityPin(expected, url)
  if (buffer.byteLength !== expected.bytes) {
    throw new Error(
      `Asset byte-length mismatch for ${url} (${buffer.byteLength} != ${expected.bytes})`,
    )
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer)
  const actual = hex(new Uint8Array(digest))
  if (actual.toLowerCase() !== expected.sha256.toLowerCase()) {
    throw new Error(`Asset SHA-256 mismatch for ${url}`)
  }
}

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

function parseContentLength(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!body) return
  try {
    await body.cancel()
  } catch {
    // Cancellation is best-effort; the validation error remains authoritative.
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw new DOMException('Model load was superseded', 'AbortError')
}

async function probeContentLength(url: string, signal?: AbortSignal): Promise<number | null> {
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
    const res = await fetch(url, { method: 'HEAD', signal })
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
    signal?: AbortSignal,
    integrity?: ModelAssetIntegrity,
  ): Promise<{ buffer: ArrayBuffer; transferredBytes: number; fileSizeBytes: number | null }> {
    throwIfAborted(signal)
    const response = await fetch(url, { signal })
    if (!response.ok) {
      throw new Error(`Model HTTP ${response.status}: ${url}`)
    }

    const headerLen = response.headers.get('content-length')
    const parsedHeader = parseContentLength(headerLen)
    if (integrity && parsedHeader !== null && parsedHeader !== integrity.bytes) {
      await cancelBody(response.body)
      throw new Error(
        `Asset Content-Length mismatch for ${url} (${parsedHeader} != ${integrity.bytes})`,
      )
    }
    const total =
      parsedHeader !== null && parsedHeader > 0
        ? parsedHeader
        : probedTotal && probedTotal > 0
          ? probedTotal
          : 0

    if (!response.body) {
      const buffer = await response.arrayBuffer()
      if (integrity && buffer.byteLength !== integrity.bytes) {
        throw new Error(
          `Asset byte-length mismatch for ${url} (${buffer.byteLength} != ${integrity.bytes})`,
        )
      }
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
      throwIfAborted(signal)
      const { done, value } = await reader.read()
      if (done) break
      if (integrity && loaded + value.length > integrity.bytes) {
        try {
          await reader.cancel()
        } catch {
          // Cancellation is best-effort; fail closed on the exceeded byte pin.
        }
        throw new Error(
          `Asset download exceeded byte pin for ${url} (${loaded + value.length} > ${integrity.bytes})`,
        )
      }
      chunks.push(value)
      loaded += value.length
      this.reportDownloadProgress(loaded, total, onProgress)
    }

    if (integrity && loaded !== integrity.bytes) {
      throw new Error(`Asset byte-length mismatch for ${url} (${loaded} != ${integrity.bytes})`)
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
    signal?: AbortSignal,
  ): Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>> {
    throwIfAborted(signal)
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
      const gltf = await this.gltf.parseAsync(buffer, url)
      if (signal?.aborted) {
        disposeObject3D(gltf.scene)
        throwIfAborted(signal)
      }
      return gltf
    } finally {
      window.clearInterval(heartbeat)
    }
  }

  async loadUrl(
    url: string,
    onProgress?: (p: LoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<ModelLoadResult> {
    return this.loadUrlInternal(url, undefined, onProgress, signal)
  }

  async loadUrlVerified(
    url: string,
    integrity: ModelAssetIntegrity,
    onProgress?: (p: LoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<ModelLoadResult> {
    return this.loadUrlInternal(url, integrity, onProgress, signal)
  }

  private async loadUrlInternal(
    url: string,
    integrity: ModelAssetIntegrity | undefined,
    onProgress?: (p: LoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<ModelLoadResult> {
    if (integrity) assertVerifiedGlbPin(integrity, url)
    this.ensureKtx2()
    onProgress?.({ stage: 'download', ratio: 0, message: 'Loading model' })

    // Some servers omit Content-Length on GET; HEAD often still reports size.
    const probedTotal = await probeContentLength(url, signal)
    throwIfAborted(signal)
    if (integrity && probedTotal !== null && probedTotal !== integrity.bytes) {
      throw new Error(
        `Asset Content-Length mismatch for ${url} (${probedTotal} != ${integrity.bytes})`,
      )
    }

    const downloadStart = performance.now()
    const { buffer, transferredBytes, fileSizeBytes } = await this.downloadArrayBuffer(
      url,
      probedTotal,
      onProgress,
      signal,
      integrity,
    )
    const downloadMs = performance.now() - downloadStart

    if (integrity) {
      onProgress?.({ stage: 'verify', ratio: null, message: 'Verifying model integrity…' })
      await verifyModelAssetIntegrity(buffer, integrity, url)
      throwIfAborted(signal)
      validateSelfContainedGlbV2(buffer, url)
    }

    onProgress?.({ stage: 'parse', ratio: null, message: 'Download complete — parsing geometry…' })
    const parseStart = performance.now()
    const gltf = await this.parseBuffer(buffer, url, onProgress, signal)
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
    signal?: AbortSignal,
  ): Promise<ModelLoadResult> {
    this.ensureKtx2()
    const parseStart = performance.now()
    const gltf = await this.parseBuffer(buffer, '', onProgress, signal)
    throwIfAborted(signal)
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
