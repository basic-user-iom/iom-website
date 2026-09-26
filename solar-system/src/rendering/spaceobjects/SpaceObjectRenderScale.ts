import type { Vector3 } from 'three';
import type { Camera } from 'three';

import type { RenderScaleMode } from '../RenderScaleModel';

/** Presentation locators stay small but readable next to an exaggerated Earth. */
const SELECTED_EARTH_SATELLITE_MARKER_RADIUS = 0.0004;
const PRESENTATION_EARTH_SATELLITE_MARKER_RADIUS = 0.00018;
const TRUE_SCALE_EARTH_SATELLITE_MARKER_RADIUS = 0.00000008;

const SELECTED_SPACECRAFT_MARKER_RADIUS = 0.0009;
const PRESENTATION_SPACECRAFT_MARKER_RADIUS = 0.00045;
const TRUE_SCALE_SPACECRAFT_MARKER_RADIUS = 0.00016;

/** ~24′ floor / ~60′ ceiling — readable diamonds, still far from billboards. */
const MIN_MARKER_ANGULAR_RADIUS = 0.007;
const MAX_MARKER_ANGULAR_RADIUS = 0.018;

export interface BodyRelativePhysicalScale {
  readonly metersToRenderUnits: number;
  readonly positionMultiplier: number;
}

export interface PhysicalModelScale {
  readonly authoredSpanMeters: number;
  readonly correction: number;
  readonly correctedBoundingRadiusMeters: number;
}

export function earthSatelliteMarkerRadius(
  selected: boolean,
  mode: RenderScaleMode,
): number {
  if (selected) return SELECTED_EARTH_SATELLITE_MARKER_RADIUS;
  return mode === 'presentation'
    ? PRESENTATION_EARTH_SATELLITE_MARKER_RADIUS
    : TRUE_SCALE_EARTH_SATELLITE_MARKER_RADIUS;
}

export function spacecraftMarkerRadius(
  selected: boolean,
  mode: RenderScaleMode,
): number {
  if (selected) return SELECTED_SPACECRAFT_MARKER_RADIUS;
  return mode === 'presentation'
    ? PRESENTATION_SPACECRAFT_MARKER_RADIUS
    : TRUE_SCALE_SPACECRAFT_MARKER_RADIUS;
}

/**
 * Inflates only the drawn mesh so distant probes stay findable.
 * Camera framing still uses the unclamped base radius from renderedRadii.
 */
export function screenAwareMarkerRadius(
  baseRadius: number,
  worldPosition: Readonly<Vector3>,
  camera: Camera,
): number {
  if (!Number.isFinite(baseRadius) || baseRadius < 0) {
    throw new RangeError('Marker base radius must be finite and non-negative.');
  }
  const distance = camera.position.distanceTo(worldPosition as Vector3);
  if (!Number.isFinite(distance) || distance <= 1e-12) return baseRadius;
  const minRadius = distance * MIN_MARKER_ANGULAR_RADIUS;
  const maxRadius = distance * MAX_MARKER_ANGULAR_RADIUS;
  return Math.min(maxRadius, Math.max(baseRadius, minRadius));
}

/** Keeps local positions and detailed geometry proportional to a rendered parent body. */
export function bodyRelativePhysicalScale(
  bodyRenderRadius: number,
  bodyPhysicalRadiusMeters: number,
  baseMetersToRenderUnits: number,
): BodyRelativePhysicalScale {
  assertPositive(bodyRenderRadius, 'Body render radius');
  assertPositive(bodyPhysicalRadiusMeters, 'Body physical radius');
  assertPositive(baseMetersToRenderUnits, 'Base meter conversion');
  const metersToRenderUnits = bodyRenderRadius / bodyPhysicalRadiusMeters;
  return Object.freeze({
    metersToRenderUnits,
    positionMultiplier: metersToRenderUnits / baseMetersToRenderUnits,
  });
}

/** Calibrates an authored model so its longest axis matches an authoritative span. */
export function physicalModelScale(
  sizeMeters: readonly [number, number, number],
  authoritativeSpanMeters: number,
): PhysicalModelScale {
  sizeMeters.forEach((value, index) => assertPositive(value, `Model axis ${index}`));
  assertPositive(authoritativeSpanMeters, 'Authoritative model span');
  const authoredSpanMeters = Math.max(...sizeMeters);
  const correction = authoritativeSpanMeters / authoredSpanMeters;
  return Object.freeze({
    authoredSpanMeters,
    correction,
    correctedBoundingRadiusMeters: Math.hypot(...sizeMeters) * 0.5 * correction,
  });
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}
