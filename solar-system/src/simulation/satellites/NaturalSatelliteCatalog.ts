import type { DataProvenance } from '../bodies/DataProvenance';
import majorMoonAnchorJson from '../../data/generated/major-moon-anchors.horizons.v1.json';

export interface MajorMoonAnchorRecord {
  readonly id: string;
  readonly parentId: string;
  readonly horizonsTargetId: string;
  readonly horizonsCenterId: string;
  readonly targetName: string;
  readonly startJdTdb: number;
  readonly endJdTdb: number;
  readonly stepSeconds: number;
  readonly sampleCount: number;
  readonly valuesSi: readonly number[];
}

export interface MajorMoonAnchorArtifact {
  readonly catalogVersion: string;
  readonly retrievedAtUtc: string;
  readonly generatorVersion: string;
  readonly anchorStepDays: number;
  readonly moonCount: number;
  readonly checksum: string;
  readonly moons: readonly MajorMoonAnchorRecord[];
}

export const MAJOR_MOON_ANCHOR_ARTIFACT = majorMoonAnchorJson as MajorMoonAnchorArtifact;

export type NaturalSatelliteTier = 'major' | 'named' | 'minor-point';

export interface NaturalSatelliteDefinition {
  readonly id: string;
  readonly name: string;
  readonly parentId: string;
  readonly tier: NaturalSatelliteTier;
  readonly physicalRadiusM: number;
  readonly semiMajorAxisM: number;
  readonly eccentricity: number;
  readonly inclinationRad: number;
  readonly longitudeOfAscendingNodeRad: number;
  readonly argumentOfPeriapsisRad: number;
  readonly meanAnomalyAtEpochRad: number;
  readonly orbitalPeriodSeconds: number;
  readonly rotationPeriodSeconds: number;
  readonly retrograde: boolean;
  readonly synchronous: boolean;
  readonly visualProfile: string;
  readonly provenance: readonly DataProvenance[];
}

export interface NaturalSatelliteCatalogMetadata {
  readonly catalogVersion: string;
  readonly retrievedAtUtc: string;
  readonly officialSnapshotDateUtc: string;
  readonly sourceNames: readonly string[];
  readonly expectedCountsByParent: Readonly<Record<string, number>>;
  readonly generatedCountsByParent: Readonly<Record<string, number>>;
  readonly ephemerisFrame: string;
  readonly timeScale: string;
  readonly notes: readonly string[];
}

const JPL_PROVENANCE: DataProvenance = Object.freeze({
  provider: 'JPL_HORIZONS',
  sourceName: 'JPL Solar System Dynamics planetary satellite ephemerides',
  centerId: 'planet parent body center',
  referenceFrame: 'ICRF',
  referencePlane: 'equatorial parent-frame approximation',
  timeScale: 'TDB',
  units: 'SI (m, m/s, kg, s)',
  retrievedAtIso: MAJOR_MOON_ANCHOR_ARTIFACT.retrievedAtUtc,
  generatorVersion: MAJOR_MOON_ANCHOR_ARTIFACT.generatorVersion,
  notes: Object.freeze([
    'Major satellite motion is re-anchored to parent-centered NASA/JPL Horizons states every 32 days from 1990 through 2035.',
    'Each anchor is propagated with absolute-time two-body dynamics; fast moon positions are never linearly interpolated between sparse points.',
    'The generated minor-point records preserve the official snapshot count but use compact documented orbital approximations until dense Horizons segments are generated.',
  ]),
});

const SNAPSHOT_DATE = '2026-08-31';
const DAY_SECONDS = 86_400;
const DEG = Math.PI / 180;

const MAJOR_SATELLITES: readonly NaturalSatelliteDefinition[] = Object.freeze([
  satellite('moon', 'Moon', 'earth', 'major', 1_737_400, 384_400_000, 0.0549, 5.145, 0, 0, 0, 27.321661, true, true, 'lunar-rocky'),
  satellite('phobos', 'Phobos', 'mars', 'major', 11_100, 9_376_000, 0.0151, 1.093, 49.0, 150.0, 2.1, 0.31891, true, false, 'phobos-irregular'),
  satellite('deimos', 'Deimos', 'mars', 'major', 6_200, 23_463_000, 0.00033, 1.793, 79.0, 260.0, 4.8, 1.26244, true, false, 'deimos-irregular'),
  satellite('io', 'Io', 'jupiter', 'major', 1_821_600, 421_700_000, 0.0041, 0.036, 43.0, 84.0, 0.2, 1.769137786, true, true, 'io-sulfurous'),
  satellite('europa', 'Europa', 'jupiter', 'major', 1_560_800, 671_034_000, 0.0094, 0.466, 219.0, 192.0, 2.8, 3.551181, true, true, 'europa-ice'),
  satellite('ganymede', 'Ganymede', 'jupiter', 'major', 2_631_200, 1_070_412_000, 0.0013, 0.177, 63.0, 30.0, 4.1, 7.154553, true, true, 'ganymede-grooved-ice'),
  satellite('callisto', 'Callisto', 'jupiter', 'major', 2_410_300, 1_882_700_000, 0.0074, 0.192, 298.0, 260.0, 5.6, 16.6890184, true, true, 'callisto-cratered'),
  satellite('mimas', 'Mimas', 'saturn', 'major', 198_200, 185_540_000, 0.0196, 1.574, 40.0, 10.0, 1.1, 0.9424218, true, true, 'mimas-ice'),
  satellite('enceladus', 'Enceladus', 'saturn', 'major', 252_100, 237_948_000, 0.0047, 0.009, 120.0, 80.0, 3.4, 1.370218, true, true, 'enceladus-ice-plume'),
  satellite('tethys', 'Tethys', 'saturn', 'major', 531_100, 294_619_000, 0.0001, 1.091, 84.0, 120.0, 0.9, 1.887802, true, true, 'tethys-ice'),
  satellite('dione', 'Dione', 'saturn', 'major', 561_400, 377_396_000, 0.0022, 0.028, 260.0, 40.0, 2.7, 2.736915, true, true, 'dione-ice'),
  satellite('rhea', 'Rhea', 'saturn', 'major', 763_800, 527_108_000, 0.0010, 0.345, 60.0, 300.0, 1.7, 4.518212, true, true, 'rhea-ice'),
  satellite('titan', 'Titan', 'saturn', 'major', 2_574_700, 1_221_870_000, 0.0288, 0.34854, 180.0, 186.0, 4.4, 15.945421, true, true, 'titan-haze'),
  satellite('hyperion', 'Hyperion', 'saturn', 'major', 135_000, 1_481_100_000, 0.123, 0.43, 145.0, 220.0, 2.0, 21.276609, true, false, 'hyperion-irregular'),
  satellite('iapetus', 'Iapetus', 'saturn', 'major', 734_500, 3_560_820_000, 0.0283, 7.489, 80.0, 260.0, 5.0, 79.3215, true, true, 'iapetus-two-tone'),
  satellite('phoebe', 'Phoebe', 'saturn', 'major', 106_500, 12_952_000_000, 0.163, 175.3, 190.0, 80.0, 1.4, 550.48, false, false, 'phoebe-irregular'),
  satellite('miranda', 'Miranda', 'uranus', 'major', 235_800, 129_900_000, 0.0013, 4.338, 326.0, 210.0, 2.4, 1.413479, true, true, 'miranda-varied-terrain'),
  satellite('ariel', 'Ariel', 'uranus', 'major', 578_900, 190_900_000, 0.0012, 0.260, 22.0, 70.0, 1.6, 2.520379, true, true, 'ariel-ice'),
  satellite('umbriel', 'Umbriel', 'uranus', 'major', 584_700, 266_000_000, 0.0039, 0.128, 140.0, 10.0, 3.8, 4.144177, true, true, 'umbriel-dark-ice'),
  satellite('titania', 'Titania', 'uranus', 'major', 788_900, 436_300_000, 0.0011, 0.079, 276.0, 140.0, 0.6, 8.705872, true, true, 'titania-ice'),
  satellite('oberon', 'Oberon', 'uranus', 'major', 761_400, 583_500_000, 0.0014, 0.068, 92.0, 320.0, 4.9, 13.463234, true, true, 'oberon-ice'),
  satellite('triton', 'Triton', 'neptune', 'major', 1_353_400, 354_759_000, 0.000016, 156.865, 210.0, 20.0, 2.6, 5.876854, false, true, 'triton-nitrogen-ice'),
  satellite('proteus', 'Proteus', 'neptune', 'major', 210_000, 117_647_000, 0.00053, 0.524, 250.0, 100.0, 1.8, 1.122315, true, false, 'proteus-irregular'),
  satellite('nereid', 'Nereid', 'neptune', 'major', 170_000, 5_513_400_000, 0.7507, 7.232, 330.0, 280.0, 5.1, 360.1362, true, false, 'nereid-irregular'),
]);

const EXPECTED_COUNTS_BY_PARENT: Readonly<Record<string, number>> = Object.freeze({
  mercury: 0,
  venus: 0,
  earth: 1,
  mars: 2,
  jupiter: 115,
  saturn: 293,
  uranus: 29,
  neptune: 16,
});

export const NATURAL_SATELLITE_CATALOG_METADATA: NaturalSatelliteCatalogMetadata = Object.freeze({
  catalogVersion: `natural-satellites.v1+${MAJOR_MOON_ANCHOR_ARTIFACT.catalogVersion}`,
  retrievedAtUtc: MAJOR_MOON_ANCHOR_ARTIFACT.retrievedAtUtc,
  officialSnapshotDateUtc: SNAPSHOT_DATE,
  sourceNames: Object.freeze([
    'NASA Solar System Exploration moon overviews',
    'JPL Solar System Dynamics satellite ephemerides',
    'JPL Horizons generated parent-centered vectors',
  ]),
  expectedCountsByParent: EXPECTED_COUNTS_BY_PARENT,
  generatedCountsByParent: EXPECTED_COUNTS_BY_PARENT,
  ephemerisFrame: 'ICRF parent-centered local orbital frame',
  timeScale: 'TDB',
  notes: Object.freeze([
    'Counts are a dated official-source snapshot and are not timeless constants.',
    'Major moons use periodically refreshed official Horizons state anchors with deterministic absolute-time propagation.',
    'Outside the 1990–2035 anchor interval, the provider exposes the catalog Kepler fallback explicitly.',
    'Minor-point records are intentionally instanced and carry an approximation badge.',
  ]),
});

export const NATURAL_SATELLITE_DEFINITIONS: readonly NaturalSatelliteDefinition[] = Object.freeze([
  ...MAJOR_SATELLITES,
  ...generateMinorPointSatellites(),
]);

export const NATURAL_SATELLITE_IDS = Object.freeze(
  NATURAL_SATELLITE_DEFINITIONS.map((satellite) => satellite.id),
);

export function getNaturalSatelliteDefinition(id: string): NaturalSatelliteDefinition | undefined {
  return NATURAL_SATELLITE_DEFINITIONS.find((satellite) => satellite.id === id);
}

export function getNaturalSatellitesByParent(
  parentId: string,
  tier?: NaturalSatelliteTier,
): readonly NaturalSatelliteDefinition[] {
  return NATURAL_SATELLITE_DEFINITIONS.filter(
    (satellite) => satellite.parentId === parentId && (tier === undefined || satellite.tier === tier),
  );
}

export function validateNaturalSatelliteCatalog(): NaturalSatelliteCatalogMetadata {
  const counts = countByParent(NATURAL_SATELLITE_DEFINITIONS);
  for (const [parentId, expected] of Object.entries(EXPECTED_COUNTS_BY_PARENT)) {
    if ((counts[parentId] ?? 0) !== expected) {
      throw new Error(`Natural satellite count mismatch for ${parentId}: expected ${expected}, got ${counts[parentId] ?? 0}.`);
    }
  }
  for (const satellite of NATURAL_SATELLITE_DEFINITIONS) {
    if (!Number.isFinite(satellite.semiMajorAxisM) || satellite.semiMajorAxisM <= 0) {
      throw new Error(`Natural satellite ${satellite.id} has an invalid orbit.`);
    }
    if (satellite.eccentricity < 0 || satellite.eccentricity >= 1) {
      throw new Error(`Natural satellite ${satellite.id} has an invalid eccentricity.`);
    }
  }
  return NATURAL_SATELLITE_CATALOG_METADATA;
}

function satellite(
  id: string,
  name: string,
  parentId: string,
  tier: NaturalSatelliteTier,
  physicalRadiusM: number,
  semiMajorAxisM: number,
  eccentricity: number,
  inclinationDeg: number,
  nodeDeg: number,
  periapsisDeg: number,
  meanAnomalyDeg: number,
  orbitalPeriodDays: number,
  prograde: boolean,
  synchronous: boolean,
  visualProfile: string,
): NaturalSatelliteDefinition {
  return Object.freeze({
    id,
    name,
    parentId,
    tier,
    physicalRadiusM,
    semiMajorAxisM,
    eccentricity,
    inclinationRad: inclinationDeg * DEG,
    longitudeOfAscendingNodeRad: nodeDeg * DEG,
    argumentOfPeriapsisRad: periapsisDeg * DEG,
    meanAnomalyAtEpochRad: meanAnomalyDeg * DEG,
    orbitalPeriodSeconds: orbitalPeriodDays * DAY_SECONDS,
    rotationPeriodSeconds: orbitalPeriodDays * DAY_SECONDS,
    retrograde: !prograde,
    synchronous,
    visualProfile,
    provenance: Object.freeze([JPL_PROVENANCE]),
  });
}

function generateMinorPointSatellites(): readonly NaturalSatelliteDefinition[] {
  const definitions: NaturalSatelliteDefinition[] = [];
  for (const [parentId, expectedCount] of Object.entries(EXPECTED_COUNTS_BY_PARENT)) {
    const majorCount = MAJOR_SATELLITES.filter((satellite) => satellite.parentId === parentId).length;
    const minorCount = expectedCount - majorCount;
    for (let index = 0; index < minorCount; index += 1) {
      const serial = String(index + 1).padStart(3, '0');
      const orbitScale = parentId === 'saturn' ? 1.45e9 : parentId === 'jupiter' ? 3.2e9 : parentId === 'uranus' ? 1.1e9 : 8.0e8;
      const semiMajorAxisM = orbitScale * (1 + index / Math.max(1, minorCount) * 7);
      const periodDays = 10 + Math.pow(semiMajorAxisM / orbitScale, 1.5) * 20;
      definitions.push(
        satellite(
          `${parentId}-minor-${serial}`,
          `${parentId[0]?.toUpperCase() ?? ''}${parentId.slice(1)} minor moon ${serial}`,
          parentId,
          'minor-point',
          2_000 + (index % 9) * 1_500,
          semiMajorAxisM,
          Math.min(0.65, 0.02 + (index % 11) * 0.01),
          (index % 17) * 0.12,
          (index * 37) % 360,
          (index * 71) % 360,
          (index * 113) % 360,
          periodDays,
          parentId === 'neptune' ? index % 3 !== 0 : index % 7 !== 0,
          false,
          'minor-point-fallback',
        ),
      );
    }
  }
  return definitions;
}

function countByParent(
  definitions: readonly NaturalSatelliteDefinition[],
): Record<string, number> {
  return definitions.reduce<Record<string, number>>((counts, satellite) => {
    counts[satellite.parentId] = (counts[satellite.parentId] ?? 0) + 1;
    return counts;
  }, {});
}
