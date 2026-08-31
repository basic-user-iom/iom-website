import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  BRUNETON_CRITICAL_E_SQUARED,
  BRUNETON_DEFLECTION_TABLE_SPEC,
  BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
  brunetonDeflectionTextureUFromESquared,
  brunetonDeflectionTextureVFromESquaredAndU,
  brunetonInverseRadiusTextureUFromESquared,
  brunetonTextureCoordFromUnitRange,
  brunetonUAtApsisFromESquared,
  parseBrunetonLookupTable,
  sampleBrunetonLookupTable,
  type BrunetonLookupTable,
  type BrunetonLookupTableSpec,
} from '../../rendering/black-hole';

describe('Bruneton Phase 10 lookup tables', () => {
  const deflectionBytes = readAsset('deflection.dat');
  const inverseRadiusBytes = readAsset('inverse_radius.dat');

  it('matches the official byte lengths, SHA-256 values, dimensions, and finite ranges', () => {
    const deflection = verifyOfficialTable(
      deflectionBytes,
      BRUNETON_DEFLECTION_TABLE_SPEC,
    );
    const inverseRadius = verifyOfficialTable(
      inverseRadiusBytes,
      BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
    );

    expect(deflection.data).toHaveLength(512 * 512 * 2);
    expect(deflection.minimum).toBe(0);
    expect(deflection.maximum).toBeCloseTo(149.68348693847656, 6);
    expect(inverseRadius.data).toHaveLength(64 * 32 * 2);
    expect(inverseRadius.minimum).toBe(0);
    expect(inverseRadius.maximum).toBeCloseTo(179.87252807617188, 6);
  });

  it('ports Bruneton mapping invariants at the critical curve and apsis', () => {
    const mu = BRUNETON_CRITICAL_E_SQUARED;
    expect(brunetonDeflectionTextureUFromESquared(0)).toBe(0.5);
    expect(brunetonDeflectionTextureUFromESquared(mu - 1e-6)).toBeCloseTo(
      0.01,
      1,
    );
    expect(brunetonDeflectionTextureUFromESquared(mu + 1e-6)).toBeCloseTo(
      0.98,
      1,
    );
    expect(brunetonDeflectionTextureUFromESquared(1e4)).toBeCloseTo(0.5, 2);

    for (const eSquared of [0.01, 0.1, 0.148]) {
      const uApsis = brunetonUAtApsisFromESquared(eSquared);
      expect(uApsis * uApsis * (1 - uApsis)).toBeCloseTo(eSquared, 12);
      expect(
        brunetonDeflectionTextureVFromESquaredAndU(eSquared, uApsis),
      ).toBeCloseTo(1, 12);
    }
    expect(brunetonInverseRadiusTextureUFromESquared(0)).toBe(1);
    expect(brunetonInverseRadiusTextureUFromESquared(100)).toBeCloseTo(
      1 / 601,
      12,
    );
    expect(brunetonTextureCoordFromUnitRange(0, 512)).toBe(0.5 / 512);
    expect(brunetonTextureCoordFromUnitRange(1, 512)).toBe(1 - 0.5 / 512);
  });

  it('reproduces pinned reference samples through the same bilinear mappings as the shader', () => {
    const deflection = parseBrunetonLookupTable(
      toArrayBuffer(deflectionBytes),
      BRUNETON_DEFLECTION_TABLE_SPEC,
    );
    const inverseRadius = parseBrunetonLookupTable(
      toArrayBuffer(inverseRadiusBytes),
      BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
    );
    const eSquared = BRUNETON_CRITICAL_E_SQUARED - 1e-3;
    const u = 0.6;
    const deflectionSample = sampleBrunetonLookupTable(
      deflection,
      brunetonTextureCoordFromUnitRange(
        brunetonDeflectionTextureUFromESquared(eSquared),
        BRUNETON_DEFLECTION_TABLE_SPEC.width,
      ),
      brunetonTextureCoordFromUnitRange(
        brunetonDeflectionTextureVFromESquaredAndU(eSquared, u),
        BRUNETON_DEFLECTION_TABLE_SPEC.height,
      ),
    );
    expect(deflectionSample[0]).toBeCloseTo(1.3418207543553629, 6);
    expect(deflectionSample[1]).toBeCloseTo(108.17530670564847, 5);

    const inverseESquared = BRUNETON_CRITICAL_E_SQUARED / 2;
    const inverseSample = sampleBrunetonLookupTable(
      inverseRadius,
      brunetonTextureCoordFromUnitRange(
        brunetonInverseRadiusTextureUFromESquared(inverseESquared),
        BRUNETON_INVERSE_RADIUS_TABLE_SPEC.width,
      ),
      brunetonTextureCoordFromUnitRange(
        0.5,
        BRUNETON_INVERSE_RADIUS_TABLE_SPEC.height,
      ),
    );
    expect(inverseSample[0]).toBeCloseTo(0.29893684272582716, 6);
    expect(inverseSample[1]).toBeCloseTo(103.35655036339392, 5);
  });

  it('rejects truncated, wrong-dimension, and non-finite payloads', () => {
    expect(() => parseBrunetonLookupTable(
      toArrayBuffer(deflectionBytes.subarray(0, deflectionBytes.length - 4)),
      BRUNETON_DEFLECTION_TABLE_SPEC,
    )).toThrow(/bytes/i);

    const wrongDimensions = Buffer.from(deflectionBytes);
    wrongDimensions.writeFloatLE(511, 0);
    expect(() => parseBrunetonLookupTable(
      toArrayBuffer(wrongDimensions),
      BRUNETON_DEFLECTION_TABLE_SPEC,
    )).toThrow(/header/i);

    const nonFinite = Buffer.from(inverseRadiusBytes);
    nonFinite.writeFloatLE(Number.NaN, 8);
    expect(() => parseBrunetonLookupTable(
      toArrayBuffer(nonFinite),
      BRUNETON_INVERSE_RADIUS_TABLE_SPEC,
    )).toThrow(/non-finite/i);
  });
});

function verifyOfficialTable(
  bytes: Buffer,
  spec: Readonly<BrunetonLookupTableSpec>,
): Readonly<BrunetonLookupTable> {
  expect(bytes).toHaveLength(
    (2 + spec.width * spec.height * spec.components) * Float32Array.BYTES_PER_ELEMENT,
  );
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(spec.sha256);
  return parseBrunetonLookupTable(toArrayBuffer(bytes), spec);
}

function readAsset(fileName: string): Buffer {
  return readFileSync(resolve(
    process.cwd(),
    'public/assets/phase10/black-hole',
    fileName,
  ));
}

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
