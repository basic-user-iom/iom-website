import { craterDisplacementM, oceanEvolution, oceanJetHeightM, oceanCavityProgress } from '../../rendering/impact/ImpactSurfaceDeformation';
import type { ImpactRenderState } from '../../rendering/impact/ImpactRenderTypes';
import { simulateImpactEntry, deriveImpactVisualProfile } from '../../simulation/scenarios/impact/ImpactPhysics';
import { DEFAULT_IMPACT_PARAMETERS } from '../../simulation/scenarios/impact/ImpactConfiguration';

function state(depth=4000):ImpactRenderState {
  return {targetRadiusM:6371008.4,surfaceGravityMps2:9.80665,flashRadiusM:700,surfaceImpactEnergyJ:8e16,
    earthSurface:{kind:'ocean',surfaceAltitudeM:0,elevationM:-depth,waterDepthM:depth,coastal:false}} as ImpactRenderState;
}
describe('surface evolution in SI units',()=>{
  it('excavates a negative bowl with a raised rim and unchanged far field',()=>{
    expect(craterDisplacementM(0,1000,200,1)).toBeCloseTo(-200,5);
    expect(craterDisplacementM(1000,1000,200,1)).toBeCloseTo(36,5);
    expect(craterDisplacementM(4000,1000,200,1)).toBeCloseTo(0,10);
    expect(craterDisplacementM(0,1000,200,0)).toBe(0);
  });
  it('opens and collapses the cavity before a delayed rebound jet',()=>{
    const m=oceanEvolution(state());
    expect(oceanCavityProgress(0,m.collapseSeconds)).toBe(0);
    expect(oceanCavityProgress(m.collapseSeconds*0.9,m.collapseSeconds)).toBeCloseTo(1,6);
    expect(oceanCavityProgress(m.collapseSeconds*2,m.collapseSeconds)).toBe(0);
    expect(oceanJetHeightM(1,m,9.80665)).toBe(0);
    expect(oceanJetHeightM(m.collapseSeconds*1.6,m,9.80665)).toBeGreaterThan(0);
    expect(oceanJetHeightM(300,m,9.80665)).toBe(0);
  });
  it('bounds cavity depth by available water and distinguishes group from phase speed',()=>{
    const deep=oceanEvolution(state()),shallow=oceanEvolution(state(15));
    expect(shallow.cavityDepthM).toBeLessThan(15);
    expect(shallow.shallow).toBe(true);
    expect(deep.groupSpeedMps/deep.phaseSpeedMps).toBeCloseTo(0.5,2);
    expect(shallow.groupSpeedMps/shallow.phaseSpeedMps).toBeGreaterThan(0.95);
    expect(shallow.phaseSpeedMps).toBeLessThan(deep.phaseSpeedMps);
  });
  it('uses plausible gravity-regime crater sizes and suppresses deep-water substrate coupling',()=>{
    const summary=simulateImpactEntry({...DEFAULT_IMPACT_PARAMETERS,diameterM:50,densityKgM3:7800,
      entrySpeedKmps:12,entryAngleDeg:45,atmosphereEnabled:false,fragmentationEnabled:false},null).physicalSummary;
    const land=deriveImpactVisualProfile(summary);
    expect(land.craterRadiusM).toBeGreaterThan(400);
    expect(land.craterRadiusM).toBeLessThan(1100);
    const shallow=deriveImpactVisualProfile({...summary,outcomeKind:'ocean-surface-impact',earthSurface:state(10).earthSurface});
    const deep=deriveImpactVisualProfile({...summary,outcomeKind:'ocean-surface-impact',earthSurface:state(10000).earthSurface});
    expect(shallow.seafloorCraterRadiusM).toBeGreaterThan(0);
    expect(deep.seafloorCraterRadiusM).toBe(0);
    expect(shallow.craterRadiusM).toBe(0);
  });
});
