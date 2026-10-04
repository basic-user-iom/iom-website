import { dateUtcToApproximateTdb } from '../../simulation/core/JulianDate';
import { describe, expect, it } from 'vitest';
import { parseSharedView, sharedViewUrl, type SharedView } from '../../sharing/SharedView';
const view: SharedView = { version: 1, utc: '2026-10-03T12:00:00.000Z', jdTdb: dateUtcToApproximateTdb(new Date('2026-10-03T12:00:00.000Z')), scale: 'true', camera: { selectedBodyId: 'earth', mode: 'free-orbit', closeUpPresetId: null, position: [0, .002, .005], target: [0,0,0], up: [0,1,0] }, origin: [1e11, 3e10, 0], originBodyId: 'earth', layers: { orbitLinesVisible:true,bodyLabelsVisible:false,skyBackgroundVisible:true,brightStarsVisible:true,cometsVisible:true,asteroidBeltVisible:false,kuiperBeltVisible:false }, venus: 'clouds', auxiliary: {moonId:null,spaceObjectId:null} };
const hash = (v: unknown) => '#view=' + encodeURIComponent(JSON.stringify(v));
describe('shared public views', () => {
  it('round-trips date, camera, origin and preferences without leaking unrelated URL parameters', () => {
    const url = new URL(sharedViewUrl('https://example.com/demos/solar-system/?debug=true#old', view));
    expect(url.search).toBe(''); expect(url.pathname).toBe('/demos/solar-system/');
    expect(parseSharedView(url.hash)).toEqual({view,error:null});
  });
  it('ignores unrelated anchors and rejects malformed/oversized payloads', () => {
    expect(parseSharedView('#learn')).toEqual({view:null,error:null});
    for (const value of ['#view=%XX','#view=[]','#view='+'x'.repeat(12001)]) expect(parseSharedView(value).error).toBeTruthy();
  });
  it('rejects invalid dates, catalog IDs, modes, origin and singular camera geometry', () => {
    for (const change of [ {utc:'2026-02-30T12:00:00.000Z'}, {version:2}, {jdTdb:2451545}, {jdTdb:null}, {origin:[1e30,0,0]}, {originBodyId:'unknown'}, {scale:'logarithmic'}, {camera:{...view.camera,selectedBodyId:'evil'}}, {camera:{...view.camera,mode:'invalid'}}, {camera:{...view.camera,up:[0,0,0]}}, {camera:{...view.camera,position:view.camera.target}}, {layers:{}} ]) expect(parseSharedView(hash({...view,...change})).view).toBeNull();
  });
});
