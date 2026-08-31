import type { DataProvenance } from '../bodies/DataProvenance';
import { SECONDS_PER_DAY } from '../core/Units';
import { setVec3d } from '../core/Vec3d';
import { interpolateCubicHermiteSamples } from './CubicHermite';
import {
  decodeEphemerisBinary,
  EPHEMERIS_BINARY_COMPONENT_COUNT,
  EPHEMERIS_BINARY_VERSION_MAJOR,
  EPHEMERIS_BINARY_VERSION_MINOR,
  type DecodedEphemerisBinary,
  type DecodedEphemerisBodySeries,
} from './EphemerisBinary';
import {
  EphemerisBodyNotFoundError,
  EphemerisFormatError,
  EphemerisOutOfRangeError,
} from './EphemerisErrors';
import type { EphemerisProvider } from './EphemerisProvider';
import type {
  EphemerisCoverage,
  EphemerisOutOfRangeBehavior,
  EphemerisStateVector,
  GeneratedEphemerisManifest,
} from './EphemerisTypes';

export interface GeneratedEphemerisProviderOptions {
  readonly outOfRangeBehavior?: EphemerisOutOfRangeBehavior;
}

interface BodyRecord {
  readonly series: DecodedEphemerisBodySeries;
  readonly coverage: EphemerisCoverage;
  readonly provenance: DataProvenance;
}

/**
 * Runtime adapter for generated files. It never performs network requests and
 * never silently substitutes analytical or fixture data.
 */
export class GeneratedEphemerisProvider implements EphemerisProvider {
  readonly id: string;
  readonly bodyIds: readonly string[];
  readonly outOfRangeBehavior: EphemerisOutOfRangeBehavior;

  readonly #records = new Map<string, BodyRecord>();

  constructor(
    dataset: DecodedEphemerisBinary,
    manifest: GeneratedEphemerisManifest,
    options: GeneratedEphemerisProviderOptions = {},
  ) {
    assertManifestHeader(manifest, dataset);
    this.id = manifest.datasetId;
    this.outOfRangeBehavior = options.outOfRangeBehavior ?? 'throw';
    if (this.outOfRangeBehavior !== 'throw' && this.outOfRangeBehavior !== 'clamp') {
      throw new TypeError(`Unknown ephemeris out-of-range behavior "${this.outOfRangeBehavior}".`);
    }

    const provenanceByBody = new Map<string, DataProvenance>();
    for (const entry of manifest.bodies) {
      assertBodyId(entry.bodyId, 'Manifest');
      if (provenanceByBody.has(entry.bodyId)) {
        throw new EphemerisFormatError(
          `Generated manifest contains duplicate body identifier "${entry.bodyId}".`,
        );
      }
      provenanceByBody.set(entry.bodyId, entry.provenance);
    }

    for (const series of dataset.bodies) {
      if (this.#records.has(series.bodyId)) {
        throw new EphemerisFormatError(
          `Decoded dataset contains duplicate body identifier "${series.bodyId}".`,
        );
      }
      const provenance = provenanceByBody.get(series.bodyId);
      if (provenance === undefined) {
        throw new EphemerisFormatError(
          `Generated manifest has no provenance for body "${series.bodyId}".`,
        );
      }
      const coverage = Object.freeze({
        startJdTdb: series.startJdTdb,
        endJdTdb: series.endJdTdb,
        sampleStepSeconds: series.stepSeconds,
        sampleCount: series.sampleCount,
      });
      assertProvenanceCoverage(series.bodyId, provenance, coverage);
      this.#records.set(series.bodyId, { series, coverage, provenance });
      provenanceByBody.delete(series.bodyId);
    }

    const extraBodyId = provenanceByBody.keys().next().value as string | undefined;
    if (extraBodyId !== undefined) {
      throw new EphemerisFormatError(
        `Generated manifest body "${extraBodyId}" is missing from the binary.`,
      );
    }
    if (this.#records.size === 0) {
      throw new EphemerisFormatError('Generated ephemeris provider requires at least one body.');
    }
    this.bodyIds = Object.freeze([...this.#records.keys()]);
  }

  static fromBinary(
    buffer: ArrayBuffer,
    manifest: GeneratedEphemerisManifest,
    options: GeneratedEphemerisProviderOptions = {},
  ): GeneratedEphemerisProvider {
    return new GeneratedEphemerisProvider(decodeEphemerisBinary(buffer), manifest, options);
  }

  hasBody(bodyId: string): boolean {
    return this.#records.has(bodyId);
  }

  getCoverage(bodyId: string): EphemerisCoverage | undefined {
    return this.#records.get(bodyId)?.coverage;
  }

  getProvenance(bodyId: string): DataProvenance | undefined {
    return this.#records.get(bodyId)?.provenance;
  }

  sample(bodyId: string, jdTdb: number, out: EphemerisStateVector): EphemerisStateVector {
    const record = this.#records.get(bodyId);
    if (record === undefined) {
      throw new EphemerisBodyNotFoundError(bodyId);
    }
    if (!Number.isFinite(jdTdb)) {
      throw new RangeError('Ephemeris sample JD TDB must be finite.');
    }

    let sampledJdTdb = jdTdb;
    if (sampledJdTdb < record.coverage.startJdTdb) {
      if (this.outOfRangeBehavior === 'throw') {
        throw new EphemerisOutOfRangeError(bodyId, jdTdb, record.coverage);
      }
      sampledJdTdb = record.coverage.startJdTdb;
    } else if (sampledJdTdb > record.coverage.endJdTdb) {
      if (this.outOfRangeBehavior === 'throw') {
        throw new EphemerisOutOfRangeError(bodyId, jdTdb, record.coverage);
      }
      sampledJdTdb = record.coverage.endJdTdb;
    }

    const series = record.series;
    if (sampledJdTdb <= series.startJdTdb) {
      writeExactSample(series.samples, 0, out);
    } else if (sampledJdTdb >= series.endJdTdb) {
      writeExactSample(series.samples, series.sampleCount - 1, out);
    } else {
      const elapsedSeconds = (sampledJdTdb - series.startJdTdb) * SECONDS_PER_DAY;
      const sampleCoordinate = elapsedSeconds / series.stepSeconds;
      const leftSampleIndex = Math.min(
        Math.floor(sampleCoordinate),
        series.sampleCount - 2,
      );
      const fraction = Math.min(1, Math.max(0, sampleCoordinate - leftSampleIndex));
      const firstOffset = leftSampleIndex * EPHEMERIS_BINARY_COMPONENT_COUNT;
      interpolateCubicHermiteSamples(
        out.positionM,
        out.velocityMps,
        series.samples,
        firstOffset,
        firstOffset + EPHEMERIS_BINARY_COMPONENT_COUNT,
        fraction,
        series.stepSeconds,
      );
    }
    out.jdTdb = sampledJdTdb;
    return out;
  }
}

function writeExactSample(
  samples: ArrayLike<number>,
  sampleIndex: number,
  out: EphemerisStateVector,
): void {
  const offset = sampleIndex * EPHEMERIS_BINARY_COMPONENT_COUNT;
  setVec3d(
    out.positionM,
    requiredComponent(samples, offset),
    requiredComponent(samples, offset + 1),
    requiredComponent(samples, offset + 2),
  );
  setVec3d(
    out.velocityMps,
    requiredComponent(samples, offset + 3),
    requiredComponent(samples, offset + 4),
    requiredComponent(samples, offset + 5),
  );
}

function requiredComponent(samples: ArrayLike<number>, index: number): number {
  const value = samples[index];
  if (value === undefined) {
    throw new EphemerisFormatError(`Decoded ephemeris component ${index} is unavailable.`);
  }
  return value;
}

function assertManifestHeader(
  manifest: GeneratedEphemerisManifest,
  dataset: DecodedEphemerisBinary,
): void {
  if (manifest.schemaVersion !== 1) {
    throw new EphemerisFormatError(
      `Unsupported generated ephemeris manifest version ${String(manifest.schemaVersion)}.`,
    );
  }
  if (manifest.datasetId.length === 0 || manifest.datasetId !== manifest.datasetId.trim()) {
    throw new EphemerisFormatError('Generated ephemeris manifest datasetId is invalid.');
  }
  if (manifest.binaryFile.length === 0 || manifest.binaryFile !== manifest.binaryFile.trim()) {
    throw new EphemerisFormatError('Generated ephemeris manifest binaryFile is invalid.');
  }
  if (!/^[a-f\d]{64}$/i.test(manifest.binarySha256)) {
    throw new EphemerisFormatError('Generated ephemeris manifest binarySha256 is invalid.');
  }
  if (!Number.isFinite(Date.parse(manifest.generatedAtIso))) {
    throw new EphemerisFormatError('Generated ephemeris manifest generatedAtIso is invalid.');
  }
  if (
    manifest.format.id !== 'IOMEPH' ||
    manifest.format.versionMajor !== EPHEMERIS_BINARY_VERSION_MAJOR ||
    manifest.format.versionMinor !== EPHEMERIS_BINARY_VERSION_MINOR ||
    manifest.format.byteOrder !== 'little-endian' ||
    manifest.format.scalarType !== 'float64' ||
    manifest.format.componentOrder.join(',') !== 'px,py,pz,vx,vy,vz' ||
    manifest.format.units.join(',') !== 'm,m,m,m/s,m/s,m/s' ||
    dataset.versionMajor !== manifest.format.versionMajor ||
    dataset.versionMinor !== manifest.format.versionMinor
  ) {
    throw new EphemerisFormatError('Generated ephemeris manifest format does not match the binary.');
  }
  if (manifest.bodies.length === 0) {
    throw new EphemerisFormatError('Generated ephemeris manifest contains no bodies.');
  }
}

function assertBodyId(bodyId: string, source: string): void {
  if (bodyId.length === 0 || bodyId !== bodyId.trim() || bodyId.includes('\0')) {
    throw new EphemerisFormatError(`${source} contains an invalid body identifier.`);
  }
}

function assertProvenanceCoverage(
  bodyId: string,
  provenance: DataProvenance,
  coverage: EphemerisCoverage,
): void {
  if (
    provenance.sourceName.length === 0 ||
    provenance.units.length === 0 ||
    provenance.generatorVersion.length === 0 ||
    !Number.isFinite(Date.parse(provenance.retrievedAtIso))
  ) {
    throw new EphemerisFormatError(`Provenance for "${bodyId}" is incomplete or invalid.`);
  }
  if (provenance.timeScale?.toUpperCase() !== 'TDB') {
    throw new EphemerisFormatError(`Provenance for "${bodyId}" must declare the TDB time scale.`);
  }
  if (
    provenance.provider === 'JPL_HORIZONS' &&
    (!provenance.targetId ||
      !provenance.centerId ||
      !provenance.referenceFrame ||
      !provenance.referencePlane)
  ) {
    throw new EphemerisFormatError(
      `JPL Horizons provenance for "${bodyId}" is missing target, center, frame, or plane.`,
    );
  }
  if (
    provenance.startJd === undefined ||
    provenance.endJd === undefined ||
    provenance.sampleStepSeconds === undefined
  ) {
    throw new EphemerisFormatError(
      `Provenance for "${bodyId}" must declare startJd, endJd, and sampleStepSeconds.`,
    );
  }
  assertSameTime(bodyId, 'start JD', provenance.startJd, coverage.startJdTdb);
  assertSameTime(bodyId, 'end JD', provenance.endJd, coverage.endJdTdb);
  assertSameNumber(
    bodyId,
    'sample step',
    provenance.sampleStepSeconds,
    coverage.sampleStepSeconds,
  );
}

function assertSameTime(bodyId: string, label: string, manifestJd: number, binaryJd: number): void {
  const differenceSeconds = Math.abs(manifestJd - binaryJd) * SECONDS_PER_DAY;
  // Horizons prints decimal JDs; its parser accepts uniform-grid rounding up
  // to 0.01 s, so the runtime uses the same boundary tolerance.
  if (!Number.isFinite(differenceSeconds) || differenceSeconds > 0.011) {
    throw new EphemerisFormatError(
      `Provenance ${label} for "${bodyId}" does not match the binary coverage.`,
    );
  }
}

function assertSameNumber(
  bodyId: string,
  label: string,
  manifestValue: number,
  binaryValue: number,
): void {
  const tolerance = Math.max(1e-9, Math.abs(binaryValue) * Number.EPSILON * 8);
  if (!Number.isFinite(manifestValue) || Math.abs(manifestValue - binaryValue) > tolerance) {
    throw new EphemerisFormatError(
      `Provenance ${label} for "${bodyId}" does not match the binary coverage.`,
    );
  }
}
