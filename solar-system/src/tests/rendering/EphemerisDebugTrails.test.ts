import { createEphemerisDebugTrails } from '../../rendering/EphemerisDebugTrails';
import type { DataProvenance } from '../../simulation/bodies/DataProvenance';
import type { EphemerisProvider } from '../../simulation/ephemeris/EphemerisProvider';
import type {
  EphemerisCoverage,
  EphemerisStateVector,
} from '../../simulation/ephemeris/EphemerisTypes';

describe('createEphemerisDebugTrails', () => {
  it('builds a bounded planet trail from exact provider nodes and omits the Sun', () => {
    const coverage: EphemerisCoverage = {
      startJdTdb: 2_451_000,
      endJdTdb: 2_452_000,
      sampleStepSeconds: 86_400,
      sampleCount: 1_001,
    };
    const sampledCoordinates: number[] = [];
    const provider: EphemerisProvider = {
      id: 'test-provider',
      bodyIds: ['earth'],
      hasBody: (bodyId) => bodyId === 'earth',
      getCoverage: (bodyId) => (bodyId === 'earth' ? coverage : undefined),
      getProvenance: (): DataProvenance | undefined => undefined,
      sample: (_bodyId, jdTdb, out: EphemerisStateVector) => {
        const coordinate = jdTdb - coverage.startJdTdb;
        sampledCoordinates.push(coordinate);
        out.jdTdb = jdTdb;
        out.positionM.x = coordinate;
        out.positionM.y = coordinate * 2;
        out.positionM.z = coordinate * 3;
        out.velocityMps.x = 1;
        out.velocityMps.y = 2;
        out.velocityMps.z = 3;
        return out;
      },
    };

    const trails = createEphemerisDebugTrails(provider, ['sun', 'earth']);

    expect(trails).toHaveLength(1);
    expect(trails[0]?.bodyId).toBe('earth');
    expect((trails[0]?.positionsM.length ?? 0) / 3).toBeLessThanOrEqual(720);
    expect(sampledCoordinates.length).toBe((trails[0]?.positionsM.length ?? 0) / 3);
    expect(sampledCoordinates.every((value) => Math.abs(value - Math.round(value)) < 1e-8)).toBe(
      true,
    );
  });
});
