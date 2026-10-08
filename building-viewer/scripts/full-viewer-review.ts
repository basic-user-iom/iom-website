import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {CharacterController} from '../src/collision/CharacterController';
import {buildCollisionChunks} from '../src/collision/buildCollisionChunks';
let world:any;
const routePaths=new Map<string,number[][]>();
function round(n:number){return Number(n.toFixed(7))}
function meshRecords(root:any){const rows:any[]=[];root.updateMatrixWorld(true);root.traverse((o:any)=>{if(o.isMesh){const b=new THREE.Box3().setFromObject(o);rows.push({name:o.name,source:o.userData.sourceObject,triangles:o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3,min:b.min.toArray().map(round),max:b.max.toArray().map(round)})}});return rows}
function ground(p:number[],range=.6){const v=new THREE.Vector3(...p);world.setFocus(v);const h=world.raycastBestGround(v,range,Math.cos(50*Math.PI/180));return h?{point:h.point.toArray().map(round),normal:h.normal.toArray().map(round),source:h.sourceName}:null}
function travel(name:string,points:number[][],speed:number){
 const c=new CharacterController();c.setWorld(world);world.setQueryLayer('icm-anim-2025')
 const p=new THREE.Vector3(...points[0]);world.setFocus(p)
 const g=world.raycastBestGround(p.clone().add(new THREE.Vector3(0,.2,0)),.5,c.params.maxSlope)
 if(!g)return{name,speed,ok:false,reason:'missing start support',start:points[0]}
 p.y=g.point.y;c.setFeetPosition(p);for(let n=0;n<10;n++)c.update(1/60,new THREE.Vector3(),0)
 let airborne=0,frames=0,stalled=0,maxDy=0,minY=c.position.y,waypoint=1;const samples:any[]=[],airDetails:any[]=[]
 for(;frames<6000&&waypoint<points.length;frames++){
  const target=new THREE.Vector3(...points[waypoint]),d=target.clone().sub(c.position);d.y=0
  const remaining=d.length()
  if(remaining<(waypoint===points.length-1?.001:.01)){waypoint++;continue}
  const before=c.position.clone();world.setFocus(c.position);c.update(1/60,d.normalize(),Math.min(speed,remaining*60))
  if(!c.onGround){airborne++;if(airDetails.length<4)airDetails.push({frame:frames,waypoint,from:before.toArray().map(round),position:c.position.toArray().map(round),ground:ground([c.position.x,c.position.y+.55,c.position.z],1.2),climbLock:(c as any).climbLock,edge:(c as any).edgeSupport?.toArray(),descentGuard:(c as any).descentGuard})}maxDy=Math.max(maxDy,Math.abs(c.position.y-before.y));minY=Math.min(minY,c.position.y)
  stalled=c.position.distanceTo(before)<.00001?stalled+1:0
  if(frames%30===0)samples.push(c.position.toArray().map(round))
  if(stalled>90||c.position.y<-2)break
 }
 for(let settle=0;settle<15;settle++)c.update(1/60,new THREE.Vector3(),0)
 const cap=c.getCapsule(),contact=world.capsuleIntersect(cap.start,cap.end,cap.radius)
 const contactInfo=contact?{depth:contact.depth,normal:contact.normal.toArray(),source:contact.sourceName}:null
 const end=new THREE.Vector3(...points[points.length-1]),dist=Math.hypot(c.position.x-end.x,c.position.z-end.z),dy=Math.abs(c.position.y-end.y)
 return{name,speed,ok:dist<.14&&dy<.15&&c.onGround&&airborne===0,distance:round(dist),heightError:round(dy),airborne,frames,onGround:c.onGround,maxFrameDy:round(maxDy),minY:round(minY),final:c.position.toArray().map(round),waypoint,totalWaypoints:points.length,points,airDetails,contact:contactInfo,volumeLock:(c as any).volumeClimbLock,climbLock:(c as any).climbLock}
}

export async function runFullReview(v:any){
world=v.collision;v.modelAnim.stop();world.setQueryLayer('icm-anim-2025');
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const collision=await loader.loadAsync('/blender-candidates-20261003/icm-stairs-collision-candidate-v2.glb');
collision.scene.add((await loader.loadAsync('/blender-candidates-20261003/icm-auditorium-floor-collision-candidate.glb')).scene);
const records=meshRecords(collision.scene);
 const probes:any[]=[]
 for(const x of [-35.96,-74.16])for(const z of [40.65,41.15,41.65])probes.push({at:[x,z],expected:10,hit:ground([x,10.8,z],1)})
 probes.push({at:[-55.05,5],expected:8.545496,hit:ground([-55.05,9,5],1)})
 for(const [x,z,y] of [[-22.67,-62.43,.242702],[-23.06,-62.12,.360702],[-35.927,-85.604,.124702],[-36.634,-85.228,.506702]])probes.push({at:[x,z],expected:y,hit:ground([x,y+.2,z],.5)})
 for(const p of probes)p.ok=!!p.hit&&Math.abs(p.hit.point[1]-p.expected)<.002&&p.hit.normal[1]>.99
 const groups=new Map<string,any[]>()
 for(const r of records)if(r.source&&/^(TR_Stufen|treppe_og|BU_Treppe|Etagentreppen|treppe_bt)/.test(r.source)){if(!groups.has(r.source))groups.set(r.source,[]);groups.get(r.source)!.push(r)}
 const routes:any[]=[]
 for(const [name,rs] of groups){rs.sort((a,b)=>(a.min[1]+a.max[1])-(b.min[1]+b.max[1]));
 const bands=rs.map(r=>[r])
 const ps:number[][]=[];for(const band of bands){
  const choices=band.map(r=>{const mesh=collision.scene.getObjectByName(r.name);const center=new THREE.Vector3((r.min[0]+r.max[0])/2,r.max[1]+.05,(r.min[2]+r.max[2])/2);const ray=new THREE.Raycaster(center,new THREE.Vector3(0,-1,0),0,.2);const hit=ray.intersectObject(mesh,false)[0];if(hit)return hit.point.toArray();const g=mesh.geometry,p=g.attributes.position,index=g.index;let area=-1,best=center;for(let i=0;i<(index?index.count:p.count);i+=3){const tri=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));const a=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0])).length();if(a>area){area=a;best=tri[0].clone().add(tri[1]).add(tri[2]).divideScalar(3)}}return best.toArray()})
  const prev=ps[ps.length-1];if(prev)choices.sort((a,b)=>Math.hypot(a[0]-prev[0],a[2]-prev[2])-Math.hypot(b[0]-prev[0],b[2]-prev[2]))
  ps.push(choices[0])
 }routePaths.set(name,ps);for(const speed of [.35,1.6,3.2,6.5])for(const reverse of [false,true])routes.push(travel(name+(reverse?':down':':up'),reverse?[...ps].reverse():ps,speed))}
 for(const [name,a,b] of [['exit_TR004',[-35.96,10.3298,40.1],[-35.96,10.400023,42.25]],['exit_TR005',[-74.16,10.4069,40.1],[-74.16,10.400069,42.25]],['aisle_A',[-22.28,0,-62.74],[-23.06,.361,-62.12]],['aisle_B',[-35.22,0,-85.98],[-36.634,.507,-85.228]]] as any){routePaths.set(name,[a,b]);for(const speed of [.35,1.6,3.2,6.5])for(const rev of [false,true])routes.push(travel(name+(rev?':down':':up'),rev?[b,a]:[a,b],speed))}

const floorSource=await (await fetch('/blender-candidates-20261003/auditorium-floor-samples.json')).json();
const floor=floorSource.samples.map((s:any)=>{const p=s.p;const hit=ground([p[0],p[1]+.04,p[2]],.2);return{face:s.face,point:p,hit,error:hit?Math.abs(hit.point[1]-p[1]):null}});
(window as any).__reviewPaths=Object.fromEntries(routePaths);
return{scope:'Full ViewerEngine installed collision after native pipeline; actual controller, all building obstructions retained',probes,routes,floor,summary:{probes:probes.filter(p=>p.ok).length,probesTotal:probes.length,routes:routes.filter(p=>p.ok).length,routesTotal:routes.length,floor15mm:floor.filter((p:any)=>p.error!==null&&p.error<.015).length,floorTotal:floor.length},collision:world.getFrameStats()};
}
