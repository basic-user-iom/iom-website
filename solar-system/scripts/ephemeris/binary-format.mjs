import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';

export const EPHEMERIS_MAGIC = 'IOMEPH\0\0';
export const EPHEMERIS_VERSION_MAJOR = 1;
export const EPHEMERIS_VERSION_MINOR = 0;
export const EPHEMERIS_FLAGS = 0x0f;
export const HEADER_BYTES = 40;
export const DIRECTORY_RECORD_BYTES = 48;
export const COMPONENT_COUNT = 6;
export const SAMPLE_STRIDE_BYTES = COMPONENT_COUNT * 8;

export function encodeEphemerisBinary(datasets) {
  if (!Array.isArray(datasets) || datasets.length === 0) {
    throw new Error('At least one body dataset is required.');
  }
  const encoder = new TextEncoder();
  const ids = new Set();
  const entries = datasets.map((dataset) => {
    validateDataset(dataset);
    if (ids.has(dataset.bodyId)) throw new Error(`Duplicate binary body id: ${dataset.bodyId}`);
    ids.add(dataset.bodyId);
    const idBytes = encoder.encode(dataset.bodyId);
    if (idBytes.length === 0 || idBytes.length > 65_535) throw new Error(`Invalid UTF-8 body id: ${dataset.bodyId}`);
    return { dataset, idBytes, stringOffset: 0, dataOffset: 0 };
  });

  const directoryOffset = HEADER_BYTES;
  const stringTableOffset = directoryOffset + entries.length * DIRECTORY_RECORD_BYTES;
  let stringBytes = 0;
  for (const entry of entries) {
    entry.stringOffset = stringBytes;
    stringBytes += entry.idBytes.length;
  }
  const dataOffset = align8(stringTableOffset + stringBytes);
  let fileBytes = dataOffset;
  for (const entry of entries) {
    entry.dataOffset = fileBytes;
    fileBytes += entry.dataset.sampleCount * SAMPLE_STRIDE_BYTES;
  }
  assertUint32(fileBytes, 'ephemeris file size');

  const output = Buffer.alloc(fileBytes);
  output.write(EPHEMERIS_MAGIC, 0, 8, 'latin1');
  output.writeUInt16LE(EPHEMERIS_VERSION_MAJOR, 8);
  output.writeUInt16LE(EPHEMERIS_VERSION_MINOR, 10);
  output.writeUInt32LE(EPHEMERIS_FLAGS, 12);
  output.writeUInt32LE(HEADER_BYTES, 16);
  output.writeUInt32LE(entries.length, 20);
  output.writeUInt32LE(directoryOffset, 24);
  output.writeUInt32LE(stringTableOffset, 28);
  output.writeUInt32LE(dataOffset, 32);
  output.writeUInt32LE(fileBytes, 36);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const offset = directoryOffset + index * DIRECTORY_RECORD_BYTES;
    output.writeUInt32LE(entry.stringOffset, offset);
    output.writeUInt16LE(entry.idBytes.length, offset + 4);
    output.writeUInt16LE(COMPONENT_COUNT, offset + 6);
    output.writeDoubleLE(entry.dataset.startJdTdb, offset + 8);
    output.writeDoubleLE(entry.dataset.stepSeconds, offset + 16);
    output.writeUInt32LE(entry.dataset.sampleCount, offset + 24);
    output.writeUInt32LE(SAMPLE_STRIDE_BYTES, offset + 28);
    output.writeUInt32LE(entry.dataOffset, offset + 32);
    output.writeUInt32LE(entry.dataset.sampleCount * SAMPLE_STRIDE_BYTES, offset + 36);
    output.writeUInt32LE(0, offset + 40);
    output.writeUInt32LE(0, offset + 44);
    output.set(entry.idBytes, stringTableOffset + entry.stringOffset);
    for (let valueIndex = 0; valueIndex < entry.dataset.valuesSi.length; valueIndex += 1) {
      output.writeDoubleLE(entry.dataset.valuesSi[valueIndex], entry.dataOffset + valueIndex * 8);
    }
  }
  return output;
}

/** Script-side contract decoder used for round-trip validation; runtime has its own decoder. */
export function decodeEphemerisBinary(buffer) {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (input.length < HEADER_BYTES || input.subarray(0, 8).toString('latin1') !== EPHEMERIS_MAGIC) {
    throw new Error('Invalid IOM ephemeris magic/header.');
  }
  const major = input.readUInt16LE(8);
  const minor = input.readUInt16LE(10);
  const flags = input.readUInt32LE(12);
  const headerBytes = input.readUInt32LE(16);
  const bodyCount = input.readUInt32LE(20);
  const directoryOffset = input.readUInt32LE(24);
  const stringTableOffset = input.readUInt32LE(28);
  const dataOffset = input.readUInt32LE(32);
  const fileBytes = input.readUInt32LE(36);
  if (major !== 1 || minor !== 0 || flags !== EPHEMERIS_FLAGS || headerBytes !== HEADER_BYTES) {
    throw new Error(`Unsupported ephemeris binary contract ${major}.${minor}, flags ${flags}.`);
  }
  if (fileBytes !== input.length || directoryOffset !== HEADER_BYTES || dataOffset % 8 !== 0) {
    throw new Error('Ephemeris binary header offsets or size are invalid.');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  const bodies = [];
  for (let index = 0; index < bodyCount; index += 1) {
    const offset = directoryOffset + index * DIRECTORY_RECORD_BYTES;
    if (offset + DIRECTORY_RECORD_BYTES > stringTableOffset) throw new Error('Directory overlaps string table.');
    const idOffset = input.readUInt32LE(offset);
    const idLength = input.readUInt16LE(offset + 4);
    const componentCount = input.readUInt16LE(offset + 6);
    const startJdTdb = input.readDoubleLE(offset + 8);
    const stepSeconds = input.readDoubleLE(offset + 16);
    const sampleCount = input.readUInt32LE(offset + 24);
    const strideBytes = input.readUInt32LE(offset + 28);
    const bodyDataOffset = input.readUInt32LE(offset + 32);
    const bodyDataByteLength = input.readUInt32LE(offset + 36);
    if (componentCount !== COMPONENT_COUNT || strideBytes !== SAMPLE_STRIDE_BYTES) {
      throw new Error('Unsupported ephemeris sample layout.');
    }
    if (stringTableOffset + idOffset + idLength > dataOffset) throw new Error('Body id is outside the string table.');
    if (bodyDataOffset % 8 !== 0 || bodyDataOffset + bodyDataByteLength > input.length) {
      throw new Error('Body data range is invalid.');
    }
    if (bodyDataByteLength !== sampleCount * SAMPLE_STRIDE_BYTES) throw new Error('Body data length mismatch.');
    const bodyId = decoder.decode(input.subarray(stringTableOffset + idOffset, stringTableOffset + idOffset + idLength));
    const valuesSi = new Float64Array(sampleCount * COMPONENT_COUNT);
    for (let valueIndex = 0; valueIndex < valuesSi.length; valueIndex += 1) {
      valuesSi[valueIndex] = input.readDoubleLE(bodyDataOffset + valueIndex * 8);
    }
    bodies.push({ bodyId, startJdTdb, stepSeconds, sampleCount, valuesSi });
  }
  return { major, minor, flags, bodies };
}

export const sha256Hex = (value) => createHash('sha256').update(value).digest('hex');

function validateDataset(dataset) {
  if (typeof dataset.bodyId !== 'string' || dataset.bodyId.length === 0) throw new Error('Dataset requires bodyId.');
  if (!Number.isFinite(dataset.startJdTdb)) throw new Error(`${dataset.bodyId}: startJdTdb is not finite.`);
  if (!Number.isFinite(dataset.stepSeconds) || dataset.stepSeconds <= 0) throw new Error(`${dataset.bodyId}: invalid step.`);
  if (!Number.isInteger(dataset.sampleCount) || dataset.sampleCount < 2) throw new Error(`${dataset.bodyId}: at least two samples required.`);
  if (!(dataset.valuesSi instanceof Float64Array) || dataset.valuesSi.length !== dataset.sampleCount * COMPONENT_COUNT) {
    throw new Error(`${dataset.bodyId}: valuesSi must contain sampleCount * 6 Float64 values.`);
  }
  for (const value of dataset.valuesSi) if (!Number.isFinite(value)) throw new Error(`${dataset.bodyId}: non-finite state value.`);
  assertUint32(dataset.sampleCount, `${dataset.bodyId} sample count`);
  assertUint32(dataset.sampleCount * SAMPLE_STRIDE_BYTES, `${dataset.bodyId} data length`);
}

function assertUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) throw new Error(`${label} exceeds uint32.`);
}

const align8 = (value) => Math.ceil(value / 8) * 8;
