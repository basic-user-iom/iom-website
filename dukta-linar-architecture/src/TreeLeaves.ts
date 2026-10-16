import {loadAsset} from './DeviceProfile';
import * as T from 'three';
import uvRecovery from './treeUVRecovery.json';
import {restoreBranchUV} from './BranchUV';
/** Correct source material assignments on the working scene; keep source GLBs,
 * restore leaf UV channels and bark mapping without editing source GLBs. */
export class TreeLeaves{
 private corrected=new Set<T.MeshStandardMaterial>();private treeC?:Promise<T.Texture>;
 private uvFiles=new Map<string,Promise<Float32Array>>();private recovered=new WeakSet<T.BufferGeometry>();
 private barkMapped=new WeakSet<T.BufferGeometry>();private barkMaterials=new Set<T.MeshStandardMaterial>();
 readonly recoveredUV:{mesh:string;vertices:number;sourceLayer:string;file:string}[]=[];
 readonly assignments:{mesh:string;from:string;to:string;triangles:number;instances:number}[]=[];
 async apply(root:T.Object3D){
  root.updateWorldMatrix(true,true);const meshes:T.Mesh[]=[];let leafA:T.MeshStandardMaterial|undefined;
  root.traverse(o=>{if(o instanceof T.Mesh){meshes.push(o);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&/tree_A_leaf_diff/.test(m.name))leafA=m;}});
  const all=meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]);const barkA=all.find(m=>/tree_A_trunk_diffuse/.test(m.name)) as T.MeshStandardMaterial|undefined,barkB=all.find(m=>/tree_B_004/.test(m.name)) as T.MeshStandardMaterial|undefined;
  const aBark=barkA?.clone(),bBark=barkB?.clone();if(aBark)aBark.name='TreeA-Bark-Corrected';if(bBark)bBark.name='TreeB-Bark-Corrected';
  for(const mesh of meshes){const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   const isGradient=mats.some(m=>/tree_[AB]_gradient/.test(m.name)),isCBark=mats.some(m=>/tree_C_trunk/.test(m.name));
   if((isGradient||isCBark)&&!this.barkMapped.has(mesh.geometry)){restoreBranchUV(mesh);this.barkMapped.add(mesh.geometry);}
   if(!this.recovered.has(mesh.geometry)){const old=mesh.geometry.getAttribute('uv'),entry=old?uvRecovery.find(e=>e.vertices===old.count&&mats.some(m=>m.name===e.material)&&Math.abs(old.getX(0)-e.firstUV[0])<.00001&&Math.abs(old.getY(0)-e.firstUV[1])<.00001):undefined;
    if(entry){if(!this.uvFiles.has(entry.file))this.uvFiles.set(entry.file,fetch(`${import.meta.env.BASE_URL}materials/foliage/${entry.file}`).then(async r=>{if(!r.ok)throw new Error('Original tree UV recovery failed');return new Float32Array(await r.arrayBuffer());}));const uv=await this.uvFiles.get(entry.file)!;if(uv.length!==old.count*2)throw new Error('Original tree UV count mismatch');mesh.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));mesh.geometry.deleteAttribute('tangent');this.recovered.add(mesh.geometry);this.recoveredUV.push({mesh:mesh.name,vertices:old.count,sourceLayer:entry.originalLayer,file:entry.file});}
   }
   const next=await Promise.all(mats.map(async material=>{if(!(material instanceof T.MeshStandardMaterial))return material;let m=material;
    // Audit: this exported A primitive contains 4,339 disconnected leaf cards,
    // each one/two triangles, with leaf UVs. The trunk is in gradient primitives.
    if(leafA&&m.name==='AE35_010_034_012_AE35_010_tree_A_trunk_diffuse_CC1'){
     this.assignments.push({mesh:mesh.name,from:m.name,to:leafA.name,triangles:(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3,instances:mesh instanceof T.InstancedMesh?mesh.count:1});m=leafA;
    }
    if(isGradient){m=(/tree_B/.test(mesh.name)?bBark:aBark)??m;}
    if(isGradient||isCBark||/tree_L_bark|tree_B_004/.test(m.name)){m.metalness=0;m.roughness=.85;m.transparent=false;m.alphaTest=0;m.normalScale.setScalar(.55);m.userData.treeBarkCorrected=true;this.barkMaterials.add(m);m.needsUpdate=true;}
    if(!/tree_[ABCL]_leaf/i.test(m.name)||this.corrected.has(m))return m;
    this.corrected.add(m);
    if(/tree_C_leafs/.test(m.name)){
     const old=m.map;const map=await (this.treeC??=loadAsset(`materials/foliage/TreeC-ColorAlpha.webp`,url=>new T.TextureLoader().loadAsync(url)));map.name='TreeC-ColorAlpha';map.colorSpace=T.SRGBColorSpace;map.flipY=false;map.wrapS=old?.wrapS??T.RepeatWrapping;map.wrapT=old?.wrapT??T.RepeatWrapping;map.anisotropy=4;if(old){map.offset.copy(old.offset);map.repeat.copy(old.repeat);map.rotation=old.rotation;map.center.copy(old.center);}m.map=map;m.alphaMap=null;
    }
    m.side=T.DoubleSide;m.shadowSide=T.DoubleSide;m.alphaTest=.4;m.transparent=false;m.opacity=1;m.depthWrite=true;m.metalness=0;m.roughness=.65;m.normalScale.setScalar(.35);if(m instanceof T.MeshPhysicalMaterial){m.clearcoat=0;m.transmission=0;}m.needsUpdate=true;m.userData.treeLeafCorrected=true;return m;
   }));mesh.material=Array.isArray(mesh.material)?next:next[0];
  }
 }
 inspect(root:T.Object3D){const batches:{mesh:string;materials:string[];instances:number;uv:boolean;uvRange:number[];normals:boolean}[]=[];root.traverse(o=>{if(o instanceof T.Mesh){const ms=(Array.isArray(o.material)?o.material:[o.material]).filter(m=>m.userData.treeLeafCorrected);if(ms.length){const uv=o.geometry.getAttribute('uv');let min=Infinity,max=-Infinity;for(let i=0;uv&&i<uv.count;i++){min=Math.min(min,uv.getX(i),uv.getY(i));max=Math.max(max,uv.getX(i),uv.getY(i));}batches.push({mesh:o.name,materials:ms.map(m=>m.uuid),instances:o instanceof T.InstancedMesh?o.instanceMatrix.count:1,uv:!!uv,uvRange:[min,max],normals:!!o.geometry.getAttribute('normal')});}}});return{bark:[...this.barkMaterials].map(m=>({name:m.name,map:m.map?.name,normal:m.normalMap?.name,roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale.toArray(),mapColorSpace:m.map?.colorSpace,normalColorSpace:m.normalMap?.colorSpace})),assignments:this.assignments,recoveredUV:this.recoveredUV,batches,materials:[...this.corrected].map(m=>({id:m.uuid,name:m.name,map:m.map?.name,normal:m.normalMap?.name,side:m.side,shadowSide:m.shadowSide,alphaTest:m.alphaTest,transparent:m.transparent,depthWrite:m.depthWrite,roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale.toArray(),mapColorSpace:m.map?.colorSpace,normalColorSpace:m.normalMap?.colorSpace,flipY:m.map?.flipY}))};}
}

