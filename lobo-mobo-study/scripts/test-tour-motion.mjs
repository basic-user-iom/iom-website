import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const root=process.env.MOBO_PROJECT||resolve(import.meta.dirname,'..');
const require=createRequire(resolve(root,'package.json'));
const {build}=require('esbuild');
const {PerspectiveCamera,Vector3,Box3}=require('three');
const directory=await mkdtemp(join(tmpdir(),'mobo-tour-motion-'));
try{
 const entry=resolve(root,'app/src/tour-camera.ts'),output=join(directory,'tour-camera.mjs');
 await build({entryPoints:[entry],outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const {RoomTourCamera,dampVector,dampShot}=await import(pathToFileURL(output));
 const room={position:[3,1.65,6.5],target:[-.15,1.65,-.15]};
 const setup=()=>{const camera=new PerspectiveCamera(31,1.4,.05,60);camera.position.fromArray(room.position);camera.lookAt(new Vector3().fromArray(room.target));const helper=new RoomTourCamera(camera,room,new Box3(new Vector3(.56,1.62,.1),new Vector3(1,2.1,.54)),1.02);return{camera,helper};};
 const maxDifference=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
 const result=[];
 for(const property of ['position','target','positionVelocity','targetVelocity','basePositionAcceleration','baseTargetAcceleration']){
  const {helper}=setup();for(let i=0;i<70;i++)helper.update({shot:'lamp',amount:Math.sin(i/60*.12)*.75,delta:1/60});
  const before=helper.snapshot();helper.update({shot:'table',amount:.21,delta:0});const after=helper.snapshot();
  assert.deepEqual(after[property],before[property],`${property} must be continuous when a chapter retargets`);
 }
 result.push('Chapter retargeting preserves position, target, velocities and base accelerations exactly.');
 const rates=[];
 for(const hz of [30,60,144]){
  const {helper}=setup();for(let i=0;i<4*hz;i++)helper.update({shot:'lamp',amount:0,delta:1/hz});rates.push(helper.snapshot());
 }
 for(const r of rates.slice(1))for(const key of ['position','target'])assert(maxDifference(r[key],rates[0][key])<1e-10,'Same stationary destination must converge independently of refresh rate');
 result.push('30/60/144 Hz stationary convergence matches within 1e-10.');
 {
  const {camera,helper}=setup();helper.update({shot:'lamp',amount:0,delta:.1});camera.position.set(4,2.2,5);camera.lookAt(-1,1.2,0);camera.zoom=1.3;
  const p=camera.position.clone(),q=camera.quaternion.clone();helper.update({shot:'lamp',amount:.3,delta:0,rebase:true});
  assert(camera.position.distanceTo(p)<1e-12);assert(camera.quaternion.angleTo(q)<1e-7);assert.equal(camera.zoom,1.3);
  helper.update({shot:'lamp',amount:.3,delta:1/60});assert(camera.position.distanceTo(p)<.02);
 }
 result.push('Resume from manual pose/zoom preserves the first frame and eases thereafter.');
 {
  const {helper}=setup();helper.update({shot:'table',amount:.4,delta:0,immediate:true});const before=helper.snapshot();
  for(let i=0;i<120;i++)helper.update({shot:'table',amount:Math.sin(i),delta:1/60,immediate:true});
  assert.deepEqual(helper.snapshot().position,before.position);assert.deepEqual(helper.snapshot().target,before.target);
 }
 result.push('Reduced-motion framing stays still despite changing tour phase.');
 {
  const value=new Vector3(),velocity=new Vector3(),goal=new Vector3(1,2,3);let previous=0;
  for(let i=0;i<500;i++){dampVector(value,velocity,goal,1/60);assert(value.x>=previous&&value.x<=1);previous=value.x;}
 }
 result.push('Critical damping approaches its goal without overshooting.');
 {
  const value=new Vector3(),velocity=new Vector3(),acceleration=new Vector3(),goal=new Vector3(1,2,3);let previous=0;
  for(let i=0;i<600;i++){dampShot(value,velocity,acceleration,goal,1/60);assert(value.x>=previous&&value.x<=1);previous=value.x;}
 }
 result.push('Slower base-shot response approaches the goal without overshooting.');
 {
  const {camera,helper}=setup(),start=camera.position.clone();let peak=0,oneSecond=0,atSix=0;
  helper.update({shot:'lamp',amount:0,delta:0,immediate:true});const destination=camera.position.clone(),distance=start.distanceTo(destination);
  camera.position.copy(start);camera.lookAt(new Vector3().fromArray(room.target));helper.stop();
  for(let i=1;i<=9*60;i++){helper.update({shot:'lamp',amount:0,delta:1/60});peak=Math.max(peak,new Vector3().fromArray(helper.snapshot().positionVelocity).length());if(i===60)oneSecond=camera.position.distanceTo(start)/distance;if(i===360)atSix=camera.position.distanceTo(destination)/distance;}
  assert(peak<2.1,`Approach peak ${peak} must stay restrained`);assert(oneSecond<.25,`First second advances ${oneSecond}; the approach must not rush`);assert(atSix<.01,'Approach reaches framing within six seconds');
  result.push({name:'First approach has a soft start, restrained peak speed and enough arrival time',peakSceneUnitsPerSecond:peak,firstSecondFraction:oneSecond,remainingAtSixSeconds:atSix});
 }
 {
  const {helper}=setup();let minimum=Infinity,maximum=0;
  for(let i=0;i<120*60;i++){const phase=i/60*.12;helper.update({shot:'room',amount:Math.sin(phase)*.75,lift:Math.cos(phase)*.75,delta:1/60});if(i>10*60){const speed=new Vector3().fromArray(helper.snapshot().positionVelocity).length();minimum=Math.min(minimum,speed);maximum=Math.max(maximum,speed);}}
  assert(minimum>.002,'Perpendicular drift must not stop at the lateral turning points');assert(maximum<.025,'Room drift must stay restrained');
  result.push({name:'Two complete drift cycles keep moving gently without a shared turning-point stop',minimumSceneUnitsPerSecond:minimum,maximumSceneUnitsPerSecond:maximum});
 }
 console.log(JSON.stringify({passed:result.length,checks:result},null,2));
}finally{
 // Only the exact temporary directory created by this script is removed.
 const relativePath=relative(resolve(tmpdir()),resolve(directory));
 if(relativePath.startsWith('..')||isAbsolute(relativePath)||!relativePath.startsWith('mobo-tour-motion-'))throw Error('Unexpected temporary path');
 await rm(directory,{recursive:true,force:true});
}
