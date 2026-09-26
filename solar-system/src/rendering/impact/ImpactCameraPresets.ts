import { airburstWakeLengthM, sampleAirburstWake } from './AirburstPlumeShape';
import { localTerrainTriangleHeightM } from './ImpactTerrainHeight';
import { Vector3 } from 'three';
import { getEarthSurfaceSampler } from '../../simulation/scenarios/impact/EarthSurface';

import {
  IMPACT_CAMERA_PRESET_IDS,
  type ImpactCameraPose,
  type ImpactCameraPresetId,
  type ImpactRenderState,
} from './ImpactRenderTypes';
import { impactorVisualRadiusRatio } from './ImpactVisibility';
import { mapImpactEnuToBodyLocal, setEllipsoidSurfacePoint } from './ImpactSurfaceMath';

const MINIMUM_RADIUS = 1e-18;
const NORMAL = new Vector3();
const EAST = new Vector3();
const NORTH = new Vector3();
const SURFACE = new Vector3();
const IMPACTOR = new Vector3();
const MOTION = new Vector3();
const POSITION = new Vector3();
const TARGET = new Vector3();
const UP = new Vector3();
const SURFACE_NORMAL = new Vector3();
const WAKE = new Vector3();

/** Resolves a deterministic event-camera pose in target-visual-root-local units. */
export function resolveImpactCameraPose(
  presetId: ImpactCameraPresetId,
  state: Readonly<ImpactRenderState>,
  presentationMultiplier = 1,
  viewportAspect = 1,
): Readonly<ImpactCameraPose> {
  if (!IMPACT_CAMERA_PRESET_IDS.includes(presetId)) {
    throw new RangeError(`Unsupported impact camera preset "${String(presetId)}".`);
  }
  const radiusM = requirePositive(state.targetRadiusM, 'target radius');
  setNormalized(NORMAL, state.impactNormalBodyLocal, 'impact normal');
  setNormalized(EAST, state.impactEastBodyLocal, 'impact east');
  setNormalized(NORTH, state.impactNorthBodyLocal, 'impact north');
  setEllipsoidSurfacePoint(SURFACE, NORMAL, state);
  setImpactorPosition(IMPACTOR, state);

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
      const visualRadius = presentationMultiplier > 1 ? impactorVisualRadiusRatio(state.physicalDiameterM, radiusM) : state.physicalDiameterM * 0.5 / radiusM;
      if (state.eventElapsedSeconds !== null && state.outcomeKind !== 'no-impact' &&
        ['airburst', 'impact', 'impact-flash', 'ejecta', 'plume', 'haze', 'aftermath', 'complete'].includes(state.stage)) {
        frameTerminalEvent(state, radiusM, presentationMultiplier, false, viewportAspect);
        break;
      }
      // Prefer a side-oblique chase during bright entry so the air-cap reads as a
      // lens/crescent and the wake as a ribbon — not a face-on disc fog ball.
      const chaseDistance = Math.max(visualRadius * 10, 200 / radiusM);
      POSITION.copy(IMPACTOR)
        .addScaledVector(MOTION, -chaseDistance * 0.72)
        .addScaledVector(NORTH, chaseDistance * 0.42)
        .addScaledVector(EAST, chaseDistance * 0.55);
      TARGET.copy(IMPACTOR).addScaledVector(MOTION, visualRadius * 2.4);
      UP.copy(NORTH);
      break;
    }
    case 'regional': {
      frameTerminalEvent(state, radiusM, presentationMultiplier, true, viewportAspect);
      break;
    }
    case 'ground-observer': {
      // A fixed observer two metres above the measured surface. Normalizing the
      // direction avoids the hidden altitude caused by a tangent-plane offset.
      const requestedDistanceM = Math.max(600, (state.visibilityReferenceSizeM ?? state.physicalDiameterM * 30) * 1.4);
      // Keep Earth observers inside the dense regional terrain. At two metres,
      // the coarse orbital globe cannot provide a continuous ground horizon.
      const distanceM = state.targetBodyId === 'earth' ? Math.min(200000, requestedDistanceM) : requestedDistanceM;
      POSITION.copy(NORMAL).addScaledVector(EAST, -distanceM / radiusM)
        .addScaledVector(NORTH, distanceM * 0.35 / radiusM).normalize();
      const sample = state.targetBodyId === 'earth' ? getEarthSurfaceSampler() : null;
      const altitudeM = sample ? localTerrainTriangleHeightM(POSITION, NORMAL, EAST, NORTH, radiusM, sample)
        : state.earthSurface?.surfaceAltitudeM ?? 0;
      UP.copy(POSITION);
      setEllipsoidSurfacePoint(POSITION, UP, { ...state, earthSurface: undefined });
      POSITION.addScaledVector(UP, (altitudeM + 2) / radiusM);
      TARGET.copy(state.eventElapsedSeconds === null || state.outcomeKind === 'airburst' || state.outcomeKind === 'deep-atmosphere-breakup' ? IMPACTOR : SURFACE);
      if (state.eventElapsedSeconds !== null) TARGET.addScaledVector(NORMAL,
        Math.max(10, Math.min(distanceM * 0.12, state.plumeHeightM * 0.35)) / radiusM);
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

function frameTerminalEvent(
  state: Readonly<ImpactRenderState>, radiusM: number, multiplier: number, observer: boolean, viewportAspect: number,
): void {
  const scale = Math.max(1, multiplier) / radiusM;
  const height = Math.max(60 / radiusM, Math.max(state.flashRadiusM * 3, state.craterRadiusM * 4, state.physicalDiameterM * 20, state.plumeHeightM * state.plumeOpacity * 0.85) * scale);
  const width = Math.max(40 / radiusM, height * 0.7);
  const airborne = state.outcomeKind === 'airburst' || state.outcomeKind === 'deep-atmosphere-breakup';
  const wakeLengthM = airborne ? airburstWakeLengthM(state) : 0;
  const distance = Math.max(150 / radiusM, height * 2.7, width * 3.2, wakeLengthM * scale * 1.6)
    * Math.max(1, 0.85 / Math.max(0.1, viewportAspect));
  resolveApproachMotion(MOTION, state, radiusM);
  MOTION.addScaledVector(NORMAL, -MOTION.dot(NORMAL));
  if (MOTION.lengthSq() < MINIMUM_RADIUS) MOTION.copy(EAST);
  MOTION.normalize();
  UP.copy(NORMAL).cross(MOTION).normalize();
  SURFACE.copy(NORMAL).multiplyScalar(1 + (state.earthSurface?.surfaceAltitudeM ?? 0) / radiusM);
  const anchor = (state.outcomeKind === 'solid-surface-impact' || state.outcomeKind === 'ocean-surface-impact') ? SURFACE : IMPACTOR;
  POSITION.copy(anchor).addScaledVector(MOTION, -distance * (observer ? 0.9 : 0.72))
    .addScaledVector(UP, distance * (observer ? 0.35 : 0.7))
    .addScaledVector(NORMAL, distance * (observer ? 0.32 : 0.5));
  TARGET.copy(anchor).addScaledVector(NORMAL, height * 0.42)
    .addScaledVector(MOTION, width * 0.12);
  if (airborne && wakeLengthM > 0) {
    sampleAirburstWake(WAKE, state, wakeLengthM * 0.35);
    TARGET.addScaledVector(EAST, WAKE.x * scale)
      .addScaledVector(NORTH, WAKE.y * scale)
      .addScaledVector(NORMAL, WAKE.z * scale);
    // Look across the wake, with sky and horizon still in frame.
    POSITION.addScaledVector(NORMAL, -distance * 0.3);
  }
  UP.copy(NORMAL);
}
function setImpactorPosition(
  output: Vector3,
  state: Readonly<ImpactRenderState>,
): void {
  const position = state.impactorLocalEnuM;
  if (position === null) {
    output.copy(SURFACE).addScaledVector(NORMAL, 0.08);
    return;
  }
  mapImpactEnuToBodyLocal(output, position.eastM, position.northM, position.upM,
    state, { normal: NORMAL, east: EAST, north: NORTH }, SURFACE, SURFACE_NORMAL);
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
