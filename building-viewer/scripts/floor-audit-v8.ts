import {Vector3,Matrix4} from 'three'
export async function auditFloors(v:any){
 v.modelAnim.stop();v.orbit.setEnabled(false);v.collision.setPlacementMode(true);v.models.root?.updateMatrixWorld(true);
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),normal=new Vector3(),ab=new Vector3(),ac=new Vector3(),p=new Vector3(),im=new Matrix4(),wm=new Matrix4();const samples:any[]=[];const groups:any[]=[];
 for(const layer of v.models.listLayers()){
 layer.root.updateMatrixWorld(true);layer.root.traverse((o:any)=>{
 if(!o.isMesh||!o.geometry?.attributes.position||o.isSkinnedMesh)return;
 let path=[],parent=o;while(parent&&parent!==layer.root){path.unshift(parent.name);parent=parent.parent}const owner=path.join('/');
 const mats=Array.isArray(o.material)?o.material:[o.material];const g=o.geometry,pa=g.attributes.position,ix=g.index,total=ix?ix.count:pa.count;
 for(let mi=0;mi<mats.length;mi++){const mat=mats[mi],label=owner+' '+mat.name;
 const materialFloor=/Floor_Wood|fb_foyer|boden_eg|B_0_Aluminum|Treppen all|Bruecke_Gitter|treppe_naturstein/i.test(mat.name);
 const localOwner=/^mesh_/.test(o.name)?o.parent?.name:o.name;const ownerFloor=/floor|boden|TR_Stufen|treppe|RG_Teil|BD_Holz|BD_Absenkung|gangway|Floor_Mitte/i.test(localOwner||'')&&!/Floor_anim|FloorBT|floorBT|IOM_BATCH/.test(localOwner||'');
 if(!(materialFloor||ownerFloor))continue;
 if(/handlauf|handrail|gelaender|gelnder|rail|leiste|rahmen|unterbau|schild|tafel|tisch|stuhl|mbel|moebel|trger|electro|door|tueren|kabine/i.test(owner))continue;
 if(/glass|wall|metal_chrome|metal.dark|roof|ceiling|schild|white/i.test(mat.name)&&!/(^|\/)Floor(?:001|_Mitte)?$/.test(owner))continue;
 const ranges=g.groups.length?g.groups.filter((x:any)=>x.materialIndex===mi):[{start:0,count:total}];const dedup=new Map();const faceCells=new Map();let triangles=0;
 for(let ins=0;ins<(o.isBatchedMesh?o._instanceInfo.length:o.isInstancedMesh?o.count:1);ins++){
 wm.copy(o.matrixWorld);if(o.isBatchedMesh&&!o._instanceInfo[ins].active)continue;if(o.isInstancedMesh||o.isBatchedMesh){o.getMatrixAt(ins,im);wm.multiply(im)}
 for(const range of (o.isBatchedMesh?[o.getGeometryRangeAt(o.getGeometryIdAt(ins))]:ranges))for(let i=range.start;i<Math.min(total,range.start+range.count);i+=3){
 a.fromBufferAttribute(pa,ix?ix.getX(i):i).applyMatrix4(wm);b.fromBufferAttribute(pa,ix?ix.getX(i+1):i+1).applyMatrix4(wm);c.fromBufferAttribute(pa,ix?ix.getX(i+2):i+2).applyMatrix4(wm);
 normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));const len=normal.length();if(len<.000001||Math.abs(normal.y/len)<.985)continue;triangles++;
 const face={a:a.clone(),b:b.clone(),c:c.clone(),ny:normal.y/len};
 for(let gx=Math.floor(Math.min(a.x,b.x,c.x));gx<=Math.floor(Math.max(a.x,b.x,c.x));gx++)for(let gz=Math.floor(Math.min(a.z,b.z,c.z));gz<=Math.floor(Math.max(a.z,b.z,c.z));gz++){const k=gx+','+gz;const list=faceCells.get(k)||[];list.push(face);faceCells.set(k,list)}

 const emit=(x:number,z:number,y:number)=>{const key=Math.floor(x*2)+','+Math.floor(z*2)+','+Math.round(y*100);if(!dedup.has(key))dedup.set(key,{p:[x,y,z],ny:normal.y/len})};
 p.copy(a).add(b).add(c).multiplyScalar(1/3);emit(p.x,p.z,p.y);
 const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-8)continue;
 for(let x=Math.ceil(Math.min(a.x,b.x,c.x));x<=Math.max(a.x,b.x,c.x);x++)for(let z=Math.ceil(Math.min(a.z,b.z,c.z));z<=Math.max(a.z,b.z,c.z);z++){const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,w=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d,t=1-u-w;if(u>.03&&w>.03&&t>.03)emit(x,z,u*a.y+w*b.y+t*c.y)}
 }
 }
 if(!triangles)continue;
 const topSamples=new Map();
 for(const sample of dedup.values()){
 const [x,y,z]=sample.p;let top=y,ny=sample.ny;
 for(const f of faceCells.get(Math.floor(x)+','+Math.floor(z))||[]){const {a,b,c}=f;const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-12)continue;const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,w=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d,t=1-u-w;if(u<-.000001||w<-.000001||t<-.000001)continue;const fy=u*a.y+w*b.y+t*c.y;if(fy>top+.001&&fy<y+.75){top=fy;ny=f.ny}}
 const key=Math.floor(x*2)+','+Math.floor(z*2)+','+Math.round(top*100);topSamples.set(key,{p:[x,top,z],ny});
 }
 const group=groups.length;groups.push({layer:layer.id,name:o.name,owner,material:mat.name,triangles,samples:topSamples.size});for(const item of topSamples.values())samples.push({group,...item});
 }
 });}
 const result=[];for(const s of samples){const layer=groups[s.group].layer;const hits:any={};for(const q of [layer,layer==='icm-ext'?'icm-anim-2025':'icm-ext',null]){v.collision.setQueryLayer(q);const h=v.collision.raycastBestGround(p.fromArray(s.p).add(new Vector3(0,.25,0)),1.8,.65);hits[q??'all']=h?{y:h.point.y,layer:h.layerId,name:h.sourceName,stair:h.stairZone}:null}result.push({...s,hits});}
 return{groups,samples:result};
}
