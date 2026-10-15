import * as THREE from 'three';
import { initializeSoundtrack } from './soundtrack.js';
import { createMusicScreen } from './music-screen.js';
import { createWebsiteScreen } from './website-screen.js';
import { applyGalleryQuality, getGalleryQuality } from './gallery-quality.js';
import { createGalleryGround } from './gallery-ground.js';
import { addMatchingGalleryWindow } from './gallery-window.js';
import { addSecondWingFixtures } from './gallery-second-wing.js';
import { addSecondWingChairs } from './gallery-second-wing-chairs.js';
import { createDoryphoros } from './doryphoros.js';
import { loadClassicalSculptures } from './classical-sculptures.js';
import { createClassicalSculptureMaterial } from './classical-sculpture-material.js';
import { createSculptureInformation } from './sculpture-information.js';
import { initializeStudies } from './studies.js';
import { createGalleryTour } from './tour.js';
import { createGalleryWalk } from './gallery-walk.js';
import { createGalleryRoof } from './gallery-roof.js';
import { createViewportFullscreen } from './viewport-fullscreen.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { DRACOLoader } from './vendor/loaders/DRACOLoader.js';
import { OrbitControls } from './vendor/controls/OrbitControls.js';

const mobileAssets=getGalleryQuality().mobile;
const MODEL='../AI66_002-gallery-web-v1.glb',SCULPTURES=mobileAssets?'../assets/mobile/sculptures-v1.glb':'../assets/AI66_002-sculptures-web-v1.glb';
const ORIGIN=[4.492431640625,.7928047180175781,.020121637731790543];
const toGLTF=([x,y,z])=>new THREE.Vector3(x-ORIGIN[0],z-ORIGIN[2],-(y-ORIGIN[1]));
const el=id=>document.getElementById(id),viewport=el('viewport'),canvas=el('scene');
const soundtrack=initializeSoundtrack({viewport});
let musicScreen=null,websiteScreen=null,sculpturePicker=null,walk=null;
const intro=window.galleryIntro;
const fullscreen=createViewportFullscreen({viewport,button:el('viewport-fullscreen'),onSkipTour:()=>skipTourToEntry()});
const sculptureInformation=createSculptureInformation({viewport});
const state=window.__ai66={status:'loading',galleryStatus:'loading',sculptureStatus:'loading',modelURL:MODEL,sculptureURL:SCULPTURES,
  loadMs:null,fileBytes:0,environmentBytes:0,sculptureBytes:0,camera:'overview',selectedSculpture:null,roofVisible:false,
  frames:0,drawCalls:0,renderedTriangles:0,sceneTriangles:0,visibleTriangles:0,partitionNames:[],rootIdentity:false,
  sculptureRootIdentity:false,errors:[],webglErrors:[],instanceBatches:[],frameMs:[],fps:null,renderer:'',materialCount:0,meshCount:0,sculptures:[],cameraPresets:[]};
window.addEventListener('error',e=>state.errors.push(e.message));window.addEventListener('unhandledrejection',e=>state.errors.push(String(e.reason)));
canvas.addEventListener('webglcontextlost',()=>{state.errors.push('WebGL context lost');state.status='error';intro?.fail('The graphics connection was interrupted. Reload the gallery to try again.');});
const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobileAssets,alpha:false,powerPreference:'high-performance'});
state.quality=applyGalleryQuality(renderer);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
const castMaterial=createClassicalSculptureMaterial({renderer});state.castMaterial=castMaterial.state;
const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');state.renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
const scene=new THREE.Scene();scene.background=new THREE.Color('#e7e5df');const camera=new THREE.PerspectiveCamera(45,1,.05,400);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.4;controls.maxDistance=220;controls.maxPolarAngle=Math.PI*.94;controls.screenSpacePanning=true;controls.listenToKeyEvents(canvas);
scene.add(new THREE.HemisphereLight('#fffaf0','#b8b4a5',2.25));const key=new THREE.DirectionalLight('#fff9ee',2.25);key.position.set(-16,38,28);scene.add(key);
const fill=new THREE.DirectionalLight('#ecf1f7',.75);fill.position.set(28,15,-20);scene.add(fill);
const ground=createGalleryGround({renderer,scene});state.ground=ground.state;
ground.ready.then(()=>{state.groundBytes=ground.state.loadedBytes;updateStatus();});
let model,sculptureModel,roofGroups=[],sculptures=[],presets=[],studies=null,tour=null,roof=null;
let preparedFrames=0,introReadyRecorded=false;
intro?.bind({
  activate(mode,element){
    if(mode==='tour'){
      // The intro stays above the viewport during native fullscreen's top-layer
      // transition. play() retains this trusted gesture for requestFullscreen.
      viewport.append(element);
      if(!tour?.play())throw new Error('The tour is not ready');
    }else if(walk?.state.ready){
      if(!skipTourToEntry()&&!walk.enter({pose:entryWalkPose()}))selectCamera('interior');
    }else{
      selectCamera('interior');
    }
  },
  complete(){
    (fullscreen.state.active&&!walk?.state.active?el('viewport-fullscreen'):canvas).focus({preventScroll:true});
  },
});
function updateIntro(frameRendered=false){
  if(!intro||['entered','leaving','error'].includes(intro.state.mode))return;
  if(state.galleryStatus==='error'){intro.fail('The gallery download failed. Check your connection, then reload to try again.');return;}
  const galleryReady=state.galleryStatus==='ready',sculpturesReady=state.sculptureStatus==='ready';
  const sculptureFailure=state.sculptureStatus==='error';
  const studiesDone=studies?.state.status==='ready'||studies?.state.status==='error';
  const assetsSettled=galleryReady&&(sculpturesReady||sculptureFailure)&&ground.state.ready&&(studiesDone||sculptureFailure);
  if(!assetsSettled)preparedFrames=0;else if(frameRendered)preparedFrames++;
  const viewReady=preparedFrames>=2;
  const stages={gallery:state.galleryStatus,sculptures:sculptureFailure?'fallback':state.sculptureStatus,
    surfaces:ground.state.ready?(ground.state.status==='ready'?'ready':'fallback'):'loading',
    lighting:studiesDone?(studies.state.environment.status==='ready'&&studies.state.status==='ready'?'ready':'fallback'):sculptureFailure?'fallback':'waiting',
    view:viewReady?'ready':assetsSettled?'loading':'waiting'};
  const warnings=[];
  if(state.classicalSculptures?.failed.length)warnings.push('Some new sculptures could not load. The available collection remains open.');
  if(state.castMaterial?.status==='fallback')warnings.push('The sculpture surface detail could not load; the plaster material remains available.');
  if(state.doryphoros?.ready===false)warnings.push('The new sculpture could not load. The original collection remains available.');
  if(sculptureFailure)warnings.push('The sculptures could not load. You can explore the room or reload to try again.');
  if(ground.state.ready&&ground.state.status!=='ready')warnings.push('Some outdoor textures could not load; a simple surface is available.');
  if(studies?.state.status==='error')warnings.push('The studies are unavailable; you can still explore the gallery.');
  else if(studies?.state.environment.status==='error')warnings.push('The sky could not load; the gallery uses its basic lighting.');
  let message=viewReady?'Your gallery is ready':!galleryReady?'Loading the gallery':!sculpturesReady&&!sculptureFailure?'Loading the sculptures':!ground.state.ready?'Preparing outdoor surfaces':!studiesDone&&!sculptureFailure?'Preparing light and materials':'Preparing the first view';
  let download='';
  const loading=!galleryReady?'gallery':!sculpturesReady&&!sculptureFailure?'sculpture':null;
  if(loading){const loaded=state[loading+'Loaded']??0,total=loading==='gallery'?state.environmentBytes:state.sculptureBytes;if(loaded)download=`${loading==='gallery'?'Gallery':'Sculptures'} · ${(loaded/1e6).toFixed(1)}${total?' / '+(total/1e6).toFixed(1):''} MB downloaded`;}
  intro.update({stages,message,download,canTour:viewReady&&tour?.state.ready,canExplore:viewReady,warning:viewReady?warnings.join(' '):''});
  if(viewReady&&!introReadyRecorded){introReadyRecorded=true;state.loadMs=performance.now()-start;el('load-time').textContent=(state.loadMs/1000).toFixed(2)+' s';}
}
const clippingBounds=new THREE.Box3(new THREE.Vector3().fromArray(ground.state.bounds.min),new THREE.Vector3().fromArray(ground.state.bounds.max));
const clippingSphere=new THREE.Sphere();clippingBounds.getBoundingSphere(clippingSphere);
function refreshCameraBounds(){
  clippingBounds.set(new THREE.Vector3().fromArray(ground.state.bounds.min),new THREE.Vector3().fromArray(ground.state.bounds.max));
  for(const root of [model,sculptureModel])if(root)clippingBounds.union(new THREE.Box3().setFromObject(root));
  clippingBounds.expandByScalar(.5);clippingBounds.getBoundingSphere(clippingSphere);updateCameraClipping();
}
function updateCameraClipping(){
  // The imported floor is only 2cm thick. A 4cm near plane at the distant
  // aerial camera loses enough depth precision for its underside to flicker
  // through the top. Use the empty space outside the measured scene bounds;
  // return continuously to 4cm before entering the gallery or inspecting art.
  const clearance=clippingBounds.distanceToPoint(camera.position);
  const near=Math.min(2,.04+Math.max(0,clearance-1)*.03);
  const far=Math.max(80,camera.position.distanceTo(clippingSphere.center)+clippingSphere.radius+10);
  if(Math.abs(camera.near-near)>1e-9||Math.abs(camera.far-far)>1e-9){camera.near=near;camera.far=far;camera.updateProjectionMatrix();}
  state.cameraClipping={method:'Scene-bounds adaptive near/far planes',near,far,clearance,interiorNear:.04};
}
// Remember early input while the independent sculpture asset is still loading.
let manualBeforeTour=false;
const manualEvents=['pointerdown','wheel','keydown','input','change'];
function rememberEarlyInput(event){
  if(event.target.closest?.('[data-preserve-tour]'))return;
  if(event.type==='keydown'&&['Tab','Shift','Control','Alt','Meta','Escape'].includes(event.key))return;
  if(event.target.closest?.('button,input,select,canvas'))manualBeforeTour=true;
}
manualEvents.forEach(type=>document.querySelector('main').addEventListener(type,rememberEarlyInput,{capture:true,passive:true}));
const identities=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],number=new Intl.NumberFormat('en-US'),start=performance.now();
const identity=root=>{root?.updateMatrix();return !!root&&root.matrix.elements.every((n,i)=>Math.abs(n-identities[i])<1e-6);};
function countTriangles(onlyVisible,source){let count=0;const visit=o=>{if(o.isMesh)count+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);};for(const object of source?[source]:[model,sculptureModel,ground.mesh])if(object){if(onlyVisible)object.traverseVisible(visit);else object.traverse(visit);}return Math.round(count);}
function syncRoof(amount){state.roofAmount=amount;state.roofVisible=amount>0;el('roof').checked=amount>0;el('roof').indeterminate=amount>0&&amount<1;state.visibleTriangles=countTriangles(true);}
function updateRoof(){const amount=el('roof').checked?1:0;if(roof)roof.setAmount(amount);else{roofGroups.forEach(o=>o.visible=amount>0);syncRoof(amount);}}
function keepCameraAboveGround(){
  // Preserve upward-looking presets while preventing orbit/pan below the floor.
  const lift=Math.max(0,.12-camera.position.y,ground.state.bounds.min[1]-controls.target.y);
  if(lift>0){camera.position.y+=lift;controls.target.y+=lift;camera.lookAt(controls.target);}
}
function snapshot(){state.cameraPosition=camera.position.toArray();state.cameraTarget=controls.target.toArray();state.cameraFov=camera.fov;state.visibleSculptures=sculptures.filter(o=>o.visible).map(o=>o.name);return structuredClone(state);}
function setPose(position,target,fov=45){
  // Drain previous orbit damping before applying a preset.
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  camera.position.fromArray(position);controls.target.fromArray(target);camera.fov=fov;camera.lookAt(controls.target);camera.updateProjectionMatrix();controls.update();controls.enableDamping=damping;keepCameraAboveGround();updateCameraClipping();state.frameMs=[];snapshot();
}
function syncCameraUI(){el('overview').setAttribute('aria-pressed',String(state.camera==='overview'));el('interior').setAttribute('aria-pressed',String(state.camera==='interior'));el('sculpture-select').value=['music-screen','website-screen'].includes(state.camera)?state.camera:state.selectedSculpture??'';el('sculpture-select').dataset.viewLabel=state.camera==='walk'?'Walking through the gallery':state.camera==='interior'?'Gallery interior':state.camera==='floor-fog'?'Gallery floor':'Gallery overview';sculpturePicker?.sync();sculptureInformation.select(state.selectedSculpture);websiteScreen?.select(state.camera);const index=presets.findIndex(p=>p.id===state.selectedSculpture),preset=presets[index];el('focus-label').textContent=preset?`${preset.label} · ${index+1} / ${presets.length}`:state.camera==='overview'?'Full gallery':state.camera==='floor-fog'?'Gallery floor':state.camera==='music-screen'?'Music · Light in motion':state.camera==='website-screen'?'IOM · Experiments':state.camera==='walk'?'Walking · Eye height 1.70 m':'Gallery interior';}
function getPose(id){
  if(id===undefined)return{position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,aspect:camera.aspect};
  if(['music-screen','website-screen'].includes(id)&&musicScreen){
    const screenPose=id==='website-screen'?websiteScreen.cameraPose:musicScreen.getCameraPose(id);
    const source=camera.aspect<1&&screenPose.portrait?screenPose.portrait:screenPose;
    const aspect=source.aspect??1.5;
    const fov=camera.aspect<aspect?Math.min(125,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(source.fov/2))*aspect/camera.aspect))):source.fov;
    return{position:[...source.position],target:[...source.target],fov,aspect:camera.aspect};
  }
  if(id==='floor-fog'){
    // A measured, walkable aisle at visitor eye height gives the low mist room
    // to read against the floor, pedestals, and the opening into the next room.
    const portrait=camera.aspect<1,baseFov=portrait?70:60,checkedAspect=portrait?.8:1;
    const fov=camera.aspect<checkedAspect?Math.min(105,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov/2))*checkedAspect/camera.aspect))):baseFov;
    return{position:[1,1.7,-8],target:[-5,.5,-16],fov,aspect:camera.aspect};
  }
  const preset=presets.find(p=>p.id===id);
  if(preset){
    const view=camera.aspect<1&&preset.portrait?preset.portrait:preset;
    let fov=view.fov??preset.fov??45;const checkedAspect=view.aspectChecked??(camera.aspect<1?.8:1.8);
    if(camera.aspect<checkedAspect)fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(fov)/2)*checkedAspect/camera.aspect));
    return{position:[...view.position],target:[...(view.target??preset.target)],fov,aspect:camera.aspect};
  }
  if(id==='overview'){
    const position=toGLTF([66,-66,57]),target=toGLTF([4,2,1.5]);
    if(camera.aspect<1)position.sub(target).multiplyScalar(1.3).add(target);
    return{position:position.toArray(),target:target.toArray(),fov:45,aspect:camera.aspect};
  }
  return{position:toGLTF([4.5,7.3,1.7]).toArray(),target:toGLTF([4.5,20,2.5]).toArray(),fov:45,aspect:camera.aspect};
}
function fitPoseFov(fov,fromAspect,toAspect){
  const factor=Math.min(1,fromAspect)/Math.min(1,toAspect);
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(fov)/2)*factor)),15,110);
}
function applyCurrentPose(){walk?.exit();const pose=getPose(state.selectedSculpture??state.camera);setPose(pose.position,pose.target,pose.fov);}
function selectCamera(mode,{move=true,preserveRoof=false}={}){walk?.exit();if(mode!=='music-screen')musicScreen?.setAmount(0);state.camera=mode;state.selectedSculpture=null;if(!preserveRoof){el('roof').checked=mode==='interior'||mode==='floor-fog'||mode==='music-screen'||mode==='website-screen';updateRoof();}if(move)applyCurrentPose();syncCameraUI();studies?.onSelectSculpture(mode==='floor-fog'?'floor-fog':null);}
function selectSculpture(id,{move=true,preserveRoof=false}={}){walk?.exit();if(!id){selectCamera('overview',{move,preserveRoof});return;}if(state.sculptureStatus!=='ready'||!presets.some(p=>p.id===id))return;musicScreen?.setAmount(0);state.camera='sculpture';state.selectedSculpture=id;if(!preserveRoof){el('roof').checked=true;updateRoof();}if(move)applyCurrentPose();syncCameraUI();studies?.onSelectSculpture(state.selectedSculpture);}
function entryWalkPose(){return {...getPose('interior'),fov:60};}
function skipTourToEntry(){
  if(!walk?.state.ready||!tour?.state.ready)return false;
  walk.exit();
  if(!tour.skip())return false;
  return walk.enter({pose:entryWalkPose()});
}
function initializeWalk(){
  walk=createGalleryWalk({camera,controls,canvas,viewport,navigation:tour.navigation,
    getEntryPose:entryWalkPose,button:el('walk-toggle'),
    onEnter(){
      if(tour.state.reason!=='skipped')tour.pause('manual');
      sculpturePicker?.close();musicScreen?.setAmount(0);
      state.camera='walk';state.selectedSculpture=null;roof?.setAmount(1);
      syncCameraUI();studies?.onSelectSculpture(null);
      canvas.setAttribute('aria-label','3D gallery walking view; WASD or arrow keys to move, drag to look');
      snapshot();
    },
    onExit(){
      if(state.camera==='walk'){state.camera='interior';syncCameraUI();}
      canvas.setAttribute('aria-label','3D gallery; drag to orbit and scroll to zoom');
    }
  });
  state.walk=walk.state;el('walk-toggle').disabled=!walk.state.ready;
}
const cameraRig={getPose,
  applyPose(pose){
    // Clear pending orbit motion before the guided path supplies the next pose.
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
    camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);
    const fov=pose.fov===undefined?camera.fov:fitPoseFov(pose.fov,pose.aspect??camera.aspect,camera.aspect);
    if(fov!==camera.fov){camera.fov=fov;camera.updateProjectionMatrix();}
    camera.lookAt(controls.target);controls.update();controls.enableDamping=damping;updateCameraClipping();
  },
  selectView(id){if(id==='overview'||id==='interior'||id==='floor-fog'||id==='music-screen'||id==='website-screen')selectCamera(id,{move:false,preserveRoof:true});else selectSculpture(id,{move:false,preserveRoof:true});}
};
function stepSculpture(step){if(!presets.length||state.sculptureStatus!=='ready')return;const index=presets.findIndex(p=>p.id===state.selectedSculpture);selectSculpture(presets[index<0?(step>0?0:presets.length-1):(index+step+presets.length)%presets.length].id);}
el('overview').addEventListener('click',()=>selectCamera('overview'));el('interior').addEventListener('click',()=>selectCamera('interior'));el('roof').addEventListener('change',()=>{updateRoof();tour?.noteRoofManualChange?.();state.frameMs=[];});
el('sculpture-select').addEventListener('change',e=>{if(e.target.value==='music-screen')musicScreen?.show();else if(e.target.value==='website-screen'){tour?.pause('manual');selectCamera('website-screen');}else selectSculpture(e.target.value);});el('previous-sculpture').addEventListener('click',()=>stepSculpture(-1));el('next-sculpture').addEventListener('click',()=>stepSculpture(1));el('reset-view').addEventListener('click',applyCurrentPose);
// Keep native navigation available if the optional thumbnail enhancement fails.
import('./sculpture-picker.js').then(({createSculpturePicker})=>{sculpturePicker=createSculpturePicker({select:el('sculpture-select'),viewport,walkButton:el('walk-toggle')});}).catch(()=>{});
function resize(){
  const{width,height}=viewport.getBoundingClientRect();if(width<=0||height<=0)return;
  const previousAspect=camera.aspect,nextAspect=width/height;
  // Fullscreen and layout changes preserve the visitor's position and direction.
  // Keep the smaller dimension's field of view so a portrait view still fits.
  camera.fov=fitPoseFov(camera.fov,previousAspect,nextAspect);
  camera.aspect=nextAspect;camera.updateProjectionMatrix();state.quality=applyGalleryQuality(renderer);renderer.setSize(width,height,false);
  state.viewport={width:Math.round(width),height:Math.round(height),pixelRatio:renderer.getPixelRatio()};
}
new ResizeObserver(resize).observe(viewport);resize();selectCamera('overview',{preserveRoof:true});
window.galleryPreview={scene,camera,controls,ground,fullscreen,intro,soundtrack,get walk(){return walk;},skipTourToEntry,get musicScreen(){return musicScreen;},get websiteScreen(){return websiteScreen;},get sculpturePicker(){return sculpturePicker;},sculptureInformation,cameraRig,selectCamera,selectSculpture,reset:applyCurrentPose,snapshot,get roof(){return roof;},get galleryModel(){return model;},get sculptureModel(){return sculptureModel;},get presets(){return presets;},get studies(){return studies;},get tour(){return tour;}};
function updateStatus(){
  state.sceneTriangles=countTriangles(false);state.visibleTriangles=countTriangles(true);state.fileBytes=state.environmentBytes+state.sculptureBytes;
  if(state.fileBytes)el('file-size').textContent=(state.fileBytes/1e6).toFixed(2)+' MB';
  el('overview').disabled=el('interior').disabled=el('roof').disabled=state.galleryStatus!=='ready';
  for(const id of ['sculpture-select','previous-sculpture','next-sculpture'])el(id).disabled=state.sculptureStatus!=='ready'||state.galleryStatus!=='ready';
  if(state.galleryStatus==='error'){state.status='error';el('status').className='error';el('status').textContent='The gallery could not load. Refresh the page and check the local preview server.';}
  else if(state.galleryStatus==='ready'&&state.sculptureStatus==='error'){state.status='partial';el('status').className='error';el('status').textContent='The gallery is available, but the sculptures could not load. Refresh the page to try again.';}
  else if(state.galleryStatus==='ready'&&state.sculptureStatus==='ready'){state.status='ready';state.loadMs=performance.now()-start;el('load-time').textContent=(state.loadMs/1000).toFixed(2)+' s';el('status').textContent='The gallery and sculptures are ready';el('status').className='ready';if(!studies){studies=initializeStudies({renderer,scene,camera,galleryModel:model,sculptureModel,groundReceiver:ground.mesh,selectSculpture,selectCamera});state.studies=studies.state;websiteScreen=createWebsiteScreen({scene,galleryModel:model,camera,canvas,viewport,pauseTour:()=>tour?.pause('manual'),getOccluders:()=>[model,sculptureModel].filter(Boolean)});state.websiteScreen=websiteScreen.state;musicScreen=createMusicScreen({scene,galleryModel:model,renderer,getStudies:()=>studies,player:soundtrack.player,focus:id=>selectCamera(id),pauseTour:()=>tour?.pause('manual'),viewport});state.musicScreen=musicScreen.state;tour=createGalleryTour({getStudies:()=>studies,getMusicScreen:()=>musicScreen,onPlayMusic:()=>soundtrack.player.play(),onBeforePlay:()=>{walk?.exit();sculpturePicker?.close();},onSkip:()=>skipTourToEntry(),selectCamera,selectSculpture,cameraRig,galleryModel:model,sculptureModel,roof,fullscreen,canvas,manualInteraction:manualBeforeTour,autoStart:false});state.tour=tour.state;initializeWalk();manualEvents.forEach(type=>document.querySelector('main').removeEventListener(type,rememberEarlyInput,{capture:true}));}}
  else el('status').textContent=state.galleryStatus==='ready'?'Loading sculptures…':'Loading gallery…';
}
const draco=new DRACOLoader();draco.setDecoderPath('./vendor/draco/');draco.setWorkerLimit(mobileAssets?1:2);const sculptureLoader=new GLTFLoader().setDRACOLoader(draco);
new GLTFLoader().setDRACOLoader(draco).load(MODEL,gltf=>{
  model=gltf.scene;scene.add(model);state.matchingWindow=addMatchingGalleryWindow(model).state;state.secondWing=addSecondWingFixtures(model).state;state.secondWingChairs=addSecondWingChairs(model).state;refreshCameraBounds();state.galleryStatus='ready';const root=model.getObjectByName('gallery_root');state.rootIdentity=identity(root);state.rootName=root?.name??null;
  const materials=new Set();model.traverse(o=>{if(o.name==='roof_structure'||o.name==='roof_glazing')roofGroups.push(o);if(/^layout_partition_ai66_\d+$/.test(o.name))state.partitionNames.push(o.name);if(o.isMesh){state.meshCount++;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));if(o.isInstancedMesh)state.instanceBatches.push({name:o.name,count:o.count});}});
  state.materialCount=materials.size;state.partitionNames.sort();const bounds=new THREE.Box3().setFromObject(model);state.bounds={min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()};state.roofGroups=roofGroups.map(o=>o.name);state.extensions=gltf.parser.json.extensionsUsed??[];state.environmentTriangles=countTriangles(false,model);el('partitions').textContent=String(state.partitionNames.length);roof=createGalleryRoof({galleryModel:model,scene,onChange:syncRoof});updateRoof();updateStatus();
},event=>{state.galleryLoaded=event.loaded;if(event.total){state.environmentBytes=event.total;updateStatus();}updateIntro();},error=>{state.galleryStatus='error';state.errors.push(String(error));updateStatus();});

Promise.all([new Promise((resolve,reject)=>sculptureLoader.load(SCULPTURES,resolve,event=>{state.sculptureLoaded=event.loaded;if(event.total){state.sculptureBytes=event.total;updateStatus();}updateIntro();},reject)),fetch('./camera-presets.json').then(response=>{if(!response.ok)throw new Error('Camera presets unavailable');return response.json();}),createDoryphoros({loader:sculptureLoader}).catch(error=>{state.doryphoros={ready:false,error:String(error)};return null;}),loadClassicalSculptures({loader:sculptureLoader}),castMaterial.ready]).then(([gltf,config,doryphoros,classical])=>{
  sculptureModel=gltf.scene;presets=config.presets.map(p=>({...p,label:p.id==='A'?'Relief A':'Sculpture '+p.id.replace(/00([12])$/,'$1')}));sculptureModel.traverse(o=>{if(/^AI66_002_Sculpture_[A-F]\d*$/.test(o.name))sculptures.push(o);});
  if(sculptures.length!==9||presets.length!==9||presets.some(p=>!sculptures.some(o=>o.name===p.name)))throw new Error('Sculpture/camera mapping is incomplete');
  state.sculptureRootIdentity=identity(sculptureModel.getObjectByName('sculptures_root'));if(!state.sculptureRootIdentity)throw new Error('Unexpected sculpture root transform');
  if(doryphoros){castMaterial.apply(doryphoros.root.getObjectByName('Doryphoros_sculpture'));sculptureModel.add(doryphoros.root);sculptures.push(doryphoros.root);presets.push(doryphoros.preset);state.doryphoros=doryphoros.state;state.sculptureBytes+=127836;}
  state.classicalSculptures={loaded:classical.loaded.map(item=>item.state),failed:classical.failed};
  for(const item of classical.loaded){castMaterial.apply(item.root.getObjectByName(item.state.id+'_sculpture'));sculptureModel.add(item.root);sculptures.push(item.root);presets.push(item.preset);state.sculptureBytes+=item.state.bytes;}
  scene.add(sculptureModel);sculptureModel.updateMatrixWorld(true);refreshCameraBounds();state.sculptures=sculptures.map(o=>({name:o.name,scale:o.scale.toArray(),position:o.position.toArray(),triangles:countTriangles(false,o)}));state.sculptureTriangles=countTriangles(false,sculptureModel);state.cameraPresets=presets;state.sculptureExtensions=gltf.parser.json.extensionsUsed??[];
  for(const preset of presets){const option=document.createElement('option');option.value=preset.id;option.textContent=preset.label;el('sculpture-select').append(option);}const musicOption=document.createElement('option');musicOption.value='music-screen';musicOption.textContent='Music screen';el('sculpture-select').append(musicOption);const secondMusicOption=document.createElement('option');secondMusicOption.value='website-screen';secondMusicOption.textContent='Second gallery · IOM Experiments';el('sculpture-select').append(secondMusicOption);state.sculptureStatus='ready';updateStatus();snapshot();
}).catch(error=>{state.sculptureStatus='error';state.errors.push(String(error));updateStatus();});
let previous=performance.now(),lastStats=0,lastUI=0,lastRender=0,awakeUntil=0;
// Render continuously for interaction and animated studies. Static mobile views
// refresh twice a second for asynchronous assets, without running full GPU passes.
function wake(){awakeUntil=performance.now()+1500;}
for(const type of ['pointerdown','pointermove','wheel','keydown','input','change','click'])document.addEventListener(type,wake,{passive:true,capture:true});
controls.addEventListener('change',wake);window.addEventListener('resize',wake);
document.addEventListener('visibilitychange',()=>{previous=performance.now();wake();});
function mobileIsAnimating(){
  const effects=state.studies?.effects;
  return tour?.state.mode==='playing'||walk?.state.active||intro?.state.mode==='leaving'||
    (musicScreen?.state.amount??0)>0||(musicScreen?.state.requested??0)>0||
    ['fog','deform'].some(id=>(effects?.strength?.[id]??0)>0&&(effects?.settings?.[id]?.speed??0)>0);
}
function animate(now){requestAnimationFrame(animate);if(document.hidden)return;
if(state.quality.mobile&&state.status==='ready'&&intro?.state.canExplore&&!mobileIsAnimating()&&now>awakeUntil&&now-lastRender<500)return;
lastRender=now;if(intro?.state.mode!=='leaving')tour?.update(now);if(!state.quality.mobile||now-lastUI>100){fullscreen.update?.(tour);lastUI=now;}if(walk?.state.active)walk.update(now);else controls.update();keepCameraAboveGround();updateCameraClipping();studies?.update(now/1000);musicScreen?.update(now/1000);const previousAutoReset=renderer.info.autoReset;renderer.info.autoReset=false;renderer.info.reset();try{if(!studies?.render(camera))renderer.render(scene,camera);}finally{renderer.info.autoReset=previousAutoReset;}const dt=now-previous;previous=now;if(state.status==='ready'&&dt>0&&dt<1000){state.frameMs.push(dt);if(state.frameMs.length>180)state.frameMs.shift();}state.frames++;updateIntro(true);state.drawCalls=renderer.info.render.calls;state.renderedTriangles=renderer.info.render.triangles;if(now-lastStats>400){lastStats=now;el('draw-calls').textContent=number.format(state.drawCalls);el('triangles').textContent=number.format(state.renderedTriangles);state.memory={...renderer.info.memory};if(!state.quality.mobile)snapshot();const sorted=[...state.frameMs].sort((a,b)=>a-b);state.medianFrameMs=sorted.length?sorted[Math.floor(sorted.length/2)]:null;state.fps=state.medianFrameMs?1000/state.medianFrameMs:null;const error=gl.getError();if(error!==gl.NO_ERROR)state.webglErrors.push(error);}}
requestAnimationFrame(animate);
