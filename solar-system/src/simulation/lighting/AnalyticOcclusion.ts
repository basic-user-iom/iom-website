import { isFiniteVec3d, type Vec3d } from '../core/Vec3d';

export type OcclusionKind = 'none' | 'partial' | 'annular' | 'total';

export interface AnalyticSphereOcclusionSample {
  lightAngularRadiusRad: number;
  occultorAngularRadiusRad: number;
  angularSeparationRad: number;
  occludedFraction: number;
  visibleFraction: number;
  occultorInFront: boolean;
  kind: OcclusionKind;
}

export function createAnalyticSphereOcclusionSample(): AnalyticSphereOcclusionSample {
  return {
    lightAngularRadiusRad: 0,
    occultorAngularRadiusRad: 0,
    angularSeparationRad: 0,
    occludedFraction: 0,
    visibleFraction: 1,
    occultorInFront: false,
    kind: 'none',
  };
}

/**
 * Apparent-disc approximation for spherical eclipse/occlusion. It accounts
 * for foreground ordering and returns a clamped visible-light fraction.
 */
export function sampleAnalyticSphereOcclusion(
  out: AnalyticSphereOcclusionSample,
  observerPositionM: Readonly<Vec3d>,
  lightPositionM: Readonly<Vec3d>,
  lightRadiusM: number,
  occultorPositionM: Readonly<Vec3d>,
  occultorRadiusM: number,
): AnalyticSphereOcclusionSample {
  assertFiniteVector(observerPositionM, 'Observer position');
  assertFiniteVector(lightPositionM, 'Light position');
  assertFiniteVector(occultorPositionM, 'Occultor position');
  assertPositiveFinite(lightRadiusM, 'Light radius');
  assertNonNegativeFinite(occultorRadiusM, 'Occultor radius');

  const lightX = lightPositionM.x - observerPositionM.x;
  const lightY = lightPositionM.y - observerPositionM.y;
  const lightZ = lightPositionM.z - observerPositionM.z;
  const occultorX = occultorPositionM.x - observerPositionM.x;
  const occultorY = occultorPositionM.y - observerPositionM.y;
  const occultorZ = occultorPositionM.z - observerPositionM.z;
  const lightDistance = Math.hypot(lightX, lightY, lightZ);
  const occultorDistance = Math.hypot(occultorX, occultorY, occultorZ);
  if (!Number.isFinite(lightDistance) || lightDistance <= 0) {
    throw new RangeError('Observer and light positions must be distinct.');
  }
  if (!Number.isFinite(occultorDistance)) {
    throw new RangeError('Observer-to-occultor distance must be finite.');
  }

  const lightAngularRadius = Math.asin(clamp(lightRadiusM / lightDistance, 0, 1));
  let occultorAngularRadius: number;
  let separation = 0;
  if (occultorDistance === 0) {
    occultorAngularRadius = occultorRadiusM > 0 ? Math.PI : 0;
  } else {
    occultorAngularRadius = Math.asin(clamp(occultorRadiusM / occultorDistance, 0, 1));
    const directionDot =
      (lightX / lightDistance) * (occultorX / occultorDistance) +
      (lightY / lightDistance) * (occultorY / occultorDistance) +
      (lightZ / lightDistance) * (occultorZ / occultorDistance);
    separation = Math.acos(clamp(directionDot, -1, 1));
  }

  const occultorInFront =
    occultorRadiusM > 0 &&
    (occultorDistance === 0 || occultorDistance < lightDistance);
  const occludedFraction = occultorInFront
    ? angularDiscOccludedFraction(
        lightAngularRadius,
        occultorAngularRadius,
        separation,
      )
    : 0;
  const visibleFraction = clamp(1 - occludedFraction, 0, 1);
  let kind: OcclusionKind = 'none';
  if (occludedFraction > 1e-14) {
    if (visibleFraction <= 1e-12) {
      kind = 'total';
    } else if (
      occultorAngularRadius < lightAngularRadius &&
      separation + occultorAngularRadius <= lightAngularRadius
    ) {
      kind = 'annular';
    } else {
      kind = 'partial';
    }
  }

  out.lightAngularRadiusRad = lightAngularRadius;
  out.occultorAngularRadiusRad = occultorAngularRadius;
  out.angularSeparationRad = separation;
  out.occludedFraction = clamp(occludedFraction, 0, 1);
  out.visibleFraction = visibleFraction;
  out.occultorInFront = occultorInFront;
  out.kind = kind;
  return out;
}

/** Fraction of the luminous angular disc covered by an occulting angular disc. */
export function angularDiscOccludedFraction(
  lightAngularRadiusRad: number,
  occultorAngularRadiusRad: number,
  angularSeparationRad: number,
): number {
  assertPositiveFinite(lightAngularRadiusRad, 'Light angular radius');
  assertNonNegativeFinite(occultorAngularRadiusRad, 'Occultor angular radius');
  assertNonNegativeFinite(angularSeparationRad, 'Angular separation');
  if (occultorAngularRadiusRad === 0) return 0;
  // Normalize first so the overlap formula remains finite for very small or
  // very large caller-supplied angular units.
  const scale = Math.max(
    lightAngularRadiusRad,
    occultorAngularRadiusRad,
    angularSeparationRad,
  );
  const lightRadius = lightAngularRadiusRad / scale;
  const occultorRadius = occultorAngularRadiusRad / scale;
  const separation = angularSeparationRad / scale;
  if (separation >= lightRadius + occultorRadius) return 0;
  if (separation <= Math.abs(lightRadius - occultorRadius)) {
    if (occultorAngularRadiusRad >= lightAngularRadiusRad) return 1;
    const radiusRatio = occultorAngularRadiusRad / lightAngularRadiusRad;
    return clamp(radiusRatio * radiusRatio, 0, 1);
  }

  const separationSquared = separation * separation;
  const lightSquared = lightRadius * lightRadius;
  const occultorSquared = occultorRadius * occultorRadius;
  const lightAngle = Math.acos(
    clamp(
      (separationSquared + lightSquared - occultorSquared) /
        (2 * separation * lightRadius),
      -1,
      1,
    ),
  );
  const occultorAngle = Math.acos(
    clamp(
      (separationSquared + occultorSquared - lightSquared) /
        (2 * separation * occultorRadius),
      -1,
      1,
    ),
  );
  const radical = Math.max(
    0,
    (-separation + lightRadius + occultorRadius) *
      (separation + lightRadius - occultorRadius) *
      (separation - lightRadius + occultorRadius) *
      (separation + lightRadius + occultorRadius),
  );
  const overlapArea =
    lightSquared * lightAngle +
    occultorSquared * occultorAngle -
    0.5 * Math.sqrt(radical);
  return clamp(overlapArea / (Math.PI * lightSquared), 0, 1);
}

function assertFiniteVector(value: Readonly<Vec3d>, label: string): void {
  if (!isFiniteVec3d(value)) throw new RangeError(`${label} must be finite.`);
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative.`);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
