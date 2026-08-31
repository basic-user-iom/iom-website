import { Quaternion, Vector3 } from 'three';

import { mapCameraRelativePosition } from '../CameraRelativeTransform';
import { CameraRig } from './CameraRig';
import {
  getCameraCloseUpPreset,
  type CameraCloseUpPreset,
  type CameraCloseUpPresetId,
} from './CameraCloseUpPresets';
import {
  CAMERA_MODES,
  type CameraBodyTarget,
  type CameraControllerStatus,
  type CameraMode,
  type CameraUpdateFrame,
} from './CameraTypes';

export interface CameraControllerOptions {
  readonly responseTimeSeconds?: number;
  readonly focusRadiusMultiplier?: number;
  readonly minimumFocusDistanceRenderUnits?: number;
  readonly overviewDistanceMultiplier?: number;
  readonly overviewElevationMultiplier?: number;
  readonly topDownDistanceMultiplier?: number;
  readonly chaseDistanceMultiplier?: number;
  readonly chaseElevationFraction?: number;
  readonly chaseLookAheadFraction?: number;
  readonly earthMoonDistanceMultiplier?: number;
}

interface ResolvedCameraControllerOptions {
  readonly responseTimeSeconds: number;
  readonly focusRadiusMultiplier: number;
  readonly minimumFocusDistanceRenderUnits: number;
  readonly overviewDistanceMultiplier: number;
  readonly overviewElevationMultiplier: number;
  readonly topDownDistanceMultiplier: number;
  readonly chaseDistanceMultiplier: number;
  readonly chaseElevationFraction: number;
  readonly chaseLookAheadFraction: number;
  readonly earthMoonDistanceMultiplier: number;
}

const ECLIPTIC_NORTH = new Vector3(0, 1, 0);
const TOP_DOWN_UP = new Vector3(0, 0, -1);
const DEFAULT_FOCUS_DIRECTION = new Vector3(1, 0.42, 1).normalize();
const HELIOCENTRIC_ORIGIN_M = Object.freeze({ x: 0, y: 0, z: 0 });
const DEFAULT_OPTIONS: ResolvedCameraControllerOptions = Object.freeze({
  responseTimeSeconds: 0.22,
  focusRadiusMultiplier: 8,
  minimumFocusDistanceRenderUnits: 1e-6,
  overviewDistanceMultiplier: 2.2,
  overviewElevationMultiplier: 0.55,
  topDownDistanceMultiplier: 1.45,
  chaseDistanceMultiplier: 12,
  chaseElevationFraction: 0.32,
  chaseLookAheadFraction: 0.65,
  earthMoonDistanceMultiplier: 3.5,
});

/**
 * Mode logic for a rebased Three.js camera. It transports moving targets
 * exactly, then damps only pose changes, avoiding large-coordinate follow lag.
 */
export class CameraController {
  public readonly rig = new CameraRig();

  private readonly options: ResolvedCameraControllerOptions;
  private modeValue: CameraMode = 'overview';
  private targetBodyIdValue: string | null = null;
  private targetAvailableValue = false;
  private originRevisionValue = 0;
  private initialized = false;
  private frameMetersPerRenderUnit = 1;
  private frameOriginM = { x: 0, y: 0, z: 0 };
  private trackedBodyId: string | null = null;
  private capturedFocusKey = '';
  private freeOrbitPoseInitialized = false;
  private closeUpPresetValue: Readonly<CameraCloseUpPreset> | null = null;

  private readonly lastMappedBody = new Vector3();
  private readonly mappedBody = new Vector3();
  private readonly mappedEarth = new Vector3();
  private readonly mappedMoon = new Vector3();
  private readonly earthMoonAxis = new Vector3();
  private readonly mappedCenter = new Vector3();
  private readonly frameTranslation = new Vector3();
  private readonly targetTranslation = new Vector3();
  private readonly desiredPosition = new Vector3();
  private readonly desiredTarget = new Vector3();
  private readonly focusDirection = DEFAULT_FOCUS_DIRECTION.clone();
  private readonly chaseDirection = new Vector3(1, 0, 0);
  private readonly scratch = new Vector3();
  private readonly extentScratch = new Vector3();
  private readonly presetDirection = new Vector3();
  private readonly presetUp = new Vector3();
  private readonly presetOrientation = new Quaternion();

  public constructor(options: CameraControllerOptions = {}) {
    this.options = resolveOptions(options);
  }

  public get mode(): CameraMode {
    return this.modeValue;
  }

  public setMode(mode: CameraMode): void {
    if (!CAMERA_MODES.includes(mode)) {
      throw new RangeError(`Unsupported camera mode "${String(mode)}".`);
    }
    if (mode === 'earth-moon-system' && this.targetBodyIdValue !== 'earth') {
      this.setTargetBody('earth');
    }
    this.closeUpPresetValue = null;
    if (mode === this.modeValue) {
      return;
    }
    this.modeValue = mode;
    this.capturedFocusKey = '';
    if (mode !== 'free-orbit') {
      this.freeOrbitPoseInitialized = false;
    }
  }

  public setTargetBody(bodyId: string | null): void {
    if (bodyId !== null && bodyId.trim().length === 0) {
      throw new RangeError('Camera target body ID cannot be empty.');
    }
    this.closeUpPresetValue = null;
    if (bodyId === this.targetBodyIdValue) {
      return;
    }
    this.targetBodyIdValue = bodyId;
    this.trackedBodyId = null;
    this.capturedFocusKey = '';
    this.freeOrbitPoseInitialized = false;
  }

  public focusBody(bodyId: string, mode: CameraMode = 'body-follow'): void {
    this.setTargetBody(bodyId);
    this.setMode(mode);
  }

  public applyCloseUpPreset(presetId: CameraCloseUpPresetId): void {
    const preset = getCameraCloseUpPreset(presetId);
    this.setTargetBody(preset.bodyId);
    this.setMode('body-follow');
    this.closeUpPresetValue = preset;
    this.capturedFocusKey = '';
    this.freeOrbitPoseInitialized = false;
  }

  /** Synchronizes user-controlled OrbitControls state back into the rig. */
  public synchronizeFreeOrbitPose(
    position: Readonly<Vector3>,
    target: Readonly<Vector3>,
    up: Readonly<Vector3> = ECLIPTIC_NORTH,
  ): void {
    this.rig.synchronizePose(position, target, up);
    this.freeOrbitPoseInitialized = true;
  }

  /**
   * Hands the exact in-flight cinematic pose to user-controlled free orbit.
   * Current and desired poses are synchronized so interruption never snaps to
   * a newly calculated focus pose.
   */
  public interruptToFreeOrbit(): void {
    this.closeUpPresetValue = null;
    this.modeValue = 'free-orbit';
    this.capturedFocusKey = '';
    this.rig.synchronizePose(this.rig.position, this.rig.target, this.rig.up);
    this.freeOrbitPoseInitialized = true;
  }

  public update(frame: CameraUpdateFrame): void {
    validateFrame(frame);
    if (this.initialized) {
      this.remapFrameIfNeeded(frame);
    } else {
      this.frameMetersPerRenderUnit = frame.metersPerRenderUnit;
      copyPhysicalPosition(this.frameOriginM, frame.originM);
    }
    this.originRevisionValue = frame.originRevision;

    const targetBody = this.resolveTarget(frame);
    const moonTarget = frame.bodies.get('moon');
    this.targetAvailableValue =
      this.modeValue === 'earth-moon-system'
        ? targetBody !== null && moonTarget !== undefined && moonTarget.visible !== false
        : targetBody !== null;
    this.transportTrackedBody(frame, targetBody);

    mapCameraRelativePosition(
      this.mappedCenter,
      HELIOCENTRIC_ORIGIN_M,
      frame.originM,
      frame.metersPerRenderUnit,
    );
    const overviewRadius = resolveOverviewRadius(
      frame,
      this.mappedCenter,
      this.extentScratch,
    );
    this.updateDesiredPose(frame, targetBody, overviewRadius);

    if (!this.initialized) {
      this.rig.snapToDesired();
      this.initialized = true;
      return;
    }
    this.rig.advance(
      frame.realDeltaSeconds,
      this.options.responseTimeSeconds,
      frame.reducedMotion ?? false,
    );
  }

  public get status(): CameraControllerStatus {
    return Object.freeze({
      mode: this.modeValue,
      targetBodyId: this.targetBodyIdValue,
      targetAvailable: this.targetAvailableValue,
      originRevision: this.originRevisionValue,
      closeUpPresetId: this.closeUpPresetValue?.id ?? null,
    });
  }

  private resolveTarget(frame: CameraUpdateFrame): CameraBodyTarget | null {
    if (this.targetBodyIdValue === null || this.modeValue === 'overview') {
      return null;
    }
    const target = frame.bodies.get(this.targetBodyIdValue);
    return target !== undefined && target.visible !== false ? target : null;
  }

  private remapFrameIfNeeded(frame: CameraUpdateFrame): void {
    const originChanged =
      frame.originM.x !== this.frameOriginM.x ||
      frame.originM.y !== this.frameOriginM.y ||
      frame.originM.z !== this.frameOriginM.z;
    const scaleChanged = frame.metersPerRenderUnit !== this.frameMetersPerRenderUnit;
    if (!originChanged && !scaleChanged) {
      return;
    }

    const coordinateScale =
      this.frameMetersPerRenderUnit / frame.metersPerRenderUnit;
    this.frameTranslation.set(
      (this.frameOriginM.x - frame.originM.x) / frame.metersPerRenderUnit,
      (this.frameOriginM.z - frame.originM.z) / frame.metersPerRenderUnit,
      (frame.originM.y - this.frameOriginM.y) / frame.metersPerRenderUnit,
    );
    this.rig.remapLocalFrame(coordinateScale, this.frameTranslation);
    if (this.trackedBodyId !== null) {
      this.lastMappedBody
        .multiplyScalar(coordinateScale)
        .add(this.frameTranslation);
    }

    this.frameMetersPerRenderUnit = frame.metersPerRenderUnit;
    copyPhysicalPosition(this.frameOriginM, frame.originM);
  }

  private transportTrackedBody(
    frame: CameraUpdateFrame,
    targetBody: CameraBodyTarget | null,
  ): void {
    if (targetBody === null) {
      this.trackedBodyId = null;
      return;
    }
    mapCameraRelativePosition(
      this.mappedBody,
      targetBody.positionM,
      frame.originM,
      frame.metersPerRenderUnit,
    );
    if (this.trackedBodyId === targetBody.bodyId) {
      this.targetTranslation.copy(this.mappedBody).sub(this.lastMappedBody);
      this.rig.transport(this.targetTranslation);
    }
    this.lastMappedBody.copy(this.mappedBody);
    this.trackedBodyId = targetBody.bodyId;
  }

  private updateDesiredPose(
    frame: CameraUpdateFrame,
    targetBody: CameraBodyTarget | null,
    overviewRadius: number,
  ): void {
    switch (this.modeValue) {
      case 'overview':
        this.setOverviewPose(overviewRadius);
        return;
      case 'free-orbit':
        this.setFreeOrbitPose(targetBody, frame);
        return;
      case 'body-follow':
        this.setBodyFollowPose(targetBody, frame, overviewRadius);
        return;
      case 'earth-moon-system':
        this.setEarthMoonSystemPose(targetBody, frame, overviewRadius);
        return;
      case 'top-down-ecliptic':
        this.setTopDownPose(targetBody, frame, overviewRadius);
        return;
      case 'chase':
        this.setChasePose(targetBody, frame, overviewRadius);
        return;
    }
  }

  private setOverviewPose(overviewRadius: number): void {
    this.desiredPosition
      .copy(this.mappedCenter)
      .addScaledVector(ECLIPTIC_NORTH, overviewRadius * this.options.overviewElevationMultiplier);
    this.desiredPosition.z += overviewRadius * this.options.overviewDistanceMultiplier;
    this.rig.setDesiredPose(
      this.desiredPosition,
      this.mappedCenter,
      ECLIPTIC_NORTH,
    );
  }

  private setFreeOrbitPose(
    targetBody: CameraBodyTarget | null,
    frame: CameraUpdateFrame,
  ): void {
    if (this.freeOrbitPoseInitialized) {
      return;
    }
    if (targetBody === null) {
      this.rig.setDesiredPose(this.rig.position, this.rig.target, this.rig.up);
    } else {
      this.prepareFocusDirection('free-orbit');
      const distance = this.focusDistance(targetBody, frame);
      this.desiredPosition
        .copy(this.mappedBody)
        .addScaledVector(this.focusDirection, distance);
      this.rig.setDesiredPose(
        this.desiredPosition,
        this.mappedBody,
        ECLIPTIC_NORTH,
      );
    }
    this.freeOrbitPoseInitialized = true;
  }

  private setBodyFollowPose(
    targetBody: CameraBodyTarget | null,
    frame: CameraUpdateFrame,
    overviewRadius: number,
  ): void {
    if (targetBody === null) {
      this.setOverviewPose(overviewRadius);
      return;
    }
    if (this.closeUpPresetValue !== null) {
      this.setCloseUpPresetPose(targetBody, frame, this.closeUpPresetValue);
      return;
    }
    this.prepareFocusDirection('body-follow');
    this.desiredPosition
      .copy(this.mappedBody)
      .addScaledVector(this.focusDirection, this.focusDistance(targetBody, frame));
    this.rig.setDesiredPose(
      this.desiredPosition,
      this.mappedBody,
      ECLIPTIC_NORTH,
    );
  }

  private setEarthMoonSystemPose(
    earthTarget: CameraBodyTarget | null,
    frame: CameraUpdateFrame,
    overviewRadius: number,
  ): void {
    const moonTarget = frame.bodies.get('moon');
    if (
      earthTarget === null ||
      earthTarget.bodyId !== 'earth' ||
      moonTarget === undefined ||
      moonTarget.visible === false
    ) {
      this.setBodyFollowPose(earthTarget, frame, overviewRadius);
      return;
    }

    mapCameraRelativePosition(
      this.mappedEarth,
      earthTarget.positionM,
      frame.originM,
      frame.metersPerRenderUnit,
    );
    mapCameraRelativePosition(
      this.mappedMoon,
      moonTarget.positionM,
      frame.originM,
      frame.metersPerRenderUnit,
    );
    this.earthMoonAxis.copy(this.mappedMoon).sub(this.mappedEarth);
    const separation = this.earthMoonAxis.length();
    const earthRadius = this.renderRadius(earthTarget, frame);
    const moonRadius = this.renderRadius(moonTarget, frame);
    let framingRadius: number;

    if (separation <= Math.abs(earthRadius - moonRadius)) {
      const earthContainsMoon = earthRadius >= moonRadius;
      this.desiredTarget.copy(earthContainsMoon ? this.mappedEarth : this.mappedMoon);
      framingRadius = Math.max(earthRadius, moonRadius);
    } else {
      framingRadius = (separation + earthRadius + moonRadius) * 0.5;
      this.desiredTarget
        .copy(this.mappedEarth)
        .addScaledVector(this.earthMoonAxis, (framingRadius - earthRadius) / separation);
    }

    const cameraDistance = Math.max(
      this.options.minimumFocusDistanceRenderUnits,
      framingRadius * this.options.earthMoonDistanceMultiplier,
    );
    this.desiredPosition
      .copy(this.desiredTarget)
      .addScaledVector(ECLIPTIC_NORTH, cameraDistance);
    this.rig.setDesiredPose(this.desiredPosition, this.desiredTarget, TOP_DOWN_UP);
  }

  private setCloseUpPresetPose(
    targetBody: CameraBodyTarget,
    frame: CameraUpdateFrame,
    preset: Readonly<CameraCloseUpPreset>,
  ): void {
    this.presetDirection.set(
      preset.cameraDirectionVisualLocal.x,
      preset.cameraDirectionVisualLocal.y,
      preset.cameraDirectionVisualLocal.z,
    );
    this.presetUp.set(
      preset.upDirectionVisualLocal.x,
      preset.upDirectionVisualLocal.y,
      preset.upDirectionVisualLocal.z,
    );
    const orientation = targetBody.visualLocalToScene;
    if (orientation !== undefined) {
      this.presetOrientation
        .set(orientation.x, orientation.y, orientation.z, orientation.w)
        .normalize();
      this.presetDirection.applyQuaternion(this.presetOrientation);
      this.presetUp.applyQuaternion(this.presetOrientation);
    }
    const distance = Math.max(
      this.options.minimumFocusDistanceRenderUnits,
      this.renderRadius(targetBody, frame) * preset.distanceRadiusMultiplier,
    );
    this.desiredPosition
      .copy(this.mappedBody)
      .addScaledVector(this.presetDirection, distance);
    this.rig.setDesiredPose(this.desiredPosition, this.mappedBody, this.presetUp);
  }

  private setTopDownPose(
    targetBody: CameraBodyTarget | null,
    frame: CameraUpdateFrame,
    overviewRadius: number,
  ): void {
    const target = targetBody === null ? this.mappedCenter : this.mappedBody;
    const focusDistance =
      targetBody === null ? 0 : this.focusDistance(targetBody, frame);
    const altitude = Math.max(
      focusDistance,
      overviewRadius * this.options.topDownDistanceMultiplier,
    );
    this.desiredPosition.copy(target).addScaledVector(ECLIPTIC_NORTH, altitude);
    this.rig.setDesiredPose(this.desiredPosition, target, TOP_DOWN_UP);
  }

  private setChasePose(
    targetBody: CameraBodyTarget | null,
    frame: CameraUpdateFrame,
    overviewRadius: number,
  ): void {
    if (targetBody === null) {
      this.setOverviewPose(overviewRadius);
      return;
    }

    setMappedDirection(this.scratch, targetBody.velocityMps);
    if (this.scratch.lengthSq() > 0) {
      this.chaseDirection.copy(this.scratch).normalize();
    }
    const distance = Math.max(
      this.focusDistance(targetBody, frame),
      this.renderRadius(targetBody, frame) * this.options.chaseDistanceMultiplier,
    );
    this.desiredPosition
      .copy(this.mappedBody)
      .addScaledVector(this.chaseDirection, -distance)
      .addScaledVector(ECLIPTIC_NORTH, distance * this.options.chaseElevationFraction);
    this.desiredTarget
      .copy(this.mappedBody)
      .addScaledVector(this.chaseDirection, distance * this.options.chaseLookAheadFraction);
    this.rig.setDesiredPose(
      this.desiredPosition,
      this.desiredTarget,
      ECLIPTIC_NORTH,
    );
  }

  private prepareFocusDirection(strategy: string): void {
    const key = `${strategy}:${this.targetBodyIdValue ?? ''}`;
    if (key === this.capturedFocusKey) {
      return;
    }
    this.scratch.copy(this.rig.position).sub(this.rig.target);
    this.focusDirection.copy(
      this.scratch.lengthSq() > 1e-20
        ? this.scratch.normalize()
        : DEFAULT_FOCUS_DIRECTION,
    );
    this.capturedFocusKey = key;
  }

  private focusDistance(
    targetBody: CameraBodyTarget,
    frame: CameraUpdateFrame,
  ): number {
    return Math.max(
      this.options.minimumFocusDistanceRenderUnits,
      this.renderRadius(targetBody, frame) * this.options.focusRadiusMultiplier,
    );
  }

  private renderRadius(
    targetBody: CameraBodyTarget,
    frame: CameraUpdateFrame,
  ): number {
    return targetBody.radiusRenderUnits ?? targetBody.radiusM / frame.metersPerRenderUnit;
  }
}

function resolveOverviewRadius(
  frame: CameraUpdateFrame,
  mappedCenter: Readonly<Vector3>,
  mapped: Vector3,
): number {
  if (frame.overviewRadiusRenderUnits !== undefined) {
    if (
      !Number.isFinite(frame.overviewRadiusRenderUnits) ||
      frame.overviewRadiusRenderUnits <= 0
    ) {
      throw new RangeError('Overview radius must be finite and positive.');
    }
    return frame.overviewRadiusRenderUnits;
  }

  let radius = 1;
  for (const body of frame.bodies.values()) {
    if (body.visible === false) continue;
    mapCameraRelativePosition(
      mapped,
      body.positionM,
      frame.originM,
      frame.metersPerRenderUnit,
    );
    const renderRadius = body.radiusRenderUnits ?? body.radiusM / frame.metersPerRenderUnit;
    radius = Math.max(radius, mapped.distanceTo(mappedCenter) + renderRadius);
  }
  return radius;
}

function setMappedDirection(output: Vector3, physical: Readonly<{ x: number; y: number; z: number }>): void {
  output.set(physical.x, physical.z, -physical.y);
}

function validateFrame(frame: CameraUpdateFrame): void {
  if (!Number.isFinite(frame.realDeltaSeconds) || frame.realDeltaSeconds < 0) {
    throw new RangeError('Camera frame delta must be finite and non-negative.');
  }
  if (!Number.isFinite(frame.metersPerRenderUnit) || frame.metersPerRenderUnit <= 0) {
    throw new RangeError('Camera frame scale must be finite and positive.');
  }
  if (!Number.isInteger(frame.originRevision) || frame.originRevision < 0) {
    throw new RangeError('Camera origin revision must be a non-negative integer.');
  }
  if (
    !Number.isFinite(frame.originM.x) ||
    !Number.isFinite(frame.originM.y) ||
    !Number.isFinite(frame.originM.z)
  ) {
    throw new RangeError('Camera origin must contain finite components.');
  }
  for (const body of frame.bodies.values()) {
    if (
      !Number.isFinite(body.positionM.x) ||
      !Number.isFinite(body.positionM.y) ||
      !Number.isFinite(body.positionM.z) ||
      !Number.isFinite(body.velocityMps.x) ||
      !Number.isFinite(body.velocityMps.y) ||
      !Number.isFinite(body.velocityMps.z)
    ) {
      throw new RangeError(
        `Camera target "${body.bodyId}" must contain finite position and velocity components.`,
      );
    }
    if (!Number.isFinite(body.radiusM) || body.radiusM < 0) {
      throw new RangeError(`Camera target "${body.bodyId}" has an invalid radius.`);
    }
    if (
      body.radiusRenderUnits !== undefined &&
      (!Number.isFinite(body.radiusRenderUnits) || body.radiusRenderUnits < 0)
    ) {
      throw new RangeError(
        `Camera target "${body.bodyId}" has an invalid rendered radius.`,
      );
    }
    if (body.visualLocalToScene !== undefined) {
      const orientation = body.visualLocalToScene;
      const normSquared =
        orientation.x * orientation.x +
        orientation.y * orientation.y +
        orientation.z * orientation.z +
        orientation.w * orientation.w;
      if (
        !Number.isFinite(orientation.x) ||
        !Number.isFinite(orientation.y) ||
        !Number.isFinite(orientation.z) ||
        !Number.isFinite(orientation.w) ||
        !Number.isFinite(normSquared) ||
        normSquared <= 0
      ) {
        throw new RangeError(
          `Camera target "${body.bodyId}" has an invalid scene orientation.`,
        );
      }
    }
  }
}

function resolveOptions(
  options: CameraControllerOptions,
): ResolvedCameraControllerOptions {
  const resolved = {
    responseTimeSeconds:
      options.responseTimeSeconds ?? DEFAULT_OPTIONS.responseTimeSeconds,
    focusRadiusMultiplier:
      options.focusRadiusMultiplier ?? DEFAULT_OPTIONS.focusRadiusMultiplier,
    minimumFocusDistanceRenderUnits:
      options.minimumFocusDistanceRenderUnits ??
      DEFAULT_OPTIONS.minimumFocusDistanceRenderUnits,
    overviewDistanceMultiplier:
      options.overviewDistanceMultiplier ??
      DEFAULT_OPTIONS.overviewDistanceMultiplier,
    overviewElevationMultiplier:
      options.overviewElevationMultiplier ??
      DEFAULT_OPTIONS.overviewElevationMultiplier,
    topDownDistanceMultiplier:
      options.topDownDistanceMultiplier ??
      DEFAULT_OPTIONS.topDownDistanceMultiplier,
    chaseDistanceMultiplier:
      options.chaseDistanceMultiplier ??
      DEFAULT_OPTIONS.chaseDistanceMultiplier,
    chaseElevationFraction:
      options.chaseElevationFraction ?? DEFAULT_OPTIONS.chaseElevationFraction,
    chaseLookAheadFraction:
      options.chaseLookAheadFraction ?? DEFAULT_OPTIONS.chaseLookAheadFraction,
    earthMoonDistanceMultiplier:
      options.earthMoonDistanceMultiplier ?? DEFAULT_OPTIONS.earthMoonDistanceMultiplier,
  };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Camera option "${name}" must be finite and non-negative.`);
    }
  }
  if (
    resolved.focusRadiusMultiplier === 0 ||
    resolved.minimumFocusDistanceRenderUnits === 0 ||
    resolved.overviewDistanceMultiplier === 0 ||
    resolved.topDownDistanceMultiplier === 0 ||
    resolved.chaseDistanceMultiplier === 0 ||
    resolved.earthMoonDistanceMultiplier === 0
  ) {
    throw new RangeError('Camera distance multipliers must be positive.');
  }
  return Object.freeze(resolved);
}

function copyPhysicalPosition(
  output: { x: number; y: number; z: number },
  input: Readonly<{ x: number; y: number; z: number }>,
): void {
  output.x = input.x;
  output.y = input.y;
  output.z = input.z;
}
