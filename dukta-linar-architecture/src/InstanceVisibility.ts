import {Camera,DynamicDrawUsage,Frustum,InstancedMesh,Matrix4,Object3D,Sphere} from 'three';
/** Cull individual instances, rather than drawing the entire street-wide batch.
 * All source transforms remain stored. Shadow refreshes use every instance. */
export class InstanceVisibility{
 private batches:{mesh:InstancedMesh;original:Float32Array;spheres:Sphere[];count:number}[]=[];
 private frustum=new Frustum();
 private projection=new Matrix4();
 private previous=new Matrix4();
 private dirty=true;
 total=0;visible=0;
 register(root:Object3D){
  root.updateWorldMatrix(true,true);
  root.traverse(o=>{if(!(o instanceof InstancedMesh))return;
   o.geometry.computeBoundingSphere();o.computeBoundingSphere();const original=new Float32Array(o.instanceMatrix.array),spheres:Sphere[]=[];
   for(let i=0;i<o.count;i++){const matrix=new Matrix4().fromArray(original,i*16);matrix.premultiply(o.matrixWorld);spheres.push(o.geometry.boundingSphere!.clone().applyMatrix4(matrix));}
   o.userData.collisionInstanceMatrices=original;o.userData.collisionInstanceCount=o.count;
   this.batches.push({mesh:o,original,spheres,count:o.count});this.total+=o.count;o.instanceMatrix.setUsage(DynamicDrawUsage);
  });this.dirty=true;
 }
 update(camera:Camera,shadowRefresh:boolean){
  if(shadowRefresh){for(const b of this.batches){b.mesh.instanceMatrix.array.set(b.original);b.mesh.instanceMatrix.needsUpdate=true;b.mesh.count=b.count;}this.visible=this.total;this.dirty=true;return;}
  camera.updateMatrixWorld();this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(!this.dirty&&this.projection.equals(this.previous))return;
  this.previous.copy(this.projection);this.dirty=false;this.frustum.setFromProjectionMatrix(this.projection);this.visible=0;
  for(const b of this.batches){let count=0;for(let i=0;i<b.count;i++)if(this.frustum.intersectsSphere(b.spheres[i])){b.mesh.instanceMatrix.array.set(b.original.subarray(i*16,i*16+16),count*16);count++;}b.mesh.count=count;b.mesh.instanceMatrix.needsUpdate=true;this.visible+=count;}
 }
}
