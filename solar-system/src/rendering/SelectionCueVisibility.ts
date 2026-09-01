import { Vector3, type Camera, type PerspectiveCamera } from 'three';

export const SELECTION_CUE_FADE_START_PX = 28;
export const SELECTION_CUE_FADE_END_PX = 56;

const VIEW_CENTER = new Vector3();

/**
 * Returns the apparent radius of a selected spherical object in CSS pixels.
 * The application camera is perspective; the generic fallback keeps the
 * helper safe for test and tooling cameras.
 */
export function projectedSphereRadiusPx(
  camera: Camera,
  centerWorld: Readonly<Vector3>,
  radiusWorld: number,
  viewportWidthPx: number,
  viewportHeightPx: number,
): number {
  if (
    !Number.isFinite(radiusWorld) || radiusWorld <= 0 ||
    !Number.isFinite(viewportWidthPx) || viewportWidthPx <= 0 ||
    !Number.isFinite(viewportHeightPx) || viewportHeightPx <= 0
  ) {
    return 0;
  }

  const perspective = camera as PerspectiveCamera;
  if (perspective.isPerspectiveCamera) {
    const depth = -VIEW_CENTER.copy(centerWorld).applyMatrix4(camera.matrixWorldInverse).z;
    if (!Number.isFinite(depth) || depth <= 0) return 0;
    const verticalFovRad = perspective.fov * Math.PI / 180;
    return radiusWorld * viewportHeightPx /
      (2 * depth * Math.tan(verticalFovRad * 0.5));
  }

  const centerNdc = VIEW_CENTER.copy(centerWorld).project(camera);
  const edgeNdc = new Vector3(radiusWorld, 0, 0)
    .applyQuaternion(camera.quaternion)
    .add(centerWorld)
    .project(camera);
  return Math.hypot(
    (edgeNdc.x - centerNdc.x) * viewportWidthPx * 0.5,
    (edgeNdc.y - centerNdc.y) * viewportHeightPx * 0.5,
  );
}

/** Keeps a locator crisp at distance, then smoothly removes it in close-up. */
export function selectionCueOpacityForProjectedRadius(projectedRadiusPx: number): number {
  if (!Number.isFinite(projectedRadiusPx) || projectedRadiusPx >= SELECTION_CUE_FADE_END_PX) {
    return 0;
  }
  if (projectedRadiusPx <= SELECTION_CUE_FADE_START_PX) return 1;
  const fraction = (projectedRadiusPx - SELECTION_CUE_FADE_START_PX) /
    (SELECTION_CUE_FADE_END_PX - SELECTION_CUE_FADE_START_PX);
  const smoothFraction = fraction * fraction * (3 - 2 * fraction);
  return 1 - smoothFraction;
}

