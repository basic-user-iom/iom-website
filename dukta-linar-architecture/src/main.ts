import {startup} from './LoadingScreen';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {WalkMode} from './controls/WalkMode';
import {OrbitMode} from './controls/OrbitMode';
import {StreetLighting,type Quality} from './StreetLighting';
import {InstanceVisibility} from './InstanceVisibility';
import {VisualEffects} from './VisualEffects';
import {excludePeople} from './SceneExclusions';
import {Traffic} from './Traffic';
import {LinarWalls} from './LinarWalls';
import {excludeOriginProps,repairContextStorefront} from './ContextRepairs';
import {addUpperEnvelope,inspectUpperEnvelope} from './UpperEnvelope';
import {addStreetTrees,addCityBackground,inspectCityAdditions} from './CityAdditions';
import {DaylightMaterials} from './DaylightMaterials';
import {TreeLeaves} from './TreeLeaves';
import {repairTreeBase} from './TreeBaseRepair';
import {batchStatic} from './StaticBatching';
import {installLightingReview} from './ReviewLighting';
import {loadLounge} from './Lounge';
import {replaceReceptionSigns,addExteriorSign,syncReceptionSign} from './ReceptionIdentity';
import {ReceptionDesk} from './ReceptionDesk';
import {ConfiguratorTour} from './ConfiguratorTour';
import {TourEntrance} from './TourEntrance';
import {EntranceAutoClose} from './EntranceAutoClose';
import {TourClearance,TourMotion} from './TourPath';
import {LinarCamera,wallCeilingEntry} from './LinarCamera';
import {setupLinarControls} from './LinarControls';
import {installPerformanceReview} from './PerformanceReview';
import {RenderStudy} from './RenderStudy';
import {SitePlan} from './SitePlan';
import {applyVehicleFinishes} from './VehicleFinishes';
import {extendStreet,extendContext,inspectStreetExtension} from './StreetExtension';
import './style.css';
type View='exterior'|'reception'|'ceiling'|'plan';
const views:Record<View,{title:string;description:string;position:[number,number,number];target:[number,number,number];fov:number}>={
 plan:{title:'Site plan',description:'The whole existing neighbourhood. Drag to pan, scroll to zoom.',position:[0,350,0],target:[0,0,0],fov:55},
 exterior:{title:'Exterior',description:'The building in its original street setting.',position:[-16,6,-6],target:[37,12.5,-48],fov:44},
 reception:{title:'Reception',description:'The existing arrival space.',position:[37,1.8,-30.8],target:[31,2.65,-36.8],fov:55},
 ceiling:{title:'Wall & ceiling',description:'The space for the next study.',...wallCeilingEntry},
};
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=$('status'),retry=$<HTMLButtonElement>('retry'),stage=$('stage'),canvas=$<HTMLCanvasElement>('canvas'),environmentStatus=$('environment-status'),environmentRetry=$<HTMLButtonElement>('environment-retry');
const diagnostics={ready:false,environmentReady:false,hdrSize:0,quality:'balanced' as Quality,activeView:'exterior' as View,loadedLayers:[] as string[],loadMs:{} as Record<string,number>,frameTimes:[] as number[],errors:[] as string[],triangles:0,drawCalls:0,camera:[] as number[],target:[] as number[],animating:false,modelRoots:0,renderer:'',canvas:[0,0],instancedBatches:0,visibleInstances:0,totalInstances:0,streetBounds:[] as number[][]};
Object.assign(window,{__viewer:diagnostics});
const removedPeople:string[]=[];
const removedOriginProps:{name:string;center:number[]}[]=[];
const resourceStats={frames:0,totalDrawCalls:0,totalTriangles:0,renderCpuMs:[] as number[],textures:0,geometries:0,programs:0,pixelRatio:0,drawingBuffer:[0,0],hidden:false,frameLimit:30,shadowRefreshes:0};
Object.assign(window,{__resources:resourceStats});
async function boot(){
 // The canvas receives a full-screen composite; geometry MSAA lives in VisualEffects.
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=.85;renderer.transmissionResolutionScale=.75;
 const gl=renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info');diagnostics.renderer=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#7c8c9b');const lighting=new StreetLighting(scene,renderer),visibility=new InstanceVisibility();
 const foliage=new TreeLeaves();Object.assign(window,{__inspectFoliage:()=>foliage.inspect(scene)});
 const pbr=new DaylightMaterials();Object.assign(window,{__inspectPBR:()=>pbr.inspect(),__inspectLighting:()=>lighting.inspect()});
 const batching:Record<string,ReturnType<typeof batchStatic>>={};Object.assign(window,{__inspectBatching:()=>batching});
 const camera=new THREE.PerspectiveCamera(44,1,.03,1800);camera.position.set(...views.exterior.position);
 const effects=new VisualEffects(renderer,scene,camera);Object.assign(window,{__inspectEffects:()=>effects.inspect()});
 Object.assign(window,{__inspectRendering:()=>{const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)),unique=new Map<string,number>(),layers:Record<string,{meshes:number;instances:number;triangles:number}>={};scene.traverseVisible(o=>{if(!(o instanceof THREE.Mesh)||o.frustumCulled&&!frustum.intersectsObject(o))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>!m.colorWrite))return;const g=o.geometry,triangles=(g.index?.count??g.getAttribute('position').count)/3,count=o instanceof THREE.InstancedMesh?o.count:1;unique.set(g.uuid,triangles);let layer:THREE.Object3D=o;while(layer.parent&&layer.parent!==scene)layer=layer.parent;const record=layers[layer.name||'other']??={meshes:0,instances:0,triangles:0};record.meshes++;record.instances+=count;record.triangles+=triangles*count;});return{scope:'Frustum-visible mesh geometry once, before extra rendering passes; includes transparent surfaces',uniqueGeometryTriangles:[...unique.values()].reduce((a,b)=>a+b,0),visibleInstancedTriangles:Object.values(layers).reduce((a,b)=>a+b.triangles,0),layers,transmissionScale:renderer.transmissionResolutionScale,shadowAutoUpdate:renderer.shadowMap.autoUpdate};}});
 Object.assign(window,{__inspectRepairs:()=>({removedOriginProps,storefront:!!scene.getObjectByName('WEB_Context_Storefront_Repair')})});
 Object.assign(window,{__inspectUpperEnvelope:()=>inspectUpperEnvelope(scene)});
 Object.assign(window,{__inspectCityAdditions:()=>inspectCityAdditions(scene),__inspectStreetExtension:()=>inspectStreetExtension(scene)});
 const traffic=new Traffic();Object.assign(window,{__inspectTraffic:()=>traffic.inspect()});
 if(new URLSearchParams(location.search).has('extension-review'))Object.assign(window,{__advanceTraffic:(seconds:number)=>{traffic.enabled=true;for(let i=0;i<seconds*20;i++)traffic.update(.05,camera);requestRender();return traffic.inspect();}});
 const linar=new LinarWalls();scene.add(linar.root);Object.assign(window,{__inspectLinar:()=>linar.inspect(),__linarMetrics:()=>linar.metrics});
 const desk=new ReceptionDesk();scene.add(desk.root);Object.assign(window,{__inspectDesk:()=>desk.inspect()});
 const receptionToggle=$<HTMLInputElement>('reception-light');receptionToggle.onchange=()=>{lighting.setReceptionEnabled(receptionToggle.checked);linar.setReceptionEnabled(receptionToggle.checked);renderer.shadowMap.needsUpdate=true;requestRender();};
 const trafficButton=$<HTMLButtonElement>('traffic');
 function syncTraffic(){trafficButton.hidden=!traffic.exterior;trafficButton.textContent=traffic.enabled?'Pause traffic':'Resume traffic';trafficButton.setAttribute('aria-pressed',String(traffic.enabled));}
 trafficButton.onclick=()=>{traffic.enabled=!traffic.enabled;lastUpdate=performance.now();syncTraffic();requestRender();};syncTraffic();
 Object.assign(window,{__inspectPeople:()=>{const remaining:string[]=[];scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.some(m=>/AE35_010_(?:people_|female_01_)/i.test(m.name)))remaining.push(o.name);});return{removed:[...removedPeople],remaining,furniturePresent:!!scene.getObjectByName('AE35_010_reception_chair1')&&!!scene.getObjectByName('AE35_010_reception_06')};}});
 Object.assign(window,{__inspectScene:()=>{const floor=scene.getObjectByName('AE35_010_building_A_carpets') as THREE.Mesh|undefined;const ray=new THREE.Raycaster(new THREE.Vector3(37,1.5,-30.8),new THREE.Vector3(0,-1,0),0,3);const hits=floor?ray.intersectObject(floor,true):[];return{floor:floor?{visible:floor.visible,frustumCulled:floor.frustumCulled,material:(floor.material as THREE.Material).name,normal:hits[0]?.face?.normal.toArray(),height:hits[0]?.point.y}:null,cameraY:camera.position.y,near:camera.near,far:camera.far};}});
 const plan=new SitePlan(canvas,requestRender);Object.assign(window,{__inspectSitePlan:()=>plan.inspect()});let previousPlanView:View='exterior';
 const orbit=new OrbitMode(camera,canvas);orbit.controls.target.set(...views.exterior.target);orbit.controls.maxPolarAngle=Math.PI*.94;
 Object.assign(window,{__reviewView:(position:number[],target:number[],fov=55)=>{orbit.goTo(new THREE.Vector3(...position),new THREE.Vector3(...target),{fov,duration:.15});diagnostics.animating=true;requestRender();},__reviewRay:(x:number,y:number)=>{const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),camera);return ray.intersectObjects(scene.children,true).slice(0,10).map(h=>({name:h.object.name,instance:h.instanceId,point:h.point.toArray(),material:((h.object as THREE.Mesh).material as THREE.Material)?.name}));}});
 let walking:WalkMode|undefined;
 const linarCamera=new LinarCamera(orbit,()=>{if(linarCamera.locked)walking?.stop();else if(walking?.active)orbit.setEnabled(false);diagnostics.animating=orbit.isAnimating();requestRender();},()=>matchMedia('(prefers-reduced-motion: reduce)').matches?.15:.65,()=>walking?.stop());
 Object.assign(window,{__inspectLinarCamera:()=>linarCamera.inspect()});
 const configChanged=(final=true)=>{effects.setInteracting(!final);syncReceptionSign(scene,linar.states.wall);walking?.invalidate();if(final)renderer.shadowMap.needsUpdate=true;requestRender();};
 const linarUI=setupLinarControls(linar,configChanged,id=>{if(linarCamera.focus(id))return;const presets={freestanding:{p:[37,2.15,-33.4],t:[40.2,1.73,-33.4]},ceiling:{p:[37,2.8,-30.8],t:[31.055,4.8,-35.35]}};if(id!=='freestanding'&&id!=='ceiling')return;const v=presets[id];orbit.goTo(new THREE.Vector3(...v.p),new THREE.Vector3(...v.t),{fov:60,duration:.5});diagnostics.animating=orbit.isAnimating();requestRender();},linarCamera,desk);
 const walkButton=document.createElement('button');walkButton.id='walk-toggle';walkButton.className='traffic-control';walkButton.hidden=true;walkButton.title='Unlock camera and walk with WASD';walkButton.textContent='Walk - WASD';stage.append(walkButton);
 const walkHelp=document.createElement('div');walkHelp.id='walk-help';walkHelp.className='walk-help';walkHelp.hidden=true;walkHelp.textContent='WASD to walk - drag to look - Esc to exit';walkHelp.setAttribute('role','status');stage.append(walkHelp);
 walking=new WalkMode(camera,orbit,canvas,()=>['building','lobby'].flatMap(id=>loaded.has(id)?[loaded.get(id)!]:[]),()=>[linar.root,desk.root],()=>{walkButton.textContent=walking?.active?'Exit walk':'Walk - WASD';walkButton.setAttribute('aria-pressed',String(!!walking?.active));walkHelp.hidden=!walking?.active;requestRender();});
 const dock=document.createElement('div');dock.id='viewer-dock';const dockViews=document.createElement('div');dockViews.className='dock-views';dockViews.append(document.querySelector('.views')!,document.querySelector('.hint')!);const dockActions=document.createElement('div');dockActions.className='dock-actions';dockActions.append(walkButton,$('linar-toggle'),$('traffic'));dock.append(document.querySelector('.environment')!,dockViews,dockActions,walkHelp);stage.append(dock);new ResizeObserver(()=>stage.style.setProperty('--dock-height',`${dock.getBoundingClientRect().height}px`)).observe(dock);
 const entrance=new TourEntrance(),tourWorld=new TourClearance();let tourOrigin:View='exterior',journeyGeneration=0,entryPhase='none',entryElapsed=0,entryMove:TourMotion|undefined,insideMove:TourMotion|undefined,savedDoor=0;
 const entranceAuto=new EntranceAutoClose(entrance);Object.assign(window,{__inspectEntrance:()=>({door:entrance.inspect(),automatic:entranceAuto.inspect()})});
 let tourWorldReady=false;
 function tourRoots(){return [...loaded.values()];}
 function prepareTourWorld(){if(!tourWorldReady){tourWorld.rebuild(tourRoots());tourWorldReady=true;}tourWorld.obstacles=linar.root.children.filter(o=>o.userData.application&&o.visible).map(o=>new THREE.Box3().setFromObject(o));return tourWorld;}
 linarCamera.setTourClearance(prepareTourWorld);
 function tourView(view:View){active=view;diagnostics.activeView=view;$('view-title').textContent=views[view].title;$('view-description').textContent=views[view].description;document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));const outside=view==='exterior';traffic.exterior=outside;syncTraffic();walkButton.hidden=outside;walking!.setAvailable(!outside);$('linar-toggle').hidden=outside;lighting.setInterior(!outside);effects.setInterior(!outside);resize();requestRender();}
 const tour=new ConfiguratorTour({linar,desk,ui:linarUI,camera:linarCamera,orbit,walking,changed:configChanged,setReceptionLight:value=>{receptionToggle.checked=value;lighting.setReceptionEnabled(value);linar.setReceptionEnabled(value);},journey:{
  prepare:async()=>{entranceAuto.resumeProximity();tourOrigin=active;savedDoor=entrance.amount;entryPhase='loading';const generation=++journeyGeneration;await loadLayer('lobby');if(!diagnostics.environmentReady)await loadEnvironment();if(generation!==journeyGeneration)return;tourWorldReady=false;if(tourOrigin!=='exterior'){entryPhase='none';return;}
   entrance.set(1);prepareTourWorld();const from=orbit.inspect(),approach={position:[20,1.9,-32.7],target:[28,1.9,-32.7],fov:59.2681},arrival=wallCeilingEntry;
   try{entryMove=new TourMotion(orbit,from,approach,tourWorld.route(new THREE.Vector3(...from.position),new THREE.Vector3(...approach.position)),tourWorld,requestRender,2.7);
    const through=[new THREE.Vector3(...approach.position),new THREE.Vector3(24,1.9,-32.7),new THREE.Vector3(27.5,1.9,-32.7)],tail=tourWorld.route(through.at(-1)!,new THREE.Vector3(...arrival.position));insideMove=new TourMotion(orbit,approach,arrival,[...through,...tail.slice(1)],tourWorld,requestRender,1.25,.35);entryPhase='approach';
   }finally{entrance.set(savedDoor);}
  },
  start:()=>{if(entryPhase!=='none')entranceAuto.reset();camera.near=.05;camera.far=1800;camera.updateProjectionMatrix();orbit.controls.minDistance=.2;orbit.controls.maxDistance=1300;entryElapsed=0;},
  update:dt=>{if(entryPhase==='none')return true;if(entryPhase==='approach'){if(entryMove!.update(dt)){entryPhase='door';entryElapsed=0;}}
   else if(entryPhase==='door'){entryElapsed=Math.min(2,entryElapsed+dt);const t=entryElapsed/2;entrance.set(savedDoor+(1-savedDoor)*t*t*(3-2*t));renderer.shadowMap.needsUpdate=true;requestRender();if(entryElapsed===2)entryPhase='inside';}
   else if(entryPhase==='inside'){const complete=insideMove!.update(dt);if(camera.position.x>25.6&&active==='exterior')tourView('reception');if(complete){entryPhase='complete';walking!.invalidate();return true;}}return false;},
  restore:manual=>{journeyGeneration++;entryMove=insideMove=undefined;tourWorld.dispose();tourWorldReady=false;if(!manual){entrance.set(savedDoor);entranceAuto.reset();tourView(tourOrigin);}else if(camera.position.x>25.6&&camera.position.z< -27)tourView('reception');entryPhase='none';walking!.invalidate();},
  complete:()=>{journeyGeneration++;entryMove=insideMove=undefined;tourWorld.dispose();tourWorldReady=false;entryPhase='none';entranceAuto.suspendProximityUntilMovement(camera.position);walking!.invalidate();},
  inspect:()=>({phase:entryPhase,origin:tourOrigin,door:entrance.inspect(),move:entryMove?.inspect(),inside:insideMove?.inspect(),clearance:tourWorld.inspect()})
 }});
 Object.assign(window,{__inspectTour:()=>tour.inspect(),__configPending:()=>linarUI.isPending()});
 if(new URLSearchParams(location.search).has('tour-review'))Object.assign(window,{__advanceTour:()=>tour.advance(),__tourGeometry:()=>{const app=linarUI.selected(),root=app==='desk'?desk.root:linar.root.children.find(o=>o.userData.application===app),points:number[][]=[],pixels:number[][]=[];let slats:THREE.InstancedMesh|undefined;root?.traverseVisible(o=>{if(!slats&&o instanceof THREE.InstancedMesh&&/4mm_slats/.test(o.name))slats=o;});if(slats){const mesh=slats as THREE.InstancedMesh,count=mesh.userData.collisionInstanceCount??mesh.count;for(let i=0;i<count;i+=Math.max(1,Math.floor(count/32))){const m=new THREE.Matrix4();if(mesh.userData.collisionInstanceMatrices)m.fromArray(mesh.userData.collisionInstanceMatrices,i*16);else mesh.getMatrixAt(i,m);const p=new THREE.Vector3(0,.3,0).applyMatrix4(m).applyMatrix4(mesh.matrixWorld);points.push(p.toArray());p.project(camera);pixels.push([(p.x+1)*canvas.clientWidth/2,(1-p.y)*canvas.clientHeight/2,p.z]);}}return{app,points,pixels};},__tourClearance:(position:number[])=>tourWorld.clear(new THREE.Vector3(...position))});
 walkButton.onclick=()=>{if(walking!.active){walking!.stop();return;}linarCamera.setUnlocked(true);linarUI.sync();walking!.start();};
 Object.assign(window,{__inspectWalk:()=>walking!.inspect(),__probeWalk:(position:number[],delta:number[])=>walking!.world.move(new THREE.Vector3(...position),new THREE.Vector3(...delta)).toArray()});
 let pointerStart={x:0,y:0};canvas.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',e=>{if(walking?.active||diagnostics.activeView==='plan'||diagnostics.activeView==='exterior'||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return;const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);for(const hit of ray.intersectObjects([linar.root,desk.root],true)){let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.application)o=o.parent;if(o?.visible&&o.userData.application){linarUI.selectApplication(o.userData.application);requestRender();break;}}});
 Object.assign(window,{__reviewWorldRay:(p:number[],d:number[],distance=100)=>{const ray=new THREE.Raycaster(new THREE.Vector3(...p),new THREE.Vector3(...d).normalize(),0,distance);return ray.intersectObjects([...loaded.values()],true).slice(0,12).map(h=>({name:h.object.name,point:h.point.toArray(),material:((h.object as THREE.Mesh).material as THREE.Material)?.name}));}});
 const signReport:Awaited<ReturnType<typeof replaceReceptionSigns>>=[];Object.assign(window,{__inspectSigns:()=>signReport.map(s=>({...s,instances:scene.getObjectsByProperty('name',s.name).length}))});
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),loaded=new Map<string,THREE.Group>(),pending=new Map<string,Promise<void>>();
 const materials=new Set<THREE.Material>();let quality:Quality='balanced';
 function prepareMaterial(material:THREE.Material){
  if(materials.has(material))return;materials.add(material);
  if(material instanceof THREE.MeshStandardMaterial){
   material.envMapIntensity=material.userData.entranceFinish ? .55 : 1;if(material.userData.entranceFinish&&scene.environment){material.envMap=scene.environment;material.envMapRotation.copy(scene.environmentRotation);}if(material.name==='REC_Warm_Lamp_Diffuser')material.emissiveIntensity=0;
   if(material.map)material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
   if(material instanceof THREE.MeshPhysicalMaterial&&material.transmission>0&&!material.userData.daylight){material.transmission=1;material.transparent=false;material.opacity=1;material.depthWrite=true;material.roughness=.015;material.metalness=0;material.ior=1.5;material.thickness=.02;material.side=THREE.FrontSide;}
   if(material.transparent&&material.map&&/window|entrance/i.test(material.name)&&!/glass/i.test(material.name)){material.alphaTest=.45;material.transparent=false;material.depthWrite=true;}
   const minimum=/corten/i.test(material.name)?.48:/building_A_black/i.test(material.name)?.38:/wood/i.test(material.name)?.36:0;
   if(minimum){material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, ${minimum.toFixed(2)});`);};material.customProgramCacheKey=()=>`architecture-roughness-${minimum}`;}
   material.needsUpdate=true;
  }
 }
 async function loadLayer(name:string):Promise<void>{
  if(loaded.has(name))return;if(pending.has(name))return pending.get(name);
  const task=(async()=>{const started=performance.now(),gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
   removedPeople.push(...excludePeople(gltf.scene));
   if(name==='context'&&!new URLSearchParams(location.search).has('source-review')){removedOriginProps.push(...excludeOriginProps(gltf.scene));repairContextStorefront(gltf.scene);}
   if(name==='context'&&!new URLSearchParams(location.search).has('envelope-review'))addUpperEnvelope(gltf.scene);
   if(!new URLSearchParams(location.search).has('city-review')){if(name==='context')addCityBackground(gltf.scene);if(name==='vegetation')addStreetTrees(gltf.scene);}
   await foliage.apply(gltf.scene);repairTreeBase(gltf.scene,name);await pbr.apply(gltf.scene,name);
   if(name==='building')signReport.push(...await addExteriorSign(gltf.scene));
   if(name==='street')extendStreet(gltf.scene);if(name==='context')extendContext(gltf.scene);
   if(name==='lobby'){desk.attach(gltf.scene);const lounge=await loadLounge(loader);gltf.scene.add(lounge);signReport.push(...await replaceReceptionSigns(gltf.scene));syncReceptionSign(gltf.scene,linar.states.wall);Object.assign(window,{__inspectLounge:()=>lounge.userData.items});}
   gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(prepareMaterial);o.castShadow=!mats.every(m=>m.transparent||(m instanceof THREE.MeshPhysicalMaterial&&m.transmission>0));o.receiveShadow=true;if(o instanceof THREE.InstancedMesh)diagnostics.instancedBatches++;});
   if(name==='building')entrance.attach(gltf.scene);
   if(name!=='street'&&!new URLSearchParams(location.search).has('batch-review'))batching[name]=batchStatic(gltf.scene);
   gltf.scene.name=`WEB_${name}`;scene.add(gltf.scene);if(name!=='street'){gltf.scene.updateWorldMatrix(true,true);gltf.scene.traverse(o=>{if(!o.userData.tourDynamic){o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;}});}if(name==='street'){traffic.register(gltf.scene);const finishes=applyVehicleFinishes(gltf.scene);Object.assign(window,{__inspectVehicleFinishes:()=>finishes});}visibility.register(gltf.scene);effects.register(gltf.scene);loaded.set(name,gltf.scene);walking?.invalidate();diagnostics.loadedLayers=[...loaded.keys()];diagnostics.modelRoots=loaded.size;diagnostics.loadMs[name]=performance.now()-started;renderer.shadowMap.needsUpdate=true;
   const bounds=new THREE.Box3();for(const root of loaded.values())bounds.expandByObject(root);diagnostics.streetBounds=[bounds.min.toArray(),bounds.max.toArray()];requestRender();
  })();pending.set(name,task);try{await task;}finally{pending.delete(name);}
 }
 let active:View='exterior',request=0,environmentTask:Promise<void>|null=null,fixturesLoaded=false;
 const setStatus=(message:string)=>{status.textContent=message;status.hidden=!message;};
 async function loadEnvironment(strict=false){
  if(environmentTask)return environmentTask;
  environmentTask=(async()=>{environmentRetry.hidden=true;try{startup.step(1);
   environmentStatus.textContent='Loading original sky…';await lighting.setQuality(quality);diagnostics.hdrSize=lighting.hdrSize;requestRender();
   startup.step(2);if(!fixturesLoaded){await lighting.loadFixtures();fixturesLoaded=true;requestRender();}
   const titles:Record<string,string>={street:'Street & furnishings',context:'Surrounding buildings',vegetation:'Trees & planting','upper-interior':'Existing upper-floor interiors'};
   for(const [index,layer] of ['street','context','vegetation','upper-interior'].entries()){if(strict&&startup.failed)throw new Error('Startup interrupted');startup.step(index+3);if(document.hidden)await new Promise<void>(resolve=>{const resume=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',resume);resolve();}};document.addEventListener('visibilitychange',resume);});environmentStatus.textContent=`Loading ${titles[layer].toLowerCase()}…`;await loadLayer(layer);}
   diagnostics.environmentReady=true;environmentStatus.textContent='Full street · Daylight HDR';$('load-note').textContent='Daylight street environment';
  }catch(error){diagnostics.errors.push(String(error));environmentStatus.textContent='Some surroundings could not load.';environmentRetry.hidden=false;if(strict)throw error;}finally{environmentTask=null;}})();return environmentTask;
 }
 function frame(view:View,animate=true){
  tour.setAvailable(view!=='plan');linarUI.flush();walking?.stop();walking?.setAvailable(view==='reception'||view==='ceiling');walkButton.hidden=view==='exterior'||view==='plan';linarCamera.suspend();orbit.cancelTransition();
  if(view==='plan'){const bounds=new THREE.Box3();for(const root of loaded.values())bounds.expandByObject(root);plan.frame(bounds,camera.aspect);plan.setActive(true);orbit.setEnabled(false);effects.setPlanCamera(plan.camera);traffic.exterior=false;syncTraffic();$('linar-toggle').hidden=true;$('linar-panel').hidden=true;lighting.setInterior(false);lighting.frame(true);diagnostics.animating=false;requestRender();return;}
  plan.setActive(false);orbit.setEnabled(true);effects.setPlanCamera(null);
  const preset=views[view],position=new THREE.Vector3(...preset.position),target=new THREE.Vector3(...preset.target),outside=view==='exterior';
  traffic.exterior=outside;syncTraffic();
  $('linar-toggle').hidden=outside;if(outside){$('linar-panel').hidden=true;$('linar-toggle').setAttribute('aria-expanded','false');}
  orbit.controls.minDistance=outside?2:.3;orbit.controls.maxDistance=outside?1300:35;
  camera.near=outside?.15:.05;camera.far=outside?1800:350;camera.updateProjectionMatrix();effects.setInterior(!outside);
  const fov=camera.aspect<1?(outside?98:85):preset.fov;lighting.frame(false);lighting.setInterior(!outside);
  if(animate)orbit.goTo(position,target,{fov,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?.15:.8});else orbit.restoreState({position,target,fov});
  diagnostics.animating=orbit.isAnimating();
  resize();
  requestRender();
 }
 async function select(view:View){
  const id=++request;retry.hidden=true;
  try{if(view==='plan'){if(!diagnostics.environmentReady){setStatus('Loading the whole neighbourhood.');await loadEnvironment();}if(active!=='plan'){previousPlanView=active;orbit.saveState();}}const restorePlan=active==='plan'&&view===previousPlanView;
   if((view==='reception'||view==='ceiling')&&!loaded.has('lobby')){setStatus('Loading existing interior…');await loadLayer('lobby');}if(id!==request)return;
   active=view;diagnostics.activeView=view;$('view-title').textContent=views[view].title;$('view-description').textContent=views[view].description;
   document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));frame(view,!restorePlan);if(restorePlan)orbit.restoreState();setStatus('');
  }catch(error){if(id!==request)return;diagnostics.errors.push(String(error));setStatus('The interior could not be loaded. Please retry.');retry.hidden=false;retry.onclick=()=>void select(view);}
 }
 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>{b.disabled=true;b.onclick=()=>void select(b.dataset.view as View);});
 environmentRetry.onclick=()=>void loadEnvironment();
 $<HTMLSelectElement>('quality').onchange=async()=>{const select=$<HTMLSelectElement>('quality');quality=select.value as Quality;renderer.transmissionResolutionScale=quality==='high'?1:.75;diagnostics.quality=quality;resourceStats.frameLimit=quality==='high'?60:30;select.disabled=true;environmentStatus.textContent='Adjusting sky & shadows…';try{await lighting.setQuality(quality);diagnostics.hdrSize=lighting.hdrSize;environmentStatus.textContent=diagnostics.environmentReady?'Full street · Daylight HDR':'Loading surroundings…';requestRender();}catch(error){diagnostics.errors.push(String(error));environmentStatus.textContent='Sky could not load. Retry surroundings.';environmentRetry.hidden=false;}finally{select.disabled=false;}};
 const resetView=()=>{walking?.stop();if(!linarCamera.resetView())frame(active);};$('reset').onclick=resetView;
 const zoom=(factor:number)=>{if(plan.active){plan.zoom(factor);requestRender();return;}if(walking?.active||linarCamera.locked||orbit.isAnimating())return;const offset=camera.position.clone().sub(orbit.controls.target);camera.position.copy(orbit.controls.target).add(offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,orbit.controls.minDistance,orbit.controls.maxDistance)));orbit.controls.update();};
 $('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);
 function help(open:boolean){if(open){$('linar-panel').hidden=true;$('linar-toggle').setAttribute('aria-expanded','false');linarCamera.suspend();}$('help-panel').hidden=!open;$('help').setAttribute('aria-expanded',String(open));(open?$('close-help'):$('help')).focus();}
 $('help').onclick=()=>help($('help-panel').hidden);$('close-help').onclick=()=>help(false);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('help-panel').hidden)help(false);});
 canvas.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){zoom(.8);e.preventDefault();}if(e.key==='-'){zoom(1.25);e.preventDefault();}if(e.key.toLowerCase()==='r')resetView();});
 function resize(){const {width,height}=stage.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();if(plan.active)plan.resize(camera.aspect);renderer.setPixelRatio(effects.interiorActive&&!plan.active?2:Math.min(devicePixelRatio,quality==='high'?2:1));renderer.transmissionResolutionScale=(quality==='high'?1:.75)*Math.min(devicePixelRatio,quality==='high'?2:1)/renderer.getPixelRatio();renderer.setSize(width,height,false);effects.resize(width,height,quality==='high');diagnostics.canvas=[width,height];requestRender();}
 new ResizeObserver(resize).observe(stage);
 $('quality').addEventListener('change',resize);
 renderer.info.autoReset=false;
 let startupFrame:(()=>void)|undefined;
 let frameHandle=0,dirty=false,lastUpdate=performance.now(),lastRender=-Infinity;
 function requestRender(){dirty=true;if(!frameHandle&&!document.hidden)frameHandle=requestAnimationFrame(renderFrame);}
 if(new URLSearchParams(location.search).has('perf-review'))installPerformanceReview(scene,renderer,effects,requestRender);
 if(new URLSearchParams(location.search).has('lighting-review'))installLightingReview(scene,renderer,lighting,effects,requestRender);
 const renderStudy=new URLSearchParams(location.search).has('render-study')?new RenderStudy(renderer,resourceStats,requestRender):undefined;
 function renderFrame(now:number){
  frameHandle=0;if(document.hidden||!diagnostics.environmentReady||startup.failed)return;
  if(now-lastRender<1000/(effects.interacting?Math.max(60,resourceStats.frameLimit):resourceStats.frameLimit)-.5){frameHandle=requestAnimationFrame(renderFrame);return;}
  const frameStarted=performance.now();renderStudy?.begin();if(renderStudy?.freezeShadows)renderer.shadowMap.needsUpdate=false;
  const dt=Math.min((now-lastUpdate)/1000,.1);lastUpdate=now;dirty=false;
  if(now-lastRender<1000){diagnostics.frameTimes.push(now-lastRender);if(diagnostics.frameTimes.length>180)diagnostics.frameTimes.shift();}lastRender=now;
  if(walking?.active)walking.update(dt);else if(!plan.active)orbit.update(dt);if(!plan.active&&!orbit.isAnimating()&&camera.position.y<.6){camera.position.y=.6;camera.lookAt(orbit.controls.target);}
  if(entranceAuto.update(camera.position,dt,['loading','approach','door'].includes(entryPhase),tour.active&&tour.inspect().paused,!tour.active)){walking?.invalidate();tourWorldReady=false;renderer.shadowMap.needsUpdate=true;}
  const renderCamera=plan.active?plan.camera:camera;traffic.update(dt,renderCamera);
  linar.update(renderCamera,renderer.shadowMap.needsUpdate);
  const shadowRefresh=renderer.shadowMap.needsUpdate;if(shadowRefresh)resourceStats.shadowRefreshes++;lighting.update(renderCamera);visibility.update(renderCamera,shadowRefresh);diagnostics.visibleInstances=visibility.visible;diagnostics.totalInstances=visibility.total;
  renderer.info.reset();const renderStarted=performance.now();try{effects.render();}catch(error){startup.fail('The first view could not be rendered. Try again or use a browser with WebGL enabled.');throw error;}const renderEnded=performance.now();renderStudy?.end(now,frameStarted,renderStarted,renderEnded,shadowRefresh);resourceStats.renderCpuMs.push(renderEnded-renderStarted);if(resourceStats.renderCpuMs.length>180)resourceStats.renderCpuMs.shift();resourceStats.frames++;resourceStats.totalDrawCalls+=renderer.info.render.calls;resourceStats.totalTriangles+=renderer.info.render.triangles;resourceStats.textures=renderer.info.memory.textures;resourceStats.geometries=renderer.info.memory.geometries;resourceStats.programs=renderer.info.programs?.length??0;resourceStats.pixelRatio=renderer.getPixelRatio();resourceStats.drawingBuffer=[canvas.width,canvas.height];resourceStats.hidden=document.hidden;diagnostics.camera=renderCamera.position.toArray();diagnostics.target=(plan.active?plan.controls.target:orbit.controls.target).toArray();diagnostics.animating=!plan.active&&orbit.isAnimating();diagnostics.triangles=renderer.info.render.triangles;diagnostics.drawCalls=renderer.info.render.calls;
  if(startupFrame){const resolve=startupFrame;startupFrame=undefined;resolve();}
  if(shadowRefresh||(!plan.active&&orbit.isAnimating())||dirty||traffic.running||walking?.moving||entranceAuto.running&&!(tour.active&&tour.inspect().paused))requestRender();
 }
 orbit.controls.addEventListener('change',requestRender);
 document.addEventListener('visibilitychange',()=>{resourceStats.hidden=document.hidden;if(document.hidden){if(frameHandle)cancelAnimationFrame(frameHandle);frameHandle=0;}else{lastUpdate=performance.now();requestRender();}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();startup.fail('The graphics connection was interrupted. Try again.');setStatus('Graphics connection interrupted. Reload to continue.');retry.textContent='Reload viewer';retry.hidden=false;retry.onclick=()=>location.reload();});
 async function initialLoad(){
  try{
   startup.step(0);retry.hidden=true;setStatus('');await loadLayer('building');
   if(startup.failed)return;await loadEnvironment(true);if(startup.failed)return;startup.step(7);
   await new Promise<void>(resolve=>{startupFrame=resolve;frame('exterior',false);});
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   diagnostics.ready=startup.complete();
   if(diagnostics.ready)document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.disabled=false);
  }catch(error){diagnostics.errors.push(String(error));startup.fail();}
 }
 await initialLoad();
}
boot().catch(error=>{diagnostics.errors.push(String(error));startup.fail('This browser could not start the 3D viewer. Enable WebGL and try again.');status.textContent='This browser could not start the 3D viewer. Enable WebGL and reload.';retry.hidden=false;retry.textContent='Reload viewer';retry.onclick=()=>location.reload();});





