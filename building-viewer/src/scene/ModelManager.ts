import { Group, Vector3, type Object3D, type WebGLRenderer } from 'three'

import { disposeObject3D } from '../utils/disposeScene'
import {
  disposeCollisionChunks,
  validateDedicatedCollisionRoot,
  type ValidatedDedicatedCollision,
} from '../collision/dedicatedCollisionValidation'
import { assertCollisionActivationPreflight } from '../collision/collisionActivationPreflight'

import { ModelLoader, applyModelTransform, type ModelAssetIntegrity } from './ModelLoader'

import {
  AnimationPackageStreamLoader,
  type AnimationPackageLevel,
  type AnimationPackageManifestEntryV3,
  type AnimationPackageStreamFocus,
} from './AnimationPackageStreamLoader'

import type {

  LoadProgress,

  LoadedModelLayer,

  ModelManifestEntry,

  ModelVariantKey,

} from './types'

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Model load was superseded', 'AbortError')
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function waitWithAbort(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  if (delayMs <= 0) return Promise.resolve().then(() => throwIfAborted(signal))
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)
    const onAbort = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(new DOMException('Model load was superseded', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

type PreparedLayer = {
  layer: LoadedModelLayer
  stream?: AnimationPackageStreamLoader
  collision?: ValidatedDedicatedCollision
}

export type StreamingPackagePrepare = (
  root: Object3D,
  entry: ModelManifestEntry,
  pkg: AnimationPackageManifestEntryV3,
  level: AnimationPackageLevel,
  signal: AbortSignal,
) => void | Promise<void>

export type StreamingFailoverRequest = {
  layerId: string
  entry: ModelManifestEntry
  error: unknown
  attempts: number
}

export type StreamingFailoverHandler = (request: StreamingFailoverRequest) => void | Promise<void>

export type ModelManagerOptions = {
  /** Retry delays after the first failed package sync. Empty means fail over immediately. */
  streamRetryDelaysMs?: number[]
  waitForRetry?: (delayMs: number, signal?: AbortSignal) => Promise<void>
  onStreamingFailover?: StreamingFailoverHandler
}



/**

 * Multi-layer model manager — several buildings can be loaded and shown together.

 */

export class ModelManager {

  readonly root = new Group()

  private loader: ModelLoader

  private layers = new Map<string, LoadedModelLayer>()

  private streamLoaders = new Map<string, AnimationPackageStreamLoader>()

  private preparedStreamingCollisions = new Map<string, ValidatedDedicatedCollision>()

  private readonly blockedStreamingLayerIds = new Set<string>()

  private readonly failoverInFlight = new Map<string, Promise<void>>()

  private readonly streamSyncTokens = new Map<string, symbol>()

  private readonly streamRetryDelaysMs: number[]

  private readonly waitForRetry: (delayMs: number, signal?: AbortSignal) => Promise<void>

  private streamingFailoverHandler: StreamingFailoverHandler | null



  constructor(
    getRenderer: () => WebGLRenderer | null,
    private readonly prepareStreamingPackage?: StreamingPackagePrepare,
    options: ModelManagerOptions = {},
  ) {

    this.root.name = 'ModelManagerRoot'

    this.loader = new ModelLoader(getRenderer)

    this.streamRetryDelaysMs = [...(options.streamRetryDelaysMs ?? [180, 650])]
    this.waitForRetry = options.waitForRetry ?? waitWithAbort
    this.streamingFailoverHandler = options.onStreamingFailover ?? null

  }

  setStreamingFailoverHandler(handler: StreamingFailoverHandler | null): void {
    this.streamingFailoverHandler = handler
  }

  takePreparedStreamingCollision(layerId: string): ValidatedDedicatedCollision | null {
    const collision = this.preparedStreamingCollisions.get(layerId) ?? null
    if (collision) this.preparedStreamingCollisions.delete(layerId)
    return collision
  }



  listLayers(): LoadedModelLayer[] {

    return [...this.layers.values()]

  }



  getLayer(id: string): LoadedModelLayer | null {

    return this.layers.get(id) ?? null

  }



  getStreamLoader(id: string): AnimationPackageStreamLoader | null {

    return this.streamLoaders.get(id) ?? null

  }



  getVisibleRoots(): Object3D[] {

    return [...this.layers.values()].filter((l) => l.visible).map((l) => l.root)

  }



  /** Primary layer used for spawn params / naming — first visible, else first loaded. */

  getPrimaryLayer(): LoadedModelLayer | null {

    return this.listLayers().find((l) => l.visible) ?? this.listLayers()[0] ?? null

  }



  resolveUrl(entry: ModelManifestEntry, variant: ModelVariantKey): string {
    if (variant === 'quest' && entry.quest) return entry.quest
    return entry.web
  }

  resolveHlodManifestUrl(entry: ModelManifestEntry, variant: ModelVariantKey): string | null {
    const config = entry.hlodStreaming
    if (config?.enabled !== true) return null
    if (variant === 'quest') return config.quest ?? null
    return config.web || null
  }



  /**

   * Load an optional dedicated collision GLB (not added to the visual scene graph).

   * Caller must dispose the returned root after extracting chunks.

   */

  async loadCollisionRoot(

    entry: ModelManifestEntry,

    onProgress?: (p: LoadProgress) => void,

    signal?: AbortSignal,

    integrity?: ModelAssetIntegrity,

  ): Promise<Object3D | null> {

    if (!entry.collision) return null

    onProgress?.({

      stage: 'download',

      ratio: 0.92,

      message: `Loading collision for ${entry.name}`,

    })

    const result = integrity
      ? await this.loader.loadUrlVerified(entry.collision, integrity, onProgress, signal)
      : await this.loader.loadUrl(entry.collision, onProgress, signal)

    applyModelTransform(result.root, {

      scale: entry.scale,

      rotation: entry.rotation,

    })

    // The collision file itself is authoritative. GLTFLoader may replace a
    // single-primitive COLLIDER_* mesh name with its node name, so relying on
    // names here silently drops most dedicated geometry at runtime.
    result.root.traverse((obj) => {
      const mesh = obj as { isMesh?: boolean; userData?: Record<string, unknown> }
      if (!mesh.isMesh) return
      mesh.userData = mesh.userData ?? {}
      mesh.userData.collisionOnly = true
      mesh.userData.collisionMesh = true
    })

    result.root.name = `Collision:${entry.id}`

    return result.root

  }



  async loadLayers(

    entries: ModelManifestEntry[],

    variant: ModelVariantKey,

    onProgress?: (p: LoadProgress) => void,

    initialFocus?: AnimationPackageStreamFocus,

    signal?: AbortSignal,

  ): Promise<LoadedModelLayer[]> {
    const prepared: PreparedLayer[] = []
    try {
      for (let i = 0; i < entries.length; i++) {
        throwIfAborted(signal)
        const entry = entries[i]!
        onProgress?.({
          stage: 'download',
          ratio: entries.length > 1 ? i / entries.length : 0,
          message: `Loading ${entry.name} (${i + 1}/${entries.length})`,
        })
        prepared.push(
          await this.prepareLayer(
            entry,
            variant,
            (p) => {
              if (!onProgress) return
              const base = i / entries.length
              const span = 1 / entries.length
              onProgress({
                ...p,
                ratio: p.ratio == null ? null : base + p.ratio * span,
                message: `${entry.name}: ${p.message}`,
              })
            },
            initialFocus,
            signal,
          ),
        )
      }
      throwIfAborted(signal)
      this.commitReplacement(prepared)
      return prepared.map(({ layer }) => layer)
    } catch (err) {
      this.disposePrepared(prepared)
      throw err
    }

  }



  async addLayer(

    entry: ModelManifestEntry,

    variant: ModelVariantKey,

    onProgress?: (p: LoadProgress) => void,

    initialFocus?: AnimationPackageStreamFocus,

    signal?: AbortSignal,

  ): Promise<LoadedModelLayer> {
    const prepared = await this.prepareLayer(entry, variant, onProgress, initialFocus, signal)
    try {
      throwIfAborted(signal)
      this.commitLayer(prepared)
      return prepared.layer
    } catch (err) {
      this.disposePrepared([prepared])
      throw err
    }

  }

  private async prepareLayer(
    entry: ModelManifestEntry,
    variant: ModelVariantKey,
    onProgress?: (p: LoadProgress) => void,
    initialFocus?: AnimationPackageStreamFocus,
    signal?: AbortSignal,
  ): Promise<PreparedLayer> {
    const streamUrl = this.blockedStreamingLayerIds.has(entry.id)
      ? null
      : this.resolveHlodManifestUrl(entry, variant)
    if (streamUrl) {
      if (entry.lightmap) {
        console.warn(
          `[ModelManager] manifest-v3 HLOD has no verified package-lightmap contract for ${entry.id}; using monolithic GLB`,
        )
      } else if (!entry.collision) {
        console.warn(
          `[ModelManager] manifest-v3 HLOD requires dedicated collision for ${entry.id}; using monolithic GLB`,
        )
      } else {
        try {
          return await this.prepareStreamingLayer(
            entry,
            variant,
            streamUrl,
            onProgress,
            initialFocus,
            signal,
          )
        } catch (err) {
          throwIfAborted(signal)
          console.warn(
            `[ModelManager] manifest-v3 HLOD failed for ${entry.id}; using monolithic GLB`,
            err,
          )
        }
      }
    }

    const url = this.resolveUrl(entry, variant)
    const result = await this.loader.loadUrl(url, onProgress, signal)
    try {
      throwIfAborted(signal)
      applyModelTransform(result.root, {
        scale: entry.scale,
        rotation: entry.rotation,
      })
      result.root.name = `Model:${entry.id}`
      result.root.userData.layerId = entry.id
      return {
        layer: {
          id: entry.id,
          entry,
          root: result.root,
          result,
          visible: true,
          streaming: false,
        },
      }
    } catch (err) {
      disposeObject3D(result.root)
      throw err
    }
  }

  private async prepareStreamingLayer(
    entry: ModelManifestEntry,
    variant: ModelVariantKey,
    manifestUrl: string,
    onProgress?: (p: LoadProgress) => void,
    initialFocus?: AnimationPackageStreamFocus,
    signal?: AbortSignal,
  ): Promise<PreparedLayer> {

    const layerRoot = new Group()

    layerRoot.name = `Model:${entry.id}`
    layerRoot.userData.layerId = entry.id

    applyModelTransform(layerRoot, {
      scale: entry.scale,
      rotation: entry.rotation,
    })

    const stream = new AnimationPackageStreamLoader(this.loader, variant)
    let collision: ValidatedDedicatedCollision | null = null
    try {
      onProgress?.({

      stage: 'download',

      ratio: 0.05,

      message: `Loading animation-aware HLOD manifest for ${entry.name}`,

      })

      const config = entry.hlodStreaming
      if (!config || config.enabled !== true) throw new Error('HLOD streaming is not opted in')
      await stream.loadManifest(
        manifestUrl,
        {
          modelId: entry.id,
          sourceSha256: config.sourceSha256[variant],
          rigSha256: config.rigSha256,
        },
        { sha256: config.manifestSha256[variant], bytes: config.manifestBytes[variant] },
        signal,
      )
      throwIfAborted(signal)

      const collisionIntegrity = {
        sha256: config.collisionSha256,
        bytes: config.collisionBytes,
      }
      onProgress?.({
        stage: 'verify',
        ratio: 0.08,
        message: `Verifying collision activation evidence for ${entry.name}`,
      })
      collision = await this.prepareStreamingCollision(
        entry,
        collisionIntegrity,
        onProgress,
        signal,
      )
      await assertCollisionActivationPreflight(
        entry.id,
        entry.collision!,
        collisionIntegrity,
        collision,
        config.collisionActivation,
        signal,
      )
      throwIfAborted(signal)

      stream.attachLayer(entry, layerRoot)
      stream.setPrepareIncoming((root, pkg, level, prepareSignal) =>
        this.prepareStreamingPackage?.(root, entry, pkg, level, prepareSignal),
      )

      const focus = initialFocus ?? (entry.spawn
        ? { x: entry.spawn[0], y: entry.spawn[1], z: entry.spawn[2] }
        : undefined)

      onProgress?.({

      stage: 'download',

      ratio: 0.1,

      message: `Loading initial streamed resident set for ${entry.name}`,

      })

      await stream.initialize(focus, { onProgress, signal })
      throwIfAborted(signal)

      const clips = stream.collectAnimations()

      const state = stream.getState()

      const layer: LoadedModelLayer = {
        id: entry.id,
        entry,
        root: layerRoot,
        result: {
          root: layerRoot,
          url: manifestUrl,
          transferredBytes: state.residentBytes || null,
          downloadMs: 0,
          parseMs: 0,
          fileSizeBytes: state.residentBytes || null,
          animations: clips,
        },
        visible: true,
        streaming: true,
      }

      console.info(

      `[ModelManager] ${entry.id} manifest-v3 HLOD · ${state.loaded.length} packages · ${state.residentTriangles.toLocaleString()} tris resident`,

      )

      return { layer, stream, collision }
    } catch (err) {
      if (collision) disposeCollisionChunks(collision.chunks)
      stream.dispose()
      disposeObject3D(layerRoot)
      throw err
    }

  }

  private async prepareStreamingCollision(
    entry: ModelManifestEntry,
    integrity: ModelAssetIntegrity,
    onProgress?: (p: LoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<ValidatedDedicatedCollision> {
    let collisionRoot: Object3D | null = null
    try {
      collisionRoot = await this.loadCollisionRoot(entry, onProgress, signal, integrity)
      throwIfAborted(signal)
      if (!collisionRoot) throw new Error(`Streaming collision is unavailable for ${entry.id}`)
      const validation = validateDedicatedCollisionRoot(collisionRoot, entry.id, false)
      if (!validation.valid || !validation.collision) {
        throw new Error(
          `Streaming collision failed validation for ${entry.id}: ${validation.reason ?? 'unknown reason'}`,
        )
      }
      return validation.collision
    } finally {
      if (collisionRoot) disposeObject3D(collisionRoot)
    }
  }

  /** Replace every layer in one synchronous commit after all new assets are ready. */
  private commitReplacement(prepared: PreparedLayer[]): void {
    const previousLayers = this.layers
    const previousStreams = this.streamLoaders
    const previousCollisions = this.preparedStreamingCollisions
    const nextLayers = new Map<string, LoadedModelLayer>()
    const nextStreams = new Map<string, AnimationPackageStreamLoader>()
    const nextCollisions = new Map<string, ValidatedDedicatedCollision>()

    for (const layer of previousLayers.values()) this.root.remove(layer.root)
    for (const item of prepared) {
      const previous = previousLayers.get(item.layer.id)
      if (previous) {
        item.layer.visible = previous.visible
        item.layer.root.visible = previous.visible
      }
      nextLayers.set(item.layer.id, item.layer)
      if (item.stream) nextStreams.set(item.layer.id, item.stream)
      if (item.collision) nextCollisions.set(item.layer.id, item.collision)
      this.root.add(item.layer.root)
    }
    this.layers = nextLayers
    this.streamLoaders = nextStreams
    this.preparedStreamingCollisions = nextCollisions
    this.streamSyncTokens.clear()

    for (const stream of previousStreams.values()) stream.dispose()
    for (const collision of previousCollisions.values()) disposeCollisionChunks(collision.chunks)
    for (const layer of previousLayers.values()) disposeObject3D(layer.root)
  }

  /** Add/replace one layer only after its replacement has finished loading. */
  private commitLayer(prepared: PreparedLayer): void {
    const { layer, stream, collision } = prepared
    const previous = this.layers.get(layer.id)
    const previousStream = this.streamLoaders.get(layer.id)
    const previousCollision = this.preparedStreamingCollisions.get(layer.id)
    if (previous) this.root.remove(previous.root)
    if (previous) {
      layer.visible = previous.visible
      layer.root.visible = previous.visible
    }
    this.layers.set(layer.id, layer)
    if (stream) this.streamLoaders.set(layer.id, stream)
    else this.streamLoaders.delete(layer.id)
    this.streamSyncTokens.delete(layer.id)
    if (collision) this.preparedStreamingCollisions.set(layer.id, collision)
    else this.preparedStreamingCollisions.delete(layer.id)
    this.root.add(layer.root)
    previousStream?.dispose()
    if (previousCollision) disposeCollisionChunks(previousCollision.chunks)
    if (previous) disposeObject3D(previous.root)
  }

  private disposePrepared(prepared: PreparedLayer[]): void {
    for (const { layer, stream, collision } of prepared) {
      stream?.dispose()
      if (collision) disposeCollisionChunks(collision.chunks)
      disposeObject3D(layer.root)
    }
  }



  /** Load/unload spatial cells around focus for all streaming layers. */

  async updateStreamingFocus(

    focus: AnimationPackageStreamFocus | Vector3,

    onProgress?: (p: LoadProgress) => void,

    signal?: AbortSignal,

  ): Promise<void> {

    const f =

      focus instanceof Vector3

        ? { x: focus.x, y: focus.y, z: focus.z }

        : focus

    for (const [id, stream] of this.streamLoaders) {

      const layer = this.layers.get(id)

      if (!layer?.visible || this.streamLoaders.get(id) !== stream) continue

      if (this.blockedStreamingLayerIds.has(id)) continue
      const syncToken = Symbol(id)
      this.streamSyncTokens.set(id, syncToken)
      let lastError: unknown = null
      for (let attempt = 0; attempt <= this.streamRetryDelaysMs.length; attempt += 1) {
        try {
          await stream.syncFocus(f, { onProgress, signal })
          throwIfAborted(signal)
          lastError = null
          break
        } catch (error) {
          if (isAbortError(error) || signal?.aborted) throw error
          if (
            this.layers.get(id) !== layer ||
            this.streamLoaders.get(id) !== stream ||
            this.streamSyncTokens.get(id) !== syncToken
          ) {
            lastError = null
            break
          }
          lastError = error
          if (attempt >= this.streamRetryDelaysMs.length) break
          await this.waitForRetry(this.streamRetryDelaysMs[attempt]!, signal)
          throwIfAborted(signal)
          if (
            this.layers.get(id) !== layer ||
            this.streamLoaders.get(id) !== stream ||
            this.streamSyncTokens.get(id) !== syncToken
          ) {
            lastError = null
            break
          }
        }
      }
      if (lastError != null) {
        await this.requestStreamingFailoverFor(id, layer, stream, lastError, signal, syncToken)
      }
    }
  }

  /**
   * Temporarily disable this layer's package route and ask the host to prepare
   * a monolithic replacement. The existing streamed layer stays mounted until
   * the host completes its normal atomic commit. Failed replacement attempts
   * re-arm streaming and reject to the caller instead of freezing the route.
   */
  async requestStreamingFailover(
    layerId: string,
    error: unknown,
    signal?: AbortSignal,
  ): Promise<void> {
    const layer = this.layers.get(layerId)
    const stream = this.streamLoaders.get(layerId)
    if (!layer || !stream) return
    await this.requestStreamingFailoverFor(layerId, layer, stream, error, signal)
  }

  private async requestStreamingFailoverFor(
    layerId: string,
    layer: LoadedModelLayer,
    stream: AnimationPackageStreamLoader,
    error: unknown,
    signal?: AbortSignal,
    syncToken?: symbol,
  ): Promise<void> {
    if (this.layers.get(layerId) !== layer || this.streamLoaders.get(layerId) !== stream) return
    const existing = this.failoverInFlight.get(layerId)
    if (existing) {
      try {
        await existing
      } catch (existingError) {
        if (!isAbortError(existingError) || signal?.aborted) throw existingError
      }
      if (this.blockedStreamingLayerIds.has(layerId)) return
      if (this.failoverInFlight.get(layerId) === existing) this.failoverInFlight.delete(layerId)
      await this.requestStreamingFailoverFor(layerId, layer, stream, error, signal, syncToken)
      return
    }

    const attempts = this.streamRetryDelaysMs.length + 1
    const request = Promise.resolve()
      .then(async () => {
        throwIfAborted(signal)
        if (
          this.layers.get(layerId) !== layer ||
          this.streamLoaders.get(layerId) !== stream ||
          (syncToken != null && this.streamSyncTokens.get(layerId) !== syncToken)
        ) return
        this.blockedStreamingLayerIds.add(layerId)
        try {
          if (!this.streamingFailoverHandler) {
            throw new Error(`No streaming failover handler is installed for ${layerId}`)
          }
          await this.streamingFailoverHandler({ layerId, entry: layer.entry, error, attempts })
          const replacement = this.layers.get(layerId)
          if (!replacement || replacement.streaming || this.streamLoaders.has(layerId)) {
            throw new Error(
              `Streaming failover for ${layerId} completed without installing a monolithic replacement`,
            )
          }
        } catch (failoverError) {
          const current = this.layers.get(layerId)
          if (!current || current.streaming || this.streamLoaders.has(layerId)) {
            this.blockedStreamingLayerIds.delete(layerId)
          }
          throw failoverError
        }
      })
      .then(() => undefined)
    this.failoverInFlight.set(layerId, request)
    try {
      await request
    } finally {
      if (this.failoverInFlight.get(layerId) === request) this.failoverInFlight.delete(layerId)
    }
  }



  getStreamingSummary(): string {

    const parts: string[] = []

    for (const [id, stream] of this.streamLoaders) {

      const s = stream.getState()

      parts.push(`${id}:${s.loaded.length}c/${Math.round(s.residentTriangles / 1000)}k`)

    }

    return parts.length ? parts.join(' · ') : ''
  }

  hasStreamingLayers(): boolean {
    return this.streamLoaders.size > 0
  }

  /** Return the persistent manifest-v3 rig clips for the requested layer. */
  async refreshStreamingAnimations(
    layerId: string,
    signal?: AbortSignal,
  ): Promise<import('three').AnimationClip[]> {
    const layer = this.layers.get(layerId)
    const stream = this.streamLoaders.get(layerId)
    if (!layer || !stream) return layer?.result.animations ?? []

    const clips = stream.collectAnimations()
    throwIfAborted(signal)
    if (this.layers.get(layerId) !== layer || this.streamLoaders.get(layerId) !== stream) return []
    if (clips.length) layer.result.animations = clips
    return clips
  }

  getAnimationBindRoot(layerId: string): import('three').Object3D | null {
    const layer = this.layers.get(layerId)
    if (!layer) return null
    const stream = this.streamLoaders.get(layerId)
    if (stream) {
      return stream.getAnimationBindRoot() ?? layer.root
    }
    return layer.root
  }

  async loadLocalFile(
    file: File,

    onProgress?: (p: LoadProgress) => void,

    signal?: AbortSignal,

  ): Promise<LoadedModelLayer> {
    throwIfAborted(signal)
    const buffer = await file.arrayBuffer()
    throwIfAborted(signal)
    const result = await this.loader.loadArrayBuffer(buffer, file.name, onProgress, signal)

    const entry: ModelManifestEntry = {

      id: `local-${file.name}`,

      name: file.name,

      web: file.name,

    }
    result.root.name = `Model:${entry.id}`
    result.root.userData.layerId = entry.id

    const layer: LoadedModelLayer = {

      id: entry.id,

      entry,

      root: result.root,

      result,

      visible: true,

    }

    const prepared = { layer }
    try {
      throwIfAborted(signal)
      this.commitReplacement([prepared])
      return layer
    } catch (err) {
      this.disposePrepared([prepared])
      throw err
    }

  }



  setVisible(id: string, visible: boolean): boolean {

    const layer = this.layers.get(id)

    if (!layer) return false

    layer.visible = visible

    layer.root.visible = visible

    return true

  }



  removeLayer(id: string): void {

    const layer = this.layers.get(id)

    if (!layer) return

    const stream = this.streamLoaders.get(id)
    const preparedCollision = this.preparedStreamingCollisions.get(id)

    if (stream) {

      stream.dispose()

      this.streamLoaders.delete(id)

    }

    this.streamSyncTokens.delete(id)

    if (preparedCollision) {
      disposeCollisionChunks(preparedCollision.chunks)
      this.preparedStreamingCollisions.delete(id)
    }

    this.root.remove(layer.root)

    disposeObject3D(layer.root)

    this.layers.delete(id)

  }



  clear(): void {

    for (const id of [...this.layers.keys()]) this.removeLayer(id)

  }



  /** Combined stats helpers */

  getCombinedFileBytes(): number | null {

    let total = 0

    let any = false

    for (const layer of this.layers.values()) {

      if (layer.streaming) {

        const stream = this.streamLoaders.get(layer.id)

        const bytes = stream?.getState().residentBytes ?? 0

        if (bytes > 0) {

          total += bytes

          any = true

        }

        continue

      }

      if (layer.result.fileSizeBytes != null) {

        total += layer.result.fileSizeBytes

        any = true

      }

    }

    return any ? total : null

  }



  dispose(): void {

    this.clear()

    for (const collision of this.preparedStreamingCollisions.values()) {
      disposeCollisionChunks(collision.chunks)
    }
    this.preparedStreamingCollisions.clear()
    this.streamingFailoverHandler = null

    this.loader.dispose()

  }

}


