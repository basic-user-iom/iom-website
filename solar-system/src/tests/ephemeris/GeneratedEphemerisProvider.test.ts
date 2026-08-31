import type { DataProvenance } from '../../simulation/bodies/DataProvenance';
import { SECONDS_PER_DAY } from '../../simulation/core/Units';
import {
  encodeEphemerisBinary,
  decodeEphemerisBinary,
  type EncodableEphemerisBodySeries,
} from '../../simulation/ephemeris/EphemerisBinary';
import {
  EphemerisBodyNotFoundError,
  EphemerisFormatError,
  EphemerisOutOfRangeError,
} from '../../simulation/ephemeris/EphemerisErrors';
import { createEphemerisStateVector } from '../../simulation/ephemeris/EphemerisTypes';
import type { GeneratedEphemerisManifest } from '../../simulation/ephemeris/EphemerisTypes';
import { GeneratedEphemerisProvider } from '../../simulation/ephemeris/GeneratedEphemerisProvider';
import {
  DisabledKeplerFallbackProvider,
  KeplerFallbackUnavailableError,
} from '../../simulation/ephemeris/KeplerFallbackProvider';

const START_JD_TDB = 2_451_545;
const EARTH_STEP_SECONDS = 10;
const earthSamples = new Float64Array([
  1, 2, 3, 2, -1, 0.5,
  21, -8, 8, 2, -1, 0.5,
  41, -18, 13, 2, -1, 0.5,
]);
const moonSamples = new Float64Array([
  100, 200, 300, 1, 2, 3,
  105, 210, 315, 1, 2, 3,
]);

const series: readonly EncodableEphemerisBodySeries[] = [
  {
    bodyId: 'earth',
    startJdTdb: START_JD_TDB,
    stepSeconds: EARTH_STEP_SECONDS,
    samples: earthSamples,
  },
  {
    bodyId: 'moon',
    startJdTdb: START_JD_TDB,
    stepSeconds: 5,
    samples: moonSamples,
  },
];

function provenance(
  bodyId: string,
  startJdTdb: number,
  stepSeconds: number,
  sampleCount: number,
): DataProvenance {
  return {
    provider: 'JPL_HORIZONS',
    sourceName: `JPL Horizons ${bodyId}`,
    targetId: bodyId === 'earth' ? '399' : '301',
    centerId: '@10',
    referenceFrame: 'ICRF',
    referencePlane: 'ECLIPTIC',
    timeScale: 'TDB',
    units: 'm and m/s',
    startJd: startJdTdb,
    endJd: startJdTdb + ((sampleCount - 1) * stepSeconds) / SECONDS_PER_DAY,
    sampleStepSeconds: stepSeconds,
    retrievedAtIso: '2026-08-28T00:00:00.000Z',
    generatorVersion: 'test-generator/1',
    sourceHash: `${bodyId}-hash`,
  };
}

function manifest(): GeneratedEphemerisManifest {
  return {
    schemaVersion: 1,
    datasetId: 'test-horizons-v1',
    binaryFile: 'test-horizons-v1.bin',
    binarySha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    format: {
      id: 'IOMEPH',
      versionMajor: 1,
      versionMinor: 0,
      byteOrder: 'little-endian',
      scalarType: 'float64',
      componentOrder: ['px', 'py', 'pz', 'vx', 'vy', 'vz'],
      units: ['m', 'm', 'm', 'm/s', 'm/s', 'm/s'],
    },
    generatedAtIso: '2026-08-28T00:00:00.000Z',
    bodies: [
      {
        bodyId: 'earth',
        displayName: 'Earth',
        provenance: provenance('earth', START_JD_TDB, EARTH_STEP_SECONDS, 3),
      },
      {
        bodyId: 'moon',
        displayName: 'Moon',
        provenance: provenance('moon', START_JD_TDB, 5, 2),
      },
    ],
  };
}

function provider(
  outOfRangeBehavior: 'throw' | 'clamp' = 'throw',
): GeneratedEphemerisProvider {
  return GeneratedEphemerisProvider.fromBinary(encodeEphemerisBinary(series), manifest(), {
    outOfRangeBehavior,
  });
}

describe('GeneratedEphemerisProvider', () => {
  it('exposes body-specific coverage and provenance for mixed cadences', () => {
    const ephemeris = provider();

    expect(ephemeris.id).toBe('test-horizons-v1');
    expect(ephemeris.bodyIds).toEqual(['earth', 'moon']);
    expect(ephemeris.hasBody('earth')).toBe(true);
    expect(ephemeris.hasBody('mars')).toBe(false);
    expect(ephemeris.getCoverage('earth')).toEqual({
      startJdTdb: START_JD_TDB,
      endJdTdb: START_JD_TDB + 20 / SECONDS_PER_DAY,
      sampleStepSeconds: 10,
      sampleCount: 3,
    });
    expect(ephemeris.getCoverage('moon')?.sampleStepSeconds).toBe(5);
    expect(ephemeris.getProvenance('earth')?.provider).toBe('JPL_HORIZONS');
    expect(ephemeris.getProvenance('earth')?.targetId).toBe('399');
    expect(ephemeris.getCoverage('mars')).toBeUndefined();
    expect(ephemeris.getProvenance('mars')).toBeUndefined();
  });

  it('writes Hermite-interpolated position and velocity into caller-owned output', () => {
    const ephemeris = provider();
    const out = createEphemerisStateVector();
    const originalPosition = out.positionM;
    const originalVelocity = out.velocityMps;
    const requestedJdTdb = START_JD_TDB + 5 / SECONDS_PER_DAY;

    const returned = ephemeris.sample('earth', requestedJdTdb, out);

    expect(returned).toBe(out);
    expect(out.positionM).toBe(originalPosition);
    expect(out.velocityMps).toBe(originalVelocity);
    expect(out.jdTdb).toBe(requestedJdTdb);
    expect(out.positionM.x).toBeCloseTo(11, 4);
    expect(out.positionM.y).toBeCloseTo(-3, 4);
    expect(out.positionM.z).toBeCloseTo(5.5, 4);
    expect(out.velocityMps.x).toBeCloseTo(2, 9);
    expect(out.velocityMps.y).toBeCloseTo(-1, 9);
    expect(out.velocityMps.z).toBeCloseTo(0.5, 9);

    ephemeris.sample('earth', START_JD_TDB, out);
    expect(out.positionM).toEqual({ x: 1, y: 2, z: 3 });
    expect(out.velocityMps).toEqual({ x: 2, y: -1, z: 0.5 });

    const endJdTdb = ephemeris.getCoverage('earth')!.endJdTdb;
    ephemeris.sample('earth', endJdTdb, out);
    expect(out.positionM).toEqual({ x: 41, y: -18, z: 13 });
  });

  it('throws explicitly for unknown bodies, invalid times, and default out-of-range access', () => {
    const ephemeris = provider();
    const out = createEphemerisStateVector();

    expect(() => ephemeris.sample('mars', START_JD_TDB, out)).toThrow(
      EphemerisBodyNotFoundError,
    );
    expect(() => ephemeris.sample('earth', Number.NaN, out)).toThrow(/finite/);
    expect(() => ephemeris.sample('earth', START_JD_TDB - 1, out)).toThrow(
      EphemerisOutOfRangeError,
    );
    expect(() => ephemeris.sample('earth', START_JD_TDB + 1, out)).toThrow(
      EphemerisOutOfRangeError,
    );
  });

  it('clamps only when configured and reports the actually sampled epoch', () => {
    const ephemeris = provider('clamp');
    const out = createEphemerisStateVector();

    ephemeris.sample('earth', START_JD_TDB - 10, out);
    expect(out.jdTdb).toBe(START_JD_TDB);
    expect(out.positionM).toEqual({ x: 1, y: 2, z: 3 });

    ephemeris.sample('earth', START_JD_TDB + 10, out);
    expect(out.jdTdb).toBe(ephemeris.getCoverage('earth')?.endJdTdb);
    expect(out.positionM).toEqual({ x: 41, y: -18, z: 13 });
  });

  it('refuses missing, extra, or coverage-mismatched provenance', () => {
    const decoded = decodeEphemerisBinary(encodeEphemerisBinary(series));
    const missing = manifest();
    expect(
      () =>
        new GeneratedEphemerisProvider(decoded, {
          ...missing,
          bodies: missing.bodies.slice(0, 1),
        }),
    ).toThrow(/no provenance/);

    const extra = manifest();
    expect(
      () =>
        new GeneratedEphemerisProvider(decoded, {
          ...extra,
          bodies: [
            ...extra.bodies,
            {
              bodyId: 'mars',
              displayName: 'Mars',
              provenance: provenance('mars', START_JD_TDB, 10, 3),
            },
          ],
        }),
    ).toThrow(/missing from the binary/);

    const mismatched = manifest();
    const earth = mismatched.bodies[0]!;
    expect(
      () =>
        new GeneratedEphemerisProvider(decoded, {
          ...mismatched,
          bodies: [
            {
              ...earth,
              provenance: { ...earth.provenance, sampleStepSeconds: 11 },
            },
            mismatched.bodies[1]!,
          ],
        }),
    ).toThrow(EphemerisFormatError);
  });
});

describe('Kepler fallback separation', () => {
  it('ships a disabled provider that never fabricates a state', () => {
    const fallback = new DisabledKeplerFallbackProvider();
    const out = createEphemerisStateVector();

    expect(fallback.providerKind).toBe('KEPLER_FALLBACK');
    expect(fallback.bodyIds).toEqual([]);
    expect(fallback.hasBody('pluto')).toBe(false);
    expect(fallback.getCoverage('pluto')).toBeUndefined();
    expect(fallback.getProvenance('pluto')).toBeUndefined();
    expect(() => fallback.sample('pluto', START_JD_TDB, out)).toThrow(
      KeplerFallbackUnavailableError,
    );
    expect(out).toEqual(createEphemerisStateVector());
  });
});
