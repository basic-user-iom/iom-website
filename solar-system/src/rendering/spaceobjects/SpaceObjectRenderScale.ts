import type { RenderScaleMode } from '../RenderScaleModel';

const SELECTED_MARKER_RADIUS_RENDER_UNITS = 0.00018;
const PRESENTATION_MARKER_RADIUS_RENDER_UNITS = 0.000065;
const TRUE_SCALE_MARKER_RADIUS_RENDER_UNITS = 0.00000008;

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
  if (selected) return SELECTED_MARKER_RADIUS_RENDER_UNITS;
  return mode === 'presentation'
    ? PRESENTATION_MARKER_RADIUS_RENDER_UNITS
    : TRUE_SCALE_MARKER_RADIUS_RENDER_UNITS;
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
