import type {
  BlackHoleEncounterParameters,
  CompleteConsumptionParameters,
} from './BlackHoleTypes';

export function serializeBlackHoleEncounterParameters(
  parameters: Readonly<BlackHoleEncounterParameters | CompleteConsumptionParameters>,
): string {
  const cinematic = 'infall' in parameters;
  return JSON.stringify({
    initialState: {
      bodyIds: parameters.initialState.bodyIds,
      positionsM: [...parameters.initialState.positionsM],
      velocitiesMps: [...parameters.initialState.velocitiesMps],
      massesKg: [...parameters.initialState.massesKg],
      radiiM: [...parameters.initialState.radiiM],
    },
    blackHole: {
      massSolarMasses: parameters.blackHole.massSolarMasses,
      initialPositionM: parameters.blackHole.initialPositionM,
      initialVelocityMps: parameters.blackHole.initialVelocityMps,
      closestApproachTargetM: parameters.blackHole.closestApproachTargetM,
      closestApproachTimeSeconds:
        parameters.blackHole.closestApproachTimeSeconds,
      spinVisualization: parameters.blackHole.spinVisualization,
      accretionDiskEnabled: parameters.blackHole.accretionDiskEnabled,
      captureRadiusMultiple: parameters.blackHole.captureRadiusMultiple,
    },
    accuracy: parameters.accuracy,
    durationSeconds: parameters.durationSeconds,
    physicsSecondsPerScenarioSecond:
      parameters.physicsSecondsPerScenarioSecond,
    playbackRate: parameters.playbackRate,
    seed: parameters.seed,
    ejectionRadiusM: parameters.ejectionRadiusM,
    infall: cinematic
      ? {
          angularMomentumDampingPerPhysicalSecond:
            parameters.infall.angularMomentumDampingPerPhysicalSecond,
          inwardBiasMps2: parameters.infall.inwardBiasMps2,
          stagingStartSeconds: parameters.infall.stagingStartSeconds,
          stagingIntervalSeconds: parameters.infall.stagingIntervalSeconds,
        }
      : null,
  });
}
export function createBlackHoleRunSignature(
  mode: 'physics-flyby' | 'complete-consumption-cinematic',
  parameters: Readonly<BlackHoleEncounterParameters | CompleteConsumptionParameters>,
): string {
  const input = `black-hole-kdk-v1/${mode}/${serializeBlackHoleEncounterParameters(parameters)}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `bh-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
