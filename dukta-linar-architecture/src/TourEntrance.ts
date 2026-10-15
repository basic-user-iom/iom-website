import * as T from 'three';
/** The actual two F_02 door leaves. Keep the fixed E_01 surround untouched. */
export class TourEntrance{
 private leaves:T.Group[]=[];amount=0;sourceTriangles=0;
 attach(root:T.Group){
  root.updateWorldMatrix(true,true);const originals:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&/^AE35_010_window_F_02(?:_|$)/.test(o.name))originals.push(o);});
  const inverse=root.matrixWorld.clone().invert(),split=-32.7036486,pivots=[-33.8684675,-31.5388296];
  this.leaves=pivots.map((z,i)=>{const g=new T.Group();g.name='WEB_Tour_Entrance_Leaf_'+i;g.position.set(25.267,0,z);g.userData.tourDynamic=true;root.add(g);return g;});
  for(const original of originals){const source=original.geometry.index?original.geometry.toNonIndexed():original.geometry.clone(),g=new T.BufferGeometry();
   // GLB positions, normals and UVs are normalized integers. Decode before any
   // transform: writing world coordinates into Int16 attributes would overflow.
   for(const [name,a] of Object.entries(source.attributes)){const values=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.getComponent(i,k);g.setAttribute(name,new T.BufferAttribute(values,a.itemSize));}source.dispose();
   g.applyMatrix4(original.matrixWorld);g.applyMatrix4(inverse);const p=g.getAttribute('position'),parts=[[] as number[],[] as number[]];
   for(let i=0;i<p.count;i+=3){const z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;parts[z<split?0:1].push(i,i+1,i+2);this.sourceTriangles++;}
   parts.forEach((indices,leaf)=>{if(!indices.length)return;const copy=new T.BufferGeometry();for(const [name,a] of Object.entries(g.attributes)){const values=new Float32Array(indices.length*a.itemSize);indices.forEach((index,j)=>{for(let k=0;k<a.itemSize;k++)values[j*a.itemSize+k]=(a.array as ArrayLike<number>)[index*a.itemSize+k];});copy.setAttribute(name,new T.BufferAttribute(values,a.itemSize,a.normalized));}copy.translate(-25.267,0,-pivots[leaf]);const mesh=new T.Mesh(copy,original.material);mesh.name='WEB_Tour_Door_'+leaf+'_'+original.name;mesh.castShadow=original.castShadow;mesh.receiveShadow=original.receiveShadow;mesh.userData.tourDynamic=true;this.leaves[leaf].add(mesh);});
   g.dispose();original.visible=false;original.userData.tourDoorHidden=true;
  }
  if(!originals.length)throw Error('The existing entrance door was not found');root.updateWorldMatrix(true,true);
 }
 set(amount:number){this.amount=T.MathUtils.clamp(amount,0,1);this.leaves.forEach((g,i)=>{g.rotation.y=(i===0?1:-1)*Math.PI*.5*this.amount;g.updateMatrix();g.updateWorldMatrix(true,true);});}
 inspect(){return{amount:this.amount,leaves:this.leaves.length,sourceTriangles:this.sourceTriangles,opening:'Existing F_02 double door; E_01 surround stays fixed'};}
}
