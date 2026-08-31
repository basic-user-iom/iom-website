import {
  COMET_BODY_DEFINITIONS,
  COMET_BODY_IDS,
  type CometBodyDefinition,
  type CometBodyId,
} from './CometBodyCatalog';
import {
  EPHEMERIS_BODY_DEFINITIONS,
  EPHEMERIS_BODY_IDS,
  createEphemerisBodyRuntimeStates,
  type EphemerisBodyId,
} from './EphemerisBodyCatalog';
import { createVec3d } from '../core/Vec3d';
import type { BodyDefinition } from './BodyDefinition';
import type { BodyRuntimeState } from './BodyRuntimeState';

export const OBSERVATORY_BODY_IDS = Object.freeze([
  ...EPHEMERIS_BODY_IDS,
  ...COMET_BODY_IDS,
] as const);

export type ObservatoryBodyId = EphemerisBodyId | CometBodyId;
export type ObservatoryBodyDefinition = BodyDefinition | CometBodyDefinition;

export const OBSERVATORY_BODY_DEFINITIONS: readonly Readonly<ObservatoryBodyDefinition>[] =
  Object.freeze([
    ...EPHEMERIS_BODY_DEFINITIONS,
    ...COMET_BODY_DEFINITIONS,
  ]);

export function isObservatoryBodyId(bodyId: string): bodyId is ObservatoryBodyId {
  return OBSERVATORY_BODY_IDS.includes(bodyId as ObservatoryBodyId);
}

export function getObservatoryBodyDefinition(
  bodyId: string,
): Readonly<ObservatoryBodyDefinition> | undefined {
  return OBSERVATORY_BODY_DEFINITIONS.find((definition) => definition.id === bodyId);
}

export function createObservatoryBodyRuntimeStates(jdTdb: number): Map<string, BodyRuntimeState> {
  if (!Number.isFinite(jdTdb)) {
    throw new RangeError('Observatory runtime epoch must be finite JD TDB.');
  }
  const states = createEphemerisBodyRuntimeStates(jdTdb);
  for (const bodyId of COMET_BODY_IDS) {
    states.set(bodyId, {
      bodyId,
      jdTdb,
      positionM: createVec3d(),
      velocityMps: createVec3d(),
      orientation: [0, 0, 0, 1],
      visible: true,
    });
  }
  return states;
}
