import { Vector3, type Camera } from 'three';

export interface ReadonlyCameraRigPose {
  readonly position: Readonly<Vector3>;
  readonly target: Readonly<Vector3>;
  readonly up: Readonly<Vector3>;
}

/**
 * Mutable, allocation-free camera pose with exponentially damped transitions.
 * A controller owns the desired pose; renderers only copy the current pose.
 */
export class CameraRig {
  public readonly position = new Vector3(0, 8, 16);
  public readonly target = new Vector3();
  public readonly up = new Vector3(0, 1, 0);

  private readonly desiredPosition = this.position.clone();
  private readonly desiredTarget = this.target.clone();
  private readonly desiredUp = this.up.clone();

  public setDesiredPose(
    position: Readonly<Vector3>,
    target: Readonly<Vector3>,
    up: Readonly<Vector3>,
  ): void {
    assertFiniteVector(position, 'Camera position');
    assertFiniteVector(target, 'Camera target');
    assertFiniteVector(up, 'Camera up vector');
    if (up.lengthSq() === 0) {
      throw new RangeError('Camera up vector must be non-zero.');
    }

    this.desiredPosition.copy(position);
    this.desiredTarget.copy(target);
    this.desiredUp.copy(up).normalize();
  }

  public snapToDesired(): void {
    this.position.copy(this.desiredPosition);
    this.target.copy(this.desiredTarget);
    this.up.copy(this.desiredUp);
  }

  public advance(
    realDeltaSeconds: number,
    responseTimeSeconds: number,
    reducedMotion = false,
  ): void {
    if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
      throw new RangeError('Camera delta must be finite and non-negative.');
    }
    if (!Number.isFinite(responseTimeSeconds) || responseTimeSeconds < 0) {
      throw new RangeError('Camera response time must be finite and non-negative.');
    }

    const alpha =
      reducedMotion || responseTimeSeconds === 0
        ? 1
        : -Math.expm1(-Math.min(realDeltaSeconds, 0.1) / responseTimeSeconds);
    this.position.lerp(this.desiredPosition, alpha);
    this.target.lerp(this.desiredTarget, alpha);
    this.up.lerp(this.desiredUp, alpha).normalize();
  }

  /** Translate current and desired poses together so tracking adds no lag. */
  public transport(translation: Readonly<Vector3>): void {
    assertFiniteVector(translation, 'Camera transport');
    this.position.add(translation);
    this.target.add(translation);
    this.desiredPosition.add(translation);
    this.desiredTarget.add(translation);
  }

  /**
   * Remap all local coordinates after an origin or distance-scale change.
   * `coordinateScale` is oldMetersPerUnit / newMetersPerUnit.
   */
  public remapLocalFrame(
    coordinateScale: number,
    translation: Readonly<Vector3>,
  ): void {
    if (!Number.isFinite(coordinateScale) || coordinateScale <= 0) {
      throw new RangeError('Camera coordinate scale must be finite and positive.');
    }
    assertFiniteVector(translation, 'Camera frame translation');

    remapVector(this.position, coordinateScale, translation);
    remapVector(this.target, coordinateScale, translation);
    remapVector(this.desiredPosition, coordinateScale, translation);
    remapVector(this.desiredTarget, coordinateScale, translation);
  }

  public synchronizePose(
    position: Readonly<Vector3>,
    target: Readonly<Vector3>,
    up: Readonly<Vector3>,
  ): void {
    this.setDesiredPose(position, target, up);
    this.snapToDesired();
  }

  public applyTo(camera: Camera, controlsTarget?: Vector3): void {
    camera.position.copy(this.position);
    camera.up.copy(this.up);
    camera.lookAt(this.target);
    controlsTarget?.copy(this.target);
  }

  public get pose(): ReadonlyCameraRigPose {
    return this;
  }
}

function remapVector(
  vector: Vector3,
  coordinateScale: number,
  translation: Readonly<Vector3>,
): void {
  vector.multiplyScalar(coordinateScale).add(translation);
}

function assertFiniteVector(value: Readonly<Vector3>, label: string): void {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.z)) {
    throw new RangeError(`${label} must contain finite components.`);
  }
}
