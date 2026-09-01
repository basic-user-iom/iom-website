import type { Vec3d } from '../../simulation/core/Vec3d';

export const CAMERA_CLOSE_UP_PRESET_IDS = [
  'jupiter-great-red-spot',
  'saturn-rings',
] as const;

export type CameraCloseUpPresetId = (typeof CAMERA_CLOSE_UP_PRESET_IDS)[number];

export interface CameraCloseUpPreset {
  readonly id: CameraCloseUpPresetId;
  readonly bodyId: 'jupiter' | 'saturn';
  readonly label: string;
  readonly description: string;
  /** Camera distance from body center, in rendered equatorial radii. */
  readonly distanceRadiusMultiplier: number;
  /** Visual-sphere-local unit vector (+Y north) from body center toward the camera. */
  readonly cameraDirectionVisualLocal: Readonly<Vec3d>;
  /** Visual-sphere-local direction (+Y north) that should appear upright. */
  readonly upDirectionVisualLocal: Readonly<Vec3d>;
}

export const JUPITER_GREAT_RED_SPOT_VISUAL_LATITUDE_DEG = -22;
export const JUPITER_GREAT_RED_SPOT_VISUAL_LONGITUDE_DEG = 0;
export const SATURN_RING_PRESET_VISUAL_LATITUDE_DEG = 20;

export const CAMERA_CLOSE_UP_PRESETS: readonly Readonly<CameraCloseUpPreset>[] =
  Object.freeze([
    Object.freeze({
      id: 'jupiter-great-red-spot',
      bodyId: 'jupiter',
      label: 'Jupiter · Great Red Spot',
      description: 'Track the body-fixed Great Red Spot from a close equatorial view.',
      distanceRadiusMultiplier: 2.8,
      cameraDirectionVisualLocal: visualLocalSurfaceDirection(
        JUPITER_GREAT_RED_SPOT_VISUAL_LATITUDE_DEG,
        JUPITER_GREAT_RED_SPOT_VISUAL_LONGITUDE_DEG,
      ),
      upDirectionVisualLocal: frozenDirection(0, 1, 0),
    }),
    Object.freeze({
      id: 'saturn-rings',
      bodyId: 'saturn',
      label: 'Saturn · rings',
      description: 'Frame the complete rings at 20° latitude so Saturn’s physical oblateness remains visible.',
      distanceRadiusMultiplier: 6.2,
      cameraDirectionVisualLocal: visualLocalSurfaceDirection(
        SATURN_RING_PRESET_VISUAL_LATITUDE_DEG,
        90,
      ),
      upDirectionVisualLocal: frozenDirection(0, 1, 0),
    }),
  ]);

export function getCameraCloseUpPreset(
  presetId: CameraCloseUpPresetId,
): Readonly<CameraCloseUpPreset> {
  const preset = CAMERA_CLOSE_UP_PRESETS.find((candidate) => candidate.id === presetId);
  if (preset === undefined) {
    throw new RangeError(`Unsupported close-up camera preset "${String(presetId)}".`);
  }
  return preset;
}

function visualLocalSurfaceDirection(
  latitudeDeg: number,
  longitudeDeg: number,
): Readonly<Vec3d> {
  const latitudeRad = latitudeDeg * Math.PI / 180;
  const longitudeRad = longitudeDeg * Math.PI / 180;
  const cosLatitude = Math.cos(latitudeRad);
  return frozenDirection(
    cosLatitude * Math.cos(longitudeRad),
    Math.sin(latitudeRad),
    cosLatitude * Math.sin(longitudeRad),
  );
}

function frozenDirection(x: number, y: number, z: number): Readonly<Vec3d> {
  return Object.freeze({ x, y, z });
}
