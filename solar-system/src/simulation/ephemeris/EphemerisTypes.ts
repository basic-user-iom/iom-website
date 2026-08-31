import type { DataProvenance } from '../bodies/DataProvenance';
import { createVec3d, type Vec3d } from '../core/Vec3d';

/** Inclusive interval covered by one uniformly sampled body series. */
export interface EphemerisCoverage {
  readonly startJdTdb: number;
  readonly endJdTdb: number;
  readonly sampleStepSeconds: number;
  readonly sampleCount: number;
}

/** Mutable output owned by the caller and reused across samples. */
export interface EphemerisStateVector {
  jdTdb: number;
  readonly positionM: Vec3d;
  readonly velocityMps: Vec3d;
}

export type EphemerisOutOfRangeBehavior = 'throw' | 'clamp';

export interface GeneratedEphemerisManifestBody {
  readonly bodyId: string;
  readonly displayName: string;
  readonly provenance: DataProvenance;
}

export interface GeneratedEphemerisFormatDescription {
  readonly id: 'IOMEPH';
  readonly versionMajor: 1;
  readonly versionMinor: 0;
  readonly byteOrder: 'little-endian';
  readonly scalarType: 'float64';
  readonly componentOrder: readonly ['px', 'py', 'pz', 'vx', 'vy', 'vz'];
  readonly units: readonly ['m', 'm', 'm', 'm/s', 'm/s', 'm/s'];
}

/**
 * Provenance lives in JSON instead of the compact numerical binary. The body
 * identifier is the join key and must occur exactly once in both files.
 */
export interface GeneratedEphemerisManifest {
  readonly schemaVersion: 1;
  readonly datasetId: string;
  readonly binaryFile: string;
  readonly binarySha256: string;
  readonly format: GeneratedEphemerisFormatDescription;
  readonly generatedAtIso: string;
  readonly bodies: readonly GeneratedEphemerisManifestBody[];
}

export function createEphemerisStateVector(): EphemerisStateVector {
  return {
    jdTdb: 0,
    positionM: createVec3d(),
    velocityMps: createVec3d(),
  };
}
