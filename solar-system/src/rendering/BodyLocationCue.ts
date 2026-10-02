interface Position { readonly x: number; readonly y: number; readonly z: number }

/** Screen-space aid only: never modifies physical or rendered body radii. */
export function bodyLocationCueOpacity(radiusPx: number): number {
  if (!Number.isFinite(radiusPx) || radiusPx >= 5) return 0;
  if (radiusPx <= 2) return 1;
  const t = (radiusPx - 2) / 3;
  return 1 - t * t * (3 - 2 * t);
}

/** Opaque foreground bodies must hide DOM location cues just as they hide geometry. */
export function bodyLocationOccluded(camera: Position, target: Position, center: Position, radius: number): boolean {
  if (!(radius > 0)) return false;
  const tx = target.x - camera.x, ty = target.y - camera.y, tz = target.z - camera.z;
  const distance = Math.hypot(tx, ty, tz);
  if (!(distance > 0)) return false;
  const cx = center.x - camera.x, cy = center.y - camera.y, cz = center.z - camera.z;
  const alongRay = (cx * tx + cy * ty + cz * tz) / distance;
  if (alongRay <= 0 || alongRay >= distance) return false;
  const perpendicularSq = Math.max(0, cx * cx + cy * cy + cz * cz - alongRay * alongRay);
  return perpendicularSq < radius * radius;
}
