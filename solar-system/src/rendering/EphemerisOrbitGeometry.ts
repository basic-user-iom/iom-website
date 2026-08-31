import type { ObservatoryBodyId } from '../simulation/bodies/ObservatoryBodyCatalog';
import { SECONDS_PER_DAY } from '../simulation/core/Units';
import type { EphemerisProvider } from '../simulation/ephemeris/EphemerisProvider';
import { createEphemerisStateVector } from '../simulation/ephemeris/EphemerisTypes';
import type { EphemerisCoverage } from '../simulation/ephemeris/EphemerisTypes';

export type EphemerisPathKind = 'orbit' | 'trail';
export type EphemerisPathCoordinateSemantics = 'source-frame' | 'center-relative';

export interface EphemerisPathGeometry {
  readonly kind: EphemerisPathKind;
  readonly bodyId: ObservatoryBodyId;
  /** Null means coordinates stay in the provider's declared source frame. */
  readonly centerBodyId: ObservatoryBodyId | null;
  readonly sourceProviderId: string;
  readonly source: 'ephemeris';
  readonly coordinateSemantics: EphemerisPathCoordinateSemantics;
  readonly requestedStartJdTdb: number;
  readonly requestedEndJdTdb: number;
  readonly startJdTdb: number;
  readonly endJdTdb: number;
  readonly truncatedStart: boolean;
  readonly truncatedEnd: boolean;
  /** One value per point, matching positionsM by point index. */
  readonly sampleJdTdb: Float64Array;
  /** Interleaved x/y/z SI metres; never converted or flattened here. */
  readonly positionsM: Float64Array;
  readonly warning: string | null;
}

interface EphemerisPathSamplingOptions {
  readonly centerBodyId?: ObservatoryBodyId | null;
  readonly maxPoints?: number;
  readonly samplesPerSourceInterval?: number;
}

export interface EphemerisOrbitGeometryOptions extends EphemerisPathSamplingOptions {
  readonly epochJdTdb: number;
  /** Display window only. All geometry still comes from ephemeris samples. */
  readonly spanDays?: number;
}

export interface EphemerisTrailGeometryOptions extends EphemerisPathSamplingOptions {
  readonly endJdTdb: number;
  readonly durationDays: number;
}

/**
 * Nominal display windows select ephemeris intervals; they are never used to
 * analytically reconstruct an orbit. The returned line remains open because
 * perturbed start/end states need not coincide.
 */
export const EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS: Readonly<
  Record<Exclude<ObservatoryBodyId, 'sun'>, number>
> = Object.freeze({
  mercury: 88,
  venus: 225,
  earth: 366,
  moon: 28,
  mars: 687,
  jupiter: 4_334,
  saturn: 10_760,
  uranus: 30_688,
  neptune: 60_190,
  '1p-halley': 27_900,
  '2p-encke': 1_205,
  '67p-churyumov-gerasimenko': 2_350,
  'c-1995-o1-hale-bopp': 36_525,
  'c-2020-f3-neowise': 36_525,
});

const DEFAULT_MAX_POINTS = 4_097;
const DEFAULT_SAMPLES_PER_SOURCE_INTERVAL = 4;
const ADAPTIVE_SEED_INTERVAL_COUNT = 64;
const MAX_ADAPTIVE_TURN_ANGLE_RAD = Math.PI / 90;
const MAX_ADAPTIVE_SAGITTA_FRACTION = 0.0002;

interface SampledPathPoint {
  readonly jdTdb: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly velocityZ: number;
}

interface AdaptivePathInterval {
  readonly left: SampledPathPoint;
  readonly midpoint: SampledPathPoint;
  readonly right: SampledPathPoint;
  readonly score: number;
}

export function createEphemerisOrbitGeometry(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
  options: EphemerisOrbitGeometryOptions,
): EphemerisPathGeometry {
  assertFiniteJulianDate(options.epochJdTdb, 'Orbit epochJdTdb');
  const spanDays = options.spanDays ?? defaultOrbitSpanDays(bodyId);
  assertPositiveFinite(spanDays, 'Orbit spanDays');
  const halfSpanDays = spanDays / 2;

  return createEphemerisPathGeometry(provider, bodyId, {
    kind: 'orbit',
    requestedStartJdTdb: options.epochJdTdb - halfSpanDays,
    requestedEndJdTdb: options.epochJdTdb + halfSpanDays,
    centerBodyId:
      options.centerBodyId === undefined
        ? defaultOrbitCenterBodyId(bodyId)
        : options.centerBodyId,
    maxPoints: options.maxPoints,
    samplesPerSourceInterval: options.samplesPerSourceInterval,
  });
}

export function createEphemerisTrailGeometry(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
  options: EphemerisTrailGeometryOptions,
): EphemerisPathGeometry {
  assertFiniteJulianDate(options.endJdTdb, 'Trail endJdTdb');
  assertPositiveFinite(options.durationDays, 'Trail durationDays');

  return createEphemerisPathGeometry(provider, bodyId, {
    kind: 'trail',
    requestedStartJdTdb: options.endJdTdb - options.durationDays,
    requestedEndJdTdb: options.endJdTdb,
    centerBodyId: options.centerBodyId ?? null,
    maxPoints: options.maxPoints,
    samplesPerSourceInterval: options.samplesPerSourceInterval,
  });
}

interface ResolvedPathOptions extends EphemerisPathSamplingOptions {
  readonly kind: EphemerisPathKind;
  readonly requestedStartJdTdb: number;
  readonly requestedEndJdTdb: number;
}

function createEphemerisPathGeometry(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
  options: ResolvedPathOptions,
): EphemerisPathGeometry {
  if (options.centerBodyId === bodyId) {
    throw new RangeError(`Ephemeris path "${bodyId}" cannot be relative to itself.`);
  }
  const bodyCoverage = requiredCoverage(provider, bodyId);
  const centerCoverage =
    options.centerBodyId === null || options.centerBodyId === undefined
      ? null
      : requiredCoverage(provider, options.centerBodyId);
  const trustedStartJdTdb = Math.max(
    bodyCoverage.startJdTdb,
    centerCoverage?.startJdTdb ?? Number.NEGATIVE_INFINITY,
  );
  const trustedEndJdTdb = Math.min(
    bodyCoverage.endJdTdb,
    centerCoverage?.endJdTdb ?? Number.POSITIVE_INFINITY,
  );
  const startJdTdb = Math.max(options.requestedStartJdTdb, trustedStartJdTdb);
  const endJdTdb = Math.min(options.requestedEndJdTdb, trustedEndJdTdb);
  if (endJdTdb <= startJdTdb) {
    throw new RangeError(
      `Requested ${options.kind} interval for "${bodyId}" does not overlap trusted ephemeris coverage.`,
    );
  }

  const maxPoints = options.maxPoints ?? DEFAULT_MAX_POINTS;
  if (!Number.isInteger(maxPoints) || maxPoints < 2 || maxPoints > 65_537) {
    throw new RangeError('Ephemeris path maxPoints must be an integer from 2 through 65537.');
  }
  const samplesPerSourceInterval =
    options.samplesPerSourceInterval ?? DEFAULT_SAMPLES_PER_SOURCE_INTERVAL;
  assertPositiveFinite(samplesPerSourceInterval, 'samplesPerSourceInterval');

  const sourceStepSeconds = Math.min(
    bodyCoverage.sampleStepSeconds,
    centerCoverage?.sampleStepSeconds ?? Number.POSITIVE_INFINITY,
  );
  const durationSeconds = (endJdTdb - startJdTdb) * SECONDS_PER_DAY;
  const desiredSegmentSeconds = sourceStepSeconds / samplesPerSourceInterval;
  const desiredPointCount = Math.max(
    2,
    Math.ceil(durationSeconds / desiredSegmentSeconds) + 1,
  );
  const bodyState = createEphemerisStateVector();
  const centerState = createEphemerisStateVector();
  const samplePoint = (jdTdb: number): SampledPathPoint =>
    sampleRelativePathPoint(
      provider,
      bodyId,
      options.centerBodyId ?? null,
      jdTdb,
      bodyState,
      centerState,
    );
  const sampledPoints = desiredPointCount <= maxPoints
    ? sampleUniformPathPoints(startJdTdb, endJdTdb, desiredPointCount, samplePoint)
    : sampleAdaptivePathPoints(startJdTdb, endJdTdb, maxPoints, samplePoint);
  const sampleJdTdb = new Float64Array(sampledPoints.length);
  const positionsM = new Float64Array(sampledPoints.length * 3);
  for (let pointIndex = 0; pointIndex < sampledPoints.length; pointIndex += 1) {
    const point = sampledPoints[pointIndex];
    if (point === undefined) continue;
    sampleJdTdb[pointIndex] = point.jdTdb;
    const offset = pointIndex * 3;
    positionsM[offset] = point.x;
    positionsM[offset + 1] = point.y;
    positionsM[offset + 2] = point.z;
    assertFinitePoint(positionsM, offset, bodyId);
  }

  const truncatedStart = startJdTdb > options.requestedStartJdTdb;
  const truncatedEnd = endJdTdb < options.requestedEndJdTdb;
  const warning = createCoverageWarning(bodyId, truncatedStart, truncatedEnd);
  const centerBodyId = options.centerBodyId ?? null;

  return Object.freeze({
    kind: options.kind,
    bodyId,
    centerBodyId,
    sourceProviderId: provider.id,
    source: 'ephemeris',
    coordinateSemantics: centerBodyId === null ? 'source-frame' : 'center-relative',
    requestedStartJdTdb: options.requestedStartJdTdb,
    requestedEndJdTdb: options.requestedEndJdTdb,
    startJdTdb,
    endJdTdb,
    truncatedStart,
    truncatedEnd,
    sampleJdTdb,
    positionsM,
    warning,
  });
}

function sampleUniformPathPoints(
  startJdTdb: number,
  endJdTdb: number,
  pointCount: number,
  samplePoint: (jdTdb: number) => SampledPathPoint,
): SampledPathPoint[] {
  const points: SampledPathPoint[] = [];
  const pointDenominator = pointCount - 1;
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const jdTdb = pointIndex === pointDenominator
      ? endJdTdb
      : startJdTdb + (endJdTdb - startJdTdb) * (pointIndex / pointDenominator);
    points.push(samplePoint(jdTdb));
  }
  return points;
}

/**
 * A uniform point cap undersamples the short, fast perihelion turn of a very
 * eccentric orbit while wasting most vertices on its slow outer arc. When the
 * requested source cadence exceeds the cap, retain real provider samples but
 * allocate them by measured chord turn and sagitta instead of uniform time.
 */
function sampleAdaptivePathPoints(
  startJdTdb: number,
  endJdTdb: number,
  maxPoints: number,
  samplePoint: (jdTdb: number) => SampledPathPoint,
): SampledPathPoint[] {
  const seedPointCount = Math.min(maxPoints, ADAPTIVE_SEED_INTERVAL_COUNT + 1);
  const acceptedPoints = sampleUniformPathPoints(
    startJdTdb,
    endJdTdb,
    seedPointCount,
    samplePoint,
  );
  const intervals: AdaptivePathInterval[] = [];
  for (let pointIndex = 0; pointIndex < acceptedPoints.length - 1; pointIndex += 1) {
    const left = acceptedPoints[pointIndex];
    const right = acceptedPoints[pointIndex + 1];
    if (left !== undefined && right !== undefined) {
      intervals.push(createAdaptivePathInterval(left, right, samplePoint));
    }
  }

  while (acceptedPoints.length < maxPoints) {
    let highestScore = 1;
    let highestScoreIndex = -1;
    for (let intervalIndex = 0; intervalIndex < intervals.length; intervalIndex += 1) {
      const score = intervals[intervalIndex]?.score ?? Number.NEGATIVE_INFINITY;
      if (score > highestScore) {
        highestScore = score;
        highestScoreIndex = intervalIndex;
      }
    }
    if (highestScoreIndex < 0) break;

    const interval = intervals[highestScoreIndex];
    if (interval === undefined) break;
    acceptedPoints.push(interval.midpoint);
    intervals.splice(
      highestScoreIndex,
      1,
      createAdaptivePathInterval(interval.left, interval.midpoint, samplePoint),
      createAdaptivePathInterval(interval.midpoint, interval.right, samplePoint),
    );
  }

  acceptedPoints.sort((left, right) => left.jdTdb - right.jdTdb);
  return acceptedPoints;
}

function createAdaptivePathInterval(
  left: SampledPathPoint,
  right: SampledPathPoint,
  samplePoint: (jdTdb: number) => SampledPathPoint,
): AdaptivePathInterval {
  const midpointJdTdb = left.jdTdb + (right.jdTdb - left.jdTdb) * 0.5;
  if (midpointJdTdb <= left.jdTdb || midpointJdTdb >= right.jdTdb) {
    return { left, midpoint: left, right, score: Number.NEGATIVE_INFINITY };
  }
  const midpoint = samplePoint(midpointJdTdb);
  return {
    left,
    midpoint,
    right,
    score: adaptivePathIntervalScore(left, midpoint, right),
  };
}

function adaptivePathIntervalScore(
  left: SampledPathPoint,
  midpoint: SampledPathPoint,
  right: SampledPathPoint,
): number {
  const leftSegment = vectorBetween(left, midpoint);
  const rightSegment = vectorBetween(midpoint, right);
  const chord = vectorBetween(left, right);
  const chordLength = vectorLength(chord);
  const pathTurn = angleBetween(leftSegment, rightSegment);
  const velocityTurn = angleBetween(
    [left.velocityX, left.velocityY, left.velocityZ],
    [right.velocityX, right.velocityY, right.velocityZ],
  );
  const sagitta = chordLength <= 0
    ? vectorLength(leftSegment)
    : pointToChordDistance(left, midpoint, chord, chordLength);
  const localRadius = Math.max(
    Math.min(pointRadius(left), pointRadius(midpoint), pointRadius(right)),
    chordLength,
    1,
  );
  return Math.max(
    pathTurn / MAX_ADAPTIVE_TURN_ANGLE_RAD,
    velocityTurn / MAX_ADAPTIVE_TURN_ANGLE_RAD,
    (sagitta / localRadius) / MAX_ADAPTIVE_SAGITTA_FRACTION,
  );
}

function sampleRelativePathPoint(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
  centerBodyId: ObservatoryBodyId | null,
  jdTdb: number,
  bodyState: ReturnType<typeof createEphemerisStateVector>,
  centerState: ReturnType<typeof createEphemerisStateVector>,
): SampledPathPoint {
  provider.sample(bodyId, jdTdb, bodyState);
  if (centerBodyId === null) {
    centerState.positionM.x = 0;
    centerState.positionM.y = 0;
    centerState.positionM.z = 0;
    centerState.velocityMps.x = 0;
    centerState.velocityMps.y = 0;
    centerState.velocityMps.z = 0;
  } else {
    provider.sample(centerBodyId, jdTdb, centerState);
  }
  return {
    jdTdb,
    x: bodyState.positionM.x - centerState.positionM.x,
    y: bodyState.positionM.y - centerState.positionM.y,
    z: bodyState.positionM.z - centerState.positionM.z,
    velocityX: bodyState.velocityMps.x - centerState.velocityMps.x,
    velocityY: bodyState.velocityMps.y - centerState.velocityMps.y,
    velocityZ: bodyState.velocityMps.z - centerState.velocityMps.z,
  };
}

function vectorBetween(
  left: SampledPathPoint,
  right: SampledPathPoint,
): [number, number, number] {
  return [right.x - left.x, right.y - left.y, right.z - left.z];
}

function vectorLength(vector: readonly [number, number, number]): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function angleBetween(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  const denominator = vectorLength(left) * vectorLength(right);
  if (denominator <= 0) return 0;
  const cosine = Math.max(
    -1,
    Math.min(1, (left[0] * right[0] + left[1] * right[1] + left[2] * right[2]) / denominator),
  );
  return Math.acos(cosine);
}

function pointRadius(point: SampledPathPoint): number {
  return Math.hypot(point.x, point.y, point.z);
}

function pointToChordDistance(
  left: SampledPathPoint,
  midpoint: SampledPathPoint,
  chord: readonly [number, number, number],
  chordLength: number,
): number {
  const fromLeft: [number, number, number] = [
    midpoint.x - left.x,
    midpoint.y - left.y,
    midpoint.z - left.z,
  ];
  const projection =
    (fromLeft[0] * chord[0] + fromLeft[1] * chord[1] + fromLeft[2] * chord[2]) /
    (chordLength * chordLength);
  return Math.hypot(
    fromLeft[0] - chord[0] * projection,
    fromLeft[1] - chord[1] * projection,
    fromLeft[2] - chord[2] * projection,
  );
}

function requiredCoverage(
  provider: EphemerisProvider,
  bodyId: ObservatoryBodyId,
): EphemerisCoverage {
  const coverage = provider.getCoverage(bodyId);
  if (!provider.hasBody(bodyId) || coverage === undefined) {
    throw new RangeError(`Ephemeris provider "${provider.id}" has no coverage for "${bodyId}".`);
  }
  if (
    !Number.isFinite(coverage.startJdTdb) ||
    !Number.isFinite(coverage.endJdTdb) ||
    coverage.endJdTdb <= coverage.startJdTdb ||
    !Number.isFinite(coverage.sampleStepSeconds) ||
    coverage.sampleStepSeconds <= 0 ||
    !Number.isInteger(coverage.sampleCount) ||
    coverage.sampleCount < 2
  ) {
    throw new RangeError(
      `Ephemeris provider "${provider.id}" has invalid coverage for "${bodyId}".`,
    );
  }
  return coverage;
}

function defaultOrbitSpanDays(bodyId: ObservatoryBodyId): number {
  if (bodyId === 'sun') {
    throw new RangeError('The Sun has no default heliocentric orbit display window.');
  }
  return EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS[bodyId];
}

function defaultOrbitCenterBodyId(bodyId: ObservatoryBodyId): ObservatoryBodyId | null {
  if (bodyId === 'sun') return null;
  return bodyId === 'moon' ? 'earth' : 'sun';
}

function createCoverageWarning(
  bodyId: ObservatoryBodyId,
  truncatedStart: boolean,
  truncatedEnd: boolean,
): string | null {
  if (!truncatedStart && !truncatedEnd) return null;
  const boundary =
    truncatedStart && truncatedEnd
      ? 'at both ends'
      : `at the ${truncatedStart ? 'start' : 'end'}`;
  return `${bodyId} path is truncated ${boundary} by bundled ephemeris coverage; no missing arc was fabricated.`;
}

function assertFinitePoint(positions: Float64Array, offset: number, bodyId: string): void {
  if (
    !Number.isFinite(positions[offset]) ||
    !Number.isFinite(positions[offset + 1]) ||
    !Number.isFinite(positions[offset + 2])
  ) {
    throw new RangeError(`Ephemeris provider returned a non-finite position for "${bodyId}".`);
  }
}

function assertFiniteJulianDate(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}
