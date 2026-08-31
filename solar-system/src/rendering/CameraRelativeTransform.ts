import type { Vector3 } from 'three';

import type { PhysicalPosition } from './RenderContext';

export function mapCameraRelativePosition(
  output: Vector3,
  physicalPositionM: PhysicalPosition,
  renderOriginM: PhysicalPosition,
  metersPerRenderUnit: number,
): Vector3 {
  // Horizons ECLIPTIC vectors use +Z as ecliptic north. Three.js uses +Y as
  // up, so this is a proper -90 degree rotation around +X (not a reflection).
  return output.set(
    (physicalPositionM.x - renderOriginM.x) / metersPerRenderUnit,
    (physicalPositionM.z - renderOriginM.z) / metersPerRenderUnit,
    (renderOriginM.y - physicalPositionM.y) / metersPerRenderUnit,
  );
}
/** Returns the local-space translation required to make an origin rebase inert. */
export function calculateRebaseShift(
  output: Vector3,
  previousOriginM: PhysicalPosition,
  nextOriginM: PhysicalPosition,
  metersPerRenderUnit: number,
): Vector3 {
  return output.set(
    (previousOriginM.x - nextOriginM.x) / metersPerRenderUnit,
    (previousOriginM.z - nextOriginM.z) / metersPerRenderUnit,
    (nextOriginM.y - previousOriginM.y) / metersPerRenderUnit,
  );
}
