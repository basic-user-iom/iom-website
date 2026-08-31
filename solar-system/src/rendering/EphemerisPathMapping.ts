import type { EphemerisPathKind } from './EphemerisOrbitGeometry';
import type { PhysicalPosition } from './RenderContext';

export interface LinearRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * Combines each Float64 path point with its physical center, subtracts the
 * current Float64 floating origin, and only then narrows to Float32. This is
 * the path equivalent of camera-relative body mapping: no +30 AU/-30 AU sum
 * is deferred to a GPU matrix.
 */
export function writeCameraRelativePathPositions(
  output: Float32Array,
  positionsM: Float64Array,
  centerPositionM: PhysicalPosition,
  renderOriginM: PhysicalPosition,
  metersPerRenderUnit: number,
): Float32Array {
  assertPathArrays(output, positionsM, 3, 'position');
  assertFinitePosition(centerPositionM, 'Path center');
  assertFinitePosition(renderOriginM, 'Render origin');
  if (!Number.isFinite(metersPerRenderUnit) || metersPerRenderUnit <= 0) {
    throw new RangeError('Path metersPerRenderUnit must be finite and positive.');
  }

  // Subtract center/origin first when possible. For center-relative Moon paths
  // this retains substantially more precision than forming a 1 AU absolute
  // coordinate before subtracting the origin.
  const centerOffsetX = centerPositionM.x - renderOriginM.x;
  const centerOffsetY = centerPositionM.y - renderOriginM.y;
  const centerOffsetZ = centerPositionM.z - renderOriginM.z;
  const renderUnitsPerMeter = 1 / metersPerRenderUnit;

  for (let offset = 0; offset < positionsM.length; offset += 3) {
    const relativeX = requiredComponent(positionsM, offset);
    const relativeY = requiredComponent(positionsM, offset + 1);
    const relativeZ = requiredComponent(positionsM, offset + 2);
    output[offset] = (centerOffsetX + relativeX) * renderUnitsPerMeter;
    output[offset + 1] = (centerOffsetZ + relativeZ) * renderUnitsPerMeter;
    output[offset + 2] = -(centerOffsetY + relativeY) * renderUnitsPerMeter;
  }
  return output;
}

/** Smooth, monotonic intensity used for distance-based orbit/trail fading. */
export function calculateDistantPathIntensity(
  normalizedDistance: number,
  kind: EphemerisPathKind,
): number {
  if (!Number.isFinite(normalizedDistance)) {
    throw new RangeError('Normalized path distance must be finite.');
  }
  const bounded = Math.min(Math.max(normalizedDistance, 0), 1);
  const smoothDistance = bounded * bounded * (3 - 2 * bounded);
  const farIntensity = kind === 'trail' ? 0.42 : 0.08;
  return 1 - (1 - farIntensity) * smoothDistance;
}

/**
 * Writes vertex colors whose intensity falls with physical distance from the
 * current body. Trails retain a brighter distant portion than orbit lines.
 */
export function writeDistanceFadedPathColors(
  output: Float32Array,
  positionsM: Float64Array,
  centerPositionM: PhysicalPosition,
  currentBodyPositionM: PhysicalPosition,
  color: LinearRgb,
  kind: EphemerisPathKind,
): Float32Array {
  assertPathArrays(output, positionsM, 3, 'color');
  assertFinitePosition(centerPositionM, 'Path center');
  assertFinitePosition(currentBodyPositionM, 'Current body');
  assertColor(color);

  const centerToBodyX = centerPositionM.x - currentBodyPositionM.x;
  const centerToBodyY = centerPositionM.y - currentBodyPositionM.y;
  const centerToBodyZ = centerPositionM.z - currentBodyPositionM.z;
  let minimumDistance = Number.POSITIVE_INFINITY;
  let maximumDistance = 0;

  for (let offset = 0; offset < positionsM.length; offset += 3) {
    const distance = pointDistance(
      positionsM,
      offset,
      centerToBodyX,
      centerToBodyY,
      centerToBodyZ,
    );
    minimumDistance = Math.min(minimumDistance, distance);
    maximumDistance = Math.max(maximumDistance, distance);
  }

  const distanceRange = maximumDistance - minimumDistance;
  for (let offset = 0; offset < positionsM.length; offset += 3) {
    const distance = pointDistance(
      positionsM,
      offset,
      centerToBodyX,
      centerToBodyY,
      centerToBodyZ,
    );
    const normalizedDistance =
      distanceRange > 0 ? (distance - minimumDistance) / distanceRange : 0;
    const intensity = calculateDistantPathIntensity(normalizedDistance, kind);
    output[offset] = color.r * intensity;
    output[offset + 1] = color.g * intensity;
    output[offset + 2] = color.b * intensity;
  }
  return output;
}

function pointDistance(
  positionsM: Float64Array,
  offset: number,
  centerToBodyX: number,
  centerToBodyY: number,
  centerToBodyZ: number,
): number {
  return Math.hypot(
    centerToBodyX + requiredComponent(positionsM, offset),
    centerToBodyY + requiredComponent(positionsM, offset + 1),
    centerToBodyZ + requiredComponent(positionsM, offset + 2),
  );
}

function assertPathArrays(
  output: Float32Array,
  positionsM: Float64Array,
  componentCount: number,
  label: string,
): void {
  if (
    positionsM.length < componentCount * 2 ||
    positionsM.length % componentCount !== 0
  ) {
    throw new RangeError(`Ephemeris path ${label} mapping requires at least two xyz points.`);
  }
  if (output.length !== positionsM.length) {
    throw new RangeError(`Ephemeris path ${label} output length must match its source.`);
  }
}

function assertFinitePosition(position: PhysicalPosition, label: string): void {
  if (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(position.z)
  ) {
    throw new RangeError(`${label} must contain finite components.`);
  }
}

function assertColor(color: LinearRgb): void {
  if (
    !Number.isFinite(color.r) ||
    !Number.isFinite(color.g) ||
    !Number.isFinite(color.b) ||
    color.r < 0 ||
    color.g < 0 ||
    color.b < 0
  ) {
    throw new RangeError('Path color must contain finite non-negative components.');
  }
}

function requiredComponent(values: Float64Array, index: number): number {
  const value = values[index];
  if (value === undefined || !Number.isFinite(value)) {
    throw new RangeError(`Ephemeris path contains an invalid component at ${index}.`);
  }
  return value;
}
