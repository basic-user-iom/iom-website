import type { Vec3d } from '../core/Vec3d';
import { createVec3d } from '../core/Vec3d';
import type { SpacecraftDefinition } from './SpacecraftCatalog';
import { getSpacecraftTrajectoryRecord, spacecraftIsValidAt } from './SpacecraftCatalog';

const SECONDS_PER_DAY = 86_400;

export interface SpacecraftTrajectoryState {
  readonly spacecraftId: string;
  readonly jdTdb: number;
  readonly valid: boolean;
  readonly positionM: Vec3d;
  readonly velocityMps: Vec3d;
  readonly distanceFromSunM: number;
  readonly speedMps: number;
  readonly source: 'JPL_HORIZONS';
  readonly interpolation: 'cubic-hermite';
}

/** Samples bundled JPL Horizons vectors without extrapolating their coverage. */
export function sampleSpacecraftTrajectory(
  mission: Readonly<SpacecraftDefinition>,
  jdTdb: number,
): SpacecraftTrajectoryState {
  if (!Number.isFinite(jdTdb)) throw new RangeError('Spacecraft epoch must be finite.');
  const trajectory = getSpacecraftTrajectoryRecord(mission.id);
  if (trajectory === undefined) throw new RangeError(`No Horizons trajectory exists for "${mission.id}".`);
  if (!spacecraftIsValidAt(mission, jdTdb)) return invalidState(mission.id, jdTdb);

  const sampleOffset = (jdTdb - trajectory.startJdTdb) * SECONDS_PER_DAY / trajectory.stepSeconds;
  const lowerIndex = Math.min(Math.max(Math.floor(sampleOffset), 0), trajectory.sampleCount - 2);
  const u = Math.min(Math.max(sampleOffset - lowerIndex, 0), 1);
  const first = lowerIndex * 6;
  const second = (lowerIndex + 1) * 6;
  const duration = trajectory.stepSeconds;
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  const h01 = -2 * u ** 3 + 3 * u ** 2;
  const h11 = u ** 3 - u ** 2;
  const dh00 = (6 * u ** 2 - 6 * u) / duration;
  const dh10 = 3 * u ** 2 - 4 * u + 1;
  const dh01 = (-6 * u ** 2 + 6 * u) / duration;
  const dh11 = 3 * u ** 2 - 2 * u;
  const position = [0, 1, 2].map((component) =>
    h00 * required(trajectory.valuesSi[first + component]) +
    h10 * duration * required(trajectory.valuesSi[first + 3 + component]) +
    h01 * required(trajectory.valuesSi[second + component]) +
    h11 * duration * required(trajectory.valuesSi[second + 3 + component]));
  const velocity = [0, 1, 2].map((component) =>
    dh00 * required(trajectory.valuesSi[first + component]) +
    dh10 * required(trajectory.valuesSi[first + 3 + component]) +
    dh01 * required(trajectory.valuesSi[second + component]) +
    dh11 * required(trajectory.valuesSi[second + 3 + component]));
  const positionM = createVec3d(required(position[0]), required(position[1]), required(position[2]));
  const velocityMps = createVec3d(required(velocity[0]), required(velocity[1]), required(velocity[2]));
  return Object.freeze({
    spacecraftId: mission.id,
    jdTdb,
    valid: true,
    positionM,
    velocityMps,
    distanceFromSunM: Math.hypot(positionM.x, positionM.y, positionM.z),
    speedMps: Math.hypot(velocityMps.x, velocityMps.y, velocityMps.z),
    source: 'JPL_HORIZONS',
    interpolation: 'cubic-hermite',
  });
}

export function sampleSpacecraftTrajectoryPath(
  mission: Readonly<SpacecraftDefinition>,
  centerJdTdb: number,
  samples = 128,
): Float64Array {
  if (!Number.isInteger(samples) || samples < 2) throw new RangeError('Trajectory samples must be >= 2.');
  const output = new Float64Array(samples * 3);
  const span = mission.validEndJdTdb - mission.validStartJdTdb;
  const center = Math.min(Math.max(centerJdTdb, mission.validStartJdTdb), mission.validEndJdTdb);
  const visibleSpan = Math.min(span, Math.max(240, span * 0.24));
  const start = Math.max(mission.validStartJdTdb, center - visibleSpan * 0.5);
  const end = Math.min(mission.validEndJdTdb, start + visibleSpan);
  const adjustedStart = Math.max(mission.validStartJdTdb, end - visibleSpan);
  for (let index = 0; index < samples; index += 1) {
    const jdTdb = adjustedStart + (end - adjustedStart) * index / (samples - 1);
    const state = sampleSpacecraftTrajectory(mission, jdTdb);
    output[index * 3] = state.positionM.x;
    output[index * 3 + 1] = state.positionM.y;
    output[index * 3 + 2] = state.positionM.z;
  }
  return output;
}

function invalidState(spacecraftId: string, jdTdb: number): SpacecraftTrajectoryState {
  return Object.freeze({
    spacecraftId,
    jdTdb,
    valid: false,
    positionM: createVec3d(),
    velocityMps: createVec3d(),
    distanceFromSunM: 0,
    speedMps: 0,
    source: 'JPL_HORIZONS',
    interpolation: 'cubic-hermite',
  });
}

function required(value: number | undefined): number {
  if (!Number.isFinite(value)) throw new RangeError('Horizons trajectory state is incomplete.');
  return value as number;
}
