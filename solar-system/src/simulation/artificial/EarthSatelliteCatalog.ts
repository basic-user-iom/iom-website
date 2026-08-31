import { dateUtcToApproximateTdb } from '../core/JulianDate';
import type { DataProvenance } from '../bodies/DataProvenance';
import generatedSnapshot from '../../data/generated/earth-satellites.omm.v1.json';

export type EarthSatelliteCategory =
  | 'space-stations'
  | 'science'
  | 'weather'
  | 'navigation'
  | 'communications';

export interface OmmRecord {
  readonly OBJECT_NAME?: string;
  readonly OBJECT_ID?: string;
  readonly NORAD_CAT_ID: string | number;
  readonly EPOCH: string;
  readonly MEAN_MOTION: string | number;
  readonly ECCENTRICITY: string | number;
  readonly INCLINATION: string | number;
  readonly RA_OF_ASC_NODE: string | number;
  readonly ARG_OF_PERICENTER: string | number;
  readonly MEAN_ANOMALY: string | number;
  readonly BSTAR?: string | number;
  readonly MEAN_MOTION_DOT?: string | number;
  readonly MEAN_MOTION_DDOT?: string | number;
  readonly EPHEMERIS_TYPE?: string | number;
  readonly CLASSIFICATION_TYPE?: string;
  readonly ELEMENT_SET_NO?: string | number;
  readonly REV_AT_EPOCH?: string | number;
}

export interface EarthSatelliteDefinition {
  readonly id: string;
  readonly name: string;
  readonly catalogId: string;
  readonly objectId: string | null;
  readonly category: EarthSatelliteCategory;
  readonly elementEpochJdTdb: number;
  readonly elementEpochUtc: string;
  readonly meanMotionRevolutionsPerDay: number;
  readonly eccentricity: number;
  readonly inclinationRad: number;
  readonly longitudeOfAscendingNodeRad: number;
  readonly argumentOfPericenterRad: number;
  readonly meanAnomalyRad: number;
  readonly bstar: number;
  readonly meanMotionDotRevolutionsPerDaySquared: number;
  readonly meanMotionDdotRevolutionsPerDayCubed: number;
  readonly elementSetNumber: number;
  readonly revolutionAtEpoch: number;
  readonly classificationType: 'U' | 'C';
  readonly preferredWindowDays: number;
  readonly hardMaximumWindowDays: number;
  readonly provenance: readonly DataProvenance[];
}

export interface EarthSatelliteCatalogMetadata {
  readonly catalogVersion: string;
  readonly retrievedAtUtc: string;
  readonly sourceUrl: string;
  readonly format: 'OMM-JSON';
  readonly objectCount: number;
  readonly checksum: string;
  readonly generatorVersion: string;
  readonly notes: readonly string[];
}

const RETRIEVED_AT = generatedSnapshot.retrievedAtUtc;
const DEFAULT_PROVENANCE: DataProvenance = Object.freeze({
  provider: 'CELESTRAK_OMM',
  sourceName: 'CelesTrak GP current public OMM snapshot (bundled fallback)',
  referenceFrame: 'TEME',
  timeScale: 'UTC element epoch / approximate TDB display conversion',
  units: 'OMM km, km/s, radians, revolutions/day',
  retrievedAtIso: RETRIEVED_AT,
  generatorVersion: 'earth-satellites-1.0.0',
  notes: Object.freeze([
    'This compact offline fixture is a fallback snapshot; production updates are generated outside the browser.',
    'SGP4 propagation is isolated behind the provider boundary and data-age limits prevent century-scale extrapolation.',
  ]),
});

export const EARTH_SATELLITE_CATALOG_METADATA: EarthSatelliteCatalogMetadata = Object.freeze({
  catalogVersion: generatedSnapshot.catalogVersion,
  retrievedAtUtc: RETRIEVED_AT,
  sourceUrl: generatedSnapshot.sourceUrl,
  format: 'OMM-JSON',
  objectCount: generatedSnapshot.records.length,
  checksum: generatedSnapshot.checksum,
  generatorVersion: generatedSnapshot.generatorVersion,
  notes: Object.freeze([
    'Catalog IDs remain strings so values above 99999 are preserved.',
    'Data age is shown when the selected date leaves the preferred element window.',
    'Markers are not to scale; selected-object rendering remains a future physical-model layer.',
  ]),
});

const BUNDLED_OMM = generatedSnapshot.records as readonly Readonly<OmmRecord & { category: EarthSatelliteCategory }>[];

export const EARTH_SATELLITE_DEFINITIONS: readonly EarthSatelliteDefinition[] = Object.freeze(
  BUNDLED_OMM.map((record) => normalizeOmmRecord(record)),
);

export function getEarthSatelliteDefinition(id: string): EarthSatelliteDefinition | undefined {
  return EARTH_SATELLITE_DEFINITIONS.find((satellite) => satellite.id === id);
}

export function normalizeOmmRecord(
  record: Readonly<OmmRecord & { category?: EarthSatelliteCategory }>,
): EarthSatelliteDefinition {
  const catalogId = String(record.NORAD_CAT_ID).trim();
  if (!/^\d+$/.test(catalogId)) throw new RangeError('OMM NORAD_CAT_ID must be an integer string.');
  const epoch = new Date(record.EPOCH);
  if (Number.isNaN(epoch.getTime())) throw new RangeError(`OMM epoch is invalid for ${catalogId}.`);
  const numeric = (value: string | number, label: string): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) throw new RangeError(`OMM ${label} is invalid for ${catalogId}.`);
    return parsed;
  };
  const eccentricity = numeric(record.ECCENTRICITY, 'eccentricity');
  const meanMotion = numeric(record.MEAN_MOTION, 'mean motion');
  if (meanMotion <= 0 || eccentricity < 0 || eccentricity >= 1) throw new RangeError(`OMM orbital elements are invalid for ${catalogId}.`);
  return Object.freeze({
    id: `earth-satellite-${catalogId}`,
    name: record.OBJECT_NAME?.trim() || `Catalog ${catalogId}`,
    catalogId,
    objectId: record.OBJECT_ID?.trim() || null,
    category: record.category ?? 'science',
    elementEpochJdTdb: dateUtcToApproximateTdb(epoch),
    elementEpochUtc: epoch.toISOString(),
    meanMotionRevolutionsPerDay: meanMotion,
    eccentricity,
    inclinationRad: numeric(record.INCLINATION, 'inclination') * Math.PI / 180,
    longitudeOfAscendingNodeRad: numeric(record.RA_OF_ASC_NODE, 'RA of ascending node') * Math.PI / 180,
    argumentOfPericenterRad: numeric(record.ARG_OF_PERICENTER, 'argument of pericenter') * Math.PI / 180,
    meanAnomalyRad: numeric(record.MEAN_ANOMALY, 'mean anomaly') * Math.PI / 180,
    bstar: record.BSTAR === undefined ? 0 : numeric(record.BSTAR, 'BSTAR'),
    meanMotionDotRevolutionsPerDaySquared: record.MEAN_MOTION_DOT === undefined ? 0 : numeric(record.MEAN_MOTION_DOT, 'mean motion dot'),
    meanMotionDdotRevolutionsPerDayCubed: record.MEAN_MOTION_DDOT === undefined ? 0 : numeric(record.MEAN_MOTION_DDOT, 'mean motion double dot'),
    elementSetNumber: record.ELEMENT_SET_NO === undefined ? 0 : numeric(record.ELEMENT_SET_NO, 'element set number'),
    revolutionAtEpoch: record.REV_AT_EPOCH === undefined ? 0 : numeric(record.REV_AT_EPOCH, 'revolution at epoch'),
    classificationType: record.CLASSIFICATION_TYPE === 'C' ? 'C' : 'U',
    preferredWindowDays: 30,
    hardMaximumWindowDays: 180,
    provenance: Object.freeze([{ ...DEFAULT_PROVENANCE, targetId: catalogId }]),
  });
}

export function normalizeOmmSnapshot(
  records: readonly (Readonly<OmmRecord & { category?: EarthSatelliteCategory }> | null | undefined)[],
): { readonly definitions: readonly EarthSatelliteDefinition[]; readonly rejected: readonly string[] } {
  const definitions: EarthSatelliteDefinition[] = [];
  const rejected: string[] = [];
  for (const [index, record] of records.entries()) {
    if (record === null || record === undefined) {
      rejected.push(`record-${index}: missing`);
      continue;
    }
    try {
      definitions.push(normalizeOmmRecord(record));
    } catch (error) {
      rejected.push(`record-${index}: ${error instanceof Error ? error.message : 'invalid OMM record'}`);
    }
  }
  return Object.freeze({ definitions: Object.freeze(definitions), rejected: Object.freeze(rejected) });
}
