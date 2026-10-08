// Read-only audit adapted from the supplied E276/E277 Blender review. No model mutations.
import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js'
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
type Tri={v:number[][],lo:number[],hi:number[],name:string,normal:number[]}
async function loadGeometry(url:string){
 const response=await fetch(url);if(!response.ok)throw Error(url+': HTTP '+response.status)
 const data=await response.arrayBuffer(),v=new DataView(data),len=v.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,len)))
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(n=>n.toString(16).padStart(2,'0')).join('')
 const originalMaterials=(j.materials||[]).map((m:any)=>({name:m.name,doubleSided:!!m.doubleSided,alphaMode:m.alphaMode||'OPAQUE'}))
 j.materials=(j.materials||[]).map((m:any)=>({name:m.name,extras:m.extras,doubleSided:!!m.doubleSided,pbrMetallicRoughness:{baseColorFactor:[.6,.6,.6,1]}}))
 delete j.images;delete j.textures;delete j.samplers
 for(const k of ['extensionsUsed','extensionsRequired'])if(j[k])j[k]=j[k].filter((s:string)=>!s.startsWith('KHR_materials_')&&!['KHR_texture_basisu','EXT_texture_webp','KHR_texture_transform'].includes(s))
 const jb=new TextEncoder().encode(JSON.stringify(j)),pad=Math.ceil(jb.length/4)*4,tail=new Uint8Array(data,20+len),bytes=new Uint8Array(20+pad+tail.length),dv=new DataView(bytes.buffer)
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,bytes.length,true);dv.setUint32(12,pad,true);dv.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+pad);bytes.set(jb,20);bytes.set(tail,20+pad)
 const gltf=await loader.parseAsync(bytes.buffer,'')
 return {gltf,evidence:{url,bytes:data.byteLength,sha256,geometryUnchangedInMemory:true,materialImagesOmittedForNumericalAudit:true},originalMaterials}
}
function soup(root:T.Object3D){
 root.updateMatrixWorld(true);const tris:Tri[]=[],names=new Set<string>();let expanded=0
 const region=new T.Box3(new T.Vector3(-64,5,50),new T.Vector3(-46,16,63))
 root.traverse((o:any)=>{
  if(!o.isMesh)return
  const g=o.geometry,p=g.attributes.position,ind=g.index;if(!g.boundingBox)g.computeBoundingBox()
  const count=o.isBatchedMesh?o._instanceInfo.length:o.isInstancedMesh?o.count:1
  for(let instance=0;instance<count;instance++){
   if(o.isBatchedMesh&&!o._instanceInfo[instance].active)continue
   const mat=o.matrixWorld.clone()
   let first=0,total=ind?ind.count:p.count,box=g.boundingBox
   if(o.isBatchedMesh){const id=o.getGeometryIdAt(instance),range=o.getGeometryRangeAt(id);first=range.start;total=range.count;box=o.getBoundingBoxAt(id,new T.Box3())}
   if(o.isInstancedMesh||o.isBatchedMesh){const im=new T.Matrix4();o.getMatrixAt(instance,im);mat.multiply(im)}
   if(!box.clone().applyMatrix4(mat).intersectsBox(region))continue
   if(o.isInstancedMesh||o.isBatchedMesh)expanded++
   const path=[];for(let a:any=o;a;a=a.parent)if(a.name)path.unshift(a.name)
   const name=path.join('/')+(o.isInstancedMesh?'#instance='+instance:'')
   for(let i=first;i<first+total;i+=3){
    const vs=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ind?ind.getX(i+k):i+k).applyMatrix4(mat))
    const lo=[0,1,2].map(k=>Math.min(...vs.map(q=>q.getComponent(k)))),hi=[0,1,2].map(k=>Math.max(...vs.map(q=>q.getComponent(k))))
    if(lo[0]>-46||hi[0]<-64||lo[1]>16||hi[1]<5||lo[2]>63||hi[2]<50)continue
    const n=vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).normalize()
    tris.push({v:vs.map(v=>v.toArray()),lo,hi,name,normal:n.toArray()});names.add(name)
   }
  }
 });return {tris,names:[...names],expanded}
}
function clip(vs:number[][],lo:number[],hi:number[]){
 let pts=vs.map(p=>[...p])
 for(let axis=0;axis<3;axis++)for(const lower of [true,false]){
  const plane=lower?lo[axis]:hi[axis],result:number[][]=[]
  if(!pts.length)return []
  let prev=pts[pts.length-1],pv=lower?prev[axis]-plane:plane-prev[axis]
  for(const cur of pts){const cv=lower?cur[axis]-plane:plane-cur[axis]
   if((cv>=0)!==(pv>=0)){const t=pv/(pv-cv);result.push(cur.map((_,k)=>prev[k]+(cur[k]-prev[k])*t))}
   if(cv>=0)result.push(cur);prev=cur;pv=cv
  }pts=result
 }return pts
}
function area(pts:number[][]){let a=0;for(let i=1;i+1<pts.length;i++)a+=new T.Vector3(...pts[i]).sub(new T.Vector3(...pts[0])).cross(new T.Vector3(...pts[i+1]).sub(new T.Vector3(...pts[0]))).length()/2;return a}
function padAudit(tris:Tri[],pad:any){
 const [x,y,z]=pad.center_gltf,lo=[x-.5,y+.005,z-.5],hi=[x+.5,16,z+.5]
 const above=tris.filter(t=>!t.lo.some((v,k)=>v>hi[k]||t.hi[k]<lo[k])).map(t=>({t,p:clip(t.v,lo,hi)})).filter(t=>t.p.length>=3&&area(t.p)>1e-7)
 const headroom=above.length?Math.min(...above.map(t=>Math.min(...t.p.map(v=>v[1]))-y)):null
 const blockers=[...new Set(above.filter(t=>Math.min(...t.p.map(v=>v[1]))-y<1.8-1e-5).map(t=>t.t.name))]
 const supports:any[]=[]
 for(let ix=0;ix<11;ix++)for(let iz=0;iz<11;iz++){
  const px=x-.5+ix*.1,pz=z-.5+iz*.1,hits:any[]=[]
  for(const t of tris){if(Math.abs(t.normal[1])<.99||px<t.lo[0]-1e-5||px>t.hi[0]+1e-5||pz<t.lo[2]-1e-5||pz>t.hi[2]+1e-5||t.lo[1]>y+.03||t.hi[1]<y-.03)continue
   const [a,b,c]=t.v,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-12)continue
   const u=((b[2]-c[2])*(px-c[0])+(c[0]-b[0])*(pz-c[2]))/den,w=((c[2]-a[2])*(px-c[0])+(a[0]-c[0])*(pz-c[2]))/den,v=1-u-w
   if(Math.min(u,v,w)<-1e-5)continue
   const h=u*a[1]+w*b[1]+v*c[1]
   if(Math.abs(h-y)<.03)hits.push({height:h,owner:t.name,normalY:t.normal[1]})
  }hits.sort((a,b)=>b.height-a.height);supports.push(hits[0]||null)
 }
 const good=supports.filter(Boolean),maxGap=good.length?Math.max(...good.map(h=>Math.abs(h.height-y))):null
 return {id:pad.id,center:pad.center_gltf,headroomExactClipM:headroom,headroomVerifiedAtLeastM:headroom??(16-y),noOverheadTriangleWithinCheckedHeight:headroom===null,blockers,supportSamples:121,supportFound:good.length,maxSupportGapM:maxGap,supportOwners:[...new Set(good.map(h=>h.owner))],upwardSupportSamples:good.filter(h=>h.normalY>.99).length,ok:good.length===121&&maxGap!<.015&&(headroom===null?16-y:headroom)>=1.8&&blockers.length===0}
}

export {loadGeometry,soup,padAudit}
