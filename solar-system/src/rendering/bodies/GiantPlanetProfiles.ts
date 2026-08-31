import rawCatalog from '../../data/catalogs/giant-planet-visual-profiles.json';

export const GIANT_PLANET_IDS = [
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;

export type GiantPlanetId = (typeof GIANT_PLANET_IDS)[number];

export interface JetProfileSample {
  readonly latitudeDeg: number;
  readonly zonalWindMps: number;
}

export interface GreatRedSpotProfile {
  readonly centerLatitudeDeg: number;
  readonly centerLongitudeAtEpochDeg: number;
  readonly sourceMapCenterLongitudeDeg: number;
  readonly epochJdTdb: number;
  readonly longitudinalDriftDegPerDay: number;
  readonly longitudeOscillationAmplitudeDeg: number;
  readonly longitudeOscillationPeriodDays: number;
  readonly angularRadiusLatitudeDeg: number;
  readonly angularRadiusLongitudeDeg: number;
  readonly vortexAngularSpeedRadPerDay: number;
  readonly filamentStrength: number;
  readonly pulsationAmplitude: number;
  readonly pulsationPeriodDays: number;
  readonly sourceVersion: string;
  readonly category: 'animated-visualization';
}

export interface UranusLegendreJetModel {
  readonly type: 'uranus-legendre-westward';
  readonly referenceFrame: string;
  readonly equatorialRadiusKm: number;
  readonly polarRadiusKm: number;
  readonly coefficientsDegPerHour: readonly number[];
  readonly sourceRef: string;
}

export interface NeptunePolynomialJetModel {
  readonly type: 'neptune-voyager-polynomial-eastward';
  readonly referenceFrame: string;
  readonly validLatitudeAbsDeg: number;
  readonly coefficients: readonly [number, number, number];
  readonly sourceRef: string;
}

export type AnalyticJetModel = UranusLegendreJetModel | NeptunePolynomialJetModel;

export interface DatedNeptuneStormProfile {
  readonly id: string;
  readonly centerLatitudeDeg: number;
  readonly centerLongitudeAtEpochDeg: number;
  readonly epochJdTdb: number;
  readonly activeStartJdTdb: number;
  readonly activeEndJdTdb: number;
  readonly angularRadiusLatitudeDeg: number;
  readonly angularRadiusLongitudeDeg: number;
  readonly longitudinalDriftDegPerDay: number;
  readonly contrast: number;
  readonly sourceVersion: string;
  readonly category: 'dated-nonpermanent-visualization';
  readonly sourceRef: string;
}

export interface GiantAtmosphereProfile {
  readonly bodyId: GiantPlanetId;
  readonly equatorialRadiusKm: number;
  readonly polarRadiusKm: number;
  readonly meanRadiusKm: number;
  readonly baseColor: string;
  readonly zoneColor: string;
  readonly hazeColor: string;
  readonly maximumJetSpeedMps: number;
  readonly jetProfileSource: string;
  readonly jetProfileRef: string;
  readonly jetInterpolationNotes?: string;
  readonly jetModel?: AnalyticJetModel;
  readonly jetSamples: readonly JetProfileSample[];
  readonly greatRedSpot?: GreatRedSpotProfile;
  readonly datedStorms?: readonly DatedNeptuneStormProfile[];
}

export interface RingRadialRegion {
  readonly id: string;
  readonly innerRadiusKm: number;
  readonly outerRadiusKm: number;
  readonly opticalDepth: number;
  readonly color: string;
}

export interface RingRadialGap {
  readonly id: string;
  readonly innerRadiusKm: number;
  readonly outerRadiusKm: number;
  readonly opticalDepth: number;
}

export interface RingSpokeProfile {
  readonly innerRadiusKm: number;
  readonly outerRadiusKm: number;
  readonly minimumQuality: 'high';
  readonly category: 'optional-transient-visualization';
}

export interface RingArcProfile {
  readonly ringId: string;
  readonly category: 'localized-ring-arc-visualization';
  readonly sourceVersion: string;
}

export interface RingSystemProfile {
  readonly bodyId: Exclude<GiantPlanetId, 'jupiter'>;
  readonly sourceVersion: string;
  readonly sourceRef: string;
  readonly innerRadiusKm: number;
  readonly outerRadiusKm: number;
  readonly displayOpticalDepthGain: number;
  readonly regions: readonly RingRadialRegion[];
  readonly gaps: readonly RingRadialGap[];
  readonly spokes?: RingSpokeProfile;
  readonly arcs?: RingArcProfile;
}

export interface GiantPlanetVisualCatalog {
  readonly schemaVersion: number;
  readonly profileVersion: string;
  readonly classification: string;
  readonly atmospheres: Readonly<Record<GiantPlanetId, GiantAtmosphereProfile>>;
  readonly ringSystems: Readonly<
    Record<Exclude<GiantPlanetId, 'jupiter'>, RingSystemProfile>
  >;
}

export interface GreatRedSpotState {
  readonly centerLongitudeRad: number;
  readonly vortexPhaseRad: number;
  readonly pulsationScale: number;
}

export interface DatedStormState {
  readonly active: boolean;
  readonly centerLongitudeRad: number;
  readonly ageDays: number;
  readonly lifetimeProgress: number;
}

export interface RingProfileSample {
  readonly opticalDepth: number;
  readonly color: string;
  readonly featureId: string | null;
}

const catalog = rawCatalog as unknown as GiantPlanetVisualCatalog;
validateCatalog(catalog);

/**
 * Versioned Phase 5 render inputs. Wind knots and dated storms are deliberately
 * kept out of shader source so later measurements can replace them without a
 * renderer rewrite.
 */
export const GIANT_PLANET_VISUAL_CATALOG = deepFreeze(catalog);

export function isGiantPlanetId(bodyId: string): bodyId is GiantPlanetId {
  return GIANT_PLANET_IDS.includes(bodyId as GiantPlanetId);
}

export function getGiantAtmosphereProfile(bodyId: GiantPlanetId): GiantAtmosphereProfile {
  return GIANT_PLANET_VISUAL_CATALOG.atmospheres[bodyId];
}

export function getRingSystemProfile(bodyId: GiantPlanetId): RingSystemProfile | null {
  return bodyId === 'jupiter'
    ? null
    : GIANT_PLANET_VISUAL_CATALOG.ringSystems[bodyId];
}

export function sampleJetSpeedMps(
  profile: GiantAtmosphereProfile,
  latitudeDeg: number,
): number {
  const clampedLatitude = Math.min(90, Math.max(-90, latitudeDeg));
  if (profile.jetModel?.type === 'uranus-legendre-westward') {
    return sampleUranusLegendreJet(profile.jetModel, clampedLatitude);
  }
  if (profile.jetModel?.type === 'neptune-voyager-polynomial-eastward') {
    return sampleNeptunePolynomialJet(profile.jetModel, clampedLatitude);
  }
  const samples = profile.jetSamples;
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (first === undefined || last === undefined) {
    throw new RangeError(`Jet profile "${profile.bodyId}" has no samples.`);
  }
  if (clampedLatitude <= first.latitudeDeg) return first.zonalWindMps;
  if (clampedLatitude >= last.latitudeDeg) return last.zonalWindMps;

  for (let index = 1; index < samples.length; index += 1) {
    const right = samples[index];
    const left = samples[index - 1];
    if (left === undefined || right === undefined) continue;
    if (clampedLatitude <= right.latitudeDeg) {
      const extent = right.latitudeDeg - left.latitudeDeg;
      const mix = extent === 0 ? 0 : (clampedLatitude - left.latitudeDeg) / extent;
      return left.zonalWindMps + (right.zonalWindMps - left.zonalWindMps) * mix;
    }
  }
  return last.zonalWindMps;
}

export function sampleRingProfile(
  profile: RingSystemProfile,
  radiusKm: number,
): RingProfileSample {
  let result: RingProfileSample = {
    opticalDepth: 0,
    color: '#000000',
    featureId: null,
  };
  for (const region of profile.regions) {
    if (radiusKm >= region.innerRadiusKm && radiusKm <= region.outerRadiusKm) {
      result = {
        opticalDepth: region.opticalDepth,
        color: region.color,
        featureId: region.id,
      };
    }
  }
  for (const gap of profile.gaps) {
    if (radiusKm >= gap.innerRadiusKm && radiusKm <= gap.outerRadiusKm) {
      result = {
        opticalDepth: gap.opticalDepth,
        color: result.color,
        featureId: gap.id,
      };
    }
  }
  return Object.freeze(result);
}

export function sampleGreatRedSpotState(
  profile: GreatRedSpotProfile,
  jdTdb: number,
): GreatRedSpotState {
  assertFinite(jdTdb, 'Great Red Spot epoch');
  const ageDays = jdTdb - profile.epochJdTdb;
  const longitudeOscillationDeg = profile.longitudeOscillationAmplitudeDeg * Math.sin(
    ageDays / profile.longitudeOscillationPeriodDays * Math.PI * 2,
  );
  const centerLongitudeRad = wrapSignedRadians(
    degreesToRadians(
      profile.centerLongitudeAtEpochDeg +
        profile.longitudinalDriftDegPerDay * ageDays +
        longitudeOscillationDeg,
    ),
  );
  const vortexPhaseRad = wrapSignedRadians(profile.vortexAngularSpeedRadPerDay * ageDays);
  const pulsationPhase = (ageDays / profile.pulsationPeriodDays) * Math.PI * 2;
  return Object.freeze({
    centerLongitudeRad,
    vortexPhaseRad,
    pulsationScale: 1 + Math.sin(pulsationPhase) * profile.pulsationAmplitude,
  });
}

export function sampleDatedStormState(
  profile: DatedNeptuneStormProfile,
  jdTdb: number,
): DatedStormState {
  assertFinite(jdTdb, `${profile.id} epoch`);
  const ageDays = jdTdb - profile.epochJdTdb;
  const lifetimeDays = profile.activeEndJdTdb - profile.activeStartJdTdb;
  return Object.freeze({
    active: jdTdb >= profile.activeStartJdTdb && jdTdb <= profile.activeEndJdTdb,
    centerLongitudeRad: wrapSignedRadians(
      degreesToRadians(
        profile.centerLongitudeAtEpochDeg + profile.longitudinalDriftDegPerDay * ageDays,
      ),
    ),
    ageDays,
    lifetimeProgress: Math.min(
      1,
      Math.max(0, (jdTdb - profile.activeStartJdTdb) / lifetimeDays),
    ),
  });
}

export function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function validateCatalog(value: GiantPlanetVisualCatalog): void {
  if (value.schemaVersion !== 1) {
    throw new RangeError(`Unsupported giant-planet profile schema ${value.schemaVersion}.`);
  }
  if (value.profileVersion.trim().length === 0 || value.classification.trim().length === 0) {
    throw new RangeError('Giant-planet profile metadata is incomplete.');
  }
  for (const bodyId of GIANT_PLANET_IDS) {
    const atmosphere = value.atmospheres[bodyId];
    if (atmosphere.bodyId !== bodyId) {
      throw new RangeError(`Atmosphere profile key/body mismatch for "${bodyId}".`);
    }
    validateAtmosphere(atmosphere);
    if (bodyId !== 'jupiter') {
      const rings = value.ringSystems[bodyId];
      if (rings.bodyId !== bodyId) {
        throw new RangeError(`Ring profile key/body mismatch for "${bodyId}".`);
      }
      validateRings(rings);
    }
  }
}

function validateAtmosphere(profile: GiantAtmosphereProfile): void {
  if (
    profile.equatorialRadiusKm <= 0 ||
    profile.polarRadiusKm <= 0 ||
    profile.meanRadiusKm <= 0 ||
    profile.maximumJetSpeedMps <= 0
  ) {
    throw new RangeError(`Atmosphere profile "${profile.bodyId}" has invalid physical bounds.`);
  }
  if (profile.jetSamples.length < 3) {
    throw new RangeError(`Atmosphere profile "${profile.bodyId}" needs at least three wind knots.`);
  }
  let previousLatitude = Number.NEGATIVE_INFINITY;
  for (const sample of profile.jetSamples) {
    assertFinite(sample.latitudeDeg, `${profile.bodyId} jet latitude`);
    assertFinite(sample.zonalWindMps, `${profile.bodyId} jet speed`);
    if (sample.latitudeDeg <= previousLatitude || Math.abs(sample.latitudeDeg) > 90) {
      throw new RangeError(`Atmosphere profile "${profile.bodyId}" has unordered wind knots.`);
    }
    if (Math.abs(sample.zonalWindMps) > profile.maximumJetSpeedMps) {
      throw new RangeError(`Atmosphere profile "${profile.bodyId}" exceeds its wind bound.`);
    }
    previousLatitude = sample.latitudeDeg;
  }
  if (
    profile.jetSamples[0]?.latitudeDeg !== -90 ||
    profile.jetSamples[profile.jetSamples.length - 1]?.latitudeDeg !== 90
  ) {
    throw new RangeError(`Atmosphere profile "${profile.bodyId}" must cover both poles.`);
  }
  if (profile.greatRedSpot !== undefined) {
    if (profile.greatRedSpot.category !== 'animated-visualization') {
      throw new RangeError('The Great Red Spot must remain explicitly visualization-only.');
    }
    if (
      profile.greatRedSpot.angularRadiusLatitudeDeg <= 0 ||
      profile.greatRedSpot.angularRadiusLongitudeDeg <= 0 ||
      profile.greatRedSpot.pulsationPeriodDays <= 0 ||
      profile.greatRedSpot.longitudeOscillationPeriodDays <= 0
    ) {
      throw new RangeError('The Great Red Spot profile has invalid ellipse or timing values.');
    }
  }
  for (const storm of profile.datedStorms ?? []) {
    if (
      storm.category !== 'dated-nonpermanent-visualization' ||
      storm.activeEndJdTdb <= storm.activeStartJdTdb
    ) {
      throw new RangeError(`Dated storm "${storm.id}" must have a finite active interval.`);
    }
  }
}

function sampleUranusLegendreJet(
  model: UranusLegendreJetModel,
  latitudeDeg: number,
): number {
  const latitudeRad = degreesToRadians(Math.min(89.999, Math.max(-89.999, latitudeDeg)));
  const x = Math.sin(latitudeRad);
  let previousPrevious = 1;
  let previous = x;
  let westwardDriftDegPerHour = model.coefficientsDegPerHour[0] ?? 0;
  if (model.coefficientsDegPerHour.length > 1) {
    westwardDriftDegPerHour += (model.coefficientsDegPerHour[1] ?? 0) * previous;
  }
  for (let degree = 2; degree < model.coefficientsDegPerHour.length; degree += 1) {
    const polynomial = (
      (2 * degree - 1) * x * previous - (degree - 1) * previousPrevious
    ) / degree;
    westwardDriftDegPerHour += (model.coefficientsDegPerHour[degree] ?? 0) * polynomial;
    previousPrevious = previous;
    previous = polynomial;
  }
  const radiusKm = model.equatorialRadiusKm / Math.sqrt(
    1 + (model.polarRadiusKm / model.equatorialRadiusKm) ** 2 * Math.tan(latitudeRad) ** 2,
  );
  const westwardMps = 4.8481e-3 * radiusKm * westwardDriftDegPerHour;
  return -westwardMps;
}

function sampleNeptunePolynomialJet(
  model: NeptunePolynomialJetModel,
  latitudeDeg: number,
): number {
  const absoluteLatitude = Math.abs(latitudeDeg);
  const evaluatedLatitude = Math.min(absoluteLatitude, model.validLatitudeAbsDeg);
  const squared = evaluatedLatitude * evaluatedLatitude;
  const [constant, quadratic, quartic] = model.coefficients;
  const withinMeasuredDomain = constant + quadratic * squared + quartic * squared * squared;
  if (absoluteLatitude <= model.validLatitudeAbsDeg) return withinMeasuredDomain;
  const taper = Math.cos(
    Math.PI / 2 * (absoluteLatitude - model.validLatitudeAbsDeg) /
      (90 - model.validLatitudeAbsDeg),
  );
  return withinMeasuredDomain * Math.max(0, taper);
}

function validateRings(profile: RingSystemProfile): void {
  if (
    profile.innerRadiusKm <= 0 ||
    profile.outerRadiusKm <= profile.innerRadiusKm ||
    profile.displayOpticalDepthGain <= 0 ||
    profile.regions.length === 0
  ) {
    throw new RangeError(`Ring profile "${profile.bodyId}" has invalid radial bounds.`);
  }
  for (const feature of [...profile.regions, ...profile.gaps]) {
    if (
      feature.innerRadiusKm < profile.innerRadiusKm ||
      feature.outerRadiusKm > profile.outerRadiusKm ||
      feature.outerRadiusKm <= feature.innerRadiusKm ||
      feature.opticalDepth < 0
    ) {
      throw new RangeError(`Ring feature "${feature.id}" falls outside ${profile.bodyId}.`);
    }
  }
}

function wrapSignedRadians(value: number): number {
  const tau = Math.PI * 2;
  return ((value + Math.PI) % tau + tau) % tau - Math.PI;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
