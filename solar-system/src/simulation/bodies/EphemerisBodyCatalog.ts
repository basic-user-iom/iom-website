import { kilometersToMeters, SECONDS_PER_DAY } from '../core/Units';
import { createVec3d } from '../core/Vec3d';
import type { BodyDefinition } from './BodyDefinition';
import type { BodyRuntimeState } from './BodyRuntimeState';
import type { DataProvenance } from './DataProvenance';

export const EPHEMERIS_BODY_IDS = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;

export type EphemerisBodyId = (typeof EPHEMERIS_BODY_IDS)[number];

const PHYSICAL_SEED_PROVENANCE: DataProvenance = Object.freeze({
  provider: 'GENERATED',
  sourceName: 'Master build specification broad physical seed catalog',
  units: 'SI (kg, m, s, rad)',
  retrievedAtIso: '2026-08-28T00:00:00.000Z',
  generatorVersion: 'phase-2.0.0',
  notes: Object.freeze([
    'Planetary seed values are copied from the user-supplied build specification.',
    'Sun and Moon values remain provisional catalog seeds until the orientation/physical catalog phase.',
    'These values do not provide runtime positions; generated Horizons vectors are authoritative for translation.',
  ]),
});

const DEFINITION_PROVENANCE = Object.freeze([PHYSICAL_SEED_PROVENANCE]);

export const EPHEMERIS_BODY_DEFINITIONS: readonly BodyDefinition[] = Object.freeze([
  body({
    id: 'sun',
    displayName: 'Sun',
    kind: 'star',
    massKg: 1.988_47e30,
    meanRadiusKm: 695_700,
    rotationDays: 25.38,
  }),
  body({
    id: 'mercury',
    displayName: 'Mercury',
    kind: 'planet',
    parentId: 'sun',
    massKg: 0.330_103e24,
    meanRadiusKm: 2_439.4,
    rotationDays: 58.6462,
  }),
  body({
    id: 'venus',
    displayName: 'Venus',
    kind: 'planet',
    parentId: 'sun',
    massKg: 4.867_31e24,
    meanRadiusKm: 6_051.8,
    rotationDays: 243.018,
    retrogradeRotation: true,
  }),
  body({
    id: 'earth',
    displayName: 'Earth',
    kind: 'planet',
    parentId: 'sun',
    massKg: 5.972_17e24,
    meanRadiusKm: 6_371.0084,
    rotationDays: 0.997_269_68,
    axialTiltRad: degreesToRadians(23.439_281),
  }),
  body({
    id: 'moon',
    displayName: 'Moon',
    kind: 'moon',
    parentId: 'earth',
    massKg: 7.346e22,
    meanRadiusKm: 1_737.4,
    rotationDays: 27.321_661,
  }),
  body({
    id: 'mars',
    displayName: 'Mars',
    kind: 'planet',
    parentId: 'sun',
    massKg: 0.641_691e24,
    meanRadiusKm: 3_389.5,
    rotationDays: 1.025_956_76,
  }),
  body({
    id: 'jupiter',
    displayName: 'Jupiter',
    kind: 'planet',
    parentId: 'sun',
    massKg: 1_898.125e24,
    meanRadiusKm: 69_911,
    rotationDays: 0.413_54,
    axialTiltRad: degreesToRadians(3.13),
  }),
  body({
    id: 'saturn',
    displayName: 'Saturn',
    kind: 'planet',
    parentId: 'sun',
    massKg: 568.317e24,
    meanRadiusKm: 58_232,
    rotationDays: 0.444_01,
    axialTiltRad: degreesToRadians(26.73),
  }),
  body({
    id: 'uranus',
    displayName: 'Uranus',
    kind: 'planet',
    parentId: 'sun',
    massKg: 86.8099e24,
    meanRadiusKm: 25_362,
    rotationDays: 0.718_33,
    // The >90 degree pole convention already expresses retrograde rotation.
    // Setting the separate direction flag as well would reverse Uranus twice.
    axialTiltRad: degreesToRadians(97.77),
  }),
  body({
    id: 'neptune',
    displayName: 'Neptune',
    kind: 'planet',
    parentId: 'sun',
    massKg: 102.4092e24,
    meanRadiusKm: 24_622,
    rotationDays: 0.671_25,
    axialTiltRad: degreesToRadians(28.32),
  }),
]);

export function createEphemerisBodyRuntimeStates(
  jdTdb: number,
): Map<string, BodyRuntimeState> {
  if (!Number.isFinite(jdTdb)) {
    throw new RangeError('Ephemeris fixture Julian Date must be finite.');
  }

  return new Map(
    EPHEMERIS_BODY_IDS.map((bodyId) => [
      bodyId,
      {
        bodyId,
        jdTdb,
        positionM: createVec3d(),
        velocityMps: createVec3d(),
        orientation: [0, 0, 0, 1] as const,
        visible: true,
      },
    ]),
  );
}

interface BodySeed {
  readonly id: EphemerisBodyId;
  readonly displayName: string;
  readonly kind: 'star' | 'planet' | 'moon';
  readonly parentId?: EphemerisBodyId;
  readonly massKg: number;
  readonly meanRadiusKm: number;
  readonly rotationDays: number;
  readonly retrogradeRotation?: boolean;
  readonly axialTiltRad?: number;
}

function body(seed: BodySeed): Readonly<BodyDefinition> {
  return Object.freeze({
    id: seed.id,
    displayName: seed.displayName,
    kind: seed.kind,
    parentId: seed.parentId,
    massKg: seed.massKg,
    meanRadiusM: kilometersToMeters(seed.meanRadiusKm),
    rotationPeriodSeconds: seed.rotationDays * SECONDS_PER_DAY,
    retrogradeRotation: seed.retrogradeRotation,
    axialTiltRad: seed.axialTiltRad,
    renderProfile: 'phase-2-ephemeris-debug-marker',
    provenance: DEFINITION_PROVENANCE,
  });
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
