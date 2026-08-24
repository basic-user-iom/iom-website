import type { SpatialSceneConfig } from './spatial'
import { DEFAULT_FLOOR_BAND_HEIGHT, SPATIAL_CELL_XZ, SPATIAL_CELL_Y } from './spatial'

export type SpatialMetaFile = {
  version: number
  sceneMin: [number, number, number]
  sceneMax: [number, number, number]
  bandHeight: number
  cellSize: [number, number, number]
}

export async function fetchSpatialMeta(url: string): Promise<SpatialMetaFile | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as SpatialMetaFile
    if (!data?.sceneMin || !data?.sceneMax) return null
    return data
  } catch {
    return null
  }
}

export function spatialConfigFromMeta(meta: SpatialMetaFile): Partial<SpatialSceneConfig> {
  return {
    sceneMinY: meta.sceneMin[1],
    sceneMinX: meta.sceneMin[0],
    sceneMinZ: meta.sceneMin[2],
    bandHeight: meta.bandHeight || DEFAULT_FLOOR_BAND_HEIGHT,
    cellSizeXz: meta.cellSize?.[0] ?? SPATIAL_CELL_XZ,
    cellSizeY: meta.cellSize?.[1] ?? SPATIAL_CELL_Y,
    neighborCells: 1,
  }
}
