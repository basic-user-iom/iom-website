export const METERS_PER_KILOMETER = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
export const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
export const DAYS_PER_JULIAN_YEAR = 365.25;
export const DAYS_PER_MEAN_MONTH = DAYS_PER_JULIAN_YEAR / 12;
export const SECONDS_PER_JULIAN_YEAR = DAYS_PER_JULIAN_YEAR * SECONDS_PER_DAY;
export const SECONDS_PER_MEAN_MONTH = DAYS_PER_MEAN_MONTH * SECONDS_PER_DAY;

/** Exact conventional length adopted by IAU 2012 Resolution B2. */
export const ASTRONOMICAL_UNIT_M = 149_597_870_700;

/** CODATA/Newtonian constants used only as typed foundations in Phase 1. */
export const GRAVITATIONAL_CONSTANT_M3_KG_S2 = 6.674_30e-11;
export const SPEED_OF_LIGHT_MPS = 299_792_458;

export function kilometersToMeters(kilometers: number): number {
  return kilometers * METERS_PER_KILOMETER;
}
export function metersToKilometers(meters: number): number {
  return meters / METERS_PER_KILOMETER;
}

export function daysToSeconds(days: number): number {
  return days * SECONDS_PER_DAY;
}

export function secondsToDays(seconds: number): number {
  return seconds / SECONDS_PER_DAY;
}
