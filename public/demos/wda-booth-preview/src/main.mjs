import * as THREE from 'three';
import {createGuide} from './guide.mjs';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createBoothNavigation} from './walk-navigation.mjs';
import {createGalleryWalk} from './walk.mjs';
import {createFloorContact} from './contact-floor.mjs';
import {createFloorMaterials} from './floor-materials.mjs';
import {floorPresets,defaultFloor} from './floor-presets.mjs';
import {createWallColors} from './wall-colors.mjs';
import {createPaperProtection} from './paper-protection.mjs';
const $=id=>document.getElementById(id),canvas=$('scene'),viewport=$('viewport');
const mobile=()=>innerWidth<720,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e9e3');scene.fog=new THREE.Fog('#e9e9e3',17,35);
const camera=new THREE.PerspectiveCamera(54,1,.05,60);camera.position.set(8.7,2.1,1.2);
const controls=new OrbitControls(camera,canvas);controls.target.set(-.4,1.55,0);controls.enableDamping=true;controls.dampingFactor=.12;controls.maxPolarAngle=Math.PI*.72;controls.minDistance=.65;controls.maxDistance=18;
let dirty=true,raf=0,walk,model,reflection,contact,floorMaterials,wallColors,paperProtection,transition=null,disposed=false,reflectionDirty=false;let shadowVariant=new URLSearchParams(location.search).get('shadows')==='before'?'before':'after';const frameTimes=[];
const guide=createGuide({document,onOpen:()=>walk?.clearInput()});
const stats={ready:false,frames:0,shadowUpdates:0,modelBytes:0,triangles:0,drawCalls:0,textureCount:0,loadMilliseconds:0,errors:[],navigation:null,quality:'balanced',shadowVariant,contactBuildMilliseconds:0};
function invalidate(){dirty=true;if(!raf&&!document.hidden&&!disposed)raf=requestAnimationFrame(frame);}
function shadowsDirty(){renderer.shadowMap.needsUpdate=true;reflectionDirty=true;stats.shadowUpdates++;invalidate();}
controls.addEventListener('change',invalidate);controls.addEventListener('start',()=>{transition=null;viewport.classList.add('viewing');invalidate();});
const hemi=new THREE.HemisphereLight(0xf1f4ff,0xb8b4a9,.65);scene.add(hemi);
const key=new THREE.DirectionalLight(0xfff7e9,1.25);key.position.set(2,7,2);key.target.position.set(-.7,0,0);scene.add(key,key.target);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:1,far:16});key.shadow.bias=-.00003;key.shadow.normalBias=.004;key.shadow.radius=4;key.shadow.autoUpdate=false;
const fill=new THREE.DirectionalLight(0xe5edff,.3);fill.position.set(6,3,-4);scene.add(fill);
function setShadowVariant(variant){
 if(!['before','after'].includes(variant))return false;
 shadowVariant=variant;stats.shadowVariant=variant;
 const improved=variant==='after';renderer.shadowMap.type=improved?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
 key.shadow.radius=improved?8:4;key.shadow.normalBias=improved?.001:.004;key.shadow.bias=improved?-.00001:-.00003;
 contact?.set({enabled:improved&&$('shadows').checked});
 scene.traverse(o=>{if(o.isMesh)for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.needsUpdate=true;});
 key.shadow.needsUpdate=true;shadowsDirty();return true;
}
setShadowVariant(shadowVariant);
const lights=[];
const reflectionDefaults={enabled:true,intensity:.46,roughness:.4};
const views={entry:{position:[8.7,2.1,1.2],target:[-.4,1.55,0],fov:54},overview:{position:[12.051316116641255,.9999153634083802,-4.595185422555213],target:[0,1.3,0],fov:54},framed:{position:[.1,1.72,-.2],target:[.1,1.8,2.5],fov:57},drawings:{position:[.1,1.72,.3],target:[.1,1.84,-2.5],fov:57}};
function setView(name,instant=false){const pose=views[name];if(!pose)return false;walk?.exit();viewport.classList.toggle('viewing',name!=='entry');for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===name);transition={start:performance.now(),duration:instant||reduced?0:850,from:camera.position.clone(),to:new THREE.Vector3(...pose.position),targetFrom:controls.target.clone(),targetTo:new THREE.Vector3(...pose.target),fovFrom:camera.fov,fovTo:pose.fov};invalidate();return true;}
function frame(now){raf=0;if(disposed||document.hidden)return;const started=performance.now();let animate=false;
 if(transition){const t=transition.duration?Math.min(1,(now-transition.start)/transition.duration):1,s=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,s);controls.target.lerpVectors(transition.targetFrom,transition.targetTo,s);camera.fov=THREE.MathUtils.lerp(transition.fovFrom,transition.fovTo,s);camera.updateProjectionMatrix();if(t===1)transition=null;else animate=true;}
 if(walk?.state.active)animate=walk.update(now)||animate;else{animate=controls.update()||animate;if(camera.position.y<.25){camera.position.y=.25;controls.update();}}
 if(dirty||animate){dirty=false;const contactStart=performance.now();if(contact?.update()){stats.contactBuildMilliseconds=performance.now()-contactStart;reflectionDirty=true;}reflection?.update(reflectionDirty);reflectionDirty=false;renderer.render(scene,camera);stats.frames++;stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.textureCount=renderer.info.memory.textures;frameTimes.push(performance.now()-started);if(frameTimes.length>120)frameTimes.shift();}
 if(animate)invalidate();
}
function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio,$('quality').value==='high'?1.75:mobile()?1:1.25));renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();reflection?.resize?.();invalidate();}
new ResizeObserver(resize).observe(viewport);document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;walk?.clearInput();}else invalidate();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('load-status').textContent='Graphics context paused. Reload to restore this local study.';stats.errors.push('contextlost');});
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view));
function panel(open){$('settings').hidden=!open;$('settings-button').setAttribute('aria-expanded',String(open));walk?.clearInput();}
$('walk-shortcut').onclick=()=>walk?.enter();
$('settings-button').onclick=()=>panel($('settings').hidden);$('close-settings').onclick=()=>panel(false);
$('light').oninput=()=>{const v=Number($('light').value)/100;renderer.toneMappingExposure=v;$('light-value').value=Math.round(v*100)+'%';invalidate();};
$('quality').onchange=()=>{stats.quality=$('quality').value;resize();};
$('shadows').onchange=()=>{renderer.shadowMap.enabled=$('shadows').checked;contact?.set({enabled:shadowVariant==='after'&&$('shadows').checked});scene.traverse(o=>{if(o.isMesh){for(const m of (Array.isArray(o.material)?o.material:[o.material]))m.needsUpdate=true;}});key.shadow.needsUpdate=true;shadowsDirty();};
$('reflections').onchange=()=>{reflection?.set({enabled:$('reflections').checked});syncMaterialControls();invalidate();};
$('floor-material').onchange=()=>floorMaterials?.select($('floor-material').value);
function syncMaterialControls(){
 const surface=floorMaterials?.getSurface();
 for(const [id,key] of [['floor-metalness','metalness'],['floor-roughness','roughness'],['floor-relief','normalStrength']]){
  const input=$(id);input.disabled=!surface||floorMaterials.state.loading;
  if(surface){input.value=surface[key];$(id+'-value').value=key==='normalStrength'?Math.round(surface[key]*100)+'%':Number(surface[key]).toFixed(2);}
 }
 $('reset-floor').disabled=!surface;
 for(const [id,key] of [['reflection-strength','intensity'],['reflection-blur','roughness']]){
  const input=$(id);input.disabled=!reflection?.state.ready||!reflection.state.enabled;
  if(reflection){input.value=reflection.state[key];$(id+'-value').value=Number(reflection.state[key]).toFixed(2);}
 }
 $('reset-reflection').disabled=!reflection?.state.ready;
 const wall=wallColors?.state;$('wall-color').disabled=!wall?.ready;$('reset-wall-color').disabled=!wall?.ready;
 if(wall?.color){$('wall-color').value=wall.color;$('wall-color-value').value=wall.color.toUpperCase();}
}
for(const [id,key] of [['floor-metalness','metalness'],['floor-roughness','roughness'],['floor-relief','normalStrength']])$(id).oninput=()=>{floorMaterials?.setSurface({[key]:Number($(id).value)});};
$('reset-floor').onclick=()=>floorMaterials?.resetSurface();
for(const [id,key] of [['reflection-strength','intensity'],['reflection-blur','roughness']])$(id).oninput=()=>{reflection?.set({[key]:Number($(id).value)});syncMaterialControls();invalidate();};
$('reset-reflection').onclick=()=>{reflection?.set({intensity:reflectionDefaults.intensity,roughness:reflectionDefaults.roughness});syncMaterialControls();invalidate();};
$('wall-color').oninput=()=>wallColors?.setColor($('wall-color').value);
$('reset-wall-color').onclick=()=>wallColors?.reset();
const start=performance.now();
async function load(){
 const draco=new DRACOLoader().setDecoderPath('./decoders/draco/').setWorkerLimit(1);
 const loader=new GLTFLoader().setDRACOLoader(draco);
 const [gltf,info,hdr]=await Promise.all([loader.loadAsync('./assets/client-booth.glb',e=>{if(e.total)$('load-status').textContent=`Loading the original booth · ${Math.round(e.loaded/e.total*100)}%`;}),fetch('./assets/booth-info.json').then(r=>{if(!r.ok)throw Error('Booth metadata unavailable');return r.json();}),new HDRLoader().loadAsync('./assets/source-dancing-hall-1k.hdr').catch(e=>{stats.errors.push('Source HDR unavailable; studio fallback');return new HDRLoader().loadAsync('./assets/studio_small_09_1k.hdr');})]);
 hdr.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(hdr).texture;scene.environmentIntensity=.55;hdr.dispose();pmrem.dispose();
 model=gltf.scene;model.updateMatrixWorld(true);const boxes=[],floors=[],wallMeshes=[],grouped=new Map();
 // Source Cube.035 belongs to the neighboring bay. Cropping at Blender Y=2.55
 // left a ~1 micrometre channel cross-section above this wall, not a support.
 // Remove only that inspected sliver; a future full-length rail must survive.
 stats.sourceCleanup=[];const railRemnants=[];
 model.traverse(o=>{if(!o.isMesh||o.userData.sourceObject!=='Cube.035'||o.userData.sourceCollections!=='Collection')return;
  const b=new THREE.Box3().setFromObject(o,true),s=b.getSize(new THREE.Vector3());
  if(s.z<.00001&&s.x>.05&&s.x<.07&&s.y>.07&&s.y<.09&&Math.abs(b.min.z+2.55)<.00001&&b.min.y>3.5&&b.max.y<3.59)railRemnants.push(o);
 });
 for(const o of railRemnants){stats.sourceCleanup.push({source:o.userData.sourceObject,reason:'Neighboring bay rail cross-section left by crop'});o.removeFromParent();}
 if(new URLSearchParams(location.search).get('paperProtection')!=='off')paperProtection=createPaperProtection({model});
 model.traverse(o=>{if(!o.isMesh||o.userData.presentationVariant)return;const role=o.userData.walkRole,box=new THREE.Box3().setFromObject(o);if(role==='wall')boxes.push({id:o.name,min:box.min.toArray(),max:box.max.toArray()});o.castShadow=role!=='floor';o.receiveShadow=true;
  for(const m of (Array.isArray(o.material)?o.material:[o.material])){m.envMapIntensity=.55;for(const name of ['map','normalMap','roughnessMap','metalnessMap'])if(m[name])m[name].anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());if(m.name==='wall_paint')m.roughness=Math.max(.76,m.roughness);if(m.name==='magnet')m.roughness=Math.max(.42,m.roughness);if(m.name.startsWith('49017307733_')&&m.opacity===1){m.transparent=false;m.depthWrite=true;}}
  if(role==='floor')floors.push(o);
  if(role==='wall')wallMeshes.push(o);
  if(o.userData.sourceCollections==='magnets'&& !Array.isArray(o.material)){const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);const group=grouped.get(o.material)||[];group.push({geo,mesh:o});grouped.set(o.material,group);}
 });
 for(const [mat,items] of grouped){const geo=mergeGeometries(items.map(x=>x.geo),false);if(geo){const merged=new THREE.Mesh(geo,mat);merged.name='Source_magnets_merged';merged.castShadow=true;merged.receiveShadow=true;model.add(merged);for(const i of items){i.mesh.removeFromParent();i.geo.dispose();}}}
 scene.add(model);
 wallColors=createWallColors({meshes:wallMeshes,onChange:()=>{reflectionDirty=true;syncMaterialControls();invalidate();}});
 for(const l of info.lights){if(l.type!=='SPOT')continue;const light=new THREE.SpotLight(new THREE.Color(...l.color),l.energy*.12,7,l.spot_size/2,.7,2);light.position.set(l.position[0],l.position[2],-l.position[1]);light.target.position.copy(light.position).add(new THREE.Vector3(l.direction[0],l.direction[2],-l.direction[1]));scene.add(light,light.target);lights.push(light);}
 const navigation=createBoothNavigation({bounds:{minX:-3.7,maxX:7.5,minZ:-5.5,maxZ:5.5},boxes,radius:.24,eyeHeight:1.7});stats.navigation={bounds:navigation.bounds,boxes};
 walk=createGalleryWalk({camera,controls,canvas,viewport,navigation,getEntryPose:()=>({position:[4.2,1.7,0],target:[0,1.7,0],fov:60}),button:$('walk-button'),onInvalidate:invalidate,onEnter:()=>{transition=null;viewport.classList.add('walking');panel(false);$('mode-label').textContent='WASD / arrows · Drag to look · Esc to exit';},onExit:()=>{viewport.classList.remove('walking');$('mode-label').textContent='Drag to orbit · Scroll to approach';invalidate();}});
 scene.updateMatrixWorld(true);const contactCasters=[];model.traverse(o=>{if(o.isMesh&&o.castShadow)contactCasters.push(o);});
 contact=createFloorContact({floors,casters:contactCasters,resolution:512,maxHeight:.25,intensity:.28,radius:.07,enabled:shadowVariant==='after'&&$('shadows').checked});
 const floorSurfaces=[...new Set(floors.flatMap(f=>Array.isArray(f.material)?f.material:[f.material]))];
 try{const m=await import('./reflections.mjs');reflection=m.createBoothReflections({renderer,scene,camera,floors});reflection.set(reflectionDefaults);}catch(e){stats.errors.push('Optional floor reflection unavailable: '+e.message);$('reflections').checked=false;$('reflections').disabled=true;}
 for(const p of floorPresets){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;$('floor-material').append(option);}
 floorMaterials=createFloorMaterials({materials:floorSurfaces,variants:floorPresets,anisotropy:Math.min(4,renderer.capabilities.getMaxAnisotropy()),
  onChange:state=>{reflection?.syncSurface();invalidate();},
  onStatus:state=>{const select=$('floor-material');select.value=state.loading?state.requested:state.active;select.setAttribute('aria-busy',String(state.loading));
   $('floor-status').textContent=state.loading?'Loading floor material…':state.error?'Could not load that floor. The previous floor is kept.':state.active==='original'?'Original client floor.':state.active==='oak-regular-parquet'?'Oak parquet · 7.5 cm boards · 1.8 m texture repeat':state.active==='fine-concrete'?'Fine aggregate · 1 m texture repeat':'Satin concrete · 80 cm slabs';syncMaterialControls();}
 });
 $('floor-material').disabled=false;
 let initialFloor=new URLSearchParams(location.search).get('floor')||defaultFloor;
 if(initialFloor!=='original'&&!floorPresets.some(p=>p.id===initialFloor))initialFloor=defaultFloor;
 await floorMaterials.select(initialFloor);
 syncMaterialControls();
 stats.ready=true;stats.modelBytes=info.geometryBytes;stats.loadMilliseconds=performance.now()-start;
 $('walk-shortcut').disabled=false;$('walk-button').disabled=false;$('load-status').textContent='Ready · No download or account needed';$('model-stats').textContent=`${(info.geometryBytes/1e6).toFixed(1)} MB model · ${info.sourceTriangles.toLocaleString()} triangles · Original furnished bay · 3.5 m walls`;
 key.shadow.needsUpdate=true;shadowsDirty();resize();draco.dispose();
}
load().catch(e=>{stats.errors.push(e.message);$('fatal').hidden=false;$('fatal').textContent='The booth could not load. '+e.message;$('load-status').textContent='Loading failed';console.error(e);});
window.__WDA_WALK__={stats,scene,camera,renderer,controls,get walk(){return walk},get reflection(){return reflection},get contact(){return contact},get floorMaterials(){return floorMaterials},get wallColors(){return wallColors},get paperProtection(){return paperProtection},setShadowVariant,setView,invalidate,report:()=>({...stats,camera:{position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov},frameTimesMs:frameTimes.slice(),walk:walk?.state,reflections:reflection?.state,contact:contact?.state,floorMaterial:floorMaterials?.state,wallColors:wallColors?.state,paperProtection:paperProtection?.state})};
resize();invalidate();
