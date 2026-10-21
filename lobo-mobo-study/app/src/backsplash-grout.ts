import * as THREE from 'three';

/** Fill the backsplash joints just below the tile faces, leaving floor grout intact. */
export function refineBacksplashGrout(room:THREE.Object3D){
 room.updateMatrixWorld(true);
 const tiles=new THREE.Box3();
 room.traverse(o=>{if(o instanceof THREE.Mesh&&!Array.isArray(o.material)&&o.material.name==='PBR | ambientCG Tiles036 | glazed backsplash')tiles.union(new THREE.Box3().setFromObject(o));});
 if(tiles.isEmpty())return;
 const point=new THREE.Vector3();
 room.traverse(o=>{
  if(!(o instanceof THREE.Mesh)||Array.isArray(o.material)||o.material.name!=='Fine warm grout')return;
  const positions=o.geometry.getAttribute('position'),wall:number[]=[];let front=-Infinity;
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);
   // This asset merges the wall and floor backing. Select only the wall component.
   if(point.y<tiles.min.y-.01||point.y>tiles.max.y+.01||point.x<tiles.min.x-.02||point.x>tiles.max.x+.02||point.z<tiles.min.z-.05||point.z>tiles.max.z)continue;
   wall.push(i);front=Math.max(front,point.z);
  }
  const recess=tiles.max.z-front;
  if(!wall.length||recess<.01||recess>.03)return;
  // The exported 17.5 mm recess exposed upward-facing tile sides only half a
  // screen pixel wide in the close-up. A shallow, 0.75 mm joint removes that deep
  // crevice while retaining the original ceramic bevel, material and shadows.
  const offset=tiles.max.z-.00075-front,inverse=o.matrixWorld.clone().invert();
  o.geometry=o.geometry.clone();const adjusted=o.geometry.getAttribute('position');
  for(const i of wall){point.fromBufferAttribute(adjusted,i).applyMatrix4(o.matrixWorld);point.z+=offset;point.applyMatrix4(inverse);adjusted.setXYZ(i,point.x,point.y,point.z);}
  adjusted.needsUpdate=true;o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
 });
}
