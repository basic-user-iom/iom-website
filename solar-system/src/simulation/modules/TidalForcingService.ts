import type { RotationModel } from '../bodies/RotationModel';
import {
  createRotationState,
  rotateInertialVectorToBodyLocal,
} from '../bodies/RotationModel';
import { EPHEMERIS_BODY_DEFINITIONS } from '../bodies/EphemerisBodyCatalog';
import { GRAVITATIONAL_CONSTANT_M3_KG_S2 } from '../core/Units';
import { createVec3d, isFiniteVec3d, type Vec3d } from '../core/Vec3d';
import type { EphemerisProvider } from '../ephemeris/EphemerisProvider';
import {
  createEphemerisStateVector,
  type EphemerisStateVector,
} from '../ephemeris/EphemerisTypes';

export type TidalPerturberId = 'moon' | 'sun';

export interface TidalPotentialComponents {
  lunarPotential: number;
  solarPotential: number;
  combinedPotential: number;
}

/**
 * The inherited potential components are evaluated at the mean-radius
 * equatorial point on body-local +X. Use
 * `equilibriumPotentialAtEarthFixedPoint` for another location.
 */
export interface TidalForcingSample extends TidalPotentialComponents {
  jdTdb: number;
  sublunarLatRad: number;
  sublunarLonRad: number;
  subsolarLatRad: number;
  subsolarLonRad: number;
  lunarDistanceM: number;
  solarDistanceM: number;
  /** Point-mass lunar tidal-tensor coefficient G M / r^3, SI s^-2. */
  lunarTidalTensorScaleS2: number;
  /** Point-mass solar tidal-tensor coefficient G M / r^3, SI s^-2. */
  solarTidalTensorScaleS2: number;
  readonly moonPositionEarthFixedM: Vec3d;
  readonly sunPositionEarthFixedM: Vec3d;
  /** Combined row-major 3x3 center tidal tensor, SI s^-2. */
  readonly tidalTensorEarthFixed: Float64Array;
}

export interface TidalForcingService {
  sampleEarth(jdTdb: number, out?: TidalForcingSample): TidalForcingSample;
  equilibriumPotentialAtEarthFixedPoint(
    pointEarthFixedM: Readonly<Vec3d>,
    jdTdb: number,
    out?: TidalPotentialComponents,
  ): TidalPotentialComponents;
  differentialAccelerationAtEarthFixedPoint(
    pointEarthFixedM: Readonly<Vec3d>,
    perturberId: TidalPerturberId,
    jdTdb: number,
    out?: Vec3d,
  ): Vec3d;
}

export interface EphemerisTidalForcingServiceOptions {
  readonly ephemerisProvider: EphemerisProvider;
  readonly earthRotationModel: RotationModel;
  readonly earthRadiusM?: number;
  readonly moonMassKg?: number;
  readonly sunMassKg?: number;
}

/**
 * Tide-ready geometry and equilibrium/quadrupole forcing service. It is not an
 * ocean tide predictor: no bathymetry, harmonic constituents, or hydrodynamics
 * are included.
 */
export class EphemerisTidalForcingService implements TidalForcingService {
  readonly #provider: EphemerisProvider;
  readonly #earthRotationModel: RotationModel;
  readonly #earthRadiusM: number;
  readonly #moonMassKg: number;
  readonly #sunMassKg: number;
  readonly #earthState = createEphemerisStateVector();
  readonly #moonState = createEphemerisStateVector();
  readonly #sunState = createEphemerisStateVector();
  readonly #rotationState = createRotationState();
  readonly #rotationInput = {
    jdTdb: 0,
    bodyPositionM: this.#earthState.positionM,
    bodyVelocityMps: this.#earthState.velocityMps,
  };
  readonly #moonInertialM = createVec3d();
  readonly #sunInertialM = createVec3d();
  readonly #moonEarthFixedM = createVec3d();
  readonly #sunEarthFixedM = createVec3d();
  readonly #referencePointM = createVec3d();

  public constructor(options: EphemerisTidalForcingServiceOptions) {
    this.#provider = options.ephemerisProvider;
    this.#earthRotationModel = options.earthRotationModel;
    if (this.#earthRotationModel.bodyId !== 'earth') {
      throw new RangeError('Tidal forcing requires an Earth rotation model.');
    }
    for (const bodyId of ['earth', 'moon', 'sun'] as const) {
      if (!this.#provider.hasBody(bodyId)) {
        throw new RangeError(`Tidal ephemeris provider is missing "${bodyId}".`);
      }
    }
    this.#earthRadiusM = options.earthRadiusM ?? requiredBodyValue('earth', 'meanRadiusM');
    this.#moonMassKg = options.moonMassKg ?? requiredBodyValue('moon', 'massKg');
    this.#sunMassKg = options.sunMassKg ?? requiredBodyValue('sun', 'massKg');
    assertPositiveFinite(this.#earthRadiusM, 'Earth radius');
    assertPositiveFinite(this.#moonMassKg, 'Moon mass');
    assertPositiveFinite(this.#sunMassKg, 'Sun mass');
    this.#referencePointM.x = this.#earthRadiusM;
  }

  public sampleEarth(
    jdTdb: number,
    out: TidalForcingSample = createTidalForcingSample(),
  ): TidalForcingSample {
    this.refreshState(jdTdb);
    const lunarDistance = vectorLength(this.#moonEarthFixedM, 'Moon distance');
    const solarDistance = vectorLength(this.#sunEarthFixedM, 'Sun distance');
    writeSubpoint(out, 'lunar', this.#moonEarthFixedM, lunarDistance);
    writeSubpoint(out, 'solar', this.#sunEarthFixedM, solarDistance);
    out.jdTdb = jdTdb;
    out.lunarDistanceM = lunarDistance;
    out.solarDistanceM = solarDistance;
    out.lunarTidalTensorScaleS2 = pointMassTidalTensorScale(
      this.#moonMassKg,
      lunarDistance,
      'Lunar tidal tensor scale',
    );
    out.solarTidalTensorScaleS2 = pointMassTidalTensorScale(
      this.#sunMassKg,
      solarDistance,
      'Solar tidal tensor scale',
    );
    copyVector(out.moonPositionEarthFixedM, this.#moonEarthFixedM);
    copyVector(out.sunPositionEarthFixedM, this.#sunEarthFixedM);
    writePotentialComponents(
      out,
      this.#referencePointM,
      this.#moonEarthFixedM,
      this.#moonMassKg,
      this.#sunEarthFixedM,
      this.#sunMassKg,
    );
    writeCombinedTidalTensor(
      out.tidalTensorEarthFixed,
      this.#moonEarthFixedM,
      this.#moonMassKg,
      this.#sunEarthFixedM,
      this.#sunMassKg,
    );
    return out;
  }

  public equilibriumPotentialAtEarthFixedPoint(
    pointEarthFixedM: Readonly<Vec3d>,
    jdTdb: number,
    out: TidalPotentialComponents = createTidalPotentialComponents(),
  ): TidalPotentialComponents {
    assertFiniteVector(pointEarthFixedM, 'Earth-fixed tide point');
    this.refreshState(jdTdb);
    writePotentialComponents(
      out,
      pointEarthFixedM,
      this.#moonEarthFixedM,
      this.#moonMassKg,
      this.#sunEarthFixedM,
      this.#sunMassKg,
    );
    return out;
  }

  public differentialAccelerationAtEarthFixedPoint(
    pointEarthFixedM: Readonly<Vec3d>,
    perturberId: TidalPerturberId,
    jdTdb: number,
    out: Vec3d = createVec3d(),
  ): Vec3d {
    assertFiniteVector(pointEarthFixedM, 'Earth-fixed tide point');
    if (perturberId !== 'moon' && perturberId !== 'sun') {
      throw new RangeError(`Unknown tidal perturber "${String(perturberId)}".`);
    }
    this.refreshState(jdTdb);
    const perturber =
      perturberId === 'moon' ? this.#moonEarthFixedM : this.#sunEarthFixedM;
    const mass = perturberId === 'moon' ? this.#moonMassKg : this.#sunMassKg;
    const centerDistance = vectorLength(perturber, `${perturberId} center distance`);
    const fromPointX = perturber.x - pointEarthFixedM.x;
    const fromPointY = perturber.y - pointEarthFixedM.y;
    const fromPointZ = perturber.z - pointEarthFixedM.z;
    const pointDistance = Math.hypot(fromPointX, fromPointY, fromPointZ);
    if (!Number.isFinite(pointDistance) || pointDistance <= 0) {
      throw new RangeError('Earth-fixed tide point cannot coincide with a perturber.');
    }
    const gravitationalParameter = GRAVITATIONAL_CONSTANT_M3_KG_S2 * mass;
    const pointScale = gravitationalParameter / pointDistance ** 3;
    const centerScale = gravitationalParameter / centerDistance ** 3;
    out.x = fromPointX * pointScale - perturber.x * centerScale;
    out.y = fromPointY * pointScale - perturber.y * centerScale;
    out.z = fromPointZ * pointScale - perturber.z * centerScale;
    assertFiniteVector(out, 'Differential tidal acceleration');
    return out;
  }

  private refreshState(jdTdb: number): void {
    if (!Number.isFinite(jdTdb)) throw new RangeError('Tidal JD TDB must be finite.');
    this.#provider.sample('earth', jdTdb, this.#earthState);
    this.#provider.sample('moon', jdTdb, this.#moonState);
    this.#provider.sample('sun', jdTdb, this.#sunState);
    subtractStatePositions(this.#moonInertialM, this.#moonState, this.#earthState);
    subtractStatePositions(this.#sunInertialM, this.#sunState, this.#earthState);
    this.#rotationInput.jdTdb = jdTdb;
    this.#earthRotationModel.sample(this.#rotationInput, this.#rotationState);
    rotateInertialVectorToBodyLocal(
      this.#moonEarthFixedM,
      this.#moonInertialM,
      this.#rotationState.orientation,
    );
    rotateInertialVectorToBodyLocal(
      this.#sunEarthFixedM,
      this.#sunInertialM,
      this.#rotationState.orientation,
    );
  }
}

export function createTidalForcingSample(): TidalForcingSample {
  return {
    jdTdb: 0,
    sublunarLatRad: 0,
    sublunarLonRad: 0,
    subsolarLatRad: 0,
    subsolarLonRad: 0,
    lunarDistanceM: 0,
    solarDistanceM: 0,
    lunarTidalTensorScaleS2: 0,
    solarTidalTensorScaleS2: 0,
    lunarPotential: 0,
    solarPotential: 0,
    combinedPotential: 0,
    moonPositionEarthFixedM: createVec3d(),
    sunPositionEarthFixedM: createVec3d(),
    tidalTensorEarthFixed: new Float64Array(9),
  };
}

export function createTidalPotentialComponents(): TidalPotentialComponents {
  return { lunarPotential: 0, solarPotential: 0, combinedPotential: 0 };
}

function writePotentialComponents(
  out: TidalPotentialComponents,
  pointM: Readonly<Vec3d>,
  moonM: Readonly<Vec3d>,
  moonMassKg: number,
  sunM: Readonly<Vec3d>,
  sunMassKg: number,
): void {
  out.lunarPotential = quadrupoleTidalPotential(pointM, moonM, moonMassKg);
  out.solarPotential = quadrupoleTidalPotential(pointM, sunM, sunMassKg);
  out.combinedPotential = out.lunarPotential + out.solarPotential;
}

/** Equilibrium tide-generating quadrupole potential, SI m^2 s^-2. */
export function quadrupoleTidalPotential(
  pointEarthFixedM: Readonly<Vec3d>,
  perturberPositionEarthFixedM: Readonly<Vec3d>,
  perturberMassKg: number,
): number {
  assertFiniteVector(pointEarthFixedM, 'Earth-fixed tide point');
  assertFiniteVector(perturberPositionEarthFixedM, 'Perturber position');
  assertPositiveFinite(perturberMassKg, 'Perturber mass');
  const pointRadius = Math.hypot(
    pointEarthFixedM.x,
    pointEarthFixedM.y,
    pointEarthFixedM.z,
  );
  const perturberDistance = vectorLength(perturberPositionEarthFixedM, 'Perturber distance');
  if (pointRadius === 0) return 0;
  const cosine = clamp(
    (pointEarthFixedM.x * perturberPositionEarthFixedM.x +
      pointEarthFixedM.y * perturberPositionEarthFixedM.y +
      pointEarthFixedM.z * perturberPositionEarthFixedM.z) /
      (pointRadius * perturberDistance),
    -1,
    1,
  );
  const legendreP2 = 0.5 * (3 * cosine * cosine - 1);
  const potential =
    GRAVITATIONAL_CONSTANT_M3_KG_S2 *
    perturberMassKg *
    pointRadius *
    pointRadius *
    legendreP2 /
    perturberDistance ** 3;
  if (!Number.isFinite(potential)) {
    throw new RangeError('Quadrupole tidal potential must be finite.');
  }
  return potential;
}

function writeCombinedTidalTensor(
  output: Float64Array,
  moonM: Readonly<Vec3d>,
  moonMassKg: number,
  sunM: Readonly<Vec3d>,
  sunMassKg: number,
): void {
  if (output.length !== 9) {
    throw new RangeError('Tidal tensor output must contain exactly nine components.');
  }
  output.fill(0);
  addPointMassTidalTensor(output, moonM, moonMassKg);
  addPointMassTidalTensor(output, sunM, sunMassKg);
  for (let index = 0; index < output.length; index += 1) {
    if (!Number.isFinite(output[index])) {
      throw new RangeError('Combined tidal tensor must be finite.');
    }
  }
}

function addPointMassTidalTensor(
  output: Float64Array,
  positionM: Readonly<Vec3d>,
  massKg: number,
): void {
  const distance = vectorLength(positionM, 'Tidal tensor perturber distance');
  const nx = positionM.x / distance;
  const ny = positionM.y / distance;
  const nz = positionM.z / distance;
  const scale = GRAVITATIONAL_CONSTANT_M3_KG_S2 * massKg / distance ** 3;
  output[0] = (output[0] ?? 0) + scale * (3 * nx * nx - 1);
  output[1] = (output[1] ?? 0) + scale * 3 * nx * ny;
  output[2] = (output[2] ?? 0) + scale * 3 * nx * nz;
  output[3] = (output[3] ?? 0) + scale * 3 * ny * nx;
  output[4] = (output[4] ?? 0) + scale * (3 * ny * ny - 1);
  output[5] = (output[5] ?? 0) + scale * 3 * ny * nz;
  output[6] = (output[6] ?? 0) + scale * 3 * nz * nx;
  output[7] = (output[7] ?? 0) + scale * 3 * nz * ny;
  output[8] = (output[8] ?? 0) + scale * (3 * nz * nz - 1);
}

function pointMassTidalTensorScale(
  massKg: number,
  distanceM: number,
  label: string,
): number {
  const scale = GRAVITATIONAL_CONSTANT_M3_KG_S2 * massKg / distanceM ** 3;
  if (!Number.isFinite(scale) || scale < 0) {
    throw new RangeError(`${label} must be finite and nonnegative.`);
  }
  return scale;
}

function writeSubpoint(
  out: TidalForcingSample,
  kind: 'lunar' | 'solar',
  positionM: Readonly<Vec3d>,
  distanceM: number,
): void {
  const latitude = Math.asin(clamp(positionM.z / distanceM, -1, 1));
  const longitude = Math.atan2(positionM.y, positionM.x);
  if (kind === 'lunar') {
    out.sublunarLatRad = latitude;
    out.sublunarLonRad = longitude;
  } else {
    out.subsolarLatRad = latitude;
    out.subsolarLonRad = longitude;
  }
}

function subtractStatePositions(
  out: Vec3d,
  target: EphemerisStateVector,
  origin: EphemerisStateVector,
): void {
  out.x = target.positionM.x - origin.positionM.x;
  out.y = target.positionM.y - origin.positionM.y;
  out.z = target.positionM.z - origin.positionM.z;
  assertFiniteVector(out, 'Perturber relative position');
}

function requiredBodyValue(
  bodyId: string,
  field: 'meanRadiusM' | 'massKg',
): number {
  const definition = EPHEMERIS_BODY_DEFINITIONS.find((body) => body.id === bodyId);
  if (definition === undefined) throw new Error(`Body catalog is missing "${bodyId}".`);
  return definition[field];
}

function copyVector(out: Vec3d, value: Readonly<Vec3d>): void {
  out.x = value.x;
  out.y = value.y;
  out.z = value.z;
}

function vectorLength(value: Readonly<Vec3d>, label: string): number {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
  return length;
}

function assertFiniteVector(value: Readonly<Vec3d>, label: string): void {
  if (!isFiniteVec3d(value)) throw new RangeError(`${label} must be finite.`);
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
