import { SECONDS_PER_DAY } from './Units';

export const UNIX_EPOCH_JD_UTC = 2_440_587.5;
export const J2000_JD_TDB = 2_451_545;

/**
 * Phase 1 convenience only. A real leap-second table replaces this in the
 * scientific data phase; 37 seconds is not valid across all historical/future dates.
 */
export const APPROXIMATE_TAI_MINUS_UTC_SECONDS = 37;
export const TT_MINUS_TAI_SECONDS = 32.184;

const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1_000;
const DEG_TO_RAD = Math.PI / 180;

export function dateUtcToJulianDateUtc(date: Date): number {
  const timeMs = date.getTime();
  if (!Number.isFinite(timeMs)) {
    throw new RangeError('UTC date must be valid.');
  }
  return timeMs / MILLISECONDS_PER_DAY + UNIX_EPOCH_JD_UTC;
}
export function julianDateUtcToDate(jdUtc: number): Date {
  assertFiniteJulianDate(jdUtc);
  const date = new Date((jdUtc - UNIX_EPOCH_JD_UTC) * MILLISECONDS_PER_DAY);
  if (!Number.isFinite(date.getTime())) {
    throw new RangeError('Julian Date is outside the JavaScript Date range.');
  }
  return date;
}

export function julianDateUtcToApproximateTdb(jdUtc: number): number {
  assertFiniteJulianDate(jdUtc);
  const ttMinusUtcSeconds = APPROXIMATE_TAI_MINUS_UTC_SECONDS + TT_MINUS_TAI_SECONDS;
  const jdTt = jdUtc + ttMinusUtcSeconds / SECONDS_PER_DAY;
  const meanAnomalyRad =
    (357.53 + 0.985_600_3 * (jdTt - J2000_JD_TDB)) * DEG_TO_RAD;
  const tdbMinusTtSeconds =
    0.001_657 * Math.sin(meanAnomalyRad) +
    0.000_022 * Math.sin(2 * meanAnomalyRad);
  return jdTt + tdbMinusTtSeconds / SECONDS_PER_DAY;
}

export function approximateTdbToJulianDateUtc(jdTdb: number): number {
  assertFiniteJulianDate(jdTdb);
  const fixedOffsetDays =
    (APPROXIMATE_TAI_MINUS_UTC_SECONDS + TT_MINUS_TAI_SECONDS) / SECONDS_PER_DAY;
  let estimate = jdTdb - fixedOffsetDays;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    estimate += jdTdb - julianDateUtcToApproximateTdb(estimate);
  }
  return estimate;
}

export function dateUtcToApproximateTdb(date: Date): number {
  return julianDateUtcToApproximateTdb(dateUtcToJulianDateUtc(date));
}

export function approximateTdbToDateUtc(jdTdb: number): Date {
  return julianDateUtcToDate(approximateTdbToJulianDateUtc(jdTdb));
}

export function formatApproximateTdbAsUtcIso(jdTdb: number): string {
  return approximateTdbToDateUtc(jdTdb).toISOString();
}

function assertFiniteJulianDate(value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError('Julian Date must be finite.');
  }
}
