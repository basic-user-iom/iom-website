import {
  getObservatoryBodyDefinition,
} from '../simulation/bodies/ObservatoryBodyCatalog';
import type { SimulationContext } from '../simulation/core/SimulationContext';
import {
  BLACK_HOLE_SCENARIO_BODY_IDS,
  createBlackHoleCapturedInitialState,
  type BlackHoleCapturedInitialState,
} from '../simulation/scenarios/black-hole';

/**
 * Copies the ephemeris-authoritative Sun, Moon, and major-planet vectors at the
 * exact scenario hand-off boundary. The worker owns the returned Float64
 * arrays; normal observatory runtime bodies remain untouched for pristine
 * reset. Comets are deliberately excluded because their pinned catalog does
 * not fabricate unknown masses.
 */
export function captureBlackHoleInitialState(
  context: SimulationContext,
): BlackHoleCapturedInitialState {
  const bodyCount = BLACK_HOLE_SCENARIO_BODY_IDS.length;
  const positionsM = new Float64Array(bodyCount * 3);
  const velocitiesMps = new Float64Array(bodyCount * 3);
  const massesKg = new Float64Array(bodyCount);
  const radiiM = new Float64Array(bodyCount);

  for (let index = 0; index < bodyCount; index += 1) {
    const bodyId = BLACK_HOLE_SCENARIO_BODY_IDS[index];
    if (bodyId === undefined) continue;
    const runtimeBody = context.getBody(bodyId);
    const definition = getObservatoryBodyDefinition(bodyId);
    if (runtimeBody === undefined || definition === undefined) {
      throw new Error(`Black-hole encounter body "${bodyId}" is unavailable.`);
    }
    if (definition.massKg === null || definition.meanRadiusM === null) {
      throw new Error(`Black-hole encounter body "${bodyId}" lacks mass or radius data.`);
    }

    const offset = index * 3;
    positionsM[offset] = runtimeBody.positionM.x;
    positionsM[offset + 1] = runtimeBody.positionM.y;
    positionsM[offset + 2] = runtimeBody.positionM.z;
    velocitiesMps[offset] = runtimeBody.velocityMps.x;
    velocitiesMps[offset + 1] = runtimeBody.velocityMps.y;
    velocitiesMps[offset + 2] = runtimeBody.velocityMps.z;
    massesKg[index] = definition.massKg;
    radiiM[index] = definition.meanRadiusM;
  }

  return createBlackHoleCapturedInitialState({
    bodyIds: BLACK_HOLE_SCENARIO_BODY_IDS,
    positionsM,
    velocitiesMps,
    massesKg,
    radiiM,
  });
}

/** A validation-complete seed used only before the ephemeris bundle is ready. */
export function createPlaceholderBlackHoleInitialState(): BlackHoleCapturedInitialState {
  const bodyCount = BLACK_HOLE_SCENARIO_BODY_IDS.length;
  const massesKg = new Float64Array(bodyCount);
  const radiiM = new Float64Array(bodyCount);
  for (let index = 0; index < bodyCount; index += 1) {
    const bodyId = BLACK_HOLE_SCENARIO_BODY_IDS[index];
    if (bodyId === undefined) continue;
    const definition = getObservatoryBodyDefinition(bodyId);
    if (definition === undefined) {
      throw new Error(`Black-hole encounter definition "${bodyId}" is unavailable.`);
    }
    if (definition.massKg === null || definition.meanRadiusM === null) {
      throw new Error(`Black-hole encounter definition "${bodyId}" lacks mass or radius data.`);
    }
    massesKg[index] = definition.massKg;
    radiiM[index] = definition.meanRadiusM;
  }
  return createBlackHoleCapturedInitialState({
    bodyIds: BLACK_HOLE_SCENARIO_BODY_IDS,
    positionsM: new Float64Array(bodyCount * 3),
    velocitiesMps: new Float64Array(bodyCount * 3),
    massesKg,
    radiiM,
  });
}
