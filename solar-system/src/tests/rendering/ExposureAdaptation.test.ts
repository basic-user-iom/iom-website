import {
  ExposureAdaptation,
  aggregateProtectiveExposureCeilings,
} from '../../rendering/ExposureAdaptation';
import { solarExposureForPreset } from '../../rendering/SolarPostProcessing';

describe('ExposureAdaptation', () => {
  it('follows the declared exponential darken and brighten constants', () => {
    const darkening = new ExposureAdaptation({ initialPreset: 'deep-space' });
    const deepSpace = solarExposureForPreset('deep-space');
    const solarCloseup = solarExposureForPreset('solar-closeup');
    darkening.setPreset('solar-closeup');
    const darkened = darkening.advance(0.1);
    const expectedDarkened = exponentialStep(deepSpace, solarCloseup, 0.1, 0.28);
    expect(darkened).toBeCloseTo(expectedDarkened, 12);

    const brightening = new ExposureAdaptation({ initialPreset: 'solar-closeup' });
    brightening.setPreset('deep-space');
    const brightened = brightening.advance(0.1);
    const expectedBrightened = exponentialStep(solarCloseup, deepSpace, 0.1, 0.9);
    expect(brightened).toBeCloseTo(expectedBrightened, 12);

    const darkFraction = (deepSpace - darkened) / (deepSpace - solarCloseup);
    const brightFraction = (brightened - solarCloseup) / (deepSpace - solarCloseup);
    expect(darkFraction).toBeGreaterThan(brightFraction);
  });

  it('is deterministic and invariant to equivalent sub-cap timestep partitions', () => {
    const wholeStep = new ExposureAdaptation({ initialPreset: 'deep-space' });
    const partitioned = new ExposureAdaptation({ initialPreset: 'deep-space' });
    wholeStep.setPreset('solar-closeup');
    partitioned.setPreset('solar-closeup');

    const wholeValue = wholeStep.advance(0.18);
    partitioned.advance(0.06);
    partitioned.advance(0.06);
    const partitionedValue = partitioned.advance(0.06);
    expect(partitionedValue).toBeCloseTo(wholeValue, 14);

    const firstReplay = replayAdaptation();
    const secondReplay = replayAdaptation();
    expect(secondReplay).toEqual(firstReplay);
  });

  it('caps a single frame delta and supports an immediate deterministic preset change', () => {
    const longFrame = new ExposureAdaptation({ initialPreset: 'deep-space' });
    const cappedFrame = new ExposureAdaptation({ initialPreset: 'deep-space' });
    longFrame.setPreset('solar-closeup');
    cappedFrame.setPreset('solar-closeup');
    expect(longFrame.advance(10)).toBe(cappedFrame.advance(0.25));

    longFrame.setPreset('balanced', true);
    expect(longFrame.state).toEqual({
      preset: 'balanced',
      exposure: solarExposureForPreset('balanced'),
      targetExposure: solarExposureForPreset('balanced'),
    });
    expect(Object.isFrozen(longFrame.state)).toBe(true);
  });

  it('slows and caps brightening when flash reduction is enabled', () => {
    const standard = new ExposureAdaptation({ initialPreset: 'solar-closeup' });
    const protectedAdaptation = new ExposureAdaptation({ initialPreset: 'solar-closeup' });
    standard.setPreset('deep-space');
    protectedAdaptation.setPreset('deep-space');

    const standardValue = standard.advance(0.1);
    const protectedValue = protectedAdaptation.advance(0.1, true);
    expect(protectedValue).toBeLessThan(standardValue);
    expect(protectedValue).toBeCloseTo(
      exponentialStep(
        solarExposureForPreset('solar-closeup'),
        solarExposureForPreset('deep-space'),
        0.05,
        2.4,
      ),
      12,
    );

    const protectedDarkening = new ExposureAdaptation({ initialPreset: 'deep-space' });
    protectedDarkening.setPreset('solar-closeup');
    expect(protectedDarkening.advance(0.1, true)).toBeCloseTo(
      exponentialStep(
        solarExposureForPreset('deep-space'),
        solarExposureForPreset('solar-closeup'),
        0.1,
        0.28,
      ),
      12,
    );
  });

  it('clamps presets to configured bounds and rejects invalid inputs', () => {
    const adaptation = new ExposureAdaptation({
      initialPreset: 'deep-space',
      minimumExposure: 0.8,
      maximumExposure: 1.05,
    });
    expect(adaptation.state.exposure).toBe(1.05);
    adaptation.setPreset('solar-closeup', true);
    expect(adaptation.state.exposure).toBe(0.8);

    expect(() => new ExposureAdaptation({ darkenTimeConstantSeconds: 0 })).toThrow(
      RangeError,
    );
    expect(() => new ExposureAdaptation({ minimumExposure: 1, maximumExposure: 1 })).toThrow(
      RangeError,
    );
    expect(() => adaptation.advance(-0.01)).toThrow(RangeError);
    expect(() => adaptation.advance(Number.NaN)).toThrow(RangeError);
  });

  it('applies and safely clears a temporary protective exposure ceiling', () => {
    const adaptation = new ExposureAdaptation({ initialPreset: 'deep-space' });
    adaptation.setProtectiveCeiling(0.52, true);
    expect(adaptation.state).toEqual({
      preset: 'deep-space',
      exposure: 0.52,
      targetExposure: 0.52,
    });

    adaptation.setPreset('balanced');
    expect(adaptation.state.targetExposure).toBe(0.52);
    adaptation.setProtectiveCeiling(null);
    expect(adaptation.state.exposure).toBe(0.52);
    expect(adaptation.state.targetExposure).toBe(solarExposureForPreset('balanced'));
    expect(adaptation.advance(0.05, true)).toBeGreaterThan(0.52);
    expect(() => adaptation.setProtectiveCeiling(0)).toThrow(RangeError);
    expect(() => adaptation.setProtectiveCeiling(Number.NaN)).toThrow(RangeError);
  });

  it('captures and restores current, target, and protective exposure state', () => {
    const adaptation = new ExposureAdaptation({
      initialPreset: 'deep-space',
      minimumExposure: 0.08,
    });
    adaptation.setProtectiveCeiling(0.1, true);
    const snapshot = adaptation.captureState();
    expect(snapshot).toEqual({
      preset: 'deep-space',
      currentExposure: 0.1,
      baseTargetExposure: solarExposureForPreset('deep-space'),
      targetExposure: 0.1,
      protectiveCeiling: 0.1,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);

    adaptation.setProtectiveCeiling(null);
    adaptation.setPreset('balanced', true);
    adaptation.restoreState(snapshot);
    expect(adaptation.captureState()).toEqual(snapshot);
    expect(() => adaptation.restoreState({
      ...snapshot,
      targetExposure: 0.2,
    })).toThrow(RangeError);
    expect(adaptation.captureState()).toEqual(snapshot);
  });

  it('aggregates independent scenario ceilings to the safest active value', () => {
    expect(aggregateProtectiveExposureCeilings([null, null])).toBeNull();
    expect(aggregateProtectiveExposureCeilings([0.5, null, 0.1, 0.18]))
      .toBe(0.1);
    expect(() => aggregateProtectiveExposureCeilings([0.1, Number.NaN]))
      .toThrow(RangeError);
  });
});

function replayAdaptation(): readonly number[] {
  const adaptation = new ExposureAdaptation({ initialPreset: 'balanced' });
  const values = [adaptation.advance(1 / 60)];
  adaptation.setPreset('solar-closeup');
  values.push(adaptation.advance(1 / 120));
  values.push(adaptation.advance(0.04));
  adaptation.setPreset('deep-space');
  values.push(adaptation.advance(0.1));
  values.push(adaptation.advance(0));
  return values;
}

function exponentialStep(
  current: number,
  target: number,
  deltaSeconds: number,
  timeConstantSeconds: number,
): number {
  return current + (target - current) * (1 - Math.exp(-deltaSeconds / timeConstantSeconds));
}
