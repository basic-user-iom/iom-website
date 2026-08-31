import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS,
  createEphemerisOrbitGeometry,
  createEphemerisTrailGeometry,
} from '../../rendering/EphemerisOrbitGeometry';
import type { DataProvenance } from '../../simulation/bodies/DataProvenance';
import type { EphemerisProvider } from '../../simulation/ephemeris/EphemerisProvider';
import type {
  EphemerisCoverage,
  GeneratedEphemerisManifest,
  EphemerisStateVector,
} from '../../simulation/ephemeris/EphemerisTypes';
import { createEphemerisStateVector } from '../../simulation/ephemeris/EphemerisTypes';
import { GeneratedEphemerisProvider } from '../../simulation/ephemeris/GeneratedEphemerisProvider';
import {
  SegmentedEphemerisProvider,
  type SegmentedEphemerisBodyDefinition,
} from '../../simulation/ephemeris/SegmentedEphemerisProvider';

const BODY_COVERAGE: EphemerisCoverage = {
  startJdTdb: 100,
  endJdTdb: 110,
  sampleStepSeconds: 86_400,
  sampleCount: 11,
};

const CENTER_COVERAGE: EphemerisCoverage = {
  startJdTdb: 101,
  endJdTdb: 109,
  sampleStepSeconds: 86_400,
  sampleCount: 9,
};

describe('ephemeris-derived path geometry', () => {
  it('preserves eccentricity and inclination in center-relative Float64 geometry', () => {
    const provider = createCurvedProvider();
    const geometry = createEphemerisOrbitGeometry(provider, 'earth', {
      epochJdTdb: 105,
      spanDays: 4,
      samplesPerSourceInterval: 1,
      maxPoints: 20,
    });

    expect(geometry.source).toBe('ephemeris');
    expect(geometry.centerBodyId).toBe('sun');
    expect(geometry.coordinateSemantics).toBe('center-relative');
    expect(geometry.startJdTdb).toBe(103);
    expect(geometry.endJdTdb).toBe(107);
    expect([...geometry.sampleJdTdb]).toEqual([103, 104, 105, 106, 107]);
    expect(geometry.positionsM).toBeInstanceOf(Float64Array);

    const radii = pointValues(geometry.positionsM, (x, y, z) => Math.hypot(x, y, z));
    const zValues = pointValues(geometry.positionsM, (_x, _y, z) => z);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(1);
    expect(Math.max(...zValues) - Math.min(...zValues)).toBeGreaterThan(0.5);
  });

  it('defaults the Moon orbit to Earth-relative samples', () => {
    const geometry = createEphemerisOrbitGeometry(createCurvedProvider(), 'moon', {
      epochJdTdb: 105,
      spanDays: 2,
      maxPoints: 3,
    });

    expect(geometry.centerBodyId).toBe('earth');
    expect(geometry.coordinateSemantics).toBe('center-relative');
    for (let offset = 0; offset < geometry.positionsM.length; offset += 3) {
      expect(Math.hypot(
        geometry.positionsM[offset] ?? 0,
        geometry.positionsM[offset + 1] ?? 0,
        geometry.positionsM[offset + 2] ?? 0,
      )).toBeLessThanOrEqual(0.5);
    }
  });

  it('clips to the shared trusted coverage and reports missing arcs', () => {
    const geometry = createEphemerisOrbitGeometry(createCurvedProvider(), 'earth', {
      epochJdTdb: 105,
      spanDays: 12,
      maxPoints: 5,
    });

    expect(geometry.requestedStartJdTdb).toBe(99);
    expect(geometry.requestedEndJdTdb).toBe(111);
    expect(geometry.startJdTdb).toBe(101);
    expect(geometry.endJdTdb).toBe(109);
    expect(geometry.truncatedStart).toBe(true);
    expect(geometry.truncatedEnd).toBe(true);
    expect(geometry.warning).toContain('no missing arc was fabricated');
  });

  it('builds a historical trail in the provider source frame by default', () => {
    const geometry = createEphemerisTrailGeometry(createCurvedProvider(), 'earth', {
      endJdTdb: 106,
      durationDays: 2,
      maxPoints: 3,
    });

    expect(geometry.kind).toBe('trail');
    expect(geometry.centerBodyId).toBeNull();
    expect(geometry.coordinateSemantics).toBe('source-frame');
    expect([...geometry.sampleJdTdb]).toEqual([104, 105, 106]);
    // The moving source-frame origin is retained instead of subtracted.
    expect(geometry.positionsM[0]).toBeGreaterThan(1_000);
  });

  it('rejects unsupported or nonsensical path requests', () => {
    const provider = createCurvedProvider();
    expect(() =>
      createEphemerisOrbitGeometry(provider, 'sun', { epochJdTdb: 105 }),
    ).toThrow('no default heliocentric orbit');
    expect(() =>
      createEphemerisOrbitGeometry(provider, 'earth', {
        epochJdTdb: 105,
        centerBodyId: 'earth',
      }),
    ).toThrow('cannot be relative to itself');
    expect(() =>
      createEphemerisTrailGeometry(provider, 'earth', {
        endJdTdb: 105,
        durationDays: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe('bundled Phase 3 ephemeris orbit geometry', () => {
  let provider: GeneratedEphemerisProvider;

  beforeAll(() => {
    provider = loadBundledProvider();
  });

  it.each([
    {
      bodyId: 'mercury' as const,
      centerBodyId: 'sun' as const,
      minimumRadialVariationFraction: 0.2,
      minimumVerticalExtentFraction: 0.05,
    },
    {
      bodyId: 'mars' as const,
      centerBodyId: 'sun' as const,
      minimumRadialVariationFraction: 0.1,
      minimumVerticalExtentFraction: 0.01,
    },
    {
      bodyId: 'moon' as const,
      centerBodyId: 'earth' as const,
      minimumRadialVariationFraction: 0.05,
      minimumVerticalExtentFraction: 0.05,
    },
  ])(
    'preserves real radial variation and ecliptic inclination for $bodyId',
    ({
      bodyId,
      centerBodyId,
      minimumRadialVariationFraction,
      minimumVerticalExtentFraction,
    }) => {
      const coverage = requiredCoverage(provider, bodyId);
      const geometry = createEphemerisOrbitGeometry(provider, bodyId, {
        epochJdTdb: (coverage.startJdTdb + coverage.endJdTdb) / 2,
        maxPoints: 2_049,
        samplesPerSourceInterval: 2,
      });
      const statistics = pathShapeStatistics(geometry.positionsM);

      expect(geometry.sourceProviderId).toBe(provider.id);
      expect(geometry.source).toBe('ephemeris');
      expect(geometry.centerBodyId).toBe(centerBodyId);
      expect(geometry.coordinateSemantics).toBe('center-relative');
      expect(geometry.positionsM).toBeInstanceOf(Float64Array);
      expect(statistics.radialVariationFraction).toBeGreaterThan(
        minimumRadialVariationFraction,
      );
      expect(statistics.verticalExtentFraction).toBeGreaterThan(
        minimumVerticalExtentFraction,
      );
    },
  );

  it('stores the bundled Moon path as the sampled Moon-minus-Earth state', () => {
    const coverage = requiredCoverage(provider, 'moon');
    const geometry = createEphemerisOrbitGeometry(provider, 'moon', {
      epochJdTdb: (coverage.startJdTdb + coverage.endJdTdb) / 2,
      maxPoints: 257,
      samplesPerSourceInterval: 1,
    });
    const moon = createEphemerisStateVector();
    const earth = createEphemerisStateVector();
    const pointIndices = [0, Math.floor(geometry.sampleJdTdb.length / 2), geometry.sampleJdTdb.length - 1];

    expect(geometry.centerBodyId).toBe('earth');
    expect(geometry.coordinateSemantics).toBe('center-relative');
    for (const pointIndex of pointIndices) {
      const jdTdb = geometry.sampleJdTdb[pointIndex];
      expect(jdTdb).toBeDefined();
      provider.sample('moon', jdTdb!, moon);
      provider.sample('earth', jdTdb!, earth);
      const offset = pointIndex * 3;
      expect(geometry.positionsM[offset]).toBe(moon.positionM.x - earth.positionM.x);
      expect(geometry.positionsM[offset + 1]).toBe(moon.positionM.y - earth.positionM.y);
      expect(geometry.positionsM[offset + 2]).toBe(moon.positionM.z - earth.positionM.z);
    }
  });

  it('truncates Neptune to shared Sun/Neptune coverage without changing center semantics', () => {
    const neptuneCoverage = requiredCoverage(provider, 'neptune');
    const sunCoverage = requiredCoverage(provider, 'sun');
    const trustedStartJdTdb = Math.max(
      neptuneCoverage.startJdTdb,
      sunCoverage.startJdTdb,
    );
    const trustedEndJdTdb = Math.min(
      neptuneCoverage.endJdTdb,
      sunCoverage.endJdTdb,
    );
    const geometry = createEphemerisOrbitGeometry(provider, 'neptune', {
      epochJdTdb: (trustedStartJdTdb + trustedEndJdTdb) / 2,
      maxPoints: 2_049,
      samplesPerSourceInterval: 2,
    });

    expect(EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS.neptune).toBeGreaterThan(
      trustedEndJdTdb - trustedStartJdTdb,
    );
    expect(geometry.centerBodyId).toBe('sun');
    expect(geometry.coordinateSemantics).toBe('center-relative');
    expect(geometry.requestedStartJdTdb).toBeLessThan(trustedStartJdTdb);
    expect(geometry.requestedEndJdTdb).toBeGreaterThan(trustedEndJdTdb);
    expect(geometry.startJdTdb).toBe(trustedStartJdTdb);
    expect(geometry.endJdTdb).toBe(trustedEndJdTdb);
    expect(geometry.truncatedStart).toBe(true);
    expect(geometry.truncatedEnd).toBe(true);
    expect(geometry.warning).toContain('truncated at both ends');
    expect(geometry.warning).toContain('no missing arc was fabricated');
    expect(geometry.sampleJdTdb[0]).toBe(trustedStartJdTdb);
    expect(geometry.sampleJdTdb.at(-1)).toBe(trustedEndJdTdb);

    const pointIndex = Math.floor(geometry.sampleJdTdb.length / 2);
    const jdTdb = geometry.sampleJdTdb[pointIndex];
    const neptune = createEphemerisStateVector();
    const sun = createEphemerisStateVector();
    expect(jdTdb).toBeDefined();
    provider.sample('neptune', jdTdb!, neptune);
    provider.sample('sun', jdTdb!, sun);
    const offset = pointIndex * 3;
    expect(geometry.positionsM[offset]).toBe(neptune.positionM.x - sun.positionM.x);
    expect(geometry.positionsM[offset + 1]).toBe(neptune.positionM.y - sun.positionM.y);
    expect(geometry.positionsM[offset + 2]).toBe(neptune.positionM.z - sun.positionM.z);
  });
});

describe('bundled Phase 6 high-eccentricity comet geometry', () => {
  let provider: SegmentedEphemerisProvider;

  beforeAll(() => {
    provider = loadBundledCometProvider();
  });

  it.each([
    ['1p-halley' as const, EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS['1p-halley']],
    ['c-2020-f3-neowise' as const, EPHEMERIS_ORBIT_DISPLAY_SPAN_DAYS['c-2020-f3-neowise']],
  ])('adaptively resolves the real perihelion turn for %s', (bodyId, spanDays) => {
    const coverage = requiredCoverage(provider, bodyId);
    const epochJdTdb = Math.min(
      Math.max(2_451_545, coverage.startJdTdb + spanDays / 2),
      coverage.endJdTdb - spanDays / 2,
    );
    const geometry = createEphemerisOrbitGeometry(provider, bodyId, {
      epochJdTdb,
      spanDays,
      centerBodyId: null,
      maxPoints: 2_049,
      samplesPerSourceInterval: 2,
    });

    expect(geometry.positionsM.length / 3).toBeLessThanOrEqual(2_049);
    expect(maximumChordTurnDegrees(geometry.positionsM)).toBeLessThanOrEqual(3);
    expectStrictlyIncreasing(geometry.sampleJdTdb);

    const state = createEphemerisStateVector();
    for (const pointIndex of [0, Math.floor(geometry.sampleJdTdb.length / 2), geometry.sampleJdTdb.length - 1]) {
      const jdTdb = geometry.sampleJdTdb[pointIndex];
      expect(jdTdb).toBeDefined();
      provider.sample(bodyId, jdTdb!, state);
      const offset = pointIndex * 3;
      expect(geometry.positionsM[offset]).toBe(state.positionM.x);
      expect(geometry.positionsM[offset + 1]).toBe(state.positionM.y);
      expect(geometry.positionsM[offset + 2]).toBe(state.positionM.z);
    }
  });
});

function createCurvedProvider(): EphemerisProvider {
  const bodyIds = ['sun', 'earth', 'moon'] as const;
  return {
    id: 'curved-test-ephemeris',
    bodyIds,
    hasBody: (bodyId) => bodyIds.some((candidate) => candidate === bodyId),
    getCoverage: (bodyId) => {
      if (bodyId === 'sun') return CENTER_COVERAGE;
      if (bodyId === 'earth' || bodyId === 'moon') return BODY_COVERAGE;
      return undefined;
    },
    getProvenance: (): DataProvenance | undefined => undefined,
    sample: (bodyId, jdTdb, out: EphemerisStateVector) => {
      const time = jdTdb - 100;
      const theta = (time * Math.PI) / 4;
      const sun = { x: 1_000 + time * 10, y: -500 + time * 3, z: time * 2 };
      const earth = {
        x: sun.x + 3 * Math.cos(theta),
        y: sun.y + 1.2 * Math.sin(theta),
        z: sun.z + 0.6 * Math.sin(theta),
      };
      const moonTheta = theta * 4;

      const position =
        bodyId === 'sun'
          ? sun
          : bodyId === 'earth'
            ? earth
            : {
                x: earth.x + 0.5 * Math.cos(moonTheta),
                y: earth.y + 0.3 * Math.sin(moonTheta),
                z: earth.z + 0.1 * Math.sin(moonTheta),
              };
      out.jdTdb = jdTdb;
      out.positionM.x = position.x;
      out.positionM.y = position.y;
      out.positionM.z = position.z;
      out.velocityMps.x = 0;
      out.velocityMps.y = 0;
      out.velocityMps.z = 0;
      return out;
    },
  };
}

function pointValues(
  positionsM: Float64Array,
  project: (x: number, y: number, z: number) => number,
): number[] {
  const values: number[] = [];
  for (let offset = 0; offset < positionsM.length; offset += 3) {
    values.push(
      project(
        positionsM[offset] ?? 0,
        positionsM[offset + 1] ?? 0,
        positionsM[offset + 2] ?? 0,
      ),
    );
  }
  return values;
}

function loadBundledProvider(): GeneratedEphemerisProvider {
  const manifest = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'src/data/generated/solar-system-ephemeris.manifest.json'),
      'utf8',
    ),
  ) as GeneratedEphemerisManifest;
  const binaryBytes = readFileSync(
    resolve(process.cwd(), 'src/data/generated/solar-system-ephemeris.v1.bin'),
  );
  // Copy into this jsdom realm so the decoder's ArrayBuffer guard remains valid.
  const binary = new Uint8Array(binaryBytes.byteLength);
  binary.set(binaryBytes);
  return GeneratedEphemerisProvider.fromBinary(binary.buffer, manifest);
}

function loadBundledCometProvider(): SegmentedEphemerisProvider {
  const manifest = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'src/data/generated/small-body-ephemeris.manifest.json'),
      'utf8',
    ),
  ) as GeneratedEphemerisManifest;
  const routing = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'src/data/generated/small-body-segments.json'),
      'utf8',
    ),
  ) as { readonly bodies: readonly Readonly<SegmentedEphemerisBodyDefinition>[] };
  const binaryBytes = readFileSync(
    resolve(process.cwd(), 'src/data/generated/small-body-ephemeris.v1.bin'),
  );
  const binary = new Uint8Array(binaryBytes.byteLength);
  binary.set(binaryBytes);
  const source = GeneratedEphemerisProvider.fromBinary(binary.buffer, manifest);
  return new SegmentedEphemerisProvider(source, routing.bodies);
}

function requiredCoverage(
  provider: EphemerisProvider,
  bodyId: string,
): EphemerisCoverage {
  const coverage = provider.getCoverage(bodyId);
  if (coverage === undefined) {
    throw new Error(`Bundled ephemeris has no coverage for "${bodyId}".`);
  }
  return coverage;
}

function pathShapeStatistics(positionsM: Float64Array): {
  readonly radialVariationFraction: number;
  readonly verticalExtentFraction: number;
} {
  const radii = pointValues(positionsM, (x, y, z) => Math.hypot(x, y, z));
  const vertical = pointValues(positionsM, (_x, _y, z) => z);
  const meanRadius = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  return {
    radialVariationFraction: (Math.max(...radii) - Math.min(...radii)) / meanRadius,
    verticalExtentFraction: (Math.max(...vertical) - Math.min(...vertical)) / meanRadius,
  };
}

function maximumChordTurnDegrees(positionsM: Float64Array): number {
  let maximum = 0;
  for (let offset = 3; offset < positionsM.length - 3; offset += 3) {
    const incoming = [
      (positionsM[offset] ?? 0) - (positionsM[offset - 3] ?? 0),
      (positionsM[offset + 1] ?? 0) - (positionsM[offset - 2] ?? 0),
      (positionsM[offset + 2] ?? 0) - (positionsM[offset - 1] ?? 0),
    ] as const;
    const outgoing = [
      (positionsM[offset + 3] ?? 0) - (positionsM[offset] ?? 0),
      (positionsM[offset + 4] ?? 0) - (positionsM[offset + 1] ?? 0),
      (positionsM[offset + 5] ?? 0) - (positionsM[offset + 2] ?? 0),
    ] as const;
    const denominator = Math.hypot(...incoming) * Math.hypot(...outgoing);
    if (denominator <= 0) continue;
    const cosine = Math.max(
      -1,
      Math.min(
        1,
        (incoming[0] * outgoing[0] +
          incoming[1] * outgoing[1] +
          incoming[2] * outgoing[2]) /
          denominator,
      ),
    );
    maximum = Math.max(maximum, Math.acos(cosine) * 180 / Math.PI);
  }
  return maximum;
}

function expectStrictlyIncreasing(values: Float64Array): void {
  for (let index = 1; index < values.length; index += 1) {
    expect(values[index]).toBeGreaterThan(values[index - 1] ?? Number.POSITIVE_INFINITY);
  }
}
