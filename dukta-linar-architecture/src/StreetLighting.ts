import * as THREE from 'three';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
export type Quality='balanced'|'high';
type LightSource={position:[number,number,number];name:string};
export class StreetLighting{
 readonly sun=new THREE.DirectionalLight(0xffeed5,1.8);
 readonly ambient=new THREE.HemisphereLight(0xa8bfdc,0x544333,.12);
 readonly lobbyKey=new THREE.SpotLight(0xffd3a0,120,15,Math.PI*.36,.8,2);
 readonly points:THREE.PointLight[]=[];
 private sources:LightSource[]=[];
 private hdrTargets=new Map<number,{texture:THREE.DataTexture;environment:THREE.WebGLRenderTarget}>();
 private hdrTasks=new Map<number,Promise<void>>();
 private qualityRevision=0;
 private overview:boolean|null=null;
 private interior=false;
 private sunData:{rotationY:number;worldDirection:number[];uv:number[];elevation:number}|null=null;
 private previous=new THREE.Vector3(Infinity,Infinity,Infinity);
 hdrSize=0;
 fixtureCount=0;
 receptionEnabled=true;private receptionLights:THREE.Light[]=[];
 constructor(private scene:THREE.Scene,private renderer:THREE.WebGLRenderer){
  scene.add(this.ambient,this.sun,this.sun.target);
  this.sun.castShadow=true;this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.025;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  // Street and office lamps are disabled by request; no shader light slots allocated.
  RectAreaLightUniformsLib.init();this.frame(false);
  this.lobbyKey.position.set(33,6.15,-33);this.lobbyKey.target.position.set(32,.3,-34);this.lobbyKey.castShadow=true;this.lobbyKey.shadow.mapSize.set(2048,2048);this.lobbyKey.shadow.camera.near=.1;this.lobbyKey.shadow.camera.far=15;this.lobbyKey.shadow.bias=-.0001;this.lobbyKey.shadow.normalBias=.008;scene.add(this.lobbyKey,this.lobbyKey.target);this.receptionLights.push(this.lobbyKey);
 }
 async loadFixtures(){
  const response=await fetch(`${import.meta.env.BASE_URL}environment/lighting.json`);if(!response.ok)throw Error('Fixture data unavailable');
  const data=await response.json() as {lamps:LightSource[];interior:{name:string;position:[number,number,number];size:number;energy:number}[]};this.sources=data.lamps;this.fixtureCount=data.lamps.length;
  for(const source of data.interior.filter(s=>s.name.includes('Lobby')||s.name.includes('Reception'))){const light=new THREE.RectAreaLight(0xffd2a0,source.energy/170,source.size,source.size);light.name=source.name;light.position.set(source.position[0],source.position[2],-source.position[1]);if(source.name==='REC_Reception_Fill'){light.position.set(31,6.1,-35.5);light.height=1;}light.lookAt(light.position.clone().add(new THREE.Vector3(0,-1,0)));this.scene.add(light);this.receptionLights.push(light);}
  this.setReceptionEnabled(this.receptionEnabled);
 }
 setReceptionEnabled(enabled:boolean){this.receptionEnabled=enabled;for(const light of this.receptionLights)light.visible=enabled;this.renderer.shadowMap.needsUpdate=true;}
 async setQuality(quality:Quality){
  if(!this.sunData){this.sunData=await (await fetch(`${import.meta.env.BASE_URL}environment/daylight-sun.json`)).json();this.scene.backgroundRotation.y=this.sunData!.rotationY;this.scene.environmentRotation.y=this.sunData!.rotationY;this.positionSun();}
  const revision=++this.qualityRevision,size=quality==='high'?2048:1024,resolution=quality==='high'?4096:innerWidth<600?1024:2048;
  this.sun.shadow.mapSize.set(resolution,resolution);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;
  if(!this.hdrTargets.has(size)){
   if(!this.hdrTasks.has(size))this.hdrTasks.set(size,(async()=>{const texture=await new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}environment/daylight_sky_${size}.hdr`);texture.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(this.renderer);const environment=pmrem.fromEquirectangular(texture);pmrem.dispose();this.hdrTargets.set(size,{texture,environment});})());
   try{await this.hdrTasks.get(size);}finally{this.hdrTasks.delete(size);}
  }
  if(revision!==this.qualityRevision)return;
  const hdr=this.hdrTargets.get(size)!;this.scene.background=this.overview?new THREE.Color('#c6ced1'):hdr.texture;this.scene.environment=hdr.environment.texture;this.scene.environmentIntensity=.35;this.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshPhysicalMaterial&&m.userData.entranceFinish){m.envMap=hdr.environment.texture;m.envMapRotation.copy(this.scene.environmentRotation);m.envMapIntensity=.55;m.needsUpdate=true;}});this.scene.backgroundIntensity=.8;this.scene.backgroundBlurriness=.015;this.hdrSize=size;this.renderer.shadowMap.needsUpdate=true;
  // A settled quality switch needs only its active HDR and PMREM on the GPU.
  for(const [otherSize,other] of this.hdrTargets)if(otherSize!==size){other.texture.dispose();other.environment.dispose();this.hdrTargets.delete(otherSize);}
 }
 frame(overview:boolean){
  if(this.overview===overview)return;
  this.overview=overview;const hdr=this.hdrTargets.get(this.hdrSize);if(hdr)this.scene.background=overview?new THREE.Color('#c6ced1'):hdr.texture;
  this.positionSun();
 }
 private positionSun(){
  const center=this.interior?new THREE.Vector3(38,0,-36):this.overview?new THREE.Vector3(8,0,-66):new THREE.Vector3(32,0,-45),extent=this.interior?28:this.overview?195:78;
  this.sun.target.position.copy(center);this.sun.position.copy(center).addScaledVector(this.sunData?new THREE.Vector3(...this.sunData.worldDirection):new THREE.Vector3(-.633,.553,.541),130);
  this.sun.shadow.normalBias=this.interior?.008:.05;this.sun.shadow.bias=this.interior?-.0001:-.00035;
  Object.assign(this.sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:.5,far:500});this.sun.shadow.camera.updateProjectionMatrix();this.renderer.shadowMap.needsUpdate=true;
 }
 setInterior(value:boolean){if(this.interior===value)return;this.interior=value;this.positionSun();}
 inspect(){return{receptionEnabled:this.receptionEnabled,receptionLights:this.receptionLights.map(l=>({name:l.name||'Reception spotlight',visible:l.visible,intensity:l.intensity})),streetLightsEnabled:false,officeLightsEnabled:false,daylight:'HDR environment, aligned sun and hemisphere remain enabled independently',hdr:'kloofendal_38d_partly_cloudy_puresky',hdrSize:this.hdrSize,rotationY:this.scene.environmentRotation.y,backgroundRotationY:this.scene.backgroundRotation.y,sunDirection:this.sun.position.clone().sub(this.sun.target.position).normalize().toArray(),source:this.sunData,intensity:this.sun.intensity,interior:this.interior,shadowExtent:this.sun.shadow.camera.right,fixtures:this.fixtureCount};}
 update(camera:THREE.Camera){
  if(this.sources.length===0||this.previous.distanceToSquared(camera.position)<4)return;this.previous.copy(camera.position);
  const sorted=[...this.sources].sort((a,b)=>new THREE.Vector3(...a.position).distanceToSquared(camera.position)-new THREE.Vector3(...b.position).distanceToSquared(camera.position));
  this.points.forEach((p,i)=>{const source=sorted[i];p.intensity=source?22:0;if(source)p.position.set(source.position[0],source.position[1]-.12,source.position[2]);});
 }
}

