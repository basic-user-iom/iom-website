import {
  APPROXIMATE_TAI_MINUS_UTC_SECONDS,
  J2000_JD_TDB,
  TT_MINUS_TAI_SECONDS,
  UNIX_EPOCH_JD_UTC,
  approximateTdbToDateUtc,
  approximateTdbToJulianDateUtc,
  dateUtcToApproximateTdb,
  dateUtcToJulianDateUtc,
  formatApproximateTdbAsUtcIso,
  julianDateUtcToApproximateTdb,
  julianDateUtcToDate,
} from '../../simulation/core/JulianDate';
import { SECONDS_PER_DAY } from '../../simulation/core/Units';

describe('JulianDate UTC conversions', () => {
  it('maps the Unix epoch to its exact Julian Date and back', () => {
    const unixEpoch = new Date('1970-01-01T00:00:00.000Z');

    expect(UNIX_EPOCH_JD_UTC).toBe(2_440_587.5);
    expect(dateUtcToJulianDateUtc(unixEpoch)).toBe(UNIX_EPOCH_JD_UTC);
    expect(julianDateUtcToDate(UNIX_EPOCH_JD_UTC).toISOString()).toBe(
      '1970-01-01T00:00:00.000Z',
    );
  });

  it('maps the J2000 civil instant to Julian Date 2451545.0', () => {
    const j2000Utc = new Date('2000-01-01T12:00:00.000Z');

    expect(J2000_JD_TDB).toBe(2_451_545);
    expect(dateUtcToJulianDateUtc(j2000Utc)).toBe(2_451_545);
    expect(julianDateUtcToDate(2_451_545).toISOString()).toBe(
      '2000-01-01T12:00:00.000Z',
    );
  });

  it.each([
    '1900-01-01T00:00:00.000Z',
    '1969-07-20T20:17:40.000Z',
    '2000-01-01T12:00:00.000Z',
    '2026-08-28T12:34:56.789Z',
    '2099-12-31T23:59:59.999Z',
  ])('round-trips %s through Julian Date UTC', (iso) => {
    const input = new Date(iso);
    const output = julianDateUtcToDate(dateUtcToJulianDateUtc(input));

    expect(Math.abs(output.getTime() - input.getTime())).toBeLessThanOrEqual(1);
  });
});

describe('approximate UTC/TDB conversions', () => {
  it('applies the documented fixed modern TT offset plus a millisecond periodic term', () => {
    const date = new Date('2026-08-28T00:00:00.000Z');
    const jdUtc = dateUtcToJulianDateUtc(date);
    const jdTdb = julianDateUtcToApproximateTdb(jdUtc);
    const offsetSeconds = (jdTdb - jdUtc) * SECONDS_PER_DAY;

    expect(APPROXIMATE_TAI_MINUS_UTC_SECONDS).toBe(37);
    expect(TT_MINUS_TAI_SECONDS).toBe(32.184);
    expect(offsetSeconds).toBeGreaterThan(69.182);
    expect(offsetSeconds).toBeLessThan(69.186);
  });

  it('deliberately retains the fixed modern leap-second assumption for historical dates', () => {
    const historicalUtc = dateUtcToJulianDateUtc(new Date('1972-01-01T00:00:00.000Z'));
    const historicalOffsetSeconds =
      (julianDateUtcToApproximateTdb(historicalUtc) - historicalUtc) * SECONDS_PER_DAY;

    // This is the documented Phase 1 caveat: the implementation still uses 37 s,
    // rather than pretending to provide the historical 1972 TAI-UTC value.
    expect(historicalOffsetSeconds).toBeGreaterThan(69.182);
    expect(historicalOffsetSeconds).toBeLessThan(69.186);
  });

  it.each([
    '1900-01-01T00:00:00.000Z',
    '2000-01-01T12:00:00.000Z',
    '2026-08-28T12:34:56.789Z',
    '2099-12-31T23:59:59.999Z',
  ])('round-trips %s through approximate TDB', (iso) => {
    const input = new Date(iso);
    const jdTdb = dateUtcToApproximateTdb(input);
    const recoveredJdUtc = approximateTdbToJulianDateUtc(jdTdb);
    const output = approximateTdbToDateUtc(jdTdb);

    expect(recoveredJdUtc).toBeCloseTo(dateUtcToJulianDateUtc(input), 11);
    expect(Math.abs(output.getTime() - input.getTime())).toBeLessThanOrEqual(1);
    expect(formatApproximateTdbAsUtcIso(jdTdb)).toBe(output.toISOString());
  });
});

describe('JulianDate validation', () => {
  it('rejects invalid JavaScript dates', () => {
    expect(() => dateUtcToJulianDateUtc(new Date(Number.NaN))).toThrow(RangeError);
    expect(() => dateUtcToApproximateTdb(new Date(Number.NaN))).toThrow(RangeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite Julian Date %s',
    (value) => {
      expect(() => julianDateUtcToDate(value)).toThrow(RangeError);
      expect(() => julianDateUtcToApproximateTdb(value)).toThrow(RangeError);
      expect(() => approximateTdbToJulianDateUtc(value)).toThrow(RangeError);
      expect(() => approximateTdbToDateUtc(value)).toThrow(RangeError);
      expect(() => formatApproximateTdbAsUtcIso(value)).toThrow(RangeError);
    },
  );

  it('rejects a finite Julian Date outside the JavaScript Date range', () => {
    expect(() => julianDateUtcToDate(Number.MAX_VALUE)).toThrow(RangeError);
  });
});
