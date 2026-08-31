import {
  ConstantRateRotationModel,
  SynchronousRotationModel,
  type RotationModel,
} from './RotationModel';
import {
  EPHEMERIS_BODY_DEFINITIONS,
  type EphemerisBodyId,
} from './EphemerisBodyCatalog';

const models = new Map<EphemerisBodyId, RotationModel>();
for (const definition of EPHEMERIS_BODY_DEFINITIONS) {
  const bodyId = definition.id as EphemerisBodyId;
  models.set(
    bodyId,
    bodyId === 'moon'
      ? new SynchronousRotationModel({
          bodyId,
          parentBodyId: 'earth',
          nominalRotationPeriodSeconds: definition.rotationPeriodSeconds,
        })
      : new ConstantRateRotationModel({
          bodyId,
          rotationPeriodSeconds: definition.rotationPeriodSeconds,
          retrograde: definition.retrogradeRotation,
          axialTiltRad: definition.axialTiltRad,
        }),
  );
}

/** Seed models only; generated authoritative pole/prime-meridian data remains pending. */
export const EPHEMERIS_ROTATION_MODELS: ReadonlyMap<EphemerisBodyId, RotationModel> =
  models;

export function getEphemerisRotationModel(bodyId: EphemerisBodyId): RotationModel {
  const model = models.get(bodyId);
  if (model === undefined) {
    throw new RangeError(`No rotation model is registered for "${bodyId}".`);
  }
  return model;
}
