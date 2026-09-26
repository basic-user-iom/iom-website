import type { VisualQuality } from '../bodies/VisualQuality';
import type { EphemerisProvider } from '../../simulation/ephemeris/EphemerisProvider';
import {
  createEphemerisStateVector,
  type EphemerisStateVector,
} from '../../simulation/ephemeris/EphemerisTypes';
import { ASTRONOMICAL_UNIT_M, SECONDS_PER_DAY } from '../../simulation/core/Units';
import type { Vec3d } from '../../simulation/core/Vec3d';

const SOLAR_GRAVITATIONAL_PARAMETER_M3_S2 = 1.327_124_400_18e20;
const MINIMUM_HELIOCENTRIC_DISTANCE_M = 1e9;

export interface CometActivityProfile {
  readonly onsetDistanceAu: number;
  readonly peakDistanceAu: number;
  readonly comaRadiusKm: number;
  readonly ionTailLengthAu: number;
  readonly dustTailAgeDays: number;
  readonly dustRadiationPressureBeta: number;
  readonly dustEjectionSpeedMps: number;
  readonly deterministicSeed: number;
}

export interface CometTailSample {
  readonly bodyId: string;
  readonly jdTdb: number;
  readonly heliocentricDistanceM: number;
  readonly activity: number;
  readonly ionDirection: Readonly<Vec3d>;
  /** Nucleus-relative heliocentric-ecliptic xyz positions in metres. */
  readonly ionPositionsM: Float64Array;
  /** Nucleus-relative heliocentric-ecliptic xyz positions in metres. */
  readonly dustPositionsM: Float64Array;
  readonly dustBirthJdTdb: Float64Array;
  readonly dustHistorySpanDays: number;
  readonly dustCurvatureM: number;
}

export interface CometTailSamplingOptions {
  readonly quality?: VisualQuality;
  readonly sunPositionM?: Readonly<Vec3d>;
}

/**
 * Deterministic, educational comet-tail model.
 *
 * The ion tail is tied to the instantaneous anti-solar direction. Dust is
 * reconstructed from time-stamped historical nucleus states, retains its
 * emission velocity, and follows solar gravity reduced by radiation pressure.
 * It is a two-body dust approximation, not a dust-plasma or N-body simulation.
 */
export function sampleCometTail(
  provider: EphemerisProvider,
  bodyId: string,
  jdTdb: number,
  profile: Readonly<CometActivityProfile>,
  options: CometTailSamplingOptions = {},
): Readonly<CometTailSample> {
  assertActivityProfile(profile);
  if (!Number.isFinite(jdTdb)) {
    throw new RangeError('Comet-tail epoch must be finite JD TDB.');
  }
  const quality = options.quality ?? 'high';
  const sun = options.sunPositionM ?? ORIGIN;
  assertFiniteVector(sun, 'Sun position');

  const current = createEphemerisStateVector();
  provider.sample(bodyId, jdTdb, current);
  const sunToComet = subtract(current.positionM, sun);
  const heliocentricDistanceM = Math.max(length(sunToComet), MINIMUM_HELIOCENTRIC_DISTANCE_M);
  const ionDirection = normalize(sunToComet);
  const activity = cometActivityAtDistance(
    heliocentricDistanceM / ASTRONOMICAL_UNIT_M,
    profile,
  );
  const ionPositionsM = createIonTailPositions(
    ionDirection,
    activity,
    profile,
    ION_POINT_BUDGET[quality],
  );
  const dust = createDustTailPositions(
    provider,
    bodyId,
    jdTdb,
    current,
    sun,
    activity,
    profile,
    DUST_POINT_BUDGET[quality],
  );

  return Object.freeze({
    bodyId,
    jdTdb,
    heliocentricDistanceM,
    activity,
    ionDirection: Object.freeze(ionDirection),
    ionPositionsM,
    dustPositionsM: dust.positionsM,
    dustBirthJdTdb: dust.birthJdTdb,
    dustHistorySpanDays: dust.historySpanDays,
    dustCurvatureM: dust.curvatureM,
  });
}

export function cometActivityAtDistance(
  heliocentricDistanceAu: number,
  profile: Pick<CometActivityProfile, 'onsetDistanceAu' | 'peakDistanceAu'>,
): number {
  if (!Number.isFinite(heliocentricDistanceAu) || heliocentricDistanceAu < 0) {
    throw new RangeError('Comet heliocentric distance must be finite and non-negative.');
  }
  if (
    !Number.isFinite(profile.peakDistanceAu) ||
    !Number.isFinite(profile.onsetDistanceAu) ||
    profile.peakDistanceAu <= 0 ||
    profile.onsetDistanceAu <= profile.peakDistanceAu
  ) {
    throw new RangeError('Comet activity distances must satisfy 0 < peak < onset.');
  }
  const normalized = clamp01(
    (profile.onsetDistanceAu - heliocentricDistanceAu) /
      (profile.onsetDistanceAu - profile.peakDistanceAu),
  );
  return normalized * normalized * (3 - 2 * normalized);
}

export function qualityTailPointBudget(
  quality: VisualQuality,
): Readonly<{ ion: number; dust: number }> {
  return Object.freeze({ ion: ION_POINT_BUDGET[quality], dust: DUST_POINT_BUDGET[quality] });
}

interface DustTailResult {
  readonly positionsM: Float64Array;
  readonly birthJdTdb: Float64Array;
  readonly historySpanDays: number;
  readonly curvatureM: number;
}

function createIonTailPositions(
  direction: Readonly<Vec3d>,
  activity: number,
  profile: Readonly<CometActivityProfile>,
  pointCount: number,
): Float64Array {
  const positions = new Float64Array(pointCount * 3);
  const tailLengthM =
    profile.ionTailLengthAu * ASTRONOMICAL_UNIT_M * Math.max(0.04, activity ** 0.55);
  const tangent = orthogonalUnit(direction);
  for (let index = 0; index < pointCount; index += 1) {
    const fraction = index / (pointCount - 1);
    const distance = tailLengthM * fraction;
    // Solar-wind structure gives the narrow ribbon a restrained low-frequency
    // waver without turning the anti-solar tail into a hooked neon stroke.
    const ripple = Math.sin(fraction * Math.PI * 2.4 + profile.deterministicSeed * 1e-4);
    const lateral = tailLengthM * 0.00055 * ripple * fraction;
    const offset = index * 3;
    positions[offset] = direction.x * distance + tangent.x * lateral;
    positions[offset + 1] = direction.y * distance + tangent.y * lateral;
    positions[offset + 2] = direction.z * distance + tangent.z * lateral;
  }
  return positions;
}

function createDustTailPositions(
  provider: EphemerisProvider,
  bodyId: string,
  jdTdb: number,
  current: EphemerisStateVector,
  sunPositionM: Readonly<Vec3d>,
  activity: number,
  profile: Readonly<CometActivityProfile>,
  requestedPointCount: number,
): DustTailResult {
  const coverage = provider.getCoverage(bodyId);
  const availableHistoryDays = coverage === undefined
    ? profile.dustTailAgeDays
    : Math.max(0, jdTdb - coverage.startJdTdb);
  const historySpanDays = Math.min(
    profile.dustTailAgeDays * Math.max(0.08, activity ** 0.45),
    availableHistoryDays,
  );
  const grainsPerAgeBin = 4;
  const ageBinCount = Math.max(2, Math.floor(requestedPointCount / grainsPerAgeBin));
  const pointCount = ageBinCount * grainsPerAgeBin;
  const positions = new Float64Array(pointCount * 3);
  const births = new Float64Array(pointCount);
  const spinePositions = new Float64Array(ageBinCount * 3);
  const emitted = createEphemerisStateVector();
  const random = createDeterministicRandom(profile.deterministicSeed ^ hashString(bodyId));
  // A range of grain sizes fills a dust fan; these are illustrative beta
  // samples, not four coherent rotating jets.
  const betas = [0.35, 0.7, 1.2, 2.0].map((scale) =>
    profile.dustRadiationPressureBeta * scale);
  for (let ageIndex = 0; ageIndex < ageBinCount; ageIndex += 1) {
    const ageDays = ageIndex / (ageBinCount - 1) * historySpanDays;
    const birthJdTdb = jdTdb - ageDays;
    provider.sample(bodyId, birthJdTdb, emitted);
    const radialAtBirth = subtract(emitted.positionM, sunPositionM);
    const outward = normalize(radialAtBirth);
    const orbitalNormal = normalize(cross(radialAtBirth, emitted.velocityMps));
    const transverse = normalize(cross(orbitalNormal, outward));
    for (let grain = 0; grain < grainsPerAgeBin; grain += 1) {
      const phase = random() * Math.PI * 2;
      const speed = profile.dustEjectionSpeedMps * (0.4 + random() * 0.6);
      const velocity = {
        x: emitted.velocityMps.x + speed * (transverse.x * Math.cos(phase) +
          orbitalNormal.x * Math.sin(phase) * 0.25),
        y: emitted.velocityMps.y + speed * (transverse.y * Math.cos(phase) +
          orbitalNormal.y * Math.sin(phase) * 0.25),
        z: emitted.velocityMps.z + speed * (transverse.z * Math.cos(phase) +
          orbitalNormal.z * Math.sin(phase) * 0.25),
      };
      const position = propagateDustGrain(radialAtBirth, velocity,
        ageDays * SECONDS_PER_DAY, betas[grain] ?? profile.dustRadiationPressureBeta);
      const index = ageIndex * grainsPerAgeBin + grain;
      births[index] = birthJdTdb;
      const relative = subtract(position, subtract(current.positionM, sunPositionM));
      positions[index * 3] = relative.x;
      positions[index * 3 + 1] = relative.y;
      positions[index * 3 + 2] = relative.z;
      spinePositions[ageIndex * 3] = (spinePositions[ageIndex * 3] ?? 0) + relative.x / grainsPerAgeBin;
      spinePositions[ageIndex * 3 + 1] = (spinePositions[ageIndex * 3 + 1] ?? 0) + relative.y / grainsPerAgeBin;
      spinePositions[ageIndex * 3 + 2] = (spinePositions[ageIndex * 3 + 2] ?? 0) + relative.z / grainsPerAgeBin;
    }
  }

  return {
    positionsM: positions,
    birthJdTdb: births,
    historySpanDays,
    curvatureM: polylineCurvature(spinePositions),
  };
}

/** Velocity Verlet in heliocentric metres; beta=0 is ordinary solar gravity. */
export function propagateDustGrain(
  initialPosition: Readonly<Vec3d>,
  initialVelocity: Readonly<Vec3d>,
  ageSeconds: number,
  beta: number,
): Vec3d {
  assertFiniteVector(initialPosition, 'Dust position');
  assertFiniteVector(initialVelocity, 'Dust velocity');
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || !Number.isFinite(beta) || beta < 0) {
    throw new RangeError('Dust age and beta must be finite and non-negative.');
  }
  const steps = Math.min(512, Math.max(1, Math.ceil(ageSeconds / 21_600)));
  const dt = ageSeconds / steps;
  const mu = SOLAR_GRAVITATIONAL_PARAMETER_M3_S2 * (1 - beta);
  let { x, y, z } = initialPosition;
  let { x: vx, y: vy, z: vz } = initialVelocity;
  const accelerationScale = (): number => {
    const radius = Math.max(Math.hypot(x, y, z), MINIMUM_HELIOCENTRIC_DISTANCE_M);
    return -mu / (radius * radius * radius);
  };
  let factor = accelerationScale();
  let ax = x * factor, ay = y * factor, az = z * factor;
  for (let step = 0; step < steps; step += 1) {
    x += vx * dt + 0.5 * ax * dt * dt;
    y += vy * dt + 0.5 * ay * dt * dt;
    z += vz * dt + 0.5 * az * dt * dt;
    factor = accelerationScale();
    const nextAx = x * factor, nextAy = y * factor, nextAz = z * factor;
    vx += 0.5 * (ax + nextAx) * dt;
    vy += 0.5 * (ay + nextAy) * dt;
    vz += 0.5 * (az + nextAz) * dt;
    ax = nextAx; ay = nextAy; az = nextAz;
  }
  return { x, y, z };
}

function polylineCurvature(points: Float64Array): number {
  const count = points.length / 3;
  if (count < 3) return 0;
  const first = packedPoint(points, 0);
  const last = packedPoint(points, count - 1);
  const chord = subtract(last, first);
  const chordLengthSquared = dot(chord, chord);
  if (chordLengthSquared <= 0) return 0;
  let maximum = 0;
  for (let index = 1; index < count - 1; index += 1) {
    const point = subtract(packedPoint(points, index), first);
    const projection = dot(point, chord) / chordLengthSquared;
    const perpendicular = {
      x: point.x - chord.x * projection,
      y: point.y - chord.y * projection,
      z: point.z - chord.z * projection,
    };
    maximum = Math.max(maximum, length(perpendicular));
  }
  return maximum;
}

function packedPoint(points: Float64Array, index: number): Vec3d {
  const offset = index * 3;
  const x = points[offset];
  const y = points[offset + 1];
  const z = points[offset + 2];
  if (x === undefined || y === undefined || z === undefined) {
    throw new RangeError(`Packed vector index ${index} is outside the tail position buffer.`);
  }
  return { x, y, z };
}

function assertActivityProfile(profile: Readonly<CometActivityProfile>): void {
  cometActivityAtDistance(profile.peakDistanceAu, profile);
  for (const [label, value] of Object.entries({
    comaRadiusKm: profile.comaRadiusKm,
    ionTailLengthAu: profile.ionTailLengthAu,
    dustTailAgeDays: profile.dustTailAgeDays,
    dustRadiationPressureBeta: profile.dustRadiationPressureBeta,
    dustEjectionSpeedMps: profile.dustEjectionSpeedMps,
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`Comet activity ${label} must be finite and positive.`);
    }
  }
  if (!Number.isInteger(profile.deterministicSeed)) {
    throw new RangeError('Comet deterministic seed must be an integer.');
  }
}

function assertFiniteVector(vector: Readonly<Vec3d>, label: string): void {
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) {
    throw new RangeError(`${label} must contain finite components.`);
  }
}

function subtract(left: Readonly<Vec3d>, right: Readonly<Vec3d>): Vec3d {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

function length(vector: Readonly<Vec3d>): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector: Readonly<Vec3d>): Vec3d {
  const magnitude = length(vector);
  if (!(magnitude > 0)) return { x: 1, y: 0, z: 0 };
  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude };
}

function cross(left: Readonly<Vec3d>, right: Readonly<Vec3d>): Vec3d {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function dot(left: Readonly<Vec3d>, right: Readonly<Vec3d>): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function orthogonalUnit(direction: Readonly<Vec3d>): Vec3d {
  const reference = Math.abs(direction.z) < 0.8
    ? ({ x: 0, y: 0, z: 1 } satisfies Vec3d)
    : ({ x: 0, y: 1, z: 0 } satisfies Vec3d);
  return normalize(cross(direction, reference));
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

const ORIGIN: Readonly<Vec3d> = Object.freeze({ x: 0, y: 0, z: 0 });
const ION_POINT_BUDGET: Readonly<Record<VisualQuality, number>> = Object.freeze({
  low: 32,
  medium: 64,
  high: 112,
  ultra: 160,
});
const DUST_POINT_BUDGET: Readonly<Record<VisualQuality, number>> = Object.freeze({
  low: 56,
  medium: 112,
  high: 192,
  ultra: 288,
});

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);
