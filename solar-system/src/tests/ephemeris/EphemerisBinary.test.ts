import {
  decodeEphemerisBinary,
  encodeEphemerisBinary,
  EPHEMERIS_BINARY_COMPONENT_COUNT,
  EPHEMERIS_BINARY_DIRECTORY_ENTRY_BYTES,
  EPHEMERIS_BINARY_FLAGS,
  EPHEMERIS_BINARY_HEADER_BYTES,
  EPHEMERIS_BINARY_MAGIC,
  EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES,
} from '../../simulation/ephemeris/EphemerisBinary';
import { EphemerisFormatError } from '../../simulation/ephemeris/EphemerisErrors';
import { SECONDS_PER_DAY } from '../../simulation/core/Units';

const planetSamples = new Float64Array([
  1, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 11, 12,
]);

const moonSamples = new Float64Array([
  -1, -2, -3, -4, -5, -6,
  -7, -8, -9, -10, -11, -12,
  -13, -14, -15, -16, -17, -18,
]);

function encodeFixture(): ArrayBuffer {
  return encodeEphemerisBinary([
    {
      bodyId: 'earth',
      startJdTdb: 2_451_545,
      stepSeconds: SECONDS_PER_DAY,
      samples: planetSamples,
    },
    {
      bodyId: 'moon-月',
      startJdTdb: 2_451_545.25,
      stepSeconds: 6 * 60 * 60,
      samples: moonSamples,
    },
  ]);
}

describe('ephemeris binary v1 contract', () => {
  it('writes the documented little-endian header and per-body directory', () => {
    const buffer = encodeFixture();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const magic = String.fromCharCode(...bytes.subarray(0, 8));

    expect(magic).toBe(EPHEMERIS_BINARY_MAGIC);
    expect(view.getUint16(8, true)).toBe(1);
    expect(view.getUint16(10, true)).toBe(0);
    expect(view.getUint32(12, true)).toBe(EPHEMERIS_BINARY_FLAGS);
    expect(view.getUint32(16, true)).toBe(EPHEMERIS_BINARY_HEADER_BYTES);
    expect(view.getUint32(20, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(EPHEMERIS_BINARY_HEADER_BYTES);
    expect(view.getUint32(28, true)).toBe(
      EPHEMERIS_BINARY_HEADER_BYTES + 2 * EPHEMERIS_BINARY_DIRECTORY_ENTRY_BYTES,
    );
    expect(view.getUint16(EPHEMERIS_BINARY_HEADER_BYTES + 6, true)).toBe(
      EPHEMERIS_BINARY_COMPONENT_COUNT,
    );
    expect(view.getUint32(EPHEMERIS_BINARY_HEADER_BYTES + 28, true)).toBe(
      EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES,
    );
    expect(view.getUint32(36, true)).toBe(buffer.byteLength);
  });

  it('round-trips mixed body cadences and exposes aligned zero-copy samples', () => {
    const buffer = encodeFixture();
    const decoded = decodeEphemerisBinary(buffer);

    expect(decoded.versionMajor).toBe(1);
    expect(decoded.versionMinor).toBe(0);
    expect(decoded.byteLength).toBe(buffer.byteLength);
    expect(decoded.bodies.map((body) => body.bodyId)).toEqual(['earth', 'moon-月']);

    const earth = decoded.bodies[0];
    const moon = decoded.bodies[1];
    expect(earth).toBeDefined();
    expect(moon).toBeDefined();
    expect(earth?.stepSeconds).toBe(SECONDS_PER_DAY);
    expect(earth?.sampleCount).toBe(2);
    expect(earth?.endJdTdb).toBe(2_451_546);
    expect([...earth!.samples]).toEqual([...planetSamples]);
    expect(earth?.samples.buffer).toBe(buffer);
    expect(earth!.samples.byteOffset % 8).toBe(0);
    expect(moon?.stepSeconds).toBe(21_600);
    expect(moon?.sampleCount).toBe(3);
    expect(moon?.endJdTdb).toBe(2_451_545.75);
    expect([...moon!.samples]).toEqual([...moonSamples]);
    expect(moon?.samples.buffer).toBe(buffer);
  });

  it('rejects malformed headers, sample spans, and non-finite payloads', () => {
    const invalidMagic = encodeFixture();
    new Uint8Array(invalidMagic)[0] = 0;
    expect(() => decodeEphemerisBinary(invalidMagic)).toThrow(EphemerisFormatError);

    const invalidFlags = encodeFixture();
    new DataView(invalidFlags).setUint32(12, 0, true);
    expect(() => decodeEphemerisBinary(invalidFlags)).toThrow(/flags/);

    const invalidLength = encodeFixture();
    new DataView(invalidLength).setUint32(36, invalidLength.byteLength - 1, true);
    expect(() => decodeEphemerisBinary(invalidLength)).toThrow(/file length/);

    const invalidSpan = encodeFixture();
    new DataView(invalidSpan).setUint32(
      EPHEMERIS_BINARY_HEADER_BYTES + 36,
      EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES,
      true,
    );
    expect(() => decodeEphemerisBinary(invalidSpan)).toThrow(/data length/);

    const nonFinitePayload = encodeFixture();
    const payloadOffset = new DataView(nonFinitePayload).getUint32(
      EPHEMERIS_BINARY_HEADER_BYTES + 32,
      true,
    );
    new DataView(nonFinitePayload).setFloat64(payloadOffset, Number.NaN, true);
    expect(() => decodeEphemerisBinary(nonFinitePayload)).toThrow(/not finite/);
  });

  it('rejects ambiguous or invalid encoder input before producing a file', () => {
    expect(() => encodeEphemerisBinary([])).toThrow(/At least one/);
    expect(() =>
      encodeEphemerisBinary([
        { bodyId: 'earth', startJdTdb: 0, stepSeconds: 1, samples: planetSamples },
        { bodyId: 'earth', startJdTdb: 0, stepSeconds: 1, samples: planetSamples },
      ]),
    ).toThrow(/Duplicate/);
    expect(() =>
      encodeEphemerisBinary([
        { bodyId: ' earth ', startJdTdb: 0, stepSeconds: 1, samples: planetSamples },
      ]),
    ).toThrow(/identifiers/);
    expect(() =>
      encodeEphemerisBinary([
        { bodyId: 'earth', startJdTdb: 0, stepSeconds: 0, samples: planetSamples },
      ]),
    ).toThrow(/positive/);
    expect(() =>
      encodeEphemerisBinary([
        {
          bodyId: 'earth',
          startJdTdb: 0,
          stepSeconds: 1,
          samples: [1, 2, 3, 4, 5, Number.POSITIVE_INFINITY],
        },
      ]),
    ).toThrow(/at least two/);
    expect(() =>
      encodeEphemerisBinary([
        {
          bodyId: 'earth',
          startJdTdb: 0,
          stepSeconds: 1,
          samples: [...planetSamples.slice(0, 6), Number.NaN, ...planetSamples.slice(7)],
        },
      ]),
    ).toThrow(/must be finite/);
  });
});
