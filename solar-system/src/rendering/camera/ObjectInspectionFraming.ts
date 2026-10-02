import { Vector3 } from 'three';

/** Fits the inspection sphere within the narrower field of view, in any render scale. */
export function inspectionDistance(radius: number, verticalFovDegrees: number, aspect: number): number {
  if (![radius, verticalFovDegrees, aspect].every(value => Number.isFinite(value) && value > 0)
    || verticalFovDegrees >= 179) throw new RangeError('Invalid inspection framing dimensions.');
  const halfVertical = verticalFovDegrees * Math.PI / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  return Math.max(1e-12, radius * 1.15 / Math.sin(Math.min(halfVertical, halfHorizontal)));
}

/** Camera offset toward the Sun; the weaker parent term avoids an obscuring planet. */
export function sunlitInspectionDirection(
  position: Readonly<Vector3>, sunPosition: Readonly<Vector3>, parentPosition?: Readonly<Vector3>,
): Vector3 {
  const sunward = new Vector3().copy(sunPosition).sub(position);
  if (sunward.lengthSq() === 0) sunward.set(0.85, 0.2, 0.45);
  sunward.normalize();
  const offset = sunward.clone().multiplyScalar(0.9);
  if (parentPosition !== undefined) {
    const awayFromParent = new Vector3().copy(position).sub(parentPosition).normalize();
    offset.addScaledVector(awayFromParent, 0.55);
  }
  return offset.normalize();
}
