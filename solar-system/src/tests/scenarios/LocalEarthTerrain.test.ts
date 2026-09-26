import { createLocalTerrainSampler, terrariumHeight, type TerrainTile } from '../../simulation/scenarios/impact/LocalEarthTerrain';
import type { EarthSurfaceSampler } from '../../simulation/scenarios/impact/EarthSurface';

const ocean:EarthSurfaceSampler=()=>({kind:'ocean',elevationM:-2730,surfaceAltitudeM:0,waterDepthM:2730,coastal:false});
const land:EarthSurfaceSampler=()=>({kind:'land',elevationM:800,surfaceAltitudeM:800,waterDepthM:0,coastal:false});
function tiles(height:number):Map<string,TerrainTile>{
  return new Map([['12/2048/2048',{z:12,x:2048,y:2048,heights:new Float32Array(65536).fill(height)}]]);
}
describe('local terrain data integration',()=>{
  it('decodes signed fractional Terrarium elevations',()=>{
    expect(terrariumHeight(128,0,0)).toBe(0);
    expect(terrariumHeight(127,255,128)).toBe(-0.5);
    expect(terrariumHeight(129,1,64)).toBe(257.25);
  });
  it('never turns zero-valued ocean DEM pixels into land or removes bathymetry',()=>{
    for(const height of [0,-100,-32768,NaN]){
      expect(createLocalTerrainSampler(0,0,ocean,tiles(height))(0,0)).toEqual(ocean(0,0));
    }
  });
  it('uses local relief on land and retains regional coverage outside its tiles',()=>{
    const sample=createLocalTerrainSampler(0,0,land,tiles(1450));
    expect(sample(0,0)).toMatchObject({kind:'land',surfaceAltitudeM:1450,source:'local'});
    expect(sample(30,40)).toEqual(land(30,40));
    expect(sample(89,0)).toEqual(land(89,0));
  });
  it('can resolve a positive-elevation coast within a regional ocean cell',()=>{
    expect(createLocalTerrainSampler(0,0,ocean,tiles(120))(0,0)).toMatchObject({kind:'land',surfaceAltitudeM:120,waterDepthM:0});
  });
  it('does not reinterpret closed below-sea-level land as ocean',()=>{
    expect(createLocalTerrainSampler(0,0,land,tiles(-80))(0,0)).toMatchObject({kind:'land',waterDepthM:0});
  });
});
