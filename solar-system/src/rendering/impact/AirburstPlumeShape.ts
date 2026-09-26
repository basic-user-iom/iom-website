import type { ImpactRenderState } from './ImpactRenderTypes';
import type { Vector3 } from 'three';

/** Visual wake envelope, bounded by the actual sampled entry trajectory.
 * Shape/dispersion are educational; this does not alter the entry solution. */
export function airburstWakeLengthM(state: Readonly<ImpactRenderState>): number {
  const trail = state.trailLocalEnuM;
  let length = 0;
  for (let i = trail.length - 3; i >= 3; i -= 3) {
    length += Math.hypot(trail[i]! - trail[i - 3]!,
      trail[i + 1]! - trail[i - 2]!, trail[i + 2]! - trail[i - 1]!);
  }
  return Math.min(length, 20_000, Math.max(state.plumeHeightM * 2.4, state.plumeRadiusM * 6));
}

/** Metres back along the sampled trail, returned as an ENU offset from its end. */
export function sampleAirburstWake(out: Vector3, state: Readonly<ImpactRenderState>, distanceM: number): Vector3 {
  const trail = state.trailLocalEnuM;
  if (trail.length < 6) return out.set(0, 0, 0);
  const end = trail.length - 3;
  let remaining = Math.max(0, distanceM);
  for (let i = end; i >= 3; i -= 3) {
    const dx = trail[i - 3]! - trail[i]!, dy = trail[i - 2]! - trail[i + 1]!,
      dz = trail[i - 1]! - trail[i + 2]!;
    const length = Math.hypot(dx, dy, dz);
    if (remaining <= length || i === 3) {
      const t = length > 0 ? Math.min(1, remaining / length) : 0;
      return out.set(trail[i]! + dx * t - trail[end]!,
        trail[i + 1]! + dy * t - trail[end + 1]!,
        trail[i + 2]! + dz * t - trail[end + 2]!);
    }
    remaining -= length;
  }
  return out.set(0, 0, 0);
}
