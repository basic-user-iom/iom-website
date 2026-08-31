import type { DataProvenance } from '../../simulation/bodies/DataProvenance';
import {
  EphemerisBodyNotFoundError,
  EphemerisOutOfRangeError,
} from '../../simulation/ephemeris/EphemerisErrors';
import type { EphemerisProvider } from '../../simulation/ephemeris/EphemerisProvider';
import {
  createEphemerisStateVector,
  type EphemerisCoverage,
  type EphemerisStateVector,
} from '../../simulation/ephemeris/EphemerisTypes';
import { CompositeEphemerisProvider } from '../../simulation/ephemeris/CompositeEphemerisProvider';
import {
  SegmentedEphemerisProvider,
  type SegmentedEphemerisBodyDefinition,
} from '../../simulation/ephemeris/SegmentedEphemerisProvider';

const PROVENANCE: DataProvenance = Object.freeze({
  provider: 'JPL_HORIZONS',
  sourceName: 'JPL Horizons fixture',
  units: 'm and m/s',
  retrievedAtIso: '2026-08-29T00:00:00.000Z',
  generatorVersion: 'phase6-provider-test/1',
});

describe('Phase 6 ephemeris provider composition', () => {
  it('selects the finest overlapping segment and retains baseline coverage', () => {
    const source = new FixtureProvider('small-body-source', {
      'halley-baseline': coverage(100, 110, 86_400, 11),
      'halley-perihelion': coverage(104, 106, 21_600, 9),
    });
    const provider = new SegmentedEphemerisProvider(source, [halleySegments()]);
    const out = createEphemerisStateVector();

    expect(provider.bodyIds).toEqual(['1p-halley']);
    expect(provider.getCoverage('1p-halley')).toEqual({
      startJdTdb: 100,
      endJdTdb: 110,
      sampleStepSeconds: 21_600,
      sampleCount: 20,
    });
    expect(provider.getActiveSegment('1p-halley', 103)?.seriesBodyId).toBe(
      'halley-baseline',
    );
    expect(provider.getActiveSegment('1p-halley', 104)?.seriesBodyId).toBe(
      'halley-perihelion',
    );
    expect(provider.getActiveSegment('1p-halley', 107)?.seriesBodyId).toBe(
      'halley-baseline',
    );

    provider.sample('1p-halley', 105, out);
    expect(source.lastSampledBodyId).toBe('halley-perihelion');
    expect(out.positionM.x).toBe(2);
    provider.sample('1p-halley', 109, out);
    expect(source.lastSampledBodyId).toBe('halley-baseline');
    expect(out.positionM.x).toBe(1);
  });

  it('rejects unavailable logical epochs and segment metadata drift', () => {
    const source = new FixtureProvider('small-body-source', {
      'halley-baseline': coverage(100, 110, 86_400, 11),
      'halley-perihelion': coverage(104, 106, 21_600, 9),
    });
    const provider = new SegmentedEphemerisProvider(source, [halleySegments()]);

    expect(() => provider.sample('missing', 105, createEphemerisStateVector())).toThrow(
      EphemerisBodyNotFoundError,
    );
    expect(() => provider.sample('1p-halley', 111, createEphemerisStateVector())).toThrow(
      EphemerisOutOfRangeError,
    );

    const original = halleySegments();
    const changed: SegmentedEphemerisBodyDefinition = {
      ...original,
      segments: original.segments.map((segment, index) => ({
        ...segment,
        stepSeconds: index === 1 ? 43_200 : segment.stepSeconds,
      })),
    };
    expect(() => new SegmentedEphemerisProvider(source, [changed])).toThrow(
      /does not match IOMEPH/,
    );
  });

  it('routes disjoint catalogs and rejects ambiguous ownership', () => {
    const planets = new FixtureProvider('planets', {
      earth: coverage(100, 110, 86_400, 11),
    });
    const comets = new FixtureProvider('comets', {
      '1p-halley': coverage(100, 110, 86_400, 11),
    });
    const provider = new CompositeEphemerisProvider([planets, comets]);
    const out = createEphemerisStateVector();

    expect(provider.bodyIds).toEqual(['earth', '1p-halley']);
    expect(provider.getCoverage('1p-halley')?.sampleCount).toBe(11);
    expect(provider.getProvenance('earth')).toBe(PROVENANCE);
    expect(provider.sample('1p-halley', 105, out)).toBe(out);
    expect(comets.lastSampledBodyId).toBe('1p-halley');
    expect(() => provider.sample('missing', 105, out)).toThrow(EphemerisBodyNotFoundError);
    expect(() => new CompositeEphemerisProvider([planets, planets])).toThrow(
      /supplied by both/,
    );
  });
});

class FixtureProvider implements EphemerisProvider {
  public readonly bodyIds: readonly string[];
  public lastSampledBodyId: string | null = null;

  public constructor(
    public readonly id: string,
    private readonly coverages: Readonly<Record<string, EphemerisCoverage>>,
  ) {
    this.bodyIds = Object.freeze(Object.keys(coverages));
  }

  public hasBody(bodyId: string): boolean {
    return this.coverages[bodyId] !== undefined;
  }

  public getCoverage(bodyId: string): EphemerisCoverage | undefined {
    return this.coverages[bodyId];
  }

  public getProvenance(bodyId: string): DataProvenance | undefined {
    return this.hasBody(bodyId) ? PROVENANCE : undefined;
  }

  public sample(bodyId: string, jdTdb: number, out: EphemerisStateVector): EphemerisStateVector {
    const bodyCoverage = this.getCoverage(bodyId);
    if (bodyCoverage === undefined) throw new EphemerisBodyNotFoundError(bodyId);
    if (jdTdb < bodyCoverage.startJdTdb || jdTdb > bodyCoverage.endJdTdb) {
      throw new EphemerisOutOfRangeError(bodyId, jdTdb, bodyCoverage);
    }
    this.lastSampledBodyId = bodyId;
    out.jdTdb = jdTdb;
    out.positionM.x = bodyId.includes('perihelion') ? 2 : 1;
    out.positionM.y = 0;
    out.positionM.z = 0;
    out.velocityMps.x = 0;
    out.velocityMps.y = 0;
    out.velocityMps.z = 0;
    return out;
  }
}

function halleySegments(): SegmentedEphemerisBodyDefinition {
  return {
    bodyId: '1p-halley',
    segments: [
      {
        seriesBodyId: 'halley-baseline',
        startJdTdb: 100,
        endJdTdb: 110,
        stepSeconds: 86_400,
        kind: 'baseline',
      },
      {
        seriesBodyId: 'halley-perihelion',
        startJdTdb: 104,
        endJdTdb: 106,
        stepSeconds: 21_600,
        kind: 'perihelion',
      },
    ],
  };
}

function coverage(
  startJdTdb: number,
  endJdTdb: number,
  sampleStepSeconds: number,
  sampleCount: number,
): EphemerisCoverage {
  return { startJdTdb, endJdTdb, sampleStepSeconds, sampleCount };
}
