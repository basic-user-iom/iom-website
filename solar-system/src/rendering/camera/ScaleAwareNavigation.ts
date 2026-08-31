export interface ScaleAwareNavigationInput {
  readonly cameraDistanceRenderUnits: number;
  readonly targetRadiusM: number;
  readonly targetRadiusRenderUnits?: number;
  readonly metersPerRenderUnit: number;
  readonly verticalFovDeg: number;
  readonly viewportWidthPx: number;
  readonly viewportHeightPx: number;
  readonly systemRadiusRenderUnits: number;
}

export interface ScaleAwareNavigationMetrics {
  readonly targetRadiusRenderUnits: number;
  readonly minimumDistanceRenderUnits: number;
  readonly maximumDistanceRenderUnits: number;
  readonly renderUnitsPerPixel: number;
  readonly physicalMetersPerPixel: number;
  readonly orbitRadiansPerPixel: number;
  readonly keyboardSpeedRenderUnitsPerSecond: number;
}

const MINIMUM_NAVIGATION_DISTANCE = 1e-6;

/** Derives navigation sensitivity from the current view rather than one global speed. */
export function calculateScaleAwareNavigation(
  input: ScaleAwareNavigationInput,
): ScaleAwareNavigationMetrics {
  assertPositive(input.cameraDistanceRenderUnits, 'Camera distance');
  assertNonNegative(input.targetRadiusM, 'Target radius');
  assertPositive(input.metersPerRenderUnit, 'Meters per render unit');
  assertPositive(input.viewportWidthPx, 'Viewport width');
  assertPositive(input.viewportHeightPx, 'Viewport height');
  assertPositive(input.systemRadiusRenderUnits, 'System radius');
  if (
    !Number.isFinite(input.verticalFovDeg) ||
    input.verticalFovDeg <= 0 ||
    input.verticalFovDeg >= 179
  ) {
    throw new RangeError('Vertical field of view must be between 0 and 179 degrees.');
  }

  const targetRadiusRenderUnits =
    input.targetRadiusRenderUnits ?? input.targetRadiusM / input.metersPerRenderUnit;
  assertNonNegative(targetRadiusRenderUnits, 'Rendered target radius');

  const minimumDistanceRenderUnits = Math.max(
    MINIMUM_NAVIGATION_DISTANCE,
    targetRadiusRenderUnits * 1.2,
  );
  const maximumDistanceRenderUnits = Math.max(
    minimumDistanceRenderUnits * 2,
    input.systemRadiusRenderUnits * 6,
  );
  const halfVerticalFovRad = (input.verticalFovDeg * Math.PI) / 360;
  const renderUnitsPerPixel =
    (2 * input.cameraDistanceRenderUnits * Math.tan(halfVerticalFovRad)) /
    input.viewportHeightPx;
  const orbitRadiansPerPixel = Math.PI / Math.min(
    input.viewportWidthPx,
    input.viewportHeightPx,
  );
  const keyboardSpeedRenderUnitsPerSecond = Math.max(
    targetRadiusRenderUnits * 4,
    input.cameraDistanceRenderUnits * 0.75,
    MINIMUM_NAVIGATION_DISTANCE,
  );

  return Object.freeze({
    targetRadiusRenderUnits,
    minimumDistanceRenderUnits,
    maximumDistanceRenderUnits,
    renderUnitsPerPixel,
    physicalMetersPerPixel: renderUnitsPerPixel * input.metersPerRenderUnit,
    orbitRadiansPerPixel,
    keyboardSpeedRenderUnitsPerSecond,
  });
}

/** Multiplicative dolly keeps a wheel notch useful near Earth and at Neptune. */
export function dollyDistanceForWheel(
  currentDistanceRenderUnits: number,
  wheelDeltaY: number,
  metrics: ScaleAwareNavigationMetrics,
  zoomExponentPerWheelUnit = 0.0015,
): number {
  assertPositive(currentDistanceRenderUnits, 'Camera distance');
  if (!Number.isFinite(wheelDeltaY)) {
    throw new RangeError('Wheel delta must be finite.');
  }
  assertPositive(zoomExponentPerWheelUnit, 'Wheel zoom exponent');

  const requested =
    currentDistanceRenderUnits * Math.exp(wheelDeltaY * zoomExponentPerWheelUnit);
  return clamp(
    requested,
    metrics.minimumDistanceRenderUnits,
    metrics.maximumDistanceRenderUnits,
  );
}

export function panDistanceForPixels(
  pixelDelta: number,
  metrics: ScaleAwareNavigationMetrics,
): number {
  if (!Number.isFinite(pixelDelta)) {
    throw new RangeError('Pan pixel delta must be finite.');
  }
  return pixelDelta * metrics.renderUnitsPerPixel;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and non-negative.`);
  }
}
