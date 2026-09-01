import type { DataProvenance } from '../bodies/DataProvenance';
import trajectoryArtifactJson from '../../data/generated/spacecraft-trajectories.horizons.v1.json';

export type SpacecraftStatus = 'active' | 'historical' | 'extended';
export type SpacecraftTrajectoryKind = 'open-cruise' | 'planetary-orbit' | 'lagrange-orbit';

export interface SpacecraftDefinition {
  readonly id: string;
  readonly name: string;
  readonly missionId: string;
  readonly operator: string;
  readonly status: SpacecraftStatus;
  readonly launchDateUtc: string;
  readonly validStartJdTdb: number;
  readonly validEndJdTdb: number;
  readonly primaryTargets: readonly string[];
  readonly trajectoryKind: SpacecraftTrajectoryKind;
  readonly horizonsTargetId: string;
  readonly trajectorySource: 'JPL_HORIZONS';
  readonly provenance: readonly DataProvenance[];
}

export interface SpacecraftCatalogMetadata {
  readonly catalogVersion: string;
  readonly retrievedAtUtc: string;
  readonly missionCount: number;
  readonly sourceNames: readonly string[];
  readonly notes: readonly string[];
}

export interface SpacecraftTrajectoryRecord {
  readonly id: string;
  readonly horizonsTargetId: string;
  readonly targetName: string;
  readonly startJdTdb: number;
  readonly endJdTdb: number;
  readonly stepSeconds: number;
  readonly sampleCount: number;
  readonly valuesSi: readonly number[];
}

export interface SpacecraftTrajectoryArtifact {
  readonly schemaVersion: number;
  readonly catalogVersion: string;
  readonly retrievedAtUtc: string;
  readonly generatorVersion: string;
  readonly sourceUrl: string;
  readonly sourceName: string;
  readonly center: string;
  readonly referenceFrame: string;
  readonly referencePlane: string;
  readonly timeScale: string;
  readonly units: string;
  readonly interpolation: string;
  readonly fallback: boolean;
  readonly missionCount: number;
  readonly checksum: string;
  readonly missions: readonly SpacecraftTrajectoryRecord[];
}

export const SPACECRAFT_TRAJECTORY_ARTIFACT = trajectoryArtifactJson as SpacecraftTrajectoryArtifact;
const TRAJECTORY_BY_ID = new Map(SPACECRAFT_TRAJECTORY_ARTIFACT.missions.map((record) => [record.id, record]));

const HORIZONS_PROVENANCE: DataProvenance = Object.freeze({
  provider: 'JPL_HORIZONS',
  sourceName: 'NASA/JPL Horizons vector ephemeris',
  referenceFrame: 'ICRF heliocentric inertial',
  referencePlane: 'Ecliptic of J2000',
  timeScale: 'TDB',
  units: 'SI (m, m/s, kg, s)',
  retrievedAtIso: SPACECRAFT_TRAJECTORY_ARTIFACT.retrievedAtUtc,
  generatorVersion: SPACECRAFT_TRAJECTORY_ARTIFACT.generatorVersion,
  notes: Object.freeze([
    'Geometric state vectors are sampled from NASA/JPL Horizons relative to the Sun (500@10).',
    'Runtime states use piecewise cubic Hermite interpolation of Horizons position and velocity knots.',
    'No spacecraft is silently extrapolated outside the returned Horizons interval.',
  ]),
});

export const SPACECRAFT_CATALOG_METADATA: SpacecraftCatalogMetadata = Object.freeze({
  catalogVersion: SPACECRAFT_TRAJECTORY_ARTIFACT.catalogVersion,
  retrievedAtUtc: SPACECRAFT_TRAJECTORY_ARTIFACT.retrievedAtUtc,
  missionCount: SPACECRAFT_TRAJECTORY_ARTIFACT.missionCount,
  sourceNames: Object.freeze(['NASA/JPL Horizons vector ephemeris']),
  notes: Object.freeze([
    'Historical spacecraft appear only within their declared trajectory coverage.',
    'James Webb and interplanetary probes never use the Earth-orbit OMM provider.',
    'Every bundled path is generated from Horizons states; there are no authored fallback curves.',
  ]),
});

export const SPACECRAFT_DEFINITIONS: readonly SpacecraftDefinition[] = Object.freeze([
  spacecraft('voyager-1', 'Voyager 1', 'Voyager 1', 'NASA / JPL', 'active', '1977-09-05', ['jupiter', 'saturn'], 'open-cruise'),
  spacecraft('voyager-2', 'Voyager 2', 'Voyager 2', 'NASA / JPL', 'active', '1977-08-20', ['jupiter', 'saturn', 'uranus', 'neptune'], 'open-cruise'),
  spacecraft('new-horizons', 'New Horizons', 'New Horizons', 'NASA / APL', 'active', '2006-01-19', ['jupiter', 'pluto'], 'open-cruise'),
  spacecraft('parker-solar-probe', 'Parker Solar Probe', 'Parker Solar Probe', 'NASA / APL', 'active', '2018-08-12', ['sun', 'venus'], 'planetary-orbit'),
  spacecraft('solar-orbiter', 'Solar Orbiter', 'Solar Orbiter', 'ESA / NASA', 'active', '2020-02-10', ['sun', 'venus'], 'planetary-orbit'),
  spacecraft('juno', 'Juno', 'Juno', 'NASA / JPL', 'historical', '2011-08-05', ['jupiter'], 'planetary-orbit'),
  spacecraft('lucy', 'Lucy', 'Lucy', 'NASA / SwRI', 'active', '2021-10-16', ['jupiter'], 'open-cruise'),
  spacecraft('psyche', 'Psyche', 'Psyche', 'NASA / JPL', 'active', '2023-10-13', ['mars', 'psyche'], 'open-cruise'),
  spacecraft('europa-clipper', 'Europa Clipper', 'Europa Clipper', 'NASA / JPL', 'active', '2024-10-14', ['mars', 'jupiter'], 'open-cruise'),
  spacecraft('juice', 'JUICE', 'JUICE', 'ESA', 'active', '2023-04-14', ['jupiter', 'ganymede'], 'open-cruise'),
  spacecraft('bepicolombo', 'BepiColombo', 'BepiColombo', 'ESA / JAXA', 'active', '2018-10-20', ['mercury', 'venus'], 'open-cruise'),
  spacecraft('osiris-apex', 'OSIRIS-APEX', 'OSIRIS-APEX', 'NASA / UArizona', 'active', '2016-09-08', ['earth', 'bennu'], 'open-cruise'),
  spacecraft('jwst', 'James Webb Space Telescope', 'JWST', 'NASA / ESA / CSA', 'active', '2021-12-25', ['sun-earth-l2'], 'lagrange-orbit'),
  spacecraft('cassini', 'Cassini-Huygens', 'Cassini', 'NASA / ESA / ASI', 'historical', '1997-10-15', ['jupiter', 'saturn'], 'planetary-orbit'),
]);

export function getSpacecraftDefinition(id: string): SpacecraftDefinition | undefined {
  return SPACECRAFT_DEFINITIONS.find((mission) => mission.id === id);
}

export function spacecraftIsValidAt(mission: Readonly<SpacecraftDefinition>, jdTdb: number): boolean {
  return Number.isFinite(jdTdb) && jdTdb >= mission.validStartJdTdb && jdTdb <= mission.validEndJdTdb;
}

/**
 * Returns the closest safe instant inside a mission's bundled trajectory.
 * Catalog navigation uses this instead of framing an empty marker when the
 * observatory date is outside a historical mission's coverage.
 */
export function nearestSpacecraftCoverageJdTdb(
  mission: Readonly<SpacecraftDefinition>,
  requestedJdTdb: number,
): number {
  if (!Number.isFinite(requestedJdTdb)) {
    throw new RangeError('Requested spacecraft focus date must be finite.');
  }
  if (spacecraftIsValidAt(mission, requestedJdTdb)) return requestedJdTdb;
  const spanDays = mission.validEndJdTdb - mission.validStartJdTdb;
  const insetDays = Math.min(1, Math.max(spanDays * 0.001, 1 / 86_400));
  return requestedJdTdb < mission.validStartJdTdb
    ? mission.validStartJdTdb + insetDays
    : mission.validEndJdTdb - insetDays;
}

export function getSpacecraftTrajectoryRecord(id: string): SpacecraftTrajectoryRecord | undefined {
  return TRAJECTORY_BY_ID.get(id);
}

function spacecraft(
  id: string,
  name: string,
  missionId: string,
  operator: string,
  status: SpacecraftStatus,
  launchDateUtc: string,
  primaryTargets: readonly string[],
  trajectoryKind: SpacecraftTrajectoryKind,
): SpacecraftDefinition {
  const trajectory = TRAJECTORY_BY_ID.get(id);
  if (trajectory === undefined) throw new RangeError(`No generated Horizons trajectory is bundled for "${id}".`);
  return Object.freeze({
    id,
    name,
    missionId,
    operator,
    status,
    launchDateUtc,
    validStartJdTdb: trajectory.startJdTdb,
    validEndJdTdb: trajectory.endJdTdb,
    primaryTargets: Object.freeze([...primaryTargets]),
    trajectoryKind,
    horizonsTargetId: trajectory.horizonsTargetId,
    trajectorySource: 'JPL_HORIZONS',
    provenance: Object.freeze([HORIZONS_PROVENANCE]),
  });
}
