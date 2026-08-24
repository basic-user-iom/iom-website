import { Box3, Mesh, Vector3, type Object3D } from 'three'

/** Align with collision chunk grid in buildCollisionChunks.ts */
export const SPATIAL_CELL_XZ = 12
export const SPATIAL_CELL_Y = 4
export const DEFAULT_FLOOR_BAND_HEIGHT = 3.6

/** Phase C — skip always-on shell cells above this triangle count at runtime. */
export const STREAM_MAX_ALWAYS_ON_TRIS = 150_000

/** Baked glTF node extras + runtime userData (GLTFLoader copies extras → userData). */
export type IOMSpatial = {
  floorBand?: number
  floorBandMin?: number
  floorBandMax?: number
  cell?: [number, number, number]
  cellXMin?: number
  cellXMax?: number
  cellYMin?: number
  cellYMax?: number
  cellZMin?: number
  cellZMax?: number
  alwaysOn?: boolean
}

export type SpatialSceneConfig = {
  sceneMinY: number
  sceneMinX: number
  sceneMinZ: number
  bandHeight: number
  cellSizeXz: number
  cellSizeY: number
  /** Horizontal cell neighbor radius (±N cells around focus). */
  neighborCells: number
}

export type SpatialResidency = {
  floorBand: number
  bandMin: number
  bandMax: number
  cellX: number
  cellZ: number
  cellXMin: number
  cellXMax: number
  cellZMin: number
  cellZMax: number
  alwaysOn: boolean
}

const _box = new Box3()
const _center = new Vector3()
const _size = new Vector3()

export function cellCoord(value: number, origin: number, cellSize: number): number {
  return Math.floor((value - origin) / cellSize)
}

export function spatialKeyXZ(cx: number, cz: number, floorBand: number): string {
  return `f${floorBand}|cx${cx}|cz${cz}`
}

export function readIOMSpatial(obj: Object3D): IOMSpatial | null {
  const raw = obj.userData?.IOM_spatial as IOMSpatial | undefined
  return raw && typeof raw === 'object' ? raw : null
}

/** World-space residency from mesh bounds (or baked extras when present). */
export function computeMeshSpatial(
  mesh: Mesh,
  config: SpatialSceneConfig,
  opts?: { alwaysOn?: boolean },
): SpatialResidency {
  const baked = readIOMSpatial(mesh)
  if (baked?.floorBandMin != null && baked?.cellXMin != null) {
    return {
      floorBand: baked.floorBand ?? baked.floorBandMin,
      bandMin: baked.floorBandMin,
      bandMax: baked.floorBandMax ?? baked.floorBandMin,
      cellX: baked.cell?.[0] ?? baked.cellXMin,
      cellZ: baked.cell?.[2] ?? baked.cellZMin ?? 0,
      cellXMin: baked.cellXMin,
      cellXMax: baked.cellXMax ?? baked.cellXMin,
      cellZMin: baked.cellZMin ?? baked.cellXMin,
      cellZMax: baked.cellZMax ?? baked.cellZMin ?? baked.cellXMin,
      alwaysOn: Boolean(baked.alwaysOn || opts?.alwaysOn),
    }
  }

  mesh.updateWorldMatrix(true, false)
  _box.setFromObject(mesh)
  if (_box.isEmpty()) {
    return {
      floorBand: 0,
      bandMin: 0,
      bandMax: 0,
      cellX: 0,
      cellZ: 0,
      cellXMin: 0,
      cellXMax: 0,
      cellZMin: 0,
      cellZMax: 0,
      alwaysOn: Boolean(opts?.alwaysOn),
    }
  }

  _box.getCenter(_center)
  _box.getSize(_size)

  const bandMin = Math.floor((_box.min.y - config.sceneMinY) / config.bandHeight)
  const bandMax = Math.floor((_box.max.y - config.sceneMinY) / config.bandHeight)
  const cellXMin = cellCoord(_box.min.x, config.sceneMinX, config.cellSizeXz)
  const cellXMax = cellCoord(_box.max.x, config.sceneMinX, config.cellSizeXz)
  const cellZMin = cellCoord(_box.min.z, config.sceneMinZ, config.cellSizeXz)
  const cellZMax = cellCoord(_box.max.z, config.sceneMinZ, config.cellSizeXz)
  const floorBand = Math.floor((_center.y - config.sceneMinY) / config.bandHeight)

  return {
    floorBand: Number.isFinite(floorBand) ? floorBand : 0,
    bandMin: Number.isFinite(bandMin) ? bandMin : 0,
    bandMax: Number.isFinite(bandMax) ? bandMax : bandMin,
    cellX: cellCoord(_center.x, config.sceneMinX, config.cellSizeXz),
    cellZ: cellCoord(_center.z, config.sceneMinZ, config.cellSizeXz),
    cellXMin,
    cellXMax,
    cellZMin,
    cellZMax,
    alwaysOn: Boolean(baked?.alwaysOn || opts?.alwaysOn),
  }
}

/** Union spatial ranges from packed source meshes. */
export function mergeSpatialFromMeshes(
  meshes: Mesh[],
  config: SpatialSceneConfig,
): IOMSpatial {
  let bandMin = Infinity
  let bandMax = -Infinity
  let cellXMin = Infinity
  let cellXMax = -Infinity
  let cellZMin = Infinity
  let cellZMax = -Infinity
  let alwaysOn = false

  for (const mesh of meshes) {
    const s = computeMeshSpatial(mesh, config)
    bandMin = Math.min(bandMin, s.bandMin)
    bandMax = Math.max(bandMax, s.bandMax)
    cellXMin = Math.min(cellXMin, s.cellXMin)
    cellXMax = Math.max(cellXMax, s.cellXMax)
    cellZMin = Math.min(cellZMin, s.cellZMin)
    cellZMax = Math.max(cellZMax, s.cellZMax)
    alwaysOn = alwaysOn || s.alwaysOn
  }

  if (!Number.isFinite(bandMin)) bandMin = 0
  if (!Number.isFinite(bandMax)) bandMax = bandMin

  return {
    floorBandMin: bandMin,
    floorBandMax: bandMax,
    floorBand: Math.floor((bandMin + bandMax) / 2),
    cellXMin,
    cellXMax,
    cellZMin,
    cellZMax,
    cell: [Math.floor((cellXMin + cellXMax) / 2), 0, Math.floor((cellZMin + cellZMax) / 2)],
    alwaysOn,
  }
}

export function residencyOverlapsFloor(
  entry: Pick<SpatialResidency, 'bandMin' | 'bandMax' | 'alwaysOn'>,
  activeBand: number,
  neighborBands: number,
): boolean {
  if (entry.alwaysOn) return true
  if (entry.bandMin <= 1) return true
  const lo = activeBand - neighborBands
  const hi = activeBand + neighborBands
  return entry.bandMax >= lo && entry.bandMin <= hi
}

export function residencyOverlapsCell(
  entry: Pick<SpatialResidency, 'cellXMin' | 'cellXMax' | 'cellZMin' | 'cellZMax' | 'alwaysOn'>,
  focusCellX: number,
  focusCellZ: number,
  neighborCells: number,
): boolean {
  if (entry.alwaysOn) return true
  const loX = focusCellX - neighborCells
  const hiX = focusCellX + neighborCells
  const loZ = focusCellZ - neighborCells
  const hiZ = focusCellZ + neighborCells
  return entry.cellXMax >= loX && entry.cellXMin <= hiX && entry.cellZMax >= loZ && entry.cellZMin <= hiZ
}
