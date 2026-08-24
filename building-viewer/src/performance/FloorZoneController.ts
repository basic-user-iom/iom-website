import {
  Box3,
  Mesh,
  Vector3,
  type Object3D,
} from 'three'
import {
  DEFAULT_FLOOR_BAND_HEIGHT,
  SPATIAL_CELL_XZ,
  computeMeshSpatial,
  residencyOverlapsCell,
  residencyOverlapsFloor,
  type SpatialResidency,
  type SpatialSceneConfig,
} from './spatial'
import { isInspectHidden } from '../scene/inspectFlags'

export type FloorZoneStats = {
  enabled: boolean
  bands: number
  activeBand: number | null
  activeCellX: number | null
  activeCellZ: number | null
  tracked: number
  hidden: number
  alwaysOn: number
}

type ZoneEntry = {
  mesh: Mesh
  residency: SpatialResidency
  alwaysOn: boolean
  baseVisible: boolean
}

const _box = new Box3()
const _size = new Vector3()
const _center = new Vector3()

/** Entrance / facade parts that must stay resident (visible through glass). */
const KEEP_NAME =
  /door|portal|entrance|lobby|foyer|fassade|facade|mullion|storefront|vestibule|eingang|haustür|haustuer|tor|decke|ceiling|soffit|untersicht|plafond/i

/**
 * Floor-band visual residency — keep current floor ± neighbors + exterior shell.
 * Complements DetailLod (screen-size) and does not touch collision meshes.
 *
 * Disabled for shallow exteriors — zoning lobby meshes was leaving black door voids.
 */
export class FloorZoneController {
  private entries: ZoneEntry[] = []
  private enabled = true
  private bandHeight = DEFAULT_FLOOR_BAND_HEIGHT
  private neighborBands = 1
  private neighborCells = 1
  private spatial: SpatialSceneConfig = {
    sceneMinY: 0,
    sceneMinX: 0,
    sceneMinZ: 0,
    bandHeight: DEFAULT_FLOOR_BAND_HEIGHT,
    cellSizeXz: SPATIAL_CELL_XZ,
    cellSizeY: 4,
    neighborCells: 1,
  }
  private activeBand: number | null = null
  private activeCellX: number | null = null
  private activeCellZ: number | null = null
  private lastFocusY = Number.NaN
  private lastFocusX = Number.NaN
  private lastFocusZ = Number.NaN
  private hidden = 0
  private alwaysOn = 0
  private updateIntervalMs = 180
  private lastUpdate = 0
  private horizontalCull = true

  setEnabled(on: boolean): void {
    if (this.enabled === on) return
    this.enabled = on
    if (!on) this.revealAll()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setBandHeight(meters: number): void {
    this.bandHeight = Math.max(2.4, meters)
    this.spatial.bandHeight = this.bandHeight
  }

  setSpatialConfig(partial: Partial<SpatialSceneConfig>): void {
    Object.assign(this.spatial, partial)
    if (partial.bandHeight) this.bandHeight = partial.bandHeight
  }

  setHorizontalCull(on: boolean): void {
    this.horizontalCull = on
  }

  /**
   * Index meshes after load / layer change. Large shells and glass stay always-on.
   */
  rebuild(
    root: Object3D,
    boundsMinY: number,
    sceneRadius: number,
    boundsHeight = 0,
    boundsMinX = 0,
    boundsMinZ = 0,
  ): void {
    this.revealAll()
    this.entries = []
    this.spatial.sceneMinY = boundsMinY
    this.spatial.sceneMinX = boundsMinX
    this.spatial.sceneMinZ = boundsMinZ
    this.activeBand = null
    this.activeCellX = null
    this.activeCellZ = null
    this.lastFocusY = Number.NaN
    this.lastFocusX = Number.NaN
    this.lastFocusZ = Number.NaN
    this.alwaysOn = 0

    // Single-storey / exterior-only shells: zoning hides lobby backdrop → black door squares.
    if (boundsHeight > 0 && boundsHeight < this.bandHeight * 2.2) {
      this.enabled = false
      return
    }
    this.enabled = true

    const shellRadius = Math.max(6, sceneRadius * 0.045)
    root.updateMatrixWorld(true)

    root.traverse((obj) => {
      if (!(obj as Mesh).isMesh) return
      const mesh = obj as Mesh
      if (mesh.userData?.collisionOnly || mesh.userData?.cadOverlay) return
      if (!mesh.geometry) return

      _box.setFromObject(mesh)
      if (_box.isEmpty()) return
      _box.getSize(_size)
      _box.getCenter(_center)

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const isGlass =
        Boolean(mesh.userData?.architecturalGlass) ||
        mats.some((m) => m && (m.transparent || (m as { opacity?: number }).opacity! < 0.98))

      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
      const local = mesh.geometry.boundingSphere
      const sx = mesh.matrixWorld.getMaxScaleOnAxis()
      const radius = (local?.radius ?? 0) * sx

      const tall = _size.y >= this.bandHeight * 1.6
      const large = radius >= shellRadius || _size.x * _size.z >= shellRadius * shellRadius * 0.35
      const thinVertical = _size.y > 2.0 && Math.min(_size.x, _size.z) < 0.55
      const namedKeep =
        KEEP_NAME.test(mesh.name || '') ||
        mats.some((m) => m && KEEP_NAME.test(m.name || ''))
      const heuristicAlways =
        isGlass ||
        tall ||
        large ||
        thinVertical ||
        namedKeep ||
        Boolean(mesh.userData?.floorZoneAlways) ||
        Boolean(mesh.userData?.floorSurface)

      const residency = computeMeshSpatial(mesh, this.spatial, { alwaysOn: heuristicAlways })
      const alwaysOn = residency.alwaysOn || heuristicAlways

      this.entries.push({
        mesh,
        residency: { ...residency, alwaysOn },
        alwaysOn,
        baseVisible: mesh.visible,
      })
      if (alwaysOn) this.alwaysOn += 1
      mesh.userData.floorResidency = true
    })
  }

  update(focusY: number, focusX?: number, focusZ?: number, now = performance.now()): void {
    if (!this.enabled || this.entries.length === 0) return
    if (now - this.lastUpdate < this.updateIntervalMs) return
    this.lastUpdate = now

    const band = Math.floor((focusY - this.spatial.sceneMinY) / this.bandHeight)
    const cellX =
      focusX != null
        ? Math.floor((focusX - this.spatial.sceneMinX) / this.spatial.cellSizeXz)
        : null
    const cellZ =
      focusZ != null
        ? Math.floor((focusZ - this.spatial.sceneMinZ) / this.spatial.cellSizeXz)
        : null

    if (
      this.activeBand != null &&
      Number.isFinite(this.lastFocusY) &&
      Math.abs(focusY - this.lastFocusY) < this.bandHeight * 0.35 &&
      band === this.activeBand &&
      (cellX == null ||
        (cellX === this.activeCellX &&
          cellZ === this.activeCellZ &&
          focusX != null &&
          Math.hypot(focusX - this.lastFocusX, (focusZ ?? 0) - this.lastFocusZ) < this.spatial.cellSizeXz * 0.4))
    ) {
      return
    }
    this.lastFocusY = focusY
    this.lastFocusX = focusX ?? this.lastFocusX
    this.lastFocusZ = focusZ ?? this.lastFocusZ
    this.activeBand = band
    this.activeCellX = cellX
    this.activeCellZ = cellZ
    this.applyResidency(band, cellX, cellZ)
  }

  private applyResidency(band: number, cellX: number | null, cellZ: number | null): void {
    let hidden = 0
    for (const entry of this.entries) {
      if (!entry.baseVisible) continue
      const floorOk = residencyOverlapsFloor(entry.residency, band, this.neighborBands)
      const cellOk =
        !this.horizontalCull ||
        cellX == null ||
        cellZ == null ||
        residencyOverlapsCell(entry.residency, cellX, cellZ, this.neighborCells)
      const on = entry.alwaysOn || (floorOk && cellOk)
      entry.mesh.userData.floorResidency = on
      if (isInspectHidden(entry.mesh)) continue
      if (entry.alwaysOn) {
        if (!entry.mesh.visible) entry.mesh.visible = true
        continue
      }
      if (entry.mesh.visible !== on) entry.mesh.visible = on
      if (!on) hidden += 1
    }
    this.hidden = hidden
  }

  getStats(): FloorZoneStats {
    const bands = new Set(this.entries.map((e) => e.residency.floorBand)).size
    return {
      enabled: this.enabled,
      bands,
      activeBand: this.activeBand,
      activeCellX: this.activeCellX,
      activeCellZ: this.activeCellZ,
      tracked: this.entries.length,
      hidden: this.hidden,
      alwaysOn: this.alwaysOn,
    }
  }

  private revealAll(): void {
    for (const entry of this.entries) {
      entry.mesh.userData.floorResidency = true
      if (isInspectHidden(entry.mesh)) continue
      if (entry.baseVisible) entry.mesh.visible = true
    }
    this.hidden = 0
  }

  dispose(): void {
    this.revealAll()
    this.entries = []
  }
}
