import { solarFateFramingRadius } from '../../rendering/solar-fate/SolarFateCamera';
import type { SolarEvolutionRenderState, FictionalSupernovaRenderState } from '../../rendering/solar-fate/SolarFateRenderTypes';

const evolution: SolarEvolutionRenderState = {
  lifecycleState: 'paused', phase: 'planetary-nebula', phaseProgress: 0,
  scenarioTimeSeconds: 24, progress: 0.6, stellarRadiusM: 8e6,
  luminositySolar: 10, effectiveTemperatureK: 30_000, massSolar: 0.55,
  massLossOpacity: 0.3, nebulaRadiusM: 1e12, nebulaOpacity: 0.5,
  heatingByBody: {}, engulfmentByBody: {}, runSignature: 'camera',
};
const nova: FictionalSupernovaRenderState = {
  lifecycleState: 'paused', phase: 'debris-nebula', scenarioTimeSeconds: 25, progress: 0.6,
  pulseScale: 1, flashIntensity: 0, coreRadiusM: 7e8, shockRadiusM: 1e12,
  radiationFrontRadiusM: 2e12, debrisRadiusM: 8e11, debrisOpacity: 0.7,
  nebulaRadiusM: 6e11, nebulaOpacity: 0.5, remnantRadiusM: 12_000,
  remnantKind: 'neutron-star', heatingByBody: {}, runSignature: 'camera',
};

describe('Solar Fate event framing', () => {
  it('fits the scientific envelope outside the camera while keeping star close-up physical', () => {
    expect(solarFateFramingRadius('auto', evolution, null) * 8).toBeGreaterThan(evolution.nebulaRadiusM * 3);
    expect(solarFateFramingRadius('star', evolution, null)).toBe(evolution.stellarRadiusM);
  });
  it('moves continuously from nebula to white dwarf without a linear astronomical jump', () => {
    const radius = (phaseProgress: number) => solarFateFramingRadius('auto', {...evolution, phase: 'white-dwarf', phaseProgress}, null);
    const wide = solarFateFramingRadius('wide', evolution, null);
    expect(radius(0)).toBeCloseTo(wide, -1);
    expect(radius(1)).toBeCloseTo(evolution.stellarRadiusM, 4);
    expect(radius(0.5)).toBeCloseTo(Math.sqrt(wide * evolution.stellarRadiusM), 1);
    expect(radius(0.50001)).toBeLessThan(radius(0.5));
  });
  it('frames the outer fictional shell and includes neutron-star beams in automatic remnant view', () => {
    expect(solarFateFramingRadius('auto', null, {...nova, phase: 'shock-shell'}) * 8).toBeGreaterThan(nova.radiationFrontRadiusM * 3);
    expect(solarFateFramingRadius('auto', null, nova)).toBe(nova.debrisRadiusM * 0.62);
    const remnant = {...nova, phase: 'remnant' as const};
    expect(solarFateFramingRadius('auto', null, remnant)).toBe(4 * nova.remnantRadiusM);
    expect(solarFateFramingRadius('star', null, remnant)).toBe(nova.remnantRadiusM);
  });
});
