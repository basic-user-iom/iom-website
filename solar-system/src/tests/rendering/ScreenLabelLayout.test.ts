import {describe,it,expect} from 'vitest';
import {placeScreenLabelBounds} from '../../rendering/ScreenLabelLayout';
describe('screen label touch-target layout',()=>{
 it('retains nearby short names that a fixed 184px exclusion used to discard',()=>{
   const earth=placeScreenLabelBounds(100,100,48,44,390,600,[])!;
   const mars=placeScreenLabelBounds(165,100,45,44,390,600,[earth]);
   expect(mars).not.toBeNull();
   expect(mars!.left).toBeGreaterThan(earth.right);
 });
 it('finds a different side of a crowded target without overlapping either touch area',()=>{
   const first=placeScreenLabelBounds(150,100,80,44,390,600,[])!;
   const second=placeScreenLabelBounds(152,102,85,44,390,600,[first])!;
   expect(second).not.toBeNull();
   expect(second.left>=first.right||second.right<=first.left||second.top>=first.bottom||second.bottom<=first.top).toBe(true);
 });
 it('keeps long names inside narrow viewports at every edge',()=>{
   for(const [x,y] of [[-5,-5],[365,0],[0,805],[365,805]]){
     const box=placeScreenLabelBounds(x!,y!,164,44,360,800,[])!;
     expect(box.left).toBeGreaterThanOrEqual(4);expect(box.top).toBeGreaterThanOrEqual(4);
     expect(box.right).toBeLessThanOrEqual(356);expect(box.bottom).toBeLessThanOrEqual(796);
   }
 });
 it('suppresses labels when no legible non-overlapping space remains',()=>{
   expect(placeScreenLabelBounds(30,30,44,44,100,100,[{left:0,top:0,right:100,bottom:100}])).toBeNull();
 });
});
