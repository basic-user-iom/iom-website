import type { DataProvenance } from '../bodies/DataProvenance';
import { EphemerisBodyNotFoundError, EphemerisOutOfRangeError } from './EphemerisErrors';
import type { EphemerisProvider } from './EphemerisProvider';
import type {
  EphemerisCoverage,
  EphemerisStateVector,
} from './EphemerisTypes';

export interface EphemerisSegmentDefinition {
  readonly seriesBodyId: string;
  readonly startJdTdb: number;
  readonly endJdTdb: number;
  readonly stepSeconds: number;
  readonly kind: 'baseline' | 'perihelion';
}

export interface SegmentedEphemerisBodyDefinition {
  readonly bodyId: string;
  readonly segments: readonly Readonly<EphemerisSegmentDefinition>[];
}

export interface ActiveEphemerisSegment {
  readonly bodyId: string;
  readonly seriesBodyId: string;
  readonly stepSeconds: number;
  readonly kind: 'baseline' | 'perihelion';
}

interface LogicalBodyRecord {
  readonly definition: Readonly<SegmentedEphemerisBodyDefinition>;
  readonly coverage: Readonly<EphemerisCoverage>;
  readonly provenance: DataProvenance;
}

/**
 * Presents overlapping uniform IOMEPH series as one logical small body. The
 * finest segment covering the requested epoch wins; baseline coverage remains
 * available outside the dense perihelion windows.
 */
export class SegmentedEphemerisProvider implements EphemerisProvider {
  public readonly id: string;
  public readonly bodyIds: readonly string[];
  readonly #records = new Map<string, LogicalBodyRecord>();

  public constructor(
    public readonly source: EphemerisProvider,
    definitions: readonly Readonly<SegmentedEphemerisBodyDefinition>[],
  ) {
    if (definitions.length === 0) {
      throw new Error('Segmented ephemeris requires logical body definitions.');
    }
    for (const definition of definitions) {
      if (this.#records.has(definition.bodyId)) {
        throw new Error(`Duplicate segmented body "${definition.bodyId}".`);
      }
      const segments = validateSegments(source, definition);
      const startJdTdb = Math.min(...segments.map((segment) => segment.startJdTdb));
      const endJdTdb = Math.max(...segments.map((segment) => segment.endJdTdb));
      const minimumStep = Math.min(...segments.map((segment) => segment.stepSeconds));
      const firstSegment = segments[0];
      if (firstSegment === undefined) {
        throw new Error(`Segmented body "${definition.bodyId}" has no validated segments.`);
      }
      const provenance = source.getProvenance(firstSegment.seriesBodyId);
      if (provenance === undefined) {
        throw new Error(`Segment "${firstSegment.seriesBodyId}" has no provenance.`);
      }
      this.#records.set(definition.bodyId, {
        definition: Object.freeze({
          ...definition,
          segments: Object.freeze([...segments]),
        }),
        coverage: Object.freeze({
          startJdTdb,
          endJdTdb,
          sampleStepSeconds: minimumStep,
          sampleCount: segments.reduce(
            (total, segment) => total + requireCoverage(source, segment.seriesBodyId).sampleCount,
            0,
          ),
        }),
        provenance,
      });
    }
    this.bodyIds = Object.freeze([...this.#records.keys()]);
    this.id = `segmented:${source.id}`;
  }

  public hasBody(bodyId: string): boolean {
    return this.#records.has(bodyId);
  }

  public getCoverage(bodyId: string): EphemerisCoverage | undefined {
    return this.#records.get(bodyId)?.coverage;
  }

  public getProvenance(bodyId: string): DataProvenance | undefined {
    return this.#records.get(bodyId)?.provenance;
  }

  public getActiveSegment(bodyId: string, jdTdb: number): Readonly<ActiveEphemerisSegment> | null {
    const record = this.#records.get(bodyId);
    if (record === undefined) return null;
    const segment = chooseSegment(record.definition.segments, jdTdb);
    return segment === null
      ? null
      : Object.freeze({
          bodyId,
          seriesBodyId: segment.seriesBodyId,
          stepSeconds: segment.stepSeconds,
          kind: segment.kind,
        });
  }

  public sample(
    bodyId: string,
    jdTdb: number,
    out: EphemerisStateVector,
  ): EphemerisStateVector {
    const record = this.#records.get(bodyId);
    if (record === undefined) throw new EphemerisBodyNotFoundError(bodyId);
    const segment = chooseSegment(record.definition.segments, jdTdb);
    if (segment === null) {
      throw new EphemerisOutOfRangeError(bodyId, jdTdb, record.coverage);
    }
    return this.source.sample(segment.seriesBodyId, jdTdb, out);
  }
}

function chooseSegment(
  segments: readonly Readonly<EphemerisSegmentDefinition>[],
  jdTdb: number,
): Readonly<EphemerisSegmentDefinition> | null {
  if (!Number.isFinite(jdTdb)) throw new RangeError('Segmented ephemeris epoch must be finite.');
  let selected: Readonly<EphemerisSegmentDefinition> | null = null;
  for (const segment of segments) {
    if (jdTdb < segment.startJdTdb || jdTdb > segment.endJdTdb) continue;
    if (
      selected === null ||
      segment.stepSeconds < selected.stepSeconds ||
      (segment.stepSeconds === selected.stepSeconds && segment.kind === 'perihelion')
    ) {
      selected = segment;
    }
  }
  return selected;
}

function validateSegments(
  source: EphemerisProvider,
  definition: Readonly<SegmentedEphemerisBodyDefinition>,
): readonly Readonly<EphemerisSegmentDefinition>[] {
  if (definition.bodyId.trim().length === 0 || definition.segments.length === 0) {
    throw new Error('Segmented body requires an ID and at least one segment.');
  }
  const seriesIds = new Set<string>();
  for (const segment of definition.segments) {
    if (seriesIds.has(segment.seriesBodyId)) {
      throw new Error(`Duplicate series "${segment.seriesBodyId}" for "${definition.bodyId}".`);
    }
    seriesIds.add(segment.seriesBodyId);
    const coverage = requireCoverage(source, segment.seriesBodyId);
    if (
      Math.abs(coverage.startJdTdb - segment.startJdTdb) * 86_400 > 0.011 ||
      Math.abs(coverage.endJdTdb - segment.endJdTdb) * 86_400 > 0.011 ||
      coverage.sampleStepSeconds !== segment.stepSeconds
    ) {
      throw new Error(`Segment metadata for "${segment.seriesBodyId}" does not match IOMEPH.`);
    }
  }
  if (!definition.segments.some((segment) => segment.kind === 'baseline')) {
    throw new Error(`Segmented body "${definition.bodyId}" requires baseline coverage.`);
  }
  return definition.segments;
}

function requireCoverage(source: EphemerisProvider, bodyId: string): EphemerisCoverage {
  if (!source.hasBody(bodyId)) throw new Error(`IOMEPH source is missing segment "${bodyId}".`);
  const coverage = source.getCoverage(bodyId);
  if (coverage === undefined) throw new Error(`Segment "${bodyId}" has no coverage.`);
  return coverage;
}
