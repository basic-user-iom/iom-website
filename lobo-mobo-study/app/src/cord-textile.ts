import * as THREE from 'three';
import type {FinishId} from './materials';

/** One textile sheath across reviewed cords and their ceiling extensions. */
export class CordTextile {
  readonly material:THREE.MeshStandardMaterial;
  private grip:THREE.MeshStandardMaterial;
  private extensions=0;
  private extensionMeshes:THREE.Mesh[]=[];
  private positionChecks=true;
  private textures:THREE.Texture[];
  private constructor(textures:THREE.Texture[],grip:THREE.MeshStandardMaterial){
    this.textures=textures;this.grip=grip;
    this.material=new THREE.MeshStandardMaterial({name:'Cord | ambientCG Fabric036 | woven textile',map:textures[0],roughnessMap:textures[1],normalMap:textures[2],metalness:0,roughness:.95,normalScale:new THREE.Vector2(.23,.23)});
  }
  static async create(lamp:THREE.Object3D){
    const textures=await Promise.all(['color','roughness','normal'].map(n=>new THREE.TextureLoader().loadAsync(`./room/textile/${n}.jpg`)));
    textures.forEach((t,i)=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.colorSpace=i===0?THREE.SRGBColorSpace:THREE.NoColorSpace;});
    const cord=lamp.getObjectByName('MOBO_Cord') as THREE.Mesh,grip=(lamp.getObjectByName('MOBO_CordGrip') as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const result=new CordTextile(textures,grip);cord.geometry=cord.geometry.toNonIndexed();result.mapCylinder(cord.geometry,0,0,.0075);cord.material=result.material;return result;
  }
  private mapCylinder(geometry:THREE.BufferGeometry,cx:number,cz:number,radius:number){
    const p=geometry.getAttribute('position'),uv=new Float32Array(p.count*2),period=2*Math.PI*radius;
    // Integer bias transform is periodic at the cylindrical seam; unwrap each existing triangle.
    for(let i=0;i<p.count;i+=3){const us=[0,1,2].map(j=>Math.atan2(p.getZ(i+j)-cz,p.getX(i+j)-cx)/(2*Math.PI)+.5),crosses=Math.max(...us)-Math.min(...us)>.5;
      for(let j=0;j<3;j++){const u=us[j]+(crosses&&us[j]<.5?1:0),v=p.getY(i+j)/period;uv[(i+j)*2]=u+v;uv[(i+j)*2+1]=v-u;}}
    const normal=geometry.getAttribute('normal');
    for(let i=0;i<p.count;i+=3){const cap=Math.max(p.getY(i),p.getY(i+1),p.getY(i+2))-Math.min(p.getY(i),p.getY(i+1),p.getY(i+2))<1e-7;
      for(let j=0;j<3;j++){const k=i+j;if(cap)normal.setXYZ(k,0,Math.sign(normal.getY(k)),0);else{const n=new THREE.Vector3(p.getX(k)-cx,0,p.getZ(k)-cz).normalize();normal.setXYZ(k,n.x,0,n.z);}}}
    normal.needsUpdate=true;
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  attachRoomExtensions(room:THREE.Object3D){
    room.updateMatrixWorld(true);const additions:THREE.Mesh[]=[];
    room.traverse(o=>{if(!(o instanceof THREE.Mesh)||Array.isArray(o.material)||o.material.name!=='Charcoal linen seat')return;
      const source=o.geometry,position=source.getAttribute('position'),index=source.index;if(!index)return;
      const world=Array.from({length:position.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld));
      const belongs=(v:THREE.Vector3)=>v.y>2.40&&v.y<3.301&&Math.abs(v.z-.32)<.0041&&Math.min(Math.abs(v.x-.78),Math.abs(v.x+.78))<.0041;
      const keep:number[]=[],cords:[number[],number[]]=[[],[]];
      for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(ids.every(j=>belongs(world[j])))cords[world[ids[0]].x<0?0:1].push(...ids);else keep.push(...ids);}
      if(!cords.every(c=>c.length))throw new Error('Ceiling cord extensions were not resolved.');
      o.geometry=source.clone();o.geometry.setIndex(keep);
      for(const [part,ids]of cords.entries()){
        // Only these existing triangles move to a separate material; position, silhouette and triangle count are retained.
        const g=source.clone();g.setIndex(ids);const p=new Float32Array(position.count*3),n=new Float32Array(position.count*3),normalMatrix=new THREE.Matrix3().getNormalMatrix(o.matrixWorld),normal=source.getAttribute('normal');
        for(let i=0;i<position.count;i++){world[i].toArray(p,i*3);new THREE.Vector3().fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix).toArray(n,i*3);}
        g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));const mapped=g.toNonIndexed();g.dispose();this.mapCylinder(mapped,part===0?-.78:.78,.32,.003);
        const mesh=new THREE.Mesh(mapped,this.material);mesh.name=`Textile_Ceiling_Extension_${part+1}`;mesh.castShadow=true;mesh.receiveShadow=true;additions.push(mesh);this.extensions++;
      }
      this.positionChecks=keep.length+cords[0].length+cords[1].length===index.count;
    });additions.forEach(m=>room.add(m));this.extensionMeshes=additions;
  }
  apply(finish:FinishId){
    const white=finish==='reference-white'||finish==='shell-white',black=finish==='reference-black';
    this.material.color.set(white?'#f3f1ee':'#b3a08a');this.material.roughness=.95;
    this.grip.color.set(white?'#e6e6e6':black?'#151619':'#c3a265');this.grip.metalness=white?.98:black?.80:.85;this.grip.roughness=white?.13:black?.17:.22;
  }
  snapshot(){return{extensions:this.extensions,triangleCountPreserved:this.positionChecks,extensionBounds:this.extensionMeshes.map(m=>{const b=new THREE.Box3().setFromObject(m);return{min:b.min.toArray(),max:b.max.toArray(),sharedMaterial:m.material===this.material};}),source:'ambientCG Fabric036',license:'CC0',color:this.material.color.getHexString(),roughness:this.material.roughness,metalness:this.material.metalness,normalScale:this.material.normalScale.toArray(),maps:[this.material.map,this.material.roughnessMap,this.material.normalMap].map(t=>({space:t?.colorSpace,width:(t?.image as {width:number}|undefined)?.width})),grip:{color:this.grip.color.getHexString(),roughness:this.grip.roughness,metalness:this.grip.metalness}};}
  dispose(){this.textures.forEach(t=>t.dispose());}
}

