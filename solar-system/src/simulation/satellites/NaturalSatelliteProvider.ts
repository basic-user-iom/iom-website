import type { Vec3d } from '../core/Vec3d';
import { createVec3d } from '../core/Vec3d';
import type { BodyRuntimeState } from '../bodies/BodyRuntimeState';
import type { MajorMoonAnchorRecord, NaturalSatelliteDefinition } from './NaturalSatelliteCatalog';
import { MAJOR_MOON_ANCHOR_ARTIFACT } from './NaturalSatelliteCatalog';

const GRAVITATIONAL_CONSTANT = 6.67430e-11;
const EPOCH_JD_TDB = 2_451_545.0;
const PARENT_MASSES_KG: Readonly<Record<string, number>> = Object.freeze({
  earth: 5.97217e24,
  mars: 6.41691e23,
  jupiter: 1.898125e27,
  saturn: 5.68317e26,
  uranus: 8.68099e25,
  neptune: 1.024092e26,
});
const ANCHOR_BY_ID = new Map(MAJOR_MOON_ANCHOR_ARTIFACT.moons.map((record) => [record.id, record]));
const ELEMENT_CACHE = new Map<string, OsculatingElements>();

interface OsculatingElements {
  readonly semiMajorAxisM: number;
  readonly eccentricity: number;
  readonly inclinationRad: number;
  readonly longitudeOfAscendingNodeRad: number;
  readonly argumentOfPeriapsisRad: number;
  readonly meanAnomalyAtEpochRad: number;
}

export interface NaturalSatelliteState {
  readonly satelliteId: string;
  readonly parentId: string;
  readonly jdTdb: number;
  /** Parent-centered state in the documented parent orbital frame, metres. */
  readonly positionM: Vec3d;
  readonly velocityMps: Vec3d;
  readonly retrograde: boolean;
  readonly source: 'JPL_HORIZONS_ANCHORED' | 'CATALOG_KEPLER_FALLBACK';
  readonly insideAnchorCoverage: boolean;
}

export interface ComposedNaturalSatelliteState extends NaturalSatelliteState {
  readonly heliocentricPositionM: Vec3d;
  readonly heliocentricVelocityMps: Vec3d;
}

/**
 * Absolute-time Kepler fallback used for compact/named satellite records.
 * Major satellite records can be replaced by dense Horizons segments without
 * changing callers or the rendering boundary.
 */
export function sampleNaturalSatellite(
  satellite: Readonly<NaturalSatelliteDefinition>,
  jdTdb: number,
): NaturalSatelliteState {
  assertFinite(jdTdb, 'Satellite epoch');
  const anchorRecord = satellite.tier === 'major' ? ANCHOR_BY_ID.get(satellite.id) : undefined;
  if (anchorRecord !== undefined && jdTdb >= anchorRecord.startJdTdb && jdTdb <= anchorRecord.endJdTdb) {
    return sampleAnchoredNaturalSatellite(satellite, anchorRecord, jdTdb);
  }
  return sampleCatalogFallback(satellite, jdTdb);
}

function sampleCatalogFallback(
  satellite: Readonly<NaturalSatelliteDefinition>,
  jdTdb: number,
): NaturalSatelliteState {
  const mu = gravitationalParameterFor(satellite.parentId);
  const semiMajorAxis = satellite.semiMajorAxisM;
  const meanMotion = Math.sqrt(mu / (semiMajorAxis ** 3));
  const direction = satellite.retrograde ? -1 : 1;
  const elapsedSeconds = (jdTdb - EPOCH_JD_TDB) * 86_400;
  const meanAnomaly = normalizeAngle(
    satellite.meanAnomalyAtEpochRad + direction * meanMotion * elapsedSeconds,
  );
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, satellite.eccentricity);
  const cosE = Math.cos(eccentricAnomaly);
  const sinE = Math.sin(eccentricAnomaly);
  const eccentricity = satellite.eccentricity;
  const root = Math.sqrt(1 - eccentricity * eccentricity);
  const radius = semiMajorAxis * (1 - eccentricity * cosE);
  const cosTrue = (cosE - eccentricity) / Math.max(radius / semiMajorAxis, 1e-12);
  const sinTrue = (root * sinE) / Math.max(radius / semiMajorAxis, 1e-12);
  const cosNode = Math.cos(satellite.longitudeOfAscendingNodeRad);
  const sinNode = Math.sin(satellite.longitudeOfAscendingNodeRad);
  const cosInclination = Math.cos(satellite.inclinationRad);
  const sinInclination = Math.sin(satellite.inclinationRad);
  const cosPeriapsis = Math.cos(satellite.argumentOfPeriapsisRad);
  const sinPeriapsis = Math.sin(satellite.argumentOfPeriapsisRad);
  const perifocalX = radius * cosTrue;
  const perifocalY = radius * sinTrue;
  const orbitalX = cosPeriapsis * perifocalX - sinPeriapsis * perifocalY;
  const orbitalY = sinPeriapsis * perifocalX + cosPeriapsis * perifocalY;
  const positionM = createVec3d(
    (cosNode * orbitalX - sinNode * cosInclination * orbitalY),
    (sinNode * orbitalX + cosNode * cosInclination * orbitalY),
    sinInclination * orbitalY,
  );

  const velocityScale = Math.sqrt(mu * semiMajorAxis) / Math.max(radius, 1);
  const perifocalVelocityX = -velocityScale * sinE;
  const perifocalVelocityY = velocityScale * root * cosE;
  const velocityOrbitalX = cosPeriapsis * perifocalVelocityX - sinPeriapsis * perifocalVelocityY;
  const velocityOrbitalY = sinPeriapsis * perifocalVelocityX + cosPeriapsis * perifocalVelocityY;
  const velocityMps = createVec3d(
    direction * (cosNode * velocityOrbitalX - sinNode * cosInclination * velocityOrbitalY),
    direction * (sinNode * velocityOrbitalX + cosNode * cosInclination * velocityOrbitalY),
    direction * sinInclination * velocityOrbitalY,
  );

  return Object.freeze({
    satelliteId: satellite.id,
    parentId: satellite.parentId,
    jdTdb,
    positionM,
    velocityMps,
    retrograde: satellite.retrograde,
    source: 'CATALOG_KEPLER_FALLBACK',
    insideAnchorCoverage: false,
  });
}

function sampleAnchoredNaturalSatellite(
  satellite: Readonly<NaturalSatelliteDefinition>,
  record: Readonly<MajorMoonAnchorRecord>,
  jdTdb: number,
): NaturalSatelliteState {
  const sampleOffset = (jdTdb - record.startJdTdb) * 86_400 / record.stepSeconds;
  const anchorIndex = Math.min(Math.max(Math.floor(sampleOffset), 0), record.sampleCount - 1);
  const anchorJdTdb = record.startJdTdb + anchorIndex * record.stepSeconds / 86_400;
  const cacheKey = `${satellite.id}:${anchorIndex}`;
  let elements = ELEMENT_CACHE.get(cacheKey);
  if (elements === undefined) {
    const offset = anchorIndex * 6;
    elements = deriveOsculatingElements(
      [required(record.valuesSi[offset]), required(record.valuesSi[offset + 1]), required(record.valuesSi[offset + 2])],
      [required(record.valuesSi[offset + 3]), required(record.valuesSi[offset + 4]), required(record.valuesSi[offset + 5])],
      gravitationalParameterFor(satellite.parentId),
    );
    ELEMENT_CACHE.set(cacheKey, elements);
  }
  const { positionM, velocityMps } = propagateOsculatingElements(
    elements,
    gravitationalParameterFor(satellite.parentId),
    (jdTdb - anchorJdTdb) * 86_400,
  );
  return Object.freeze({
    satelliteId: satellite.id,
    parentId: satellite.parentId,
    jdTdb,
    positionM,
    velocityMps,
    retrograde: satellite.retrograde,
    source: 'JPL_HORIZONS_ANCHORED',
    insideAnchorCoverage: true,
  });
}

function deriveOsculatingElements(
  position: readonly [number, number, number],
  velocity: readonly [number, number, number],
  mu: number,
): OsculatingElements {
  const radius = magnitude(position);
  const speedSquared = dot(velocity, velocity);
  const angularMomentum = cross(position, velocity);
  const angularMomentumMagnitude = magnitude(angularMomentum);
  if (!(radius > 0) || !(angularMomentumMagnitude > 0)) throw new RangeError('Horizons moon anchor is degenerate.');
  const node: readonly [number, number, number] = [-angularMomentum[1], angularMomentum[0], 0];
  const nodeMagnitude = magnitude(node);
  const eccentricityVectorRaw = cross(velocity, angularMomentum);
  const eccentricityVector: readonly [number, number, number] = [
    eccentricityVectorRaw[0] / mu - position[0] / radius,
    eccentricityVectorRaw[1] / mu - position[1] / radius,
    eccentricityVectorRaw[2] / mu - position[2] / radius,
  ];
  const eccentricity = Math.min(magnitude(eccentricityVector), 0.999999999);
  const semiMajorAxisM = 1 / (2 / radius - speedSquared / mu);
  if (!(semiMajorAxisM > 0)) throw new RangeError('Horizons moon anchor is not an elliptical state.');
  const inclinationRad = Math.acos(clampUnit(angularMomentum[2] / angularMomentumMagnitude));
  const longitudeOfAscendingNodeRad = nodeMagnitude > 1e-8
    ? normalizePositiveAngle(Math.atan2(node[1], node[0]))
    : 0;
  let argumentOfPeriapsisRad = 0;
  let trueAnomaly: number;
  if (eccentricity > 1e-9) {
    if (nodeMagnitude > 1e-8) {
      argumentOfPeriapsisRad = Math.acos(clampUnit(dot(node, eccentricityVector) / (nodeMagnitude * eccentricity)));
      if (eccentricityVector[2] < 0) argumentOfPeriapsisRad = Math.PI * 2 - argumentOfPeriapsisRad;
    } else {
      argumentOfPeriapsisRad = normalizePositiveAngle(Math.atan2(eccentricityVector[1], eccentricityVector[0]));
    }
    trueAnomaly = Math.acos(clampUnit(dot(eccentricityVector, position) / (eccentricity * radius)));
    if (dot(position, velocity) < 0) trueAnomaly = Math.PI * 2 - trueAnomaly;
  } else if (nodeMagnitude > 1e-8) {
    trueAnomaly = Math.acos(clampUnit(dot(node, position) / (nodeMagnitude * radius)));
    if (position[2] < 0) trueAnomaly = Math.PI * 2 - trueAnomaly;
  } else {
    trueAnomaly = normalizePositiveAngle(Math.atan2(position[1], position[0]));
  }
  const eccentricAnomaly = 2 * Math.atan2(
    Math.sqrt(1 - eccentricity) * Math.sin(trueAnomaly / 2),
    Math.sqrt(1 + eccentricity) * Math.cos(trueAnomaly / 2),
  );
  return Object.freeze({
    semiMajorAxisM,
    eccentricity,
    inclinationRad,
    longitudeOfAscendingNodeRad,
    argumentOfPeriapsisRad,
    meanAnomalyAtEpochRad: normalizePositiveAngle(eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly)),
  });
}

function propagateOsculatingElements(
  elements: Readonly<OsculatingElements>,
  mu: number,
  elapsedSeconds: number,
): Readonly<{ positionM: Vec3d; velocityMps: Vec3d }> {
  const meanMotion = Math.sqrt(mu / elements.semiMajorAxisM ** 3);
  const meanAnomaly = normalizeAngle(elements.meanAnomalyAtEpochRad + meanMotion * elapsedSeconds);
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, elements.eccentricity);
  const cosE = Math.cos(eccentricAnomaly);
  const sinE = Math.sin(eccentricAnomaly);
  const root = Math.sqrt(1 - elements.eccentricity ** 2);
  const radius = elements.semiMajorAxisM * (1 - elements.eccentricity * cosE);
  const perifocalX = elements.semiMajorAxisM * (cosE - elements.eccentricity);
  const perifocalY = elements.semiMajorAxisM * root * sinE;
  const velocityScale = Math.sqrt(mu * elements.semiMajorAxisM) / radius;
  const perifocalVelocityX = -velocityScale * sinE;
  const perifocalVelocityY = velocityScale * root * cosE;
  const cosNode = Math.cos(elements.longitudeOfAscendingNodeRad);
  const sinNode = Math.sin(elements.longitudeOfAscendingNodeRad);
  const cosInclination = Math.cos(elements.inclinationRad);
  const sinInclination = Math.sin(elements.inclinationRad);
  const cosPeriapsis = Math.cos(elements.argumentOfPeriapsisRad);
  const sinPeriapsis = Math.sin(elements.argumentOfPeriapsisRad);
  const orbitalX = cosPeriapsis * perifocalX - sinPeriapsis * perifocalY;
  const orbitalY = sinPeriapsis * perifocalX + cosPeriapsis * perifocalY;
  const velocityOrbitalX = cosPeriapsis * perifocalVelocityX - sinPeriapsis * perifocalVelocityY;
  const velocityOrbitalY = sinPeriapsis * perifocalVelocityX + cosPeriapsis * perifocalVelocityY;
  return Object.freeze({
    positionM: createVec3d(
      cosNode * orbitalX - sinNode * cosInclination * orbitalY,
      sinNode * orbitalX + cosNode * cosInclination * orbitalY,
      sinInclination * orbitalY,
    ),
    velocityMps: createVec3d(
      cosNode * velocityOrbitalX - sinNode * cosInclination * velocityOrbitalY,
      sinNode * velocityOrbitalX + cosNode * cosInclination * velocityOrbitalY,
      sinInclination * velocityOrbitalY,
    ),
  });
}

export function composeNaturalSatelliteState(
  satellite: Readonly<NaturalSatelliteDefinition>,
  parentState: Readonly<BodyRuntimeState>,
  jdTdb: number,
): ComposedNaturalSatelliteState {
  const local = sampleNaturalSatellite(satellite, jdTdb);
  const heliocentricPositionM = createVec3d(
    parentState.positionM.x + local.positionM.x,
    parentState.positionM.y + local.positionM.y,
    parentState.positionM.z + local.positionM.z,
  );
  const heliocentricVelocityMps = createVec3d(
    parentState.velocityMps.x + local.velocityMps.x,
    parentState.velocityMps.y + local.velocityMps.y,
    parentState.velocityMps.z + local.velocityMps.z,
  );
  return Object.freeze({ ...local, heliocentricPositionM, heliocentricVelocityMps });
}

export function sampleNaturalSatelliteOrbit(
  satellite: Readonly<NaturalSatelliteDefinition>,
  centerJdTdb: number,
  spanPeriods = 1,
  samples = 96,
): Float64Array {
  if (!Number.isInteger(samples) || samples < 8) {
    throw new RangeError('Natural satellite orbit samples must be an integer >= 8.');
  }
  if (!Number.isFinite(spanPeriods) || spanPeriods <= 0) {
    throw new RangeError('Natural satellite orbit span must be positive.');
  }
  const output = new Float64Array(samples * 3);
  const spanSeconds = satellite.orbitalPeriodSeconds * spanPeriods;
  const startJd = centerJdTdb - spanSeconds / 172_800;
  for (let index = 0; index < samples; index += 1) {
    const jd = startJd + (spanSeconds / 86_400) * (index / (samples - 1));
    const state = sampleNaturalSatellite(satellite, jd);
    output[index * 3] = state.positionM.x;
    output[index * 3 + 1] = state.positionM.y;
    output[index * 3 + 2] = state.positionM.z;
  }
  return output;
}

/** Returns whether a moon lies inside the parent body's geometric umbra. */
export function isNaturalSatelliteInParentShadow(
  state: Readonly<NaturalSatelliteState>,
  parentRadiusM: number,
  parentToSunM: Readonly<Vec3d>,
): boolean {
  if (!Number.isFinite(parentRadiusM) || parentRadiusM <= 0) {
    throw new RangeError('Parent radius must be positive and finite.');
  }
  const sunDistance = Math.hypot(parentToSunM.x, parentToSunM.y, parentToSunM.z);
  const satelliteDistance = Math.hypot(state.positionM.x, state.positionM.y, state.positionM.z);
  if (sunDistance === 0 || satelliteDistance === 0) return false;
  const sunDirectionX = parentToSunM.x / sunDistance;
  const sunDirectionY = parentToSunM.y / sunDistance;
  const sunDirectionZ = parentToSunM.z / sunDistance;
  // The anti-solar half-space is the only region that can be eclipsed.
  const axialDistance = -(state.positionM.x * sunDirectionX + state.positionM.y * sunDirectionY + state.positionM.z * sunDirectionZ);
  if (axialDistance <= 0) return false;
  const perpendicularX = state.positionM.x + axialDistance * sunDirectionX;
  const perpendicularY = state.positionM.y + axialDistance * sunDirectionY;
  const perpendicularZ = state.positionM.z + axialDistance * sunDirectionZ;
  const umbraRadius = parentRadiusM * Math.max(0, 1 - axialDistance / sunDistance);
  return Math.hypot(perpendicularX, perpendicularY, perpendicularZ) <= umbraRadius;
}

function gravitationalParameterFor(parentId: string): number {
  const massKg = PARENT_MASSES_KG[parentId];
  if (massKg === undefined) {
    throw new RangeError(`No natural-satellite parent mass is registered for "${parentId}".`);
  }
  return GRAVITATIONAL_CONSTANT * massKg;
}

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  let value = meanAnomaly;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const correction = (value - eccentricity * Math.sin(value) - meanAnomaly) /
      (1 - eccentricity * Math.cos(value));
    value -= correction;
    if (Math.abs(correction) < 1e-13) break;
  }
  return value;
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
}

function normalizePositiveAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
}

function cross(left: readonly number[], right: readonly number[]): readonly [number, number, number] {
  return [
    required(left[1]) * required(right[2]) - required(left[2]) * required(right[1]),
    required(left[2]) * required(right[0]) - required(left[0]) * required(right[2]),
    required(left[0]) * required(right[1]) - required(left[1]) * required(right[0]),
  ];
}

function dot(left: readonly number[], right: readonly number[]): number {
  return required(left[0]) * required(right[0]) + required(left[1]) * required(right[1]) + required(left[2]) * required(right[2]);
}

function magnitude(value: readonly number[]): number {
  return Math.hypot(required(value[0]), required(value[1]), required(value[2]));
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function required(value: number | undefined): number {
  if (!Number.isFinite(value)) throw new RangeError('Natural satellite vector component is missing.');
  return value as number;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}
