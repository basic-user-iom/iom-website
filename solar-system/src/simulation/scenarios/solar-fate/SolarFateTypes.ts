export const SOLAR_FATE_FIXED_STEP_SECONDS = 1 / 120;

export const SOLAR_FATE_PLANET_IDS = [
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;

export type SolarFatePlanetId = (typeof SOLAR_FATE_PLANET_IDS)[number];

export const SOLAR_FATE_CAMERA_MODES = [
  'solar-closeup',
  'inner-system',
  'system-overview',
] as const;

export type SolarFateCameraMode = (typeof SOLAR_FATE_CAMERA_MODES)[number];

export const SOLAR_FATE_PLAYBACK_RATE_LIMITS = Object.freeze({
  minimum: 0.05,
  maximum: 4,
});

export function validateSolarFatePlaybackRate(playbackRate: number): number {
  if (
    !Number.isFinite(playbackRate) ||
    playbackRate < SOLAR_FATE_PLAYBACK_RATE_LIMITS.minimum ||
    playbackRate > SOLAR_FATE_PLAYBACK_RATE_LIMITS.maximum
  ) {
    throw new RangeError(
      `Solar Fate playback rate must be between ${SOLAR_FATE_PLAYBACK_RATE_LIMITS.minimum} and ${SOLAR_FATE_PLAYBACK_RATE_LIMITS.maximum}.`,
    );
  }
  return playbackRate;
}

export function validateSolarFateSeed(seed: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('Solar Fate seed must be an unsigned 32-bit integer.');
  }
  return seed >>> 0;
}

export function validateSolarFateCameraMode(
  cameraMode: SolarFateCameraMode,
): SolarFateCameraMode {
  if (!SOLAR_FATE_CAMERA_MODES.includes(cameraMode)) {
    throw new RangeError(`Unknown Solar Fate camera mode "${String(cameraMode)}".`);
  }
  return cameraMode;
}
