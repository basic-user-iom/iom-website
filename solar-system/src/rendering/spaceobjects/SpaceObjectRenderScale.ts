import { Vector3, type Camera } from 'three';

import type { RenderScaleMode } from '../RenderScaleModel';

/** Presentation locators stay small but readable next to an exaggerated Earth. */
const SELECTED_EARTH_SATELLITE_MARKER_RADIUS = 0.0004;
const PRESENTATION_EARTH_SATELLITE_MARKER_RADIUS = 0.00018;
const TRUE_SCALE_EARTH_SATELLITE_MARKER_RADIUS = 0.00000008;

const SELECTED_SPACECRAFT_MARKER_RADIUS = 0.0009;
const PRESENTATION_SPACECRAFT_MARKER_RADIUS = 0.00045;
const TRUE_SCALE_SPACECRAFT_MARKER_RADIUS = 0.00016;

// CSS pixel radii: locators remain discreet at every zoom and viewport size.
const MIN_MARKER_PIXEL_RADIUS = 1.25;
const MAX_MARKER_PIXEL_RADIUS = 2;
const SELECTED_MARKER_PIXEL_RADIUS = 3;
const MARKER_VIEW_POSITION = new Vector3();

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
 * Caps only the drawn locator in CSS pixels; physical/navigation radii stay intact.
 * Call after updating the camera matrices so zooming cannot inflate a stale frame.
 */
export function screenAwareMarkerRadius(
  baseRadius: number,
  worldPosition: Readonly<Vector3>,
  camera: Camera,
  viewportHeight: number,
  selected = false,
): number {
  if (!Number.isFinite(baseRadius) || baseRadius < 0) {
    throw new RangeError('Marker base radius must be finite and non-negative.');
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 0;
  MARKER_VIEW_POSITION.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
  const projection = camera.projectionMatrix.elements;
  const clipW = projection[11]! * MARKER_VIEW_POSITION.z + projection[15]!;
  const verticalScale = Math.abs(projection[5]!);
  if (!Number.isFinite(clipW) || clipW <= 0 || verticalScale <= 0) return 0;
  const unitsPerPixel = 2 * clipW / (viewportHeight * verticalScale);
  const minRadius = unitsPerPixel * (selected ? SELECTED_MARKER_PIXEL_RADIUS : MIN_MARKER_PIXEL_RADIUS);
  const maxRadius = unitsPerPixel * (selected ? SELECTED_MARKER_PIXEL_RADIUS : MAX_MARKER_PIXEL_RADIUS);
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
