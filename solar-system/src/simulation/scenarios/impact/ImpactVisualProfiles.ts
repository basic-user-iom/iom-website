/**
 * Target-specific visual tuning for the educational impact model. These
 * values scale resolved, energy-derived dimensions; they never feed back into
 * trajectory integration or reported physical energy.
 */
export interface ImpactVisualTuningProfile {
  readonly id: string;
  readonly flashRadiusMultiplier: number;
  readonly flashDurationSeconds: number;
  readonly flashDecaySeconds: number;
  readonly craterDepthRatio: number;
  readonly craterFormationSeconds: number;
  readonly scorchRadiusMultiplier: number;
  readonly ejectaLaunchSpeedMultiplier: number;
  readonly ejectaLifetimeMultiplier: number;
  readonly groundShockwaveSpeedMultiplier: number;
  readonly groundShockwaveLifetimeSeconds: number;
  readonly atmosphericShockwaveSpeedMultiplier: number;
  readonly atmosphericShockwaveLifetimeSeconds: number;
  readonly plumeHeightMultiplier: number;
  readonly plumeRadiusMultiplier: number;
  readonly plumeRiseSeconds: number;
  readonly plumeLifetimeSeconds: number;
  readonly cloudScarRadiusMultiplier: number;
  readonly cloudScarGrowthSeconds: number;
  readonly cloudScarLifetimeSeconds: number;
  readonly cloudScarAdvectionRateRadPerSecond: number;
  readonly dustLifetimeMultiplier: number;
}

export const IMPACT_VISUAL_TUNING_PROFILES: Readonly<
  Record<string, Readonly<ImpactVisualTuningProfile>>
> = Object.freeze({
  'mercury-airless-rocky-v1': tuning({
    id: 'mercury-airless-rocky-v1',
    flashRadiusMultiplier: 0.9,
    flashDurationSeconds: 1.2,
    flashDecaySeconds: 0.28,
    craterDepthRatio: 0.18,
    craterFormationSeconds: 1.8,
    scorchRadiusMultiplier: 1.7,
    ejectaLaunchSpeedMultiplier: 1,
    ejectaLifetimeMultiplier: 1,
    groundShockwaveSpeedMultiplier: 0.9,
    groundShockwaveLifetimeSeconds: 10,
    atmosphericShockwaveSpeedMultiplier: 0,
    atmosphericShockwaveLifetimeSeconds: 0,
    plumeHeightMultiplier: 0.85,
    plumeRadiusMultiplier: 0.9,
    plumeRiseSeconds: 3.5,
    plumeLifetimeSeconds: 35,
    cloudScarRadiusMultiplier: 0,
    cloudScarGrowthSeconds: 0,
    cloudScarLifetimeSeconds: 0,
    cloudScarAdvectionRateRadPerSecond: 0,
    dustLifetimeMultiplier: 0.8,
  }),
  'venus-dense-atmosphere-rocky-v1': tuning({
    id: 'venus-dense-atmosphere-rocky-v1',
    flashRadiusMultiplier: 1.15,
    flashDurationSeconds: 1.7,
    flashDecaySeconds: 0.44,
    craterDepthRatio: 0.12,
    craterFormationSeconds: 2.3,
    scorchRadiusMultiplier: 2.1,
    ejectaLaunchSpeedMultiplier: 0.8,
    ejectaLifetimeMultiplier: 0.8,
    groundShockwaveSpeedMultiplier: 0.85,
    groundShockwaveLifetimeSeconds: 9,
    atmosphericShockwaveSpeedMultiplier: 1.25,
    atmosphericShockwaveLifetimeSeconds: 18,
    plumeHeightMultiplier: 1.15,
    plumeRadiusMultiplier: 1.35,
    plumeRiseSeconds: 7,
    plumeLifetimeSeconds: 75,
    cloudScarRadiusMultiplier: 1.8,
    cloudScarGrowthSeconds: 8,
    cloudScarLifetimeSeconds: 95,
    cloudScarAdvectionRateRadPerSecond: -0.000_002,
    dustLifetimeMultiplier: 1.2,
  }),
  'earth-dense-atmosphere-rocky-v1': tuning({
    id: 'earth-dense-atmosphere-rocky-v1',
    flashRadiusMultiplier: 1,
    flashDurationSeconds: 1.5,
    flashDecaySeconds: 0.38,
    craterDepthRatio: 0.14,
    craterFormationSeconds: 2,
    scorchRadiusMultiplier: 1.8,
    ejectaLaunchSpeedMultiplier: 1,
    ejectaLifetimeMultiplier: 1,
    groundShockwaveSpeedMultiplier: 1,
    groundShockwaveLifetimeSeconds: 11,
    atmosphericShockwaveSpeedMultiplier: 1,
    atmosphericShockwaveLifetimeSeconds: 15,
    plumeHeightMultiplier: 1,
    plumeRadiusMultiplier: 1,
    plumeRiseSeconds: 5,
    plumeLifetimeSeconds: 60,
    cloudScarRadiusMultiplier: 0,
    cloudScarGrowthSeconds: 0,
    cloudScarLifetimeSeconds: 0,
    cloudScarAdvectionRateRadPerSecond: 0,
    dustLifetimeMultiplier: 1,
  }),
  'moon-airless-rocky-v1': tuning({
    id: 'moon-airless-rocky-v1',
    flashRadiusMultiplier: 0.95,
    flashDurationSeconds: 1.35,
    flashDecaySeconds: 0.32,
    craterDepthRatio: 0.2,
    craterFormationSeconds: 2.2,
    scorchRadiusMultiplier: 1.6,
    ejectaLaunchSpeedMultiplier: 1.1,
    ejectaLifetimeMultiplier: 1.1,
    groundShockwaveSpeedMultiplier: 0.75,
    groundShockwaveLifetimeSeconds: 13,
    atmosphericShockwaveSpeedMultiplier: 0,
    atmosphericShockwaveLifetimeSeconds: 0,
    plumeHeightMultiplier: 1.05,
    plumeRadiusMultiplier: 0.9,
    plumeRiseSeconds: 5,
    plumeLifetimeSeconds: 50,
    cloudScarRadiusMultiplier: 0,
    cloudScarGrowthSeconds: 0,
    cloudScarLifetimeSeconds: 0,
    cloudScarAdvectionRateRadPerSecond: 0,
    dustLifetimeMultiplier: 1,
  }),
  'mars-thin-atmosphere-rocky-v1': tuning({
    id: 'mars-thin-atmosphere-rocky-v1',
    flashRadiusMultiplier: 0.9,
    flashDurationSeconds: 1.4,
    flashDecaySeconds: 0.34,
    craterDepthRatio: 0.17,
    craterFormationSeconds: 2.1,
    scorchRadiusMultiplier: 2.2,
    ejectaLaunchSpeedMultiplier: 1.1,
    ejectaLifetimeMultiplier: 1.1,
    groundShockwaveSpeedMultiplier: 0.8,
    groundShockwaveLifetimeSeconds: 12,
    atmosphericShockwaveSpeedMultiplier: 0.55,
    atmosphericShockwaveLifetimeSeconds: 11,
    plumeHeightMultiplier: 1.25,
    plumeRadiusMultiplier: 1.55,
    plumeRiseSeconds: 6,
    plumeLifetimeSeconds: 80,
    cloudScarRadiusMultiplier: 0,
    cloudScarGrowthSeconds: 0,
    cloudScarLifetimeSeconds: 0,
    cloudScarAdvectionRateRadPerSecond: 0,
    dustLifetimeMultiplier: 1.35,
  }),
  'jupiter-gas-giant-v1': tuning({
    id: 'jupiter-gas-giant-v1',
    flashRadiusMultiplier: 1.45,
    flashDurationSeconds: 1.9,
    flashDecaySeconds: 0.5,
    craterDepthRatio: 0,
    craterFormationSeconds: 0,
    scorchRadiusMultiplier: 0,
    ejectaLaunchSpeedMultiplier: 0,
    ejectaLifetimeMultiplier: 0,
    groundShockwaveSpeedMultiplier: 0,
    groundShockwaveLifetimeSeconds: 0,
    atmosphericShockwaveSpeedMultiplier: 1.45,
    atmosphericShockwaveLifetimeSeconds: 20,
    plumeHeightMultiplier: 1.8,
    plumeRadiusMultiplier: 2.1,
    plumeRiseSeconds: 8,
    plumeLifetimeSeconds: 90,
    cloudScarRadiusMultiplier: 2.6,
    cloudScarGrowthSeconds: 10,
    cloudScarLifetimeSeconds: 120,
    cloudScarAdvectionRateRadPerSecond: 0.000_15,
    dustLifetimeMultiplier: 1.1,
  }),
  'saturn-gas-giant-v1': tuning({
    id: 'saturn-gas-giant-v1',
    flashRadiusMultiplier: 1.35,
    flashDurationSeconds: 1.8,
    flashDecaySeconds: 0.48,
    craterDepthRatio: 0,
    craterFormationSeconds: 0,
    scorchRadiusMultiplier: 0,
    ejectaLaunchSpeedMultiplier: 0,
    ejectaLifetimeMultiplier: 0,
    groundShockwaveSpeedMultiplier: 0,
    groundShockwaveLifetimeSeconds: 0,
    atmosphericShockwaveSpeedMultiplier: 1.3,
    atmosphericShockwaveLifetimeSeconds: 20,
    plumeHeightMultiplier: 1.65,
    plumeRadiusMultiplier: 2,
    plumeRiseSeconds: 9,
    plumeLifetimeSeconds: 90,
    cloudScarRadiusMultiplier: 2.4,
    cloudScarGrowthSeconds: 11,
    cloudScarLifetimeSeconds: 120,
    cloudScarAdvectionRateRadPerSecond: 0.000_12,
    dustLifetimeMultiplier: 1.1,
  }),
  'uranus-ice-giant-v1': tuning({
    id: 'uranus-ice-giant-v1',
    flashRadiusMultiplier: 1.2,
    flashDurationSeconds: 1.7,
    flashDecaySeconds: 0.46,
    craterDepthRatio: 0,
    craterFormationSeconds: 0,
    scorchRadiusMultiplier: 0,
    ejectaLaunchSpeedMultiplier: 0,
    ejectaLifetimeMultiplier: 0,
    groundShockwaveSpeedMultiplier: 0,
    groundShockwaveLifetimeSeconds: 0,
    atmosphericShockwaveSpeedMultiplier: 1.15,
    atmosphericShockwaveLifetimeSeconds: 18,
    plumeHeightMultiplier: 1.5,
    plumeRadiusMultiplier: 1.8,
    plumeRiseSeconds: 8,
    plumeLifetimeSeconds: 85,
    cloudScarRadiusMultiplier: 2.1,
    cloudScarGrowthSeconds: 10,
    cloudScarLifetimeSeconds: 105,
    cloudScarAdvectionRateRadPerSecond: 0.000_05,
    dustLifetimeMultiplier: 1,
  }),
  'neptune-ice-giant-v1': tuning({
    id: 'neptune-ice-giant-v1',
    flashRadiusMultiplier: 1.25,
    flashDurationSeconds: 1.75,
    flashDecaySeconds: 0.47,
    craterDepthRatio: 0,
    craterFormationSeconds: 0,
    scorchRadiusMultiplier: 0,
    ejectaLaunchSpeedMultiplier: 0,
    ejectaLifetimeMultiplier: 0,
    groundShockwaveSpeedMultiplier: 0,
    groundShockwaveLifetimeSeconds: 0,
    atmosphericShockwaveSpeedMultiplier: 1.25,
    atmosphericShockwaveLifetimeSeconds: 19,
    plumeHeightMultiplier: 1.6,
    plumeRadiusMultiplier: 1.9,
    plumeRiseSeconds: 8,
    plumeLifetimeSeconds: 88,
    cloudScarRadiusMultiplier: 2.25,
    cloudScarGrowthSeconds: 10,
    cloudScarLifetimeSeconds: 110,
    cloudScarAdvectionRateRadPerSecond: 0.000_08,
    dustLifetimeMultiplier: 1.05,
  }),
});

export function getImpactVisualTuningProfile(
  profileId: string,
): Readonly<ImpactVisualTuningProfile> {
  const profile = IMPACT_VISUAL_TUNING_PROFILES[profileId];
  if (profile === undefined) {
    throw new Error(`Missing impact visual tuning profile "${profileId}".`);
  }
  return profile;
}

function tuning(
  value: ImpactVisualTuningProfile,
): Readonly<ImpactVisualTuningProfile> {
  return Object.freeze(value);
}
