import { dateUtcToApproximateTdb } from '../../simulation/core/JulianDate';
import { SimulationClock } from '../../simulation/core/SimulationClock';
import {
  MAX_LOG_TIME_SCALE,
  MAX_TIME_SCALE,
  MIN_LOG_TIME_SCALE,
  MIN_TIME_SCALE,
  TIME_PRESETS,
  clampTimeScale,
  findTimePreset,
  logValueToTimeScale,
  timeScaleToLogValue,
  type SimulationDirection,
  type TimePreset,
} from '../../simulation/core/TimePresets';
import {
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_JULIAN_YEAR,
  SECONDS_PER_MEAN_MONTH,
} from '../../simulation/core/Units';

const EXPECTED_PRESETS = [
  ['reverse-year', false, -1, SECONDS_PER_JULIAN_YEAR],
  ['reverse-month', false, -1, SECONDS_PER_MEAN_MONTH],
  ['reverse-day', false, -1, SECONDS_PER_DAY],
  ['reverse-hour', false, -1, SECONDS_PER_HOUR],
  ['reverse-realtime', false, -1, 1],
  ['pause', true, 1, 1],
  ['realtime', false, 1, 1],
  ['forward-60', false, 1, 60],
  ['forward-hour', false, 1, SECONDS_PER_HOUR],
  ['forward-day', false, 1, SECONDS_PER_DAY],
  ['forward-week', false, 1, SECONDS_PER_DAY * 7],
  ['forward-month', false, 1, SECONDS_PER_MEAN_MONTH],
  ['forward-year', false, 1, SECONDS_PER_JULIAN_YEAR],
  ['forward-decade', false, 1, SECONDS_PER_JULIAN_YEAR * 10],
] as const satisfies readonly (
  readonly [string, boolean, SimulationDirection, number]
)[];

describe('TIME_PRESETS', () => {
  it('defines every required reverse, pause, real-time, and forward preset', () => {
    expect(TIME_PRESETS).toHaveLength(EXPECTED_PRESETS.length);
    expect(Object.isFrozen(TIME_PRESETS)).toBe(true);

    EXPECTED_PRESETS.forEach(([id, paused, direction, timeScale], index) => {
      const preset = TIME_PRESETS[index];
      expect(preset).toBeDefined();
      expect(preset).toMatchObject({ id, paused, direction, timeScale });
      expect(preset?.label.length).toBeGreaterThan(0);
      expect(Object.isFrozen(preset)).toBe(true);
      expect(findTimePreset(id)).toBe(preset);
    });
    expect(findTimePreset('not-a-preset')).toBeUndefined();
  });

  it('round-trips every preset scale through the logarithmic control', () => {
    for (const preset of TIME_PRESETS) {
      const roundTrip = logValueToTimeScale(timeScaleToLogValue(preset.timeScale));
      expect(Math.abs(roundTrip - preset.timeScale) / preset.timeScale).toBeLessThan(1e-12);
    }
  });
});

describe('time scale logarithmic conversion', () => {
  it('publishes bounds derived from one second through ten years per second', () => {
    expect(MIN_TIME_SCALE).toBe(1);
    expect(MAX_TIME_SCALE).toBe(SECONDS_PER_JULIAN_YEAR * 10);
    expect(MIN_LOG_TIME_SCALE).toBe(0);
    expect(MAX_LOG_TIME_SCALE).toBeCloseTo(Math.log10(MAX_TIME_SCALE), 14);
  });

  it('clamps finite positive scales and logarithmic values to supported bounds', () => {
    expect(clampTimeScale(0.25)).toBe(MIN_TIME_SCALE);
    expect(clampTimeScale(60)).toBe(60);
    expect(clampTimeScale(MAX_TIME_SCALE * 2)).toBe(MAX_TIME_SCALE);
    expect(timeScaleToLogValue(0.25)).toBe(MIN_LOG_TIME_SCALE);
    expect(timeScaleToLogValue(MAX_TIME_SCALE * 2)).toBe(MAX_LOG_TIME_SCALE);
    expect(logValueToTimeScale(MIN_LOG_TIME_SCALE - 100)).toBe(MIN_TIME_SCALE);
    expect(logValueToTimeScale(MAX_LOG_TIME_SCALE + 100)).toBe(MAX_TIME_SCALE);
    expect(logValueToTimeScale(Math.log10(60))).toBeCloseTo(60, 12);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid time scale %s',
    (value) => {
      expect(() => clampTimeScale(value)).toThrow(RangeError);
      expect(() => timeScaleToLogValue(value)).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid logarithmic value %s',
    (value) => {
      expect(() => logValueToTimeScale(value)).toThrow(RangeError);
    },
  );
});

describe('SimulationClock playback', () => {
  it('starts paused at J2000 and emits a zero first-frame delta', () => {
    const clock = new SimulationClock();
    const frame = clock.tick(1_000);

    expect(clock.currentJdTdb).toBe(2_451_545);
    expect(clock.paused).toBe(true);
    expect(clock.direction).toBe(1);
    expect(clock.timeScale).toBe(1);
    expect(frame).toEqual({
      currentJdTdb: 2_451_545,
      dtRealSeconds: 0,
      dtSimSeconds: 0,
      rawRealDeltaSeconds: 0,
      scrubApplied: false,
    });
  });

  it('advances, pauses, toggles, and reverses independently', () => {
    const initialJd = 2_451_545;
    const clock = new SimulationClock({
      initialJdTdb: initialJd,
      paused: false,
      timeScale: 60,
      maximumRealDeltaSeconds: 1,
    });

    clock.tick(1_000);
    const forward = clock.tick(1_250);
    expect(forward.dtRealSeconds).toBe(0.25);
    expect(forward.dtSimSeconds).toBe(15);
    expect(clock.currentJdTdb).toBeCloseTo(initialJd + 15 / SECONDS_PER_DAY, 12);

    expect(clock.reverse()).toBe(-1);
    const reverse = clock.tick(1_500);
    expect(reverse.dtSimSeconds).toBe(-15);
    expect(clock.currentJdTdb).toBeCloseTo(initialJd, 12);

    clock.setPaused(true);
    const paused = clock.tick(1_750);
    expect(paused.dtRealSeconds).toBe(0.25);
    expect(paused.dtSimSeconds).toBe(0);
    expect(clock.togglePaused()).toBe(false);
    expect(clock.togglePaused()).toBe(true);
  });

  it('applies every preset atomically', () => {
    const clock = new SimulationClock();

    for (const preset of TIME_PRESETS) {
      clock.applyPreset(preset);
      expect(clock.paused).toBe(preset.paused);
      expect(clock.direction).toBe(preset.direction);
      expect(clock.timeScale).toBe(preset.timeScale);
    }
  });

  it('clamps a long frame to the default 100 ms while reporting raw time', () => {
    const clock = new SimulationClock({ paused: false, timeScale: 10 });
    clock.tick(0);
    const frame = clock.tick(2_500);

    expect(clock.maximumRealDeltaSeconds).toBe(0.1);
    expect(frame.rawRealDeltaSeconds).toBe(2.5);
    expect(frame.dtRealSeconds).toBe(0.1);
    expect(frame.dtSimSeconds).toBe(1);
  });

  it('treats a backward scheduler timestamp as zero but adopts it as the new anchor', () => {
    const clock = new SimulationClock({
      paused: false,
      maximumRealDeltaSeconds: 1,
    });
    clock.tick(1_000);

    const backward = clock.tick(900);
    expect(backward.rawRealDeltaSeconds).toBe(0);
    expect(backward.dtRealSeconds).toBe(0);

    const recovered = clock.tick(950);
    expect(recovered.rawRealDeltaSeconds).toBe(0.05);
    expect(recovered.dtRealSeconds).toBe(0.05);
  });
});

describe('SimulationClock exact dates and scrubbing', () => {
  it('sets and retrieves an exact UTC date through approximate TDB', () => {
    const date = new Date('2026-08-28T12:34:56.789Z');
    const clock = new SimulationClock();

    clock.setExactDateUtc(date);
    expect(clock.currentJdTdb).toBeCloseTo(dateUtcToApproximateTdb(date), 12);
    expect(Math.abs(clock.getApproximateUtcDate().getTime() - date.getTime())).toBeLessThanOrEqual(
      1,
    );
  });

  it('applies a scrub target once on the next tick and supports clearing it', () => {
    const clock = new SimulationClock({ initialJdTdb: 100, paused: true });
    clock.tick(0);
    clock.setScrubTargetJdTdb(200);
    expect(clock.scrubTargetJdTdb).toBe(200);

    const scrubbed = clock.tick(16);
    expect(scrubbed.scrubApplied).toBe(true);
    expect(scrubbed.currentJdTdb).toBe(200);
    expect(clock.scrubTargetJdTdb).toBeNull();
    expect(clock.tick(32).scrubApplied).toBe(false);

    clock.setScrubTargetJdTdb(300);
    clock.clearScrubTarget();
    expect(clock.scrubTargetJdTdb).toBeNull();
    expect(clock.tick(48).currentJdTdb).toBe(200);
  });

  it('setting the current date clears a pending scrub and snapshots immutable state', () => {
    const clock = new SimulationClock();
    clock.setScrubTargetJdTdb(300);
    clock.setCurrentJdTdb(250);
    const snapshot = clock.snapshot();

    expect(snapshot).toEqual({
      currentJdTdb: 250,
      paused: true,
      direction: 1,
      timeScale: 1,
      scrubTargetJdTdb: null,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('resets the real-time anchor explicitly', () => {
    const clock = new SimulationClock({ paused: false, maximumRealDeltaSeconds: 1 });
    clock.tick(100);
    clock.resetRealTimeAnchor();
    expect(clock.tick(1_000).dtRealSeconds).toBe(0);
    clock.resetRealTimeAnchor(1_000);
    expect(clock.tick(1_250).dtRealSeconds).toBe(0.25);
  });
});

describe('SimulationClock validation', () => {
  it('rejects invalid constructor values', () => {
    expect(() => new SimulationClock({ initialJdTdb: Number.NaN })).toThrow(RangeError);
    expect(
      () => new SimulationClock({ direction: 0 as unknown as SimulationDirection }),
    ).toThrow(RangeError);
    expect(() => new SimulationClock({ timeScale: 0 })).toThrow(RangeError);
    expect(() => new SimulationClock({ maximumRealDeltaSeconds: 0 })).toThrow(RangeError);
    expect(
      () => new SimulationClock({ maximumRealDeltaSeconds: Number.POSITIVE_INFINITY }),
    ).toThrow(RangeError);
  });

  it('rejects invalid updates', () => {
    const clock = new SimulationClock();
    const invalidPreset: TimePreset = {
      id: 'invalid',
      label: 'Invalid',
      paused: false,
      direction: 1,
      timeScale: 0,
    };

    expect(() => clock.tick(Number.NaN)).toThrow(RangeError);
    expect(() => clock.resetRealTimeAnchor(Number.NaN)).toThrow(RangeError);
    expect(() => clock.setCurrentJdTdb(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => clock.setScrubTargetJdTdb(Number.NaN)).toThrow(RangeError);
    expect(() => clock.setExactDateUtc(new Date(Number.NaN))).toThrow(RangeError);
    expect(() => clock.setDirection(0 as unknown as SimulationDirection)).toThrow(RangeError);
    expect(() => clock.setTimeScale(-1)).toThrow(RangeError);
    expect(() => clock.applyPreset(invalidPreset)).toThrow(RangeError);
  });
});
