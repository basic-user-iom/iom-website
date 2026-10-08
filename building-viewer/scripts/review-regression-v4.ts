import assert from 'node:assert/strict'
import {Box3,Group,InstancedMesh,Matrix4,MeshBasicMaterial,PlaneGeometry,Vector3} from 'three'
import {buildCollisionChunks} from '../src/collision/buildCollisionChunks'
import {WalkPresentation} from '../src/controls/WalkPresentation'
import {runRegression} from './blender-controller-regression'
const root=new Group();root.position.set(100,0,-30);root.rotation.y=.4
const geometry=new PlaneGeometry(2,2).rotateX(-Math.PI/2)
const mesh=new InstancedMesh(geometry,new MeshBasicMaterial(),2);mesh.name='COLLIDER_floor_instances';mesh.position.set(4,0,0);mesh.setMatrixAt(0,new Matrix4().makeTranslation(10,3,0));mesh.setMatrixAt(1,new Matrix4().makeTranslation(-10,7,0));root.add(mesh);root.updateMatrixWorld(true)
const built=buildCollisionChunks(root,{layerId:'icm-anim-2025',ignoreVisibility:true,verbose:false});assert.equal(built.report.triangles,4)
for(const [x,y]of [[10,3],[-10,7]]){const center=new Vector3(x,y,0).applyMatrix4(mesh.matrixWorld);assert.ok(built.chunks.some(c=>c.box.clone().expandByScalar(1e-5).containsPoint(center)),'instance world transform lost')}
assert.ok(built.chunks.every(c=>!c.box.containsPoint(new Vector3(0,0,0))),'phantom origin geometry')
for(const sign of [-1,1])for(const fps of [30,60,120]){const p=new WalkPresentation(),pos=new Vector3(0,sign<0?3:0,0);p.reset(pos,0);let opposite=0,stairFrames=0;for(let f=0;f<fps*6;f++){const before=pos.clone(),time=(f+1)/fps;pos.z=-.35*time;pos.y=(sign<0?3:0)+sign*Math.floor(time/.8)*.18+(f%8===1?.018:0);p.update(1/fps,before,pos,true,0,f%8===1?1:0,true,false);if(f>fps&&p.animation.startsWith('stairs')){stairFrames++;if(p.animation!==(sign>0?'stairsUp':'stairsDown'))opposite++}}assert.ok(stairFrames>fps*3,'slow stair gait flickers back to walking');assert.equal(opposite,0,'small contact jitter reversed the gait');p.update(1/fps,pos,pos,true,0,0,false,false);assert.equal(p.animation,'idle')}
const regression=await runRegression(true);assert.ok(regression.results.every(r=>r.ok),JSON.stringify(regression));console.log(JSON.stringify({instanceMatrices:'PASS (translated/rotated parent, 2 separated instances)',slowStairGait:'PASS (30/60/120 Hz, both directions, contact jitter, stop)',regression},null,2))
