import type { SimulationUiSnapshot } from '../../state/useAppStore';
import {
  MAX_LOG_TIME_SCALE,
  MIN_LOG_TIME_SCALE,
  TIME_PRESETS,
  type TimePreset,
} from '../../simulation/core/TimePresets';
import {
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_JULIAN_YEAR,
  SECONDS_PER_MEAN_MONTH,
} from '../../simulation/core/Units';

export const LOG_SPEED_MIN = MIN_LOG_TIME_SCALE;
export const LOG_SPEED_MAX = MAX_LOG_TIME_SCALE;
export const PHASE_ONE_TIME_PRESETS = TIME_PRESETS;
export type TimePresetView = TimePreset;

export function findMatchingPreset(snapshot: Readonly<SimulationUiSnapshot>): string {
  const matching = PHASE_ONE_TIME_PRESETS.find(
    (preset) =>
      preset.paused === snapshot.paused &&
      (preset.paused ||
        (preset.direction === snapshot.direction &&
          approximatelyEqual(preset.timeScale, snapshot.timeScale))),
  );
  return matching?.id ?? 'custom';
}

export function formatTimeScale(secondsPerSecond: number): string {
  if (!Number.isFinite(secondsPerSecond) || secondsPerSecond <= 0) {
    return 'invalid speed';
  }
  if (approximatelyEqual(secondsPerSecond, 1)) {
    return 'real time · 1×';
  }
  if (secondsPerSecond < SECONDS_PER_HOUR) {
    return `${formatNumber(secondsPerSecond)}×`;
  }
  if (secondsPerSecond < SECONDS_PER_DAY) {
    return `${formatNumber(secondsPerSecond / SECONDS_PER_HOUR)} hours / second`;
  }
  if (secondsPerSecond < SECONDS_PER_MEAN_MONTH) {
    return `${formatNumber(secondsPerSecond / SECONDS_PER_DAY)} days / second`;
  }
  if (secondsPerSecond < SECONDS_PER_JULIAN_YEAR) {
    return `${formatNumber(secondsPerSecond / SECONDS_PER_MEAN_MONTH)} months / second`;
  }
  return `${formatNumber(secondsPerSecond / SECONDS_PER_JULIAN_YEAR)} years / second`;
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Math.max(1, Math.abs(left), Math.abs(right)) * 1e-9;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: value < 10 ? 2 : 1,
  }).format(value);
}
