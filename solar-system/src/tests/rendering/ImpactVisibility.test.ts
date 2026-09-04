import {
  formatImpactVisibilityMultiplier,
  impactVisibilityMultiplier,
} from '../../rendering/impact/ImpactVisibility';

const SMALL_EVENT = Object.freeze({
  targetRadiusM: 6_378_137,
  flashRadiusM: 900,
  craterRadiusM: 260,
  scorchRadiusM: 520,
  ejectaRadiusM: 2_100,
  plumeHeightM: 4_500,
  plumeRadiusM: 1_000,
});

describe('ImpactVisibility', () => {
  it('always returns one for physical scale', () => {
    expect(impactVisibilityMultiplier('physical', SMALL_EVENT)).toBe(1);
  });

  it('caps enhanced visibility while making a small event readable', () => {
    const multiplier = impactVisibilityMultiplier('enhanced', SMALL_EVENT);
    expect(multiplier).toBe(16);
    expect(formatImpactVisibilityMultiplier(multiplier)).toBe('16x');
  });

  it('does not enlarge an already planetary-scale event', () => {
    expect(impactVisibilityMultiplier('enhanced', {
      ...SMALL_EVENT,
      plumeHeightM: SMALL_EVENT.targetRadiusM * 0.1,
    })).toBe(1);
  });

  it('falls back safely for missing effect dimensions', () => {
    expect(impactVisibilityMultiplier('enhanced', {
      ...SMALL_EVENT,
      flashRadiusM: 0,
      craterRadiusM: 0,
      scorchRadiusM: 0,
      ejectaRadiusM: 0,
      plumeHeightM: 0,
      plumeRadiusM: 0,
    })).toBe(1);
  });
});
