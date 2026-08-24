/**

 * Phase C — spatial cell manifest + streaming loader.

 *

 * Loads per-cell GLB chunks on demand around a world-space focus point.

 */



import { Group, type Object3D } from 'three'

import { disposeObject3D } from '../utils/disposeScene'

import { ModelLoader, applyModelTransform } from './ModelLoader'

import type { LoadProgress, ModelManifestEntry } from './types'

import { cellCoord, STREAM_MAX_ALWAYS_ON_TRIS } from '../performance/spatial'



export type CellManifestEntry = {

  id: string

  floorBand: number

  cell: [number, number, number]

  boundsMin: [number, number, number]

  boundsMax: [number, number, number]

  url: string

  lod1Url?: string

  triangles: number

  bytes?: number

  alwaysOn?: boolean

}



export type CellManifest = {

  version: number

  modelId: string

  sceneMin: [number, number, number]

  sceneMax: [number, number, number]

  bandHeight: number

  cellSize: [number, number, number]

  neighborCells?: number

  unloadNeighborCells?: number

  budgets?: {
    maxAlwaysOnTris?: number
    maxCellTris?: number
    ownershipTolerance?: number
  }
  stats?: {
    sourceTriangles?: number
    ownedTriangles?: number
    writtenTriangles?: number
    alwaysOnTriangles?: number
    totalBytes?: number
  }

  cells: CellManifestEntry[]

}



export type CellStreamState = {

  loaded: string[]

  pending: string[]

  residentTriangles: number

  residentBytes: number

}



export type CellStreamFocus = {

  x: number

  y: number

  z: number

}



type LoadedCell = {

  root: Object3D

  entry: CellManifestEntry

  animations: import('three').AnimationClip[]

}



export type CellStreamChangeEvent = {

  loaded: string[]

  unloaded: string[]

  layerId: string

}



export class CellStreamLoader {

  private manifest: CellManifest | null = null

  private manifestBase = ''

  private loaded = new Map<string, LoadedCell>()

  private loading = new Set<string>()

  private cellRoot: Group | null = null

  private entry: ModelManifestEntry | null = null

  private onChange: ((ev: CellStreamChangeEvent) => void) | null = null
  private overviewMode = false

  constructor(private readonly loader: ModelLoader) {}

  setOverviewMode(on: boolean): void {
    this.overviewMode = on
  }

  setOnChange(cb: ((ev: CellStreamChangeEvent) => void) | null): void {

    this.onChange = cb

  }



  async loadManifest(url: string): Promise<CellManifest | null> {

    try {

      const res = await fetch(url)

      if (!res.ok) return null

      this.manifest = (await res.json()) as CellManifest

      const slash = url.lastIndexOf('/')

      this.manifestBase = slash >= 0 ? url.slice(0, slash + 1) : ''

      return this.manifest

    } catch {

      return null

    }

  }



  attachLayer(entry: ModelManifestEntry, cellRoot: Group): void {

    this.entry = entry

    this.cellRoot = cellRoot

  }



  getManifest(): CellManifest | null {

    return this.manifest

  }



  /** Cells that should be resident for the current focus. */

  cellsForFocus(focus: CellStreamFocus): CellManifestEntry[] {

    if (!this.manifest) return []

    const m = this.manifest

    const bandHeight = m.bandHeight || 3.6

    const cellXz = m.cellSize?.[0] ?? 12

    const neighbor = this.overviewMode ? 6 : (m.neighborCells ?? 1)

    const [minX, minY, minZ] = m.sceneMin

    const focusBand = cellCoord(focus.y, minY, bandHeight)

    const focusCx = cellCoord(focus.x, minX, cellXz)

    const focusCz = cellCoord(focus.z, minZ, cellXz)



    return m.cells.filter((c) => {
      if (c.alwaysOn) {
        const budget = m.budgets?.maxAlwaysOnTris ?? STREAM_MAX_ALWAYS_ON_TRIS
        if ((c.triangles ?? 0) > budget) return false
        return true
      }
      const bandDelta = Math.abs(c.floorBand - focusBand)

      if (bandDelta > 1) return false

      const dx = Math.abs(c.cell[0] - focusCx)

      const dz = Math.abs(c.cell[2] - focusCz)

      return dx <= neighbor && dz <= neighbor

    })

  }



  private cellsToUnload(focus: CellStreamFocus): string[] {
    if (!this.manifest || this.overviewMode) return []

    const m = this.manifest

    const bandHeight = m.bandHeight || 3.6

    const cellXz = m.cellSize?.[0] ?? 12

    const unloadNeighbor = m.unloadNeighborCells ?? (m.neighborCells ?? 1) + 1

    const [minX, minY, minZ] = m.sceneMin

    const focusBand = cellCoord(focus.y, minY, bandHeight)

    const focusCx = cellCoord(focus.x, minX, cellXz)

    const focusCz = cellCoord(focus.z, minZ, cellXz)



    const unload: string[] = []

    for (const [id, cell] of this.loaded) {

      if (cell.entry.alwaysOn) continue

      const bandDelta = Math.abs(cell.entry.floorBand - focusBand)

      const dx = Math.abs(cell.entry.cell[0] - focusCx)

      const dz = Math.abs(cell.entry.cell[2] - focusCz)

      if (bandDelta > 1 || dx > unloadNeighbor || dz > unloadNeighbor) {

        unload.push(id)

      }

    }

    return unload

  }



  resolveCellUrl(relative: string): string {

    if (relative.startsWith('http') || relative.startsWith('/')) return relative

    return `${this.manifestBase}${relative}`

  }



  async syncFocus(

    focus: CellStreamFocus,

    opts?: { onProgress?: (p: LoadProgress) => void },

  ): Promise<CellStreamChangeEvent> {

    if (!this.manifest || !this.cellRoot || !this.entry) {

      return { loaded: [], unloaded: [], layerId: this.entry?.id ?? '?' }

    }



    const desired = this.cellsForFocus(focus).sort((a, b) => {
      if (Boolean(a.alwaysOn) !== Boolean(b.alwaysOn)) return a.alwaysOn ? -1 : 1
      return 0
    })

    const unloaded: string[] = []

    const loaded: string[] = []



    for (const id of this.cellsToUnload(focus)) {

      this.unloadCell(id)

      unloaded.push(id)

    }



    for (const cell of desired) {

      if (this.loaded.has(cell.id) || this.loading.has(cell.id)) continue

      this.loading.add(cell.id)

      try {

        const url = this.resolveCellUrl(cell.url)

        opts?.onProgress?.({

          stage: 'download',

          ratio: null,

          message: `Loading cell ${cell.id}`,

        })

        const result = await this.loader.loadUrl(url, opts?.onProgress)

        applyModelTransform(result.root, {

          scale: this.entry.scale,

          rotation: this.entry.rotation,

        })

        result.root.name = `Cell:${cell.id}`

        this.cellRoot.add(result.root)

        this.loaded.set(cell.id, {

          root: result.root,

          entry: cell,

          animations: result.animations ?? [],

        })

        loaded.push(cell.id)

      } catch (err) {

        console.warn(`[CellStream] failed to load ${cell.id}`, err)

      } finally {

        this.loading.delete(cell.id)

      }

    }



    const ev: CellStreamChangeEvent = {

      loaded,

      unloaded,

      layerId: this.entry.id,

    }

    if (loaded.length || unloaded.length) {

      this.onChange?.(ev)

      console.info(

        `[CellStream] ${this.entry.id} +${loaded.length} -${unloaded.length} · resident ${this.getState().residentTriangles.toLocaleString()} tris`,

      )

    }

    return ev

  }



  unloadCell(id: string): void {

    const cell = this.loaded.get(id)

    if (!cell || !this.cellRoot) return

    this.cellRoot.remove(cell.root)

    disposeObject3D(cell.root)

    this.loaded.delete(id)

  }



  getState(): CellStreamState {

    let tris = 0

    let bytes = 0

    for (const cell of this.loaded.values()) {

      tris += cell.entry.triangles

      bytes += cell.entry.bytes ?? 0

    }

    return {

      loaded: [...this.loaded.keys()],

      pending: [...this.loading],

      residentTriangles: tris,

      residentBytes: bytes,

    }

  }



  collectAnimations(): import('three').AnimationClip[] {
    const clips: import('three').AnimationClip[] = []
    const seen = new Set<string>()
    for (const cell of this.loaded.values()) {
      for (const clip of cell.animations) {
        if (seen.has(clip.name)) continue
        seen.add(clip.name)
        clips.push(clip)
      }
    }
    return clips
  }

  /** Prefer shell cell for animation binding (contains rig + clips). */
  getAnimationBindRoot(): Object3D | null {
    const shell = this.loaded.get('shell')
    if (shell) return shell.root
    const first = this.loaded.values().next().value as LoadedCell | undefined
    return first?.root ?? this.cellRoot
  }

  hasShellLoaded(): boolean {
    return this.loaded.has('shell')
  }



  dispose(): void {

    for (const id of [...this.loaded.keys()]) this.unloadCell(id)

    this.loading.clear()

    this.manifest = null

    this.cellRoot = null

    this.entry = null

  }

}


