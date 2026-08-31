import type { DebugOrbitTrailRenderState } from './RenderContext';
import type { EphemerisProvider } from '../simulation/ephemeris/EphemerisProvider';
import { createEphemerisStateVector } from '../simulation/ephemeris/EphemerisTypes';
import type { EphemerisBodyId } from '../simulation/bodies/EphemerisBodyCatalog';
import { J2000_JD_TDB } from '../simulation/core/JulianDate';
import { SECONDS_PER_DAY } from '../simulation/core/Units';

const MAX_TRAIL_POINTS = 720;

/** Approximate spans choose how much authoritative sample history to display. */
const TRAIL_SPAN_DAYS: Readonly<Record<Exclude<EphemerisBodyId, 'sun'>, number>> =
  Object.freeze({
    mercury: 88,
    venus: 225,
    earth: 366,
    moon: 28,
    mars: 687,
    jupiter: 4_334,
    saturn: 10_760,
    uranus: 30_688,
    neptune: 60_190,
  });

/**
 * Builds bounded debug lines from exact generated nodes (no analytical or
 * circular geometry). The spans are display choices, not orbital solutions.
 */
export function createEphemerisDebugTrails(
  provider: EphemerisProvider,
  bodyIds: readonly EphemerisBodyId[],
): readonly DebugOrbitTrailRenderState[] {
  const sample = createEphemerisStateVector();
  const trails: DebugOrbitTrailRenderState[] = [];

  for (const bodyId of bodyIds) {
    if (bodyId === 'sun') continue;
    const coverage = provider.getCoverage(bodyId);
    if (coverage === undefined || coverage.sampleCount < 2) continue;

    const desiredIntervals = Math.max(
      1,
      Math.round((TRAIL_SPAN_DAYS[bodyId] * SECONDS_PER_DAY) / coverage.sampleStepSeconds),
    );
    const intervalCount = Math.min(coverage.sampleCount - 1, desiredIntervals);
    const epochCoordinate =
      ((J2000_JD_TDB - coverage.startJdTdb) * SECONDS_PER_DAY) /
      coverage.sampleStepSeconds;
    const epochIndex = Math.min(
      coverage.sampleCount - 1,
      Math.max(0, Math.round(epochCoordinate)),
    );
    const startIndex = Math.min(
      coverage.sampleCount - 1 - intervalCount,
      Math.max(0, epochIndex - Math.floor(intervalCount / 2)),
    );
    const endIndex = startIndex + intervalCount;
    const stride = Math.max(1, Math.ceil(intervalCount / (MAX_TRAIL_POINTS - 1)));
    const indexes: number[] = [];
    for (let index = startIndex; index <= endIndex; index += stride) {
      indexes.push(index);
    }
    if (indexes[indexes.length - 1] !== endIndex) indexes.push(endIndex);

    const positionsM = new Float64Array(indexes.length * 3);
    indexes.forEach((sampleIndex, outputIndex) => {
      const jdTdb =
        coverage.startJdTdb +
        (sampleIndex * coverage.sampleStepSeconds) / SECONDS_PER_DAY;
      provider.sample(bodyId, jdTdb, sample);
      const offset = outputIndex * 3;
      positionsM[offset] = sample.positionM.x;
      positionsM[offset + 1] = sample.positionM.y;
      positionsM[offset + 2] = sample.positionM.z;
    });
    trails.push(Object.freeze({ bodyId, positionsM }));
  }

  return Object.freeze(trails);
}
