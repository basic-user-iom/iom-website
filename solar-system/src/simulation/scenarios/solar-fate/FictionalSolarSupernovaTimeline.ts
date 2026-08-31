import type { SimulationContext } from '../../core/SimulationContext';
import { ASTRONOMICAL_UNIT_M } from '../../core/Units';
import type {
  FictionalRadiationArrival,
  FictionalSolarSupernovaRemnantKind,
  FictionalSolarSupernovaStage,
} from './FictionalSolarSupernovaTypes';
import {
  SOLAR_FATE_PLANET_IDS,
  type SolarFatePlanetId,
} from './SolarFateTypes';
import { SOLAR_MEAN_RADIUS_M } from './SolarEvolutionProfile';

export const FICTIONAL_SOLAR_SUPERNOVA_TIMELINE = Object.freeze({
  version: 'fictional-solar-supernova-timeline-v1',
  surfacePulseStartSeconds: 0,
  coreFlashStartSeconds: 2,
  shockStartSeconds: 4,
  radiationStartSeconds: 6,
  shockEndSeconds: 10,
  debrisStartSeconds: 10,
  radiationEndSeconds: 18,
  remnantStartSeconds: 25,
  totalDurationSeconds: 40,
});

export interface FictionalRadiationDistance {
  readonly bodyId: SolarFatePlanetId;
  readonly distanceM: number;
  readonly source: 'captured-ephemeris' | 'nominal-fallback';
}

export interface FictionalTimelineSample {
  readonly stage: Exclude<FictionalSolarSupernovaStage, 'idle' | 'complete'>;
  readonly pulseScale: number;
  readonly pulseIntensity: number;
  readonly flashIntensity: number;
  readonly coreRadiusM: number;
  readonly shockProgress: number;
  readonly shockRadiusM: number;
  readonly radiationFrontProgress: number;
  readonly radiationFrontRadiusM: number;
  readonly radiationArrivals: readonly Readonly<FictionalRadiationArrival>[];
  readonly heatingByBody: Readonly<Record<SolarFatePlanetId, number>>;
  readonly debrisProgress: number;
  readonly debrisRadiusM: number;
  readonly debrisOpacity: number;
  readonly nebulaRadiusM: number;
  readonly nebulaOpacity: number;
  readonly remnantBlend: number;
  readonly remnantRadiusM: number;
}

const NOMINAL_DISTANCE_AU: Readonly<Record<SolarFatePlanetId, number>> =
  Object.freeze({
    mercury: 0.387,
    venus: 0.723,
    earth: 1,
    mars: 1.524,
    jupiter: 5.203,
    saturn: 9.537,
    uranus: 19.191,
    neptune: 30.07,
  });

export function captureFictionalRadiationDistances(
  context: SimulationContext | null,
): readonly Readonly<FictionalRadiationDistance>[] {
  const sunPosition = context?.getBody('sun')?.positionM;
  const sunX = finiteCoordinate(sunPosition?.x) ? sunPosition.x : 0;
  const sunY = finiteCoordinate(sunPosition?.y) ? sunPosition.y : 0;
  const sunZ = finiteCoordinate(sunPosition?.z) ? sunPosition.z : 0;
  const distances = SOLAR_FATE_PLANET_IDS.map((bodyId) => {
    const position = context?.getBody(bodyId)?.positionM;
    const distanceM = position === undefined
      ? Number.NaN
      : Math.hypot(position.x - sunX, position.y - sunY, position.z - sunZ);
    const captured = Number.isFinite(distanceM) && distanceM > SOLAR_MEAN_RADIUS_M;
    return Object.freeze({
      bodyId,
      distanceM: captured
        ? distanceM
        : NOMINAL_DISTANCE_AU[bodyId] * ASTRONOMICAL_UNIT_M,
      source: captured ? 'captured-ephemeris' as const : 'nominal-fallback' as const,
    });
  });
  distances.sort((left, right) => {
    const byDistance = left.distanceM - right.distanceM;
    return byDistance !== 0
      ? byDistance
      : SOLAR_FATE_PLANET_IDS.indexOf(left.bodyId) -
          SOLAR_FATE_PLANET_IDS.indexOf(right.bodyId);
  });
  return Object.freeze(distances);
}

export function createCompressedRadiationArrivals(
  distances: readonly Readonly<FictionalRadiationDistance>[],
): readonly Readonly<FictionalRadiationArrival>[] {
  if (distances.length !== SOLAR_FATE_PLANET_IDS.length) {
    throw new RangeError('Fictional radiation distances must include all eight planets.');
  }
  const receivedBodyIds = new Set(distances.map((entry) => entry.bodyId));
  if (
    receivedBodyIds.size !== SOLAR_FATE_PLANET_IDS.length ||
    SOLAR_FATE_PLANET_IDS.some((bodyId) => !receivedBodyIds.has(bodyId))
  ) {
    throw new RangeError(
      'Fictional radiation distances must include each planet exactly once.',
    );
  }
  const ordered = [...distances].sort((left, right) => left.distanceM - right.distanceM);
  const minimumDistanceM = requiredDistance(ordered[0]).distanceM;
  const maximumDistanceM = requiredDistance(ordered.at(-1)).distanceM;
  const logarithmicRange = Math.log(maximumDistanceM) - Math.log(minimumDistanceM);
  const timeRange =
    FICTIONAL_SOLAR_SUPERNOVA_TIMELINE.radiationEndSeconds -
    FICTIONAL_SOLAR_SUPERNOVA_TIMELINE.radiationStartSeconds;
  return Object.freeze(
    ordered.map((entry, index) => {
      if (!Number.isFinite(entry.distanceM) || entry.distanceM <= 0) {
        throw new RangeError('Fictional radiation distance must be finite and positive.');
      }
      const normalizedDistance = logarithmicRange > 0
        ? (Math.log(entry.distanceM) - Math.log(minimumDistanceM)) /
          logarithmicRange
        : index / Math.max(1, ordered.length - 1);
      return Object.freeze({
        bodyId: entry.bodyId,
        distanceM: entry.distanceM,
        arrivalTimeSeconds:
          FICTIONAL_SOLAR_SUPERNOVA_TIMELINE.radiationStartSeconds +
          normalizedDistance * timeRange,
        reached: false,
        progress: 0,
      });
    }),
  );
}

export function sampleFictionalSolarSupernovaTimeline(
  timeSeconds: number,
  baseArrivals: readonly Readonly<FictionalRadiationArrival>[],
  remnantKind: FictionalSolarSupernovaRemnantKind,
): Readonly<FictionalTimelineSample> {
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new RangeError('Fictional supernova sample time must be finite and non-negative.');
  }
  const timeline = FICTIONAL_SOLAR_SUPERNOVA_TIMELINE;
  const boundedTime = Math.min(timeSeconds, timeline.totalDurationSeconds);
  const maximumDistanceM = requiredArrival(baseArrivals.at(-1)).distanceM;
  const minimumDistanceM = requiredArrival(baseArrivals[0]).distanceM;
  const pulseProgress = clamp01(
    (boundedTime - timeline.surfacePulseStartSeconds) /
      (timeline.coreFlashStartSeconds - timeline.surfacePulseStartSeconds),
  );
  const pulseIntensity = boundedTime < timeline.coreFlashStartSeconds
    ? Math.sin(Math.PI * pulseProgress) ** 2
    : 0;
  const flashProgress = clamp01(
    (boundedTime - timeline.coreFlashStartSeconds) /
      (timeline.shockStartSeconds - timeline.coreFlashStartSeconds),
  );
  const flashIntensity =
    boundedTime >= timeline.coreFlashStartSeconds &&
    boundedTime < timeline.shockStartSeconds
      ? Math.sin(Math.PI * flashProgress)
      : 0;
  const shockProgress = clamp01(
    (boundedTime - timeline.shockStartSeconds) /
      (timeline.shockEndSeconds - timeline.shockStartSeconds),
  );
  const radiationFrontProgress = clamp01(
    (boundedTime - timeline.radiationStartSeconds) /
      (timeline.radiationEndSeconds - timeline.radiationStartSeconds),
  );
  const debrisProgress = clamp01(
    (boundedTime - timeline.debrisStartSeconds) /
      (timeline.remnantStartSeconds - timeline.debrisStartSeconds),
  );
  const remnantBlend = clamp01(
    (boundedTime - timeline.remnantStartSeconds) / 5,
  );
  const remnantRadiusM = remnantKind === 'neutron-star' ? 12_000 : 6_371_000;
  const coreCollapse = smoothstep(
    clamp01((boundedTime - timeline.shockStartSeconds) / 6),
  );
  const coreRadiusM = lerp(
    SOLAR_MEAN_RADIUS_M * (1 + pulseIntensity * 0.18),
    remnantRadiusM,
    coreCollapse,
  );
  const shockRadiusM = boundedTime < timeline.shockStartSeconds
    ? 0
    : lerp(SOLAR_MEAN_RADIUS_M, maximumDistanceM * 1.08, easeOutCubic(shockProgress));
  const radiationFrontRadiusM = boundedTime < timeline.radiationStartSeconds
    ? 0
    : logarithmicFrontDistance(
        minimumDistanceM,
        maximumDistanceM,
        radiationFrontProgress,
      );
  const radiationArrivals = Object.freeze(
    baseArrivals.map((arrival) => Object.freeze({
      ...arrival,
      reached: boundedTime >= arrival.arrivalTimeSeconds,
      progress: clamp01((boundedTime - arrival.arrivalTimeSeconds) / 2),
    })),
  );
  const heatingByBody = createHeatingRecord(radiationArrivals);
  const debrisRadiusM = boundedTime < timeline.debrisStartSeconds
    ? 0
    : lerp(
        SOLAR_MEAN_RADIUS_M,
        maximumDistanceM * 0.78,
        easeOutCubic(debrisProgress),
      );
  const debrisOpacity = clamp01(debrisProgress * (1 - remnantBlend * 0.72));
  const nebulaRadiusM = debrisRadiusM;
  const nebulaRise = clamp01((boundedTime - timeline.debrisStartSeconds) / 8);
  const nebulaOpacity = clamp01(nebulaRise * (1 - remnantBlend * 0.55));

  const sample = Object.freeze({
    stage: stageAtTime(boundedTime),
    pulseScale: 1 + pulseIntensity * 0.18,
    pulseIntensity,
    flashIntensity,
    coreRadiusM,
    shockProgress,
    shockRadiusM,
    radiationFrontProgress,
    radiationFrontRadiusM,
    radiationArrivals,
    heatingByBody,
    debrisProgress,
    debrisRadiusM,
    debrisOpacity,
    nebulaRadiusM,
    nebulaOpacity,
    remnantBlend,
    remnantRadiusM,
  });
  assertFiniteTimelineSample(sample);
  return sample;
}

function stageAtTime(
  timeSeconds: number,
): Exclude<FictionalSolarSupernovaStage, 'idle' | 'complete'> {
  const timeline = FICTIONAL_SOLAR_SUPERNOVA_TIMELINE;
  if (timeSeconds < timeline.coreFlashStartSeconds) return 'surface-pulse';
  if (timeSeconds < timeline.shockStartSeconds) return 'core-flash';
  if (timeSeconds < timeline.radiationStartSeconds) return 'shock-breakout';
  if (timeSeconds < timeline.debrisStartSeconds) return 'radiation-front';
  if (timeSeconds < timeline.remnantStartSeconds) return 'debris-nebula';
  return 'fictional-remnant';
}

function createHeatingRecord(
  arrivals: readonly Readonly<FictionalRadiationArrival>[],
): Readonly<Record<SolarFatePlanetId, number>> {
  const heating = {
    mercury: 0,
    venus: 0,
    earth: 0,
    mars: 0,
    jupiter: 0,
    saturn: 0,
    uranus: 0,
    neptune: 0,
  } satisfies Record<SolarFatePlanetId, number>;
  for (const arrival of arrivals) heating[arrival.bodyId] = smoothstep(arrival.progress);
  return Object.freeze(heating);
}

function logarithmicFrontDistance(
  minimumDistanceM: number,
  maximumDistanceM: number,
  progress: number,
): number {
  if (maximumDistanceM <= minimumDistanceM) return maximumDistanceM;
  return Math.exp(
    lerp(Math.log(minimumDistanceM), Math.log(maximumDistanceM), progress),
  );
}

function assertFiniteTimelineSample(sample: Readonly<FictionalTimelineSample>): void {
  const values = [
    sample.pulseScale,
    sample.pulseIntensity,
    sample.flashIntensity,
    sample.coreRadiusM,
    sample.shockProgress,
    sample.shockRadiusM,
    sample.radiationFrontProgress,
    sample.radiationFrontRadiusM,
    sample.debrisProgress,
    sample.debrisRadiusM,
    sample.debrisOpacity,
    sample.nebulaRadiusM,
    sample.nebulaOpacity,
    sample.remnantBlend,
    sample.remnantRadiusM,
    ...sample.radiationArrivals.flatMap((arrival) => [
      arrival.distanceM,
      arrival.arrivalTimeSeconds,
      arrival.progress,
    ]),
    ...Object.values(sample.heatingByBody),
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Fictional Solar Supernova produced a non-finite snapshot.');
  }
}

function requiredDistance(
  distance: Readonly<FictionalRadiationDistance> | undefined,
): Readonly<FictionalRadiationDistance> {
  if (distance === undefined) throw new Error('Fictional radiation distance is unavailable.');
  return distance;
}

function requiredArrival(
  arrival: Readonly<FictionalRadiationArrival> | undefined,
): Readonly<FictionalRadiationArrival> {
  if (arrival === undefined) throw new Error('Fictional radiation arrival is unavailable.');
  return arrival;
}

function finiteCoordinate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function lerp(left: number, right: number, alpha: number): number {
  return left + (right - left) * alpha;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
