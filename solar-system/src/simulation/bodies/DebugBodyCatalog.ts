import { ASTRONOMICAL_UNIT_M, SECONDS_PER_DAY } from '../core/Units';
import { createVec3d } from '../core/Vec3d';
import type { BodyDefinition } from './BodyDefinition';
import type { BodyRuntimeState } from './BodyRuntimeState';
import type { DataProvenance } from './DataProvenance';

const DEBUG_PROVENANCE: DataProvenance = Object.freeze({
  provider: 'GENERATED',
  sourceName: 'Phase 1 fixed Sun/Earth architecture fixture',
  centerId: 'debug-sun-origin',
  referenceFrame: 'arbitrary Phase 1 Cartesian debug frame',
  referencePlane: 'none',
  timeScale: 'approximate TDB field',
  units: 'SI (m, m/s, kg, s)',
  retrievedAtIso: '2026-08-28T00:00:00.000Z',
  generatorVersion: 'phase-1.0.0',
  notes: Object.freeze([
    'Not an ephemeris or observation.',
    'Earth is fixed at +X one astronomical unit from the Sun.',
    'Runtime velocities are deliberately zero.',
    'Physical-definition fields are provisional architecture seeds and are not used by Phase 1 physics.',
  ]),
});

export const DEBUG_BODY_DEFINITIONS: readonly BodyDefinition[] = Object.freeze([
  Object.freeze({
    id: 'sun',
    displayName: 'Sun (debug marker)',
    kind: 'star',
    massKg: 1.988_47e30,
    meanRadiusM: 695_700_000,
    rotationPeriodSeconds: 25.38 * SECONDS_PER_DAY,
    renderProfile: 'phase-1-debug-star-marker',
    provenance: Object.freeze([DEBUG_PROVENANCE]),
  }),
  Object.freeze({
    id: 'earth',
    displayName: 'Earth (fixed debug marker)',
    kind: 'planet',
    parentId: 'sun',
    massKg: 5.972_17e24,
    meanRadiusM: 6_371_008.4,
    rotationPeriodSeconds: 0.997_269_68 * SECONDS_PER_DAY,
    axialTiltRad: (23.439_281 * Math.PI) / 180,
    renderProfile: 'phase-1-debug-planet-marker',
    provenance: Object.freeze([DEBUG_PROVENANCE]),
  }),
]);

export function createDebugBodyRuntimeStates(jdTdb: number): Map<string, BodyRuntimeState> {
  if (!Number.isFinite(jdTdb)) {
    throw new RangeError('Debug fixture Julian Date must be finite.');
  }
  return new Map<string, BodyRuntimeState>([
    [
      'sun',
      {
        bodyId: 'sun',
        jdTdb,
        positionM: createVec3d(0, 0, 0),
        velocityMps: createVec3d(0, 0, 0),
        orientation: [0, 0, 0, 1],
        visible: true,
      },
    ],
    [
      'earth',
      {
        bodyId: 'earth',
        jdTdb,
        positionM: createVec3d(ASTRONOMICAL_UNIT_M, 0, 0),
        velocityMps: createVec3d(0, 0, 0),
        orientation: [0, 0, 0, 1],
        visible: true,
      },
    ],
  ]);
}

export function getDebugBodyDefinition(bodyId: string): BodyDefinition | undefined {
  return DEBUG_BODY_DEFINITIONS.find((definition) => definition.id === bodyId);
}
