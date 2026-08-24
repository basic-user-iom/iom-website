import { Group, Vector3, type Object3D, type WebGLRenderer } from 'three'

import { disposeObject3D } from '../utils/disposeScene'

import { ModelLoader, applyModelTransform } from './ModelLoader'

import { CellStreamLoader, type CellManifest, type CellStreamFocus } from './CellStreamLoader'

import type {

  LoadProgress,

  LoadedModelLayer,

  ModelManifestEntry,

  ModelVariantKey,

} from './types'



/**

 * Multi-layer model manager — several buildings can be loaded and shown together.

 */

export class ModelManager {

  readonly root = new Group()

  private loader: ModelLoader

  private layers = new Map<string, LoadedModelLayer>()

  private streamLoaders = new Map<string, CellStreamLoader>()



  constructor(getRenderer: () => WebGLRenderer | null) {

    this.root.name = 'ModelManagerRoot'

    this.loader = new ModelLoader(getRenderer)

  }



  listLayers(): LoadedModelLayer[] {

    return [...this.layers.values()]

  }



  getLayer(id: string): LoadedModelLayer | null {

    return this.layers.get(id) ?? null

  }



  getStreamLoader(id: string): CellStreamLoader | null {

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

  resolveCellManifestUrl(entry: ModelManifestEntry, variant: ModelVariantKey): string | null {
    if (variant === 'quest') return entry.cellManifestQuest ?? null
    return entry.cellManifest ?? null
  }



  /**

   * Load an optional dedicated collision GLB (not added to the visual scene graph).

   * Caller must dispose the returned root after extracting chunks.

   */

  async loadCollisionRoot(

    entry: ModelManifestEntry,

    onProgress?: (p: LoadProgress) => void,

  ): Promise<Object3D | null> {

    if (!entry.collision) return null

    onProgress?.({

      stage: 'download',

      ratio: 0.92,

      message: `Loading collision for ${entry.name}`,

    })

    const result = await this.loader.loadUrl(entry.collision, onProgress)

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

    initialFocus?: CellStreamFocus,

  ): Promise<LoadedModelLayer[]> {

    this.clear()

    const loaded: LoadedModelLayer[] = []

    for (let i = 0; i < entries.length; i++) {

      const entry = entries[i]!

      onProgress?.({

        stage: 'download',

        ratio: entries.length > 1 ? i / entries.length : 0,

        message: `Loading ${entry.name} (${i + 1}/${entries.length})`,

      })

      const layer = await this.addLayer(entry, variant, (p) => {

        if (!onProgress) return

        const base = i / entries.length

        const span = 1 / entries.length

        onProgress({

          ...p,

          ratio: p.ratio == null ? null : base + p.ratio * span,

          message: `${entry.name}: ${p.message}`,

        })

      }, initialFocus)

      loaded.push(layer)

    }

    return loaded

  }



  async addLayer(

    entry: ModelManifestEntry,

    variant: ModelVariantKey,

    onProgress?: (p: LoadProgress) => void,

    initialFocus?: CellStreamFocus,

  ): Promise<LoadedModelLayer> {

    if (this.layers.has(entry.id)) this.removeLayer(entry.id)

    const streamUrl = this.resolveCellManifestUrl(entry, variant)
    if (streamUrl && variant === 'web' && !entry.animation) {
      try {
        return await this.addStreamingLayer(entry, streamUrl, onProgress, initialFocus)
      } catch (err) {
        console.warn(`[ModelManager] streaming failed for ${entry.id}, using monolithic GLB`, err)
      }
    }

    const url = this.resolveUrl(entry, variant)

    const result = await this.loader.loadUrl(url, onProgress)

    applyModelTransform(result.root, {

      scale: entry.scale,

      rotation: entry.rotation,

    })

    result.root.name = `Model:${entry.id}`



    const layer: LoadedModelLayer = {

      id: entry.id,

      entry,

      root: result.root,

      result,

      visible: true,

      streaming: false,

    }

    this.layers.set(entry.id, layer)

    this.root.add(result.root)

    return layer

  }



  private async addStreamingLayer(
    entry: ModelManifestEntry,
    manifestUrl: string,
    onProgress?: (p: LoadProgress) => void,
    initialFocus?: CellStreamFocus,
  ): Promise<LoadedModelLayer> {

    const layerRoot = new Group()

    layerRoot.name = `Model:${entry.id}`

    const cellRoot = new Group()

    cellRoot.name = 'CellStreamRoot'

    layerRoot.add(cellRoot)



    const stream = new CellStreamLoader(this.loader)

    onProgress?.({

      stage: 'download',

      ratio: 0.05,

      message: `Loading cell manifest for ${entry.name}`,

    })

    const manifest = await stream.loadManifest(manifestUrl)
    if (!manifest || !isSafeCellManifest(manifest)) {
      throw new Error(`Cell manifest failed or unsafe: ${manifestUrl}`)
    }

    stream.attachLayer(entry, cellRoot)

    this.streamLoaders.set(entry.id, stream)



    const focus = streamFocusForManifest(manifest, initialFocus, entry.spawn)

    onProgress?.({

      stage: 'download',

      ratio: 0.1,

      message: `Streaming cells for ${entry.name}`,

    })

    await stream.syncFocus(focus, { onProgress })

    let clips = stream.collectAnimations()
    if (!clips.length && entry.animation) {
      clips = await this.loadAnimationClipsOnly(entry, onProgress)
    }

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

    this.layers.set(entry.id, layer)

    this.root.add(layerRoot)

    console.info(

      `[ModelManager] ${entry.id} streaming · ${state.loaded.length} cells · ${state.residentTriangles.toLocaleString()} tris resident`,

    )

    return layer

  }



  /** Load/unload spatial cells around focus for all streaming layers. */

  async updateStreamingFocus(

    focus: CellStreamFocus | Vector3,

    onProgress?: (p: LoadProgress) => void,

  ): Promise<void> {

    const f =

      focus instanceof Vector3

        ? { x: focus.x, y: focus.y, z: focus.z }

        : focus

    for (const [id, stream] of this.streamLoaders) {

      const layer = this.layers.get(id)

      if (!layer?.visible) continue

      await stream.syncFocus(f, { onProgress })
      const anims = await this.refreshStreamingAnimations(id)
      if (anims.length) layer.result.animations = anims
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

  /** Refresh clip list from loaded stream cells + optional animation sidecar. */
  async refreshStreamingAnimations(layerId: string): Promise<import('three').AnimationClip[]> {
    const layer = this.layers.get(layerId)
    const stream = this.streamLoaders.get(layerId)
    if (!layer || !stream) return layer?.result.animations ?? []

    let clips = stream.collectAnimations()
    if (!clips.length && layer.entry.animation) {
      clips = await this.loadAnimationClipsOnly(layer.entry)
    }
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

  private async loadAnimationClipsOnly(
    entry: ModelManifestEntry,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<import('three').AnimationClip[]> {
    const url = entry.animation
    if (!url) return []
    try {
      onProgress?.({
        stage: 'download',
        ratio: null,
        message: `Loading animation clips for ${entry.name}`,
      })
      const result = await this.loader.loadUrl(url, onProgress)
      const clips = result.animations ?? []
      disposeObject3D(result.root)
      return clips
    } catch (err) {
      console.warn(`[ModelManager] animation sidecar failed for ${entry.id}`, err)
      return []
    }
  }

  async loadLocalFile(
    file: File,

    onProgress?: (p: LoadProgress) => void,

  ): Promise<LoadedModelLayer> {

    this.clear()

    const buffer = await file.arrayBuffer()

    const result = await this.loader.loadArrayBuffer(buffer, file.name, onProgress)

    const entry: ModelManifestEntry = {

      id: `local-${file.name}`,

      name: file.name,

      web: file.name,

    }

    const layer: LoadedModelLayer = {

      id: entry.id,

      entry,

      root: result.root,

      result,

      visible: true,

    }

    this.layers.set(entry.id, layer)

    this.root.add(result.root)

    return layer

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

    if (stream) {

      stream.dispose()

      this.streamLoaders.delete(id)

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

    this.loader.dispose()

  }

}



function isSafeCellManifest(manifest: CellManifest): boolean {
  if ((manifest.version ?? 1) < 2) {
    console.warn('[ModelManager] refusing cell-manifest version < 2 (duplicating bake)')
    return false
  }
  const stats = (manifest as CellManifest & { stats?: { alwaysOnTriangles?: number; totalBytes?: number; ownedTriangles?: number; sourceTriangles?: number } }).stats
  const alwaysOn = stats?.alwaysOnTriangles ?? manifest.cells.filter((c) => c.alwaysOn).reduce((s, c) => s + (c.triangles || 0), 0)
  const maxAlways = manifest.budgets?.maxAlwaysOnTris ?? 150_000
  if (alwaysOn > maxAlways) {
    console.warn(`[ModelManager] refusing oversized always-on shell (${alwaysOn} tris)`)
    return false
  }
  const bytes = stats?.totalBytes ?? manifest.cells.reduce((s, c) => s + (c.bytes || 0), 0)
  if (bytes > 900 * 1024 * 1024) {
    console.warn(`[ModelManager] refusing oversized cell set (${(bytes / 1024 / 1024).toFixed(0)} MiB)`)
    return false
  }
  const owned = stats?.ownedTriangles
  const source = stats?.sourceTriangles
  if (owned && source && owned > source * 1.6) {
    console.warn('[ModelManager] refusing cell set with triangle duplication')
    return false
  }
  return Array.isArray(manifest.cells) && manifest.cells.length > 0
}

function streamFocusForManifest(
  manifest: CellManifest,
  preferred?: CellStreamFocus,
  spawn?: [number, number, number],
): CellStreamFocus {
  if (spawn) return { x: spawn[0], y: spawn[1], z: spawn[2] }
  const [minX, minY, minZ] = manifest.sceneMin
  const [maxX, maxY, maxZ] = manifest.sceneMax
  const center: CellStreamFocus = {
    x: (minX + maxX) * 0.5,
    y: minY + Math.min(4, Math.max(1.6, (maxY - minY) * 0.2)),
    z: (minZ + maxZ) * 0.5,
  }
  if (!preferred) return center
  const inside =
    preferred.x >= minX &&
    preferred.x <= maxX &&
    preferred.y >= minY - 2 &&
    preferred.y <= maxY + 4 &&
    preferred.z >= minZ &&
    preferred.z <= maxZ
  return inside ? preferred : center
}


