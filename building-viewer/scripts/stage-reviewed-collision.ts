import sourceBoundsData from '../blender-candidates-20261003/source-bounds.json'
import { Box3, BufferGeometry, Float32BufferAttribute, Vector3, Mesh, Object3D, Group, Matrix4, Raycaster, MeshBasicMaterial, FrontSide, DoubleSide } from 'three'
import { buildCollisionChunks } from '../src/collision/buildCollisionChunks'
import { applyIcmDedicatedCollisionFacePolicy } from '../src/scene/assetSemantics'

const normalized=(name:string)=>name.replace(/^COLLIDER_/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase()
type Vertex={p:Vector3,attributes:Record<string,number[]>}
function cut(poly:Vertex[],nx:number,nz:number,c:number,inside:boolean,ny=0){
 const out:Vertex[]=[]
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=nx*a.p.x+ny*a.p.y+nz*a.p.z+c,db=nx*b.p.x+ny*b.p.y+nz*b.p.z+c
 const ai=inside?da>=-1e-8:da<=1e-8,bi=inside?db>=-1e-8:db<=1e-8
 if(ai)out.push(a)
 if(ai!==bi){const t=da/(da-db),attributes:Record<string,number[]>={}
 for(const [k,v] of Object.entries(a.attributes))attributes[k]=v.map((n,j)=>n+(b.attributes[k][j]-n)*t)
 out.push({p:a.p.clone().lerp(b.p,t),attributes})}
 }
 return out
}
function subtract(poly:Vertex[],tri:Vector3[],band?:{y:number,tolerance:number}){
 let remaining=poly;const kept:Vertex[][]=[]
 if(band)for(const [ny,c] of [[1,-band.y+band.tolerance],[-1,band.y+band.tolerance]]){const outside=cut(remaining,0,0,c,false,ny);if(outside.length>=3)kept.push(outside);remaining=cut(remaining,0,0,c,true,ny);if(!remaining.length)return kept}
 const signed=(tri[1].x-tri[0].x)*(tri[2].z-tri[0].z)-(tri[1].z-tri[0].z)*(tri[2].x-tri[0].x)
 const sign=signed>=0?1:-1
 for(let e=0;e<3&&remaining.length;e++){const a=tri[e],b=tri[(e+1)%3],nx=-(b.z-a.z)*sign,nz=(b.x-a.x)*sign,c=-(nx*a.x+nz*a.z)
 const outside=cut(remaining,nx,nz,c,false);if(outside.length>=3)kept.push(outside)
 remaining=cut(remaining,nx,nz,c,true)
 }
 return kept
}
export function integrateForReview(baseRoot:Object3D,candidateRoot:Object3D){
 // In-memory staging only. Never writes or replaces an active model.
 const staged=baseRoot.clone(true)
 // The active builder currently bakes only mesh.matrixWorld for interior
 // InstancedMesh objects. Expand their real instance transforms before baking.
 // Keep the authored owner node, hierarchy and local transform as a Group.
 const packed:any[]=[];staged.traverse((o:any)=>{if(o.isInstancedMesh)packed.push(o)})
 let expandedInstances=0
 for(const o of packed){const group=new Group();group.name=o.name;group.userData={...o.userData};group.matrix.copy(o.matrix);group.matrixAutoUpdate=false;group.visible=o.visible
  const matrix=new Matrix4()
  for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);const child=new Mesh(o.geometry,o.material);child.name=o.name+'__instance_'+i;child.userData={...o.userData,reviewInstanceIndex:i};child.matrix.copy(matrix);child.matrixAutoUpdate=false;group.add(child);expandedInstances++}
  o.parent.add(group);o.removeFromParent()
 }
 staged.updateMatrixWorld(true);candidateRoot.updateMatrixWorld(true)
 const sourceBounds=new Map<string,Box3>(),shapes:{points:Vector3[],box:Box3,y:number,tolerance:number}[]=[]
 candidateRoot.traverse((o:any)=>{if(!o.isMesh)return
 const src=o.userData.sourceObject
 if(src&&/^(TR_Stufen|treppe_og|BU_Treppe|Etagentreppen|treppe_bt)/.test(src)){
 const key=normalized(src),box=new Box3().setFromObject(o);if(sourceBounds.has(key))sourceBounds.get(key)!.union(box);else sourceBounds.set(key,box)
 }
 if(!/Auditorium_[AB]_|AuditoriumFloor_/.test(o.name))return
 const p=o.geometry.attributes.position,index=o.geometry.index
 for(let i=0;i<(index?index.count:p.count);i+=3){const points=[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld));const box=new Box3().setFromPoints(points)
 if(box.max.y-box.min.y<.002)shapes.push({points,box,y:(box.min.y+box.max.y)/2,tolerance:/AuditoriumFloor_/.test(o.name)?.04:.02})
 }
 })
 for(const row of sourceBoundsData)sourceBounds.set(normalized(row.name),new Box3(new Vector3(...row.min),new Vector3(...row.max)))
 const excluded=new Set<Object3D>(),replaced:any[]=[],clipped:any[]=[],mismatches:any[]=[]
 staged.traverse((o:any)=>{if(!o.isMesh)return
 let owner:string|undefined;const path:string[]=[]
 for(let p:Object3D|null=o;p;p=p.parent){path.push(p.name);if(sourceBounds.has(normalized(p.name)))owner=normalized(p.name)}
 if(owner){const target=sourceBounds.get(owner)!.clone().expandByScalar(.04),box=new Box3().setFromObject(o)
 if(target.containsBox(box)){excluded.add(o);replaced.push({name:o.name,path:path.reverse(),min:box.min.toArray(),max:box.max.toArray()});return}
 mismatches.push({name:o.name,owner,reason:'Name matched but world bounds did not; kept for review'});return
 }
 const mats=Array.isArray(o.material)?o.material:[o.material]
 if(!mats.some((m:any)=>/Floor_Wood_Vray_001/i.test(m?.name||'')))return
 const objectBox=new Box3().setFromObject(o),possible=shapes.filter(s=>s.box.clone().expandByScalar(.045).intersectsBox(objectBox))
 if(!possible.length)return
 const original=o.geometry,geometry=original.index?original.toNonIndexed():original.clone(),attributes=geometry.attributes as any,names=Object.keys(attributes),out:Record<string,number[]>={}
 for(const name of names)out[name]=[]
 const p=attributes.position;let removedArea=0,affected=0,outTris=0
 for(let i=0;i<p.count;i+=3){
 const poly:Vertex[]=[0,1,2].map(k=>{const values:Record<string,number[]>={};for(const name of names){const attr=attributes[name];values[name]=Array.from({length:attr.itemSize},(_,j)=>attr.getComponent(i+k,j))}return{p:new Vector3().fromBufferAttribute(p,i+k).applyMatrix4(o.matrixWorld),attributes:values}})
 const normal=poly[1].p.clone().sub(poly[0].p).cross(poly[2].p.clone().sub(poly[0].p)),area=normal.length()*.5
 let fragments=[poly]
 const box=new Box3().setFromPoints(poly.map(v=>v.p))
 if(area>1e-12&&Math.abs(normal.normalize().y)>.7){
 for(const shape of possible){const floorPatch=shape.tolerance>.02;if(!floorPatch&&(Math.abs(normal.y)<=.99||box.max.y-box.min.y>=.002))continue;if(box.max.y<shape.y-shape.tolerance||box.min.y>shape.y+shape.tolerance||box.max.x<shape.box.min.x||box.min.x>shape.box.max.x||box.max.z<shape.box.min.z||box.min.z>shape.box.max.z)continue
 fragments=fragments.flatMap(f=>subtract(f,shape.points,floorPatch?shape:undefined));if(!fragments.length)break
 }
 }
 let keptArea=0
 for(const f of fragments)for(let k=1;k<f.length-1;k++){const vs=[f[0],f[k],f[k+1]],a=vs[1].p.clone().sub(vs[0].p).cross(vs[2].p.clone().sub(vs[0].p)).length()*.5
 if(a<1e-12)continue;keptArea+=a;outTris++;for(const v of vs)for(const name of names)out[name].push(...v.attributes[name])
 }
 if(keptArea<area-1e-8){affected++;removedArea+=area-keptArea}
 }
 if(affected){
 const g=new BufferGeometry();for(const name of names)g.setAttribute(name,new Float32BufferAttribute(out[name],attributes[name].itemSize))
 g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g
 // A changed mesh cannot retain a geometry-bound topology assertion.
 if('iomSurfaceTopologyRepaired' in o.userData)delete o.userData.iomSurfaceTopologyRepaired
 clipped.push({name:o.name,sourceTriangles:p.count/3,outputTriangles:outTris,affectedTriangles:affected,removedArea,reason:'Only existing wood support faces within the exact candidate triangle footprint and its bounded vertical replacement band were subtracted; slopes clipped in 3D'})
 }
 geometry.dispose()
 })
 const legacy=buildCollisionChunks(staged,{layerId:'candidate',verbose:false,ignoreVisibility:true,includeMesh:m=>!excluded.has(m)})
 const existingFacePolicyCount=applyIcmDedicatedCollisionFacePolicy('icm-anim-2025',legacy.chunks)
 const diagnosticRoot=new Group()
 for(const c of legacy.chunks){const mesh=new Mesh(c.geometry,new MeshBasicMaterial({side:c.doubleSided?DoubleSide:FrontSide}));mesh.userData.sourceNames=c.sourceNames;mesh.name=c.name;diagnosticRoot.add(mesh)}
 diagnosticRoot.updateMatrixWorld(true)
 const doubleRoot=new Group();staged.traverse((o:any)=>{if(!o.isMesh||excluded.has(o))return;const mesh=new Mesh(o.geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.name=o.name;mesh.userData.owner=o.parent?.name;mesh.matrixAutoUpdate=false;mesh.matrix.copy(o.matrixWorld);doubleRoot.add(mesh)});doubleRoot.updateMatrixWorld(true)
 const clearanceHits=[[-37.22,-11.30414],[-72.89,-11.30414],[-51.524,54.469915],[-52.334,54.469915]].map(([x,z])=>({x,z,hits:new Raycaster(new Vector3(x,12,z),new Vector3(0,-1,0),0,12).intersectObject(doubleRoot,true).slice(0,20).map(h=>({y:h.point.y,name:h.object.name,owner:h.object.userData.owner,normal:h.face?.normal.toArray(),face:h.faceIndex}))}));doubleRoot.traverse((o:any)=>{if(o.isMesh)o.material.dispose()})
 const legacyHits=[[-52.3341942,54.4699135],[-57.8444291,54.4699135],[-38.6893831,-11.3041389],[-71.4246676,-11.30414]].map(([x,z])=>{
 const hits=new Raycaster(new Vector3(x,11,z),new Vector3(0,-1,0),0,7).intersectObject(diagnosticRoot,true)
 return {x,z,hits:hits.slice(0,8).map(h=>({y:h.point.y,normal:h.face?.normal.toArray(),sourceNames:h.object.userData.sourceNames}))}
 })
 diagnosticRoot.traverse((o:any)=>{if(o.isMesh)o.material.dispose()})
 const exact=buildCollisionChunks(candidateRoot,{layerId:'candidate',verbose:false,ignoreVisibility:true,walkSurfacesOnly:true})
 for (const mesh of excluded) mesh.removeFromParent()
 return {staged, chunks:[...legacy.chunks,...exact.chunks],report:exact.report,integration:{scope:'in-memory isolated staging; full legacy collider plus exact replacements; no legacy generated landing/aisle supplements instantiated',clearanceHits,legacyHits,expandedInstancedMeshes:packed.length,expandedInstances,replaced,clipped,mismatches,existingFacePolicyCount,legacy:{meshes:legacy.report.usedMeshes,triangles:legacy.report.triangles},exact:{meshes:exact.report.usedMeshes,triangles:exact.report.triangles},proxyForExact:exact.report.selected.filter(r=>/proxy/i.test(r.reason))}}
}
