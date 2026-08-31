import { SECONDS_PER_DAY } from '../core/Units';
import { EphemerisFormatError } from './EphemerisErrors';

export const EPHEMERIS_BINARY_MAGIC = 'IOMEPH\0\0';
export const EPHEMERIS_BINARY_VERSION_MAJOR = 1;
export const EPHEMERIS_BINARY_VERSION_MINOR = 0;
export const EPHEMERIS_BINARY_HEADER_BYTES = 40;
export const EPHEMERIS_BINARY_DIRECTORY_ENTRY_BYTES = 48;
export const EPHEMERIS_BINARY_COMPONENT_COUNT = 6;
export const EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES =
  EPHEMERIS_BINARY_COMPONENT_COUNT * Float64Array.BYTES_PER_ELEMENT;

export const EPHEMERIS_BINARY_FLAG_LITTLE_ENDIAN = 1 << 0;
export const EPHEMERIS_BINARY_FLAG_FLOAT64 = 1 << 1;
export const EPHEMERIS_BINARY_FLAG_SI_UNITS = 1 << 2;
export const EPHEMERIS_BINARY_FLAG_TDB = 1 << 3;
export const EPHEMERIS_BINARY_FLAGS =
  EPHEMERIS_BINARY_FLAG_LITTLE_ENDIAN |
  EPHEMERIS_BINARY_FLAG_FLOAT64 |
  EPHEMERIS_BINARY_FLAG_SI_UNITS |
  EPHEMERIS_BINARY_FLAG_TDB;

const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffff_ffff;
const LITTLE_ENDIAN = isLittleEndianPlatform();
const MAGIC_BYTES = Uint8Array.from(
  Array.from(EPHEMERIS_BINARY_MAGIC, (character) => character.charCodeAt(0)),
);

export interface EncodableEphemerisBodySeries {
  readonly bodyId: string;
  readonly startJdTdb: number;
  readonly stepSeconds: number;
  /** Body-major interleaved [px, py, pz, vx, vy, vz] values in SI units. */
  readonly samples: ArrayLike<number>;
}

export interface DecodedEphemerisBodySeries {
  readonly bodyId: string;
  readonly startJdTdb: number;
  readonly endJdTdb: number;
  readonly stepSeconds: number;
  readonly sampleCount: number;
  /** A zero-copy view on little-endian platforms; treat it as immutable. */
  readonly samples: Float64Array;
}

export interface DecodedEphemerisBinary {
  readonly versionMajor: number;
  readonly versionMinor: number;
  readonly byteLength: number;
  readonly bodies: readonly DecodedEphemerisBodySeries[];
}

interface EncodedBodyLayout {
  readonly input: EncodableEphemerisBodySeries;
  readonly bodyIdBytes: Uint8Array;
  readonly bodyIdOffset: number;
  readonly sampleCount: number;
  readonly dataOffset: number;
  readonly dataByteLength: number;
}

interface DecodedBodyLayout {
  readonly bodyId: string;
  readonly startJdTdb: number;
  readonly endJdTdb: number;
  readonly stepSeconds: number;
  readonly sampleCount: number;
  readonly dataOffset: number;
  readonly dataByteLength: number;
}

/**
 * Encodes the stable v1 binary contract. This helper is suitable for tests and
 * build-time generation; production browser code normally only decodes files.
 */
export function encodeEphemerisBinary(
  bodies: readonly EncodableEphemerisBodySeries[],
): ArrayBuffer {
  if (bodies.length === 0) {
    throw new RangeError('At least one ephemeris body series is required.');
  }
  assertUint32(bodies.length, 'Body count');

  const encoder = new TextEncoder();
  const seenBodyIds = new Set<string>();
  const preliminary = bodies.map((body) => {
    assertBodyId(body.bodyId, seenBodyIds);
    const bodyIdBytes = encoder.encode(body.bodyId);
    if (bodyIdBytes.byteLength > UINT16_MAX) {
      throw new RangeError(`Body identifier "${body.bodyId}" exceeds 65535 UTF-8 bytes.`);
    }
    assertFinite(body.startJdTdb, `Start JD TDB for "${body.bodyId}"`);
    assertPositiveFinite(body.stepSeconds, `Sample step for "${body.bodyId}"`);
    if (body.samples.length % EPHEMERIS_BINARY_COMPONENT_COUNT !== 0) {
      throw new RangeError(
        `Samples for "${body.bodyId}" must contain a multiple of six components.`,
      );
    }
    const sampleCount = body.samples.length / EPHEMERIS_BINARY_COMPONENT_COUNT;
    if (!Number.isSafeInteger(sampleCount) || sampleCount < 2) {
      throw new RangeError(`Body "${body.bodyId}" requires at least two complete samples.`);
    }
    assertUint32(sampleCount, `Sample count for "${body.bodyId}"`);
    const endJdTdb =
      body.startJdTdb + ((sampleCount - 1) * body.stepSeconds) / SECONDS_PER_DAY;
    assertFinite(endJdTdb, `End JD TDB for "${body.bodyId}"`);
    return { input: body, bodyIdBytes, sampleCount };
  });

  const directoryOffset = EPHEMERIS_BINARY_HEADER_BYTES;
  const stringTableOffset =
    directoryOffset + bodies.length * EPHEMERIS_BINARY_DIRECTORY_ENTRY_BYTES;
  assertUint32(stringTableOffset, 'String table offset');

  let nextBodyIdOffset = 0;
  for (const body of preliminary) {
    nextBodyIdOffset += body.bodyIdBytes.byteLength;
    assertUint32(nextBodyIdOffset, 'String table length');
  }

  const dataOffset = alignToEight(stringTableOffset + nextBodyIdOffset);
  assertUint32(dataOffset, 'Data offset');

  let nextStringOffset = 0;
  let nextDataOffset = dataOffset;
  const layouts: EncodedBodyLayout[] = preliminary.map((body) => {
    const dataByteLength = body.sampleCount * EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES;
    assertUint32(dataByteLength, `Data length for "${body.input.bodyId}"`);
    const layout: EncodedBodyLayout = {
      ...body,
      bodyIdOffset: nextStringOffset,
      dataOffset: nextDataOffset,
      dataByteLength,
    };
    nextStringOffset += body.bodyIdBytes.byteLength;
    nextDataOffset += dataByteLength;
    assertUint32(nextDataOffset, 'Ephemeris file length');
    return layout;
  });

  const buffer = new ArrayBuffer(nextDataOffset);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  bytes.set(MAGIC_BYTES, 0);
  view.setUint16(8, EPHEMERIS_BINARY_VERSION_MAJOR, true);
  view.setUint16(10, EPHEMERIS_BINARY_VERSION_MINOR, true);
  view.setUint32(12, EPHEMERIS_BINARY_FLAGS, true);
  view.setUint32(16, EPHEMERIS_BINARY_HEADER_BYTES, true);
  view.setUint32(20, bodies.length, true);
  view.setUint32(24, directoryOffset, true);
  view.setUint32(28, stringTableOffset, true);
  view.setUint32(32, dataOffset, true);
  view.setUint32(36, buffer.byteLength, true);

  layouts.forEach((body, bodyIndex) => {
    const entryOffset =
      directoryOffset + bodyIndex * EPHEMERIS_BINARY_DIRECTORY_ENTRY_BYTES;
    view.setUint32(entryOffset, body.bodyIdOffset, true);
    view.setUint16(entryOffset + 4, body.bodyIdBytes.byteLength, true);
    view.setUint16(entryOffset + 6, EPHEMERIS_BINARY_COMPONENT_COUNT, true);
    view.setFloat64(entryOffset + 8, body.input.startJdTdb, true);
    view.setFloat64(entryOffset + 16, body.input.stepSeconds, true);
    view.setUint32(entryOffset + 24, body.sampleCount, true);
    view.setUint32(entryOffset + 28, EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES, true);
    view.setUint32(entryOffset + 32, body.dataOffset, true);
    view.setUint32(entryOffset + 36, body.dataByteLength, true);
    view.setUint32(entryOffset + 40, 0, true);
    view.setUint32(entryOffset + 44, 0, true);

    bytes.set(body.bodyIdBytes, stringTableOffset + body.bodyIdOffset);
    for (let componentIndex = 0; componentIndex < body.input.samples.length; componentIndex += 1) {
      const value = body.input.samples[componentIndex];
      if (value === undefined || !Number.isFinite(value)) {
        throw new RangeError(
          `Sample component ${componentIndex} for "${body.input.bodyId}" must be finite.`,
        );
      }
      view.setFloat64(
        body.dataOffset + componentIndex * Float64Array.BYTES_PER_ELEMENT,
        value,
        true,
      );
    }
  });

  return buffer;
}

/** Validates and decodes an IOM ephemeris v1 binary. */
export function decodeEphemerisBinary(buffer: ArrayBuffer): DecodedEphemerisBinary {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new EphemerisFormatError('Ephemeris input must be an ArrayBuffer.');
  }
  if (buffer.byteLength < EPHEMERIS_BINARY_HEADER_BYTES) {
    throw new EphemerisFormatError('Ephemeris binary is shorter than the v1 header.');
  }

  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < MAGIC_BYTES.length; index += 1) {
    if (bytes[index] !== MAGIC_BYTES[index]) {
      throw new EphemerisFormatError('Ephemeris binary has an invalid magic signature.');
    }
  }

  const view = new DataView(buffer);
  const versionMajor = view.getUint16(8, true);
  const versionMinor = view.getUint16(10, true);
  if (
    versionMajor !== EPHEMERIS_BINARY_VERSION_MAJOR ||
    versionMinor !== EPHEMERIS_BINARY_VERSION_MINOR
  ) {
    throw new EphemerisFormatError(
      `Unsupported ephemeris binary version ${versionMajor}.${versionMinor}.`,
    );
  }

  const flags = view.getUint32(12, true);
  if (flags !== EPHEMERIS_BINARY_FLAGS) {
    throw new EphemerisFormatError(`Unsupported ephemeris binary flags 0x${flags.toString(16)}.`);
  }

  const headerBytes = view.getUint32(16, true);
  const bodyCount = view.getUint32(20, true);
  const directoryOffset = view.getUint32(24, true);
  const stringTableOffset = view.getUint32(28, true);
  const dataOffset = view.getUint32(32, true);
  const declaredFileBytes = view.getUint32(36, true);

  if (headerBytes !== EPHEMERIS_BINARY_HEADER_BYTES) {
    throw new EphemerisFormatError(`Unexpected header length ${headerBytes}.`);
  }
  if (bodyCount === 0) {
    throw new EphemerisFormatError('Ephemeris binary contains no bodies.');
  }
  if (declaredFileBytes !== buffer.byteLength) {
    throw new EphemerisFormatError(
      `Declared file length ${declaredFileBytes} does not match ${buffer.byteLength}.`,
    );
  }
  if (directoryOffset !== EPHEMERIS_BINARY_HEADER_BYTES) {
    throw new EphemerisFormatError(`Unexpected directory offset ${directoryOffset}.`);
  }

  const expectedStringTableOffset =
    directoryOffset + bodyCount * EPHEMERIS_BINARY_DIRECTORY_ENTRY_BYTES;
  if (!Number.isSafeInteger(expectedStringTableOffset) || stringTableOffset !== expectedStringTableOffset) {
    throw new EphemerisFormatError('Directory length or string table offset is invalid.');
  }
  if (
    dataOffset < stringTableOffset ||
    dataOffset > buffer.byteLength ||
    dataOffset % Float64Array.BYTES_PER_ELEMENT !== 0
  ) {
    throw new EphemerisFormatError('Ephemeris data offset is invalid or unaligned.');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const seenBodyIds = new Set<string>();
  const layouts: DecodedBodyLayout[] = [];

  for (let bodyIndex = 0; bodyIndex < bodyCount; bodyIndex += 1) {
    const entryOffset =
      directoryOffset + bodyIndex * EPHEMERIS_BINARY_DIRECTORY_ENTRY_BYTES;
    const bodyIdRelativeOffset = view.getUint32(entryOffset, true);
    const bodyIdByteLength = view.getUint16(entryOffset + 4, true);
    const componentCount = view.getUint16(entryOffset + 6, true);
    const startJdTdb = view.getFloat64(entryOffset + 8, true);
    const stepSeconds = view.getFloat64(entryOffset + 16, true);
    const sampleCount = view.getUint32(entryOffset + 24, true);
    const sampleStrideBytes = view.getUint32(entryOffset + 28, true);
    const bodyDataOffset = view.getUint32(entryOffset + 32, true);
    const bodyDataByteLength = view.getUint32(entryOffset + 36, true);
    const reserved0 = view.getUint32(entryOffset + 40, true);
    const reserved1 = view.getUint32(entryOffset + 44, true);

    if (bodyIdByteLength === 0) {
      throw new EphemerisFormatError(`Directory entry ${bodyIndex} has an empty body identifier.`);
    }
    const bodyIdStart = stringTableOffset + bodyIdRelativeOffset;
    const bodyIdEnd = bodyIdStart + bodyIdByteLength;
    if (
      !Number.isSafeInteger(bodyIdEnd) ||
      bodyIdStart < stringTableOffset ||
      bodyIdEnd > dataOffset
    ) {
      throw new EphemerisFormatError(`Directory entry ${bodyIndex} has an invalid body identifier span.`);
    }

    let bodyId: string;
    try {
      bodyId = decoder.decode(bytes.subarray(bodyIdStart, bodyIdEnd));
    } catch {
      throw new EphemerisFormatError(`Directory entry ${bodyIndex} body identifier is not UTF-8.`);
    }
    if (bodyId.length === 0 || bodyId !== bodyId.trim() || bodyId.includes('\0')) {
      throw new EphemerisFormatError(`Directory entry ${bodyIndex} has an invalid body identifier.`);
    }
    if (seenBodyIds.has(bodyId)) {
      throw new EphemerisFormatError(`Duplicate ephemeris body identifier "${bodyId}".`);
    }
    seenBodyIds.add(bodyId);

    if (componentCount !== EPHEMERIS_BINARY_COMPONENT_COUNT) {
      throw new EphemerisFormatError(`Body "${bodyId}" does not have six state components.`);
    }
    if (sampleStrideBytes !== EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES) {
      throw new EphemerisFormatError(`Body "${bodyId}" has an unsupported sample stride.`);
    }
    if (!Number.isFinite(startJdTdb)) {
      throw new EphemerisFormatError(`Body "${bodyId}" start JD TDB is not finite.`);
    }
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new EphemerisFormatError(`Body "${bodyId}" sample step is not positive and finite.`);
    }
    if (sampleCount < 2) {
      throw new EphemerisFormatError(`Body "${bodyId}" requires at least two samples.`);
    }
    const expectedBodyDataBytes = sampleCount * EPHEMERIS_BINARY_SAMPLE_STRIDE_BYTES;
    if (!Number.isSafeInteger(expectedBodyDataBytes) || bodyDataByteLength !== expectedBodyDataBytes) {
      throw new EphemerisFormatError(`Body "${bodyId}" data length does not match its sample count.`);
    }
    const bodyDataEnd = bodyDataOffset + bodyDataByteLength;
    if (
      !Number.isSafeInteger(bodyDataEnd) ||
      bodyDataOffset < dataOffset ||
      bodyDataOffset % Float64Array.BYTES_PER_ELEMENT !== 0 ||
      bodyDataEnd > buffer.byteLength
    ) {
      throw new EphemerisFormatError(`Body "${bodyId}" has an invalid or unaligned data span.`);
    }
    if (reserved0 !== 0 || reserved1 !== 0) {
      throw new EphemerisFormatError(`Body "${bodyId}" uses unsupported directory extensions.`);
    }

    const endJdTdb = startJdTdb + ((sampleCount - 1) * stepSeconds) / SECONDS_PER_DAY;
    if (!Number.isFinite(endJdTdb)) {
      throw new EphemerisFormatError(`Body "${bodyId}" end JD TDB is not finite.`);
    }
    layouts.push({
      bodyId,
      startJdTdb,
      endJdTdb,
      stepSeconds,
      sampleCount,
      dataOffset: bodyDataOffset,
      dataByteLength: bodyDataByteLength,
    });
  }

  assertNonOverlappingData(layouts);

  const decodedBodies = layouts.map((layout) => {
    const componentLength = layout.sampleCount * EPHEMERIS_BINARY_COMPONENT_COUNT;
    const samples = readFloat64Samples(buffer, view, layout.dataOffset, componentLength);
    for (let componentIndex = 0; componentIndex < samples.length; componentIndex += 1) {
      if (!Number.isFinite(samples[componentIndex])) {
        throw new EphemerisFormatError(
          `Body "${layout.bodyId}" sample component ${componentIndex} is not finite.`,
        );
      }
    }
    return Object.freeze({
      bodyId: layout.bodyId,
      startJdTdb: layout.startJdTdb,
      endJdTdb: layout.endJdTdb,
      stepSeconds: layout.stepSeconds,
      sampleCount: layout.sampleCount,
      samples,
    });
  });

  return Object.freeze({
    versionMajor,
    versionMinor,
    byteLength: buffer.byteLength,
    bodies: Object.freeze(decodedBodies),
  });
}

function assertNonOverlappingData(layouts: readonly DecodedBodyLayout[]): void {
  const byOffset = [...layouts].sort((left, right) => left.dataOffset - right.dataOffset);
  let previousEnd = -1;
  for (const body of byOffset) {
    if (body.dataOffset < previousEnd) {
      throw new EphemerisFormatError(`Body "${body.bodyId}" overlaps another body data span.`);
    }
    previousEnd = body.dataOffset + body.dataByteLength;
  }
}

function readFloat64Samples(
  buffer: ArrayBuffer,
  view: DataView,
  byteOffset: number,
  length: number,
): Float64Array {
  if (LITTLE_ENDIAN) {
    return new Float64Array(buffer, byteOffset, length);
  }
  const samples = new Float64Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = view.getFloat64(byteOffset + index * Float64Array.BYTES_PER_ELEMENT, true);
  }
  return samples;
}

function assertBodyId(bodyId: string, seenBodyIds: Set<string>): void {
  if (bodyId.length === 0 || bodyId !== bodyId.trim() || bodyId.includes('\0')) {
    throw new TypeError('Ephemeris body identifiers must be non-empty, trimmed strings without NUL.');
  }
  if (seenBodyIds.has(bodyId)) {
    throw new RangeError(`Duplicate ephemeris body identifier "${bodyId}".`);
  }
  seenBodyIds.add(bodyId);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be positive and finite.`);
  }
}

function assertUint32(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError(`${label} does not fit in an unsigned 32-bit integer.`);
  }
}

function alignToEight(value: number): number {
  return Math.ceil(value / Float64Array.BYTES_PER_ELEMENT) * Float64Array.BYTES_PER_ELEMENT;
}

function isLittleEndianPlatform(): boolean {
  const bytes = new Uint8Array(Uint16Array.of(1).buffer);
  return bytes[0] === 1;
}
