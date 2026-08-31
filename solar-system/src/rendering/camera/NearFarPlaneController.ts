import type { PerspectiveCamera, Vector3 } from 'three';

export interface ClipSphere {
  readonly center: Readonly<Vector3>;
  readonly radius: number;
}

export interface NearFarPlaneInput {
  readonly cameraPosition: Readonly<Vector3>;
  readonly focusCenter: Readonly<Vector3>;
  readonly focusRadius: number;
  readonly visibleSpheres?: readonly ClipSphere[];
}

export interface NearFarPlanes {
  readonly near: number;
  readonly far: number;
}

export interface NearFarPlaneOptions {
  readonly minimumNear?: number;
  readonly minimumFar?: number;
  readonly maximumFarNearRatio?: number;
  readonly farMargin?: number;
  readonly nearDistanceFraction?: number;
  readonly focusSurfaceSafetyFraction?: number;
  readonly tightenResponseTimeSeconds?: number;
}

interface ResolvedNearFarPlaneOptions {
  readonly minimumNear: number;
  readonly minimumFar: number;
  readonly maximumFarNearRatio: number;
  readonly farMargin: number;
  readonly nearDistanceFraction: number;
  readonly focusSurfaceSafetyFraction: number;
  readonly tightenResponseTimeSeconds: number;
}

const DEFAULT_OPTIONS: ResolvedNearFarPlaneOptions = Object.freeze({
  minimumNear: 1e-5,
  minimumFar: 10,
  maximumFarNearRatio: 10_000_000,
  farMargin: 1.15,
  nearDistanceFraction: 0.02,
  focusSurfaceSafetyFraction: 0.45,
  tightenResponseTimeSeconds: 0.25,
});

/**
 * Keeps focused surfaces in front of the near plane while tightening the
 * depth range. Expansions happen immediately; safe contractions are damped.
 */
export class NearFarPlaneController {
  private readonly options: ResolvedNearFarPlaneOptions;
  private nearValue = DEFAULT_OPTIONS.minimumNear;
  private farValue = DEFAULT_OPTIONS.minimumFar;
  private initialized = false;

  public constructor(options: NearFarPlaneOptions = {}) {
    this.options = resolveOptions(options);
    this.nearValue = this.options.minimumNear;
    this.farValue = this.options.minimumFar;
  }

  public update(input: NearFarPlaneInput, realDeltaSeconds: number): NearFarPlanes {
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError('Clipping-plane delta must be finite and non-negative.');
    }
    const desired = calculateNearFarPlanes(input, this.options);
    if (!this.initialized) {
      this.nearValue = desired.near;
      this.farValue = desired.far;
      this.initialized = true;
      return this.snapshot();
    }

    const alpha =
      this.options.tightenResponseTimeSeconds === 0
        ? 1
        : -Math.expm1(
            -Math.min(realDeltaSeconds, 0.1) /
              this.options.tightenResponseTimeSeconds,
          );

    // Moving near closer and far farther prevents clipping, so those changes
    // are immediate. Precision-only tightening is deliberately smoothed.
    this.nearValue =
      desired.near < this.nearValue
        ? desired.near
        : lerp(this.nearValue, desired.near, alpha);
    this.farValue =
      desired.far > this.farValue
        ? desired.far
        : lerp(this.farValue, desired.far, alpha);
    this.farValue = Math.max(this.farValue, this.nearValue * 2);
    return this.snapshot();
  }

  public applyTo(camera: PerspectiveCamera): void {
    if (camera.near === this.nearValue && camera.far === this.farValue) {
      return;
    }
    camera.near = this.nearValue;
    camera.far = this.farValue;
    camera.updateProjectionMatrix();
  }

  public reset(): void {
    this.nearValue = this.options.minimumNear;
    this.farValue = this.options.minimumFar;
    this.initialized = false;
  }

  public snapshot(): NearFarPlanes {
    return Object.freeze({ near: this.nearValue, far: this.farValue });
  }
}

export function calculateNearFarPlanes(
  input: NearFarPlaneInput,
  options: NearFarPlaneOptions = {},
): NearFarPlanes {
  const resolved = resolveOptions(options);
  assertFiniteVector(input.cameraPosition, 'Camera position');
  assertFiniteVector(input.focusCenter, 'Focus center');
  assertNonNegative(input.focusRadius, 'Focus radius');

  const focusDistance = distance(input.cameraPosition, input.focusCenter);
  const focusSurfaceGap = Math.max(focusDistance - input.focusRadius, 0);
  const maximumSafeNear = Math.max(
    resolved.minimumNear,
    focusSurfaceGap * resolved.focusSurfaceSafetyFraction,
  );
  const distanceNear = Math.max(
    resolved.minimumNear,
    focusDistance * resolved.nearDistanceFraction,
  );

  let furthestVisibleDistance = focusDistance + input.focusRadius;
  for (const sphere of input.visibleSpheres ?? []) {
    assertFiniteVector(sphere.center, 'Visible sphere center');
    assertNonNegative(sphere.radius, 'Visible sphere radius');
    furthestVisibleDistance = Math.max(
      furthestVisibleDistance,
      distance(input.cameraPosition, sphere.center) + sphere.radius,
    );
  }

  const far = Math.max(
    resolved.minimumFar,
    furthestVisibleDistance * resolved.farMargin,
  );
  const precisionNear = far / resolved.maximumFarNearRatio;
  const near = Math.min(
    Math.max(distanceNear, Math.min(precisionNear, maximumSafeNear)),
    maximumSafeNear,
    far * 0.5,
  );

  return Object.freeze({ near, far });
}

function resolveOptions(options: NearFarPlaneOptions): ResolvedNearFarPlaneOptions {
  const resolved = {
    minimumNear: options.minimumNear ?? DEFAULT_OPTIONS.minimumNear,
    minimumFar: options.minimumFar ?? DEFAULT_OPTIONS.minimumFar,
    maximumFarNearRatio:
      options.maximumFarNearRatio ?? DEFAULT_OPTIONS.maximumFarNearRatio,
    farMargin: options.farMargin ?? DEFAULT_OPTIONS.farMargin,
    nearDistanceFraction:
      options.nearDistanceFraction ?? DEFAULT_OPTIONS.nearDistanceFraction,
    focusSurfaceSafetyFraction:
      options.focusSurfaceSafetyFraction ??
      DEFAULT_OPTIONS.focusSurfaceSafetyFraction,
    tightenResponseTimeSeconds:
      options.tightenResponseTimeSeconds ??
      DEFAULT_OPTIONS.tightenResponseTimeSeconds,
  };

  assertPositive(resolved.minimumNear, 'Minimum near plane');
  assertPositive(resolved.minimumFar, 'Minimum far plane');
  assertPositive(resolved.maximumFarNearRatio, 'Maximum far/near ratio');
  if (resolved.maximumFarNearRatio <= 2) {
    throw new RangeError('Maximum far/near ratio must be greater than two.');
  }
  if (!Number.isFinite(resolved.farMargin) || resolved.farMargin < 1) {
    throw new RangeError('Far margin must be finite and at least one.');
  }
  assertFraction(resolved.nearDistanceFraction, 'Near distance fraction');
  assertFraction(
    resolved.focusSurfaceSafetyFraction,
    'Focus surface safety fraction',
  );
  assertNonNegative(
    resolved.tightenResponseTimeSeconds,
    'Clipping-plane response time',
  );
  return Object.freeze(resolved);
}

function distance(left: Readonly<Vector3>, right: Readonly<Vector3>): number {
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

function assertFiniteVector(value: Readonly<Vector3>, label: string): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new RangeError(`${label} must contain finite components.`);
  }
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

function assertFraction(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError(`${label} must be in the interval (0, 1].`);
  }
}
