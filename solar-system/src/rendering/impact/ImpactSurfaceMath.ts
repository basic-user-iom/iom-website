import { Vector3 } from 'three';

import type { ImpactBodyLocalDirection, ImpactRenderState } from './ImpactRenderTypes';

export interface ImpactSurfaceBasis {
  readonly normal: Readonly<Vector3>;
  readonly east: Readonly<Vector3>;
  readonly north: Readonly<Vector3>;
}

type SurfaceShapeState = Pick<
  ImpactRenderState,
  'targetRadiusM' | 'targetEquatorialRadiusM' | 'targetPolarRadiusM'
>;

export function clampImpactUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function impactAngularRadius(radiusM: number, targetRadiusM: number): number {
  return Math.min(Math.PI * 0.94, Math.max(0, radiusM / targetRadiusM));
}

export function setEllipsoidSurfacePoint(
  output: Vector3,
  radialDirection: Readonly<ImpactBodyLocalDirection>,
  shape: Readonly<SurfaceShapeState>,
  outwardOffsetM = 0,
  normalScratch?: Vector3,
): Vector3 {
  output.set(radialDirection.x, radialDirection.y, radialDirection.z).normalize();
  const equatorialRatio = shape.targetEquatorialRadiusM / shape.targetRadiusM;
  const polarRatio = shape.targetPolarRadiusM / shape.targetRadiusM;
  const denominator = Math.sqrt(
    (output.x * output.x + output.z * output.z) / (equatorialRatio * equatorialRatio)
      + output.y * output.y / (polarRatio * polarRatio),
  );
  output.multiplyScalar(1 / Math.max(denominator, 1e-12));
  if (outwardOffsetM !== 0) {
    const surfaceNormal = normalScratch ?? new Vector3();
    setEllipsoidSurfaceNormal(surfaceNormal, output, shape);
    output.addScaledVector(surfaceNormal, outwardOffsetM / shape.targetRadiusM);
  }
  return output;
}

export function setEllipsoidSurfaceNormal(
  output: Vector3,
  surfacePoint: Readonly<ImpactBodyLocalDirection>,
  shape: Readonly<SurfaceShapeState>,
): Vector3 {
  const equatorialRatio = shape.targetEquatorialRadiusM / shape.targetRadiusM;
  const polarRatio = shape.targetPolarRadiusM / shape.targetRadiusM;
  return output.set(
    surfacePoint.x / (equatorialRatio * equatorialRatio),
    surfacePoint.y / (polarRatio * polarRatio),
    surfacePoint.z / (equatorialRatio * equatorialRatio),
  ).normalize();
}

export function ellipsoidSurfaceAttachmentErrorM(
  point: Readonly<ImpactBodyLocalDirection>,
  shape: Readonly<SurfaceShapeState>,
): number {
  const equatorialRatio = shape.targetEquatorialRadiusM / shape.targetRadiusM;
  const polarRatio = shape.targetPolarRadiusM / shape.targetRadiusM;
  const normalizedRadius = Math.sqrt(
    (point.x * point.x + point.z * point.z) / (equatorialRatio * equatorialRatio)
      + point.y * point.y / (polarRatio * polarRatio),
  );
  return Math.abs(normalizedRadius - 1) * shape.targetRadiusM;
}

export function mapImpactEnuToBodyLocal(
  output: Vector3,
  eastM: number,
  northM: number,
  upM: number,
  shape: Readonly<SurfaceShapeState>,
  basis: Readonly<ImpactSurfaceBasis>,
  surfaceScratch: Vector3,
  normalScratch: Vector3,
): Vector3 {
  setEllipsoidSurfacePoint(surfaceScratch, basis.normal, shape);
  setEllipsoidSurfaceNormal(normalScratch, surfaceScratch, shape);
  return output.copy(surfaceScratch)
    .addScaledVector(basis.east, eastM / shape.targetRadiusM)
    .addScaledVector(basis.north, northM / shape.targetRadiusM)
    .addScaledVector(normalScratch, upM / shape.targetRadiusM);
}

export function setBodyYAxisAdvection(
  output: Vector3,
  direction: Readonly<ImpactBodyLocalDirection>,
  angleRad: number,
): Vector3 {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);
  return output.set(
    direction.x * cosine + direction.z * sine,
    direction.y,
    direction.z * cosine - direction.x * sine,
  ).normalize();
}

export function impactHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function impactRandom01(seed: number, index: number): number {
  let value = (seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}
