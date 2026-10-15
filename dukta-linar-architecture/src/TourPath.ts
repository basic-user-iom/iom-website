import * as T from 'three';
import type {OrbitMode} from './controls/OrbitMode';
export type TourPose={position:number[];target:number[];fov:number};
const point=(a:number[])=>new T.Vector3(...a);
const smooth=(t:number)=>t*t*(3-2*t);
/** Exact, two-sided triangle distance checks; a spatial grid keeps route tests local. */
export class TourClearance{
 obstacles:T.Box3[]=[];
 private cells=new Map<string,T.Triangle[]>();private scratch=new T.Vector3();triangles=0;checks=0;lastBlock='';private names=new WeakMap<T.Triangle,string>();
 constructor(readonly radius=.2){}
 rebuild(roots:T.Object3D[],region=new T.Box3(new T.Vector3(-30,.55,-45),new T.Vector3(52,8,8))){
  this.cells.clear();this.triangles=0;this.checks=0;
  for(const root of roots){root.updateWorldMatrix(true,true);root.traverseVisible(o=>{if(!(o instanceof T.Mesh)||o.userData.tourDoorHidden)return;const g=o.geometry,p=g.getAttribute('position');if(!p)return;g.computeBoundingBox();const matrices:T.Matrix4[]=[];
   if(o instanceof T.InstancedMesh){for(let j=0;j<(o.userData.collisionInstanceCount??o.count);j++){const m=new T.Matrix4();if(o.userData.collisionInstanceMatrices)m.fromArray(o.userData.collisionInstanceMatrices,j*16);else o.getMatrixAt(j,m);m.premultiply(o.matrixWorld);if(g.boundingBox!.clone().applyMatrix4(m).intersectsBox(region))matrices.push(m);}}
   else if(g.boundingBox!.clone().applyMatrix4(o.matrixWorld).intersectsBox(region))matrices.push(o.matrixWorld);
   const ix=g.index;for(const m of matrices)for(let i=0;i<(ix?.count??p.count);i+=3){const vertices=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(m)),bounds=new T.Box3().setFromPoints(vertices);if(!bounds.intersectsBox(region))continue;const tri=new T.Triangle(...vertices as [T.Vector3,T.Vector3,T.Vector3]);if(tri.getArea()<1e-10)continue;this.names.set(tri,o.name);this.triangles++;bounds.expandByScalar(this.radius+.06).intersect(region);for(let x=Math.floor(bounds.min.x/2);x<=Math.floor(bounds.max.x/2);x++)for(let y=Math.floor(bounds.min.y/2);y<=Math.floor(bounds.max.y/2);y++)for(let z=Math.floor(bounds.min.z/2);z<=Math.floor(bounds.max.z/2);z++){const key=x+','+y+','+z,cell=this.cells.get(key)??[];cell.push(tri);this.cells.set(key,cell);}}
  });}
 }
 clear(p:T.Vector3){this.checks++;for(const b of this.obstacles)if(b.distanceToPoint(p)<this.radius){this.lastBlock='LINAR occupied envelope';return false;}for(const tri of this.cells.get(Math.floor(p.x/2)+','+Math.floor(p.y/2)+','+Math.floor(p.z/2))??[]){tri.closestPointToPoint(p,this.scratch);if(this.scratch.distanceToSquared(p)<this.radius*this.radius){this.lastBlock=this.names.get(tri)??'';return false;}}return true;}
 segment(a:T.Vector3,b:T.Vector3){const count=Math.max(1,Math.ceil(a.distanceTo(b)/.08)),p=new T.Vector3();for(let i=0;i<=count;i++)if(!this.clear(p.lerpVectors(a,b,i/count)))return false;return true;}
 route(a:T.Vector3,b:T.Vector3):T.Vector3[]{
  if(a.distanceTo(b)<.001)return[a,b];if(this.segment(a,b))return[a,b];
  // Local 3D search also routes above chairs and around the solid LINAR divider.
  const size=.5,min=new T.Vector3(Math.min(a.x,b.x)-4,.8,Math.min(a.z,b.z)-4),max=new T.Vector3(Math.max(a.x,b.x)+4,Math.max(5.3,a.y,b.y),Math.max(a.z,b.z)+4);
  if(a.x>25.5&&b.x>25.5){min.x=Math.max(25.6,min.x);min.z=Math.max(-36.45,min.z);max.x=Math.min(49,max.x);max.z=Math.min(-27.5,max.z);}
  const key=(p:T.Vector3)=>[p.x,p.y,p.z].map((v,i)=>Math.round((v-min.getComponent(i))/size)).join(','),pos=(k:string)=>new T.Vector3(...k.split(',').map((v,i)=>Number(v)*size+min.getComponent(i))),start=key(a),goal=key(b),open=new Set([start]),g=new Map([[start,0]]),prior=new Map<string,string>(),cache=new Map<string,boolean>(),closed=new Set<string>();let end='';
  for(let tries=0;open.size&&tries<24000;tries++){let current='',score=Infinity;for(const k of open){const v=g.get(k)!+pos(k).distanceTo(b);if(v<score){score=v;current=k;}}open.delete(current);const p=current===start?a:pos(current);if((current===goal||p.distanceTo(b)<1)&&this.segment(p,b)){end=current;break;}closed.add(current);
   for(const [x,y,z] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,0,1],[1,0,-1],[-1,0,1],[-1,0,-1]]){const q=pos(current).add(new T.Vector3(x*size,y*size,z*size));if(q.x<min.x||q.x>max.x||q.y<min.y||q.y>max.y||q.z<min.z||q.z>max.z)continue;const k=key(q);if(closed.has(k))continue;let ok=cache.get(k);if(ok===undefined){ok=this.clear(q);cache.set(k,ok);}if(!ok||!this.segment(p,q))continue;const next=g.get(current)!+p.distanceTo(q);if(next<(g.get(k)??Infinity)){prior.set(k,current);g.set(k,next);open.add(k);}}
  }
  if(!end)throw Error('No clear tour route near '+this.lastBlock);const reverse=[b];while(end!==start){reverse.push(pos(end));end=prior.get(end)!;}reverse.push(a);const raw=reverse.reverse(),result=[a];let i=0;while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!this.segment(raw[i],raw[j]))j--;result.push(raw[j]);i=j;}return result;
 }
 inspect(){return{triangles:this.triangles,checks:this.checks,radius:this.radius,lastBlock:this.lastBlock};}
 dispose(){this.cells.clear();this.obstacles=[];this.triangles=0;}
}
/** Arc-length parameterisation plus easing avoids speed changes at control points. */
export class TourMotion{
 elapsed=0;readonly duration:number;readonly length:number;readonly points:T.Vector3[];private distances:number[]=[0];private fromQ:T.Quaternion;private toQ:T.Quaternion;
 constructor(private orbit:OrbitMode,private from:TourPose,private to:TourPose,route:T.Vector3[],clearance:TourClearance,private render:()=>void,speed=1.4,private orientationDelay=0){
  let samples:T.Vector3[]=[];
  // Only accept a rounded path after checking every sample with the camera clearance sphere.
  if(route.length>2){const curve=new T.CatmullRomCurve3(route,false,'centripetal');samples=curve.getSpacedPoints(Math.max(32,Math.ceil(curve.getLength()/.06)));if(!samples.every(p=>clearance.clear(p)))samples=[];}
  if(!samples.length&&route.length>2)for(const radius of [1,.5,.2,.08,.025]){const path=new T.CurvePath<T.Vector3>();let previous=route[0];for(let i=1;i<route.length-1;i++){const corner=route[i],a=route[i-1],b=route[i+1],trim=Math.min(radius,corner.distanceTo(a)*.4,corner.distanceTo(b)*.4),entry=corner.clone().addScaledVector(a.clone().sub(corner).normalize(),trim),exit=corner.clone().addScaledVector(b.clone().sub(corner).normalize(),trim);path.add(new T.LineCurve3(previous,entry));path.add(new T.QuadraticBezierCurve3(entry,corner,exit));previous=exit;}path.add(new T.LineCurve3(previous,route.at(-1)!));const candidate=path.getSpacedPoints(Math.max(32,Math.ceil(path.getLength()/.04)));if(candidate.every(p=>clearance.clear(p))){samples=candidate;break;}}
  if(!samples.length){if(route.length>2)throw Error('Unable to round a clear tour route');samples=[route[0]];const n=Math.max(1,Math.ceil(route[0].distanceTo(route[1])/.06));for(let j=1;j<=n;j++)samples.push(route[0].clone().lerp(route[1],j/n));}
  if(!samples.every(p=>clearance.clear(p)))throw Error('Tour camera clearance blocked by '+clearance.lastBlock);
  this.points=samples;for(let i=1;i<samples.length;i++)this.distances.push(this.distances[i-1]+samples[i-1].distanceTo(samples[i]));this.length=this.distances.at(-1)!;this.duration=Math.max(1.8,this.length/speed);
  const rotation=(s:TourPose)=>new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(point(s.position),point(s.target),new T.Vector3(0,1,0)));this.fromQ=rotation(from);this.toQ=rotation(to);orbit.cancelTransition();
 }
 update(dt:number){this.elapsed=Math.min(this.duration,this.elapsed+dt);const t=smooth(this.elapsed/this.duration),distance=t*this.length;let i=1;while(i<this.distances.length-1&&this.distances[i]<distance)i++;const a=this.distances[i-1],b=this.distances[i],position=this.points[i-1].clone().lerp(this.points[i],b>a?(distance-a)/(b-a):1),orientation=this.orientationDelay?smooth(T.MathUtils.clamp((t-this.orientationDelay)/(1-this.orientationDelay),0,1)):t,q=this.fromQ.clone().slerp(this.toQ,orientation),lookDistance=T.MathUtils.lerp(point(this.from.position).distanceTo(point(this.from.target)),point(this.to.position).distanceTo(point(this.to.target)),t),target=position.clone().add(new T.Vector3(0,0,-1).applyQuaternion(q).multiplyScalar(lookDistance));
  this.orbit.restoreState({position,target,fov:T.MathUtils.lerp(this.from.fov,this.to.fov,t)});this.render();return this.elapsed===this.duration;
 }
 inspect(){return{elapsed:this.elapsed,duration:this.duration,length:this.length,samples:this.points.length,route:this.points.filter((_,i)=>i%20===0).map(p=>p.toArray())};}
}
