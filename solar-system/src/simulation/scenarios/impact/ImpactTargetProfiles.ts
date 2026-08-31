import type {
  ImpactAtmosphereProfile,
  ImpactTargetBodyId,
  ImpactTargetProfile,
} from './ImpactTypes';

const EDUCATIONAL_ATMOSPHERE_NOTE =
  'Static exponential atmosphere for deterministic education; weather, composition layers, winds, and real-time conditions are omitted.';

/**
 * Nominal radii match the observatory body catalog. Gravities and escape
 * velocities are rounded standard reference values. Atmosphere and material
 * values are educational approximations and must not be treated as precision
 * planetary-environment data.
 */
export const IMPACT_TARGET_PROFILES: Readonly<
  Record<ImpactTargetBodyId, Readonly<ImpactTargetProfile>>
> = Object.freeze({
  mercury: profile({
    bodyId: 'mercury',
    targetClass: 'airless-rocky',
    meanRadiusM: 2_439_400,
    surfaceGravityMps2: 3.7,
    escapeVelocityMps: 4_250,
    surfaceDensityKgM3: 3_000,
    supportsCrater: true,
    supportsGroundShockwave: true,
    supportsAtmosphericShockwave: false,
    supportsPersistentSurfaceDecal: true,
    supportsCloudScar: false,
    visualProfileId: 'mercury-airless-rocky-v1',
  }),
  venus: profile({
    bodyId: 'venus',
    targetClass: 'dense-atmosphere-rocky',
    meanRadiusM: 6_051_800,
    surfaceGravityMps2: 8.87,
    escapeVelocityMps: 10_360,
    atmosphereProfileId: 'venus-educational-exponential-v1',
    surfaceDensityKgM3: 2_900,
    supportsCrater: true,
    supportsGroundShockwave: true,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: true,
    supportsCloudScar: true,
    visualProfileId: 'venus-dense-atmosphere-rocky-v1',
  }),
  earth: profile({
    bodyId: 'earth',
    targetClass: 'dense-atmosphere-rocky',
    meanRadiusM: 6_371_008.4,
    surfaceGravityMps2: 9.80665,
    escapeVelocityMps: 11_186,
    atmosphereProfileId: 'earth-educational-exponential-v1',
    surfaceDensityKgM3: 2_700,
    supportsCrater: true,
    supportsGroundShockwave: true,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: true,
    supportsCloudScar: false,
    visualProfileId: 'earth-dense-atmosphere-rocky-v1',
  }),
  moon: profile({
    bodyId: 'moon',
    targetClass: 'airless-rocky',
    meanRadiusM: 1_737_400,
    surfaceGravityMps2: 1.62,
    escapeVelocityMps: 2_380,
    surfaceDensityKgM3: 2_550,
    supportsCrater: true,
    supportsGroundShockwave: true,
    supportsAtmosphericShockwave: false,
    supportsPersistentSurfaceDecal: true,
    supportsCloudScar: false,
    visualProfileId: 'moon-airless-rocky-v1',
  }),
  mars: profile({
    bodyId: 'mars',
    targetClass: 'thin-atmosphere-rocky',
    meanRadiusM: 3_389_500,
    surfaceGravityMps2: 3.72076,
    escapeVelocityMps: 5_030,
    atmosphereProfileId: 'mars-educational-exponential-v1',
    surfaceDensityKgM3: 2_900,
    supportsCrater: true,
    supportsGroundShockwave: true,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: true,
    supportsCloudScar: false,
    visualProfileId: 'mars-thin-atmosphere-rocky-v1',
  }),
  jupiter: profile({
    bodyId: 'jupiter',
    targetClass: 'gas-giant',
    meanRadiusM: 69_911_000,
    cloudTopRadiusM: 69_911_000,
    surfaceGravityMps2: 24.79,
    escapeVelocityMps: 59_500,
    atmosphereProfileId: 'jupiter-cloud-top-educational-v1',
    supportsCrater: false,
    supportsGroundShockwave: false,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: false,
    supportsCloudScar: true,
    visualProfileId: 'jupiter-gas-giant-v1',
  }),
  saturn: profile({
    bodyId: 'saturn',
    targetClass: 'gas-giant',
    meanRadiusM: 58_232_000,
    cloudTopRadiusM: 58_232_000,
    surfaceGravityMps2: 10.44,
    escapeVelocityMps: 35_500,
    atmosphereProfileId: 'saturn-cloud-top-educational-v1',
    supportsCrater: false,
    supportsGroundShockwave: false,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: false,
    supportsCloudScar: true,
    visualProfileId: 'saturn-gas-giant-v1',
  }),
  uranus: profile({
    bodyId: 'uranus',
    targetClass: 'ice-giant',
    meanRadiusM: 25_362_000,
    cloudTopRadiusM: 25_362_000,
    surfaceGravityMps2: 8.69,
    escapeVelocityMps: 21_300,
    atmosphereProfileId: 'uranus-cloud-top-educational-v1',
    supportsCrater: false,
    supportsGroundShockwave: false,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: false,
    supportsCloudScar: true,
    visualProfileId: 'uranus-ice-giant-v1',
  }),
  neptune: profile({
    bodyId: 'neptune',
    targetClass: 'ice-giant',
    meanRadiusM: 24_622_000,
    cloudTopRadiusM: 24_622_000,
    surfaceGravityMps2: 11.15,
    escapeVelocityMps: 23_500,
    atmosphereProfileId: 'neptune-cloud-top-educational-v1',
    supportsCrater: false,
    supportsGroundShockwave: false,
    supportsAtmosphericShockwave: true,
    supportsPersistentSurfaceDecal: false,
    supportsCloudScar: true,
    visualProfileId: 'neptune-ice-giant-v1',
  }),
});

export const IMPACT_ATMOSPHERE_PROFILES: Readonly<
  Record<string, Readonly<ImpactAtmosphereProfile>>
> = Object.freeze({
  'venus-educational-exponential-v1': atmosphere({
    id: 'venus-educational-exponential-v1',
    referenceDensityKgM3: 65,
    scaleHeightM: 15_900,
    cutoffAltitudeM: 250_000,
    initialAltitudeM: 300_000,
    approximationNote: EDUCATIONAL_ATMOSPHERE_NOTE,
  }),
  'earth-educational-exponential-v1': atmosphere({
    id: 'earth-educational-exponential-v1',
    referenceDensityKgM3: 1.225,
    scaleHeightM: 8_500,
    cutoffAltitudeM: 120_000,
    initialAltitudeM: 160_000,
    approximationNote: EDUCATIONAL_ATMOSPHERE_NOTE,
  }),
  'mars-educational-exponential-v1': atmosphere({
    id: 'mars-educational-exponential-v1',
    referenceDensityKgM3: 0.02,
    scaleHeightM: 11_100,
    cutoffAltitudeM: 120_000,
    initialAltitudeM: 160_000,
    approximationNote: EDUCATIONAL_ATMOSPHERE_NOTE,
  }),
  'jupiter-cloud-top-educational-v1': atmosphere({
    id: 'jupiter-cloud-top-educational-v1',
    referenceDensityKgM3: 0.16,
    scaleHeightM: 27_000,
    cutoffAltitudeM: 500_000,
    initialAltitudeM: 600_000,
    approximationNote: EDUCATIONAL_ATMOSPHERE_NOTE,
  }),
  'saturn-cloud-top-educational-v1': atmosphere({
    id: 'saturn-cloud-top-educational-v1',
    referenceDensityKgM3: 0.19,
    scaleHeightM: 59_500,
    cutoffAltitudeM: 600_000,
    initialAltitudeM: 700_000,
    approximationNote: EDUCATIONAL_ATMOSPHERE_NOTE,
  }),
  'uranus-cloud-top-educational-v1': atmosphere({
    id: 'uranus-cloud-top-educational-v1',
    referenceDensityKgM3: 0.42,
    scaleHeightM: 27_700,
    cutoffAltitudeM: 400_000,
    initialAltitudeM: 500_000,
    approximationNote: EDUCATIONAL_ATMOSPHERE_NOTE,
  }),
  'neptune-cloud-top-educational-v1': atmosphere({
    id: 'neptune-cloud-top-educational-v1',
    referenceDensityKgM3: 0.45,
    scaleHeightM: 19_700,
    cutoffAltitudeM: 400_000,
    initialAltitudeM: 500_000,
    approximationNote: EDUCATIONAL_ATMOSPHERE_NOTE,
  }),
});

export function getImpactTargetProfile(
  bodyId: ImpactTargetBodyId,
): Readonly<ImpactTargetProfile> {
  return IMPACT_TARGET_PROFILES[bodyId];
}

export function getImpactAtmosphereProfile(
  target: ImpactTargetBodyId | Readonly<ImpactTargetProfile>,
): Readonly<ImpactAtmosphereProfile> | null {
  const profile = typeof target === 'string' ? getImpactTargetProfile(target) : target;
  const atmosphereProfileId = profile.atmosphereProfileId;
  if (atmosphereProfileId === undefined) return null;
  const atmosphereProfile = IMPACT_ATMOSPHERE_PROFILES[atmosphereProfileId];
  if (atmosphereProfile === undefined) {
    throw new Error(`Missing impact atmosphere profile "${atmosphereProfileId}".`);
  }
  return atmosphereProfile;
}

export function impactTargetCollisionRadiusM(
  profile: Readonly<ImpactTargetProfile>,
): number {
  return profile.cloudTopRadiusM ?? profile.meanRadiusM;
}

function profile(value: ImpactTargetProfile): Readonly<ImpactTargetProfile> {
  return Object.freeze(value);
}

function atmosphere(
  value: ImpactAtmosphereProfile,
): Readonly<ImpactAtmosphereProfile> {
  return Object.freeze(value);
}
