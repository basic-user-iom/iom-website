import * as T from 'three';

type Region={x0?:number;x1?:number;z0?:number;z1?:number};
const X0=-6.828994274139404,X1=7.1710052490234375;
const SOURCE_START=-233,OFFSET=288,JOIN=SOURCE_START+OFFSET,SOURCE_END=-188;
export const EXTENSION_END=154;
export const C_EXTENSION_OFFSET:[number,number,number]=[0,0,190];

/** Clip complete triangles in world space, interpolating every vertex attribute.
 * The original GLBs stay untouched. Disjoint regions also let us remove only
 * the old pavement end caps where the new pieces actually meet them. */
export function clip(mesh:T.Mesh,regions:Region[]){
 const source=mesh.geometry.clone(),names=Object.keys(source.attributes).filter(n=>n!=='tangent');
 // Meshopt's source positions/normals are quantized. Convert to float before
 // applying world transforms; writing metre coordinates into normalized integer
 // attributes would clamp/wrap the geometry.
 for(const name of names){const a=source.getAttribute(name),values=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)values[i*a.itemSize+j]=a.getComponent(i,j);source.setAttribute(name,new T.BufferAttribute(values,a.itemSize));}
 source.deleteAttribute('tangent');source.applyMatrix4(mesh.matrixWorld);
 const sizes=names.map(n=>source.getAttribute(n).itemSize),offsets=sizes.map((_,i)=>sizes.slice(0,i).reduce((a,b)=>a+b,0));
 const pos=offsets[names.indexOf('position')],data:number[][]=names.map(()=>[]),index=source.index;
 const vertex=(i:number)=>names.flatMap(n=>{const a=source.getAttribute(n);return Array.from({length:a.itemSize},(_,c)=>a.getComponent(i,c));});
 const count=index?.count??source.getAttribute('position').count;
 for(let i=0;i<count;i+=3){const triangle=[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j));
  for(const r of regions){let poly=triangle;
   for(const [axis,value,sign] of [[0,r.x0,1],[0,r.x1,-1],[2,r.z0,1],[2,r.z1,-1]] as [number,number|undefined,number][]){
    if(value===undefined||!poly.length)continue;const out:number[][]=[];
    for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=(a[pos+axis]-value)*sign,db=(b[pos+axis]-value)*sign;
     if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}
    poly=out;
   }
   for(let j=1;j<poly.length-1;j++){const tri=[poly[0],poly[j],poly[j+1]],a=new T.Vector3(...tri[0].slice(pos,pos+3) as [number,number,number]),b=new T.Vector3(...tri[1].slice(pos,pos+3) as [number,number,number]),c=new T.Vector3(...tri[2].slice(pos,pos+3) as [number,number,number]);
    if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)continue;
    for(const v of tri)names.forEach((_,k)=>data[k].push(...v.slice(offsets[k],offsets[k]+sizes[k])));
   }
  }
 }
 const g=new T.BufferGeometry();names.forEach((name,k)=>g.setAttribute(name,new T.Float32BufferAttribute(data[k],sizes[k])));g.normalizeNormals();g.computeBoundingBox();g.computeBoundingSphere();source.dispose();return g;
}
function materials(mesh:T.Mesh){return Array.isArray(mesh.material)?mesh.material:[mesh.material];}
function parts(root:T.Object3D,name:string){const result:T.Mesh[]=[];root.getObjectByName(name)?.traverse(o=>{if(o instanceof T.Mesh)result.push(o);});return result;}
function worldUV(g:T.BufferGeometry,channel:string,tile:number){const a=g.getAttribute('position'),uv=new Float32Array(a.count*2);for(let i=0;i<a.count;i++){uv[2*i]=a.getX(i)/tile;uv[2*i+1]=-a.getZ(i)/tile;}g.setAttribute(channel,new T.BufferAttribute(uv,2));}

export function extendStreet(street:T.Group){
 street.updateWorldMatrix(true,true);const root=new T.Group();root.name='WEB_Street_Extension';
 const road=parts(street,'AE35_010_road')[0],pavement=parts(street,'AE35_010_pavement'),sideRoad=parts(street,'AE35_010_road_parking');
 if(!road||!pavement.length||!sideRoad.length)throw new Error('Street extension source geometry is missing.');
 const roadBounds=new T.Box3().setFromObject(road),roadEnd=roadBounds.max.z;
 const roadPositions=road.geometry.getAttribute('position'),levels:number[]=[];
 for(let i=0;i<roadPositions.count;i++){const p=new T.Vector3().fromBufferAttribute(roadPositions,i).applyMatrix4(road.matrixWorld);if(p.z>8&&p.z<10)levels.push(p.z);}
 const tileStart=Math.min(...levels),period=roadEnd-tileStart;
 if(!Number.isFinite(period)||period<50||period>60)throw new Error('Unexpected road texture repeat bounds.');
 const roadPieces:T.Mesh[]=[];
 function add(g:T.BufferGeometry,source:T.Mesh,name:string){const m=new T.Mesh(g,source.material);m.name=name;m.castShadow=source.castShadow;m.receiveShadow=true;root.add(m);return m;}
 for(let start=roadEnd;start<EXTENSION_END;start+=period){const length=Math.min(period,EXTENSION_END-start),g=clip(road,[{z0:tileStart,z1:tileStart+length}]);g.translate(0,0,start-tileStart);worldUV(g,'uv1',2);roadPieces.push(add(g,road,`WEB_Extension_Main_Road_${roadPieces.length}`));}
 for(const [i,m] of pavement.entries()){
  // Copy the left junction's complete positive-X pavement. Its cut at -188
  // is a straight cross section; extend that section to support building 2.
  const copied=clip(m,[{x0:0,z0:SOURCE_START,z1:SOURCE_END}]);copied.translate(0,0,OFFSET);if(materials(m).some(v=>v.name==='AE35_010_pavement_color_1'))worldUV(copied,'uv',1.2);add(copied,m,`WEB_Extension_Copied_Pavement_${i}`);
  for(const [id,r,z0,z1] of [
   ['north',{x0:0,z0:-189,z1:-188},100,EXTENSION_END],
   ['south',{x0:-14,x1:0,z0:-211,z1:-210},96,EXTENSION_END],
  ] as [string,Region,number,number][]){const g=clip(m,[r]);const p=g.getAttribute('position');for(let j=0;j<p.count;j++)p.setZ(j,z0+(p.getZ(j)-r.z0!)*(z1-z0));
   if(materials(m).some(v=>v.name==='AE35_010_pavement_color_1'))worldUV(g,'uv',1.2);g.computeBoundingBox();g.computeBoundingSphere();add(g,m,`WEB_Extension_${id}_Pavement_${i}`);
  }
  // Support the relocated west-row building and join the existing sidewalk
  // at x=-14. Reuse its original level/material, with metre-scaled pavers.
  const pad=clip(m,[{x0:-14,x1:-13,z0:-211,z1:-210}]),a=pad.getAttribute('position');
  if(a.count){for(let j=0;j<a.count;j++){a.setX(j,-40+(a.getX(j)+14)*26);a.setZ(j,110+(a.getZ(j)+211)*44);}if(materials(m).some(v=>v.name==='AE35_010_pavement_color_1'))worldUV(pad,'uv',1.2);pad.computeBoundingBox();pad.computeBoundingSphere();add(pad,m,`WEB_Extension_West_Building_Pad_${i}`);}else pad.dispose();
  // Keep the source and all existing occupied pavement. Replace only the
  // destination cap and the narrow southern strip beyond its connection.
  const kept=clip(m,[{x1:-14},{x0:-14,x1:0,z1:96},{x0:0,z1:JOIN}]);kept.applyMatrix4(m.matrixWorld.clone().invert());m.geometry=kept;
 }
 for(const [i,m] of sideRoad.entries()){const g=clip(m,[{x0:X1,z0:SOURCE_START,z1:SOURCE_END}]);g.translate(0,0,OFFSET);add(g,m,`WEB_Extension_Copied_Side_Road_${i}`);}
 // The copied source has two intentional planting recesses but no bottom.
 // Soil sits at their lower curb lip; it does not overlap the paved surface.
 const soil=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({name:'WEB_Extension_Bed_Soil',color:'#51483b',roughness:1}),2);soil.name='WEB_Extension_Planting_Soil';
 [[-229.2056,-224.9037],[-216.3035,-212.0087]].forEach(([a,b],i)=>soil.setMatrixAt(i,new T.Matrix4().compose(new T.Vector3((7.663+11.1652)/2,.025,(a+b)/2+OFFSET),new T.Quaternion(),new T.Vector3(3.5022,.05,b-a))));root.add(soil);
 street.add(root);street.updateWorldMatrix(true,true);
 // Traffic samples only the actual carriageway, never a pavement or building.
 street.userData.trafficRoads=[road,...roadPieces];street.userData.trafficMaxZ=EXTENSION_END-8;
 root.userData.report={offset:[0,0,OFFSET],sourceRegion:{z:[SOURCE_START,SOURCE_END],x:[0,56.96753]},pavementJoin:JOIN,roadJoin:roadEnd,roadEnd:EXTENSION_END,roadWidth:X1-X0,roadPeriod:period,sideRoadZ:[80.172256,97.3751],sharedMaterials:true,newTextures:0,originalSourceRetained:true,soilBeds:2,westBuildingPad:{x:[-40,-14],z:[110,154],joinsExistingSidewalk:true,sharedMaterial:true},bounds:(()=>{const b=new T.Box3().setFromObject(root);return [b.min.toArray(),b.max.toArray()];})()};
 return root;
}

/** Reuse existing building geometry/materials; no additional model downloads. */
export function extendContext(context:T.Group){
 context.updateWorldMatrix(true,true);const root=new T.Group();root.name='WEB_Extension_Buildings';
 // Kerbs belong to the context GLB, separately from the street pavement.
 // Apply exactly the same cuts so the old rounded end cannot block the join.
 const kerbs=new T.Group();kerbs.name='WEB_Extension_Kerbs';
 for(const m of parts(context,'AE35_010_curbs')){
  const pieces=[{region:{x0:0,z0:SOURCE_START,z1:SOURCE_END},start:JOIN,end:100},
   {region:{x0:0,z0:-189,z1:-188},start:100,end:EXTENSION_END},
   {region:{x0:-14,x1:0,z0:-211,z1:-210},start:96,end:EXTENSION_END}];
  for(const [i,piece] of pieces.entries()){const g=clip(m,[piece.region]),a=g.getAttribute('position'),scale=(piece.end-piece.start)/(piece.region.z1-piece.region.z0);for(let j=0;j<a.count;j++)a.setZ(j,piece.start+(a.getZ(j)-piece.region.z0)*scale);g.computeBoundingBox();g.computeBoundingSphere();const copy=new T.Mesh(g,m.material);copy.name=`WEB_Extension_Kerb_${i}`;kerbs.add(copy);}
  const kept=clip(m,[{x1:-14},{x0:-14,x1:0,z1:96},{x0:0,z1:JOIN}]);kept.applyMatrix4(m.matrixWorld.clone().invert());m.geometry=kept;
 }context.add(kerbs);
 const plans=[
  {id:'copied-small-building-1',min:[15,-1,-229],max:[35,20,-209],offset:[0,0,OFFSET]},
  {id:'additional-building-2',min:[-40,-1,-78],max:[-21,23,-37],offset:C_EXTENSION_OFFSET},
 ];
 const records=plans.map(p=>({...p,bounds:new T.Box3(),parts:0}));
 const meshes:T.Mesh[]=[];context.traverse(o=>{if(o instanceof T.Mesh&&!o.name.startsWith('WEB_'))meshes.push(o);});
 for(const mesh of meshes){mesh.geometry.computeBoundingBox();const worlds:T.Matrix4[]=[];
  if(mesh instanceof T.InstancedMesh){for(let i=0;i<mesh.count;i++){const m=new T.Matrix4();mesh.getMatrixAt(i,m);worlds.push(m.premultiply(mesh.matrixWorld));}}else worlds.push(mesh.matrixWorld.clone());
  const copies:T.Matrix4[]=[];
  for(const world of worlds){const b=mesh.geometry.boundingBox!.clone().applyMatrix4(world);for(const p of records){const region=new T.Box3(new T.Vector3(...p.min),new T.Vector3(...p.max));if(!region.containsBox(b))continue;const matrix=new T.Matrix4().makeTranslation(...p.offset as [number,number,number]).multiply(world);copies.push(matrix);p.bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix));p.parts++;}}
  if(copies.length){const copy=new T.InstancedMesh(mesh.geometry,mesh.material,copies.length);copy.name=`WEB_Extension_Building_${mesh.name}`;copies.forEach((m,i)=>copy.setMatrixAt(i,m));root.add(copy);}
 }
 if(records.some(r=>r.parts===0))throw new Error('Street extension building template was not found.');
 // Match the already used C block interior closure so its windows do not look
 // through the entire volume. Reuse that core's geometry and material as well.
 const existing=context.getObjectByName('WEB_Background_Closed_Cores');if(existing instanceof T.Mesh){const core=new T.Mesh(existing.geometry,existing.material);core.name='WEB_Extension_C_Interior';core.position.set(-31+C_EXTENSION_OFFSET[0],.3+17/2+C_EXTENSION_OFFSET[1],-57+C_EXTENSION_OFFSET[2]);core.scale.set(10,17,34);root.add(core);}
 root.userData.report={interiorCore:root.getObjectByName('WEB_Extension_C_Interior')?.position.toArray(),count:2,sharedGeometry:true,sharedMaterials:true,newTextures:0,buildings:records.map(p=>({id:p.id,offset:p.offset,parts:p.parts,bounds:[p.bounds.min.toArray(),p.bounds.max.toArray()]}))};context.add(root);return root;
}

export function inspectStreetExtension(scene:T.Scene){return {street:scene.getObjectByName('WEB_Street_Extension')?.userData.report,buildings:scene.getObjectByName('WEB_Extension_Buildings')?.userData.report};}

