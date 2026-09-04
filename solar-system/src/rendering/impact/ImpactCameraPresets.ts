import { Vector3 } from 'three';

import {
  IMPACT_CAMERA_PRESET_IDS,
  type ImpactCameraPose,
  type ImpactCameraPresetId,
  type ImpactRenderState,
} from './ImpactRenderTypes';

const MINIMUM_RADIUS = 1e-9;
const NORMAL = new Vector3();
const EAST = new Vector3();
const NORTH = new Vector3();
const SURFACE = new Vector3();
const IMPACTOR = new Vector3();
const MOTION = new Vector3();
const POSITION = new Vector3();
const TARGET = new Vector3();
const UP = new Vector3();

/** Resolves a deterministic event-camera pose in target-visual-root-local units. */
export function resolveImpactCameraPose(
  presetId: ImpactCameraPresetId,
  state: Readonly<ImpactRenderState>,
  presentationMultiplier = 1,
): Readonly<ImpactCameraPose> {
  if (!IMPACT_CAMERA_PRESET_IDS.includes(presetId)) {
    throw new RangeError(`Unsupported impact camera preset "${String(presetId)}".`);
  }
  const radiusM = requirePositive(state.targetRadiusM, 'target radius');
  setNormalized(NORMAL, state.impactNormalBodyLocal, 'impact normal');
  setNormalized(EAST, state.impactEastBodyLocal, 'impact east');
  setNormalized(NORTH, state.impactNorthBodyLocal, 'impact north');
  SURFACE.copy(NORMAL);
  setImpactorPosition(IMPACTOR, state, radiusM);

  switch (presetId) {
    case 'overview':
      POSITION.copy(NORMAL).multiplyScalar(4.4)
        .addScaledVector(EAST, 1.7)
        .addScaledVector(NORTH, 1.35);
      TARGET.copy(SURFACE).lerp(IMPACTOR, 0.18);
      UP.copy(NORTH);
      break;
    case 'orbital':
      POSITION.copy(NORMAL).multiplyScalar(2.65)
        .addScaledVector(EAST, 1.1)
        .addScaledVector(NORTH, 0.72);
      TARGET.copy(SURFACE).lerp(IMPACTOR, 0.28);
      UP.copy(NORTH);
      break;
    case 'side-entry': {
      resolveApproachMotion(MOTION, state, radiusM);
      POSITION.copy(IMPACTOR)
        .addScaledVector(MOTION, -0.34)
        .addScaledVector(EAST, 2.05)
        .addScaledVector(NORTH, 0.38);
      TARGET.copy(IMPACTOR).lerp(SURFACE, 0.28);
      UP.copy(NORTH);
      break;
    }
    case 'horizon':
      POSITION.copy(NORMAL).multiplyScalar(1.12)
        .addScaledVector(EAST, -0.42)
        .addScaledVector(NORTH, 0.12);
      TARGET.copy(IMPACTOR).lerp(SURFACE, state.impactorLocalEnuM === null ? 1 : 0.18);
      UP.copy(NORMAL);
      break;
    case 'chase': {
      resolveApproachMotion(MOTION, state, radiusM);
      const chaseDistance = Math.max(
        state.physicalDiameterM / radiusM * 36,
        0.006,
      );
      POSITION.copy(IMPACTOR)
        .addScaledVector(MOTION, -chaseDistance)
        .addScaledVector(NORTH, chaseDistance * 0.36);
      TARGET.copy(IMPACTOR).addScaledVector(MOTION, chaseDistance * 0.25);
      UP.copy(NORTH);
      break;
    }
    case 'ground-observer': {
      // Frame the local event rather than using one planet-wide offset. A
      // kilometre-scale crater on Earth otherwise becomes unreadable from a
      // camera hundreds of kilometres away, while the same fixed offset can
      // look entirely away from a small airless target.
      const localEffectRadius = Math.max(
        state.craterRadiusM,
        state.scorchRadiusM,
        state.flashRadiusM,
        state.plumeRadiusM * 0.35,
      ) * Math.max(1, presentationMultiplier) / radiusM;
      const enhancedPresentation = presentationMultiplier > 1.001;
      // The renderer's adaptive near plane supports a genuinely local view.
      // Keep the observer several effect radii away while retaining a small
      // floor for low-energy events and a regional ceiling for giant events.
      // Earth and Venus use visual atmosphere shells that extend to roughly
      // 1.03 body radii. Keep the local camera outside those shells; placing
      // it below them turns the entire frame into opaque atmospheric fog and
      // magnifies even an 8K global map beyond its honest ground resolution.
      // The floor therefore gives a regional, rather than ground-level, view.
      const observerDistance = enhancedPresentation
        ? clamp(localEffectRadius * 4, 0.28, 0.44)
        : clamp(localEffectRadius * 7, 0.24, 0.5);
      const observerAltitude = enhancedPresentation
        ? clamp(observerDistance * 0.68, 0.18, 0.3)
        : clamp(observerDistance * 0.82, 0.18, 0.36);
      POSITION.copy(NORMAL).multiplyScalar(1 + observerAltitude)
        .addScaledVector(EAST, -observerDistance * (enhancedPresentation ? 0.84 : 0.68))
        .addScaledVector(NORTH, -observerDistance * (enhancedPresentation ? 0.18 : 0.22));
      if (
        state.eventElapsedSeconds === null
        || state.outcomeKind === 'airburst'
      ) {
        TARGET.copy(IMPACTOR);
      } else {
        const targetHeight = clamp(
          Math.max(
            localEffectRadius * 0.25,
            Math.min(
              state.plumeHeightM * Math.max(1, presentationMultiplier) / radiusM * 0.18,
              localEffectRadius * 2.5,
            ),
          ),
          0.00015,
          0.02,
        );
        TARGET.copy(SURFACE).addScaledVector(NORMAL, targetHeight);
      }
      UP.copy(NORTH);
      break;
    }
  }

  if (POSITION.distanceToSquared(TARGET) < MINIMUM_RADIUS) {
    POSITION.addScaledVector(NORMAL, 0.1);
  }
  orthogonalizeUp(UP, POSITION, TARGET, NORTH);
  return Object.freeze({
    position: frozenVector(POSITION),
    target: frozenVector(TARGET),
    up: frozenVector(UP),
  });
}

function setImpactorPosition(
  output: Vector3,
  state: Readonly<ImpactRenderState>,
  radiusM: number,
): void {
  const position = state.impactorLocalEnuM;
  if (position === null) {
    output.copy(SURFACE).addScaledVector(NORMAL, 0.08);
    return;
  }
  output.copy(SURFACE)
    .addScaledVector(EAST, position.eastM / radiusM)
    .addScaledVector(NORTH, position.northM / radiusM)
    .addScaledVector(NORMAL, position.upM / radiusM);
}

function resolveApproachMotion(
  output: Vector3,
  state: Readonly<ImpactRenderState>,
  radiusM: number,
): void {
  const values = state.trailLocalEnuM;
  if (values.length >= 6 && values.length % 3 === 0) {
    const previous = values.length - 6;
    const current = values.length - 3;
    output.copy(EAST).multiplyScalar(
      ((values[current] ?? 0) - (values[previous] ?? 0)) / radiusM,
    )
      .addScaledVector(
        NORTH,
        ((values[current + 1] ?? 0) - (values[previous + 1] ?? 0)) / radiusM,
      )
      .addScaledVector(
        NORMAL,
        ((values[current + 2] ?? 0) - (values[previous + 2] ?? 0)) / radiusM,
      );
    if (output.lengthSq() > MINIMUM_RADIUS) {
      output.normalize();
      return;
    }
  }
  output.copy(NORMAL).multiplyScalar(-0.92).addScaledVector(EAST, 0.38).normalize();
}

function orthogonalizeUp(
  output: Vector3,
  position: Readonly<Vector3>,
  target: Readonly<Vector3>,
  fallback: Readonly<Vector3>,
): void {
  MOTION.copy(target).sub(position).normalize();
  output.addScaledVector(MOTION, -output.dot(MOTION));
  if (output.lengthSq() < MINIMUM_RADIUS) {
    output.copy(fallback).addScaledVector(MOTION, -fallback.dot(MOTION));
  }
  if (output.lengthSq() < MINIMUM_RADIUS) output.set(0, 1, 0);
  output.normalize();
}

function setNormalized(
  output: Vector3,
  value: Readonly<{ x: number; y: number; z: number }>,
  label: string,
): void {
  output.set(value.x, value.y, value.z);
  if (!Number.isFinite(output.x) || !Number.isFinite(output.y) || !Number.isFinite(output.z)) {
    throw new RangeError(`Impact ${label} must contain finite components.`);
  }
  if (output.lengthSq() < MINIMUM_RADIUS) {
    throw new RangeError(`Impact ${label} must be non-zero.`);
  }
  output.normalize();
}

function frozenVector(value: Readonly<Vector3>): Readonly<{ x: number; y: number; z: number }> {
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}

function requirePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Impact ${label} must be finite and positive.`);
  }
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
