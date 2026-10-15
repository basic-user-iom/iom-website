import * as T from 'three';
type Batch={dirty:boolean;id:string;mesh:T.InstancedMesh;material:T.Material|T.Material[];original:Float32Array;spheres:T.Sphere[];bounds:T.Box3;count:number;lods:T.BufferGeometry[]};
/** Cull actual solid instances in close views; restore every caster while
 * refreshing cached shadows. Distance only simplifies the routed arc. */
export class LinarSolidVisibility{
 readonly shadowMaterial=new T.MeshBasicMaterial({name:'LINAR_Physical_Shadow_Only',colorWrite:false,depthWrite:false,side:T.FrontSide});
 private batches:Batch[]=[];private frustum=new T.Frustum();private previous=new T.Matrix4();private dirty=true;
 remove(id:string){const old=this.batches.filter(b=>b.id===id);for(const b of old)b.mesh.material=b.material;this.batches=this.batches.filter(b=>b.id!==id);this.dirty=true;return new Set(old.flatMap(b=>b.lods));}
 private measure(batch:Batch){
  const mesh=batch.mesh;mesh.updateWorldMatrix(true,false);const geometry=batch.lods[0];if(!geometry.boundingBox)geometry.computeBoundingBox();if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  // Affine AABB centre/extents avoid eight corner transforms per instance.
  const a=batch.original,box=geometry.boundingBox!,sphere=geometry.boundingSphere!,cx=(box.min.x+box.max.x)/2,cy=(box.min.y+box.max.y)/2,cz=(box.min.z+box.max.z)/2,ex=(box.max.x-box.min.x)/2,ey=(box.max.y-box.min.y)/2,ez=(box.max.z-box.min.z)/2,worldScale=mesh.matrixWorld.getMaxScaleOnAxis();
  mesh.boundingBox??=new T.Box3();mesh.boundingBox.makeEmpty();const min=mesh.boundingBox.min,max=mesh.boundingBox.max;
  for(let i=0;i<batch.count;i++){const j=i*16,x=a[j]*cx+a[j+4]*cy+a[j+8]*cz+a[j+12],y=a[j+1]*cx+a[j+5]*cy+a[j+9]*cz+a[j+13],z=a[j+2]*cx+a[j+6]*cy+a[j+10]*cz+a[j+14],dx=Math.abs(a[j])*ex+Math.abs(a[j+4])*ey+Math.abs(a[j+8])*ez,dy=Math.abs(a[j+1])*ex+Math.abs(a[j+5])*ey+Math.abs(a[j+9])*ez,dz=Math.abs(a[j+2])*ex+Math.abs(a[j+6])*ey+Math.abs(a[j+10])*ez;
   min.x=Math.min(min.x,x-dx);min.y=Math.min(min.y,y-dy);min.z=Math.min(min.z,z-dz);max.x=Math.max(max.x,x+dx);max.y=Math.max(max.y,y+dy);max.z=Math.max(max.z,z+dz);
   const bound=batch.spheres[i]??=new T.Sphere(),c=sphere.center;bound.center.set(a[j]*c.x+a[j+4]*c.y+a[j+8]*c.z+a[j+12],a[j+1]*c.x+a[j+5]*c.y+a[j+9]*c.z+a[j+13],a[j+2]*c.x+a[j+6]*c.y+a[j+10]*c.z+a[j+14]).applyMatrix4(mesh.matrixWorld);bound.radius=sphere.radius*worldScale*Math.sqrt(Math.max(a[j]**2+a[j+1]**2+a[j+2]**2,a[j+4]**2+a[j+5]**2+a[j+6]**2,a[j+8]**2+a[j+9]**2+a[j+10]**2));
  }
  mesh.boundingSphere??=new T.Sphere();mesh.boundingBox.getBoundingSphere(mesh.boundingSphere);batch.bounds.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
  mesh.userData.collisionInstanceMatrices=batch.original;mesh.userData.collisionInstanceCount=batch.count;
 }
 register(id:string,mesh:T.InstancedMesh,lods:T.BufferGeometry[]){
  const batch:Batch={dirty:true,id,mesh,material:mesh.material,original:new Float32Array(mesh.instanceMatrix.array),spheres:[],bounds:new T.Box3(),count:mesh.count,lods};this.measure(batch);this.batches.push(batch);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.dirty=true;
 }
 refresh(id:string){for(const b of this.batches)if(b.id===id){b.original.set(b.mesh.instanceMatrix.array);this.measure(b);b.dirty=true;}this.dirty=true;}

 update(camera:T.Camera,shadowRefresh:boolean){
  camera.updateMatrixWorld();const projection=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(!this.dirty&&!shadowRefresh&&projection.equals(this.previous))return;const cameraChanged=!projection.equals(this.previous);this.previous.copy(projection);this.frustum.setFromProjectionMatrix(projection);
  for(const b of this.batches){if(!cameraChanged&&!shadowRefresh&&!b.dirty)continue;b.dirty=shadowRefresh;b.mesh.material=b.material;const distance=b.bounds.distanceToPoint(camera.position),lod=shadowRefresh?1:distance<.8?2:distance<2.5?1:0;b.mesh.geometry=b.lods[Math.min(lod,b.lods.length-1)];
   if(shadowRefresh){b.mesh.instanceMatrix.array.set(b.original);b.mesh.count=b.count;}else{let count=0;for(let i=0;i<b.count;i++)if(this.frustum.intersectsSphere(b.spheres[i])){b.mesh.instanceMatrix.array.set(b.original.subarray(i*16,i*16+16),count*16);count++;}b.mesh.count=count;}
   b.mesh.instanceMatrix.needsUpdate=true;
  }this.dirty=shadowRefresh;
 }
 inspect(){return this.batches.map(b=>({application:b.id,name:b.mesh.name,total:b.count,visible:b.mesh.count,profileSteps:b.mesh.geometry.userData.steps??null,triangles:(b.mesh.geometry.index?.count??b.mesh.geometry.getAttribute('position').count)/3*b.mesh.count}));}
}
