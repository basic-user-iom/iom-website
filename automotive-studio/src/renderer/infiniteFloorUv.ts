import { Vector2 } from 'three'

/**
 * UV offset that keeps the car-following ground plane's texture locked to world XZ.
 *
 * The plane is a `PlaneGeometry` with `rotation.x = -PI/2`, so local +X maps to world
 * +X (u grows with world X) but local +Y maps to world **-Z** — v grows as world Z
 * shrinks, hence the negated Z term. Getting that sign wrong makes the ground slide
 * along Z at double speed and the car looks like it is crabbing sideways.
 */
export function infiniteFloorTextureOffset(
  worldX: number,
  worldZ: number,
  repeat: number,
  sizeMetres: number,
  out = new Vector2(),
): Vector2 {
  const tilesPerMetre = repeat / sizeMetres
  return out.set(worldX * tilesPerMetre - repeat * 0.5, -worldZ * tilesPerMetre - repeat * 0.5)
}
