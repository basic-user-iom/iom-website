import {
  SatRecError,
  json2satrec,
  propagate,
  type OMMJsonObject,
  type SatRec,
} from 'satellite.js';

import type { BodyRuntimeState } from '../bodies/BodyRuntimeState';
import { approximateTdbToDateUtc } from '../core/JulianDate';
import type { Vec3d } from '../core/Vec3d';
import { createVec3d } from '../core/Vec3d';
import type { EarthSatelliteDefinition } from './EarthSatelliteCatalog';

const EARTH_MU = 3.986004418e14;
const EARTH_EQUATORIAL_RADIUS_M = 6_378_137;
const METERS_PER_KILOMETER = 1_000;
const SATREC_CACHE = new WeakMap<EarthSatelliteDefinition, SatRec>();

export type EarthSatelliteDataAgeState = 'fresh' | 'aged' | 'outside-hard-window';
export type EarthSatellitePropagationStatus = 'ok' | 'outside-hard-window' | 'decayed' | 'failed';

export interface EarthSatelliteState {
  readonly satelliteId: string;
  readonly catalogId: string;
  readonly jdTdb: number;
  readonly sourceFrame: 'TEME';
  readonly destinationFrame: 'earth-centered-inertial';
  readonly propagator: 'SGP4/SDP4';
  readonly positionTemeM: Vec3d;
  readonly velocityTemeMps: Vec3d;
  readonly positionEarthCenteredM: Vec3d;
  readonly velocityEarthCenteredMps: Vec3d;
  readonly dataAgeDays: number;
  readonly dataAgeState: EarthSatelliteDataAgeState;
  readonly propagationStatus: EarthSatellitePropagationStatus;
  readonly propagationError: string | null;
}

export interface HeliocentricEarthSatelliteState extends EarthSatelliteState {
  readonly heliocentricPositionM: Vec3d;
  readonly heliocentricVelocityMps: Vec3d;
}

/** Propagates the source OMM directly through satellite.js SGP4/SDP4. */
export function sampleEarthSatellite(
  satellite: Readonly<EarthSatelliteDefinition>,
  jdTdb: number,
): EarthSatelliteState {
  if (!Number.isFinite(jdTdb)) throw new RangeError('Earth-satellite epoch must be finite.');
  const ageDays = Math.abs(jdTdb - satellite.elementEpochJdTdb);
  const ageState: EarthSatelliteDataAgeState = ageDays > satellite.hardMaximumWindowDays
    ? 'outside-hard-window'
    : ageDays > satellite.preferredWindowDays
      ? 'aged'
      : 'fresh';
  if (ageState === 'outside-hard-window') {
    return emptyState(satellite, jdTdb, ageDays, ageState, 'outside-hard-window', null);
  }

  const satrec = satelliteRecordFor(satellite);
  const propagated = propagate(satrec, approximateTdbToDateUtc(jdTdb));
  if (propagated === null) {
    const status: EarthSatellitePropagationStatus = satrec.error === SatRecError.Decayed ? 'decayed' : 'failed';
    return emptyState(
      satellite,
      jdTdb,
      ageDays,
      ageState,
      status,
      SatRecError[satrec.error] ?? `SGP4 error ${satrec.error}`,
    );
  }

  const positionTemeM = createVec3d(
    propagated.position.x * METERS_PER_KILOMETER,
    propagated.position.y * METERS_PER_KILOMETER,
    propagated.position.z * METERS_PER_KILOMETER,
  );
  const velocityTemeMps = createVec3d(
    propagated.velocity.x * METERS_PER_KILOMETER,
    propagated.velocity.y * METERS_PER_KILOMETER,
    propagated.velocity.z * METERS_PER_KILOMETER,
  );
  const earthCentered = transformTemeToEarthCenteredInertial(positionTemeM, velocityTemeMps);
  return Object.freeze({
    satelliteId: satellite.id,
    catalogId: satellite.catalogId,
    jdTdb,
    sourceFrame: 'TEME',
    destinationFrame: 'earth-centered-inertial',
    propagator: 'SGP4/SDP4',
    positionTemeM,
    velocityTemeMps,
    positionEarthCenteredM: earthCentered.positionM,
    velocityEarthCenteredMps: earthCentered.velocityMps,
    dataAgeDays: ageDays,
    dataAgeState: ageState,
    propagationStatus: 'ok',
    propagationError: null,
  });
}

export function composeHeliocentricEarthSatelliteState(
  satellite: Readonly<EarthSatelliteDefinition>,
  earthState: Readonly<BodyRuntimeState>,
  jdTdb: number,
): HeliocentricEarthSatelliteState {
  const local = sampleEarthSatellite(satellite, jdTdb);
  return Object.freeze({
    ...local,
    heliocentricPositionM: createVec3d(
      earthState.positionM.x + local.positionEarthCenteredM.x,
      earthState.positionM.y + local.positionEarthCenteredM.y,
      earthState.positionM.z + local.positionEarthCenteredM.z,
    ),
    heliocentricVelocityMps: createVec3d(
      earthState.velocityMps.x + local.velocityEarthCenteredMps.x,
      earthState.velocityMps.y + local.velocityEarthCenteredMps.y,
      earthState.velocityMps.z + local.velocityEarthCenteredMps.z,
    ),
  });
}

export function earthSatelliteOrbitDistanceM(state: Readonly<EarthSatelliteState>): number {
  return Math.hypot(state.positionEarthCenteredM.x, state.positionEarthCenteredM.y, state.positionEarthCenteredM.z);
}

/** Samples one local orbital arc for a selected satellite without accumulating frame state. */
export function sampleEarthSatelliteOrbitPath(
  satellite: Readonly<EarthSatelliteDefinition>,
  centerJdTdb: number,
  samples = 96,
  spanPeriods = 1,
): Float64Array {
  if (!Number.isInteger(samples) || samples < 8) {
    throw new RangeError('Earth-satellite orbit samples must be an integer >= 8.');
  }
  if (!Number.isFinite(centerJdTdb)) throw new RangeError('Earth-satellite orbit epoch must be finite.');
  if (!Number.isFinite(spanPeriods) || spanPeriods <= 0) {
    throw new RangeError('Earth-satellite orbit span must be positive.');
  }
  const output = new Float64Array(samples * 3);
  const periodDays = 1 / satellite.meanMotionRevolutionsPerDay;
  const startJd = centerJdTdb - periodDays * spanPeriods * 0.5;
  const spanDays = periodDays * spanPeriods;
  for (let index = 0; index < samples; index += 1) {
    const jd = startJd + spanDays * index / (samples - 1);
    const state = sampleEarthSatellite(satellite, jd);
    output[index * 3] = state.positionEarthCenteredM.x;
    output[index * 3 + 1] = state.positionEarthCenteredM.y;
    output[index * 3 + 2] = state.positionEarthCenteredM.z;
  }
  return output;
}

export const EARTH_SATELLITE_PHYSICAL_CONSTANTS = Object.freeze({
  earthMuM3PerS2: EARTH_MU,
  earthEquatorialRadiusM: EARTH_EQUATORIAL_RADIUS_M,
  sourceFrame: 'TEME',
  destinationFrame: 'earth-centered-inertial',
  propagator: 'satellite.js SGP4/SDP4 6.0.2',
});

function satelliteRecordFor(satellite: Readonly<EarthSatelliteDefinition>): SatRec {
  const cached = SATREC_CACHE.get(satellite);
  if (cached !== undefined) return cached;
  const record: OMMJsonObject = {
    OBJECT_NAME: satellite.name,
    OBJECT_ID: satellite.objectId ?? '',
    CENTER_NAME: 'EARTH',
    REF_FRAME: 'TEME',
    TIME_SYSTEM: 'UTC',
    MEAN_ELEMENT_THEORY: 'SGP4',
    EPOCH: satellite.elementEpochUtc,
    MEAN_MOTION: satellite.meanMotionRevolutionsPerDay,
    ECCENTRICITY: satellite.eccentricity,
    INCLINATION: satellite.inclinationRad * 180 / Math.PI,
    RA_OF_ASC_NODE: satellite.longitudeOfAscendingNodeRad * 180 / Math.PI,
    ARG_OF_PERICENTER: satellite.argumentOfPericenterRad * 180 / Math.PI,
    MEAN_ANOMALY: satellite.meanAnomalyRad * 180 / Math.PI,
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: satellite.classificationType,
    NORAD_CAT_ID: satellite.catalogId,
    ELEMENT_SET_NO: satellite.elementSetNumber,
    REV_AT_EPOCH: satellite.revolutionAtEpoch,
    BSTAR: satellite.bstar,
    MEAN_MOTION_DOT: satellite.meanMotionDotRevolutionsPerDaySquared,
    MEAN_MOTION_DDOT: satellite.meanMotionDdotRevolutionsPerDayCubed,
  };
  const satrec = json2satrec(record);
  SATREC_CACHE.set(satellite, satrec);
  return satrec;
}

function emptyState(
  satellite: Readonly<EarthSatelliteDefinition>,
  jdTdb: number,
  ageDays: number,
  ageState: EarthSatelliteDataAgeState,
  propagationStatus: EarthSatellitePropagationStatus,
  propagationError: string | null,
): EarthSatelliteState {
  return Object.freeze({
    satelliteId: satellite.id,
    catalogId: satellite.catalogId,
    jdTdb,
    sourceFrame: 'TEME',
    destinationFrame: 'earth-centered-inertial',
    propagator: 'SGP4/SDP4',
    positionTemeM: createVec3d(),
    velocityTemeMps: createVec3d(),
    positionEarthCenteredM: createVec3d(),
    velocityEarthCenteredMps: createVec3d(),
    dataAgeDays: ageDays,
    dataAgeState: ageState,
    propagationStatus,
    propagationError,
  });
}

function transformTemeToEarthCenteredInertial(
  positionTemeM: Readonly<Vec3d>,
  velocityTemeMps: Readonly<Vec3d>,
): { readonly positionM: Vec3d; readonly velocityMps: Vec3d } {
  // TEME is already an Earth-centered inertial-like frame. The observatory's
  // compact model preserves its axes here and declares the missing high-order
  // precession/nutation/polar-motion transform instead of applying a false
  // Greenwich sidereal rotation (which would produce an Earth-fixed frame).
  return {
    positionM: createVec3d(positionTemeM.x, positionTemeM.y, positionTemeM.z),
    velocityMps: createVec3d(velocityTemeMps.x, velocityTemeMps.y, velocityTemeMps.z),
  };
}
