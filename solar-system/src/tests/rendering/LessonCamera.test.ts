import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { lessonCameraPose, type LessonFraming } from '../../rendering/camera/LessonCamera';
const bodies=new Map([['sun',{position:new Vector3(),radius:.00465}],['earth',{position:new Vector3(1,0,0),radius:.0000426}],['moon',{position:new Vector3(1.00257,.0001,.0002),radius:.0000116}],['jupiter',{position:new Vector3(0,0,5.2),radius:.000477}]]);
describe('lesson framing',()=>{
  for(const aspect of [.45,1,2.8]) it('centres and fits teaching subjects at aspect '+aspect,()=>{
    const configs:LessonFraming[]=[{kind:'orbits',extentAu:2},{kind:'orbits',extentAu:6},{kind:'body',bodyId:'earth'},{kind:'body',bodyId:'sun'},{kind:'body',bodyId:'jupiter'},{kind:'seasons'},{kind:'moon-system'}];
    for(const framing of configs){
      const pose=lessonCameraPose(framing,bodies,149597870700,44,aspect)!;
      const camera=new PerspectiveCamera(44,aspect,1e-8,1e6);camera.position.copy(pose.position);camera.up.copy(pose.up);camera.lookAt(pose.target);camera.updateMatrixWorld();
      const center=pose.target.clone().project(camera);expect(Math.abs(center.x)).toBeLessThan(1e-6);expect(Math.abs(center.y)).toBeLessThan(1e-6);
      if(framing.kind==='moon-system')for(const id of ['earth','moon']){const p=bodies.get(id)!.position.clone().project(camera);expect(Math.abs(p.x)).toBeLessThan(.85);expect(Math.abs(p.y)).toBeLessThan(.85);}
      if(framing.kind==='seasons')expect(pose.position.clone().sub(pose.target).normalize().dot(bodies.get('sun')!.position.clone().sub(pose.target).normalize())).toBeCloseTo(0,8);
    }
  });
});
