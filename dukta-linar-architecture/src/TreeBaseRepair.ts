import * as T from 'three';
/** The exported L crown has no trunk below 1.69 m. Restore its trunk and a
 * flush planting bed in the runtime copy, preserving the source ground lights. */
export function repairTreeBase(root:T.Group,layer:string){
 if(layer!=='vegetation'||root.getObjectByName('WEB_Tree_L_Trunk'))return;
 let bark:T.MeshStandardMaterial|undefined;root.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof T.MeshStandardMaterial&&/tree_L_bark/.test(m.name))bark=m;});if(!bark)return;
 const group=new T.Group();group.name='WEB_Tree_L_Trunk';root.add(group);const base=new T.Vector3(38.516464,.1938,-14.089195),material=bark.clone();material.name='WEB_Tree_L_Restored_Bark';material.side=T.FrontSide;
 function branch(points:number[][],radii:number[]){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments=32,sides=14,g=new T.BufferGeometry(),v:number[]=[],uv:number[]=[],ix:number[]=[];const frames=path.computeFrenetFrames(segments,false);
  for(let i=0;i<=segments;i++){const t=i/segments,p=path.getPointAt(t),f=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(f)),radius=T.MathUtils.lerp(radii[j],radii[j+1],f-j);for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,r=radius*(1+.07*Math.sin(a*5+t*4)),q=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);v.push(q.x,q.y,q.z);uv.push(k/sides,t*path.getLength()/1.3);if(i<segments&&k<sides){const n=i*(sides+1)+k;ix.push(n,n+1,n+sides+1,n+1,n+sides+2,n+sides+1);}}}
  g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;mesh.name='WEB_Tree_L_Bark_Repair';group.add(mesh);
 }
 branch([base.toArray(),[38.53,.45,-14.09],[38.56,1.15,-14.10],[38.52,1.95,-14.08],[38.58,2.75,-14.13],[38.58,3.38,-14.08]],[.19,.12,.095,.08,.052,.018]);
 branch([[38.53,1.78,-14.08],[38.78,2.22,-14.18],[39.13,2.68,-14.30]],[.072,.045,.012]);
 branch([[38.55,2.14,-14.10],[38.25,2.55,-13.98],[37.95,2.91,-13.89]],[.062,.037,.008]);
 const bed=new T.Group();bed.name='WEB_Tree_L_Planting_Base';bed.position.copy(base);bed.rotation.x=.007874;group.add(bed);
 const soil=new T.Mesh(new T.CylinderGeometry(.65,.65,.02,64),new T.MeshStandardMaterial({color:'#332c21',roughness:1}));soil.position.y=-.01;soil.name='WEB_Tree_L_Soil';soil.receiveShadow=true;bed.add(soil);
 const metal=new T.MeshStandardMaterial({color:'#373b35',metalness:.65,roughness:.8});for(const radius of [.215,.43,.65]){const ring=new T.Mesh(new T.TorusGeometry(radius,.006,8,64),metal);ring.rotation.x=Math.PI/2;ring.position.y=.006;ring.castShadow=ring.receiveShadow=true;bed.add(ring);}
 const bars=new T.InstancedMesh(new T.BoxGeometry(.012,.009,.429),metal,24),pivot=new T.Object3D();bars.name='WEB_Tree_L_Grate';for(let i=0;i<24;i++){const a=i*Math.PI/12;pivot.position.set(Math.sin(a)*.43,.005,Math.cos(a)*.43);pivot.rotation.y=a;pivot.updateMatrix();bars.setMatrixAt(i,pivot.matrix);}bars.castShadow=bars.receiveShadow=true;bed.add(bars);
 group.userData={repair:'Missing lower trunk restored; root flare contacts a sloped, flush planting bed and open metal grate',base:base.toArray(),height:3.38-base.y,originalFilesUnchanged:true};
}
