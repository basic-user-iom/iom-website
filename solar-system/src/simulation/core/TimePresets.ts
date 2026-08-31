import {
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_JULIAN_YEAR,
  SECONDS_PER_MEAN_MONTH,
} from './Units';

export type SimulationDirection = -1 | 1;

export interface TimePreset {
  readonly id: string;
  readonly label: string;
  readonly paused: boolean;
  readonly direction: SimulationDirection;
  readonly timeScale: number;
}

export const MIN_TIME_SCALE = 1;
export const MAX_TIME_SCALE = SECONDS_PER_JULIAN_YEAR * 10;
export const MIN_LOG_TIME_SCALE = Math.log10(MIN_TIME_SCALE);
export const MAX_LOG_TIME_SCALE = Math.log10(MAX_TIME_SCALE);

const preset = (
  id: string,
  label: string,
  paused: boolean,
  direction: SimulationDirection,
  timeScale: number,
): Readonly<TimePreset> => Object.freeze({ id, label, paused, direction, timeScale });

export const TIME_PRESETS: readonly TimePreset[] = Object.freeze([
  preset('reverse-year', '-1 year / second', false, -1, SECONDS_PER_JULIAN_YEAR),
  preset('reverse-month', '-1 month / second', false, -1, SECONDS_PER_MEAN_MONTH),
  preset('reverse-day', '-1 day / second', false, -1, SECONDS_PER_DAY),
  preset('reverse-hour', '-1 hour / second', false, -1, SECONDS_PER_HOUR),
  preset('reverse-realtime', 'Real time reverse', false, -1, 1),
  preset('pause', 'Pause', true, 1, 1),
  preset('realtime', 'Real time', false, 1, 1),
  preset('forward-60', '60x', false, 1, 60),
  preset('forward-hour', '1 hour / second', false, 1, SECONDS_PER_HOUR),
  preset('forward-day', '1 day / second', false, 1, SECONDS_PER_DAY),
  preset('forward-week', '1 week / second', false, 1, SECONDS_PER_DAY * 7),
  preset('forward-month', '1 month / second', false, 1, SECONDS_PER_MEAN_MONTH),
  preset('forward-year', '1 year / second', false, 1, SECONDS_PER_JULIAN_YEAR),
  preset('forward-decade', '10 years / second', false, 1, MAX_TIME_SCALE),
]);

export const findTimePreset = (id: string): TimePreset | undefined =>
  TIME_PRESETS.find((candidate) => candidate.id === id);

export function clampTimeScale(timeScale: number): number {
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new RangeError('Time scale must be a finite positive number.');
  }
  return Math.min(Math.max(timeScale, MIN_TIME_SCALE), MAX_TIME_SCALE);
}

export const timeScaleToLogValue = (timeScale: number): number =>
  Math.log10(clampTimeScale(timeScale));

export function logValueToTimeScale(logValue: number): number {
  if (!Number.isFinite(logValue)) {
    throw new RangeError('Logarithmic time value must be finite.');
  }
  const bounded = Math.min(Math.max(logValue, MIN_LOG_TIME_SCALE), MAX_LOG_TIME_SCALE);
  return clampTimeScale(10 ** bounded);
}
