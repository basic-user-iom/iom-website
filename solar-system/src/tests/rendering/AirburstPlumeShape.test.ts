import { Vector3 } from 'three';
import { airburstWakeLengthM, sampleAirburstWake } from '../../rendering/impact/AirburstPlumeShape';
import type { ImpactRenderState } from '../../rendering/impact/ImpactRenderTypes';

describe('airburst wake sampled from the entry path', () => {
  const state = { trailLocalEnuM: new Float64Array([-3000, 0, 4000, 0, 0, 0]),
    plumeHeightM: 1000, plumeRadiusM: 600 } as ImpactRenderState;
  it('interpolates back along the path in metres and clamps at its start', () => {
    const out = new Vector3();
    expect(sampleAirburstWake(out, state, 2500).toArray()).toEqual([-1500, 0, 2000]);
    expect(sampleAirburstWake(out, state, 10000).toArray()).toEqual([-3000, 0, 4000]);
    expect(airburstWakeLengthM(state)).toBe(3600);
    expect(airburstWakeLengthM({ ...state, plumeHeightM: 20000 })).toBe(5000);
  });
  it('handles absent and repeated samples without fabricating a path', () => {
    const out = new Vector3();
    expect(sampleAirburstWake(out, {...state, trailLocalEnuM: new Float64Array()}, 500).length()).toBe(0);
    const repeated = {...state, trailLocalEnuM:new Float64Array([1,2,3,1,2,3])};
    expect(airburstWakeLengthM(repeated)).toBe(0);
    expect(sampleAirburstWake(out, repeated, 500).length()).toBe(0);
  });
});
