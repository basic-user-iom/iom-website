import * as T from 'three';
import {Octree} from 'three/addons/math/Octree.js';
import {Capsule} from 'three/addons/math/Capsule.js';

export const WALK_FLOOR=.30035,WALK_RADIUS=.23,WALK_EYE=1.6;
// A fixed horizontal grid avoids recursive subdivision of coplanar architectural
// triangles. The narrow phase is Three's capsule/triangle solver, unchanged.
class CapsuleGrid extends Octree{
 private cells=new Map<string,T.Triangle[]>();
 override build(){this.cells.clear();for(const triangle of this.triangles){const b=new T.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]);for(let x=Math.max(20,Math.floor(b.min.x));x<=Math.min(53,Math.floor(b.max.x));x++)for(let z=Math.max(-60,Math.floor(b.min.z));z<=Math.min(-26,Math.floor(b.max.z));z++){const key=`${x},${z}`,cell=this.cells.get(key)??[];cell.push(triangle);this.cells.set(key,cell);}}return this;}
 override getCapsuleTriangles(capsule:Capsule,triangles:T.Triangle[]){const seen=new Set<T.Triangle>();for(let x=Math.floor(Math.min(capsule.start.x,capsule.end.x)-capsule.radius);x<=Math.floor(Math.max(capsule.start.x,capsule.end.x)+capsule.radius);x++)for(let z=Math.floor(Math.min(capsule.start.z,capsule.end.z)-capsule.radius);z<=Math.floor(Math.max(capsule.start.z,capsule.end.z)+capsule.radius);z++)for(const triangle of this.cells.get(`${x},${z}`)??[])if(!seen.has(triangle)){seen.add(triangle);triangles.push(triangle);}return triangles;}
}
/** A standing capsule, swept in small steps against both sides of source triangles. */
export class WalkWorld{
 private tree=new CapsuleGrid();private floors:T.Triangle[]=[];triangles=0;sources=new Set<string>();
 private region=new T.Box3(new T.Vector3(20,WALK_FLOOR-.05,-60),new T.Vector3(53,WALK_FLOOR+1.9,-26));
 private capsule(p:T.Vector3){return new Capsule(new T.Vector3(p.x,WALK_FLOOR+WALK_RADIUS+.005,p.z),new T.Vector3(p.x,WALK_FLOOR+1.7-WALK_RADIUS,p.z),WALK_RADIUS);}
 addTriangle(a:T.Vector3,b:T.Vector3,c:T.Vector3,name='test'){
  const tri=new T.Triangle(a,b,c),box=new T.Box3().setFromPoints([a,b,c]);if(!box.intersectsBox(this.region)||tri.getArea()<1e-10)return;
  this.tree.addTriangle(tri);this.tree.addTriangle(new T.Triangle(c.clone(),b.clone(),a.clone()));this.triangles+=2;this.sources.add(name);
 }
 addBox(box:T.Box3,name:string){const {min:a,max:b}=box,pts=[[a.x,a.y,a.z],[b.x,a.y,a.z],[b.x,a.y,b.z],[a.x,a.y,b.z],[a.x,b.y,a.z],[b.x,b.y,a.z],[b.x,b.y,b.z],[a.x,b.y,b.z]].map(p=>new T.Vector3(...p));for(const [i,j,k,l] of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){this.addTriangle(pts[i],pts[j],pts[k],name);this.addTriangle(pts[i],pts[k],pts[l],name);}}
 addFloor(a:T.Vector3,b:T.Vector3,c:T.Vector3){this.floors.push(new T.Triangle(a,b,c));}
 build(){this.tree.build();}
 rebuild(roots:T.Object3D[],panels:T.Object3D[]){this.tree=new CapsuleGrid();this.floors=[];this.triangles=0;this.sources.clear();
  for(const root of roots){root.updateWorldMatrix(true,true);root.traverse(o=>{if(!(o instanceof T.Mesh)||!o.visible)return;const p=o.geometry.getAttribute('position');if(!p)return;const index=o.geometry.index,localBounds=o.geometry.boundingBox??(o.geometry.computeBoundingBox(),o.geometry.boundingBox!),matrices:T.Matrix4[]=[];
   if(o instanceof T.InstancedMesh){for(let i=0;i<(o.userData.collisionInstanceCount??o.count);i++){const m=new T.Matrix4();if(o.userData.collisionInstanceMatrices)m.fromArray(o.userData.collisionInstanceMatrices,i*16);else o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);if(localBounds.clone().applyMatrix4(m).intersectsBox(this.region))matrices.push(m);}}else if(localBounds.clone().applyMatrix4(o.matrixWorld).intersectsBox(this.region))matrices.push(o.matrixWorld);
   const floor=/carpets/i.test(o.name)||(Array.isArray(o.material)?o.material:[o.material]).some(m=>/carpets/i.test(m.name));
   for(const matrix of matrices)for(let i=0;i<(index?.count??p.count);i+=3){const pts=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(matrix));if(floor&&pts.every(v=>Math.abs(v.y-WALK_FLOOR)<.04)){this.addFloor(...pts as [T.Vector3,T.Vector3,T.Vector3]);continue;}if(pts.every(v=>v.y<WALK_FLOOR+.06)||pts.every(v=>v.y>WALK_FLOOR+1.85))continue;const n=new T.Triangle(...pts as [T.Vector3,T.Vector3,T.Vector3]).getNormal(new T.Vector3());if(Math.abs(n.y)>.9)continue;this.addTriangle(...pts as [T.Vector3,T.Vector3,T.Vector3],o.name);}
  });}
  // A person cannot pass through 4 mm cuts. Join lamella centres into a continuous collision surface.
  for(const root of panels){root.updateWorldMatrix(true,true);root.traverseVisible(o=>{if(!(o instanceof T.InstancedMesh)||!/4mm_slats/.test(o.name))return;const rows:{lo:T.Vector3;hi:T.Vector3}[]=[];for(let i=0;i<(o.userData.collisionInstanceCount??o.count);i++){const m=new T.Matrix4();if(o.userData.collisionInstanceMatrices)m.fromArray(o.userData.collisionInstanceMatrices,i*16);else o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);const lo=new T.Vector3(0,-.5,0).applyMatrix4(m),hi=new T.Vector3(0,.5,0).applyMatrix4(m);rows.push({lo,hi});}for(let i=0;i<rows.length-1;i++){this.addTriangle(rows[i].lo,rows[i+1].lo,rows[i+1].hi,o.name);this.addTriangle(rows[i].lo,rows[i+1].hi,rows[i].hi,o.name);}});}
  // The counter's occupied footprint remains solid, including its overhanging cladding.
  for(const root of roots){const desk=root.getObjectByName('AE35_010_reception_04');if(desk){const bounds=new T.Box3().setFromObject(desk);if(!bounds.isEmpty())this.addBox(bounds.expandByScalar(.02),'Reception desk footprint');}}
  this.build();
 }
 onFloor(p:T.Vector3){if(p.x<this.region.min.x+WALK_RADIUS||p.x>this.region.max.x-WALK_RADIUS||p.z<this.region.min.z+WALK_RADIUS||p.z>this.region.max.z-WALK_RADIUS)return false;return [[0,0],[WALK_RADIUS,0],[-WALK_RADIUS,0],[0,WALK_RADIUS],[0,-WALK_RADIUS]].every(([x,z])=>{const q=new T.Vector3(p.x+x,WALK_FLOOR,p.z+z);return this.floors.some(t=>{const projected=t.getPlane(new T.Plane()).projectPoint(q,new T.Vector3());return t.containsPoint(projected);});});}
 clear(p:T.Vector3){if(!this.onFloor(p))return false;const hit=this.tree.capsuleIntersect(this.capsule(p));return !hit||hit.depth<.0005;}
 move(position:T.Vector3,delta:T.Vector3){const result=position.clone(),horizontal=new T.Vector3(delta.x,0,delta.z),steps=Math.max(1,Math.ceil(horizontal.length()/(WALK_RADIUS*.25))),step=horizontal.divideScalar(steps);
  for(let i=0;i<steps;i++){const prior=result.clone(),next=result.clone().add(step);if(!this.onFloor(next)){const xOnly=result.clone().add(new T.Vector3(step.x,0,0)),zOnly=result.clone().add(new T.Vector3(0,0,step.z));if(this.onFloor(xOnly))next.copy(xOnly);else if(this.onFloor(zOnly))next.copy(zOnly);else continue;}
   for(let k=0;k<6;k++){const hit=this.tree.capsuleIntersect(this.capsule(next));if(!hit||hit.depth<1e-5)break;const normal=new T.Vector3(hit.normal.x,0,hit.normal.z),len=normal.length();if(len<1e-5){next.copy(prior);break;}next.addScaledVector(normal.normalize(),(hit.depth+.00005)/len);}
   if(this.clear(next)&&next.distanceTo(prior)<step.length()+.1)result.copy(next);
  }result.y=WALK_FLOOR+WALK_EYE;return result;
 }
 safeStart(p:T.Vector3){const start=p.clone();start.y=WALK_FLOOR+WALK_EYE;if(this.clear(start))return start;for(let radius=.3;radius<=3;radius+=.3)for(let i=0;i<24;i++){const q=start.clone().add(new T.Vector3(Math.cos(i*Math.PI/12)*radius,0,Math.sin(i*Math.PI/12)*radius));if(this.clear(q))return q;}const fallback=new T.Vector3(37,WALK_FLOOR+WALK_EYE,-33);return this.clear(fallback)?fallback:null;}
 inspect(){return{triangles:this.triangles,floorTriangles:this.floors.length,sources:[...this.sources],radius:WALK_RADIUS,eyeHeight:WALK_EYE,floorY:WALK_FLOOR};}
}
